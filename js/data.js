/* =============================================================
   data.js  ——  数据源（唯一需要手动维护的文件）
   -------------------------------------------------------------
   新增一次记录，只需做两件事：
     1. 在 SNAPSHOTS 末尾加一条快照信息
     2. 在 PRICES 末尾加一个同名 key 的价格对象
   页面会自动识别新的快照、自动算涨跌、自动画历史曲线。
   ============================================================= */

/* ---------- 1. 快照（每次记录 = 一个快照） ---------- */
const SNAPSHOTS = [
  { id: "s1", time: "2026-09-04 15:15", short: "09-04 15:15", tag: "基线", capital: 993500 },
  { id: "s2", time: "2026-09-04 22:49", short: "09-04 22:49", tag: "晚间", capital: 993500 },
];

/* ---------- 2. 分组 / 分类 ---------- */
const GROUPS = [
  { id: "gun",    label: "枪械",     cats: ["rifle", "smg", "sniper", "marksman", "shotgun", "lmg"] },
  { id: "part",   label: "配件",     cats: ["muzzle", "laser", "mag", "stock"] },
  { id: "gear",   label: "装备",     cats: ["gear"] },
  { id: "ammo",   label: "弹药",     cats: ["ammo"] },
  { id: "tac",    label: "战术道具", cats: ["tactical"] },
];

const CATS = {
  rifle:    "突击步枪",
  smg:      "冲锋枪",
  sniper:   "狙击枪",
  marksman: "射手步枪",
  shotgun:  "霰弹枪",
  lmg:      "轻机枪",
  muzzle:   "枪口",
  laser:    "镭射",
  mag:      "弹匣",
  stock:    "枪托",
  gear:     "装备",
  ammo:     "弹药",
  tactical: "战术道具",
};

/* ---------- 3. 物品清单 ----------
   lv 对照游戏设定：7 = 七级 / 6 = 六级（极品）/ 5 = 五级（完美）/ 0 = 低级
   key 规则：`分类|名称|等级`，必须与 PRICES 中的 key 完全一致            */
