/* =============================================================
   app.js  ——  涨跌看板逻辑
   ============================================================= */
(function () {
  "use strict";

  /* ---------------- 工具 ---------------- */
  const $  = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const keyOf   = (it) => `${it.cat}|${it.n}|${it.lv}`;
  const lvCls   = (lv) => "lv" + (lv === 7 || lv === 6 || lv === 5 ? lv : 0);
  const lvText  = (lv) => (lv === 7 || lv === 6 || lv === 5 ? lv + "级" : "低级");
  const LVRANK  = { 7: 4, 6: 3, 5: 2, 0: 1 };
  const fmt     = (n) => (n == null ? "—" : n.toLocaleString("en-US"));

  function parseTime(str) {
    return new Date(str.replace(/-/g, "/").replace("T", " "));
  }
  function spanText(a, b) {
    const ms = Math.abs(parseTime(b) - parseTime(a));
    if (!ms) return "同一时点";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `间隔 ${h} 小时 ${m} 分` : `间隔 ${m} 分钟`;
  }
  function agoText(str) {
    const ms = Date.now() - parseTime(str);
    if (ms < 0) return "未来记录";
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return `${d} 天前`;
    if (h > 0) return `${h} 小时前`;
    return `${m} 分钟前`;
  }

  const FAV_KEY = "mjBoardFavs";
  let favs = {};
  try { favs = JSON.parse(localStorage.getItem(FAV_KEY) || "{}"); } catch (e) { favs = {}; }
  const saveFav = () => localStorage.setItem(FAV_KEY, JSON.stringify(favs));

  /* ---------------- 状态 ---------------- */
  const state = {
    from: SNAPSHOTS[0].id,
    to:   SNAPSHOTS[SNAPSHOTS.length - 1].id,
    cat:  GROUPS[0].cats[0],
    sortKey: null,
    sortDir: 1,
    keyword: "",
    filter: "all",
  };

  /* ---------------- 核心：计算一行 ---------------- */
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

  /* ---------------- 快照选择器 ---------------- */
  const selFrom = $("#selFrom");
  const selTo   = $("#selTo");
  const optHTML = (sel) =>
    SNAPSHOTS.map(
      (s) => `<option value="${s.id}" ${s.id === sel ? "selected" : ""}>${s.short} · ${s.tag}</option>`
    ).join("");

  function syncSelects() {
    selFrom.innerHTML = optHTML(state.from);
    selTo.innerHTML   = optHTML(state.to);
  }
  selFrom.addEventListener("change", (e) => { state.from = e.target.value; refreshAll(); });
  selTo.addEventListener("change",   (e) => { state.to   = e.target.value; refreshAll(); });

  const snapById = (id) => SNAPSHOTS.find((s) => s.id === id);

  /* ---------------- 顶部信息 ---------------- */
  function renderHead() {
    const cur = snapById(state.to);
    const base = snapById(state.from);
    $("#capValue").textContent = fmt(cur.capital);
    $("#capTime").textContent  = cur.short;
    $("#capAgo").textContent   = agoText(cur.time);
    $("#cmpSpan").textContent  = spanText(base.time, cur.time);
    $("#footMid").textContent  = `${base.short} → ${cur.short} · ${spanText(base.time, cur.time)}`;
  }

  /* ---------------- 统计卡 ---------------- */
  function renderStats() {
    const rows = allRows();
    const ups   = rows.filter((r) => r.dir === "up");
    const downs = rows.filter((r) => r.dir === "down");
    const flats = rows.filter((r) => r.dir === "flat");

    const maxUp   = ups.slice().sort((a, b) => b.pct - a.pct)[0];
    const maxDown = downs.slice().sort((a, b) => a.pct - b.pct)[0];
    const valid   = rows.filter((r) => r.pct != null);
    const avg     = valid.length ? valid.reduce((s, r) => s + r.pct, 0) / valid.length : 0;

    const cards = [
      { f: "up",   label: "上涨", val: ups.length,   unit: "项", cls: "s-up",
        foot: maxUp ? `最大 +${maxUp.pct.toFixed(1)}% · ${maxUp.n}` : "无" },
      { f: "down", label: "下跌", val: downs.length, unit: "项", cls: "s-down",
        foot: maxDown ? `最大 ${maxDown.pct.toFixed(1)}% · ${maxDown.n}` : "无" },
      { f: "flat", label: "持平", val: flats.length, unit: "项", cls: "s-flat",
        foot: `${rows.length} 项中有 ${valid.length ? ((flats.length / rows.length) * 100).toFixed(0) : 0}% 未动` },
      { f: "all",  label: "均价波动", val: (avg >= 0 ? "+" : "") + avg.toFixed(2), unit: "%", cls: avg >= 0 ? "s-up" : "s-down",
        foot: `${rows.length} 项全量算术平均` },
    ];

    $("#stats").innerHTML = cards
      .map(
        (c) => `<div class="stat clickable" data-f="${c.f}">
          <div class="s-label">${c.label}</div>
          <div class="s-value ${c.cls}">${c.val}<span style="font-size:11px;font-weight:600;opacity:.6"> ${c.unit}</span></div>
          <div class="s-foot">${c.foot}</div>
        </div>`
      )
      .join("");
  }

  /* ---------------- 导航 ---------------- */
  const nav = $("#nav");
  function renderNav() {
    const rows = allRows();
    const movedByCat = {};
    rows.forEach((r) => {
      if (r.dir !== "flat") movedByCat[r.cat] = (movedByCat[r.cat] || 0) + 1;
    });

    nav.innerHTML = GROUPS.map((g) => {
      const btns = g.cats
        .map((c) => {
          const moved = movedByCat[c] || 0;
          const badge = moved ? `<span class="nav-badge">${moved}</span>` : "";
          return `<button data-cat="${c}" class="${c === state.cat ? "active" : ""}">${CATS[c]}${badge}</button>`;
        })
        .join("");
      return `<div class="nav-group">${g.label}</div>${btns}`;
    }).join("");
  }
  nav.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-cat]");
    if (!btn) return;
    state.cat = btn.dataset.cat;
    renderNav();
    renderList();
    $("#main").scrollTop = 0;
  });

  /* ---------------- 表头排序 ---------------- */
  $$("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      th.classList.remove("flash"); void th.offsetWidth; th.classList.add("flash");
      const k = th.dataset.sort;
      if (state.sortKey === k) state.sortDir = -state.sortDir;
      else { state.sortKey = k; state.sortDir = 1; }
      $$("th.sortable").forEach((o) => {
        o.classList.remove("sorted");
        const a = o.querySelector(".arrow"); if (a) a.textContent = "↑";
      });
      th.classList.add("sorted");
      const arrow = th.querySelector(".arrow");
      if (arrow) arrow.textContent = state.sortDir > 0 ? "↑" : "↓";
      renderList();
    });
  });

  /* ---------------- 搜索 / 筛选 ---------------- */
  $("#search").addEventListener("input", (e) => {
    state.keyword = e.target.value.trim().toLowerCase();
    renderList();
  });

  $("#chips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    state.filter = b.dataset.f;
    $$("#chips .chip").forEach((c) => c.classList.toggle("active", c === b));
    renderList();
  });
  $("#stats").addEventListener("click", (e) => {
    const s = e.target.closest(".stat"); if (!s) return;
    state.filter = s.dataset.f;
    $$("#chips .chip").forEach((c) => c.classList.toggle("active", c.dataset.f === s.dataset.f));
    renderList();
    $("#main").scrollTop = 0;
  });

  /* ---------------- 列表 ---------------- */
  const tbody = $("#tbody");

  function chgHTML(r) {
    if (r.diff == null || r.pct == null)
      return `<span class="chg flat">—</span>`;
    if (r.dir === "flat")
      return `<span class="chg flat">0.0%</span><span class="chg-abs" style="color:#3E3E3E">持平</span>`;
    const sign = r.pct > 0 ? "+" : "";
    const dsign = r.diff > 0 ? "+" : "";
    // 极微小变动（如 56831 → 56830）：显示实际金额，避免 "-0.0%" 造成误读
    if (Math.abs(r.pct) < 0.05)
      return `<span class="chg ${r.dir}">${dsign}${fmt(r.diff)}</span>
              <span class="chg-abs" style="color:#5F5F5F">≈0%</span>`;
    return `<span class="chg ${r.dir}">${sign}${r.pct.toFixed(1)}%</span>
            <span class="chg-abs" style="color:var(--${r.dir === "up" ? "up" : "down"})">${dsign}${fmt(r.diff)}</span>`;
  }

  function renderList() {
    let list = allRows();

    // 搜索：跨全部分类
    if (state.keyword) {
      list = list.filter((r) => r.n.toLowerCase().includes(state.keyword));
    } else {
      list = list.filter((r) => r.cat === state.cat);
    }

    // 涨跌筛选
    if (state.filter === "up")   list = list.filter((r) => r.dir === "up");
    if (state.filter === "down") list = list.filter((r) => r.dir === "down");
    if (state.filter === "flat") list = list.filter((r) => r.dir === "flat");
    if (state.filter === "fav")  list = list.filter((r) => favs[r.key]);

    // 排序
    if (state.sortKey) {
      list.sort((a, b) => {
        let d = 0;
        if (state.sortKey === "price")  d = (a.to ?? 0) - (b.to ?? 0);
        if (state.sortKey === "chg")    d = (a.pct ?? 0) - (b.pct ?? 0);
        if (state.sortKey === "level")  d = (LVRANK[a.lv] || 0) - (LVRANK[b.lv] || 0);
        if (state.sortKey === "name")   d = a.n.localeCompare(b.n, "zh");
        return d * state.sortDir;
      });
    }

    $("#favCount").textContent = Object.keys(favs).length;

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="5">
        <div class="empty">
          <svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.15">
            <path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/>
          </svg>
          <p>暂无物资</p>
          <small>${
            state.keyword ? "换个关键词试试"
            : state.filter === "fav" ? "还没有收藏任何物资"
            : state.filter !== "all" ? "当前区间没有符合的物资"
            : "该分类还没有记录数据"
          }</small>
        </div></td></tr>`;
      $("#countBar").innerHTML = `0 项`;
      return;
    }

    tbody.innerHTML = list
      .map((r) => {
        const cls = lvCls(r.lv);
        const on  = !!favs[r.key];
        const nmCls = r.lv === 7 ? " lv7" : "";
        const faded = r.dir === "flat" ? " faded" : "";
        return `<tr data-key="${r.key}" data-cat="${r.cat}">
          <td class="q-col"><i class="dot ${cls}"></i></td>
          <td>
            <div class="name-cell">
              <span class="nm${nmCls}">${r.n}</span>
              <span class="lvtag ${cls}">${lvText(r.lv)}</span>
            </div>
          </td>
          <td class="price-cell"><span class="price${faded}">${fmt(r.to)}</span></td>
          <td class="chg-cell">${chgHTML(r)}</td>
          <td class="star"><span class="${on ? "on" : ""}">${on ? "★" : "☆"}</span></td>
        </tr>`;
      })
      .join("");

    const scope = state.keyword ? "搜索结果" : CATS[state.cat];
    $("#countBar").innerHTML = `<b>${list.length}</b> 项 · ${scope}`;
  }

  /* ---------------- 行交互：收藏 / 详情 / 涟漪 ---------------- */
  const main = $("#main");
  main.addEventListener("click", (e) => {
    const star = e.target.closest(".star span");
    if (star) {
      const tr = star.closest("tr");
      const k = tr.dataset.key;
      if (favs[k]) delete favs[k]; else favs[k] = 1;
      saveFav(); renderList();
      return;
    }
    const tr = e.target.closest("tr[data-key]");
    if (tr) { openModal(tr.dataset.key); return; }
    if (e.target.closest("thead")) return;

    // 涟漪
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

  /* ---------------- 抽屉：历史记录 ---------------- */
  const drawer  = $("#drawer");
  const overlay = $("#overlay");

  function openDrawer()  { drawer.classList.add("show");    overlay.classList.add("show"); renderTimeline(); }
  function closeDrawer() { drawer.classList.remove("show"); overlay.classList.remove("show"); }

  $("#btnHistory").addEventListener("click", openDrawer);
  $("#btnCloseDrawer").addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);

  function renderTimeline() {
    $("#timeline").innerHTML = SNAPSHOTS.map((s, i) => {
      const cnt = Object.keys(PRICES[s.id] || {}).length;
      const isBase = s.id === state.from;
      const isCur  = s.id === state.to;
      const prev = i > 0 ? SNAPSHOTS[i - 1] : null;
      return `<div class="tl-item ${isBase ? "is-base" : ""} ${isCur ? "is-cur" : ""}">
        <div class="tl-time">${s.short}
          ${isBase ? '<span class="tl-badge base">基准</span>' : ""}
          ${isCur  ? '<span class="tl-badge cur">当前</span>' : ""}
        </div>
        <div class="tl-meta">
          ${s.tag} · 记录 ${cnt} 项 · 本金 ${fmt(s.capital)}
          ${prev ? `<br>较上一次 ${spanText(prev.time, s.time)}` : "<br>首次基线记录"}
        </div>
        <div class="tl-acts">
          <button class="tl-btn" data-set="from" data-id="${s.id}" ${isBase ? "disabled" : ""}>设为基准</button>
          <button class="tl-btn" data-set="to"   data-id="${s.id}" ${isCur  ? "disabled" : ""}>设为当前</button>
        </div>
      </div>`;
    }).join("");
  }

  $("#timeline").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-set]");
    if (!b) return;
    if (b.dataset.set === "from") state.from = b.dataset.id;
    else state.to = b.dataset.id;
    syncSelects();
    refreshAll();
    renderTimeline();
  });

  /* ---------------- 弹窗：物品详情 ---------------- */
  const modal = $("#modal");
  $("#btnCloseModal").addEventListener("click", () => modal.classList.remove("show"));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("show"); });

  function sparkSVG(vals, labels) {
    const W = 380, H = 96, PAD = 10;
    if (!vals.length) return "";
    const min = Math.min(...vals), max = Math.max(...vals);
    const range = max - min || 1;
    const step = vals.length > 1 ? (W - PAD * 2) / (vals.length - 1) : 0;
    const pts = vals.map((v, i) => [
      vals.length > 1 ? PAD + i * step : W / 2,
      H - PAD - ((v - min) / range) * (H - PAD * 2),
    ]);

    const rising = vals[vals.length - 1] >= vals[0];
    const stroke = vals.length < 2 || min === max ? "#5A5A5A" : rising ? "#FF4D4F" : "#5FBF80";

    const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
    const area = `${PAD},${H - PAD} ${line} ${(pts[pts.length - 1][0]).toFixed(1)},${H - PAD}`;
    const circles = pts
      .map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === pts.length - 1 ? 4.5 : 3.5}"
        fill="#121212" stroke="${stroke}" stroke-width="2" />`)
      .join("");
    const vlabels = pts
      .map((p, i) => (i === 0 || i === pts.length - 1 || pts.length <= 4)
        ? `<text x="${p[0].toFixed(1)}" y="${(p[1] - 9).toFixed(1)}"
            fill="#EEEEEE" font-size="10" font-weight="700" text-anchor="middle"
            font-family="ui-monospace,Menlo,monospace">${fmt(vals[i])}</text>`
        : "")
      .join("");

    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${stroke}" stop-opacity=".28"/>
          <stop offset="100%" stop-color="${stroke}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="${area}" fill="url(#sg)"/>
      <polyline points="${line}" fill="none" stroke="${stroke}" stroke-width="2.2"
        stroke-linejoin="round" stroke-linecap="round"/>
      ${circles}${vlabels}
    </svg>`;
  }

  function openModal(key) {
    const it = ITEMS.find((x) => keyOf(x) === key);
    if (!it) return;

    const series = SNAPSHOTS.map((s) => (PRICES[s.id] || {})[key] ?? null).filter((v) => v != null);
    const labels = SNAPSHOTS.filter((s) => (PRICES[s.id] || {})[key] != null).map((s) => s.short);

    const r = compute(it);
    const cls = lvCls(it.lv);

    $("#moTitle").innerHTML = `${it.n} <span class="lvtag ${cls}" style="vertical-align:2px">${lvText(it.lv)}</span>`;
    $("#moSub").textContent = `${CATS[it.cat]} · ${SNAPSHOTS.length} 次记录`;

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
        <span class="h-t">${s.short}</span>
        <span class="h-p">${fmt(v)}</span>
        <span class="h-d ${dc}">${d}</span>
      </div>`;
    }).join("");

    $("#moBody").innerHTML = `
      <div class="spark-box">
        ${sparkSVG(series, labels)}
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

      <div class="mo-hist">
        <h4>全部记录</h4>
        ${histRows}
      </div>
    `;

    modal.classList.add("show");
  }

  /* ---------------- 设置按钮：快捷切到最新 ---------------- */
  $("#btnSet").addEventListener("click", () => {
    state.from = SNAPSHOTS[Math.max(0, SNAPSHOTS.length - 2)].id;
    state.to   = SNAPSHOTS[SNAPSHOTS.length - 1].id;
    state.filter = "all";
    state.sortKey = "chg";
    state.sortDir = -1;
    $$("#chips .chip").forEach((c) => c.classList.toggle("active", c.dataset.f === "all"));
    $$("th.sortable").forEach((o) => {
      o.classList.remove("sorted");
      const a = o.querySelector(".arrow"); if (a) a.textContent = "↑";
    });
    const th = document.querySelector('th[data-sort="chg"]');
    if (th) { th.classList.add("sorted"); th.querySelector(".arrow").textContent = "↓"; }
    syncSelects();
    refreshAll();
  });

  /* ---------------- 刷新 ---------------- */
  function refreshAll() {
    renderHead();
    renderStats();
    renderNav();
    renderList();
  }

  /* ---------------- 启动 ---------------- */
  syncSelects();
  refreshAll();

  // ESC 关闭浮层
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    modal.classList.remove("show");
    closeDrawer();
  });
})();
