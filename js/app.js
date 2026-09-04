/* =============================================================
   app.js  ——  涨跌看板（紧凑卡片版）
   ============================================================= */
(function () {
  "use strict";

  /* ---------------- 工具 ---------------- */
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const keyOf  = (it) => `${it.cat}|${it.n}|${it.lv}`;
  const lvCls  = (lv) => "lv" + (lv === 7 || lv === 6 || lv === 5 ? lv : 0);
  const lvText = (lv) => (lv === 7 || lv === 6 || lv === 5 ? lv + "级" : "低级");
  const LVRANK = { 7: 4, 6: 3, 5: 2, 0: 1 };
  const fmt    = (n) => (n == null ? "—" : n.toLocaleString("en-US"));

  /* 价格缩写：2348720 → 234.9万；1230 → 1,230 */
  function shortNum(n) {
    if (n == null) return "—";
    if (n >= 100000000) return (n / 100000000).toFixed(2) + "亿";
    if (n >= 10000) {
      const w = n / 10000;
      return (w >= 100 ? w.toFixed(1) : w.toFixed(2)) + "万";
    }
    return n.toLocaleString("en-US");
  }

  function parseTime(str) { return new Date(str.replace(/-/g, "/").replace("T", " ")); }
  function spanText(a, b) {
    const ms = Math.abs(parseTime(b) - parseTime(a));
    if (!ms) return "同一时点";
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分钟`;
  }
  function agoText(str) {
    const ms = Date.now() - parseTime(str);
    if (ms < 0) return ms > -6 * 3600000 ? "刚刚" : "未来记录";
    const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return `${d} 天前`;
    if (h > 0) return `${h} 小时前`;
    return `${m} 分钟前`;
  }

  const FAV_KEY = "mjBoardFavs";
  let favs = {};
  try { favs = JSON.parse(localStorage.getItem(FAV_KEY) || "{}"); } catch (e) { favs = {}; }
  const saveFav = () => localStorage.setItem(FAV_KEY, JSON.stringify(favs));

  /* ---------------- 状态 ---------------- */
  const ALL_CAT = "__all__";   // 跨全部分类
  const state = {
    from: SNAPSHOTS[0].id,
    to:   SNAPSHOTS[SNAPSHOTS.length - 1].id,
    cat:  GROUPS[0].cats[0],   // 或 ALL_CAT
    sortKey: null,     // level | name | price | chg
    sortDir: 1,
    keyword: "",
    filter: "all",
  };
  const isGlobal = () => state.cat === ALL_CAT || !!state.keyword;

  /* ---------------- 核心计算 ---------------- */
  function compute(it) {
    const k = keyOf(it);
    const from = PRICES[state.from] ? PRICES[state.from][k] : null;
    const to   = PRICES[state.to]   ? PRICES[state.to][k]   : null;
    const diff = (from != null && to != null) ? to - from : null;
    const pct  = (from != null && to != null && from !== 0) ? (diff / from) * 100 : null;
    let dir = "flat";
    if (diff != null && diff > 0) dir = "up";
    if (diff != null && diff < 0) dir = "down";
    return { ...it, key: k, from, to, diff, pct, dir };
  }
  const allRows = () => ITEMS.map(compute);
  const snapById = (id) => SNAPSHOTS.find((s) => s.id === id);

  /* ---------------- 对比选择器（单行，只显示时间） ---------------- */
  const selFrom = $("#selFrom"), selTo = $("#selTo");
  const optHTML = (sel) => SNAPSHOTS.map((s) =>
    `<option value="${s.id}" ${s.id === sel ? "selected" : ""}>${s.short}</option>`).join("");
  function syncSelects() { selFrom.innerHTML = optHTML(state.from); selTo.innerHTML = optHTML(state.to); }
  selFrom.addEventListener("change", (e) => { state.from = e.target.value; refreshAll(); });
  selTo.addEventListener("change",   (e) => { state.to   = e.target.value; refreshAll(); });

  /* ---------------- 本金条（可折叠） ---------------- */
  const capBar = $("#capBar"), capDetail = $("#capDetail");
  capBar.addEventListener("click", () => {
    const open = capBar.getAttribute("aria-expanded") === "true";
    capBar.setAttribute("aria-expanded", String(!open));
    capDetail.classList.toggle("open", !open);
  });

  function renderCap() {
    const cur  = snapById(state.to);
    const base = snapById(state.from);
    const idx  = SNAPSHOTS.findIndex((s) => s.id === state.to);
    const prev = idx > 0 ? SNAPSHOTS[idx - 1] : null;

    $("#capValue").textContent = fmt(cur.capital);
    $("#capTime").textContent  = cur.short;
    $("#capAgo").textContent   = agoText(cur.time);
    $("#cdTime").textContent   = cur.short;
    $("#cdTag").textContent    = cur.tag;
    $("#cdCount").textContent  = Object.keys(PRICES[cur.id] || {}).length + " 项";
    $("#cdSpan").textContent   = prev ? spanText(prev.time, cur.time) : "首次基线";

    const sp = spanText(base.time, cur.time);
    $("#cmpSpan").innerHTML = `${base.short} → ${cur.short} · 间隔 <b>${sp}</b>`;
    $("#footMid").textContent = `最新 ${cur.short} · ${agoText(cur.time)}`;
  }

  /* ---------------- 统计概览（精简 + 横滚） ---------------- */
  let statCache = { up: [], down: [], flat: [], all: [] };

  function renderStats() {
    const rows = allRows();
    const ups = rows.filter((r) => r.dir === "up");
    const downs = rows.filter((r) => r.dir === "down");
    const flats = rows.filter((r) => r.dir === "flat");
    const valid = rows.filter((r) => r.pct != null);
    const avg = valid.length ? valid.reduce((s, r) => s + r.pct, 0) / valid.length : 0;

    statCache = {
      up:   ups.slice().sort((a, b) => b.pct - a.pct),
      down: downs.slice().sort((a, b) => a.pct - b.pct),
      flat: flats,
      all:  rows.slice().sort((a, b) => b.pct - a.pct),
    };

    const cards = [
      { f: "up",   label: "上涨", val: ups.length, unit: "项", cls: "s-up" },
      { f: "down", label: "下跌", val: downs.length, unit: "项", cls: "s-down" },
      { f: "flat", label: "持平", val: flats.length, unit: "项", cls: "s-flat" },
      { f: "all",  label: "均价", val: (avg >= 0 ? "+" : "") + avg.toFixed(2), unit: "%", cls: avg >= 0 ? "s-up" : "s-down" },
    ];

    $("#stats").innerHTML = cards.map((c) =>
      `<button class="stat ${state.filter === c.f ? "active" : ""}" data-f="${c.f}">
         <div class="s-label">${c.label}</div>
         <div class="s-value ${c.cls}">${c.val}<span style="font-size:10px;font-weight:700;opacity:.55">${c.unit}</span></div>
       </button>`).join("");
  }

  /* ---------------- 导航 ---------------- */
  const nav = $("#nav");
  function renderNav() {
    const movedByCat = {};
    allRows().forEach((r) => { if (r.dir !== "flat") movedByCat[r.cat] = (movedByCat[r.cat] || 0) + 1; });

    const rowsN = allRows().length;
    nav.innerHTML =
      `<button data-cat="${ALL_CAT}" class="${state.cat === ALL_CAT ? "active" : ""}">全部<span class="nav-badge" style="background:rgba(255,255,255,.08);color:var(--tx-sub)">${rowsN}</span></button>` +
      GROUPS.map((g) => {
        const btns = g.cats.map((c) => {
          const moved = movedByCat[c] || 0;
          const badge = moved ? `<span class="nav-badge">${moved}</span>` : "";
          return `<button data-cat="${c}" class="${c === state.cat ? "active" : ""}">${CATS[c]}${badge}</button>`;
        }).join("");
        return `<div class="nav-group">${g.label}</div>${btns}`;
      }).join("");
  }
  nav.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-cat]");
    if (!btn) return;
    state.cat = btn.dataset.cat;
    // 切回具体分类时，自动解除涨跌筛选，避免出现"该分类没有跌项"的空白
    if (state.cat !== ALL_CAT && state.filter !== "all" && state.filter !== "fav") {
      state.filter = "all";
      $$("#chips .chip:not(.sort)").forEach((c) => c.classList.toggle("active", c.dataset.f === "all"));
      $$("#stats .stat").forEach((s) => s.classList.remove("active"));
    }
    renderNav(); renderList();
    $("#main").scrollTop = 0;
  });

  /* ---------------- 胶囊：筛选 + 排序 ---------------- */
  $("#chips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;

    if (b.dataset.s !== undefined) {                 // 排序
      const s = b.dataset.s;
      if (s === "none") { state.sortKey = null; state.sortDir = 1; }
      else if (state.sortKey === s) { state.sortDir = -state.sortDir; }
      else { state.sortKey = s; state.sortDir = 1; }
      syncSortChips(); renderList(); return;
    }

    state.filter = b.dataset.f;                       // 筛选
    // 涨跌筛选是全局意图：自动切到「全部」，否则在当前分类下容易出现空白
    if (state.filter === "up" || state.filter === "down" || state.filter === "flat" || state.filter === "fav") {
      state.cat = ALL_CAT;
    }
    $$("#chips .chip:not(.sort)").forEach((c) => c.classList.toggle("active", c === b));
    $$("#stats .stat").forEach((s) => s.classList.toggle("active", s.dataset.f === b.dataset.f));
    renderNav(); renderList();
    $("#main").scrollTop = 0;
  });

  function syncSortChips() {
    $$("#chips .chip.sort").forEach((c) => {
      const s = c.dataset.s;
      const on = (s === "none" && !state.sortKey) || s === state.sortKey;
      c.classList.toggle("active", on);
      if (s !== "none") {
        const base = s === "level" ? "等级" : s === "name" ? "名称" : s === "price" ? "现价" : "涨跌";
        c.textContent = on ? base + (state.sortDir > 0 ? " ↑" : " ↓") : base;
      }
    });
  }

  /* ---------------- 搜索 ---------------- */
  $("#search").addEventListener("input", (e) => {
    const prev = !!state.keyword;
    state.keyword = e.target.value.trim().toLowerCase();

    // 搜索是明确指向，自动解除涨跌筛选，避免"搜到了却因筛选被过滤"的困惑
    if (state.keyword && state.filter !== "all" && state.filter !== "fav") {
      state.filter = "all";
      $$("#chips .chip:not(.sort)").forEach((c) => c.classList.toggle("active", c.dataset.f === "all"));
      $$("#stats .stat").forEach((s) => s.classList.remove("active"));
    }
    if (prev !== !!state.keyword) renderNav();   // 进入/退出搜索时刷新导航高亮
    renderList();
  });

  /* ---------------- 卡片列表 ---------------- */
  const listEl = $("#list");

  function chgText(r) {
    if (r.diff == null || r.pct == null) return { main: "—", sub: "", cls: "flat" };
    if (r.dir === "flat") return { main: "持平", sub: "", cls: "flat" };
    if (Math.abs(r.pct) < 0.05)
      return { main: (r.diff > 0 ? "+" : "") + fmt(r.diff), sub: "≈0%", cls: r.dir };
    return {
      main: (r.pct > 0 ? "+" : "") + r.pct.toFixed(1) + "%",
      sub: (r.diff > 0 ? "+" : "") + shortNum(r.diff),
      cls: r.dir,
    };
  }

  function renderList() {
    let list = allRows();

    if (state.keyword) list = list.filter((r) => r.n.toLowerCase().includes(state.keyword));
    else if (state.cat !== ALL_CAT) list = list.filter((r) => r.cat === state.cat);

    if (state.filter === "up")   list = list.filter((r) => r.dir === "up");
    if (state.filter === "down") list = list.filter((r) => r.dir === "down");
    if (state.filter === "flat") list = list.filter((r) => r.dir === "flat");
    if (state.filter === "fav")  list = list.filter((r) => favs[r.key]);

    if (state.sortKey) {
      list.sort((a, b) => {
        let d = 0;
        if (state.sortKey === "price") d = (a.to ?? 0) - (b.to ?? 0);
        if (state.sortKey === "chg")   d = (a.pct ?? 0) - (b.pct ?? 0);
        if (state.sortKey === "level") d = (LVRANK[a.lv] || 0) - (LVRANK[b.lv] || 0);
        if (state.sortKey === "name")  d = a.n.localeCompare(b.n, "zh");
        return d * state.sortDir;
      });
    }

    $("#favCount").textContent = Object.keys(favs).length;

    if (!list.length) {
      listEl.innerHTML = `<div class="empty">
        <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.15">
          <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/>
        </svg>
        <p>暂无物资</p>
        <small>${
          state.keyword ? "换个关键词试试"
          : state.filter === "fav" ? "还没有收藏任何物资"
          : state.filter !== "all" ? "当前区间没有符合的物资"
          : "该分类还没有记录数据"
        }</small></div>`;
      $("#countBar").innerHTML = `0 项`;
      return;
    }

    listEl.innerHTML = list.map((r) => {
      const cls = lvCls(r.lv);
      const on = !!favs[r.key];
      const c = chgText(r);
      const nmCls = r.lv === 7 ? " lv7" : "";
      const faded = r.dir === "flat" ? " faded" : "";
      // 跨分类浏览（全部 / 搜索 / 涨跌筛选）时补上分类名，避免同名物资分不清
      const catTag = (state.cat === ALL_CAT || state.keyword)
        ? `<span class="r-cat">${CATS[r.cat]}</span>` : "";
      return `<div class="row" data-key="${r.key}" data-cat="${r.cat}">
        <div class="r-top">
          <span class="r-name${nmCls}">${r.n}</span>
          <span class="lvtag ${cls}">${lvText(r.lv)}</span>
          ${catTag}
          <span class="r-star ${on ? "on" : ""}">${on ? "★" : "☆"}</span>
        </div>
        <div class="r-bot">
          <span class="r-price${faded}">${shortNum(r.to)}</span>
          <span class="r-chg ${c.cls}">${c.main}${c.sub ? `<small>${c.sub}</small>` : ""}</span>
        </div>
      </div>`;
    }).join("");

    // 范围提示
    const FILTER_TXT = { up: "上涨", down: "下跌", flat: "持平", fav: "已收藏" };
    let scope;
    if (state.keyword) scope = `搜索「${$("#search").value.trim()}」`;
    else if (state.cat === ALL_CAT) scope = state.filter === "all" ? "全部分类" : `全部${FILTER_TXT[state.filter]}`;
    else scope = CATS[state.cat];
    $("#countBar").innerHTML = `<b>${list.length}</b> 项 · ${scope}`;
  }

  /* ---------------- 行交互 ---------------- */
  const main = $("#main");
  main.addEventListener("click", (e) => {
    const star = e.target.closest(".r-star");
    if (star) {
      const k = star.closest(".row").dataset.key;
      if (favs[k]) delete favs[k]; else favs[k] = 1;
      saveFav(); renderList();
      return;
    }
    const row = e.target.closest(".row[data-key]");
    if (row) { openModal(row.dataset.key); return; }

    const rect = main.getBoundingClientRect();
    const size = 90;
    const rp = document.createElement("span");
    rp.className = "ripple";
    rp.style.width = rp.style.height = size + "px";
    rp.style.left = e.clientX - rect.left + main.scrollLeft - size / 2 + "px";
    rp.style.top  = e.clientY - rect.top  + main.scrollTop  - size / 2 + "px";
    main.appendChild(rp);
    setTimeout(() => rp.remove(), 520);
  });

  /* ---------------- 浮层通用 ---------------- */
  const overlay = $("#overlay");
  function closeAll() {
    drawer.classList.remove("show");
    sheet.classList.remove("show");
    modal.classList.remove("show");
    overlay.classList.remove("show");
  }
  overlay.addEventListener("click", closeAll);

  /* ---------------- 历史抽屉 ---------------- */
  const drawer = $("#drawer");
  $("#btnHistory").addEventListener("click", () => {
    drawer.classList.add("show"); overlay.classList.add("show"); renderTimeline();
  });
  $("#btnCloseDrawer").addEventListener("click", closeAll);

  function renderTimeline() {
    $("#timeline").innerHTML = SNAPSHOTS.map((s, i) => {
      const cnt = Object.keys(PRICES[s.id] || {}).length;
      const isBase = s.id === state.from, isCur = s.id === state.to;
      const prev = i > 0 ? SNAPSHOTS[i - 1] : null;
      return `<div class="tl-item ${isBase ? "is-base" : ""} ${isCur ? "is-cur" : ""}">
        <div class="tl-time">${s.short}
          ${isBase ? '<span class="tl-badge base">基准</span>' : ""}
          ${isCur  ? '<span class="tl-badge cur">当前</span>' : ""}
        </div>
        <div class="tl-meta">${s.tag} · ${cnt} 项 · 本金 ${fmt(s.capital)}
          ${prev ? `<br>较上一次 ${spanText(prev.time, s.time)}` : "<br>首次基线记录"}</div>
        <div class="tl-acts">
          <button class="tl-btn" data-set="from" data-id="${s.id}" ${isBase ? "disabled" : ""}>设为基准</button>
          <button class="tl-btn" data-set="to" data-id="${s.id}" ${isCur ? "disabled" : ""}>设为当前</button>
        </div>
      </div>`;
    }).join("");
  }
  $("#timeline").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-set]"); if (!b) return;
    if (b.dataset.set === "from") state.from = b.dataset.id; else state.to = b.dataset.id;
    syncSelects(); refreshAll(); renderTimeline();
  });

  /* ---------------- 统计详情 Sheet ---------------- */
  const sheet = $("#sheet");
  $("#stats").addEventListener("click", (e) => {
    const s = e.target.closest(".stat"); if (!s) return;
    openSheet(s.dataset.f);
  });
  $("#btnCloseSheet").addEventListener("click", closeAll);

  const SHEET_TITLE = { up: "上涨物资", down: "下跌物资", flat: "持平物资", all: "全部波动排序" };

  function openSheet(f) {
    const rows = statCache[f] || [];
    $("#shTitle").textContent = `${SHEET_TITLE[f]}（${rows.length}）`;
    $("#shBody").innerHTML = rows.length
      ? rows.map((r) => {
          const c = chgText(r);
          return `<div class="sh-row" data-key="${r.key}">
            <span class="lvtag ${lvCls(r.lv)}" style="flex-shrink:0">${lvText(r.lv)}</span>
            <span class="sh-name">${r.n}</span>
            <span class="sh-from">${shortNum(r.from)}</span>
            <span class="sh-arrow">→</span>
            <span class="sh-to">${shortNum(r.to)}</span>
            <span class="sh-d ${c.cls}">${c.main}</span>
          </div>`;
        }).join("")
      : `<div class="empty"><p>该区间没有物资</p></div>`;
    sheet.classList.add("show"); overlay.classList.add("show");
  }
  $("#shBody").addEventListener("click", (e) => {
    const row = e.target.closest(".sh-row"); if (!row) return;
    openModal(row.dataset.key);
  });

  /* ---------------- 物品详情弹窗 ---------------- */
  const modal = $("#modal");
  $("#btnCloseModal").addEventListener("click", closeAll);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeAll(); });

  function sparkSVG(vals) {
    const W = 380, H = 96, PAD = 12;
    if (!vals.length) return "";
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const step = vals.length > 1 ? (W - PAD * 2) / (vals.length - 1) : 0;
    const pts = vals.map((v, i) => [
      vals.length > 1 ? PAD + i * step : W / 2,
      H - PAD - ((v - min) / range) * (H - PAD * 2),
    ]);
    const flat = vals.length < 2 || min === max;
    const stroke = flat ? "#5A5A5A" : vals[vals.length - 1] >= vals[0] ? "#FF4D4F" : "#5FBF80";
    const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const area = `${PAD},${H - PAD} ${line} ${pts[pts.length - 1][0].toFixed(1)},${H - PAD}`;
    const circles = pts.map((p, i) =>
      `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === pts.length - 1 ? 4.5 : 3.5}"
        fill="#121212" stroke="${stroke}" stroke-width="2"/>`).join("");
    const vlabels = pts.map((p, i) =>
      (i === 0 || i === pts.length - 1 || pts.length <= 4)
        ? `<text x="${p[0].toFixed(1)}" y="${(p[1] - 9).toFixed(1)}" fill="#EEEEEE" font-size="10"
            font-weight="700" text-anchor="middle" font-family="ui-monospace,Menlo,monospace">${shortNum(vals[i])}</text>`
        : "").join("");

    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${stroke}" stop-opacity=".28"/>
        <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
      </linearGradient></defs>
      <polygon points="${area}" fill="url(#sg)"/>
      <polyline points="${line}" fill="none" stroke="${stroke}" stroke-width="2.2"
        stroke-linejoin="round" stroke-linecap="round"/>
      ${circles}${vlabels}
    </svg>`;
  }

  function openModal(key) {
    const it = ITEMS.find((x) => keyOf(x) === key);
    if (!it) return;

    const pts = SNAPSHOTS.filter((s) => (PRICES[s.id] || {})[key] != null);
    const series = pts.map((s) => PRICES[s.id][key]);
    const labels = pts.map((s) => s.short);
    const r = compute(it);
    const cls = lvCls(it.lv);

    $("#moTitle").innerHTML = `${it.n} <span class="lvtag ${cls}" style="vertical-align:2px">${lvText(it.lv)}</span>`;
    $("#moSub").textContent = `${CATS[it.cat]} · 共 ${pts.length} 次记录`;

    const pctCls = r.dir === "up" ? "s-up" : r.dir === "down" ? "s-down" : "s-flat";
    const pctTxt = r.pct == null ? "—" : (r.pct > 0 ? "+" : "") + r.pct.toFixed(2) + "%";
    const diffTxt = r.diff == null ? "—" : (r.diff > 0 ? "+" : "") + fmt(r.diff);

    const histRows = SNAPSHOTS.map((s, i) => {
      const v = (PRICES[s.id] || {})[key];
      if (v == null) return "";
      const prev = i > 0 ? (PRICES[SNAPSHOTS[i - 1].id] || {})[key] : null;
      let d = "—", dc = "s-flat";
      if (prev != null && prev !== 0) {
        const p = ((v - prev) / prev) * 100;
        d = (p > 0 ? "+" : "") + (Math.abs(p) < 0.05 && p !== 0 ? "≈0" : p.toFixed(1)) + "%";
        dc = p > 0 ? "s-up" : p < 0 ? "s-down" : "s-flat";
      }
      return `<div class="hist-row">
        <span class="h-t">${s.short}</span><span class="h-p">${fmt(v)}</span><span class="h-d ${dc}">${d}</span>
      </div>`;
    }).join("");

    $("#moBody").innerHTML = `
      <div class="spark-box">
        ${sparkSVG(series)}
        <div class="spark-labels">
          <span>${labels[0] || ""}</span>
          <span>${labels.length} 个时点</span>
          <span>${labels[labels.length - 1] || ""}</span>
        </div>
      </div>
      <div class="mo-grid">
        <div class="mo-cell"><div class="k">基准价</div><div class="v" style="color:var(--tx-sub)">${fmt(r.from)}</div></div>
        <div class="mo-cell"><div class="k">当前价</div><div class="v">${fmt(r.to)}</div></div>
        <div class="mo-cell"><div class="k">涨跌额</div><div class="v sm ${pctCls}">${diffTxt}</div></div>
        <div class="mo-cell"><div class="k">涨跌幅</div><div class="v sm ${pctCls}">${pctTxt}</div></div>
      </div>
      <div class="mo-hist"><h4>全部记录</h4>${histRows}</div>
    `;
    modal.classList.add("show"); overlay.classList.add("show");
  }

  /* ---------------- ⚡ 一键：跌幅榜 ---------------- */
  $("#btnSet").addEventListener("click", () => {
    state.from = SNAPSHOTS[Math.max(0, SNAPSHOTS.length - 2)].id;
    state.to = SNAPSHOTS[SNAPSHOTS.length - 1].id;
    state.filter = "down";        // 直接切到「下跌」→ 自动跨全部分类
    state.cat = ALL_CAT;
    state.keyword = "";
    $("#search").value = "";
    state.sortKey = "chg";
    state.sortDir = 1;            // 升序 = 跌得最狠在前
    $$("#chips .chip:not(.sort)").forEach((c) => c.classList.toggle("active", c.dataset.f === "down"));
    $$("#stats .stat").forEach((s) => s.classList.toggle("active", s.dataset.f === "down"));
    syncSelects(); syncSortChips(); refreshAll();
    $("#main").scrollTop = 0;
  });

  /* ---------------- 刷新 ---------------- */
  function refreshAll() {
    renderCap();
    renderStats();
    renderNav();
    renderList();
  }

  /* ---------------- 启动 ---------------- */
  syncSelects();
  syncSortChips();
  refreshAll();

  /* 列表下滑时收起标题行与统计卡，把纵向空间让给列表 */
  const header = $(".app-header");
  let lastTop = 0, ticking = false;
  $("#main").addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const top = $("#main").scrollTop;
      if (Math.abs(top - lastTop) > 12) {
        header.classList.toggle("collapsed", top > 60 && top > lastTop);
        lastTop = top;
      }
      ticking = false;
    });
  }, { passive: true });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAll();
  });
})();