const ITEMS = [
  /* ===== 枪械 · 突击步枪 ===== */
  { cat:"rifle", n:"ASh 12", lv:6 }, { cat:"rifle", n:"巨浪",   lv:6 },
  { cat:"rifle", n:"Scar",   lv:5 }, { cat:"rifle", n:"巨浪",   lv:5 },
  { cat:"rifle", n:"AN94",   lv:5 }, { cat:"rifle", n:"ASh 12", lv:5 },
  { cat:"rifle", n:"AK47",   lv:5 }, { cat:"rifle", n:"M4",     lv:5 },
  { cat:"rifle", n:"Groza",  lv:5 }, { cat:"rifle", n:"QBZ191", lv:5 },

  /* ===== 枪械 · 冲锋枪 ===== */
  { cat:"smg", n:"P90",    lv:6 },
  { cat:"smg", n:"维克托", lv:5 }, { cat:"smg", n:"MP7", lv:5 }, { cat:"smg", n:"P90", lv:5 },

  /* ===== 枪械 · 狙击枪 ===== */
  { cat:"sniper", n:"磁轨狙", lv:6 }, { cat:"sniper", n:"巴雷特", lv:6 }, { cat:"sniper", n:"AMR", lv:6 },
  { cat:"sniper", n:"M2000",  lv:5 }, { cat:"sniper", n:"AWM",    lv:5 }, { cat:"sniper", n:"M24", lv:5 },

  /* ===== 枪械 · 射手步枪 / 霰弹枪 / 轻机枪 ===== */
  { cat:"marksman", n:"MK14", lv:5 },
  { cat:"shotgun",  n:"气锤", lv:5 },
  { cat:"lmg", n:"PKM", lv:5 }, { cat:"lmg", n:"MG34", lv:5 },

  /* ===== 配件 · 枪口 ===== */
  { cat:"muzzle", n:"合金枪管",       lv:5 }, { cat:"muzzle", n:"重型枪管",   lv:5 },
  { cat:"muzzle", n:"轻型枪管",       lv:5 }, { cat:"muzzle", n:"鸟笼枪口",   lv:5 },
  { cat:"muzzle", n:"枪口补偿器",     lv:5 }, { cat:"muzzle", n:"消焰器",     lv:5 },
  { cat:"muzzle", n:"消声器",         lv:5 }, { cat:"muzzle", n:"泰坦消音器", lv:5 },
  { cat:"muzzle", n:"巨浪特种长枪管", lv:5 },

  /* ===== 配件 · 镭射 ===== */
  { cat:"laser", n:"战术镭射", lv:5 }, { cat:"laser", n:"科技镭射", lv:5 }, { cat:"laser", n:"突击镭射", lv:5 },

  /* ===== 配件 · 弹匣 ===== */
  { cat:"mag", n:"快速扩容弹匣", lv:5 }, { cat:"mag", n:"快速弹匣", lv:5 }, { cat:"mag", n:"扩容弹匣", lv:5 },

  /* ===== 配件 · 枪托 ===== */
  { cat:"stock", n:"特种枪托", lv:5 }, { cat:"stock", n:"轻量化枪托", lv:5 }, { cat:"stock", n:"重型枪托", lv:5 },

  /* ===== 装备 ===== */
  { cat:"gear", n:"头盔", lv:6 }, { cat:"gear", n:"头盔", lv:5 },
  { cat:"gear", n:"护甲", lv:6 }, { cat:"gear", n:"护甲", lv:5 },
  { cat:"gear", n:"背包", lv:6 }, { cat:"gear", n:"背包", lv:5 },

  /* ===== 弹药 ===== */
  { cat:"ammo", n:"5.56x45",  lv:5 }, { cat:"ammo", n:"9x19",    lv:5 },
  { cat:"ammo", n:".45 ACP",  lv:5 }, { cat:"ammo", n:"7.62x51", lv:5 },
  { cat:"ammo", n:"7.62x39",  lv:5 }, { cat:"ammo", n:"7.62x57", lv:5 },
  { cat:"ammo", n:".50",      lv:5 }, { cat:"ammo", n:"5.8x42",  lv:5 },
  { cat:"ammo", n:"9x39",     lv:5 }, { cat:"ammo", n:"5.45x39", lv:5 },
  { cat:"ammo", n:"7.62x54",  lv:5 }, { cat:"ammo", n:".300 Win",lv:5 },
  { cat:"ammo", n:"5.7x28",   lv:5 }, { cat:"ammo", n:"4.6x30",  lv:5 },
  { cat:"ammo", n:"12G",      lv:0 }, { cat:"ammo", n:"16G",     lv:0 },
  { cat:"ammo", n:"流质燃剂", lv:0 },
  { cat:"ammo", n:"磁能狙",   lv:7 },

  /* ===== 战术道具 ===== */
  { cat:"tactical", n:"手雷",   lv:0 }, { cat:"tactical", n:"燃烧弹", lv:0 },
  { cat:"tactical", n:"烟雾弹", lv:0 }, { cat:"tactical", n:"闪光弹", lv:0 },
];

