/* =============================================================
   摸金交易行 · 涨跌看板
   数据源：data/items.json  +  data/prices.json
   更新数据只需改 prices.json，页面刷新即生效。
   ============================================================= */
(function () {
  "use strict";

  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  /* ---------------- 数据（运行时由 JSON 填充） ---------------- */
  let SNAPSHOTS = [], GROUPS = [], CATS = {}, ITEMS = [], PRICES = {}, DATA_UPDATED = "";

  /* ---------------- 工具 ---------------- */
  const keyOf  = (it) => `${it.cat}|${it.n}|${it.lv}`;
  const lvCls  = (lv) => "lv" + ([7, 6, 5, 4].includes(lv) ? lv : 0);
  const lvText = (lv) => ([7, 6, 5, 4].includes(lv) ? lv + "级" : "普通");
  const LVRANK = { 7: 5, 6: 4, 5: 3, 4: 2, 0: 1 };
  const fmt    = (n) => (n == null ? "—" : n.toLocaleString("en-US"));

  function shortNum(n) {
    if (n == null) return "—";
    if (n >= 100000000) return (n / 100000000).toFixed(2) + "亿";
    if (n >= 10000) { const w = n / 10000; return (w >= 100 ? w.toFixed(1) : w.toFixed(2)) + "万"; }
    return n.toLocaleString("en-US");
  }

  const parseTime = (s) => new Date(String(s).replace(/-/g, "/").replace("T", " "));
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

  const FAV_KEY = "mjBoardFavs", FONT_KEY = "mjBoardFont";
  let favs = {};
  try { favs = JSON.parse(localStorage.getItem(FAV_KEY) || "{}"); } catch (e) { favs = {}; }
  const saveFav = () => localStorage.setItem(FAV_KEY, JSON.stringify(favs));

  /* ---------------- 状态 ---------------- */
  const ALL_CAT = "__all__";
  const state = {
    from: null, to: null,
    cat: null,
    sortKey: null, sortDir: 1,
    keyword: "", filter: "all",
  };

  /* ---------------- 载入数据 ---------------- */
  async function loadData() {
    const bust = "?t=" + Date.now();          // 绕过浏览器缓存
    const [a, b] = await Promise.all([
      fetch("data/items.json"  + bust, { cache: "no-store" }).then(r => r.json()),
      fetch("data/prices.json" + bust, { cache: "no-store" }).then(r => r.json()),
    ]);
    CATS = a.cats || {};
    GROUPS = a.groups || [];
    ITEMS = a.items || [];
    SNAPSHOTS = b.snapshots || [];
    PRICES = b.prices || {};
    DATA_UPDATED = b.updated || "";
    if (!SNAPSHOTS.length || !ITEMS.length) throw new Error("数据为空");
  }

  /* ---------------- 核心计算 ---------------- */
  function compute(it) {
    const k = keyOf(it);
    const from = PRICES[state.from] ? PRICES[state.from][k] : null;
    const to   = PRICES[state.to]   ? PRICES[state.to][k]   : null;
    const diff = (from != null && to != null) ? to - from : null;
    const pct  = (from != null && to != null && from !== 0) ? (diff / from) * 100 : null;
    let dir = "flat";
    if (diff == null) dir = "none";            // 该快照未录入此物资
    else if (diff > 0) dir = "up";
    else if (diff < 0) dir = "down";
    return { ...it, key: k, from, to, diff, pct, dir };
  }
  const allRows = () => ITEMS.map(compute);
  const snapById = (id) => SNAPSHOTS.find((s) => s.id === id);

  /* ---------------- 对比选择器 ---------------- */
  const selFrom = $("#selFrom"), selTo = $("#selTo");
  const optHTML = (sel) => SNAPSHOTS.map((s) =>
    `<option value="${s.id}" ${s.id === sel ? "selected" : ""}>${s.short}</option>`).join("");
  function syncSelects() { selFrom.innerHTML = optHTML(state.from); selTo.innerHTML = optHTML(state.to); }
  selFrom.addEventListener("change", (e) => { state.from = e.target.value; refreshAll(); });
  selTo.addEventListener("change",   (e) => { state.to   = e.target.value; refreshAll(); });

  /* ---------------- 元信息行 ---------------- */
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
    $("#cdTag").textContent    = cur.tag || "—";
    $("#cdCount").textContent  = Object.keys(PRICES[cur.id] || {}).length + " 项";
    $("#cdSpan").textContent   = prev ? spanText(prev.time, cur.time) : "首次基线";
    $("#cdUpd").textContent    = DATA_UPDATED || "—";

    const sp = spanText(base.time, cur.time);
    $("#cmpSpan").innerHTML = `${base.short} → ${cur.short} · 间隔 <b>${sp}</b>`;
    $("#footMid").textContent = `最新 ${cur.short} · ${agoText(cur.time)}`;
  }

  /* ---------------- 统计概览 ---------------- */
  let statCache = { up: [], down: [], flat: [], all: [], none: [] };

  function renderStats() {
    const rows = allRows();
    const ups = rows.filter((r) => r.dir === "up");
    const downs = rows.filter((r) => r.dir === "down");
    const flats = rows.filter((r) => r.dir === "flat");
    const nones = rows.filter((r) => r.dir === "none");
    const valid = rows.filter((r) => r.pct != null);
    const avg = valid.length ? valid.reduce((s, r) => s + r.pct, 0) / valid.length : 0;

    statCache = {
      up:   ups.slice().sort((a, b) => b.pct - a.pct),
      down: downs.slice().sort((a, b) => a.pct - b.pct),
      flat: flats,
      none: nones,
      all:  rows.slice().sort((a, b) => b.pct - a.pct),
    };

    const cards = [
      { f: "up",   label: "上涨", val: ups.length, unit: "项", cls: "s-up" },
      { f: "down", label: "下跌", val: downs.length, unit: "项", cls: "s-down" },
      { f: "flat", label: "持平", val: flats.length, unit: "项", cls: "s-flat" },
    ];
    if (nones.length) cards.push({ f: "none", label: "无数据", val: nones.length, unit: "项", cls: "s-flat" });
    cards.push({ f: "all", label: "均价", val: (avg >= 0 ? "+" : "") + avg.toFixed(2), unit: "%", cls: avg >= 0 ? "s-up" : "s-down" });

    $("#stats").innerHTML = cards.map((c) =>
      `<button class="stat ${state.filter === c.f ? "active" : ""}" data-f="${c.f}">
         <div class="s-label">${c.label}</div>
         <div class="s-value ${c.cls}">${c.val}<span style="font-size:10px;font-weight:700;opacity:.55">${c.unit}</span></div>
       </button>`).join("");
  }

  /* ---------------- 导航 ---------------- */
  const nav = $("#nav");
  function renderNav() {
    const rowsN = allRows().length;
    const movedByCat = {};
    allRows().forEach((r) => { if (r.dir !== "flat") movedByCat[r.cat] = (movedByCat[r.cat] || 0) + 1; });

    nav.innerHTML =
      `<button data-cat="${ALL_CAT}" class="${state.cat === ALL_CAT ? "active" : ""}">全部<span class="nav-badge muted">${rowsN}</span></button>` +
      GROUPS.map((g) => g.cats.map((c, ci) => {
        const moved = movedByCat[c] || 0;
        const badge = moved ? `<span class="nav-badge">${moved}</span>` : "";
        return `<button data-cat="${c}" class="${c === state.cat ? "active" : ""}${ci === 0 ? " grp-start" : ""}">${CATS[c]}${badge}</button>`;
      }).join("")).join("");
  }
  nav.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-cat]");
    if (!btn) return;
    state.cat = btn.dataset.cat;
    if (state.cat !== ALL_CAT && state.filter !== "all" && state.filter !== "fav") {
      state.filter = "all";
      $$("#chips .chip:not(.sort)").forEach((c) => c.classList.toggle("active", c.dataset.f === "all"));
      $$("#stats .stat").forEach((s) => s.classList.remove("active"));
    }
    renderNav(); renderList();
    $("#main").scrollTop = 0;
  });

  /* ---------------- 胶囊 ---------------- */
  $("#chips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;

    if (b.dataset.s !== undefined) {
      const s = b.dataset.s;
      if (s === "none") { state.sortKey = null; state.sortDir = 1; }
      else if (state.sortKey === s) { state.sortDir = -state.sortDir; }
      else { state.sortKey = s; state.sortDir = 1; }
      syncSortChips(); renderList(); return;
    }

    state.filter = b.dataset.f;
    if (["up", "down", "flat", "none", "fav"].includes(state.filter)) state.cat = ALL_CAT;
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
        const base = { level: "等级", name: "名称", price: "现价", chg: "涨跌" }[s];
        c.textContent = on ? base + (state.sortDir > 0 ? " ↑" : " ↓") : base;
      }
    });
  }

  /* ---------------- 搜索 ---------------- */
  $("#search").addEventListener("input", (e) => {
    const prev = !!state.keyword;
    state.keyword = e.target.value.trim().toLowerCase();
    if (state.keyword && state.filter !== "all" && state.filter !== "fav") {
      state.filter = "all";
      $$("#chips .chip:not(.sort)").forEach((c) => c.classList.toggle("active", c.dataset.f === "all"));
      $$("#stats .stat").forEach((s) => s.classList.remove("active"));
    }
    if (prev !== !!state.keyword) renderNav();
    renderList();
  });

  /* ---------------- 卡片列表 ---------------- */
  const listEl = $("#list");

  function chgText(r) {
    if (r.dir === "none") return { main: "—", sub: "", cls: "flat" };
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
    if (state.filter === "none") list = list.filter((r) => r.dir === "none");
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
          : state.filter === "none" ? "当前区间所有物资都有数据"
          : state.filter !== "all" ? "当前区间没有符合的物资"
          : "该分类还没有记录数据"
        }</small></div>`;
      $("#countBar").innerHTML = `0 项`;
      return;
    }

    const showCat = state.cat === ALL_CAT || !!state.keyword;
    listEl.innerHTML = list.map((r) => {
      const cls = lvCls(r.lv);
      const on = !!favs[r.key];
      const c = chgText(r);
      const nmCls = r.lv === 7 ? " lv7" : "";
      const faded = r.dir === "flat" ? " faded" : "";
      const catTag = showCat ? `<span class="r-cat">${CATS[r.cat]}</span>` : "";
      return `<div class="row" data-key="${r.key}" data-cat="${r.cat}">
        <div class="r-top">
          <span class="r-name${nmCls}">${r.n}</span>
          <span class="lvtag ${cls}">${lvText(r.lv)}</span>
          <span class="r-star ${on ? "on" : ""}">${on ? "★" : "☆"}</span>
        </div>
        <div class="r-bot">
          <span class="r-left">
            <span class="r-price${faded}">${shortNum(r.to)}</span>
            ${catTag}
          </span>
          <span class="r-chg ${c.cls}">${c.main}${c.sub ? `<small>${c.sub}</small>` : ""}</span>
        </div>
      </div>`;
    }).join("");

    const FILTER_TXT = { up: "上涨", down: "下跌", flat: "持平", none: "无数据", fav: "已收藏" };
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

  /* ---------------- 浮层 ---------------- */
  const overlay = $("#overlay");
  const drawer = $("#drawer"), sheet = $("#sheet"), modal = $("#modal");
  function closeAll() {
    drawer.classList.remove("show");
    sheet.classList.remove("show");
    modal.classList.remove("show");
    overlay.classList.remove("show");
  }
  overlay.addEventListener("click", closeAll);

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
        <div class="tl-meta">${s.tag || "—"} · ${cnt} 项 · 本金 ${fmt(s.capital)}
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
  $("#stats").addEventListener("click", (e) => {
    const s = e.target.closest(".stat"); if (!s) return;
    openSheet(s.dataset.f);
  });
  $("#btnCloseSheet").addEventListener("click", closeAll);

  const SHEET_TITLE = { up: "上涨物资", down: "下跌物资", flat: "持平物资", none: "未录入物资", all: "全部波动排序" };
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

  /* ---------------- 物品详情 ---------------- */
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
        ? `<text x="${p[0].toFixed(1)}" y="${(p[1] - 9).toFixed(1)}" fill="#EEEEEE" font-size="11"
            font-weight="700" text-anchor="middle" font-family="inherit">${shortNum(vals[i])}</text>`
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
          <span>${labels[0] || ""}</span><span>${labels.length} 个时点</span><span>${labels[labels.length - 1] || ""}</span>
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

  /* ---------------- ⚡ 一键跌幅榜 ---------------- */
  $("#btnSet").addEventListener("click", () => {
    state.from = SNAPSHOTS[Math.max(0, SNAPSHOTS.length - 2)].id;
    state.to = SNAPSHOTS[SNAPSHOTS.length - 1].id;
    state.filter = "down";
    state.cat = ALL_CAT;
    state.keyword = ""; $("#search").value = "";
    state.sortKey = "chg"; state.sortDir = 1;
    $$("#chips .chip:not(.sort)").forEach((c) => c.classList.toggle("active", c.dataset.f === "down"));
    $$("#stats .stat").forEach((s) => s.classList.toggle("active", s.dataset.f === "down"));
    syncSelects(); syncSortChips(); refreshAll();
    $("#main").scrollTop = 0;
  });

  /* ---------------- 字体切换 ---------------- */
  function applyFont(mode) {
    document.documentElement.classList.toggle("font-sys", mode === "sys");
    $("#btnFont").classList.toggle("on", mode === "hand");
    $("#btnFont").textContent = mode === "hand" ? "楷" : "黑";
  }
  $("#btnFont").addEventListener("click", () => {
    const next = document.documentElement.classList.contains("font-sys") ? "hand" : "sys";
    applyFont(next);
    try { localStorage.setItem(FONT_KEY, next); } catch (e) {}
    // 字体切换后重新测量滚动区，防止残留的滚动基准导致误判
    setTimeout(() => {
      const h = $(".app-header");
      if (h && h.classList.contains("collapsed")) { h.classList.remove("collapsed"); }
    }, 0);
  });

  /* ---------------- 重新拉取 ---------------- */
  $("#btnReload").addEventListener("click", async () => {
    const btn = $("#btnReload");
    btn.style.opacity = ".4"; btn.disabled = true;
    try {
      await loadData();
      if (!snapById(state.from)) state.from = SNAPSHOTS[0].id;
      if (!snapById(state.to))   state.to = SNAPSHOTS[SNAPSHOTS.length - 1].id;
      if (state.cat !== ALL_CAT && !CATS[state.cat]) state.cat = ALL_CAT;
      syncSelects(); refreshAll();
    } catch (err) { alert("拉取失败：" + err.message); }
    btn.style.opacity = ""; btn.disabled = false;
  });

  /* ---------------- 刷新 ---------------- */
  function refreshAll() { renderCap(); renderStats(); renderNav(); renderList(); }

  /* =========================================================
     导入新记录（懒人更新通道）
     粘贴文本 → 解析 → 预览 → 生成 items.json / prices.json
     ========================================================= */
  const impModal = $("#impModal");
  const impState = { snapshot: null, newItems: [], itemsJSON: "", pricesJSON: "", hasNew: false };

  const NEW_CATS = {
    supply_med: "恢复品", supply_drug: "药剂", supply_repair: "维修", supply_special: "特殊",
    key_night: "暗夜迷城", key_dragon: "龙之遗迹",
  };

  function impShow(step) {
    $$("#impModal .imp-step").forEach((el) => {
      el.hidden = el.dataset.step !== String(step);
    });
  }
  function openImport() {
    impModal.classList.add("show"); overlay.classList.add("show");
    impShow(1);
    if (!$("#impTime").value) $("#impTime").value = nowStamp();
  }
  $("#btnImport").addEventListener("click", openImport);
  $("#btnCloseImp").addEventListener("click", closeAll);
  impModal.addEventListener("click", (e) => { if (e.target === impModal) closeAll(); });

  function nowStamp() {
    const d = new Date(), p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  /* 按小时自动起标签，省得每次手填 */
  function autoTag(t) {
    const h = parseInt(String(t).slice(11, 13), 10);
    if (isNaN(h)) return "";
    if (h < 6) return "凌晨";
    if (h < 9) return "早间";
    if (h < 12) return "上午";
    if (h < 14) return "午间";
    if (h < 18) return "下午";
    if (h < 22) return "晚间";
    return "夜间";
  }

  /* ---- Step1 → Step2：解析 ---- */
  $("#impParse").addEventListener("click", () => {
    const text = $("#impText").value;
    if (!text.trim()) { alert("请先粘贴记录文本"); return; }

    const parsed = RecordParser.parse(text);
    if (!parsed.rows.length) { alert("没解析到任何数据，检查一下文本格式"); return; }

    // 时间以文末备注为准（你写"以上 X 月 X 号 X 点 X 记录完毕"就会被识别）
    let time = $("#impTime").value.trim();
    const tailTime = RecordParser.parseTailTime(parsed.tail);
    if (tailTime) { time = tailTime; $("#impTime").value = tailTime; }

    // 文本里出现的新分类（如"新武器专区"）→ 同步登记
    const discoveredCats = parsed.newCats || {};
    Object.entries(discoveredCats).forEach(([id, label]) => {
      if (!CATS[id]) CATS[id] = label;
    });

    // 匹配 / 新增
    const newItems = [];
    const snapshot = {};
    let matched = 0;
    parsed.rows.forEach((row) => {
      let it = RecordParser.findItem(ITEMS, row);
      if (!it) {
        it = { cat: row.cat, n: row.name, lv: row.lv };
        newItems.push(it);
      } else matched++;
      snapshot[`${it.cat}|${it.n}|${it.lv}`] = row.price;
    });

    // 若文本里写了时间且与输入不同，以文本为准提示
    impState.snapshot = snapshot;
    impState.newItems = newItems;
    impState.newCats = discoveredCats;
    impState.time = time;
    impState.tailTime = tailTime;
    impState.unknown = parsed.unknown;

    // 预览
    const catName = (c) => CATS[c] || NEW_CATS[c] || c;
    $("#impPreview").innerHTML = `
      <div class="pv-grid">
        <div class="pv-cell"><div class="k">识别总数</div><div class="v">${parsed.rows.length}</div></div>
        <div class="pv-cell"><div class="k">匹配已有</div><div class="v v-ok">${matched}</div></div>
        <div class="pv-cell"><div class="k">新增物资</div><div class="v ${newItems.length ? "v-new" : ""}">${newItems.length}</div></div>
      </div>
      <div class="pv-cell" style="margin-bottom:11px">
        <div class="k">记录时间</div>
        <div class="v" style="font-size:14px;font-variant-numeric:tabular-nums">${time || "（未填）"}</div>
      </div>
      ${parsed.unknown.length ? `
        <div class="pv-sec"><h4>未能识别 ${parsed.unknown.length} 行</h4>
          <div class="pv-list">${parsed.unknown.map((u) =>
            `<div class="pv-item"><span class="n">${u}</span></div>`).join("")}</div></div>` : ""}
      ${newItems.length ? `
        <div class="pv-sec"><h4>将新增 ${newItems.length} 项物资</h4>
          <div class="pv-list">${newItems.map((i) =>
            `<div class="pv-item">
               <span class="lvtag ${lvCls(i.lv)}" style="flex-shrink:0">${lvText(i.lv)}</span>
               <span class="n">${i.n}</span>
               <span class="c">${catName(i.cat)}</span>
             </div>`).join("")}</div></div>` : ""}
      ${tailTime ? `
        <div class="imp-hint" style="margin-top:8px">时间已从文末备注自动识别为「${tailTime}」，可返回修改</div>` : ""}
    `;
    impShow(2);
  });

  $("#impBack").addEventListener("click", () => impShow(1));

  /* ---- Step2 → Step3：生成 JSON ---- */
  $("#impGen").addEventListener("click", () => {
    const time = impState.time || nowStamp();
    const sid = "s" + (SNAPSHOTS.length + 1);
    const short = time.slice(5);

    // 1) items.json（仅在有新物资时需要更新）
    const itemsOut = JSON.parse(JSON.stringify({ cats: CATS, groups: GROUPS, items: ITEMS }));
    impState.newItems.forEach((i) => {
      itemsOut.items.push(i);
      if (!itemsOut.cats[i.cat]) itemsOut.cats[i.cat] = NEW_CATS[i.cat] || i.cat;
    });
    // 组别挂载
    const grpMap = { supply: ["supply_med", "supply_drug", "supply_repair", "supply_special"], key: ["key_night", "key_dragon"] };
    Object.entries(grpMap).forEach(([gid, cats]) => {
      if (cats.some((c) => itemsOut.cats[c]) && !itemsOut.groups.find((g) => g.id === gid))
        itemsOut.groups.push({ id: gid, label: gid === "supply" ? "补给品" : "钥匙", cats });
    });
    // 文本里新发现的分类（如"新武器"）挂到「其他」组
    const extraCatIds = Object.keys(impState.newCats || {});
    if (extraCatIds.length) {
      const g = itemsOut.groups.find((x) => x.id === "other");
      if (g) extraCatIds.forEach((c) => { if (!g.cats.includes(c)) g.cats.push(c); });
      else itemsOut.groups.push({ id: "other", label: "其他", cats: extraCatIds });
    }
    delete itemsOut._comment;
    itemsOut._comment = "物资清单。lv: 7/6/5/4 级，0=普通。新增物资在此加，并可加 alias 数组兼容不同写法。";

    // 2) prices.json
    const pricesOut = {
      _comment: "每次记录：往 snapshots 加一条，并在 prices 里加同名 key 的价格表。页面自动识别。",
      version: SNAPSHOTS.length + 1,
      updated: time,
      snapshots: SNAPSHOTS.concat([{
        id: sid, time, short, tag: autoTag(time),
        capital: (snapById(SNAPSHOTS[SNAPSHOTS.length - 1].id) || {}).capital || 0,
      }]),
      prices: Object.assign({}, PRICES, { [sid]: impState.snapshot }),
    };

    impState.hasNew = impState.newItems.length > 0;
    impState.itemsJSON = JSON.stringify(itemsOut, null, 2);
    impState.pricesJSON = JSON.stringify(pricesOut, null, 2);
    impState.sid = sid;

    // tab
    $("#impTabs").innerHTML = (impState.hasNew
      ? `<button class="imp-tab active" data-f="items">① items.json</button>
         <button class="imp-tab" data-f="prices">② prices.json</button>`
      : `<button class="imp-tab active" data-f="prices">prices.json</button>`);

    $("#impWarn").hidden = !impState.hasNew;
    if (impState.hasNew) {
      $("#impWarn").innerHTML = `检测到 <b>${impState.newItems.length}</b> 项新物资，需要更新两个文件：<br>
        先替换 <code>items.json</code>，再替换 <code>prices.json</code>，顺序不能反。`;
    }

    $("#impOut").value = impState.hasNew ? impState.itemsJSON : impState.pricesJSON;
    impShow(3);
  });

  $("#impBack2").addEventListener("click", () => impShow(2));

  $("#impTabs").addEventListener("click", (e) => {
    const t = e.target.closest(".imp-tab"); if (!t) return;
    $$("#impTabs .imp-tab").forEach((x) => x.classList.toggle("active", x === t));
    $("#impOut").value = t.dataset.f === "items" ? impState.itemsJSON : impState.pricesJSON;
    $("#impOut").scrollTop = 0;
  });

  $("#impCopy").addEventListener("click", async () => {
    const ta = $("#impOut");
    try {
      await navigator.clipboard.writeText(ta.value);
    } catch (e) {
      ta.removeAttribute("readonly"); ta.select();
      document.execCommand("copy");
      ta.setAttribute("readonly", "");
    }
    const btn = $("#impCopy");
    const old = btn.textContent;
    btn.textContent = "已复制 ✓";
    setTimeout(() => { btn.textContent = old; }, 1400);
  });

  $("#impDown").addEventListener("click", () => {
    const active = ($("#impTabs .imp-tab.active") || {}).dataset;
    const isItems = impState.hasNew && active && active.f === "items";
    const name = isItems ? "items.json" : "prices.json";
    const blob = new Blob([isItems ? impState.itemsJSON : impState.pricesJSON],
      { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* ---------------- 启动 ---------------- */
  async function boot() {
    // 字体偏好
    let fmode = "hand";
    try { fmode = localStorage.getItem(FONT_KEY) || "hand"; } catch (e) {}
    applyFont(fmode);

    try {
      await loadData();
    } catch (err) {
      const isFile = location.protocol === "file:";
      $("#boot").classList.add("err");
      $("#bootMsg").innerHTML = isFile
        ? `检测到以 <code>file://</code> 打开，浏览器会拦截数据读取。<br>
           请在本目录执行 <code>python3 -m http.server</code>，<br>再访问 <code>http://localhost:8000</code>`
        : `数据载入失败：${err.message}<br>请确认 <code>data/items.json</code> 与 <code>data/prices.json</code> 存在`;
      return;
    }

    // 默认对比「最近两次」——日常就是看最新一轮的变化
    state.from = SNAPSHOTS[Math.max(0, SNAPSHOTS.length - 2)].id;
    state.to   = SNAPSHOTS[SNAPSHOTS.length - 1].id;
    state.cat  = (GROUPS[0] && GROUPS[0].cats[0]) || ALL_CAT;

    syncSelects();
    syncSortChips();
    refreshAll();
    $("#boot").classList.add("hide");

    // 数据完整度自检（摘要输出到控制台，缺项过多时说明该快照早于这些物资入册）
    SNAPSHOTS.forEach((s) => {
      const pr = PRICES[s.id] || {};
      const miss = ITEMS.filter((i) => pr[keyOf(i)] === undefined);
      if (miss.length) {
        const byCat = {};
        miss.forEach((i) => { byCat[i.cat] = (byCat[i.cat] || 0) + 1; });
        const brief = Object.entries(byCat).map(([c, n]) => `${CATS[c] || c}×${n}`).join("、");
        console.info(`[数据] ${s.id} ${s.short} 缺 ${miss.length} 项 → ${brief}`);
      }
    });

    // 下滑收起头部
    // 防抽搐三件套：
    //  1) 切换后立即同步基准 scrollTop，吸收"视口变高→maxScroll 变小→浏览器回调 scrollTop"造成的假反向
    //  2) 切换后 400ms 冷却期内不响应方向变化
    //  3) 距底部 / 顶部过近时不切换，避开边界钳制区
    const header = $(".app-header");
    let lastTop = 0, ticking = false, lockUntil = 0, collapsed = false;

    function setCollapsed(on) {
      if (on === collapsed) return;
      collapsed = on;
      header.classList.toggle("collapsed", on);
      lastTop = main.scrollTop;          // 关键：立即重置基准
      lockUntil = Date.now() + 400;      // 冷却
    }

    main.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const top = main.scrollTop;
        const maxTop = main.scrollHeight - main.clientHeight;
        const now = Date.now();

        if (now >= lockUntil && Math.abs(top - lastTop) > 10) {
          const nearBottom = maxTop - top < 24;   // 距底部太近就不动，避开浏览器钳制区
          if (!nearBottom) {
            if (top > lastTop) {
              if (top > 60) setCollapsed(true);   // 下滑：离开顶部一段距离才收起
            } else {
              setCollapsed(false);                // 上滑：立即展开
            }
          }
        }
        lastTop = top;
        ticking = false;
      });
    }, { passive: true });

    // 字体切换会改变文字度量，重置折叠状态与滚动基准
    const resetScroll = () => { collapsed = header.classList.contains("collapsed"); lastTop = main.scrollTop; };
    window.addEventListener("resize", resetScroll);

    // 老版 iOS Safari 不支持 overscroll-behavior 时的兜底：
    // 仅在内部滚动区已到顶部、且继续下拉时拦截，避免触发页面级下拉刷新
    const obSupported = window.CSS && CSS.supports && CSS.supports("overscroll-behavior-y", "contain");
    if (!obSupported) {
      let startY = 0;
      main.addEventListener("touchstart", (e) => { startY = e.touches[0].clientY; }, { passive: true });
      main.addEventListener("touchmove", (e) => {
        const dy = e.touches[0].clientY - startY;
        if (dy > 0 && main.scrollTop <= 0 && e.cancelable) e.preventDefault();
      }, { passive: false });
    }

    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });
  }

  boot();
})();
