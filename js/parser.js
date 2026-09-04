/* =============================================================
   parser.js  ——  记录文本解析器（浏览器 / Node 通用）

   把你在游戏里手打的那种纯文本记录，直接解析成结构化数据。
   支持：分类标题、品质段（极品/完美/五级区…）、等级标记、
         以及"名称独占一行、等级价格换行写"的写法。
   ============================================================= */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.RecordParser = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* 名称归一化：小写 + 去所有空白 + 去变音符号（Gōza → goza） */
  function norm(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[\s\u3000]+/g, "");
  }

  /* 编辑距离：仅用于"同分类+同等级"下的兜底模糊匹配。
     要求比对串长度 ≥4 —— 短词(如"甲修"/"头修")距离 1 会误判，禁用。 */
  function lev(a, b) {
    const m = a.length, n = b.length;
    const dp = [...Array(m + 1)].map((_, i) => [i, ...Array(n).fill(0)]);
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1,
                            dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return dp[m][n];
  }

  function fuzzyHit(cands, nm) {
    if (nm.length < 4) return null;                 // 短词不走模糊
    const near = cands
      .map((i) => ({ i, d: lev(nm, norm(i.n)) }))
      .filter((x) => x.d <= 1)
      .sort((a, b) => a.d - b.d);
    return near.length === 1 ? near[0].i : null;    // 多个候选则放弃，避免乱配
  }

  /* 分类关键词 → 分类 id（按长度降序匹配，避免"枪口"被"枪"抢先） */
  const CAT_KEYWORDS = [
    ["突击步枪", "rifle"], ["冲锋枪", "smg"], ["狙击枪", "sniper"],
    ["射手步枪", "marksman"], ["霰弹枪", "shotgun"], ["轻机枪", "lmg"],
    ["枪口", "muzzle"], ["镭射", "laser"], ["弹匣", "mag"], ["枪托", "stock"],
    ["装备", "gear"], ["子弹", "ammo"], ["弹药", "ammo"],
    ["战术道具", "tactical"],
    ["恢复品", "supply_med"], ["药剂", "supply_drug"],
    ["维修", "supply_repair"], ["特殊", "supply_special"],
    ["暗夜迷城", "key_night"], ["龙之遗迹", "key_dragon"],
  ];

  const CN_NUM = { 四: 4, 五: 5, 六: 6, 七: 7 };

  function matchCat(line) {
    for (const [kw, id] of CAT_KEYWORDS) if (line.indexOf(kw) >= 0) return id;
    return null;
  }

  /* 纯品质/等级段标题，如「极品品质」「完美品质」「五级区」「6 级」 */
  function matchQuality(line) {
    if (/极品/.test(line)) return 6;
    if (/完美/.test(line)) return 5;
    const m = line.match(/^(?:([4-7])|([四五六七]))\s*级\s*区?$/);
    if (m) return m[1] ? +m[1] : CN_NUM[m[2]];
    return null;
  }

  /**
   * 解析整段记录文本
   * @returns {{rows:Array, unknown:Array, tail:string}}
   *   rows    : [{ name, lv, price, cat, line }]
   *   unknown : 未能识别的行
   *   tail    : 文末备注（如"以上 X 月 X 号 XX 记录完毕"）
   */
  function parse(text) {
    const lines = String(text).split(/\r?\n/);
    const rows = [], unknown = [], newCats = {};
    let tail = "";
    let curCat = null, curLv = null, pendingName = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].replace(/\u3000/g, " ").trim();
      if (!line) continue;

      // 文末备注
      if (/记录完毕|^\s*以上/.test(line)) { tail = line; continue; }

      // 1) 先取尾部价格 —— 有价格就一定是数据行。
      //    必须先于分类判断，否则"鸟笼枪口 102880"会被"枪口"关键词抢去当分类标题。
      const pm = line.match(/(?:^|\s)(\d[\d,]*)\s*$/);
      let price = null, rest = line;
      if (pm) {
        price = parseInt(pm[1].replace(/,/g, ""), 10);
        rest = line.slice(0, pm.index).trim();
      }

      if (price != null) {
        // 从剩余部分剥出等级标记（"海员船牢房钥匙 6 级" / "5级"）
        let lv = curLv;
        const lm = rest.match(/(?:^|\s)(?:([4-7])|([四五六七]))\s*级$/);
        if (lm) {
          lv = lm[1] ? +lm[1] : CN_NUM[lm[2]];
          rest = rest.slice(0, lm.index).trim();
        }
        const name0 = rest || pendingName;
        if (!name0) { unknown.push(line); continue; }
        let name = name0;
        // 弹药里的 "12" / "16" 补成 "12G" / "16G"
        if (curCat === "ammo" && /^\d{2}$/.test(name)) name += "G";
        rows.push({ name, lv: lv == null ? 0 : lv, price, cat: curCat, line });
        continue;
      }

      // 2) 无价格 → 分类标题（已注册关键词）
      const cat = matchCat(line);
      if (cat) { curCat = cat; curLv = null; pendingName = null; continue; }

      // 2b) 无价格 → 形如「XXX专区」「XXX类」的新分类，自动登记
      //     否则像"新武器专区"会错误继承上一个分类
      const nc = line.match(/^([^\s]{2,10}?)(?:专区|类)$/);
      if (nc) {
        const label = nc[1];
        newCats[label] = label;          // 中文直接当 id，便于人读可改
        curCat = label;
        curLv = null; pendingName = null;
        continue;
      }

      // 3) 无价格 → 品质 / 等级段
      const q = matchQuality(line);
      if (q !== null) { curLv = q; continue; }

      // 4) 无价格 → 可能是独占一行的物品名（头盔 / 头修 / 甲修）
      const isHeader = /类|专区|品质|级/.test(line);
      if (!isHeader && line.length <= 12) pendingName = line;
    }

    // 只保留真正有数据的新分类（"补给品类"这种纯父标题会被剔除）
    const used = new Set(rows.map((r) => r.cat));
    Object.keys(newCats).forEach((k) => { if (!used.has(k)) delete newCats[k]; });

    return { rows, unknown, tail, newCats };
  }

  /* 从文末备注里提取记录时间
     支持："以上 9 月 5 号 0 点 49 记录完毕" */
  function parseTailTime(tail) {
    if (!tail) return null;
    const m = tail.match(
      /(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[号日]\s*(?:(\d{1,2})\s*[:点时]\s*)?(\d{1,2})?/
    );
    if (!m) return null;
    const now = new Date();
    const year = m[1] && m[1].length === 4 ? +m[1] : now.getFullYear();
    const month = +m[2], day = +m[3];
    let hour = m[4] != null ? +m[4] : 0;
    let min = m[5] != null ? +m[5] : 0;
    // "0 点 49" → 0:49；若只有两位数且像时刻(如 22 49)，则按 时:分
    if (m[4] != null && m[5] == null) { min = hour; hour = 0; }
    const pad = (n) => String(n).padStart(2, "0");
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(min)}`;
  }

  /**
   * 在已有物资清单里定位一行记录
   * 匹配优先级：精确 → alias → 同(cat,lv)编辑距离≤1
   * @returns {object|null}
   */
  function findItem(items, row) {
    const nm = norm(row.name);
    let hit = items.find((i) => i.cat === row.cat && norm(i.n) === nm && i.lv === row.lv);
    if (hit) return hit;
    hit = items.find((i) => i.cat === row.cat && i.lv === row.lv &&
      Array.isArray(i.alias) && i.alias.some((a) => norm(a) === nm));
    if (hit) return hit;
    const cands = items.filter((i) => i.cat === row.cat && i.lv === row.lv);
    return fuzzyHit(cands, nm);
  }

  return { parse, norm, lev, fuzzyHit, findItem, matchCat, matchQuality, parseTailTime, CAT_KEYWORDS };
});