/* ---------- 4. 价格表（每个快照一份） ---------- */
const PRICES = {

  /* ===== 09-04 15:15 基线 ===== */
  s1: {
    "rifle|ASh 12|6":2348720, "rifle|巨浪|6":1989531,
    "rifle|Scar|5":587547, "rifle|巨浪|5":620110, "rifle|AN94|5":595570,
    "rifle|ASh 12|5":924948, "rifle|AK47|5":656010, "rifle|M4|5":630280,
    "rifle|Groza|5":538677, "rifle|QBZ191|5":594690,

    "smg|P90|6":2212260, "smg|维克托|5":544392, "smg|MP7|5":596592, "smg|P90|5":637670,

    "sniper|磁轨狙|6":1969299, "sniper|巴雷特|6":1670238, "sniper|AMR|6":1798880,
    "sniper|M2000|5":586260, "sniper|AWM|5":539964, "sniper|M24|5":591408,

    "marksman|MK14|5":615790, "shotgun|气锤|5":583790,
    "lmg|PKM|5":719148, "lmg|MG34|5":694771,

    "muzzle|合金枪管|5":104570, "muzzle|重型枪管|5":104210, "muzzle|轻型枪管|5":105420,
    "muzzle|鸟笼枪口|5":102500, "muzzle|枪口补偿器|5":103480, "muzzle|消焰器|5":135278,
    "muzzle|消声器|5":102760, "muzzle|泰坦消音器|5":223310, "muzzle|巨浪特种长枪管|5":112610,

    "laser|战术镭射|5":55970, "laser|科技镭射|5":56550, "laser|突击镭射|5":56831,

    "mag|快速扩容弹匣|5":101410, "mag|快速弹匣|5":101860, "mag|扩容弹匣|5":100510,

    "stock|特种枪托|5":84170, "stock|轻量化枪托|5":83630, "stock|重型枪托|5":86660,

    "gear|头盔|6":2188188, "gear|头盔|5":926808,
    "gear|护甲|6":1896828, "gear|护甲|5":403690,
    "gear|背包|6":2031172, "gear|背包|5":424260,

    "ammo|5.56x45|5":1230, "ammo|9x19|5":1130, "ammo|.45 ACP|5":1840,
    "ammo|7.62x51|5":1430, "ammo|7.62x39|5":1340, "ammo|7.62x57|5":1230,
    "ammo|.50|5":4658, "ammo|5.8x42|5":1270, "ammo|9x39|5":1120,
    "ammo|5.45x39|5":1180, "ammo|7.62x54|5":1250, "ammo|.300 Win|5":2484,
    "ammo|5.7x28|5":1650, "ammo|4.6x30|5":1210,
    "ammo|12G|0":1150, "ammo|16G|0":800, "ammo|流质燃剂|0":530,
    "ammo|磁能狙|7":22000,

    "tactical|手雷|0":8960, "tactical|燃烧弹|0":19680,
    "tactical|烟雾弹|0":34705, "tactical|闪光弹|0":42948,
  },

  /* ===== 09-04 22:49 晚间 ===== */
  s2: {
    "rifle|ASh 12|6":2348720, "rifle|巨浪|6":1989531,
    "rifle|Scar|5":587547, "rifle|巨浪|5":620110, "rifle|AN94|5":595570,
    "rifle|ASh 12|5":924948, "rifle|AK47|5":656010, "rifle|M4|5":630280,
    "rifle|Groza|5":538677, "rifle|QBZ191|5":594690,

    "smg|P90|6":2212260, "smg|维克托|5":544392, "smg|MP7|5":596592, "smg|P90|5":637670,

    "sniper|磁轨狙|6":1969299, "sniper|巴雷特|6":1670238, "sniper|AMR|6":1798880,
    "sniper|M2000|5":586260, "sniper|AWM|5":539964, "sniper|M24|5":591408,

    "marksman|MK14|5":615790, "shotgun|气锤|5":583790,
    "lmg|PKM|5":719148, "lmg|MG34|5":694771,

    "muzzle|合金枪管|5":104570, "muzzle|重型枪管|5":104210, "muzzle|轻型枪管|5":105420,
    "muzzle|鸟笼枪口|5":102500, "muzzle|枪口补偿器|5":103480, "muzzle|消焰器|5":135278,
    "muzzle|消声器|5":102760, "muzzle|泰坦消音器|5":223310, "muzzle|巨浪特种长枪管|5":112610,

    "laser|战术镭射|5":55970, "laser|科技镭射|5":56550, "laser|突击镭射|5":56830,

    "mag|快速扩容弹匣|5":101410, "mag|快速弹匣|5":101860, "mag|扩容弹匣|5":100510,

    "stock|特种枪托|5":84170, "stock|轻量化枪托|5":83630, "stock|重型枪托|5":95326,

    "gear|头盔|6":1823490, "gear|头盔|5":849574,
    "gear|护甲|6":1580690, "gear|护甲|5":406690,
    "gear|背包|6":1562440, "gear|背包|5":424260,

    "ammo|5.56x45|5":1230, "ammo|9x19|5":1017, "ammo|.45 ACP|5":1150,
    "ammo|7.62x51|5":1300, "ammo|7.62x39|5":1340, "ammo|7.62x57|5":1230,
    "ammo|.50|5":4658, "ammo|5.8x42|5":1270, "ammo|9x39|5":1120,
    "ammo|5.45x39|5":1180, "ammo|7.62x54|5":1250, "ammo|.300 Win|5":1863,
    "ammo|5.7x28|5":1815, "ammo|4.6x30|5":1210,
    "ammo|12G|0":1265, "ammo|16G|0":800, "ammo|流质燃剂|0":530,
    "ammo|磁能狙|7":22000,

    "tactical|手雷|0":8960, "tactical|燃烧弹|0":19680,
    "tactical|烟雾弹|0":34705, "tactical|闪光弹|0":35790,
  },
};
