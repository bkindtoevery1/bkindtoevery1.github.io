var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// engine/game.mjs
var game_exports = {};
__export(game_exports, {
  activeSeats: () => activeSeats,
  actor: () => actor,
  assertInvariants: () => assertInvariants,
  createGame: () => createGame,
  legalActions: () => legalActions,
  nextActive: () => nextActive,
  observation: () => observation,
  settleDraw: () => settleDraw,
  step: () => step,
  visibleCounts: () => visibleCounts
});

// engine/tiles.mjs
var typeOf = (id) => Math.floor(id / 4);
var isHonor = (t) => t >= 27;
var isTerminal = (t) => t < 27 && (t % 9 === 0 || t % 9 === 8);
var isYao = (t) => isHonor(t) || isTerminal(t);
function counts(types) {
  const c = Array(34).fill(0);
  for (const t of types) {
    if (!Number.isInteger(t) || t < 0 || t > 33) throw new Error("Invalid tile");
    c[t]++;
  }
  return c;
}
var tileName = (t) => t < 27 ? `${t % 9 + 1}${["\uB9CC", "\uD1B5", "\uC0AD"][Math.floor(t / 9)]}` : ["\uB3D9", "\uB0A8", "\uC11C", "\uBD81", "\uBC31", "\uBC1C", "\uC911"][t - 27];
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 1831565813;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffledWall(seed) {
  const a = Array.from({ length: 136 }, (_, i) => i), r = rng(seed);
  for (let i = 135; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// engine/rules.mjs
var LEGACY_RULES = Object.freeze({
  id: "H-2026-literal-v1",
  ronPassAllowed: true,
  passRonLock: "none",
  selfDiscardFuriten: false,
  pinfuClosedOnly: false,
  peikouClosedOnly: false,
  ryanpeikouDistinctSuits: true,
  concealedKanBreaksMenzen: true,
  concealedKanPrivate: false,
  menzenRequiresTsumo: false,
  sevenPairsQuadAsTwo: false,
  greenTiles: [18, 19, 20, 21, 22, 23, 24, 25, 26, 32],
  kanBonus: 100,
  dragonBonus: 100,
  roundWindBonus: 100,
  seatWindBonus: 100,
  tsumoBonusPerPayer: 100,
  drawIncludesBonuses: false,
  drawWaitAvailability: "structural",
  deadWallTiles: 0,
  maxKans: 32,
  kanReplacement: "live-tail",
  addedKanRobAllowed: true,
  multipleRon: "all",
  chiFrom: "next-active",
  allowKuikae: true,
  revealWinnerHand: true,
  revealTsumoWinningTile: false,
  roundWind: 27,
  greenRequiresDragon: false,
  fourOfAKindBonus: false,
  ronContinuation: "discarder"
});
var CLARIFIED_RULES = Object.freeze({
  ...LEGACY_RULES,
  id: "H-2026-clarified-20261011",
  greenRequiresDragon: true,
  fourOfAKindBonus: true,
  ronContinuation: "last-winner"
});
var DEFAULT_RULES = Object.freeze({
  ...CLARIFIED_RULES,
  id: "H-2026-private-kan-v1",
  concealedKanPrivate: true
});
function ruleset(overrides = {}) {
  for (const k of Object.keys(overrides)) if (!(k in DEFAULT_RULES)) throw new Error(`Unknown H ruleset key: ${k}`);
  const defaults = overrides.id === CLARIFIED_RULES.id ? CLARIFIED_RULES : overrides.id && overrides.id !== DEFAULT_RULES.id ? LEGACY_RULES : DEFAULT_RULES;
  const r = { ...defaults, ...overrides, greenTiles: [...overrides.greenTiles ?? defaults.greenTiles] };
  for (const k of Object.keys(DEFAULT_RULES)) {
    if (typeof DEFAULT_RULES[k] === "boolean" && typeof r[k] !== "boolean") throw new Error(`Invalid boolean ${k}`);
    if (typeof DEFAULT_RULES[k] === "number" && (!Number.isSafeInteger(r[k]) || r[k] < 0)) throw new Error(`Invalid number ${k}`);
  }
  if (!["none", "until-draw"].includes(r.passRonLock) || !["all", "nearest"].includes(r.multipleRon) || !["next-active", "next-seat"].includes(r.chiFrom)) throw new Error("Invalid rules enum");
  if (!["structural", "public-possible"].includes(r.drawWaitAvailability)) throw new Error("Invalid draw wait rule");
  if (!["discarder", "last-winner"].includes(r.ronContinuation)) throw new Error("Invalid ron continuation");
  if (r.kanReplacement !== "live-tail" || r.deadWallTiles > 70 || ![27, 28, 29, 30].includes(r.roundWind)) throw new Error("Unsupported wall or wind configuration");
  if (!r.greenTiles.every((t) => Number.isInteger(t) && t >= 0 && t < 34)) throw new Error("Invalid green tile");
  return r;
}

// engine/score.mjs
var YAKU = {
  noYaku: ["\uBB34\uC5ED(\u4EBA\u548C)", 50],
  pinfu: ["\uD551\uD6C4", 100],
  iipeikou: ["\uC774\uD398\uCF54", 100],
  menzen: ["\uBA58\uC820", 100],
  tanyao: ["\uD0D5\uC57C\uC624", 100],
  toitoi: ["\uB610\uC774\uB610\uC774", 200],
  fiveGates: ["\uC624\uBB38(\u4E94\u95E8)", 200],
  sanshokuTriplets: ["\uC0BC\uC0C9\uB3D9\uAC01", 200],
  sanshokuSequences: ["\uC0BC\uC0C9\uB3D9\uC21C", 200],
  chanta: ["\uCC2C\uD0C0", 200],
  honitsu: ["\uD63C\uC77C\uC0C9", 200],
  junchan: ["\uC900\uCC2C\uD0C0", 400],
  ryanpeikou: ["\uB7C9\uD398\uCF54", 400],
  ittsu: ["\uC77C\uAE30\uD1B5\uAD00", 400],
  honroutou: ["\uD63C\uB178\uB450", 400],
  chinitsu: ["\uCCAD\uC77C\uC0C9", 400],
  sevenPairs: ["\uCE60\uB300\uC790", 400],
  jiangdui: ["\uC7A5\uB300(2\xB75\xB78 \uB610\uC774\uB610\uC774)", 800],
  qingdui: ["\uCCAD\uB300(\uCCAD\uC77C\uC0C9 \uB610\uC774\uB610\uC774)", 800],
  threeKans: ["\uC0BC\uAE61\uC790", 800],
  pureSevenPairs: ["\uCCAD\uCE60\uB300\uC790", 800],
  sanankou: ["\uC0BC\uC554\uAC01", 800],
  smallFourWinds: ["\uC18C\uC0AC\uD76C", 800],
  smallThreeDragons: ["\uC18C\uC0BC\uC6D0", 800],
  allTerminals: ["\uCCAD\uB178\uB450", 1e3],
  allHonors: ["\uC790\uC77C\uC0C9", 1e3],
  allGreen: ["\uB179\uC77C\uC0C9(\uC6D0\uBB38 \uD574\uC11D)", 1e3],
  bigFourWinds: ["\uB300\uC0AC\uD76C", 1e3],
  bigThreeDragons: ["\uB300\uC0BC\uC6D0", 1e3]
};
function decompositions(tiles2, melds = [], r = DEFAULT_RULES) {
  const c = counts(tiles2), out = [];
  if (c.some((x) => x > 4) || tiles2.length !== 14 - 3 * melds.length) return out;
  if (!melds.length && (r.sevenPairsQuadAsTwo ? c.every((x) => x % 2 === 0) : c.filter((x) => x === 2).length === 7)) out.push({ kind: "sevenPairs", groups: [], pair: -1 });
  function visit(groups, pair) {
    const i = c.findIndex((x) => x > 0);
    if (i < 0) {
      if (groups.length === 4 - melds.length) out.push({ kind: "standard", pair, groups: groups.map((g) => ({ ...g })) });
      return;
    }
    if (c[i] >= 3) {
      c[i] -= 3;
      groups.push({ type: "pon", tile: i, open: false });
      visit(groups, pair);
      groups.pop();
      c[i] += 3;
    }
    if (i < 27 && i % 9 < 7 && c[i + 1] && c[i + 2]) {
      c[i]--;
      c[i + 1]--;
      c[i + 2]--;
      groups.push({ type: "chi", tile: i, open: false });
      visit(groups, pair);
      groups.pop();
      c[i]++;
      c[i + 1]++;
      c[i + 2]++;
    }
  }
  for (let p = 0; p < 34; p++) if (c[p] >= 2) {
    c[p] -= 2;
    visit([], p);
    c[p] += 2;
  }
  return out;
}
function scoreHand(tiles2, melds = [], context2 = {}, r = DEFAULT_RULES) {
  const all = [...tiles2, ...melds.flatMap((m) => m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : Array(m.type === "kan" ? 4 : 3).fill(m.tile))];
  const physicalCounts = counts(all);
  if (physicalCounts.some((x) => x > 4)) return null;
  const ds = decompositions(tiles2, melds, r);
  if (!ds.length) return null;
  const closed = melds.every((m) => !m.open) && (!r.concealedKanBreaksMenzen || melds.length === 0);
  const suits = new Set(all.filter((t) => t < 27).map((t) => Math.floor(t / 9))), honors = all.some(isHonor);
  let best = null;
  const allEligible = /* @__PURE__ */ new Set();
  for (const d of ds) {
    const gs = [...d.groups, ...melds], seq = gs.filter((g) => g.type === "chi"), tri = gs.filter((g) => g.type !== "chi");
    const ids = [];
    const add = (id, condition) => {
      if (condition) ids.push(id);
    };
    add("noYaku", true);
    add("menzen", closed && (!r.menzenRequiresTsumo || context2.method === "tsumo"));
    add("tanyao", all.every((t) => !isYao(t)));
    add("fiveGates", suits.size === 3 && all.some((t) => t >= 27 && t < 31) && all.some((t) => t >= 31));
    add("honitsu", suits.size === 1 && honors);
    add("chinitsu", suits.size === 1 && !honors);
    add("honroutou", all.every(isYao));
    add("allTerminals", all.every(isTerminal));
    add("allHonors", all.every(isHonor));
    add("allGreen", all.every((t) => r.greenTiles.includes(t)) && (!r.greenRequiresDragon || physicalCounts[32] > 0));
    if (d.kind === "sevenPairs") {
      add("sevenPairs", true);
      add("pureSevenPairs", suits.size === 1 && !honors || suits.size === 0);
    } else {
      add("pinfu", seq.length === 4 && (!r.pinfuClosedOnly || closed));
      const frequencies = /* @__PURE__ */ new Map();
      for (const g of seq) frequencies.set(g.tile, (frequencies.get(g.tile) || 0) + 1);
      const pairs = [...frequencies].flatMap(([t, n]) => Array(Math.floor(n / 2)).fill(t));
      add("iipeikou", pairs.length >= 1 && (!r.peikouClosedOnly || closed));
      add("ryanpeikou", pairs.length >= 2 && (!r.peikouClosedOnly || closed) && (!r.ryanpeikouDistinctSuits || new Set(pairs.map((t) => Math.floor(t / 9))).size >= 2));
      add("toitoi", tri.length === 4);
      add("qingdui", tri.length === 4 && suits.size === 1 && !honors);
      add("jiangdui", tri.length === 4 && all.every((t) => t < 27 && [1, 4, 7].includes(t % 9)));
      add("threeKans", gs.filter((g) => g.type === "kan").length >= 3);
      const tripTiles = tri.map((g) => g.tile);
      add("sanshokuTriplets", Array.from({ length: 9 }, (_, n) => n).some((n) => [n, n + 9, n + 18].every((t) => tripTiles.includes(t))));
      add("sanshokuSequences", Array.from({ length: 7 }, (_, n) => n).some((n) => [n, n + 9, n + 18].every((t) => seq.some((g) => g.tile === t))));
      add("ittsu", [0, 9, 18].some((n) => [n, n + 3, n + 6].every((t) => seq.some((g) => g.tile === t))));
      const outside = gs.every((g) => g.type === "chi" ? g.tile % 9 === 0 || g.tile % 9 === 6 : isYao(g.tile)) && isYao(d.pair);
      add("chanta", outside && seq.length > 0 && honors);
      add("junchan", outside && seq.length > 0 && !honors);
      const winds = tri.filter((g) => g.tile >= 27 && g.tile < 31).length, dragons = tri.filter((g) => g.tile >= 31).length;
      add("smallFourWinds", winds === 3 && d.pair >= 27 && d.pair < 31);
      add("bigFourWinds", winds === 4);
      add("smallThreeDragons", dragons === 2 && d.pair >= 31);
      add("bigThreeDragons", dragons === 3);
      let concealed = tri.filter((g) => !g.open).length;
      if (context2.method === "ron" && context2.winTile !== void 0) {
        const t = context2.winTile, otherPlacement = d.pair === t || d.groups.some((g) => g.type === "chi" && t >= g.tile && t <= g.tile + 2);
        if (!otherPlacement && d.groups.some((g) => g.type === "pon" && g.tile === t)) concealed--;
      }
      add("sanankou", concealed >= 3);
    }
    const trip = gs.filter((g) => g.type !== "chi"), bonuses = {
      // The legacy field name stays stable in saved logs. Under the clarified
      // rules this counts four identical physical tiles, declared kan or not.
      kan: (r.fourOfAKindBonus ? physicalCounts.filter((n) => n === 4).length : melds.filter((m) => m.type === "kan").length) * r.kanBonus,
      dragon: trip.filter((g) => g.tile >= 31).length * r.dragonBonus,
      roundWind: trip.filter((g) => g.tile === r.roundWind).length * r.roundWindBonus,
      seatWind: trip.filter((g) => g.tile === (context2.seatWind ?? 27)).length * r.seatWindBonus
    };
    for (const id of ids) allEligible.add(id);
    ids.sort((a, b) => YAKU[b][1] - YAKU[a][1]);
    const base = YAKU[ids[0]][1], bonus = Object.values(bonuses).reduce((a, b) => a + b, 0), total = base + bonus;
    const name = ids[0] === "allGreen" && r.greenRequiresDragon ? "\uB179\uC77C\uC0C9" : YAKU[ids[0]][0];
    if (!best || total > best.total) best = { yaku: ids[0], name, base, bonus, total, bonuses, eligibleYaku: ids, closed, shape: d };
  }
  best.eligibleYaku = [...allEligible].sort((a, b) => YAKU[b][1] - YAKU[a][1]);
  return best;
}
function winningTiles(tiles2, melds = [], context2 = {}, r = DEFAULT_RULES) {
  const c = counts([...tiles2, ...melds.flatMap((m) => m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : Array(m.type === "kan" ? 4 : 3).fill(m.tile))]);
  const out = [];
  for (let t = 0; t < 34; t++) if (c[t] < 4) {
    const score = scoreHand([...tiles2, t], melds, { ...context2, method: "ron", winTile: t }, r);
    if (score) out.push({ tile: t, score });
  }
  return out;
}

// engine/game.mjs
var actionKey = (a) => JSON.stringify(a);
var meldView = (m) => ({ type: m.type, tile: m.tile, open: m.open, from: m.from });
var privateKan = (s, m, owner, viewer) => s.rules.concealedKanPrivate === true && owner !== viewer && m.type === "kan" && !m.open;
var visibleMeld = (s, m, owner, viewer) => privateKan(s, m, owner, viewer) ? { ...meldView(m), tile: null, hidden: true } : meldView(m);
function activeSeats(s) {
  return s.players.map((p, i) => p.won ? null : i).filter((i) => i !== null);
}
function nextActive(s, seat) {
  for (let i = 1; i <= 4; i++) if (!s.players[(seat + i) % 4].won) return (seat + i) % 4;
  throw new Error("No active player");
}
var event = (s, e) => s.events.push({ n: s.events.length, ...e });
var handTypes = (p) => p.hand.map(typeOf);
var scoreContext = (s, seat, method, t) => ({ method, winTile: t, seatWind: 27 + (seat - s.dealer + 4) % 4 });
function createGame({ seed = 1, rules = {}, dealer = 0, wall = null } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295 || !Number.isInteger(dealer) || dealer < 0 || dealer > 3) throw new Error("Invalid seed/dealer");
  const r = ruleset(rules), w = wall ? [...wall] : shuffledWall(seed);
  if (w.length !== 136 || new Set(w).size !== 136 || w.some((t) => !Number.isInteger(t) || t < 0 || t >= 136)) throw new Error("Invalid wall");
  const s = { version: 1, seed, rules: r, dealer, wall: w, dead: [], players: Array.from({ length: 4 }, () => ({ hand: [], melds: [], river: [], score: 0, won: false, win: null, passLock: false, drawn: null, forbidden: [], stats: { winReceipt: 0, dealInLoss: 0, tsumoPaid: 0, drawLoss: 0, drawGain: 0, ronDeclined: 0, closedKans: 0 } })), phase: "init", turn: dealer, draws: 0, kans: 0, winners: [], events: [], reaction: null, ledger: [], end: null };
  if (r.deadWallTiles) s.dead = s.wall.splice(s.wall.length - r.deadWallTiles);
  for (let n = 0; n < 13; n++) for (let off = 0; off < 4; off++) s.players[(dealer + off) % 4].hand.push(s.wall.shift());
  for (const p of s.players) p.hand.sort((a, b) => a - b);
  draw(s, dealer);
  assertInvariants(s);
  return s;
}
function transfer(s, from, to, amount, kind) {
  if (amount < 0 || !Number.isSafeInteger(amount)) throw new Error("Invalid transfer");
  s.players[from].score -= amount;
  s.players[to].score += amount;
  s.ledger.push({ from, to, amount, kind });
  if (kind === "ron") {
    s.players[from].stats.dealInLoss += amount;
    s.players[to].stats.winReceipt += amount;
  } else if (kind === "tsumo") {
    s.players[from].stats.tsumoPaid += amount;
    s.players[to].stats.winReceipt += amount;
  } else {
    s.players[from].stats.drawLoss += amount;
    s.players[to].stats.drawGain += amount;
  }
}
function draw(s, seat, kan = false) {
  if (!s.wall.length) {
    settleDraw(s);
    return;
  }
  const p = s.players[seat], id = kan ? s.wall.pop() : s.wall.shift();
  p.hand.push(id);
  p.hand.sort((a, b) => a - b);
  p.drawn = id;
  p.passLock = false;
  p.forbidden = [];
  s.turn = seat;
  s.phase = "turn";
  s.reaction = null;
  s.draws++;
  event(s, { type: kan ? "kanDraw" : "draw", seat, id });
}
function win(s, seat, method, source, tile) {
  const p = s.players[seat];
  if (p.won) throw new Error("Already won");
  const ts = handTypes(p);
  if (method === "ron") ts.push(typeOf(tile));
  const score = scoreHand(ts, p.melds, scoreContext(s, seat, method, typeOf(tile)), s.rules);
  if (!score) throw new Error("Illegal win");
  const payers = method === "ron" ? [source] : activeSeats(s).filter((i) => i !== seat);
  for (const from of payers) transfer(s, from, seat, score.total + (method === "tsumo" ? s.rules.tsumoBonusPerPayer : 0), method);
  p.won = true;
  p.win = { method, source, tile, order: s.winners.length + 1, drawNumber: s.draws, score };
  p.drawn = null;
  p.forbidden = [];
  s.winners.push(seat);
  event(s, { type: "win", seat, ...p.win });
}
function finishOrDraw(s, previous) {
  if (s.winners.length >= 3) {
    s.end = "three-winners";
    s.phase = "end";
    s.reaction = null;
    event(s, { type: "end", reason: s.end });
  } else draw(s, nextActive(s, previous));
}
function visibleCounts(s, seat) {
  const out = Array(34).fill(0);
  const add = (id) => out[typeOf(id)]++;
  for (let i = 0; i < 4; i++) {
    const p = s.players[i];
    for (const m of p.melds) if (!privateKan(s, m, i, seat)) for (const id of m.ids) add(id);
    for (const d of p.river) if (!d.claimed) add(d.id);
    if (i === seat || p.won && s.rules.revealWinnerHand) for (const id of p.hand) {
      if (i !== seat && p.win.method === "tsumo" && !s.rules.revealTsumoWinningTile && id === p.win.tile) continue;
      add(id);
    }
  }
  return out;
}
function settleDraw(s) {
  if (s.phase === "end") throw new Error("Already ended");
  if (s.wall.length) throw new Error("Cannot settle before wall exhaustion");
  const active = activeSeats(s), ready = [];
  for (const seat of active) {
    const p = s.players[seat], visible = visibleCounts(s, seat);
    let waits = winningTiles(handTypes(p), p.melds, scoreContext(s, seat, "ron"), s.rules);
    if (s.rules.drawWaitAvailability === "public-possible") waits = waits.filter((w) => visible[w.tile] < 4);
    if (waits.length) ready.push({ seat, amount: Math.max(...waits.map((w) => s.rules.drawIncludesBonuses ? w.score.total : w.score.base)), waits: waits.map((w) => w.tile) });
  }
  for (const from of active.filter((i) => !ready.some((x) => x.seat === i))) for (const to of ready) transfer(s, from, to.seat, to.amount, "draw");
  s.phase = "end";
  s.reaction = null;
  s.end = "exhaustive-draw";
  event(s, { type: "drawSettlement", ready });
  event(s, { type: "end", reason: s.end });
}
function canRon(s, seat) {
  const p = s.players[seat], r = s.reaction, t = typeOf(r.id);
  if (p.won || seat === r.source || p.passLock) return null;
  if (s.rules.selfDiscardFuriten) {
    const waits = winningTiles(handTypes(p), p.melds, scoreContext(s, seat, "ron"), s.rules);
    if (waits.some((w) => p.river.some((d) => typeOf(d.id) === w.tile))) return null;
  }
  return scoreHand([...handTypes(p), t], p.melds, scoreContext(s, seat, "ron", t), s.rules);
}
function actor(s) {
  if (s.phase === "turn") return s.turn;
  if (s.phase === "reaction") return s.reaction.pending[0];
  return null;
}
function legalActions(s, seat = actor(s)) {
  if (seat === null || seat !== actor(s)) return [];
  const p = s.players[seat], c = counts(handTypes(p)), actions = [];
  if (s.phase === "turn") {
    if (p.drawn !== null && scoreHand(handTypes(p), p.melds, scoreContext(s, seat, "tsumo", typeOf(p.drawn)), s.rules)) actions.push({ type: "tsumo" });
    if (p.drawn !== null && s.wall.length && s.kans < s.rules.maxKans) {
      for (let t = 0; t < 34; t++) if (c[t] === 4) actions.push({ type: "ankan", tile: t });
      p.melds.forEach((m, i) => {
        if (m.type === "pon" && c[m.tile]) actions.push({ type: "kakan", meld: i });
      });
    }
    for (let t = 0; t < 34; t++) if (c[t] && !p.forbidden.includes(t)) actions.push({ type: "discard", tile: t });
  } else {
    const r = s.reaction, t = typeOf(r.id), ron = canRon(s, seat);
    if (ron) actions.push({ type: "ron" });
    if (ron && !s.rules.ronPassAllowed) return actions;
    actions.push({ type: "pass" });
    if (r.kind === "discard" && s.wall.length) {
      if (c[t] >= 2) actions.push({ type: "pon", tile: t });
      if (c[t] >= 3 && s.kans < s.rules.maxKans) actions.push({ type: "minkan", tile: t });
      const chiSeat = s.rules.chiFrom === "next-active" ? nextActive(s, r.source) : (r.source + 1) % 4;
      if (seat === chiSeat && t < 27) for (let start2 = Math.max(Math.floor(t / 9) * 9, t - 2); start2 <= Math.min(Math.floor(t / 9) * 9 + 6, t); start2++) {
        const need = [start2, start2 + 1, start2 + 2].filter((x) => x !== t);
        if (need.every((x) => c[x] > 0)) actions.push({ type: "chi", tile: start2 });
      }
    }
  }
  return actions;
}
function removeTypes(p, types) {
  const out = [];
  for (const t of types) {
    const i = p.hand.findIndex((id) => typeOf(id) === t);
    if (i < 0) throw new Error("Missing tile");
    out.push(...p.hand.splice(i, 1));
  }
  return out;
}
function beginReaction(s, source, id, kind, extra = {}) {
  const pending = [];
  for (let n = 1; n < 4; n++) {
    const i = (source + n) % 4;
    if (!s.players[i].won) pending.push(i);
  }
  s.phase = "reaction";
  s.reaction = { source, id, kind, pending, answers: [], ...extra };
}
function completeKan(s, seat) {
  s.kans++;
  event(s, { type: "kan", seat });
  draw(s, seat, true);
}
function resolveReaction(s) {
  const r = s.reaction;
  let rons = r.answers.filter((x) => x.action.type === "ron");
  if (s.rules.multipleRon === "nearest") rons = rons.slice(0, 1);
  if (rons.length) {
    if (r.kind === "kakan") {
      const p2 = s.players[r.source];
      const idx = p2.hand.indexOf(r.id);
      p2.hand.splice(idx, 1);
      p2.river.push({ id: r.id, claimed: false, robbedKan: true });
    }
    for (const { seat: seat2 } of rons) win(s, seat2, "ron", r.source, r.id);
    finishOrDraw(s, s.rules.ronContinuation === "last-winner" ? rons.at(-1).seat : r.source);
    return;
  }
  if (r.kind === "kakan") {
    const p2 = s.players[r.source], m = p2.melds[r.meld];
    m.ids.push(...removeTypes(p2, [m.tile]));
    m.type = "kan";
    completeKan(s, r.source);
    return;
  }
  const calls = r.answers.filter((x) => ["pon", "minkan", "chi"].includes(x.action.type));
  calls.sort((a2, b) => (a2.action.type === "chi") - (b.action.type === "chi"));
  if (!calls.length) {
    finishOrDraw(s, r.source);
    return;
  }
  const { seat, action: a } = calls[0], p = s.players[seat], t = typeOf(r.id);
  const needed = a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x) => x !== t) : Array(a.type === "minkan" ? 3 : 2).fill(t);
  const ids = [...removeTypes(p, needed), r.id];
  s.players[r.source].river.at(-1).claimed = true;
  p.melds.push({ type: a.type === "chi" ? "chi" : a.type === "minkan" ? "kan" : "pon", tile: a.tile, open: true, from: r.source, ids });
  p.drawn = null;
  p.forbidden = s.rules.allowKuikae ? [] : [t];
  s.turn = seat;
  s.phase = "turn";
  s.reaction = null;
  event(s, { type: "call", seat, action: a, from: r.source });
  if (a.type === "minkan") completeKan(s, seat);
}
function step(s, seat, a, { validate = true } = {}) {
  if (!a || !legalActions(s, seat).some((x) => actionKey(x) === actionKey(a))) throw new Error(`Illegal action by ${seat}: ${JSON.stringify(a)}`);
  const p = s.players[seat];
  event(s, { type: "action", seat, action: { ...a } });
  if (s.phase === "reaction") {
    const r = s.reaction;
    if (a.type !== "ron" && canRon(s, seat)) {
      p.stats.ronDeclined++;
      if (s.rules.passRonLock === "until-draw") p.passLock = true;
    }
    r.answers.push({ seat, action: { ...a } });
    r.pending.shift();
    if (!r.pending.length) resolveReaction(s);
  } else if (a.type === "tsumo") {
    win(s, seat, "tsumo", seat, p.drawn);
    finishOrDraw(s, seat);
  } else if (a.type === "discard") {
    const [id] = removeTypes(p, [a.tile]);
    p.river.push({ id, claimed: false });
    p.drawn = null;
    p.forbidden = [];
    beginReaction(s, seat, id, "discard");
  } else if (a.type === "ankan") {
    const ids = removeTypes(p, Array(4).fill(a.tile));
    p.melds.push({ type: "kan", tile: a.tile, open: false, from: seat, ids });
    p.stats.closedKans++;
    completeKan(s, seat);
  } else if (a.type === "kakan") {
    const id = p.hand.find((id2) => typeOf(id2) === p.melds[a.meld].tile);
    if (s.rules.addedKanRobAllowed) beginReaction(s, seat, id, "kakan", { meld: a.meld });
    else {
      const m = p.melds[a.meld];
      m.ids.push(...removeTypes(p, [m.tile]));
      m.type = "kan";
      completeKan(s, seat);
    }
  }
  if (validate) assertInvariants(s);
  return s;
}
function observation(s, seat = actor(s)) {
  if (seat !== actor(s)) throw new Error("Not this player\u2019s decision");
  const p = s.players[seat];
  const players = s.players.map((p2, i) => ({ seat: i, won: p2.won, score: p2.score, handSize: p2.hand.length, melds: p2.melds.map((m) => visibleMeld(s, m, i, seat)), discards: p2.river.map((d) => ({ tile: typeOf(d.id), claimed: d.claimed })), revealed: p2.won && s.rules.revealWinnerHand ? p2.hand.filter((id) => s.rules.revealTsumoWinningTile || p2.win.method !== "tsumo" || id !== p2.win.tile).map(typeOf) : [] }));
  return { seat, dealer: s.dealer, rules: structuredClone(s.rules), hand: handTypes(p), melds: p.melds.map(meldView), players, visible: visibleCounts(s, seat), activeCount: activeSeats(s).length, wallRemaining: s.wall.length, draws: s.draws, phase: s.phase, lastDiscard: s.reaction ? { seat: s.reaction.source, tile: typeOf(s.reaction.id), kind: s.reaction.kind } : null, legalActions: legalActions(s, seat) };
}
function assertInvariants(s) {
  const all = [...s.wall, ...s.dead];
  for (const p of s.players) {
    all.push(...p.hand);
    for (const m of p.melds) all.push(...m.ids);
    for (const d of p.river) if (!d.claimed) all.push(d.id);
  }
  if (all.length !== 136 || new Set(all).size !== 136 || all.some((id) => !Number.isInteger(id) || id < 0 || id > 135)) throw new Error("Tile conservation violated");
  if (s.players.reduce((n, p) => n + p.score, 0) !== 0) throw new Error("Score conservation violated");
  for (let seat = 0; seat < 4; seat++) {
    const p = s.players[seat], eff = p.hand.length + 3 * p.melds.length;
    const turnExtra = s.phase === "turn" && s.turn === seat || s.phase === "reaction" && s.reaction.kind === "kakan" && s.reaction.source === seat;
    const expected = p.won ? p.win.method === "tsumo" ? 14 : 13 : turnExtra ? 14 : 13;
    if (eff !== expected) throw new Error(`Hand size violated seat ${seat}: ${eff} != ${expected}`);
    if (p.won && (s.phase === "turn" && s.turn === seat || s.phase === "reaction" && s.reaction.pending.includes(seat))) throw new Error("Winner acting again");
    for (const m of p.melds) {
      const ts = m.ids.map(typeOf).sort((a, b) => a - b), wanted = m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : Array(m.type === "kan" ? 4 : 3).fill(m.tile);
      if (JSON.stringify(ts) !== JSON.stringify(wanted)) throw new Error("Illegal meld");
    }
    const st = p.stats;
    if (p.score !== st.winReceipt + st.drawGain - st.dealInLoss - st.tsumoPaid - st.drawLoss) throw new Error("Ledger attribution violated");
  }
  if (s.winners.length > 3 || s.winners.length !== s.players.filter((p) => p.won).length) throw new Error("Winner count violated");
  return true;
}

// s-engine/game.mjs
var game_exports2 = {};
__export(game_exports2, {
  actor: () => actor2,
  assertInvariants: () => assertInvariants2,
  createGame: () => createGame2,
  indicators: () => indicators,
  legalActions: () => legalActions2,
  observation: () => observation2,
  revealedUraIndicators: () => revealedUraIndicators,
  settleDraw: () => settleDraw2,
  step: () => step2,
  visibleCounts: () => visibleCounts2
});

// s-engine/rules.mjs
var S_DEFAULTS = Object.freeze({
  id: "S-2026-private-kan-v1",
  variant: "S",
  pinfuHan: 2,
  roundWind: 27,
  startingPoints: 25e3,
  riichiDeposit: 1e3,
  peikouClosedOnly: true,
  pinfuValuePairAllowed: false,
  openSequenceReduction: false,
  standardYakuman: true,
  multipleRon: "nearest",
  sevenPairsQuadAsTwo: false,
  allowKuikae: true,
  selfDiscardFuriten: true,
  ronPassAllowed: true,
  passRonLock: "until-draw",
  maxKans: 4,
  deadWallTiles: 14,
  revealWinnerHand: true,
  revealTsumoWinningTile: true,
  concealedKanPrivate: true
});
function sRules(overrides = {}) {
  for (const key3 of Object.keys(overrides)) if (!(key3 in S_DEFAULTS)) throw new Error(`Unknown S rule: ${key3}`);
  const defaults = overrides.id && overrides.id !== S_DEFAULTS.id ? { ...S_DEFAULTS, concealedKanPrivate: false } : S_DEFAULTS;
  const rules = { ...defaults, ...overrides };
  for (const key3 of Object.keys(S_DEFAULTS)) {
    const value2 = rules[key3], base = S_DEFAULTS[key3];
    if (typeof value2 !== typeof base || typeof base === "number" && (!Number.isSafeInteger(value2) || value2 < 0)) throw new Error(`Invalid S rule: ${key3}`);
  }
  if (rules.variant !== "S" || rules.maxKans !== 4 || rules.deadWallTiles !== 14 || rules.multipleRon !== "nearest" || rules.riichiDeposit !== 1e3 || rules.sevenPairsQuadAsTwo || !rules.selfDiscardFuriten || !rules.ronPassAllowed || rules.passRonLock !== "until-draw" || ![27, 28, 29, 30].includes(rules.roundWind)) throw new Error("Unsupported S rule configuration");
  return rules;
}

// s-engine/score.mjs
var ORPHANS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
function sShapes(tiles2, melds = [], rules = S_DEFAULTS) {
  const out = decompositions(tiles2, melds, { sevenPairsQuadAsTwo: false }), c = counts(tiles2);
  if (rules.standardYakuman && !melds.length && tiles2.length === 14 && ORPHANS.every((t) => c[t] >= 1) && ORPHANS.some((t) => c[t] === 2)) out.push({ kind: "orphans", groups: [], pair: ORPHANS.find((t) => c[t] === 2) });
  return out;
}
function shapeWaits(tiles2, melds = [], rules = S_DEFAULTS) {
  const c = counts([...tiles2, ...melds.flatMap((m) => m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : Array(m.type === "kan" ? 4 : 3).fill(m.tile))]);
  const out = [];
  for (let t = 0; t < 34; t++) if (c[t] < 4 && sShapes([...tiles2, t], melds, rules).length) out.push(t);
  return out;
}
function doraAfter(tile) {
  return tile < 27 ? Math.floor(tile / 9) * 9 + (tile + 1) % 9 : tile < 31 ? 27 + (tile - 26) % 4 : 31 + (tile - 30) % 3;
}
function sPoints(han, dealer = false, yakuman = false) {
  const base = yakuman ? 32e3 : han >= 11 ? 24e3 : han >= 8 ? 16e3 : han >= 6 ? 12e3 : han >= 4 ? 8e3 : han === 3 ? 4e3 : han === 2 ? 2e3 : 1e3;
  return { ron: dealer ? base * 1.5 : base, tsumoDealer: dealer ? base / 2 : base / 2, tsumoOther: dealer ? base / 2 : Math.ceil(base / 400) * 100 };
}
function scoreS(tiles2, melds = [], context2 = {}, rules = S_DEFAULTS) {
  const all = [...tiles2, ...melds.flatMap((m) => m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : Array(m.type === "kan" ? 4 : 3).fill(m.tile))], c = counts(all);
  if (c.some((n) => n > 4)) return null;
  const closed = melds.every((m) => !m.open), suits = new Set(all.filter((t) => t < 27).map((t) => Math.floor(t / 9))), honors = all.some(isHonor);
  let best = null;
  for (const shape of sShapes(tiles2, melds, rules)) {
    const groups = [...shape.groups, ...melds], seq = groups.filter((g) => g.type === "chi"), trip = groups.filter((g) => g.type !== "chi");
    const entries = [], limits = [], add = (id, name, han2, condition) => {
      if (condition) entries.push({ id, name, han: han2 });
    }, limit = (id, name, condition) => {
      if (condition) limits.push({ id, name, han: 0 });
    };
    const tripTiles = trip.map((g) => g.tile), freq = /* @__PURE__ */ new Map();
    for (const g of seq) freq.set(g.tile, (freq.get(g.tile) ?? 0) + 1);
    const identical = [...freq.values()].reduce((n, count) => n + Math.floor(count / 2), 0), pairValue = shape.pair >= 31 || shape.pair === rules.roundWind || shape.pair === (context2.seatWind ?? 27);
    const ryanmen = shape.groups.some((g) => g.type === "chi" && (context2.winTile === g.tile && g.tile % 9 !== 6 || context2.winTile === g.tile + 2 && g.tile % 9 !== 0));
    let concealed = trip.filter((g) => !g.open).length;
    const ronTrip = context2.method === "ron" && shape.pair !== context2.winTile && !shape.groups.some((g) => g.type === "chi" && context2.winTile >= g.tile && context2.winTile <= g.tile + 2);
    if (ronTrip && shape.groups.some((g) => g.type === "pon" && g.tile === context2.winTile)) concealed--;
    add("pinfu", "\uD551\uD6C4", rules.pinfuHan, seq.length === 4 && closed && ryanmen && (rules.pinfuValuePairAllowed || !pairValue));
    add("ryanpeikou", "\uB7C9\uD398\uCF54", 3, identical >= 2 && (!rules.peikouClosedOnly || closed));
    add("iipeikou", "\uC774\uD398\uCF54", 1, identical === 1 && (!rules.peikouClosedOnly || closed));
    add("menzenTsumo", "\uBA58\uC820 \uCBD4\uBAA8", 1, closed && context2.method === "tsumo");
    add("tanyao", "\uD0D5\uC57C\uC624", 1, all.every((t) => !isYao(t)));
    add("rinshan", "\uC601\uC0C1\uAC1C\uD654", 1, context2.rinshan && context2.method === "tsumo");
    add("haitei", "\uD574\uC800\uB85C\uC6D4", 1, context2.lastTile && context2.method === "tsumo" && !context2.rinshan);
    add("houtei", "\uD558\uC800\uB85C\uC5B4", 1, context2.lastTile && context2.method === "ron" && !context2.chankan);
    add("chankan", "\uCC3D\uAE61", 1, context2.chankan && context2.method === "ron");
    add("toitoi", "\uB610\uC774\uB610\uC774", 2, trip.length === 4);
    add("sanshokuTriplets", "\uC0BC\uC0C9\uB3D9\uAC01", 2, Array.from({ length: 9 }, (_, n) => n).some((n) => [n, n + 9, n + 18].every((t) => tripTiles.includes(t))));
    const reduced = rules.openSequenceReduction && !closed ? 1 : 0;
    add("sanshokuSequences", "\uC0BC\uC0C9\uB3D9\uC21C", 2 - reduced, Array.from({ length: 7 }, (_, n) => n).some((n) => [n, n + 9, n + 18].every((t) => seq.some((g) => g.tile === t))));
    add("ittsu", "\uC77C\uAE30\uD1B5\uAD00", 2 - reduced, [0, 9, 18].some((n) => [n, n + 3, n + 6].every((t) => seq.some((g) => g.tile === t))));
    const outside = shape.kind === "standard" && groups.every((g) => g.type === "chi" ? [0, 6].includes(g.tile % 9) : isYao(g.tile)) && isYao(shape.pair);
    add("chanta", "\uCC2C\uD0C0", 2 - reduced, outside && honors && seq.length > 0);
    add("junchan", "\uC900\uCC2C\uD0C0", 3 - reduced, outside && !honors && seq.length > 0);
    add("honroutou", "\uD63C\uB178\uB450", 2, all.every(isYao));
    add("sevenPairs", "\uCE60\uB300\uC790", 2, shape.kind === "sevenPairs");
    add("sanankou", "\uC0BC\uC554\uAC01", 2, concealed >= 3);
    add("smallThreeDragons", "\uC18C\uC0BC\uC6D0", 2, tripTiles.filter((t) => t >= 31).length === 2 && shape.pair >= 31);
    add("threeKans", "\uC0BC\uAE61\uC790", 2, melds.filter((m) => m.type === "kan").length === 3);
    add("honitsu", "\uD63C\uC77C\uC0C9", closed ? 3 : 2, suits.size === 1 && honors);
    add("chinitsu", "\uCCAD\uC77C\uC0C9", closed ? 6 : 5, suits.size === 1 && !honors);
    for (const t of tripTiles) {
      add("dragon" + t, ["\uBC31", "\uBC1C", "\uC911"][t - 31], 1, t >= 31);
      add("roundWind", "\uC7A5\uD48D", 1, t === rules.roundWind);
      add("seatWind", "\uC790\uD48D", 1, t === (context2.seatWind ?? 27));
    }
    limit("bigThreeDragons", "\uB300\uC0BC\uC6D0", tripTiles.filter((t) => t >= 31).length === 3);
    limit("bigFourWinds", "\uB300\uC0AC\uD76C", tripTiles.filter((t) => t >= 27 && t < 31).length === 4);
    if (rules.standardYakuman) {
      limit("orphans", "\uAD6D\uC0AC\uBB34\uC30D", shape.kind === "orphans");
      limit("fourConcealed", "\uC0AC\uC554\uAC01", concealed === 4);
      limit("fourKans", "\uC0AC\uAE61\uC790", melds.filter((m) => m.type === "kan").length === 4);
      limit("smallFourWinds", "\uC18C\uC0AC\uD76C", tripTiles.filter((t) => t >= 27 && t < 31).length === 3 && shape.pair >= 27 && shape.pair < 31);
      limit("allHonors", "\uC790\uC77C\uC0C9", all.every(isHonor));
      limit("allTerminals", "\uCCAD\uB178\uB450", all.every(isTerminal));
      limit("allGreen", "\uB179\uC77C\uC0C9", all.every((t) => [19, 20, 21, 23, 25, 32].includes(t)));
      if (closed && !melds.length && suits.size === 1 && !honors) {
        const offset = [...suits][0] * 9;
        limit("nineGates", "\uAD6C\uB828\uBCF4\uB4F1", c[offset] >= 3 && c[offset + 8] >= 3 && Array.from({ length: 7 }, (_, i) => i + 1).every((n) => c[offset + n] >= 1));
      }
    }
    if (!entries.length && !limits.length) continue;
    const bonuses = [];
    const bonus = (id, name, han2) => {
      if (han2) bonuses.push({ id, name, han: han2 });
    };
    bonus("riichi", "\uB9AC\uCE58", context2.riichi ? 1 : 0);
    bonus("ippatsu", "\uC77C\uBC1C", context2.riichi && context2.ippatsu ? 1 : 0);
    bonus("kan", "\uAE61 \uAC00\uC0B0", melds.filter((m) => m.type === "kan" && !m.open).length + Math.floor(melds.filter((m) => m.type === "kan" && m.open).length / 2));
    bonus("dora", "\uB3C4\uB77C", (context2.doraIndicators ?? []).reduce((n, t) => n + c[doraAfter(t)], 0));
    bonus("ura", "\uC6B0\uB77C\uB3C4\uB77C", context2.riichi ? (context2.uraIndicators ?? []).reduce((n, t) => n + c[doraAfter(t)], 0) : 0);
    const yakuman = limits.length > 0, hanYaku = entries.reduce((n, e) => n + e.han, 0), bonusHan = bonuses.reduce((n, e) => n + e.han, 0), han = yakuman ? 0 : hanYaku + bonusHan;
    const points = sPoints(han, !!context2.dealer, yakuman), yaku = yakuman ? limits : entries;
    const score = { variant: "S", name: yaku.map((e) => e.name).join(" \xB7 "), yaku: yaku[0].id, yakuEntries: yaku, bonuses: yakuman ? [] : bonuses, han, hanYaku: yakuman ? 0 : hanYaku, bonusHan: yakuman ? 0 : bonusHan, yakuman, base: points.ron, bonus: 0, total: points.ron, points, closed, shape };
    if (!best || score.total > best.total || score.total === best.total && score.han > best.han) best = score;
  }
  return best;
}

// s-engine/game.mjs
var handTypes2 = (p) => p.hand.map(typeOf);
var event2 = (s, e) => s.events.push({ n: s.events.length, ...e });
var meldView2 = (m) => ({ type: m.type, tile: m.tile, open: m.open, from: m.from });
var privateKan2 = (s, m, owner, viewer) => s.rules.concealedKanPrivate === true && owner !== viewer && m.type === "kan" && !m.open;
var visibleMeld2 = (s, m, owner, viewer) => privateKan2(s, m, owner, viewer) ? { ...meldView2(m), tile: null, hidden: true } : meldView2(m);
var key = (a) => JSON.stringify(a);
var same = (a, b) => key(a) === key(b);
var actor2 = (s) => s.phase === "turn" ? s.turn : s.phase === "reaction" ? s.reaction.pending[0] : null;
var indicators = (s, ura = false) => Array.from({ length: s.kans + 1 }, (_, n) => typeOf(s.dead[4 + 2 * n + (ura ? 1 : 0)]));
var revealedUraIndicators = (s) => s.end === "win" && s.winners.some((seat) => s.players[seat].riichi) ? indicators(s, true) : [];
function context(s, seat, method, tile) {
  const p = s.players[seat];
  return {
    method,
    winTile: tile,
    seatWind: 27 + (seat - s.dealer + 4) % 4,
    dealer: seat === s.dealer,
    riichi: p.riichi,
    ippatsu: p.ippatsu,
    rinshan: p.drawSource === "kan",
    lastTile: s.wall.length === 0,
    chankan: method === "ron" && s.reaction?.kind === "kakan",
    doraIndicators: indicators(s),
    uraIndicators: indicators(s, true)
  };
}
function createGame2({ seed = 1, rules = {}, dealer = 0, wall = null, pot = 0, startingScores = null } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295 || !Number.isInteger(dealer) || dealer < 0 || dealer > 3 || !Number.isSafeInteger(pot) || pot < 0 || pot % 1e3) throw new Error("Invalid seed/dealer/pot");
  if (startingScores !== null && (!Array.isArray(startingScores) || startingScores.length !== 4 || startingScores.some((n) => !Number.isSafeInteger(n)))) throw new Error("Invalid starting scores");
  const w = wall ? [...wall] : shuffledWall(seed);
  if (w.length !== 136 || new Set(w).size !== 136 || w.some((id) => !Number.isInteger(id) || id < 0 || id >= 136)) throw new Error("Invalid wall");
  const s = {
    version: 1,
    seed,
    rules: sRules(rules),
    dealer,
    wall: w,
    dead: w.splice(122),
    pot,
    initialPot: pot,
    ...startingScores ? { startingScores: [...startingScores] } : {},
    players: Array.from({ length: 4 }, () => ({
      hand: [],
      melds: [],
      river: [],
      score: 0,
      won: false,
      win: null,
      passLock: false,
      drawn: null,
      drawSource: null,
      forbidden: [],
      riichi: false,
      riichiFuriten: false,
      riichiWaits: [],
      ippatsu: false,
      pao: null,
      stats: { winReceipt: 0, dealInLoss: 0, tsumoPaid: 0, drawLoss: 0, drawGain: 0, ronDeclined: 0, closedKans: 0, riichiPaid: 0 }
    })),
    phase: "init",
    turn: dealer,
    draws: 0,
    kans: 0,
    winners: [],
    events: [],
    reaction: null,
    ledger: [],
    end: null
  };
  for (let n = 0; n < 13; n++) for (let off = 0; off < 4; off++) s.players[(dealer + off) % 4].hand.push(s.wall.shift());
  for (const p of s.players) p.hand.sort((a, b) => a - b);
  draw2(s, dealer);
  assertInvariants2(s);
  return s;
}
function transfer2(s, from, to, amount, kind) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid transfer");
  if (from === "pot") s.pot -= amount;
  else s.players[from].score -= amount;
  if (to === "pot") s.pot += amount;
  else s.players[to].score += amount;
  s.ledger.push({ from, to, amount, kind });
  if (kind === "riichi") s.players[from].stats.riichiPaid += amount;
  else if (kind === "pot") s.players[to].stats.winReceipt += amount;
  else if (kind === "draw") {
    s.players[from].stats.drawLoss += amount;
    s.players[to].stats.drawGain += amount;
  } else {
    s.players[from].stats[kind === "ron" ? "dealInLoss" : "tsumoPaid"] += amount;
    s.players[to].stats.winReceipt += amount;
  }
}
function draw2(s, seat, kan = false) {
  if (!s.wall.length) {
    settleDraw2(s);
    return;
  }
  const p = s.players[seat];
  let id;
  if (kan) {
    const index = s.kans - 1;
    id = s.dead[index];
    s.dead[index] = s.wall.pop();
  } else id = s.wall.shift();
  p.hand.push(id);
  p.hand.sort((a, b) => a - b);
  p.drawn = id;
  p.drawSource = kan ? "kan" : "wall";
  p.passLock = false;
  p.forbidden = [];
  s.turn = seat;
  s.phase = "turn";
  s.reaction = null;
  s.draws++;
  event2(s, { type: kan ? "kanDraw" : "draw", seat, id });
}
function end(s, reason) {
  s.end = reason;
  s.phase = "end";
  s.reaction = null;
  event2(s, { type: "end", reason });
}
function win2(s, seat, method, source, tile) {
  const p = s.players[seat], tiles2 = handTypes2(p);
  if (method === "ron") tiles2.push(typeOf(tile));
  const score = scoreS(tiles2, p.melds, context(s, seat, method, typeOf(tile)), s.rules);
  if (!score) throw new Error("Illegal S win");
  const first = s.ledger.length, pao = score.yakuman ? p.pao : null;
  if (pao !== null) {
    if (method === "tsumo" || source === pao) transfer2(s, pao, seat, score.points.ron, method);
    else {
      transfer2(s, pao, seat, score.points.ron / 2, method);
      transfer2(s, source, seat, score.points.ron / 2, method);
    }
  } else if (method === "ron") transfer2(s, source, seat, score.points.ron, method);
  else for (let from = 0; from < 4; from++) if (from !== seat) transfer2(s, from, seat, from === s.dealer ? score.points.tsumoDealer : score.points.tsumoOther, method);
  if (s.pot) transfer2(s, "pot", seat, s.pot, "pot");
  const payments = structuredClone(s.ledger.slice(first));
  p.won = true;
  p.win = { method, source, tile, order: 1, drawNumber: s.draws, score, payments, receipt: payments.reduce((n, p2) => n + p2.amount, 0) };
  p.drawn = null;
  s.winners.push(seat);
  event2(s, { type: "win", seat, ...p.win });
  end(s, "win");
}
function visibleCounts2(s, seat) {
  const out = Array(34).fill(0), add = (id) => out[typeOf(id)]++;
  for (let i = 0; i < 4; i++) {
    const p = s.players[i];
    for (const m of p.melds) if (!privateKan2(s, m, i, seat)) for (const id of m.ids) add(id);
    for (const d of p.river) if (!d.claimed) add(d.id);
    if (i === seat || p.won && s.rules.revealWinnerHand) for (const id of p.hand) add(id);
  }
  for (const t of indicators(s)) out[t]++;
  return out;
}
function settleDraw2(s) {
  if (s.phase === "end" || s.wall.length) throw new Error("Cannot settle this game");
  const ready = s.players.flatMap((p, seat) => {
    const waits = shapeWaits(handTypes2(p), p.melds, s.rules);
    return waits.length ? [{ seat, waits }] : [];
  });
  if (ready.length && ready.length < 4) {
    const due = ready.map((p) => ({ seat: p.seat, amount: 3e3 / ready.length }));
    for (let from = 0; from < 4; from++) if (!ready.some((x) => x.seat === from)) {
      let debt = 3e3 / (4 - ready.length);
      for (const to of due) {
        const amount = Math.min(debt, to.amount);
        if (amount) {
          transfer2(s, from, to.seat, amount, "draw");
          debt -= amount;
          to.amount -= amount;
        }
      }
    }
  }
  event2(s, { type: "drawSettlement", ready });
  end(s, "exhaustive-draw");
}
function canRon2(s, seat) {
  const p = s.players[seat], r = s.reaction;
  if (seat === r.source || p.passLock || p.riichiFuriten) return null;
  const waits = shapeWaits(handTypes2(p), p.melds, s.rules);
  if (p.river.some((d) => waits.includes(typeOf(d.id)))) return null;
  return scoreS([...handTypes2(p), typeOf(r.id)], p.melds, context(s, seat, "ron", typeOf(r.id)), s.rules);
}
function legalActions2(s, seat = actor2(s)) {
  if (seat === null || seat !== actor2(s)) return [];
  const p = s.players[seat], tiles2 = handTypes2(p), c = counts(tiles2), out = [];
  if (s.phase === "turn") {
    if (p.drawn !== null && scoreS(tiles2, p.melds, context(s, seat, "tsumo", typeOf(p.drawn)), s.rules)) out.push({ type: "tsumo" });
    if (p.drawn !== null && s.wall.length && s.kans < 4) {
      for (let t = 0; t < 34; t++) if (c[t] === 4) {
        const waits = () => shapeWaits(tiles2.filter((x) => x !== t), [...p.melds, { type: "kan", tile: t, open: false }], s.rules);
        if (!p.riichi || typeOf(p.drawn) === t && same(waits(), p.riichiWaits)) out.push({ type: "ankan", tile: t });
      }
      if (!p.riichi) p.melds.forEach((m, i) => {
        if (m.type === "pon" && c[m.tile]) out.push({ type: "kakan", meld: i });
      });
    }
    for (let t = 0; t < 34; t++) if (c[t] && !p.forbidden.includes(t) && (!p.riichi || t === typeOf(p.drawn))) {
      out.push({ type: "discard", tile: t });
      if (!p.riichi && p.melds.every((m) => !m.open) && (s.startingScores?.[seat] ?? s.rules.startingPoints) + p.score >= 1e3 && s.wall.length >= 4) {
        const next = [...tiles2];
        next.splice(next.indexOf(t), 1);
        if (shapeWaits(next, p.melds, s.rules).length) out.push({ type: "riichi", tile: t });
      }
    }
  } else {
    const r = s.reaction, t = typeOf(r.id);
    if (canRon2(s, seat)) out.push({ type: "ron" });
    out.push({ type: "pass" });
    if (!p.riichi && r.kind === "discard" && s.wall.length) {
      if (c[t] >= 2) out.push({ type: "pon", tile: t });
      if (c[t] >= 3 && s.kans < 4) out.push({ type: "minkan", tile: t });
      if (seat === (r.source + 1) % 4 && t < 27) {
        for (let start2 = Math.max(Math.floor(t / 9) * 9, t - 2); start2 <= Math.min(Math.floor(t / 9) * 9 + 6, t); start2++) if ([start2, start2 + 1, start2 + 2].filter((x) => x !== t).every((x) => c[x])) out.push({ type: "chi", tile: start2 });
      }
    }
  }
  return out;
}
function remove(p, types) {
  const ids = [];
  for (const t of types) {
    const i = p.hand.findIndex((id) => typeOf(id) === t);
    if (i < 0) throw new Error("Missing tile");
    ids.push(...p.hand.splice(i, 1));
  }
  return ids;
}
function reaction(s, source, id, kind, extra = {}) {
  s.phase = "reaction";
  s.reaction = { source, id, kind, pending: [1, 2, 3].map((n) => (source + n) % 4), answers: [], ...extra };
}
function cancelIppatsu(s) {
  for (const p of s.players) p.ippatsu = false;
}
function completeKan2(s, seat) {
  cancelIppatsu(s);
  s.kans++;
  event2(s, { type: "kan", seat });
  draw2(s, seat, true);
}
function acceptRiichi(s, r) {
  if (!r.riichi) return;
  const p = s.players[r.source];
  p.riichi = true;
  p.ippatsu = true;
  p.riichiWaits = shapeWaits(handTypes2(p), p.melds, s.rules);
  transfer2(s, r.source, "pot", 1e3, "riichi");
  event2(s, { type: "riichi", seat: r.source });
}
function resolve(s) {
  const r = s.reaction, ron = r.answers.find((x) => x.action.type === "ron");
  if (ron) {
    if (r.kind === "kakan") {
      const p2 = s.players[r.source];
      p2.hand.splice(p2.hand.indexOf(r.id), 1);
      p2.river.push({ id: r.id, claimed: false, robbedKan: true });
    }
    win2(s, ron.seat, "ron", r.source, r.id);
    return;
  }
  if (r.kind === "kakan") {
    const p2 = s.players[r.source], m = p2.melds[r.meld];
    m.ids.push(...remove(p2, [m.tile]));
    m.type = "kan";
    completeKan2(s, r.source);
    return;
  }
  acceptRiichi(s, r);
  const calls = r.answers.filter((x) => ["pon", "minkan", "chi"].includes(x.action.type)).sort((a2, b) => (a2.action.type === "chi") - (b.action.type === "chi"));
  if (!calls.length) {
    draw2(s, (r.source + 1) % 4);
    return;
  }
  cancelIppatsu(s);
  const { seat, action: a } = calls[0], p = s.players[seat], t = typeOf(r.id), ids = [...remove(p, a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x) => x !== t) : Array(a.type === "minkan" ? 3 : 2).fill(t)), r.id];
  s.players[r.source].river.at(-1).claimed = true;
  p.melds.push({ type: a.type === "chi" ? "chi" : a.type === "minkan" ? "kan" : "pon", tile: a.tile, open: true, from: r.source, ids });
  const open = p.melds.filter((m) => m.open && m.type !== "chi");
  if (t >= 31 && open.filter((m) => m.tile >= 31).length === 3 || t >= 27 && t < 31 && open.filter((m) => m.tile >= 27 && m.tile < 31).length === 4) p.pao = r.source;
  p.drawn = null;
  p.drawSource = null;
  p.forbidden = s.rules.allowKuikae ? [] : [t];
  s.turn = seat;
  s.phase = "turn";
  s.reaction = null;
  event2(s, { type: "call", seat, action: a, from: r.source });
  if (a.type === "minkan") completeKan2(s, seat);
}
function step2(s, seat, a, { validate = true } = {}) {
  if (!a || !legalActions2(s, seat).some((x) => same(x, a))) throw new Error(`Illegal action by ${seat}: ${key(a)}`);
  const p = s.players[seat];
  event2(s, { type: "action", seat, action: { ...a } });
  if (s.phase === "reaction") {
    const r = s.reaction;
    if (a.type !== "ron" && canRon2(s, seat)) {
      p.passLock = true;
      p.stats.ronDeclined++;
      if (p.riichi) p.riichiFuriten = true;
    }
    r.answers.push({ seat, action: { ...a } });
    r.pending.shift();
    if (!r.pending.length) resolve(s);
  } else if (a.type === "tsumo") win2(s, seat, "tsumo", seat, p.drawn);
  else if (a.type === "discard" || a.type === "riichi") {
    const id = p.riichi ? p.hand.splice(p.hand.indexOf(p.drawn), 1)[0] : remove(p, [a.tile])[0];
    if (p.riichi) p.ippatsu = false;
    p.river.push({ id, claimed: false, ...a.type === "riichi" ? { riichi: true } : {} });
    p.drawn = null;
    p.forbidden = [];
    reaction(s, seat, id, "discard", { riichi: a.type === "riichi" });
  } else if (a.type === "ankan") {
    p.melds.push({ type: "kan", tile: a.tile, open: false, from: seat, ids: remove(p, Array(4).fill(a.tile)) });
    p.stats.closedKans++;
    completeKan2(s, seat);
  } else if (a.type === "kakan") {
    cancelIppatsu(s);
    reaction(s, seat, p.hand.find((id) => typeOf(id) === p.melds[a.meld].tile), "kakan", { meld: a.meld });
  }
  if (validate) assertInvariants2(s);
  return s;
}
function observation2(s, seat = actor2(s)) {
  if (seat !== actor2(s)) throw new Error("Not this player\u2019s decision");
  const p = s.players[seat];
  const players = s.players.map((p2, i) => ({ seat: i, won: p2.won, score: p2.score, handSize: p2.hand.length, riichi: p2.riichi, melds: p2.melds.map((m) => visibleMeld2(s, m, i, seat)), discards: p2.river.map((d) => ({ tile: typeOf(d.id), claimed: d.claimed, riichi: !!d.riichi })), revealed: p2.won && s.rules.revealWinnerHand ? handTypes2(p2) : [] }));
  return { seat, dealer: s.dealer, rules: structuredClone(s.rules), hand: handTypes2(p), melds: p.melds.map(meldView2), players, visible: visibleCounts2(s, seat), riichi: p.riichi, pot: s.pot, doraIndicators: indicators(s), activeCount: 4, wallRemaining: s.wall.length, draws: s.draws, phase: s.phase, lastDiscard: s.reaction ? { seat: s.reaction.source, tile: typeOf(s.reaction.id), kind: s.reaction.kind } : null, legalActions: legalActions2(s, seat) };
}
function assertInvariants2(s) {
  const all = [...s.wall, ...s.dead];
  for (const p of s.players) {
    all.push(...p.hand);
    for (const m of p.melds) all.push(...m.ids);
    for (const d of p.river) if (!d.claimed) all.push(d.id);
  }
  if (all.length !== 136 || new Set(all).size !== 136 || all.some((id) => !Number.isInteger(id) || id < 0 || id > 135)) throw new Error("Tile conservation violated");
  if (s.players.reduce((n, p) => n + p.score, 0) + s.pot !== s.initialPot || s.pot < 0) throw new Error("Score conservation violated");
  for (let seat = 0; seat < 4; seat++) {
    const p = s.players[seat], extra = s.phase === "turn" && s.turn === seat || s.phase === "reaction" && s.reaction.kind === "kakan" && s.reaction.source === seat || p.win?.method === "tsumo";
    if (p.hand.length + 3 * p.melds.length !== (extra ? 14 : 13)) throw new Error(`Hand size violated seat ${seat}`);
    for (const m of p.melds) {
      const wanted = m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : Array(m.type === "kan" ? 4 : 3).fill(m.tile);
      if (!same(m.ids.map(typeOf).sort((a, b) => a - b), wanted)) throw new Error("Illegal meld");
    }
    const st = p.stats;
    if (p.score !== st.winReceipt + st.drawGain - st.dealInLoss - st.tsumoPaid - st.drawLoss - st.riichiPaid) throw new Error("Ledger attribution violated");
  }
  if (s.dead.length !== 14 || s.kans > 4 || s.winners.length > 1 || s.winners.length !== s.players.filter((p) => p.won).length) throw new Error("S round invariant violated");
  return true;
}

// game/engine.mjs
var variantOf = (state2) => state2?.rules?.variant === "S" ? "S" : "H";
var engine = (state2) => variantOf(state2) === "S" ? game_exports2 : game_exports;
var actor3 = (state2) => engine(state2).actor(state2);
var legalActions3 = (state2, seat) => engine(state2).legalActions(state2, seat);
var observation3 = (state2, seat) => engine(state2).observation(state2, seat);
var step3 = (state2, seat, action, options) => engine(state2).step(state2, seat, action, options);

// policies/index.mjs
var policies_exports = {};
__export(policies_exports, {
  OPPONENT_PROFILES: () => OPPONENT_PROFILES,
  POLICIES: () => POLICIES,
  chooseAction: () => chooseAction,
  evaluateDiscards: () => evaluateDiscards,
  policyConfig: () => policyConfig,
  publicRisk: () => publicRisk
});

// engine/shanten.mjs
var suitCache = /* @__PURE__ */ new Map();
var honorCache = /* @__PURE__ */ new Map();
var pow5 = Array.from({ length: 9 }, (_, i) => 5 ** i);
function frontier(code, honor = false) {
  const cache = honor ? honorCache : suitCache;
  if (cache.has(code)) return cache.get(code);
  if (!code) return [[0, 0, 0]];
  const len = honor ? 7 : 9, c = Array(len);
  let k = code;
  for (let i2 = 0; i2 < len; i2++) {
    c[i2] = k % 5;
    k = Math.floor(k / 5);
  }
  const i = c.findIndex((n) => n > 0), base = pow5[i], out = /* @__PURE__ */ new Map();
  function merge(sub, dm, dt, dp) {
    for (const [m, t, p] of sub) {
      const mm = m + dm, pp = p + dp;
      if (mm > 4 || pp > 1) continue;
      const tt = Math.min(4 - mm, t + dt), key3 = mm * 2 + pp;
      if ((out.get(key3) ?? -1) < tt) out.set(key3, tt);
    }
  }
  merge(frontier(code - base, honor), 0, 0, 0);
  if (c[i] >= 3) merge(frontier(code - 3 * base, honor), 1, 0, 0);
  if (c[i] >= 2) {
    const rest = frontier(code - 2 * base, honor);
    merge(rest, 0, 1, 0);
    merge(rest, 0, 0, 1);
  }
  if (!honor) {
    if (i < 7 && c[i + 1] && c[i + 2]) merge(frontier(code - base - pow5[i + 1] - pow5[i + 2]), 1, 0, 0);
    if (i < 8 && c[i + 1]) merge(frontier(code - base - pow5[i + 1]), 0, 1, 0);
    if (i < 7 && c[i + 2]) merge(frontier(code - base - pow5[i + 2]), 0, 1, 0);
  }
  const result = [...out].map(([k2, t]) => [Math.floor(k2 / 2), t, k2 % 2]);
  cache.set(code, result);
  return result;
}
function suitCode(c, offset, len) {
  let code = 0;
  for (let i = 0; i < len; i++) code += c[offset + i] * pow5[i];
  return code;
}
function shanten(c, openMelds = 0, quadPairs = false) {
  let states = [[openMelds, 0, 0]];
  for (let s = 0; s < 4; s++) {
    const fs = frontier(suitCode(c, s * 9, s === 3 ? 7 : 9), s === 3), next = /* @__PURE__ */ new Map();
    for (const [m, t, p] of states) for (const [mm, tt, pp] of fs) {
      const nm = m + mm, np = p + pp;
      if (nm > 4 || np > 1) continue;
      const nt = Math.min(4 - nm, t + tt), key3 = nm * 2 + np;
      if ((next.get(key3) ?? -1) < nt) next.set(key3, nt);
    }
    states = [...next].map(([k, t]) => [Math.floor(k / 2), t, k % 2]);
  }
  let best = 8;
  for (const [m, t, p] of states) best = Math.min(best, 8 - 2 * m - t - p);
  if (!openMelds) {
    let pairs = 0, unique = 0;
    for (const n of c) {
      if (n) unique++;
      pairs += quadPairs ? Math.floor(n / 2) : Number(n >= 2);
    }
    best = Math.min(best, 6 - pairs + (quadPairs ? 0 : Math.max(0, 7 - unique)));
  }
  return best;
}
function effectiveTiles(c, openMelds, visible, rules) {
  const now = shanten(c, openMelds, rules.sevenPairsQuadAsTwo), tiles2 = [];
  let total = 0;
  for (let t = 0; t < 34; t++) if ((visible[t] ?? c[t]) < 4 && c[t] < 4) {
    c[t]++;
    const s = shanten(c, openMelds, rules.sevenPairsQuadAsTwo);
    c[t]--;
    if (s < now) {
      const remaining = 4 - (visible[t] ?? c[t]);
      total += remaining;
      tiles2.push({ tile: t, remaining });
    }
  }
  return { shanten: now, ukeire: total, tiles: tiles2 };
}

// policies/index.mjs
var POLICIES = Object.freeze({
  A: { name: "\uCD5C\uC18D \uD654\uB8CC \xB7 \uB860 \uC218\uB77D", speed: 1e3, ukeire: 1, value: 0, pinfu: 0, risk: 0, maxShantenLoss: 0, callCost: 0.2, declineRon: false },
  B: { name: "\uD551\uD6C4 \uC6B0\uC120 \xB7 \uB860 \uC218\uB77D", speed: 65, ukeire: 1, value: 0, pinfu: 24, risk: 0, maxShantenLoss: 1, callCost: 0.2, declineRon: false },
  C: { name: "\uD551\uD6C4 \uC6B0\uC120 \xB7 \uB860 \uAC70\uC808", speed: 65, ukeire: 1, value: 0, pinfu: 24, risk: 0, maxShantenLoss: 1, callCost: 0.2, declineRon: true },
  D: { name: "\uACE0\uB4DD\uC810 \uC9C0\uD5A5", speed: 38, ukeire: 0.7, value: 0.11, pinfu: 0, risk: 0, maxShantenLoss: 1, callCost: 0.2, declineRon: false },
  E: { name: "\uADE0\uD615\uD615", speed: 65, ukeire: 1, value: 0.045, pinfu: 3, risk: 18, maxShantenLoss: 1, callCost: 0.5, declineRon: false }
});
var OPPONENT_PROFILES = Object.freeze({
  speed: [{ id: "A" }, { id: "A" }, { id: "A" }],
  pinfu: [{ id: "B" }, { id: "B" }, { id: "B" }],
  value: [{ id: "D" }, { id: "D" }, { id: "D" }],
  cautious: [{ id: "E", weights: { risk: 45 } }, { id: "E", weights: { risk: 45 } }, { id: "E", weights: { risk: 45 } }],
  mixed: [{ id: "A" }, { id: "D" }, { id: "E" }],
  valuePressure: [{ id: "D", weights: { speed: 55, value: 0.2 } }, { id: "D", weights: { speed: 30, value: 0.3 } }, { id: "E", weights: { value: 0.14, lowValueRisk: 60, risk: 8 } }]
});
function policyConfig(id, weights = {}) {
  if (!POLICIES[id]) throw new Error(`Unknown policy ${id}`);
  for (const [k, v] of Object.entries(weights)) if (!["speed", "ukeire", "value", "pinfu", "risk", "maxShantenLoss", "callCost", "lowValueRisk", "lowValueThreshold"].includes(k) || !Number.isFinite(v) || v < 0) throw new Error(`Invalid policy weight ${k}`);
  return { lowValueRisk: 0, lowValueThreshold: 100, ...POLICIES[id], ...weights };
}
function potential(c, melds, o) {
  const tiles2 = [];
  for (let t = 0; t < 34; t++) for (let k = 0; k < c[t]; k++) tiles2.push(t);
  for (const m of melds) tiles2.push(...m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : Array(o.rules.fourOfAKindBonus && m.type === "kan" ? 4 : 3).fill(m.tile));
  const len = tiles2.length, openTrip = melds.filter((m) => m.type !== "chi").length;
  let connections = 0, triplets = 0, pairs = 0;
  for (let t = 0; t < 34; t++) {
    if (c[t] >= 3) triplets++;
    if (c[t] >= 2) pairs++;
    if (t < 27 && t % 9 < 8) connections += Math.min(c[t], c[t + 1]);
    if (t < 27 && t % 9 < 7) connections += 0.35 * Math.min(c[t], c[t + 2]);
  }
  const pinfu = connections / 4 + melds.filter((m) => m.type === "chi").length * 0.7 - openTrip * 1.8 - triplets * 0.25;
  const frequency = counts(tiles2), honors = tiles2.filter((t) => t >= 27).length;
  let val = 50;
  const fraction = (pred) => tiles2.filter(pred).length / Math.max(1, len);
  const feasible = (pred) => melds.every((m) => (m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : [m.tile]).every(pred));
  const attract = (points, pred) => {
    if (feasible(pred)) val = Math.max(val, points * Math.pow(fraction(pred), 5));
  };
  if (melds.every((m) => !m.open) && (!o.rules.concealedKanBreaksMenzen || !melds.length)) val = Math.max(val, 100);
  attract(100, (t) => !isYao(t));
  for (let s = 0; s < 3; s++) {
    attract(400, (t) => t < 27 && Math.floor(t / 9) === s);
    if (honors) attract(200, (t) => t >= 27 || Math.floor(t / 9) === s);
  }
  attract(1e3, (t) => t >= 27);
  if (!o.rules.greenRequiresDragon || frequency[32] > 0) attract(1e3, (t) => o.rules.greenTiles.includes(t));
  if (!melds.some((m) => m.type === "chi")) val = Math.max(val, 200 * Math.min(1, (2 * (triplets + openTrip) + pairs) / 9));
  if (!melds.length) val = Math.max(val, 400 * (pairs / 7) ** 3);
  const baseValue = val;
  for (let t = 27; t < 34; t++) {
    const unit = t >= 31 ? o.rules.dragonBonus : (t === o.rules.roundWind ? o.rules.roundWindBonus : 0) + (t === 27 + (o.seat - o.dealer + 4) % 4 ? o.rules.seatWindBonus : 0);
    val += unit * (frequency[t] >= 3 ? 1 : frequency[t] === 2 ? 0.45 : 0.05);
  }
  val += (o.rules.fourOfAKindBonus ? frequency.filter((n) => n === 4).length : melds.filter((m) => m.type === "kan").length) * o.rules.kanBonus;
  return { value: val, baseValue, pinfu };
}
function publicRisk(tile, o) {
  const availability = (4 - o.visible[tile]) / 4, shape = tile >= 27 ? 0.45 : [0, 8].includes(tile % 9) ? 0.7 : 1;
  let threat = 0;
  for (const p of o.players) if (p.seat !== o.seat && !p.won) {
    const suits = p.melds.filter((m) => !m.hidden && Number.isInteger(m.tile) && m.tile < 27).map((m) => Math.floor(m.tile / 9));
    const focus2 = suits.length >= 2 && new Set(suits).size === 1 && tile < 27 && Math.floor(tile / 9) === suits[0] ? 1.35 : 1;
    threat += (0.15 + Math.min(1, p.discards.length / 16) + p.melds.length * 0.25) * focus2;
  }
  return availability * shape * threat;
}
function value13(c, melds, o, w, discard = null) {
  const e = effectiveTiles(c, melds.length, o.visible, o.rules), p = potential(c, melds, o);
  const activeFactor = 0.6 + o.activeCount / 5;
  const risk = discard === null ? 0 : publicRisk(discard, o);
  let estimatedBase = p.baseValue;
  if (w.lowValueRisk > 0 && e.shanten === 0) {
    const tiles2 = [];
    for (let t = 0; t < 34; t++) for (let n = 0; n < c[t]; n++) tiles2.push(t);
    let bestBase = 0;
    for (let t = 0; t < 34; t++) if (c[t] < 4) {
      const hand = scoreHand([...tiles2, t], melds, { method: "ron", winTile: t, seatWind: 27 + (o.seat - o.dealer + 4) % 4 }, o.rules);
      if (hand) bestBase = Math.max(bestBase, hand.base);
    }
    if (bestBase) estimatedBase = bestBase;
  }
  const defensive = w.lowValueRisk > 0 && estimatedBase <= w.lowValueThreshold;
  const riskWeight = defensive ? w.lowValueRisk : w.risk;
  const score = -w.speed * e.shanten + w.ukeire * e.ukeire + w.value * p.value * activeFactor + w.pinfu * p.pinfu - riskWeight * risk * (e.shanten >= 2 ? 1.35 : 1);
  return { score, shanten: e.shanten, ukeire: e.ukeire, value: p.value, pinfu: p.pinfu, risk, estimatedBase, defensive, riskWeight };
}
function bestDiscard(c, melds, o, w, allowed = null) {
  const raw = [];
  for (let t = 0; t < 34; t++) if (c[t] && (!allowed || allowed.includes(t))) {
    c[t]--;
    const s = shanten(c, melds.length, o.rules.sevenPairsQuadAsTwo);
    c[t]++;
    raw.push({ tile: t, shanten: s });
  }
  const min = Math.min(...raw.map((x) => x.shanten));
  let best = null;
  for (const candidate of raw) if (candidate.shanten <= min + w.maxShantenLoss) {
    const t = candidate.tile;
    c[t]--;
    const metrics2 = value13(c, melds, o, w, t);
    c[t]++;
    const r = { tile: t, ...metrics2 };
    if (!best || r.score > best.score + 1e-9) best = r;
  }
  return best;
}
function chooseAction(o, id = "E", weights = {}) {
  const w = policyConfig(id, weights), as = o.legalActions;
  if (!as.length) throw new Error("No legal action");
  const find = (t) => as.find((a) => a.type === t);
  if (find("tsumo")) return find("tsumo");
  if (find("ron") && (!w.declineRon || !find("pass"))) return find("ron");
  if (find("ron") && w.declineRon) return find("pass");
  if (as.length === 1) return as[0];
  const c = counts(o.hand), melds = o.melds;
  if (o.phase === "turn") {
    const d = bestDiscard(c, melds, o, w, as.filter((a) => a.type === "discard").map((a) => a.tile));
    let chosen2 = { type: "discard", tile: d.tile }, best2 = d.score;
    for (const a of as.filter((a2) => a2.type === "ankan" || a2.type === "kakan")) {
      const cc = [...c], mm = melds.map((m) => ({ ...m }));
      if (a.type === "ankan") {
        cc[a.tile] -= 4;
        mm.push({ type: "kan", tile: a.tile, open: false });
      } else {
        cc[mm[a.meld].tile]--;
        mm[a.meld].type = "kan";
      }
      const v = value13(cc, mm, o, w);
      if (v.shanten <= d.shanten && v.score + 3 > best2) {
        best2 = v.score + 3;
        chosen2 = a;
      }
    }
    return chosen2;
  }
  let chosen = find("pass"), base = value13(c, melds, o, w), best = base.score;
  for (const a of as.filter((a2) => ["chi", "pon", "minkan"].includes(a2.type))) {
    const cc = [...c], mm = melds.map((m) => ({ ...m })), t = o.lastDiscard.tile;
    const need = a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x) => x !== t) : Array(a.type === "minkan" ? 3 : 2).fill(t);
    for (const n of need) cc[n]--;
    mm.push({ type: a.type === "chi" ? "chi" : a.type === "pon" ? "pon" : "kan", tile: a.tile, open: true });
    const v = a.type === "minkan" ? value13(cc, mm, o, w) : bestDiscard(cc, mm, o, w, o.rules.allowKuikae ? null : Array.from({ length: 34 }, (_, i) => i).filter((i) => i !== t));
    if (!v || v.shanten > base.shanten + w.maxShantenLoss) continue;
    const score = v.score - w.callCost + (a.type === "minkan" ? 3 : 0);
    if (score > best + 1e-9) {
      best = score;
      chosen = a;
    }
  }
  return chosen;
}
function evaluateDiscards(o, id = "E", weights = {}) {
  const w = policyConfig(id, weights), c = counts(o.hand);
  return o.legalActions.filter((a) => a.type === "discard").map((a) => {
    c[a.tile]--;
    const v = value13(c, o.melds, o, w, a.tile);
    c[a.tile]++;
    return { ...a, ...v };
  }).sort((a, b) => b.score - a.score);
}

// s-engine/policy.mjs
var policy_exports = {};
__export(policy_exports, {
  chooseAction: () => chooseAction2,
  evaluateDiscards: () => evaluateDiscards2
});
var distance = (c, m, rules) => Math.min(shanten(c, m), !m && rules.standardYakuman ? 13 - ORPHANS.filter((t) => c[t]).length - Number(ORPHANS.some((t) => c[t] >= 2)) : 8);
function metrics(c, melds, o, w, discard = null) {
  const s = distance(c, melds.length, o.rules);
  let ukeire = 0;
  for (let t = 0; t < 34; t++) if (c[t] < 4 && o.visible[t] < 4) {
    c[t]++;
    if (distance(c, melds.length, o.rules) < s) ukeire += 4 - o.visible[t];
    c[t]--;
  }
  const closed = melds.every((m) => !m.open), all = [...c];
  for (const m of melds) for (const t of m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : Array(m.type === "kan" ? 4 : 3).fill(m.tile)) all[t]++;
  let value2 = closed ? 100 : 0, connections = 0;
  for (let t = 0; t < 27; t++) {
    if (t % 9 < 8) connections += Math.min(c[t], c[t + 1]);
    if (t % 9 < 7) connections += 0.35 * Math.min(c[t], c[t + 2]);
  }
  for (let t = 27; t < 34; t++) if (t >= 31 || t === o.rules.roundWind || t === 27 + (o.seat - o.dealer + 4) % 4) value2 += all[t] >= 3 ? 200 : all[t] === 2 ? 75 : 0;
  value2 += (o.doraIndicators ?? []).reduce((n, t) => n + all[doraAfter(t)] * 100, 0);
  const size = all.reduce((a, b) => a + b, 0), simple = all.reduce((n, count, t) => n + (!isYao(t) ? count : 0), 0);
  value2 += 100 * (simple / size) ** 5;
  for (let suit = 0; suit < 3; suit++) value2 = Math.max(value2, 600 * (all.slice(suit * 9, suit * 9 + 9).reduce((a, b) => a + b, 0) / size) ** 5);
  const pinfu = closed ? connections / 4 - c.filter((n) => n >= 3).length * 0.3 : 0;
  let risk = 0;
  if (discard !== null) {
    for (const p of o.players) if (p.seat !== o.seat && !p.discards.some((d) => d.tile === discard)) risk += (p.riichi ? 3 : 0.2 + Math.min(1, p.discards.length / 16)) * (4 - o.visible[discard]) / 4 * (discard >= 27 ? 0.45 : 1);
  }
  return { shanten: s, ukeire, value: value2, pinfu, risk, score: -w.speed * s + w.ukeire * ukeire + w.value * value2 + w.pinfu * pinfu - w.risk * risk };
}
function bestDiscard2(c, melds, o, w, allowed) {
  const rows = [];
  for (let t = 0; t < 34; t++) if (c[t] && (!allowed || allowed.includes(t))) {
    c[t]--;
    rows.push({ type: "discard", tile: t, ...metrics(c, melds, o, w, t) });
    c[t]++;
  }
  const min = Math.min(...rows.map((r) => r.shanten));
  return rows.filter((r) => r.shanten <= min + w.maxShantenLoss).sort((a, b) => b.score - a.score)[0];
}
function evaluateDiscards2(o, id = "E", weights = {}) {
  const c = counts(o.hand), w = policyConfig(id, weights);
  return o.legalActions.filter((a) => a.type === "discard").map((a) => {
    c[a.tile]--;
    const m = metrics(c, o.melds, o, w, a.tile);
    c[a.tile]++;
    return { ...a, ...m };
  }).sort((a, b) => b.score - a.score);
}
function chooseAction2(o, id = "E", weights = {}) {
  const as = o.legalActions, w = policyConfig(id, weights), find = (t) => as.find((a) => a.type === t);
  if (!as.length) throw new Error("No legal action");
  if (find("tsumo")) return find("tsumo");
  if (find("ron")) return w.declineRon ? find("pass") : find("ron");
  if (as.length === 1) return as[0];
  const c = counts(o.hand);
  if (o.phase === "turn") {
    const d = bestDiscard2(c, o.melds, o, w, as.filter((a) => a.type === "discard").map((a) => a.tile));
    let chosen2 = { type: "discard", tile: d.tile }, best2 = d.score;
    for (const a of as.filter((a2) => a2.type === "ankan" || a2.type === "kakan")) {
      const cc = [...c], mm = structuredClone(o.melds);
      if (a.type === "ankan") {
        cc[a.tile] -= 4;
        mm.push({ type: "kan", tile: a.tile, open: false });
      } else {
        cc[mm[a.meld].tile]--;
        mm[a.meld].type = "kan";
      }
      const m = metrics(cc, mm, o, w);
      if (m.shanten <= d.shanten && m.score + 3 > best2) {
        best2 = m.score + 3;
        chosen2 = a;
      }
    }
    if (chosen2.type === "discard") {
      const riichi = as.find((a) => a.type === "riichi" && a.tile === chosen2.tile);
      if (riichi && !(id === "E" && d.risk > 3)) return riichi;
    }
    return chosen2;
  }
  let chosen = find("pass"), base = metrics(c, o.melds, o, w), best = base.score;
  for (const a of as.filter((a2) => ["chi", "pon", "minkan"].includes(a2.type))) {
    const cc = [...c], mm = structuredClone(o.melds), t = o.lastDiscard.tile;
    for (const tile of a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x) => x !== t) : Array(a.type === "minkan" ? 3 : 2).fill(t)) cc[tile]--;
    mm.push({ type: a.type === "chi" ? "chi" : a.type === "pon" ? "pon" : "kan", tile: a.tile, open: true });
    const openValue = mm.some((m2) => m2.type !== "chi" && (m2.tile >= 31 || m2.tile === o.rules.roundWind || m2.tile === 27 + (o.seat - o.dealer + 4) % 4));
    const simple = o.hand.every((t2) => !isYao(t2)) && !isYao(t);
    const flush = new Set([...o.hand, ...mm.map((m2) => m2.tile)].filter((t2) => t2 < 27).map((t2) => Math.floor(t2 / 9))).size === 1;
    const triplets = mm.every((m2) => m2.type !== "chi") && cc.filter((n) => n >= 2).length + mm.length >= 4;
    if (!openValue && !simple && !flush && !triplets) continue;
    const m = a.type === "minkan" ? metrics(cc, mm, o, w) : bestDiscard2(cc, mm, o, w, o.rules.allowKuikae ? null : Array.from({ length: 34 }, (_, i) => i).filter((i) => i !== t));
    if (m && m.shanten <= base.shanten + w.maxShantenLoss && m.score - w.callCost > best) {
      chosen = a;
      best = m.score - w.callCost;
    }
  }
  return chosen;
}

// game/policies.mjs
var POLICIES2 = POLICIES;
var OPPONENT_PROFILES2 = OPPONENT_PROFILES;
var chooseAction3 = (view, id, weights) => (view.rules.variant === "S" ? policy_exports : policies_exports).chooseAction(view, id, weights);
var evaluateDiscards3 = (view, id, weights) => (view.rules.variant === "S" ? policy_exports : policies_exports).evaluateDiscards(view, id, weights);

// web/practice-flow.mjs
var AUTO_PASS_DELAY_MS = 700;
var SEAT_NAMES = ["\uB3D9", "\uB0A8", "\uC11C", "\uBD81"];
var practiceSeat = (seed) => seed >>> 16 & 3;
function displayedTurn(state2) {
  if (state2.phase === "reaction") return state2.reaction.source;
  return state2.phase === "turn" ? state2.turn : null;
}
function resolveAiReactions(state2, humanSeat2, choose, apply = step3) {
  while (state2.phase === "reaction" && actor3(state2) !== humanSeat2) {
    const seat = actor3(state2);
    apply(state2, seat, choose(observation3(state2, seat)));
  }
}
function handDisplay(state2, seat = 0) {
  const player = state2.players[seat];
  const drawn = state2.phase === "turn" && actor3(state2) === seat && !player.won && player.drawn !== null && player.hand.includes(player.drawn) ? player.drawn : null;
  return { held: player.hand.filter((id) => id !== drawn), drawn };
}
function needsAutomaticPass(state2, seat = 0) {
  if (state2.phase !== "reaction" || actor3(state2) !== seat) return false;
  const actions = legalActions3(state2, seat);
  return actions.length === 1 && actions[0].type === "pass";
}
function nextDelay(state2, autoplay, seat = 0) {
  if (state2.phase === "end") return null;
  if (needsAutomaticPass(state2, seat)) return AUTO_PASS_DELAY_MS;
  if (actor3(state2) !== seat || autoplay) return autoplay ? 30 : 90;
  return null;
}

// web/recommendation-explanation.mjs
var LABELS = { speed: "\uC644\uC131 \uC18D\uB3C4", ukeire: "\uC720\uD6A8\uD328", value: "\uC5ED \uAC00\uCE58", pinfu: "\uD551\uD6C4 \uD615\uD0DC", risk: "\uACF5\uAC1C \uC815\uBCF4 \uC704\uD5D8" };
var format = (value2) => value2 !== 0 && Math.abs(value2) < 5e-3 ? value2.toPrecision(2) : Number(value2.toFixed(2)).toLocaleString("ko-KR");
var signed = (value2) => `${value2 >= 0 ? "+" : "\u2212"}${format(Math.abs(value2))}`;
var distance2 = (value2) => value2 === 0 ? "\uD150\uD30C\uC774(0\uC0E8\uD150)" : `${value2}\uC0E8\uD150`;
function components(row, view, weights, variant) {
  return {
    speed: -weights.speed * row.shanten,
    ukeire: weights.ukeire * row.ukeire,
    value: weights.value * row.value * (variant === "H" ? 0.6 + view.activeCount / 5 : 1),
    pinfu: weights.pinfu * row.pinfu,
    risk: -(row.riskWeight ?? weights.risk) * row.risk * (variant === "H" && row.shanten >= 2 ? 1.35 : 1)
  };
}
function rankRows(rows, variant) {
  const remaining = [...rows].sort((a, b) => a.tile - b.tile), ranked = [];
  while (remaining.length) {
    let best = 0;
    for (let index = 1; index < remaining.length; index++) {
      if (remaining[index].score > remaining[best].score + (variant === "H" ? 1e-9 : 0)) best = index;
    }
    ranked.push(remaining.splice(best, 1)[0]);
  }
  return ranked;
}
function explainDiscards(view, policy, weights = {}, selectedAction = null) {
  if (selectedAction && selectedAction.type !== "discard") return null;
  const discards = view.legalActions.filter((action) => action.type === "discard");
  if (!discards.length) return null;
  const variant = view.rules.variant === "S" ? "S" : "H", config = policyConfig(policy, weights);
  const rows = evaluateDiscards3({ ...view, legalActions: discards }, policy, weights);
  const minShanten = Math.min(...rows.map((row) => row.shanten));
  const eligible = rows.filter((row) => row.shanten <= minShanten + config.maxShantenLoss);
  const ordered = rankRows(eligible, variant), selectedTile = selectedAction?.tile ?? ordered[0].tile;
  if (!discards.some((action) => action.tile === selectedTile)) throw new Error("\uC124\uBA85\uD560 \uBC84\uB9BC\uD328\uAC00 \uD604\uC7AC \uD569\uBC95 \uD589\uB3D9\uC5D0 \uC5C6\uC2B5\uB2C8\uB2E4.");
  if (!eligible.some((row) => row.tile === selectedTile)) throw new Error("\uC124\uBA85\uD560 \uBC84\uB9BC\uD328\uAC00 \uC774 \uC804\uB7B5\uC758 \uC0E8\uD150 \uC81C\uD55C\uC5D0\uC11C \uC81C\uC678\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
  const ranked = ordered.map((row, index) => ({
    rank: index + 1,
    tile: row.tile,
    score: row.score,
    shanten: row.shanten,
    ukeire: row.ukeire,
    components: components(row, view, config, variant),
    metrics: { value: row.value, pinfu: row.pinfu, risk: row.risk, estimatedBase: row.estimatedBase, defensive: row.defensive, riskWeight: row.riskWeight },
    selected: row.tile === selectedTile
  }));
  const selected = ranked.find((row) => row.selected), alternative = ranked.find((row) => !row.selected);
  const ranking = ranked.filter((row) => row.rank <= 3 || row.selected);
  let reason = `${tileName(selected.tile)}\uB97C \uBC84\uB9AC\uBA74 ${distance2(selected.shanten)}, \uC720\uD6A8\uD328 \uCD94\uC815 ${selected.ukeire}\uC7A5\uC785\uB2C8\uB2E4.`;
  let comparison = null;
  if (alternative) {
    const differences = Object.entries(selected.components).map(([component, value2]) => ({
      component,
      label: LABELS[component],
      difference: value2 - alternative.components[component]
    })).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    const scoreDifference = selected.score - alternative.score;
    comparison = { tile: alternative.tile, scoreDifference, components: Object.fromEntries(differences.map((row) => [row.component, row.difference])) };
    const nearTie = variant === "H" ? Math.abs(scoreDifference) <= 1e-9 : scoreDifference === 0;
    if (nearTie) {
      reason += ` ${tileName(alternative.tile)}\uC640 ${variant === "H" ? "\uD3C9\uAC00\uC810\uC218\uAC00 0.000000001 \uC774\uB0B4\uB85C \uAC19\uC544" : "\uD3C9\uAC00\uC810\uC218\uAC00 \uAC19\uC544"} \uD0C0\uC77C \uBC88\uD638 \uC21C\uC11C\uB85C \uC6B0\uC120\uC21C\uC704\uB97C \uC815\uD569\uB2C8\uB2E4.`;
    } else {
      const main = differences.filter((row) => row.difference !== 0).slice(0, 2);
      reason += ` ${tileName(alternative.tile)}\uC640 \uBE44\uAD50\uD55C \uC8FC\uC694 \uD3C9\uAC00 \uAE30\uC5EC \uCC28\uC774\uB294 ${main.map((row) => `${row.label} ${signed(row.difference)}`).join(", ")}\uC774\uBA70, \uCD1D \uD3C9\uAC00\uC810\uC218 \uCC28\uC774\uB294 ${signed(scoreDifference)}\uC785\uB2C8\uB2E4.`;
    }
  } else reason += " \uC774 \uC804\uB7B5\uC758 \uC0E8\uD150 \uC81C\uD55C\uC744 \uB9CC\uC871\uD558\uB294 \uBC84\uB9BC\uD328 \uD6C4\uBCF4\uAC00 \uD558\uB098\uC785\uB2C8\uB2E4.";
  if (selected.metrics.defensive) reason += ` \uAC00\uC0B0\uC810 \uC81C\uC678 \uC5ED \uC810\uC218 \uCD94\uC815 ${Math.round(selected.metrics.estimatedBase)}\uC810\uC73C\uB85C \uC800\uD310\uC218 \uC218\uBE44 \uAC00\uC911\uCE58\uB97C \uC801\uC6A9\uD569\uB2C8\uB2E4.`;
  if (policy === "E" && config.risk === 0 && !config.lowValueRisk) reason += " \uC774 \uAC00\uC911\uCE58\uC5D0\uC11C\uB294 \uC704\uD5D8\uB3C4 \uAC10\uC810\uC744 \uC801\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
  return {
    policy,
    variant,
    reason,
    ranking,
    selectedRank: selected.rank,
    comparison,
    excludedCount: rows.length - eligible.length,
    totalCount: rows.length,
    eligibleCount: eligible.length,
    minShanten,
    maxShantenLoss: config.maxShantenLoss,
    scoreNote: "\uAC19\uC740 \uC804\uB7B5 \uC548\uC5D0\uC11C \uBC84\uB9BC\uD328 \uD6C4\uBCF4\uB97C \uBE44\uAD50\uD558\uB294 \uD734\uB9AC\uC2A4\uD2F1 \uD3C9\uAC00\uC810\uC218\uC785\uB2C8\uB2E4. \uC608\uC0C1 \uC218\uC775\uC774\uB098 \uAC15\uD654\uD559\uC2B5 Q\uAC12\uC774 \uC544\uB2C8\uBA70, \uC74C\uC218\uB3C4 \uC815\uC0C1\uC785\uB2C8\uB2E4.",
    tieRule: variant === "H" ? "\uD0C0\uC77C \uBC88\uD638 \uC624\uB984\uCC28\uC21C \uAC80\uC0AC, 1e-9\uBCF4\uB2E4 \uD06C\uAC8C \uB192\uC744 \uB54C\uB9CC \uC6B0\uC120 \uD6C4\uBCF4 \uAD50\uCCB4" : "\uD3C9\uAC00\uC810\uC218 \uB0B4\uB9BC\uCC28\uC21C, \uAC19\uC740 \uC810\uC218\uB294 \uD0C0\uC77C \uBC88\uD638 \uC624\uB984\uCC28\uC21C"
  };
}

// web/recommendations.mjs
var focus = {
  A: "\uC0E8\uD150\uC744 \uBA3C\uC800 \uC904\uC774\uACE0 \uC720\uD6A8\uD328\uAC00 \uB9CE\uC740 \uCABD\uC744 \uACE0\uB985\uB2C8\uB2E4.",
  B: "\uC21C\uC790 \uC911\uC2EC\uC758 \uD551\uD6C4 \uD615\uD0DC\uC640 \uBE60\uB978 \uC644\uC131\uC744 \uD568\uAED8 \uBD05\uB2C8\uB2E4.",
  C: "\uD551\uD6C4 \uD615\uD0DC\uB97C \uC6B0\uC120\uD558\uBA70, \uB860\uC744 \uB118\uAE38 \uC218 \uC788\uC73C\uBA74 \uCBD4\uBAA8\uB97C \uAE30\uB2E4\uB9BD\uB2C8\uB2E4.",
  D: "\uC18D\uB3C4\uC640 \uD568\uAED8 \uB192\uC740 \uC5ED\uC744 \uB9CC\uB4E4 \uAC00\uB2A5\uC131\uC744 \uD3C9\uAC00\uD569\uB2C8\uB2E4.",
  E: "\uC18D\uB3C4\xB7\uC5ED \uAC00\uCE58\xB7\uB0A8\uC740 \uC0C1\uB300 \uC218\uC640 \uACF5\uAC1C\uB41C \uC704\uD5D8 \uC815\uBCF4\uB97C \uD568\uAED8 \uBD05\uB2C8\uB2E4."
};
function actionLabel(action, view = {}) {
  switch (action.type) {
    case "discard":
      return `${tileName(action.tile)} \uBC84\uB9AC\uAE30`;
    case "riichi":
      return `\uB9AC\uCE58 \xB7 ${tileName(action.tile)} \uBC84\uB9AC\uAE30`;
    case "tsumo":
      return "\uCBD4\uBAA8 \uD654\uB8CC";
    case "ron":
      return "\uB860 \uD654\uB8CC";
    case "pass":
      return view.legalActions?.some((a) => a.type === "ron") ? "\uB860 \uB118\uAE30\uAE30" : "\uB118\uAE30\uAE30";
    case "chi":
      return `\uCE58 \xB7 ${[action.tile, action.tile + 1, action.tile + 2].map(tileName).join(" ")}`;
    case "pon":
      return `\uD401 \xB7 ${tileName(action.tile)}`;
    case "minkan":
      return `\uBA85\uAE61 \xB7 ${tileName(action.tile)}`;
    case "ankan":
      return `\uC548\uAE61 \xB7 ${tileName(action.tile)}`;
    case "kakan":
      return `\uAC00\uAE61 \xB7 ${tileName(view.melds[action.meld].tile)}`;
    default:
      throw new Error("\uC54C \uC218 \uC5C6\uB294 \uCD94\uCC9C \uD589\uB3D9\uC785\uB2C8\uB2E4.");
  }
}
function reasonFor(action, view, policy, weights) {
  if (action.type === "riichi") return "\uBA58\uC820 \uD150\uD30C\uC774\uB85C 1,000\uC810\uC744 \uACF5\uD0C1\uD569\uB2C8\uB2E4. \uB9AC\uCE58\uB9CC\uC73C\uB85C\uB294 S\uB8F0\uC758 \uD654\uB8CC \uC5ED \uC870\uAC74\uC744 \uCDA9\uC871\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
  if (action.type === "tsumo") return "\uC9C0\uAE08 \uCBD4\uBAA8 \uD654\uB8CC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
  if (action.type === "ron") return policy === "C" ? "\uC774 \uADDC\uCE59\uC5D0\uC11C\uB294 \uB860\uC744 \uB118\uAE38 \uC218 \uC5C6\uC5B4 \uD654\uB8CC\uD569\uB2C8\uB2E4." : "\uC644\uC131\uB41C \uD328\uB85C \uC9C0\uAE08 \uB860 \uD654\uB8CC\uD569\uB2C8\uB2E4.";
  if (action.type === "pass") {
    if (view.legalActions.some((a) => a.type === "ron")) return view.rules.variant === "S" ? "\uB860\uC744 \uB118\uACA8 \uD6C4\uB9AC\uD150\uC774 \uB429\uB2C8\uB2E4. \uB9AC\uCE58 \uC911\uC774\uBA74 \uC774 \uAD6D\uC5D0\uC11C \uB2E4\uC2DC \uB860\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." : "\uD569\uBC95\uC801\uC778 \uB860\uC744 \uB118\uAE30\uACE0 \uCBD4\uBAA8\uB97C \uAE30\uB2E4\uB9AC\uB294 \uC120\uD0DD\uC785\uB2C8\uB2E4.";
    if (view.legalActions.length === 1) return "\uB860\uC774\uB098 \uD6C4\uB85C\uAC00 \uBD88\uAC00\uB2A5\uD574 \uB118\uAE41\uB2C8\uB2E4.";
    return "\uD6C4\uB85C \uC774\uD6C4\uC758 \uD615\uD0DC\uC640 \uC190\uD328 \uC720\uC9C0\uB97C \uBE44\uAD50\uD574 \uB118\uAE30\uAE30\uB97C \uC120\uD0DD\uD588\uC2B5\uB2C8\uB2E4.";
  }
  if (action.type === "chi" || action.type === "pon") return "\uD6C4\uB85C \uC774\uD6C4\uC5D0 \uBC84\uB9B4 \uD328\uAE4C\uC9C0 \uBE44\uAD50\uD55C \uC120\uD0DD\uC785\uB2C8\uB2E4.";
  if (["ankan", "kakan", "minkan"].includes(action.type)) return "\uBCF4\uCDA9\uD328\uB97C \uBC1B\uAE30 \uC804\uC758 \uD615\uD0DC\uB97C \uAE30\uC900\uC73C\uB85C \uAE61\uC744 \uD3C9\uAC00\uD588\uC2B5\uB2C8\uB2E4.";
  if (policy === "E" && weights?.risk === 0) return "\uC18D\uB3C4\xB7\uC5ED \uAC00\uCE58\xB7\uB0A8\uC740 \uC0C1\uB300 \uC218\uB97C \uBD05\uB2C8\uB2E4. \uC774 \uD559\uC2B5 \uBC84\uC804\uC740 \uC704\uD5D8\uB3C4 \uAC10\uC810\uC744 \uC4F0\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.";
  return focus[policy];
}
function strategyRecommendations(view, weights = {}) {
  if (!view.legalActions.length) return [];
  const discards = view.legalActions.filter((a) => a.type === "discard");
  return Object.entries(POLICIES2).map(([policy, config]) => {
    const action = chooseAction3(view, policy, weights[policy]);
    let discard = null;
    if (discards.length && action.type !== "tsumo") {
      const selected = action.type === "discard" ? action : chooseAction3({ ...view, legalActions: discards }, policy, weights[policy]);
      const explanation = explainDiscards({ ...view, legalActions: discards }, policy, weights[policy], selected);
      const metrics2 = explanation.ranking.find((row) => row.tile === selected.tile);
      discard = {
        action: { ...selected },
        label: actionLabel(selected),
        shanten: metrics2.shanten,
        ukeire: metrics2.ukeire,
        reason: explanation.reason,
        ranking: explanation.ranking,
        excludedCount: explanation.excludedCount
      };
    }
    return {
      policy,
      name: config.name,
      action: { ...action },
      label: actionLabel(action, view),
      reason: action.type === "discard" ? discard.reason : reasonFor(action, view, policy, weights[policy]),
      discard
    };
  });
}

// web/tile-view.mjs
var SVG = "http://www.w3.org/2000/svg";
var dots = { 1: [[50, 50]], 2: [[50, 24], [50, 76]], 3: [[24, 22], [50, 50], [76, 78]], 4: [[24, 24], [76, 24], [24, 76], [76, 76]], 5: [[24, 24], [76, 24], [50, 50], [24, 76], [76, 76]], 6: [[24, 18], [76, 18], [24, 50], [76, 50], [24, 82], [76, 82]], 7: [[24, 16], [50, 31], [76, 16], [24, 57], [76, 57], [24, 84], [76, 84]], 8: [[24, 13], [76, 13], [24, 38], [76, 38], [24, 63], [76, 63], [24, 88], [76, 88]], 9: [[22, 16], [50, 16], [78, 16], [22, 50], [50, 50], [78, 50], [22, 84], [50, 84], [78, 84]] };
function element(tag, attributes) {
  const el = document.createElementNS(SVG, tag);
  for (const [key3, value2] of Object.entries(attributes)) el.setAttribute(key3, String(value2));
  return el;
}
function span(text, cls) {
  const el = document.createElement("span");
  el.className = cls;
  el.textContent = text;
  return el;
}
function bird(svg) {
  svg.setAttribute("data-design", "bamboo-bird");
  for (const d of ["M47 60 Q16 66 17 98 Q38 91 51 67", "M49 62 Q32 81 37 103 Q54 92 56 65", "M54 62 Q54 86 69 99 Q76 78 62 60"]) svg.append(element("path", { d, fill: "#1a7952", stroke: "#125c40", "stroke-width": 2 }));
  svg.append(element("path", { d: "M28 47 Q22 30 34 19 Q48 13 55 27 L65 43 Q77 55 63 68 Q48 78 34 65 Q25 58 28 47Z", fill: "#1a7952" }));
  svg.append(element("path", { d: "M34 46 Q45 35 63 48 Q61 63 41 66 Q49 55 34 46Z", fill: "#2d526f" }));
  svg.append(element("path", { d: "M53 24 L72 32 L55 35Z", fill: "#b12739" }));
  svg.append(element("circle", { cx: 45, cy: 25, r: 4, fill: "#fff7dc" }), element("circle", { cx: 46, cy: 25, r: 2, fill: "#173d32" }));
  svg.append(element("path", { d: "M32 17 L27 10 M38 15 L37 7 M49 68 L50 82 M50 82 L42 86 M50 82 L58 85", fill: "none", stroke: "#b12739", "stroke-width": 3, "stroke-linecap": "round" }));
}
function eightBamboo(svg) {
  svg.setAttribute("data-design", "bamboo-eight");
  for (const points of [[[5, 18], [24, 43], [43, 18]], [[57, 18], [76, 43], [95, 18]], [[5, 92], [24, 67], [43, 92]], [[57, 92], [76, 67], [95, 92]]]) {
    svg.append(element("path", { d: points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" "), fill: "none", stroke: "#166b46", "stroke-width": 8, "stroke-linecap": "butt", "stroke-linejoin": "miter", "stroke-miterlimit": 2 }));
    for (let i = 0; i < 2; i++) {
      const [x1, y1] = points[i], [x2, y2] = points[i + 1], length = Math.hypot(x2 - x1, y2 - y1), dx = (y2 - y1) / length * 3.5, dy = -(x2 - x1) / length * 3.5, g = element("g", { "data-bamboo-stem": "true" });
      for (const t of [0.3, 0.7]) {
        const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
        g.append(element("path", { d: `M${x - dx} ${y - dy} L${x + dx} ${y + dy}`, fill: "none", stroke: "#0d4e33", "stroke-width": 1.7 }));
      }
      svg.append(g);
    }
  }
}
function tileFace(type, { button = false, small = false } = {}) {
  const tile = document.createElement(button ? "button" : "span");
  tile.className = `tile-face ${small ? "tile-small" : "tile"}`;
  tile.dataset.type = String(type);
  tile.dataset.suit = type < 27 ? ["m", "p", "s"][Math.floor(type / 9)] : "z";
  tile.title = tileName(type);
  tile.setAttribute("aria-label", tileName(type));
  if (button) tile.type = "button";
  if (type < 9) {
    tile.append(span(["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u4E03", "\u516B", "\u4E5D"][type], "tile-number"), span("\u842C", "tile-man"));
  } else if (type < 27) {
    const n = type % 9 + 1, svg = element("svg", { viewBox: "0 0 100 110", class: "tile-symbol", "aria-hidden": "true", focusable: "false" });
    if (type === 18) bird(svg);
    else if (type === 25) eightBamboo(svg);
    else for (const [index, [x, y]] of dots[n].entries()) {
      if (type < 18) {
        const color = "#222222";
        svg.append(element("circle", { cx: x, cy: y + 5, r: n === 1 ? 25 : n < 6 ? 14 : 10, fill: "none", stroke: color, "stroke-width": n === 1 ? 8 : 6 }));
        svg.append(element("circle", { cx: x, cy: y + 5, r: n === 1 ? 11 : 3, fill: color }));
      } else {
        const color = n === 7 && index < 3 ? "#b12739" : "#1a7952", length = n === 1 ? 56 : n < 4 ? 30 : 20, thick = n === 1 ? 13 : 7;
        svg.append(element("path", { d: `M ${x} ${y + 5 - length / 2} v ${length} M ${x - thick / 2} ${y + 5 - length / 2 + 4} h ${thick} M ${x - thick / 2} ${y + 5 + length / 2 - 4} h ${thick}`, fill: "none", stroke: color, "stroke-width": thick, "stroke-linecap": "round" }));
      }
    }
    tile.append(svg);
  } else if (type === 31) {
    tile.append(span("", "tile-white"));
  } else tile.append(span({ 27: "\u6771", 28: "\u5357", 29: "\u897F", 30: "\u5317", 32: "\u767C", 33: "\u4E2D" }[type], "tile-honor"));
  for (const child of tile.children) child.setAttribute("aria-hidden", "true");
  return tile;
}

// web/selection.mjs
function canSelectTile(state2, seat, id, auto2 = false) {
  return !auto2 && Number.isInteger(id) && state2.phase === "turn" && actor3(state2) === seat && state2.players[seat].hand.includes(id) && legalActions3(state2, seat).some((a) => a.type === "discard" && a.tile === typeOf(id));
}
function selectedDiscard(state2, seat, id, auto2 = false) {
  if (!canSelectTile(state2, seat, id, auto2)) throw new Error("\uD604\uC7AC \uC190\uD328\uC5D0\uC11C \uBC84\uB9B4 \uD328\uB97C \uB2E4\uC2DC \uC120\uD0DD\uD558\uC138\uC694.");
  return { type: "discard", tile: typeOf(id) };
}
function seatPositions(humanSeat2) {
  return { bottom: humanSeat2, right: (humanSeat2 + 1) % 4, top: (humanSeat2 + 2) % 4, left: (humanSeat2 + 3) % 4 };
}

// web/multiplayer.mjs
var STORAGE = "h-mahjong-room-v1";
var API_ORIGIN = ["127.0.0.1", "localhost"].includes(globalThis.location?.hostname) ? "http://127.0.0.1:8790" : "https://wellness-mahjong-h-lab.chayhyeon.chatgpt.site";
var key2 = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
var canStartWithAI = (snapshot) => !!(snapshot?.host && !snapshot.state && snapshot.members?.length >= 1 && snapshot.members.length < 4);
var roomMemberName = (member) => member?.kind === "ai" ? `AI \xB7 ${member.policy ?? "E"}` : member?.name ?? "\uD50C\uB808\uC774\uC5B4";
var RoomClient = class {
  constructor({ onState, onStatus }) {
    this.onState = onState;
    this.onStatus = onStatus;
    this.session = null;
    this.snapshot = null;
    this.timer = null;
    this.generation = 0;
    this.connected = false;
    this.failures = 0;
    this.startingAI = null;
  }
  saved() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE));
    } catch {
      return null;
    }
  }
  remember() {
    try {
      sessionStorage.setItem(STORAGE, JSON.stringify(this.session));
    } catch {
    }
  }
  stop() {
    this.generation++;
    clearTimeout(this.timer);
    this.timer = null;
    this.connected = false;
  }
  async request(path, body, session = this.session) {
    const headers = { Authorization: "Bearer " + session.key };
    if (body !== void 0) headers["Content-Type"] = "application/json";
    let response;
    try {
      response = await fetch(API_ORIGIN + "/api/" + path, { method: body === void 0 ? "GET" : "POST", headers, body: body === void 0 ? void 0 : JSON.stringify(body), signal: AbortSignal.timeout(1e4) });
    } catch {
      throw new Error("\uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.");
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("\uB300\uAD6D \uC11C\uBC84\uB97C \uC900\uBE44 \uC911\uC785\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.");
    }
    if (!response.ok) {
      const error = new Error(data.error ?? "\uC694\uCCAD\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      error.status = response.status;
      throw error;
    }
    return data;
  }
  accept(data) {
    if (this.snapshot?.code === data.code && data.revision < this.snapshot.revision) return;
    const changed = !this.connected || !this.snapshot || this.snapshot.code !== data.code || this.snapshot.revision !== data.revision;
    this.snapshot = data;
    this.connected = true;
    this.failures = 0;
    this.onStatus("\uC5F0\uACB0\uB428");
    if (changed) this.onState(data);
  }
  async connect(name, code, variant = "H", format2 = variant === "S" ? "hanchan" : "single") {
    this.stop();
    const generation = this.generation;
    const saved = this.saved();
    this.session = { key: saved?.key ?? key2(), name, code: code ?? null };
    this.snapshot = null;
    this.onStatus("\uBC29\uC5D0 \uC5F0\uACB0 \uC911\u2026");
    const data = await this.request(code ? `rooms/${code}/join` : "rooms", { name, ...code ? {} : { variant, format: format2 } });
    if (generation !== this.generation) return;
    this.session.code = data.code;
    this.remember();
    this.accept(data);
    this.poll(generation);
    return data;
  }
  async resume() {
    const saved = this.saved();
    if (!saved?.code || !saved?.key) return false;
    this.stop();
    this.session = saved;
    this.snapshot = null;
    const generation = this.generation;
    const data = await this.request(`rooms/${saved.code}/state`);
    if (generation !== this.generation) return false;
    this.accept(data);
    this.poll(generation);
    return true;
  }
  poll(generation = this.generation) {
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      if (generation !== this.generation) return;
      try {
        const data = await this.request(`rooms/${this.session.code}/state`);
        if (generation !== this.generation) return;
        this.accept(data);
      } catch (error) {
        if (generation !== this.generation) return;
        this.connected = false;
        this.failures++;
        this.onStatus(error.status === 404 ? "\uBC29\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uC0C8 \uBC29\uC744 \uB9CC\uB4E4\uC5B4 \uC8FC\uC138\uC694." : "\uC5F0\uACB0 \uBCF5\uAD6C \uC911\u2026 \uB0B4 \uC120\uD0DD\uC740 \uC5F0\uACB0 \uD6C4 \uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
        if ([401, 403, 404].includes(error.status)) return;
      }
      this.poll(generation);
    }, this.failures ? Math.min(8e3, 1e3 * 2 ** this.failures) : 350);
  }
  async act(action) {
    if (!this.connected || !this.snapshot?.state) throw new Error("\uC11C\uBC84 \uC5F0\uACB0\uC744 \uAE30\uB2E4\uB824 \uC8FC\uC138\uC694.");
    const generation = this.generation, body = { decisionId: this.snapshot.decisionId, actionId: crypto.randomUUID(), action };
    try {
      const data = await this.request(`rooms/${this.session.code}/action`, body);
      if (generation === this.generation) this.accept(data);
      return data;
    } catch (error) {
      if (generation === this.generation) {
        try {
          this.accept(await this.request(`rooms/${this.session.code}/state`));
        } catch {
          this.connected = false;
        }
      }
      throw error;
    }
  }
  async rematch() {
    const generation = this.generation, data = await this.request(`rooms/${this.session.code}/rematch`, { gameNumber: this.snapshot.gameNumber });
    if (generation === this.generation) this.accept(data);
  }
  async startAI() {
    if (this.startingAI?.generation === this.generation) return this.startingAI.promise;
    if (!this.connected) throw new Error("\uC11C\uBC84 \uC5F0\uACB0\uC744 \uAE30\uB2E4\uB824 \uC8FC\uC138\uC694.");
    if (!canStartWithAI(this.snapshot)) throw new Error("\uBC29\uC7A5\uB9CC \uB300\uAE30 \uC911\uC778 \uBC29\uC758 \uBE48\uC790\uB9AC\uB97C AI\uB85C \uCC44\uC6B8 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
    const generation = this.generation, session = { ...this.session }, gameNumber = this.snapshot.gameNumber;
    const promise = (async () => {
      try {
        const data = await this.request(`rooms/${session.code}/start-ai`, { gameNumber }, session);
        if (generation === this.generation) this.accept(data);
        return data;
      } catch (error) {
        if (generation === this.generation) {
          try {
            const data = await this.request(`rooms/${session.code}/state`, void 0, session);
            if (generation === this.generation) {
              this.accept(data);
              if (data.state && data.gameNumber > gameNumber) return data;
            }
          } catch {
            if (generation === this.generation) this.connected = false;
          }
        }
        throw error;
      } finally {
        if (this.startingAI?.generation === generation) this.startingAI = null;
      }
    })();
    this.startingAI = { generation, promise };
    return promise;
  }
};

// web/meld-view.mjs
var SOURCES = { 1: "right", 2: "across", 3: "left" };
var MELD_SOURCE_LABELS = { left: "\uC67C\uCABD", across: "\uB9DE\uC740\uD3B8", right: "\uC624\uB978\uCABD" };
function meldDisplay(meld, seat, players = [], { variant = "H", concealedKanPrivate = false, viewerSeat, revealed = false } = {}) {
  const ids = [...meld.ids];
  if (!meld.open && meld.type === "kan" && (concealedKanPrivate === true || meld.hidden === true)) {
    const canReveal = viewerSeat === seat && !meld.hidden && ids.length === 4 && ids.every(Number.isInteger);
    const show = canReveal && revealed === true;
    return {
      source: null,
      calledId: null,
      addedId: null,
      private: true,
      canReveal,
      revealed: show,
      // Do not retain types or physical IDs in the covered view, even in solo play.
      slots: Array.from({ length: 4 }, (_, i) => ({
        id: show ? ids[i] : null,
        tile: show ? typeOf(ids[i]) : null,
        called: false,
        added: null,
        faceDown: !show
      }))
    };
  }
  if (!meld.open) return {
    source: null,
    calledId: null,
    addedId: null,
    // S uses the conventional two-backed-tile marker; the two middle faces
    // still disclose the tile type. H's source does not specify this marker.
    slots: ids.map((id, index) => ({
      id,
      tile: typeOf(id),
      called: false,
      added: null,
      faceDown: variant === "S" && meld.type === "kan" && (index === 0 || index === ids.length - 1)
    }))
  };
  const source = SOURCES[(meld.from - seat + 4) % 4] ?? null;
  const river = players[meld.from]?.river ?? [];
  const calledId = river.find((discard) => discard.claimed && ids.includes(discard.id))?.id ?? meld.calledId ?? ids.at(-1);
  const addedId = meld.type === "kan" && ids.length === 4 && ids.indexOf(calledId) === 2 ? ids[3] : null;
  const others = ids.filter((id) => id !== calledId && id !== addedId).sort((a, b) => typeOf(a) - typeOf(b) || a - b);
  const slots = others.map((id) => ({ id, tile: typeOf(id), called: false, added: null }));
  const calledIndex = source === "left" ? 0 : source === "across" ? 1 : slots.length;
  slots.splice(calledIndex, 0, {
    id: calledId,
    tile: typeOf(calledId),
    called: true,
    added: addedId === null ? null : { id: addedId, tile: typeOf(addedId) }
  });
  return { source, calledId, addedId, slots };
}
function node(tag, text, cls) {
  const el = document.createElement(tag);
  if (text !== void 0) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function meldText(meld) {
  return `${meld.type === "kan" ? meld.open ? "\uBA85\uAE61" : "\uC548\uAE61" : meld.type === "pon" ? "\uD401" : "\uCE58"} ${meld.type === "chi" ? [meld.tile, meld.tile + 1, meld.tile + 2].map(tileName).join(" ") : tileName(meld.tile)}`;
}
function renderMeldElement(meld, seat, players, options = {}) {
  const display = meldDisplay(meld, seat, players, options);
  const el = node(display.canReveal ? "button" : "div", void 0, "meld" + (display.canReveal ? " meld-peek" : ""));
  const source = display.source ? `${MELD_SOURCE_LABELS[display.source]}\uC5D0\uC11C \uAC00\uC838\uC628 ${tileName(typeOf(display.calledId))}` : "";
  const label2 = display.private ? display.revealed ? `${meldText(meld)} \xB7 1.5\uCD08 \uB4A4 \uB2E4\uC2DC \uB4A4\uC9D1\uD799\uB2C8\uB2E4. \uB2E4\uC2DC \uB204\uB974\uBA74 \uBC14\uB85C \uAC00\uB9BD\uB2C8\uB2E4.` : display.canReveal ? "\uC548\uAE61 \xB7 \uB20C\uB7EC\uC11C \uC7A0\uAE50 \uD655\uC778" : "\uC548\uAE61 \xB7 \uBE44\uACF5\uAC1C" : [
    meldText(meld),
    meld.type === "kan" && !meld.open ? "\uD328 \uC885\uB958 \uACF5\uAC1C" : "",
    source,
    display.addedId !== null ? "\uAC00\uAE61\uC740 \uAC00\uC838\uC628 \uD328 \uC704\uC5D0 \uACB9\uCCD0 \uD45C\uC2DC" : ""
  ].filter(Boolean).join(" \xB7 ");
  if (display.canReveal) {
    el.type = "button";
    el.dataset.meldKey = options.key;
    el.setAttribute("aria-pressed", String(display.revealed));
    el.onclick = options.onToggle;
  }
  el.setAttribute("aria-label", label2);
  el.title = label2;
  el.append(node("span", display.canReveal ? display.revealed ? "\uC548\uAE61 \xB7 \uD655\uC778 \uC911" : "\uC548\uAE61 \xB7 \uD130\uCE58 \uD655\uC778" : meld.type === "kan" ? meld.open ? "\uAE61" : "\uC548\uAE61" : meld.type === "pon" ? "\uD401" : "\uCE58", "meld-label"));
  for (const slot of display.slots) {
    const group = node("span", void 0, "meld-slot" + (slot.called ? " is-called" : "") + (slot.added ? " is-added-kan" : ""));
    const add = (tile, extra = false) => {
      const wrap = node("span", void 0, "meld-tile" + (slot.called ? " sideways" : ""));
      if (tile.id !== null) wrap.dataset.tileId = String(tile.id);
      wrap.setAttribute("aria-label", tile.faceDown ? "\uC548\uAE61 \uB4B7\uBA74" : `${tileName(tile.tile)}${extra ? " \xB7 \uAC00\uAE61\uC73C\uB85C \uB354\uD55C \uD328" : slot.called ? " \xB7 " + source : ""}`);
      if (tile.faceDown) {
        const back = node("span", void 0, "tile-back meld-back");
        back.setAttribute("role", "img");
        back.setAttribute("aria-label", "\uC548\uAE61 \uB4B7\uBA74");
        wrap.append(back);
      } else wrap.append(tileFace(tile.tile, { small: true }));
      group.append(wrap);
    };
    add(slot);
    if (slot.added) add(slot.added, true);
    el.append(group);
  }
  return el;
}

// web/kan-peek.mjs
function createKanPeek({
  durationMs = 1500,
  now = () => Date.now(),
  setTimeout: schedule2 = globalThis.setTimeout,
  clearTimeout: cancel = globalThis.clearTimeout,
  onChange = () => {
  }
} = {}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new RangeError("\uD655\uC778 \uC2DC\uAC04\uC740 \uC591\uC218\uC5EC\uC57C \uD569\uB2C8\uB2E4.");
  let context2 = null, activeKey = null, deadline = 0, timer2 = null, generation = 0;
  const clear = ({ notify = true } = {}) => {
    const changed = activeKey !== null;
    if (timer2 !== null) cancel(timer2);
    timer2 = null;
    activeKey = null;
    deadline = 0;
    generation++;
    if (changed && notify) onChange();
    return changed;
  };
  const isRevealed = (key3) => activeKey === key3 && now() < deadline;
  const reveal = (key3) => {
    if (typeof key3 !== "string" || !key3) throw new TypeError("\uC548\uAE61 \uD655\uC778 \uC704\uCE58\uAC00 \uD544\uC694\uD569\uB2C8\uB2E4.");
    clear({ notify: false });
    activeKey = key3;
    deadline = now() + durationMs;
    const current = generation;
    const expire = () => {
      if (current !== generation) return;
      const remaining = deadline - now();
      if (remaining > 0) timer2 = schedule2(expire, remaining);
      else clear();
    };
    timer2 = schedule2(expire, durationMs);
    onChange();
  };
  const setContext = (value2) => {
    if (value2 === context2) return false;
    context2 = value2;
    clear({ notify: false });
    return true;
  };
  return { setContext, reveal, isRevealed, clear };
}

// web/score-display.mjs
var signedPoints = (value2) => `${value2 > 0 ? "+" : ""}${value2}`;
function hBonusDetails(score, rules = {}) {
  const names = { kan: rules.fourOfAKindBonus ? "\uC0AC\uADC0\uC77C" : "\uAE61", dragon: "\uC0BC\uC6D0\uD328", roundWind: "\uC7A5\uD48D", seatWind: "\uC790\uD48D" };
  return Object.entries(names).filter(([key3]) => Number.isFinite(score.bonuses?.[key3]) && score.bonuses[key3] > 0).map(([key3, label2]) => `${label2} ${score.bonuses[key3]}\uC810`).join(" \xB7 ");
}
function scoreBreakdown(score) {
  if (score?.variant !== "S") return null;
  const yaku = (score.yakuEntries ?? []).map((e) => ({ ...e })), bonuses = score.yakuman ? [] : (score.bonuses ?? []).map((e) => ({ ...e }));
  const yakuHan = score.hanYaku ?? yaku.reduce((n, e) => n + e.han, 0), bonusHan = score.bonusHan ?? bonuses.reduce((n, e) => n + e.han, 0);
  return {
    yaku,
    bonuses,
    yakuHan,
    bonusHan,
    totalHan: score.yakuman ? null : score.han,
    yakuman: score.yakuman,
    summary: score.yakuman ? "\uC5ED\uB9CC" : `\uC5ED ${yakuHan}\uD310 + \uAC00\uC0B0 ${bonusHan}\uD310 = \uCD1D ${score.han}\uD310`
  };
}
function scoreBreakdownText(score) {
  const detail = scoreBreakdown(score);
  if (!detail) return "";
  return detail.yakuman ? `${detail.yaku.map((e) => e.name).join(" \xB7 ")} \xB7 \uC5ED\uB9CC` : `${[...detail.yaku, ...detail.bonuses].map((e) => `${e.name} ${e.han}\uD310`).join(" + ")} = \uCD1D ${detail.totalHan}\uD310`;
}
function doraDisplay(state2, seat) {
  if (state2.rules.variant !== "S") return null;
  const player = state2.players[seat], visible = state2.doraIndicators ?? (Array.isArray(state2.dead) ? indicators(state2) : []);
  const ura = state2.uraIndicators ?? (Array.isArray(state2.dead) ? revealedUraIndicators(state2) : []);
  const c = counts([...player.hand, ...player.melds.flatMap((m) => m.ids)].map(typeOf));
  const pairs = (values) => values.map((indicator) => ({ indicator, dora: doraAfter(indicator) }));
  const bonus = (id) => player.win?.score.bonuses?.find((e) => e.id === id)?.han ?? 0;
  return {
    visible: pairs(visible),
    ura: pairs(ura),
    count: player.won ? bonus("dora") : visible.reduce((n, t) => n + c[doraAfter(t)], 0),
    uraCount: ura.length && player.won ? bonus("ura") : null
  };
}
function winSettlement(state2, seat) {
  const player = state2.players[seat], win3 = player.win;
  if (!win3) return null;
  const { score } = win3;
  if (state2.rules.variant === "S") {
    const payments = Array.isArray(state2.ledger) ? state2.ledger.filter((p) => p.to === seat && ["tsumo", "ron", "pot"].includes(p.kind)) : win3.payments ?? [];
    const receipt2 = payments.reduce((n, p) => n + p.amount, 0), seats2 = Array.from({ length: 4 }, (_, i) => ["\uB3D9", "\uB0A8", "\uC11C", "\uBD81"][(i - state2.dealer + 4) % 4]);
    return {
      payerCount: payments.filter((p) => p.from !== "pot").length,
      receipt: receipt2,
      expectedReceipt: win3.receipt,
      net: player.score,
      previousNet: player.score - receipt2,
      breakdown: scoreBreakdown(score),
      hanDetails: scoreBreakdownText(score),
      title: `${score.name} ${win3.method === "tsumo" ? "\uCBD4\uBAA8" : "\uB860"} \xB7 \uC774\uBC88 \uD654\uB8CC +${receipt2}\uC810`,
      calculation: `${score.yakuman ? "\uC5ED\uB9CC" : score.han + "\uD310"} \xB7 ${payments.map((p) => `${seats2[p.from] ?? "\uACF5\uD0C1"} ${p.amount}`).join(" + ")} = +${receipt2}\uC810`
    };
  }
  const payerCount = win3.method === "tsumo" ? state2.players.length - win3.order : 1;
  const tsumoBonus = win3.method === "tsumo" ? state2.rules.tsumoBonusPerPayer : 0;
  const perPayer = score.total + tsumoBonus, expectedReceipt = perPayer * payerCount;
  const receipt = Array.isArray(state2.ledger) ? state2.ledger.filter((payment) => payment.to === seat && payment.kind === win3.method).reduce((sum3, payment) => sum3 + payment.amount, 0) : expectedReceipt;
  const parts = [`\uC5ED ${score.base}`];
  if (score.bonus) parts.push(`\uAC00\uC0B0 ${score.bonus}`);
  if (win3.method === "tsumo") parts.push(`\uCBD4\uBAA8 ${tsumoBonus}`);
  return {
    payerCount,
    perPayer,
    receipt,
    expectedReceipt,
    bonusDetails: hBonusDetails(score, state2.rules),
    net: player.score,
    previousNet: player.score - receipt,
    title: `${score.name} ${win3.method === "tsumo" ? "\uCBD4\uBAA8" : "\uB860"} \xB7 \uC774\uBC88 \uD654\uB8CC +${receipt}\uC810`,
    calculation: `(${parts.join(" + ")}) \xD7 ${payerCount}\uBA85 = +${expectedReceipt}\uC810${receipt !== expectedReceipt ? ` \xB7 \uC2E4\uC81C \uC774\uCCB4 +${receipt}\uC810 (\uC815\uC0B0 \uD655\uC778 \uD544\uC694)` : ""}`
  };
}

// web/game-log.mjs
var LOG_FORMAT = "h-mahjong-log/v1";
var COMPACT_FORMAT = "wellness-mahjong-log/v2";
var PREFIX = "h-mahjong-log-v1:";
var INDEX = PREFIX + "index";
var MAX_LOGS = 10;
var MAX_CHARS = 15e5;
var clone = (value2) => structuredClone(value2);
var scores = (game) => game.players.map((player) => player.score);
var seats = ["\uB3D9", "\uB0A8", "\uC11C", "\uBD81"];
var seatLabels = (game) => seats.map((_, i) => seats[(i - (game.dealer ?? 0) + 4) % 4]);
var concealedForViewer = (game, seat, viewer) => game.rules.concealedKanPrivate === true && seat !== viewer;
var signed2 = (value2) => `${value2 > 0 ? "+" : ""}${value2}`;
function beforeAction(game) {
  return { scores: scores(game), active: game.players.flatMap((p, i) => p.won ? [] : [i]), events: game.events.length, ledger: game.ledger.length, pot: game.pot ?? 0 };
}
function actionRecord(game, seat, action, before, error = null) {
  const seats2 = seatLabels(game);
  const after = scores(game), payments = clone(game.ledger.slice(before.ledger)), issues = [];
  const delta = after.map((value2, i) => value2 - before.scores[i]), ledgerDelta = [0, 0, 0, 0];
  for (const payment of payments) {
    if (Number.isInteger(payment.from)) ledgerDelta[payment.from] -= payment.amount;
    if (Number.isInteger(payment.to)) ledgerDelta[payment.to] += payment.amount;
  }
  if (delta.some((value2, i) => value2 !== ledgerDelta[i])) issues.push("\uC810\uC218 \uBCC0\uD654\uC640 \uC2E4\uC81C \uC774\uCCB4 \uB0B4\uC5ED\uC774 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  const wins = game.events.slice(before.events).filter((e) => e.type === "win").map((win3) => {
    if (game.rules.variant === "S") {
      const actual2 = payments.filter((p) => p.to === win3.seat), actualReceipt2 = actual2.reduce((n, p) => n + p.amount, 0), expected = [], pao = win3.score.yakuman ? game.players[win3.seat].pao : null;
      if (pao !== null && pao !== void 0) {
        if (win3.method === "tsumo" || win3.source === pao) expected.push({ from: pao, amount: win3.score.total });
        else expected.push({ from: pao, amount: win3.score.total / 2 }, { from: win3.source, amount: win3.score.total / 2 });
      } else if (win3.method === "ron") expected.push({ from: win3.source, amount: win3.score.points.ron });
      else for (let from = 0; from < 4; from++) if (from !== win3.seat) expected.push({ from, amount: from === game.dealer ? win3.score.points.tsumoDealer : win3.score.points.tsumoOther });
      if (before.pot) expected.push({ from: "pot", amount: before.pot });
      const expectedReceipt2 = expected.reduce((n, p) => n + p.amount, 0), problems2 = [];
      if (actual2.length !== expected.length || expected.some((e) => actual2.filter((p) => p.from === e.from && p.amount === e.amount).length !== 1) || actualReceipt2 !== delta[win3.seat]) problems2.push("S\uB8F0 \uC9C0\uAE09\uC790 \uB610\uB294 \uC9C0\uAE09\uC561\uC774 \uC801\uC6A9 \uADDC\uCE59\uACFC \uB2E4\uB985\uB2C8\uB2E4.");
      issues.push(...problems2.map((text) => `${seats2[win3.seat]}: ${text}`));
      return { seat: win3.seat, method: win3.method, order: win3.order, score: clone(win3.score), payers: expected.map((p) => p.from), expectedReceipt: expectedReceipt2, actualReceipt: actualReceipt2, scoreBefore: before.scores[win3.seat], scoreAfter: after[win3.seat], payments: actual2, issues: problems2 };
    }
    const payers = win3.method === "tsumo" ? before.active.filter((i) => i !== win3.seat) : [win3.source];
    const actual = payments.filter((p) => p.to === win3.seat && p.kind === win3.method);
    const tsumoBonus = win3.method === "tsumo" ? game.rules.tsumoBonusPerPayer : 0;
    const perPayer = win3.score.total + tsumoBonus, expectedReceipt = perPayer * payers.length, actualReceipt = actual.reduce((sum3, p) => sum3 + p.amount, 0);
    const problems = [];
    if (actual.length !== payers.length || payers.some((i) => actual.filter((p) => p.from === i && p.amount === perPayer).length !== 1)) problems.push("\uC9C0\uAE09\uC790 \uB610\uB294 \uC9C0\uAE09\uC561\uC774 \uC801\uC6A9 \uADDC\uCE59\uACFC \uB2E4\uB985\uB2C8\uB2E4.");
    if (win3.score.yaku === "pinfu" || win3.score.name === "\uD551\uD6C4") {
      const player = game.players[win3.seat], tiles2 = [...player.hand, ...player.melds.flatMap((m) => m.ids), ...win3.method === "ron" ? [win3.tile] : []].map(typeOf);
      const expectedBonus = game.rules.fourOfAKindBonus ? counts(tiles2).filter((n) => n === 4).length * game.rules.kanBonus : 0;
      if (win3.score.base !== 100 || win3.score.bonus !== expectedBonus || win3.score.total !== 100 + expectedBonus) problems.push("\uD551\uD6C4 \uC5ED \uC810\uC218 \uB610\uB294 \uC0AC\uADC0\uC77C \uAC00\uC0B0\uC810\uC774 \uC798\uBABB\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    }
    if (actualReceipt !== expectedReceipt || delta[win3.seat] !== actualReceipt) problems.push("\uD654\uB8CC \uC218\uC785\uACFC \uC810\uC218 \uBCC0\uD654\uAC00 \uB2E4\uB985\uB2C8\uB2E4.");
    issues.push(...problems.map((text) => `${seats2[win3.seat]}: ${text}`));
    return { seat: win3.seat, method: win3.method, order: win3.order, score: clone(win3.score), tsumoBonus, payers, perPayer, expectedReceipt, actualReceipt, scoreBefore: before.scores[win3.seat], scoreAfter: after[win3.seat], payments: actual, issues: problems };
  });
  const draws = game.events.slice(before.events).filter((e) => e.type === "draw" || e.type === "kanDraw").map(({ type, seat: seat2, id }) => ({ type, seat: seat2, id }));
  return { seat, action: clone(action), before: before.scores, after, delta, payments, wins, draws, issues, eventRange: [before.events, game.events.length], ...error ? { error: String(error.message ?? error) } : {} };
}
var GameJournal = class {
  constructor({ storage = null, now = () => (/* @__PURE__ */ new Date()).toISOString(), newId = () => crypto.randomUUID() } = {}) {
    this.storage = storage;
    this.now = now;
    this.newId = newId;
    this.current = null;
    this.persisted = false;
  }
  begin(game, { mode = "practice", seat = 0, policy = null, profile = null, room = null, gameNumber = null, build = null } = {}) {
    this.current = {
      format: LOG_FORMAT,
      id: this.newId(),
      startedAt: this.now(),
      updatedAt: this.now(),
      mode,
      humanSeat: seat,
      policy,
      profile,
      room,
      gameNumber,
      build,
      initialGame: clone(game),
      actions: [],
      observations: [],
      errors: [],
      game: clone(game)
    };
    this.save(game);
    return this.current;
  }
  record(game, seat, action, before, error = null) {
    if (!this.current || this.current.mode !== "practice") return;
    this.current.actions.push({ n: this.current.actions.length, at: this.now(), ...actionRecord(game, seat, action, before, error) });
  }
  observe(game, revision) {
    if (!this.current || this.current.mode !== "online") return;
    if (this.current.observations.at(-1)?.revision === revision) return;
    const before = scores(this.current.game), after = scores(game);
    this.current.observations.push({ revision, at: this.now(), before, after, delta: after.map((score, i) => score - before[i]), events: clone(game.events) });
    this.save(game);
  }
  error(game, error) {
    if (!this.current) return;
    this.current.errors.push({ at: this.now(), message: String(error.message ?? error) });
    this.save(game);
  }
  index() {
    try {
      const value2 = JSON.parse(this.storage?.getItem(INDEX) ?? "[]");
      return Array.isArray(value2) ? value2.filter((x) => x && typeof x.id === "string" && typeof x.updatedAt === "string" && Number.isSafeInteger(x.chars) && x.chars >= 0) : [];
    } catch {
      return [];
    }
  }
  summary() {
    const log = this.current;
    if (!log) return null;
    return { id: log.id, startedAt: log.startedAt, updatedAt: log.updatedAt, mode: log.mode, seed: log.game.seed ?? null, seat: log.humanSeat, seatName: seatLabels(log.game)[log.humanSeat], status: log.game.end ?? "in-progress", score: log.game.players[log.humanSeat].score, actions: log.actions.length, issues: log.actions.reduce((n, a) => n + a.issues.length, 0) + log.errors.length };
  }
  list() {
    const all = this.index().filter((x) => x.id !== this.current?.id);
    return this.current ? [this.summary(), ...all] : all;
  }
  read(id = this.current?.id) {
    if (id === this.current?.id) return clone(this.current);
    try {
      const log = expandLog(JSON.parse(this.storage?.getItem(PREFIX + id) ?? "null"));
      return log?.format === LOG_FORMAT && log.id === id ? log : null;
    } catch {
      return null;
    }
  }
  save(game) {
    if (!this.current) return false;
    this.current.game = clone(game);
    this.current.updatedAt = this.now();
    this.persisted = false;
    if (!this.storage) return false;
    const text = JSON.stringify(compactLog(this.current)), summary = { ...this.summary(), chars: text.length };
    if (text.length > MAX_CHARS) return false;
    const previous = this.index().filter((x) => x.id !== summary.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const keep = [summary], remove2 = [];
    let size = text.length;
    for (const entry of previous) {
      if (keep.length < MAX_LOGS && size + (entry.chars ?? 0) <= MAX_CHARS) {
        keep.push(entry);
        size += entry.chars ?? 0;
      } else remove2.push(entry);
    }
    try {
      this.storage.setItem(PREFIX + summary.id, text);
      this.storage.setItem(INDEX, JSON.stringify(keep));
      for (const entry of remove2) this.storage.removeItem(PREFIX + entry.id);
      this.persisted = true;
    } catch {
      return false;
    }
    return true;
  }
};
function logText(log) {
  log = expandLog(log);
  const game = log.game, seats2 = seatLabels(game), variant = game.rules.variant === "S" ? "S" : "H", lines = [
    `${variant}\uB8F0 \uB9C8\uC791 \uB300\uAD6D \uB85C\uADF8`,
    `${log.startedAt} \xB7 ${log.mode === "practice" ? "\uD63C\uC790 \uC5F0\uC2B5" : "4\uC778 \uB300\uAD6D"} \xB7 \uB0B4 \uC790\uB9AC ${seats2[log.humanSeat]}`,
    `\uBC30\uD328 \uBC88\uD638: ${game.seed ?? "\uC11C\uBC84 \uBE44\uACF5\uAC1C"} \xB7 \uD654\uBA74 \uBC84\uC804: ${log.build ?? "\uBBF8\uAE30\uB85D"}`,
    `${variant === "S" || game.startingScores || game.startingScores || game.matchContext ? "\uC774\uBC88 \uAD6D \uC99D\uAC10" : "\uCD5C\uC885 \uC810\uC218"}: ${scores(game).map((score, i) => `${seats2[i]} ${signed2(score)}`).join(" / ")}`,
    ""
  ];
  if (game.startingScores) lines.push(`\uB204\uC801 \uC810\uC218 (\uC885\uB8CC \uACF5\uD0C1 \uBCC4\uB3C4): ${game.startingScores.map((n, i) => seats2[i] + " " + (n + game.players[i].score)).join(" / ")}`, "");
  for (const entry of log.actions) {
    const action = entry.action, tile = action.type === "ankan" && concealedForViewer(game, entry.seat, log.humanSeat) ? " (\uBE44\uACF5\uAC1C)" : Number.isInteger(action.tile) ? ` ${tileName(action.tile)}` : "";
    if (action.type !== "pass") lines.push(`#${entry.n + 1} ${seats2[entry.seat]} ${{ discard: "\uBC84\uB9BC", riichi: "\uB9AC\uCE58\xB7\uBC84\uB9BC", tsumo: "\uCBD4\uBAA8", ron: "\uB860", chi: "\uCE58", pon: "\uD401", ankan: "\uC548\uAE61", minkan: "\uBA85\uAE61", kakan: "\uAC00\uAE61" }[action.type] ?? action.type}${tile}`);
    for (const win3 of entry.wins) {
      const detail = variant === "S" ? scoreBreakdownText(win3.score) : `\uC5ED ${win3.score.base}${win3.score.bonus ? " + " + (hBonusDetails(win3.score, game.rules) || "\uAC00\uC0B0 " + win3.score.bonus) : ""}${win3.tsumoBonus ? " + \uCBD4\uBAA8 " + win3.tsumoBonus : ""}`;
      lines.push(variant === "S" ? `  ${seats2[win3.seat]} ${detail}` : `  ${seats2[win3.seat]} ${win3.score.name} (${detail})`);
      if (win3.issues.length) lines.push(`  \uADDC\uCE59\uC0C1 ${win3.expectedReceipt}, \uC2E4\uC81C \uC218\uC785 ${win3.actualReceipt}`);
    }
    for (const payment of entry.payments) lines.push(`  ${seats2[payment.from] ?? "\uACF5\uD0C1"} \u2192 ${seats2[payment.to] ?? "\uACF5\uD0C1"}: ${payment.amount}\uC810`);
    for (const draw3 of entry.draws) lines.push(`  ${seats2[draw3.seat]} ${draw3.type === "kanDraw" ? "\uBCF4\uCDA9\uD328" : "\uBF51\uC740 \uD328"}: ${tileName(typeOf(draw3.id))}`);
    for (const issue of entry.issues) lines.push(`  [\uC815\uC0B0 \uD655\uC778 \uD544\uC694] ${issue}`);
    if (entry.error) lines.push(`  [\uC2E4\uD589 \uC624\uB958] ${entry.error}`);
  }
  for (const entry of log.observations) if (entry.delta.some(Boolean)) lines.push(`\uC218\uC2E0 ${entry.revision} \uC810\uC218 \uBCC0\uB3D9: ${entry.delta.map((v, i) => v ? seats2[i] + " " + signed2(v) : "").filter(Boolean).join(" / ")}`);
  if (log.mode === "online" && variant === "S") for (const seat of game.winners) lines.push(`${seats2[seat]} ${scoreBreakdownText(game.players[seat].win.score)}`);
  lines.push("", "\uD604\uC7AC \uC190\uD328\xB7\uD6C4\uB85C (JSON\uC5D0\uB294 \uC6D0\uBCF8 \uD328 \uBC88\uD638\uC640 \uC0C1\uC138 \uAE30\uB85D \uD3EC\uD568)");
  for (let seat = 0; seat < 4; seat++) {
    const p = game.players[seat];
    lines.push(`${seats2[seat]}: ${p.hand.map((id) => tileName(typeOf(id))).join(" ")} / ${p.melds.map((m) => m.hidden || m.ids.some((id) => !Number.isInteger(id)) || m.type === "kan" && !m.open && concealedForViewer(game, seat, log.humanSeat) ? "\uC548\uAE61 (\uBE44\uACF5\uAC1C)" : `${m.type} ${m.ids.map((id) => tileName(typeOf(id))).join(" ")}`).join(" / ")}`);
  }
  for (const error of log.errors) lines.push(`[\uC624\uB958 ${error.at}] ${error.message}`);
  return lines.join("\n") + "\n";
}
function reviewText(input) {
  const log = expandLog(input), game = log.game, seats2 = seatLabels(game), s = game.rules.variant === "S", lines = [`${s ? "S" : "H"}\uB8F0 \xB7 ${game.seed ?? log.room}`, `${s || game.startingScores || game.matchContext ? "\uC774\uBC88 \uAD6D \uC99D\uAC10" : "\uCD5C\uC885"}: ${game.players.map((p, i) => seats2[i] + " " + signed2(p.score)).join(" / ")}`];
  for (const e of log.actions) {
    if (["ankan", "minkan", "kakan"].includes(e.action.type)) lines.push(`${seats2[e.seat]} ${e.action.type === "ankan" ? "\uC548\uAE61" : e.action.type === "minkan" ? "\uBA85\uAE61" : "\uAC00\uAE61"}${e.action.type === "ankan" && concealedForViewer(game, e.seat, log.humanSeat) ? " \xB7 \uBE44\uACF5\uAC1C" : Number.isInteger(e.action.tile) ? " \xB7 " + tileName(e.action.tile) : ""} (\uC774\uB54C\uB294 \uC810\uC218 \uC774\uB3D9 \uC5C6\uC74C)`);
    for (const win3 of e.wins) {
      const extra = Object.entries(win3.score.bonuses ?? {}).filter(([, value2]) => typeof value2 === "number" && value2).map(([name, value2]) => `${{ kan: game.rules.fourOfAKindBonus ? "\uC0AC\uADC0\uC77C" : "\uAE61", dragon: "\uC0BC\uC6D0\uD328", roundWind: "\uC7A5\uD48D", seatWind: "\uC790\uD48D" }[name] ?? name} ${value2}`);
      lines.push(s ? `${seats2[win3.seat]} ${win3.method === "ron" ? "\uB860" : "\uCBD4\uBAA8"} \xB7 ${scoreBreakdownText(win3.score)}` : `${seats2[win3.seat]} ${win3.score.name} ${win3.method === "ron" ? "\uB860" : "\uCBD4\uBAA8"} \xB7 \uC5ED ${win3.score.base}${extra.length ? " + " + extra.join(" + ") : ""}${win3.tsumoBonus ? " + \uCBD4\uBAA8 " + win3.tsumoBonus + " / \uC9C0\uAE09\uC790" : ""}`);
    }
    for (const p of e.payments) lines.push(`  ${seats2[p.from] ?? "\uACF5\uD0C1"} \u2192 ${seats2[p.to] ?? "\uACF5\uD0C1"}: ${p.amount}\uC810`);
    for (const issue of e.issues) lines.push(`[\uC815\uC0B0 \uD655\uC778 \uD544\uC694] ${issue}`);
  }
  if (log.mode === "online") {
    for (const entry of log.observations) if (entry.delta.some(Boolean)) lines.push(`\uC218\uC2E0 ${entry.revision}: ${entry.delta.map((v, i) => v ? seats2[i] + " " + signed2(v) : "").filter(Boolean).join(" / ")}`);
  }
  if (log.mode === "online" && s) for (const seat of game.winners) {
    const win3 = game.players[seat].win;
    lines.push(`${seats2[seat]} ${win3.method === "ron" ? "\uB860" : "\uCBD4\uBAA8"} \xB7 ${scoreBreakdownText(win3.score)}`);
  }
  return lines.join("\n");
}
function compactLog(input) {
  const log = expandLog(input);
  if (!log || log.format !== LOG_FORMAT) throw new Error("\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uB300\uAD6D \uB85C\uADF8\uC785\uB2C8\uB2E4.");
  const game = clone(log.game), actionEvents = game.events.filter((e) => e.type === "action");
  for (const p of game.players) if (p.win) {
    const win3 = game.events.find((e) => e.type === "win" && e.seat === game.players.indexOf(p));
    if (win3?.order) p.win = { event: win3.n ?? game.events.indexOf(win3) };
  }
  for (const e of game.events) if (e.type === "win" && e.payments) {
    e.paymentIndexes = game.ledger.flatMap((p, i) => p.to === e.seat && ["ron", "tsumo", "pot"].includes(p.kind) ? [i] : []);
    delete e.payments;
  }
  const actions = log.actions.map((a, i) => ({
    seat: a.seat,
    action: a.action,
    at: a.at,
    events: a.eventRange ?? [actionEvents[i]?.n ?? game.events.length, actionEvents[i + 1]?.n ?? game.events.length],
    ...a.delta.some(Boolean) ? { scores: a.after } : {},
    ...a.payments.length ? { transfers: a.payments.length } : {},
    ...a.issues.length ? { issues: a.issues } : {},
    ...a.error ? { error: a.error } : {}
  }));
  const observations = log.observations.map((o) => ({ revision: o.revision, at: o.at, eventCount: o.events.length, ...o.delta.some(Boolean) ? { scores: o.after } : {} }));
  return { ...log, format: COMPACT_FORMAT, actions, observations, game };
}
function expandLog(input) {
  if (!input || input.format !== COMPACT_FORMAT) return input;
  const log = clone(input), game = log.game;
  log.format = LOG_FORMAT;
  for (const e of game.events) if (e.paymentIndexes) {
    e.payments = e.paymentIndexes.map((i) => clone(game.ledger[i]));
    delete e.paymentIndexes;
  }
  for (const p of game.players) if (p.win && Object.hasOwn(p.win, "event")) {
    const event3 = game.events.find((e, i) => (e.n ?? i) === p.win.event);
    if (!event3) throw new Error("\uD654\uB8CC \uAE30\uB85D \uCC38\uC870\uAC00 \uC798\uBABB\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    const { n, type, seat, ...win3 } = event3;
    p.win = clone(win3);
  }
  let previous = scores(log.initialGame), cursor = log.initialGame.ledger?.length ?? 0, active = log.initialGame.players.flatMap((p, i) => p.won ? [] : [i]), pot = log.initialGame.pot ?? 0;
  log.actions = log.actions.map((a, n) => {
    const after = a.scores ?? previous, end2 = cursor + (a.transfers ?? 0), snapshot = { ...game, players: game.players.map((p, i) => ({ ...p, score: after[i] })), events: game.events.slice(0, a.events[1]), ledger: game.ledger.slice(0, end2) };
    const entry = { n, at: a.at, ...actionRecord(snapshot, a.seat, a.action, { scores: previous, active, events: a.events[0], ledger: cursor, pot }, a.error) };
    entry.issues = a.issues ?? entry.issues;
    for (const p of entry.payments) {
      if (p.to === "pot") pot += p.amount;
      if (p.from === "pot") pot -= p.amount;
    }
    for (const w of entry.wins) active = active.filter((i) => i !== w.seat);
    previous = after;
    cursor = end2;
    return entry;
  });
  previous = scores(log.initialGame);
  log.observations = log.observations.map((o) => {
    const after = o.scores ?? previous, entry = { revision: o.revision, at: o.at, before: previous, after, delta: after.map((v, i) => v - previous[i]), events: game.events.slice(0, o.eventCount) };
    previous = after;
    return entry;
  });
  return log;
}

// web/preferences.mjs
var KEY = "wellness-mahjong-preferences-v1";
var defaultMatchFormat = (variant) => variant === "S" ? "hanchan" : "single";
var matchFormatName = (format2) => format2 === "hanchan" ? "\uBC18\uC7A5\uC804" : "\uB2E8\uD310\uC804";
function readPreferences(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? "{}"), variant = saved?.variant === "S" ? "S" : "H";
    return { recommendations: saved?.recommendations !== false, variant, format: ["single", "hanchan"].includes(saved?.format) ? saved.format : defaultMatchFormat(variant) };
  } catch {
    return { recommendations: true, variant: "H", format: "single" };
  }
}
function savePreferences(storage, value2) {
  try {
    const variant = value2.variant === "S" ? "S" : "H", format2 = ["single", "hanchan"].includes(value2.format) ? value2.format : defaultMatchFormat(variant);
    storage?.setItem(KEY, JSON.stringify({ recommendations: !!value2.recommendations, variant, format: format2 }));
    return !!storage;
  } catch {
    return false;
  }
}

// game/h-match.mjs
var h_match_exports = {};
__export(h_match_exports, {
  advanceMatch: () => advanceMatch2,
  assertMatch: () => assertMatch2,
  createMatch: () => createMatch2,
  createMatchGame: () => createMatchGame2,
  matchSummary: () => matchSummary2,
  matchTotals: () => matchTotals2,
  recordRound: () => recordRound2
});

// s-engine/match.mjs
var match_exports = {};
__export(match_exports, {
  MATCH_DEFAULTS: () => MATCH_DEFAULTS,
  advanceMatch: () => advanceMatch,
  assertMatch: () => assertMatch,
  createMatch: () => createMatch,
  createMatchGame: () => createMatchGame,
  matchSummary: () => matchSummary,
  matchTotals: () => matchTotals,
  recordRound: () => recordRound,
  roundLabel: () => roundLabel,
  roundSeed: () => roundSeed
});
var MATCH_DEFAULTS = Object.freeze({ dealerContinuation: "win-or-tenpai", honbaPoints: 0, finalPot: "top", endOnBankrupt: false });
var clone2 = (x) => structuredClone(x);
var sum = (xs) => xs.reduce((a, b) => a + b, 0);
function roundLabel(roundIndex, repeat = 0) {
  return `${roundIndex < 4 ? "\uB3D9" : "\uB0A8"}${roundIndex % 4 + 1}\uAD6D${repeat ? " \xB7 \uC5F0\uC7A5 " + repeat + "\uD68C" : ""}`;
}
function roundSeed(seed, number) {
  if (number === 1) return seed;
  let n = (seed ^ Math.imul(number, 2654435769)) >>> 0;
  n = Math.imul(n ^ n >>> 16, 569420461);
  n = Math.imul(n ^ n >>> 15, 1935289751);
  return (n ^ n >>> 15) >>> 0;
}
function createMatch({ seed = 1, id = crypto.randomUUID(), format: format2 = "hanchan", rules = {}, settings = {}, now = (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295 || typeof id !== "string" || !id) throw new Error("Invalid match seed/id");
  if (!["single", "hanchan"].includes(format2)) throw new Error("\uB2E8\uD310\uC804 \uB610\uB294 \uBC18\uC7A5\uC804\uC744 \uC120\uD0DD\uD558\uC138\uC694.");
  for (const k of Object.keys(settings)) if (!(k in MATCH_DEFAULTS)) throw new Error("Unknown match setting");
  const config = { ...MATCH_DEFAULTS, ...settings };
  if (!["none", "win-or-tenpai"].includes(config.dealerContinuation) || config.honbaPoints !== 0 || config.finalPot !== "top" || config.endOnBankrupt !== false) throw new Error("Unsupported match settings");
  const r = sRules({ ...rules, roundWind: 27 });
  return { version: 1, variant: "S", format: format2, id, seed, startedAt: now, rules: r, settings: config, roundIndex: 0, repeat: 0, handNumber: 1, status: "playing", scores: Array(4).fill(r.startingPoints), pot: 0, rounds: [], next: null, finalTransfers: [] };
}
function createMatchGame(match) {
  if (match.status !== "playing") throw new Error("\uBC18\uC7A5\uC774 \uB2E4\uC74C \uAD6D\uC744 \uC2DC\uC791\uD560 \uC0C1\uD0DC\uAC00 \uC544\uB2D9\uB2C8\uB2E4.");
  const game = createGame2({ seed: roundSeed(match.seed, match.handNumber), rules: { ...match.rules, roundWind: match.roundIndex < 4 ? 27 : 28 }, dealer: match.roundIndex % 4, pot: match.pot, startingScores: match.scores });
  game.matchContext = { id: match.id, handNumber: match.handNumber, roundIndex: match.roundIndex, repeat: match.repeat };
  return game;
}
function recordRound(match, game, { logId = null } = {}) {
  if (game.matchContext?.id !== match.id || game.matchContext.handNumber !== match.handNumber) throw new Error("\uB2E4\uB978 \uBC18\uC7A5 \uB610\uB294 \uAD6D\uC758 \uC815\uC0B0\uC785\uB2C8\uB2E4.");
  if (match.status !== "playing") return false;
  if (!game.end) throw new Error("\uAD6D\uC774 \uB05D\uB09C \uB4A4 \uC815\uC0B0\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
  assertMatch(match, game);
  const delta = game.players.map((p) => p.score);
  match.scores = match.scores.map((n, i) => n + delta[i]);
  match.pot = game.pot;
  const dealerReady = game.events.find((e) => e.type === "drawSettlement")?.ready.some((r) => r.seat === game.dealer) ?? false;
  const retained = match.format !== "single" && match.settings.dealerContinuation === "win-or-tenpai" && (game.winners.includes(game.dealer) || game.end === "exhaustive-draw" && dealerReady);
  match.rounds.push({ handNumber: match.handNumber, roundIndex: match.roundIndex, repeat: match.repeat, label: match.format === "single" ? "\uB2E8\uD310\uC804" : roundLabel(match.roundIndex, match.repeat), dealer: game.dealer, seed: game.seed, result: game.end, winner: game.winners[0] ?? null, delta, totals: [...match.scores], pot: match.pot, retained, logId });
  if (match.format === "single" || match.roundIndex === 7 && !retained) {
    match.status = "complete";
    match.next = null;
    if (match.pot) {
      const top = match.scores.reduce((best, n, i) => n > match.scores[best] ? i : best, 0);
      match.finalTransfers.push({ from: "pot", to: top, amount: match.pot, kind: "final-pot" });
      match.scores[top] += match.pot;
      match.pot = 0;
    }
  } else {
    match.status = "between-rounds";
    match.next = { roundIndex: match.roundIndex + (retained ? 0 : 1), repeat: retained ? match.repeat + 1 : 0 };
  }
  assertMatch(match, game);
  return true;
}
function advanceMatch(match, expectedHandNumber = match.handNumber) {
  if (match.status !== "between-rounds" || !match.next || expectedHandNumber !== match.handNumber) throw new Error("\uD604\uC7AC \uAD6D\uC774 \uB05D\uB09C \uB4A4 \uB2E4\uC74C \uAD6D\uC73C\uB85C \uC9C4\uD589\uD558\uC138\uC694.");
  match.roundIndex = match.next.roundIndex;
  match.repeat = match.next.repeat;
  match.handNumber++;
  match.next = null;
  match.status = "playing";
  return createMatchGame(match);
}
function matchTotals(match, game) {
  return match.status === "playing" ? match.scores.map((n, i) => n + game.players[i].score) : [...match.scores];
}
function matchSummary(match, game) {
  const totals = matchTotals(match, game), rankings = totals.map((points, seat) => ({ seat, points, rank: 1 + totals.filter((n) => n > points).length })).sort((a, b) => b.points - a.points || a.seat - b.seat);
  return {
    id: match.id,
    variant: "S",
    format: match.format ?? "hanchan",
    startedAt: match.startedAt,
    roundIndex: match.roundIndex,
    repeat: match.repeat,
    handNumber: match.handNumber,
    label: match.format === "single" ? "\uB2E8\uD310\uC804" : roundLabel(match.roundIndex, match.repeat),
    status: match.status,
    totals,
    pot: match.status === "playing" ? game.pot : match.pot,
    nextLabel: match.next ? roundLabel(match.next.roundIndex, match.next.repeat) : null,
    settings: clone2(match.settings),
    startingPoints: match.rules.startingPoints,
    rankings,
    rounds: match.rounds.map(({ seed, logId, ...row }) => clone2(row)),
    finalTransfers: clone2(match.finalTransfers)
  };
}
function assertMatch(match, game) {
  if (match.variant !== void 0 && match.variant !== "S" || !["single", "hanchan"].includes(match.format ?? "hanchan") || match.format === "single" && (match.roundIndex !== 0 || match.repeat !== 0 || match.handNumber !== 1 || match.status === "between-rounds")) throw new Error("Invalid S match format");
  if (match.version !== 1 || !["playing", "between-rounds", "complete"].includes(match.status) || !Number.isInteger(match.roundIndex) || match.roundIndex < 0 || match.roundIndex > 7 || !Number.isInteger(match.handNumber) || match.handNumber < 1 || !Number.isInteger(match.repeat) || match.repeat < 0) throw new Error("Invalid S match progress");
  if (match.scores.length !== 4 || match.scores.some((n) => !Number.isSafeInteger(n)) || sum(match.scores) + match.pot !== 4 * match.rules.startingPoints) throw new Error("Match score conservation violated");
  if (!Number.isSafeInteger(match.pot) || match.pot < 0 || match.pot % 1e3) throw new Error("Invalid match pot");
  if (game.matchContext?.id !== match.id || game.matchContext.handNumber !== match.handNumber || game.matchContext.roundIndex !== match.roundIndex || game.matchContext.repeat !== match.repeat || game.dealer !== match.roundIndex % 4 || game.rules.roundWind !== (match.roundIndex < 4 ? 27 : 28)) throw new Error("Match round mismatch");
  if (!Array.isArray(game.startingScores) || game.startingScores.length !== 4 || game.startingScores.some((n) => !Number.isSafeInteger(n))) throw new Error("Missing match starting balances");
  const banked = game.startingScores.map((n, i) => n + (match.status === "playing" ? 0 : game.players[i].score) + match.finalTransfers.filter((t) => t.to === i).reduce((sum3, t) => sum3 + t.amount, 0));
  if (banked.some((n, i) => n !== match.scores[i]) || match.status === "playing" && game.initialPot !== match.pot) throw new Error("Match carried balances mismatch");
  if (match.status !== "playing" && !game.end) throw new Error("Unfinished round cannot be settled");
  if (match.rounds.length !== match.handNumber - (match.status === "playing" ? 1 : 0)) throw new Error("Duplicate or missing round result");
  assertInvariants2(game);
  if (match.status === "playing" && sum(matchTotals(match, game)) + game.pot !== 4 * match.rules.startingPoints) throw new Error("Live match score conservation violated");
  return true;
}

// game/h-match.mjs
var SETTINGS = Object.freeze({ dealerContinuation: "none", honbaPoints: 0, finalPot: "none", endOnBankrupt: false });
var sum2 = (xs) => xs.reduce((n, x) => n + x, 0);
var clone3 = (x) => structuredClone(x);
var label = (match) => match.format === "single" ? "\uB2E8\uD310\uC804" : roundLabel(match.roundIndex);
function createMatch2({ seed = 1, id = crypto.randomUUID(), format: format2 = "single", rules = {}, settings = {}, now = (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295 || typeof id !== "string" || !id) throw new Error("Invalid match seed/id");
  if (!["single", "hanchan"].includes(format2)) throw new Error("\uB2E8\uD310\uC804 \uB610\uB294 \uBC18\uC7A5\uC804\uC744 \uC120\uD0DD\uD558\uC138\uC694.");
  if (Object.entries(settings).some(([key3, value2]) => !Object.hasOwn(SETTINGS, key3) || SETTINGS[key3] !== value2)) throw new Error("Unsupported H match settings");
  return { version: 1, variant: "H", format: format2, id, seed, startedAt: now, rules: ruleset({ ...rules, roundWind: 27 }), settings: { ...SETTINGS }, roundIndex: 0, repeat: 0, handNumber: 1, status: "playing", scores: [0, 0, 0, 0], pot: 0, rounds: [], next: null, finalTransfers: [] };
}
function createMatchGame2(match) {
  if (match.status !== "playing") throw new Error("\uB300\uAD6D\uC774 \uB2E4\uC74C \uAD6D\uC744 \uC2DC\uC791\uD560 \uC0C1\uD0DC\uAC00 \uC544\uB2D9\uB2C8\uB2E4.");
  const game = createGame({ seed: roundSeed(match.seed, match.handNumber), dealer: match.roundIndex % 4, rules: { ...match.rules, roundWind: match.roundIndex < 4 ? 27 : 28 } });
  game.startingScores = [...match.scores];
  game.matchContext = { id: match.id, handNumber: match.handNumber, roundIndex: match.roundIndex, repeat: 0 };
  return game;
}
function recordRound2(match, game, { logId = null } = {}) {
  if (game.matchContext?.id !== match.id || game.matchContext.handNumber !== match.handNumber) throw new Error("\uB2E4\uB978 \uB300\uAD6D \uB610\uB294 \uAD6D\uC758 \uC815\uC0B0\uC785\uB2C8\uB2E4.");
  if (match.status !== "playing") return false;
  if (!game.end) throw new Error("\uAD6D\uC774 \uB05D\uB09C \uB4A4 \uC815\uC0B0\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
  assertMatch2(match, game);
  const delta = game.players.map((p) => p.score);
  match.scores = match.scores.map((n, i) => n + delta[i]);
  match.rounds.push({ handNumber: match.handNumber, roundIndex: match.roundIndex, repeat: 0, label: label(match), dealer: game.dealer, seed: game.seed, result: game.end, winner: game.winners[0] ?? null, winners: [...game.winners], delta, totals: [...match.scores], pot: 0, retained: false, logId });
  if (match.format === "single" || match.roundIndex === 7) {
    match.status = "complete";
    match.next = null;
  } else {
    match.status = "between-rounds";
    match.next = { roundIndex: match.roundIndex + 1, repeat: 0 };
  }
  assertMatch2(match, game);
  return true;
}
function advanceMatch2(match, expectedHandNumber = match.handNumber) {
  if (match.status !== "between-rounds" || !match.next || expectedHandNumber !== match.handNumber) throw new Error("\uD604\uC7AC \uAD6D\uC774 \uB05D\uB09C \uB4A4 \uB2E4\uC74C \uAD6D\uC73C\uB85C \uC9C4\uD589\uD558\uC138\uC694.");
  match.roundIndex = match.next.roundIndex;
  match.handNumber++;
  match.next = null;
  match.status = "playing";
  return createMatchGame2(match);
}
function matchTotals2(match, game) {
  return match.status === "playing" ? match.scores.map((n, i) => n + game.players[i].score) : [...match.scores];
}
function matchSummary2(match, game) {
  const totals = matchTotals2(match, game), rankings = totals.map((points, seat) => ({ seat, points, rank: 1 + totals.filter((n) => n > points).length })).sort((a, b) => b.points - a.points || a.seat - b.seat);
  return { id: match.id, variant: "H", format: match.format, startedAt: match.startedAt, roundIndex: match.roundIndex, repeat: 0, handNumber: match.handNumber, label: label(match), status: match.status, totals, pot: 0, nextLabel: match.next ? roundLabel(match.next.roundIndex) : null, settings: clone3(match.settings), startingPoints: 0, rankings, rounds: match.rounds.map(({ seed, logId, ...row }) => clone3(row)), finalTransfers: [] };
}
function assertMatch2(match, game) {
  if (match.version !== 1 || match.variant !== "H" || !["single", "hanchan"].includes(match.format) || !["playing", "between-rounds", "complete"].includes(match.status) || !Number.isInteger(match.roundIndex) || match.roundIndex < 0 || match.roundIndex > 7 || match.handNumber !== match.roundIndex + 1 || match.repeat !== 0 || match.format === "single" && (match.roundIndex !== 0 || match.status === "between-rounds")) throw new Error("Invalid H match progress");
  if (!Array.isArray(match.scores) || match.scores.length !== 4 || match.scores.some((n) => !Number.isSafeInteger(n)) || sum2(match.scores) !== 0 || match.pot !== 0 || match.finalTransfers.length) throw new Error("Match score conservation violated");
  if (game.rules.variant === "S" || game.matchContext?.id !== match.id || game.matchContext.handNumber !== match.handNumber || game.matchContext.roundIndex !== match.roundIndex || game.matchContext.repeat !== 0 || game.dealer !== match.roundIndex % 4 || game.rules.roundWind !== (match.roundIndex < 4 ? 27 : 28)) throw new Error("Match round mismatch");
  if (!Array.isArray(game.startingScores) || game.startingScores.length !== 4 || game.startingScores.some((n) => !Number.isSafeInteger(n))) throw new Error("Missing match starting balances");
  if (game.startingScores.some((n, i) => n + (match.status === "playing" ? 0 : game.players[i].score) !== match.scores[i])) throw new Error("Match carried balances mismatch");
  if (match.status !== "playing" && !game.end) throw new Error("Unfinished round cannot be settled");
  if (match.rounds.length !== match.handNumber - (match.status === "playing" ? 1 : 0)) throw new Error("Duplicate or missing round result");
  assertInvariants(game);
  if (sum2(matchTotals2(match, game)) !== 0) throw new Error("Live match score conservation violated");
  return true;
}

// game/match.mjs
var matchVariant = (match) => match?.variant === "H" ? "H" : "S";
var engine2 = (match) => matchVariant(match) === "H" ? h_match_exports : match_exports;
function createMatch3({ variant = "S", ...options } = {}) {
  if (!["H", "S"].includes(variant)) throw new Error("Unknown rule variant");
  return (variant === "H" ? h_match_exports : match_exports).createMatch(options);
}
var createMatchGame3 = (match) => engine2(match).createMatchGame(match);
var recordRound3 = (match, game, options) => engine2(match).recordRound(match, game, options);
var advanceMatch3 = (match, expectedHandNumber) => engine2(match).advanceMatch(match, expectedHandNumber);
var matchSummary3 = (match, game) => engine2(match).matchSummary(match, game);
var assertMatch3 = (match, game) => engine2(match).assertMatch(match, game);

// web/match-store.mjs
var KEY2 = "wellness-s-match-v1";
var clone4 = (x) => structuredClone(x);
var summaryVariant = (summary) => summary?.variant === "H" ? "H" : "S";
var summaryFormat = (summary) => summary?.format ?? defaultMatchFormat(summaryVariant(summary));
var matchTitle = (summary) => `${summaryVariant(summary)}\uB8F0 ${matchFormatName(summaryFormat(summary))}`;
var roundResultName = (result) => result === "exhaustive-draw" ? "\uC720\uAD6D" : "\uD654\uB8CC";
function matchRulesDescription(summary) {
  const variant = summaryVariant(summary), format2 = summaryFormat(summary), start2 = `${summary.startingPoints.toLocaleString()}\uC810 \uC2DC\uC791`;
  if (format2 === "single") return `${start2} \xB7 \uD55C \uAD6D \uC815\uC0B0 \uD6C4 \uC885\uB8CC\uD569\uB2C8\uB2E4.${variant === "S" ? " \uB0A8\uC740 \uACF5\uD0C1\uC740 1\uC704\uC5D0\uAC8C \uC9C0\uAE09\uD569\uB2C8\uB2E4." : ""}`;
  return variant === "H" ? `${start2} \xB7 \uB3D91\uAD6D~\uB0A84\uAD6D \uCD1D 8\uAD6D \xB7 \uC5F0\uC7A5 \uC5C6\uC774 \uC790\uB9AC\uAC00 \uC21C\uD658\uD569\uB2C8\uB2E4. H\uB8F0 \uBC18\uC7A5\uC804\uC740 \uC774 \uC571\uC758 \uC5F0\uC2B5\uC6A9 \uC9C4\uD589 \uBC29\uC2DD\uC785\uB2C8\uB2E4.` : `${start2} \xB7 \uB0A84\uAD6D\uAE4C\uC9C0 \xB7 \uCE5C \uD654\uB8CC/\uD150\uD30C\uC774 \uC2DC \uC5F0\uC7A5 \xB7 \uBCF8\uC7A5 \uAC00\uC0B0 \uC5C6\uC74C. \uB0A84\uAD6D\uC5D0\uC11C \uCE5C\uC774 \uB118\uC5B4\uAC08 \uB54C \uC885\uB8CC\uD558\uBA70, \uB0A8\uC740 \uACF5\uD0C1\uC740 1\uC704\uC5D0\uAC8C \uC9C0\uAE09\uD569\uB2C8\uB2E4.`;
}
var MatchStore = class {
  constructor(storage = null) {
    this.storage = storage;
    this.persisted = false;
    this.error = null;
    this.data = null;
  }
  read() {
    if (this.data) return this.data;
    try {
      const raw = this.storage?.getItem(KEY2), data = raw ? JSON.parse(raw) : { version: 1, resume: false, active: null, history: [] };
      if (data?.version !== 1 || !Array.isArray(data.history)) throw new Error("invalid format");
      this.data = data;
      return data;
    } catch {
      this.error = "\uC800\uC7A5\uB41C \uB300\uAD6D\uC744 \uC77D\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC800\uC7A5 \uB370\uC774\uD130\uB294 \uC720\uC9C0\uD588\uC2B5\uB2C8\uB2E4.";
      return null;
    }
  }
  save({ match, seat, log, policy, profile }) {
    const data = this.read();
    if (!data) return false;
    if (data.active?.match.id !== match.id && data.active) {
      const old = data.active;
      data.history.unshift({ seat: old.seat, summary: matchSummary3(old.match, expandLog(old.log).game) });
      data.history = data.history.slice(0, 9);
    }
    data.active = { match: clone4(match), seat, policy, profile, log: compactLog(log) };
    data.resume = true;
    return this.write();
  }
  write() {
    this.persisted = false;
    try {
      if (!this.storage) return false;
      this.storage.setItem(KEY2, JSON.stringify(this.data));
      this.persisted = true;
      this.error = null;
      return true;
    } catch {
      this.error = "\uB300\uAD6D \uC790\uB3D9 \uC800\uC7A5 \uACF5\uAC04\uC774 \uBD80\uC871\uD569\uB2C8\uB2E4. \uC810\uC218\uD45C\uC640 \uD604\uC7AC \uB85C\uADF8\uB97C \uD30C\uC77C\uB85C \uC800\uC7A5\uD574 \uC8FC\uC138\uC694.";
      return false;
    }
  }
  setResume(enabled) {
    const data = this.read();
    if (!data) return;
    data.resume = !!enabled;
    this.write();
  }
  saveSummary(summary, { seat }) {
    const data = this.read();
    if (!data) return false;
    const entry = { seat, summary: clone4(summary) }, previous = data.history.find((x) => x.summary.id === summary.id);
    if (JSON.stringify(previous) === JSON.stringify(entry)) return this.persisted;
    data.history = [entry, ...data.history.filter((x) => x.summary.id !== summary.id)].slice(0, data.active ? 9 : 10);
    return this.write();
  }
  restore({ force = false } = {}) {
    const data = this.read();
    if (!data?.active || !force && !data.resume) return null;
    try {
      const saved = clone4(data.active), log = expandLog(saved.log);
      if (!Number.isInteger(saved.seat) || saved.seat < 0 || saved.seat > 3 || log.humanSeat !== saved.seat) throw new Error("Invalid saved seat");
      assertMatch3(saved.match, log.game);
      saved.log = log;
      return saved;
    } catch {
      this.error = "\uC800\uC7A5\uB41C \uB300\uAD6D\uC758 \uC810\uC218 \uB610\uB294 \uD328 \uC0C1\uD0DC\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uAE30\uB85D\uC740 \uC720\uC9C0\uD588\uC2B5\uB2C8\uB2E4.";
      return null;
    }
  }
  list() {
    const data = this.read();
    if (!data) return [];
    try {
      const active = data.active;
      return [...active ? [{ seat: active.seat, summary: matchSummary3(active.match, expandLog(active.log).game) }] : [], ...data.history];
    } catch {
      this.error = "\uC800\uC7A5\uB41C \uC810\uC218\uD45C\uB97C \uC77D\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uAE30\uB85D\uC740 \uC720\uC9C0\uD588\uC2B5\uB2C8\uB2E4.";
      return [];
    }
  }
};
function matchCSV(summary, names = ["\uC2DC\uC791 \uB3D9", "\uC2DC\uC791 \uB0A8", "\uC2DC\uC791 \uC11C", "\uC2DC\uC791 \uBD81"]) {
  const cell = (value2) => '"' + String(value2 ?? "").replaceAll('"', '""') + '"', rows = [["\uAD6D", "\uACB0\uACFC", ...names.map((n) => n + " \uC99D\uAC10"), ...names.map((n) => n + " \uB204\uC801"), "\uACF5\uD0C1"]];
  for (const r of summary.rounds) rows.push([r.label, roundResultName(r.result), ...r.delta, ...r.totals, r.pot]);
  for (const t of summary.finalTransfers) {
    const delta = [0, 0, 0, 0];
    delta[t.to] = t.amount;
    rows.push(["\uC885\uB8CC \uACF5\uD0C1 \uC9C0\uAE09", names[t.to], ...delta, ...summary.totals, summary.pot]);
  }
  rows.push([summary.status === "complete" ? "\uCD5C\uC885" : "\uD604\uC7AC", summary.label, "", "", "", "", ...summary.totals, summary.pot]);
  rows.push([summary.status === "complete" ? "\uCD5C\uC885 \uC21C\uC704" : "\uD604\uC7AC \uC21C\uC704", "\uB3D9\uC810 \uACF5\uB3D9 \uC21C\uC704", "", "", "", "", ...[0, 1, 2, 3].map((seat) => summary.rankings.find((r) => r.seat === seat).rank), ""]);
  return "\uFEFF" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

// web/archive-client.mjs
var archiveOrigin = () => ["localhost", "127.0.0.1"].includes(globalThis.location?.hostname) ? "http://127.0.0.1:8790" : "https://wellness-mahjong-h-lab.chayhyeon.chatgpt.site";
var TOKEN = "mahjong-archive-device-v1";
var OUTBOX = "mahjong-archive-outbox-v1:";
var ACK = "mahjong-archive-ack-v1:";
var stamp = (log) => [log.actions.length, log.observations.at(-1)?.revision ?? 0, log.errors.length, log.game.events.length, log.game.end ?? ""].join(":");
var ArchiveClient = class {
  constructor({ storage = null, fetcher = (...args) => globalThis.fetch(...args), origin = archiveOrigin(), onStatus = () => {
  }, setTimer = (...args) => globalThis.setTimeout(...args), clearTimer = (...args) => globalThis.clearTimeout(...args) } = {}) {
    Object.assign(this, { storage, fetcher, origin, onStatus, setTimer, clearTimer });
    this.pending = /* @__PURE__ */ new Map();
    this.acks = /* @__PURE__ */ new Map();
    this.busy = false;
    this.timer = null;
    this.failures = 0;
    this.blocked = /* @__PURE__ */ new Set();
    this.stopped = false;
    try {
      this.token = storage?.getItem(TOKEN);
    } catch {
    }
    if (!/^[0-9a-f]{64}$/.test(this.token ?? "")) {
      this.token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
      try {
        storage?.setItem(TOKEN, this.token);
      } catch {
      }
    }
    try {
      for (let i = 0; i < (storage?.length ?? 0); i++) {
        const key3 = storage.key(i);
        if (key3?.startsWith(OUTBOX)) {
          const log = JSON.parse(storage.getItem(key3));
          if (log?.format === "wellness-mahjong-log/v2") this.pending.set(log.id, { log, stamp: stamp(log) });
        }
      }
    } catch {
    }
    this.schedule();
  }
  enqueue(log) {
    if (!log) return;
    const version = stamp(log);
    let ack = this.acks.get(log.id);
    try {
      ack ??= this.storage?.getItem(ACK + log.id);
    } catch {
    }
    if (ack === version) {
      this.onStatus({ id: log.id, state: "saved" });
      return;
    }
    if (this.pending.get(log.id)?.stamp === version) return;
    this.pending.set(log.id, { log, stamp: version });
    this.blocked.delete(log.id);
    this.onStatus({ id: log.id, state: "waiting" });
    this.schedule();
  }
  schedule(delay = 2e3) {
    if (this.stopped || this.timer !== null || this.busy || ![...this.pending.keys()].some((id) => !this.blocked.has(id))) return;
    this.timer = this.setTimer(() => {
      this.timer = null;
      void this.flush();
    }, delay);
  }
  async flush({ keepalive = false } = {}) {
    if (this.busy || this.stopped) return;
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    const next = [...this.pending].find(([id2]) => !this.blocked.has(id2));
    if (!next) return;
    const [id, item] = next;
    this.busy = true;
    try {
      const log = compactLog(item.log), version = stamp(log);
      item.stamp = version;
      const text = JSON.stringify(log);
      try {
        this.storage?.setItem(OUTBOX + id, text);
      } catch {
      }
      let body = text;
      const headers = { Authorization: "Bearer " + this.token, "Content-Type": "application/json" };
      if (typeof CompressionStream !== "undefined") {
        body = new Uint8Array(await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
        headers["Content-Type"] = "application/octet-stream";
        headers["X-Mahjong-Log-Encoding"] = "gzip";
      }
      this.onStatus({ id, state: "uploading" });
      const response = await this.fetcher(this.origin + "/api/archives", { method: "POST", headers, body, signal: AbortSignal.timeout(12e3), keepalive: keepalive && (typeof body === "string" ? new TextEncoder().encode(body).length : body.length) < 6e4 });
      const result = await response.json();
      if (!response.ok) {
        const error = new Error(result.error ?? "\uC11C\uBC84 \uC800\uC7A5 \uC2E4\uD328");
        error.status = response.status;
        throw error;
      }
      if (result.id !== id || !result.saved) throw new Error("\uC11C\uBC84 \uC800\uC7A5 \uD655\uC778\uC744 \uBC1B\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      this.acks.set(id, version);
      try {
        this.storage?.setItem(ACK + id, version);
        this.storage?.removeItem(OUTBOX + id);
      } catch {
      }
      if (this.pending.get(id)?.stamp === version) this.pending.delete(id);
      this.failures = 0;
      this.onStatus({ id, state: "saved" });
    } catch (error) {
      this.failures++;
      if (error.status && error.status < 500 && ![408, 409, 429].includes(error.status)) this.blocked.add(id);
      this.onStatus({ id, state: "error", message: this.blocked.has(id) ? "\uC11C\uBC84 \uC800\uC7A5 \uC2E4\uD328 \xB7 JSON \uD30C\uC77C\uB85C \uC800\uC7A5\uD574 \uC8FC\uC138\uC694." : "\uC5F0\uACB0\uB418\uBA74 \uC790\uB3D9 \uC7AC\uC2DC\uB3C4 \xB7 \uAE30\uAE30 \uAE30\uB85D \uC720\uC9C0", error: String(error.message) });
    } finally {
      this.busy = false;
      this.schedule(this.failures ? Math.min(3e4, 2e3 * 2 ** Math.min(this.failures, 4)) : 250);
    }
  }
  retry() {
    this.blocked.clear();
    this.failures = 0;
    void this.flush();
  }
  stop() {
    this.stopped = true;
    if (this.timer !== null) this.clearTimer(this.timer);
    this.timer = null;
  }
};
function archiveTask(action, onError = () => {
}) {
  const failed = (error) => {
    try {
      onError(error);
    } catch {
    }
  };
  try {
    const result = action();
    return result?.catch ? result.catch(failed) : result;
  } catch (error) {
    failed(error);
  }
}

// web/trained-policies.mjs
var value = {
  "id": "H-20261006-expanded-v1",
  "rulesetId": "H-2026-literal-v1",
  "weights": {
    "D": {
      "speed": 38,
      "value": 0.17
    },
    "E": {
      "speed": 90,
      "value": 0.075,
      "risk": 0
    }
  },
  "completedGames": 188100,
  "elapsedSeconds": 1451.881,
  "validationSeeds": 2e3,
  "trainingSeeds": 1e3,
  "analysisSha256": "4c4cd3877ea311d7fd8b588837ea126ffdfc10560889d6555b94804dd19a75a6",
  "selectionSha256": "2a6a9fc022c2fbfe92de694c42751f7e448f03cd0ba3bfb51e8d4d5e4d08f776"
};
for (const weights of Object.values(value.weights)) Object.freeze(weights);
Object.freeze(value.weights);
var TRAINING = Object.freeze(value);

// web/training-results.mjs
var BASE_NAMES = { A: "\uCD5C\uC18D \uD654\uB8CC", B: "\uD551\uD6C4\xB7\uB860 \uC218\uB77D", C: "\uD551\uD6C4\xB7\uCBD4\uBAA8 \uC9C0\uD5A5", D: "\uACE0\uB4DD\uC810", E: "\uADE0\uD615" };
var PROFILE_NAMES = { speed: "\uC18D\uB3C4\uD615", pinfu: "\uD551\uD6C4\uD615", value: "\uACE0\uB4DD\uC810\uD615", cautious: "\uC2E0\uC911\uD615", mixed: "\uD63C\uD569\uD615", valuePressure: "\uACE0\uB4DD\uC810 \uC555\uBC15\uD615" };
var fixed = (value2) => Number.isFinite(value2) ? value2.toFixed(2) : "\u2014";
var percent = (value2) => Number.isFinite(value2) ? `${(value2 * 100).toFixed(1)}%` : "\u2014";
var range = (low, high) => `${fixed(low)} ~ ${fixed(high)}`;
var improved = (row) => row.simultaneousLow > 0;
var verdict = (row) => improved(row) ? "\uAE30\uC900 \uB300\uBE44 \uAC1C\uC120 \uD655\uC778" : row.simultaneousHigh < 0 ? "\uAE30\uC900 \uB300\uBE44 \uB0AE\uC74C" : "\uCC28\uC774 \uBBF8\uD655\uC815";
function privateTrainingResultModel(manifest, selection, data) {
  const counts2 = manifest?.counts, versions = selection?.versions, seeds = manifest?.plan?.holdout?.seedCount;
  if (manifest?.status !== "complete" || !Number.isSafeInteger(manifest.completedGames) || !counts2 || manifest.completedGames !== counts2.total || counts2.total !== counts2.pilot + counts2.tuning + counts2.holdout)
    throw new Error("\uC804\uCCB4 \uC790\uB3D9 \uB300\uAD6D\uC774 \uC644\uB8CC\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
  if (selection?.id !== manifest.id || !Array.isArray(versions) || versions.length !== 6 || !selection.frozenAt || !Number.isSafeInteger(seeds) || seeds < 2 || !manifest.rules?.concealedKanPrivate)
    throw new Error("\uAC80\uC99D \uC870\uAC74\uACFC \uACE0\uC815\uD55C \uC804\uB7B5 \uBC84\uC804\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  const ids = ["A", "B", "C", "D", "E", ...versions.map((v) => v.id)], expectedGames = seeds * 4;
  if (new Set(ids).size !== 11 || !data?.summary || data.summary.length !== ids.length || !data.bootstrap || data.bootstrap.seedClusters !== seeds || counts2.holdout !== expectedGames * ids.length || ids.some((id) => data.summary.filter((row) => row.policy === id && row.games === expectedGames && [row.meanNet, row.ci95Low, row.ci95High, row.meanRank, row.topScoreRate, row.winRate].every(Number.isFinite)).length !== 1))
    throw new Error("\uCD5C\uC885 \uAC80\uC99D\uC758 \uC644\uB8CC \uAD6D \uC218\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  if (!Array.isArray(data.improvements) || data.improvements.length !== 6 || versions.some((v) => data.improvements.filter((row) => row.policy === v.id && row.reference === v.policy && [row.meanDifference, row.ci95Low, row.ci95High, row.simultaneousLow, row.simultaneousHigh].every(Number.isFinite)).length !== 1))
    throw new Error("\uAE30\uC900 \uC815\uCC45\uACFC\uC758 \uBE44\uAD50 \uACB0\uACFC\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  const names = { ...BASE_NAMES, ...Object.fromEntries(versions.map((v) => [v.id, v.name])) };
  const label2 = (id) => `${id} \xB7 ${names[id] ?? id}`;
  const summary = [...data.summary].sort((a, b) => b.meanNet - a.meanNet || a.policy.localeCompare(b.policy));
  const approved = data.improvements.filter(improved).map((row) => `${row.policy} (${row.reference} \uB300\uBE44)`);
  const best = summary[0];
  return {
    summary,
    versions,
    names,
    label: label2,
    best,
    seeds,
    conclusion: `\uC774\uBC88 \uC790\uB3D9 \uB300\uAD6D\uC758 \uD3C9\uADE0 \uC21C\uC218\uC775\uC740 ${label2(best.policy)}\uAC00 \uAD6D\uB2F9 ${fixed(best.meanNet)}\uC810\uC73C\uB85C \uAC00\uC7A5 \uB192\uC558\uC2B5\uB2C8\uB2E4. \uC5EC\uC12F \uC0AC\uC804 \uC9C0\uC815 \uBE44\uAD50\uB97C \uBCF4\uC815\uD55C \uB4A4 \uAE30\uC900\uBCF4\uB2E4 \uAC1C\uC120\uC774 \uD655\uC778\uB41C \uBC84\uC804: ${approved.join(", ") || "\uC5C6\uC74C"}.`,
    improvements: data.improvements,
    profiles: data.profileSummary ?? [],
    pairCB: data.pairs?.find((row) => row.policy === "C" && row.reference === "B")
  };
}
function fillRows(element2, rows, format2) {
  element2.replaceChildren();
  for (const row of rows) {
    const tr = document.createElement("tr");
    for (const value2 of format2(row)) {
      const td = document.createElement("td");
      td.textContent = value2;
      tr.append(td);
    }
    element2.append(tr);
  }
}
async function readResult(name) {
  const response = await fetch(new URL(`../results/private-kan-20261011/${name}.json`, import.meta.url));
  if (!response.ok) throw new Error("\uAC80\uC99D \uAE30\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  return response.json();
}
async function renderPrivateTrainingResults(get) {
  const content = get("private-training-data"), status = get("private-training-run-status"), conclusion = get("private-training-conclusion");
  if (!content || !status || !conclusion) return;
  content.hidden = true;
  try {
    const manifest = await readResult("manifest");
    if (manifest.status !== "complete") {
      status.textContent = `\uC548\uAE61 \uBE44\uACF5\uAC1C H\uB8F0 \xB7 ${Number.isSafeInteger(manifest.completedGames) ? manifest.completedGames.toLocaleString() + "\uAD6D \uC644\uB8CC" : "\uC2E4\uD589 \uAE30\uB85D \uD655\uC778 \uC911"}`;
      conclusion.textContent = "\uC804\uCCB4 \uAC80\uC99D\uC774 \uC644\uB8CC\uB418\uC9C0 \uC54A\uC544 \uC804\uB7B5\uC758 \uC6B0\uC5F4\uC744 \uD45C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD55C\uAD6D\uC5B4 \uBCF4\uACE0\uC11C\uC640 \uC2E4\uD589 \uAE30\uB85D\uC5D0\uC11C \uC9C4\uD589 \uC0C1\uD0DC\uB97C \uD655\uC778\uD558\uC138\uC694.";
      return;
    }
    const [selection, data] = await Promise.all([readResult("selection"), readResult("analysis")]), model = privateTrainingResultModel(manifest, selection, data);
    const time = Number.isFinite(manifest.elapsedSeconds) ? ` \xB7 \uC2E4\uD589 ${fixed(manifest.elapsedSeconds / 60)}\uBD84` : "";
    status.textContent = `\uC2E4\uD589 \uC644\uB8CC \xB7 \uCD1D ${manifest.completedGames.toLocaleString()}\uAD6D${time}`;
    conclusion.textContent = model.conclusion;
    const plan = manifest.plan;
    get("private-training-design").textContent = `\uC810\uAC80 ${manifest.counts.pilot.toLocaleString()}\uAD6D \u2192 \uD29C\uB2DD ${manifest.counts.tuning.toLocaleString()}\uAD6D (${plan.tuning.seedCount}\uAC1C \uC2DC\uB4DC, \uACC4\uC5F4\uB2F9 \uD6C4\uBCF4 2\uAC1C) \u2192 \uCD5C\uC885 \uAC80\uC99D ${manifest.counts.holdout.toLocaleString()}\uAD6D (${model.seeds}\uAC1C \uC0C8 \uC2DC\uB4DC \xD7 4\uC790\uB9AC \xD7 11\uC804\uB7B5). \uC0C1\uB300 \uC131\uD5A5 ${plan.profiles.length}\uC885. \uB3D9\uC77C \uC2DC\uB4DC\uC758 \uBAA8\uB4E0 \uC790\uB9AC\xB7\uC815\uCC45\uC744 \uD568\uAED8 \uC7AC\uD45C\uBCF8\uD558\uACE0 \uC0C1\uB300 \uC131\uD5A5 \uBE44\uC728\uC744 \uC720\uC9C0\uD574 95% \uC2E0\uB8B0\uAD6C\uAC04\uC744 \uACC4\uC0B0\uD588\uC2B5\uB2C8\uB2E4.`;
    const cards = get("private-training-versions");
    cards.replaceChildren();
    for (const version of model.versions) {
      const card = document.createElement("article");
      card.className = "training-version-card";
      const title = document.createElement("h3"), description = document.createElement("p"), comparison = document.createElement("p");
      title.textContent = model.label(version.id);
      description.textContent = version.description;
      const row = model.improvements.find((r) => r.policy === version.id);
      comparison.textContent = `\uAE30\uC900 ${version.policy} \xB7 ${verdict(row)}`;
      comparison.className = "training-version-verdict";
      card.append(title, description, comparison);
      cards.append(card);
    }
    fillRows(get("private-training-summary"), model.summary, (row) => [model.label(row.policy), fixed(row.meanNet), range(row.ci95Low, row.ci95High), fixed(row.meanRank), percent(row.topScoreRate), percent(row.winRate)]);
    fillRows(get("private-training-improvements"), model.improvements, (row) => [`${row.policy} \u2212 ${row.reference}`, fixed(row.meanDifference), range(row.ci95Low, row.ci95High), range(row.simultaneousLow, row.simultaneousHigh), verdict(row)]);
    fillRows(get("private-training-details"), model.summary, (row) => [row.policy, percent(row.ronShareAmongWins), percent(row.tsumoShareAmongWins), percent(row.firstWinRate), fixed(row.averageWinOrder), fixed(row.averageWinDrawNumber), fixed(row.netAmongWins), fixed(row.dealInLossPerGame), fixed(row.tsumoPaidPerGame), fixed(row.drawLossPerGame)]);
    fillRows(get("private-training-profiles"), model.profiles, (row) => [PROFILE_NAMES[row.profile] ?? row.profile, row.policy, fixed(row.meanNet), range(row.ci95Low, row.ci95High), fixed(row.meanRank)]);
    const pair = model.pairCB;
    get("private-training-cb").textContent = pair ? `\uCC98\uC74C\uC758 \uC9C8\uBB38\uC778 C \u2212 B (\uD551\uD6C4 \uCBD4\uBAA8 \uC9C0\uD5A5 \u2212 \uB860 \uC218\uB77D)\uB294 \uAD6D\uB2F9 ${fixed(pair.meanDifference)}\uC810, \uCC28\uC774\uC758 95% \uC2E0\uB8B0\uAD6C\uAC04 ${range(pair.ci95Low, pair.ci95High)}\uC810\uC785\uB2C8\uB2E4. \uC774 \uBE44\uAD50\uB294 \uD0D0\uC0C9\uC6A9\uC774\uBA70 \uC5EC\uB7EC \uC815\uCC45 \uC30D\uC5D0 \uB300\uD55C \uBCF4\uC815\uC740 \uD558\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.` : "";
    content.hidden = false;
  } catch {
    status.textContent = "\uC548\uAE61 \uBE44\uACF5\uAC1C H\uB8F0 \xB7 \uC644\uB8CC \uAE30\uB85D \uD655\uC778 \uD544\uC694";
    conclusion.textContent = "\uC644\uB8CC\uB41C \uACB0\uACFC \uD30C\uC77C\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC218\uCE58\uB97C \uD45C\uC2DC\uD558\uC9C0 \uC54A\uC73C\uBA70, \uD55C\uAD6D\uC5B4 \uBCF4\uACE0\uC11C\uC5D0\uC11C \uC2E4\uC81C \uC2E4\uD589 \uAE30\uB85D\uC744 \uD655\uC778\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
  }
}
async function renderLegacyTrainingResults(get, training) {
  try {
    const response = await fetch(new URL("../results/training-20261006/analysis.json", import.meta.url));
    if (!response.ok) throw new Error("\uACB0\uACFC \uD30C\uC77C\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
    const data = await response.json(), pair = data.tunedPairs.find((r) => r.comparison === "C-B");
    get("training-run-status").textContent = `\uC774\uC804 H\uB8F0\uC5D0\uC11C \uC2E4\uD589 \uC644\uB8CC \xB7 \uCD1D ${training.completedGames.toLocaleString()}\uAD6D \xB7 \uD29C\uB2DD ${training.trainingSeeds.toLocaleString()}\uAC1C / \uAC80\uC99D ${training.validationSeeds.toLocaleString()}\uAC1C \uC2DC\uB4DC`;
    get("training-conclusion").textContent = `\uC774\uC804 \uADDC\uCE59\uC758 \uD559\uC2B5 \uD6C4\uBCF4\uB07C\uB9AC C\u2212B\uB294 \uAD6D\uB2F9 ${pair.meanDifference.toFixed(2)}\uC810 (95% \uC2E0\uB8B0\uAD6C\uAC04 ${pair.ci95Low.toFixed(2)} ~ ${pair.ci95High.toFixed(2)})\uC785\uB2C8\uB2E4. \uB2F9\uC2DC \uAC80\uC99D\uB41C \uAC1C\uC120 \uC815\uCC45: ${Object.keys(training.weights).join(", ") || "\uC5C6\uC74C"}. \uC774 \uAD6C \uADDC\uCE59 \uAC00\uC911\uCE58\uC758 \uC218\uCE58\uB97C \uC0C8 \uADDC\uCE59 \uC131\uB2A5\uC73C\uB85C \uC62E\uACA8 \uD574\uC11D\uD558\uC9C0 \uC54A\uC73C\uBA70, \uC0C8 \uB300\uAD6D\uC5D0 \uC790\uB3D9 \uC801\uC6A9\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC548\uAE61 \uBE44\uACF5\uAC1C \uADDC\uCE59\uC758 \uBCC4\uB3C4 \uC2E4\uD5D8\uC740 \uC704\uC5D0\uC11C \uD655\uC778\uD558\uC138\uC694.`;
    get("training-summary").replaceChildren();
    for (const r of data.improvements) {
      const old = data.baselineSummary.find((x) => x.policy === r.policy), tuned = data.tunedSummary.find((x) => x.policy === r.policy), row = document.createElement("tr");
      for (const value2 of [r.policy, old.meanNet.toFixed(2), tuned.meanNet.toFixed(2), r.meanDifference.toFixed(2), `${r.ci95Low.toFixed(2)} ~ ${r.ci95High.toFixed(2)}`, Object.hasOwn(training.weights, r.policy) ? "\uAD6C \uADDC\uCE59\uC5D0\uC11C\uB9CC \uAC80\uC99D" : "\uAE30\uC874 \uC720\uC9C0"]) {
        const cell = document.createElement("td");
        cell.textContent = value2;
        row.append(cell);
      }
      get("training-summary").append(row);
    }
  } catch {
    get("training-conclusion").textContent = "\uACB0\uACFC \uD30C\uC77C\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uD55C\uAD6D\uC5B4 \uBCF4\uACE0\uC11C\uC5D0\uC11C \uC2E4\uC81C \uAC80\uC99D \uACB0\uACFC\uB97C \uD655\uC778\uD558\uC138\uC694.";
  }
}
async function renderTrainingResults(get, training) {
  await Promise.allSettled([renderPrivateTrainingResults(get), renderLegacyTrainingResults(get, training)]);
}

// web/private-kan-training.mjs
var PRIVATE_KAN_TRAINING = {
  "id": "H-private-kan-20261011-v1",
  "rulesetId": "H-2026-private-kan-v1",
  "rules": {
    "id": "H-2026-private-kan-v1",
    "ronPassAllowed": true,
    "passRonLock": "none",
    "selfDiscardFuriten": false,
    "pinfuClosedOnly": false,
    "peikouClosedOnly": false,
    "ryanpeikouDistinctSuits": true,
    "concealedKanBreaksMenzen": true,
    "concealedKanPrivate": true,
    "menzenRequiresTsumo": false,
    "sevenPairsQuadAsTwo": false,
    "greenTiles": [
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      25,
      26,
      32
    ],
    "kanBonus": 100,
    "dragonBonus": 100,
    "roundWindBonus": 100,
    "seatWindBonus": 100,
    "tsumoBonusPerPayer": 100,
    "drawIncludesBonuses": false,
    "drawWaitAvailability": "structural",
    "deadWallTiles": 0,
    "maxKans": 32,
    "kanReplacement": "live-tail",
    "addedKanRobAllowed": true,
    "multipleRon": "all",
    "chiFrom": "next-active",
    "allowKuikae": true,
    "revealWinnerHand": true,
    "revealTsumoWinningTile": false,
    "roundWind": 27,
    "greenRequiresDragon": true,
    "fourOfAKindBonus": true,
    "ronContinuation": "last-winner"
  },
  "status": "complete",
  "completedGames": 34372,
  "tuningSeeds": 252,
  "validationSeeds": 504,
  "versions": [
    {
      "id": "V1",
      "name": "\uACE0\uB4DD\uC810\xB7\uC18D\uB3C4 \uC720\uC9C0",
      "description": "\uACE0\uB4DD\uC810 \uAC00\uCE58\uC640 \uC644\uC131 \uC18D\uB3C4\uB97C \uD568\uAED8 \uB192\uC784",
      "policy": "D",
      "candidate": "V1-2",
      "weights": {
        "speed": 60,
        "ukeire": 1,
        "value": 0.24,
        "maxShantenLoss": 1
      },
      "tuningMean": 69.39484126984127,
      "improved": false,
      "validation": {
        "meanNet": 64.2609126984127,
        "ci95Low": 49.15674603174603,
        "ci95High": 80.10974702380952,
        "meanDifference": 6.894841269841265,
        "simultaneousLow": -7.135416666666667,
        "simultaneousHigh": 21.644035218253922
      }
    },
    {
      "id": "V2",
      "name": "\uACE0\uB4DD\uC810\xB7\uAC15\uD55C \uCD94\uAD6C",
      "description": "\uD55C \uC0E8\uD150 \uC190\uD574\uAE4C\uC9C0 \uAC10\uC218\uD558\uBA70 \uACE0\uB4DD\uC810 \uD615\uD0DC \uCD94\uAD6C",
      "policy": "D",
      "candidate": "V2-1",
      "weights": {
        "speed": 35,
        "ukeire": 0.7,
        "value": 0.28,
        "maxShantenLoss": 1
      },
      "tuningMean": 72.0734126984127,
      "improved": false,
      "validation": {
        "meanNet": 63.56646825396825,
        "ci95Low": 48.16468253968254,
        "ci95High": 79.66269841269842,
        "meanDifference": 6.2003968253968225,
        "simultaneousLow": -11.05375744047619,
        "simultaneousHigh": 24.90916418650793
      }
    },
    {
      "id": "V3",
      "name": "\uACE0\uB4DD\uC810\xB7\uC18D\uB3C4 \uBCF4\uC874",
      "description": "\uCD5C\uC18C \uC0E8\uD150\uC744 \uC720\uC9C0\uD558\uB294 \uD6C4\uBCF4 \uC548\uC5D0\uC11C \uACE0\uB4DD\uC810 \uCD94\uAD6C",
      "policy": "D",
      "candidate": "V3-1",
      "weights": {
        "speed": 65,
        "ukeire": 1,
        "value": 0.2,
        "maxShantenLoss": 0
      },
      "tuningMean": 69.84126984126983,
      "improved": false,
      "validation": {
        "meanNet": 60.267857142857146,
        "ci95Low": 44.717261904761905,
        "ci95High": 75.94246031746032,
        "meanDifference": 2.9017857142857153,
        "simultaneousLow": -13.302021329365079,
        "simultaneousHigh": 19.601624503968246
      }
    },
    {
      "id": "G1",
      "name": "0\xB71\uD310 \uC218\uBE44\xB7\uC57D",
      "description": "\uC800\uD310\uC218 \uC190\uC5D0 \uC57D\uD55C \uC218\uBE44, 2\uD310 \uC774\uC0C1\uC740 \uACF5\uACA9",
      "policy": "E",
      "candidate": "G1-1",
      "weights": {
        "speed": 65,
        "ukeire": 1,
        "value": 0.14,
        "risk": 5,
        "lowValueThreshold": 100,
        "lowValueRisk": 35,
        "maxShantenLoss": 1
      },
      "tuningMean": -22.470238095238095,
      "improved": false,
      "validation": {
        "meanNet": -22.767857142857142,
        "ci95Low": -38.78968253968254,
        "ci95High": -6.496155753968281,
        "meanDifference": -50.89285714285714,
        "simultaneousLow": -73.01587301587301,
        "simultaneousHigh": -28.777901785714306
      }
    },
    {
      "id": "G2",
      "name": "0\xB71\uD310 \uC218\uBE44\xB7\uC911",
      "description": "\uC800\uD310\uC218 \uC190\uC5D0 \uC911\uAC04 \uC218\uBE44, 2\uD310 \uC774\uC0C1\uC740 \uACF5\uACA9",
      "policy": "E",
      "candidate": "G2-1",
      "weights": {
        "speed": 60,
        "ukeire": 1,
        "value": 0.18,
        "risk": 8,
        "lowValueThreshold": 100,
        "lowValueRisk": 70,
        "maxShantenLoss": 1
      },
      "tuningMean": -138.4920634920635,
      "improved": false,
      "validation": {
        "meanNet": -133.06051587301587,
        "ci95Low": -149.578373015873,
        "ci95High": -116.44345238095238,
        "meanDifference": -161.18551587301587,
        "simultaneousLow": -188.64118303571428,
        "simultaneousHigh": -132.72972470238096
      }
    },
    {
      "id": "G3",
      "name": "0\xB71\uD310 \uC218\uBE44\xB7\uAC15",
      "description": "\uC800\uD310\uC218 \uC190\uC5D0 \uAC15\uD55C \uC218\uBE44, \uB450 \uC0E8\uD150\uAE4C\uC9C0 \uD6C4\uD1F4 \uD5C8\uC6A9",
      "policy": "E",
      "candidate": "G3-1",
      "weights": {
        "speed": 55,
        "ukeire": 0.9,
        "value": 0.2,
        "risk": 12,
        "lowValueThreshold": 100,
        "lowValueRisk": 110,
        "maxShantenLoss": 2
      },
      "tuningMean": -188.29365079365078,
      "improved": false,
      "validation": {
        "meanNet": -190.50099206349208,
        "ci95Low": -207.04427083333331,
        "ci95High": -173.70969742063494,
        "meanDifference": -218.62599206349208,
        "simultaneousLow": -246.80896577380952,
        "simultaneousHigh": -191.36904761904762
      }
    }
  ]
};

// web/training-profile.mjs
var privateTrainingVersions = () => PRIVATE_KAN_TRAINING.status === "complete" ? PRIVATE_KAN_TRAINING.versions : [];
var privateTrainingVersion = (mode) => privateTrainingVersions().find((v) => v.id === mode);
function privateTrainingCompatible(view) {
  return PRIVATE_KAN_TRAINING.status === "complete" && view?.rules?.variant !== "S" && view?.rules?.concealedKanPrivate === true && Object.entries(PRIVATE_KAN_TRAINING.rules).every(([key3, value2]) => JSON.stringify(view.rules[key3]) === JSON.stringify(value2));
}
var KEY3 = "wellness-mahjong-training-profile-v1";
function hasTrainedPolicies(training) {
  return Object.keys(training.weights).length > 0;
}
function trainingCompatible(view, training) {
  const rules = view?.rules;
  return !!rules && rules.variant !== "S" && rules.id === (training.rulesetId ?? "H-2026-literal-v1") && !rules.concealedKanPrivate && !rules.greenRequiresDragon && !rules.fourOfAKindBonus && (!rules.ronContinuation || rules.ronContinuation === "discarder");
}
function readTrainingMode(storage, training) {
  try {
    const saved = storage?.getItem(KEY3);
    if (saved === "original" || privateTrainingVersion(saved)) return saved;
  } catch {
  }
  return hasTrainedPolicies(training) ? "trained" : "original";
}
function saveTrainingMode(storage, mode) {
  try {
    storage?.setItem(KEY3, mode === "trained" || privateTrainingVersion(mode) ? mode : "original");
  } catch {
  }
}
function trainingWeights(view, mode, training) {
  const version = privateTrainingVersion(mode);
  if (version) return privateTrainingCompatible(view) ? { [version.policy]: version.weights } : {};
  return trainingCompatible(view, training) && mode === "trained" ? training.weights : {};
}
function practiceAction(view, { humanSeat: humanSeat2, policy, profile, mode, training }) {
  if (view.seat === humanSeat2) return chooseAction3(view, policy, trainingWeights(view, mode, training)[policy]);
  const spec = OPPONENT_PROFILES2[profile][(view.seat - humanSeat2 + 4) % 4 - 1];
  return chooseAction3(view, spec.id, spec.weights);
}

// web/app.mjs
var $ = (id) => document.getElementById(id);
var state = null;
var auto = false;
var timer = null;
var humanSeat = 0;
var recommendationRevision = 0;
var currentRecommendations = [];
var selectedTileId = null;
var online = false;
var remote = null;
var networkBusy = false;
var practiceMatch = null;
var roomMutationBusy = false;
var logStorage = null;
try {
  logStorage = localStorage;
} catch {
}
var matchStore = new MatchStore(logStorage);
var preferences = readPreferences(logStorage);
var trainingMode = readTrainingMode(logStorage, TRAINING);
var recommendationsEnabled = preferences.recommendations;
var chosenVariant = preferences.variant;
var chosenFormat = preferences.format;
var journal = new GameJournal({ storage: logStorage });
var buildId = new URL(import.meta.url).searchParams.get("v") ?? "local-source";
var kanPeek = createKanPeek({ onChange: () => {
  if (state && (!online || remote?.state)) renderMelds();
} });
var coverPrivateKan = () => kanPeek.clear();
window.addEventListener("blur", coverPrivateKan);
window.addEventListener("pagehide", coverPrivateKan);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") coverPrivateKan();
});
var archiveStatuses = /* @__PURE__ */ new Map();
var archiveFailure = null;
var useArchive = (action) => archiveTask(action, () => {
  archiveFailure = "\uC11C\uBC84 \uC800\uC7A5 \uC624\uB958 \xB7 \uAE30\uAE30 \uAE30\uB85D\uC740 \uC720\uC9C0\uB429\uB2C8\uB2E4.";
  renderArchiveStatus();
});
var archiveClient = useArchive(() => new ArchiveClient({ storage: logStorage, onStatus: (status) => {
  archiveFailure = null;
  archiveStatuses.set(status.id, status);
  renderArchiveStatus();
} }));
function renderArchiveStatus() {
  const id = journal.current?.id, status = archiveStatuses.get(id);
  $("archive-status").textContent = `\uC11C\uBC84 \uD328\uBCF4 ${id?.slice(0, 8) ?? "\uC900\uBE44 \uC911"} \xB7 ${archiveFailure ?? { saved: "\uC800\uC7A5\uB428", waiting: "\uC800\uC7A5 \uB300\uAE30", uploading: "\uC5C5\uB85C\uB4DC \uC911" }[status?.state] ?? status?.message ?? "\uC800\uC7A5 \uB300\uAE30"}`;
}
window.addEventListener("online", () => useArchive(() => archiveClient?.retry()));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") void useArchive(() => archiveClient?.flush({ keepalive: true }));
});
var needsPass = (s, seat) => online && s === state ? s.phase === "reaction" && remote?.legalActions.length === 1 && remote.legalActions[0].type === "pass" : needsAutomaticPass(s, seat);
var actor4 = (s) => online && remote && s === state ? remote.legalActions.length ? humanSeat : actor3(s) : actor3(s);
var legalActions4 = (s) => online && s === state ? remote?.legalActions ?? [] : legalActions3(s);
var observation4 = (s) => online && s === state ? remote?.observation : observation3(s);
var canChooseTile = (id) => online ? !networkBusy && roomClient.connected && state.players[humanSeat].hand.includes(id) && legalActions4(state).some((a) => a.type === "discard" && a.tile === typeOf(id)) : canSelectTile(state, humanSeat, id, auto);
function discardSelection() {
  if (online) {
    if (!canChooseTile(selectedTileId)) throw new Error("\uD604\uC7AC \uC190\uD328\uC5D0\uC11C \uBC84\uB9B4 \uD328\uB97C \uB2E4\uC2DC \uC120\uD0DD\uD558\uC138\uC694.");
    return { type: "discard", tile: typeOf(selectedTileId) };
  }
  return selectedDiscard(state, humanSeat, selectedTileId, auto);
}
var roomClient = new RoomClient({ onState: receiveRoom, onStatus: (message) => {
  $("room-connection").textContent = message;
  renderRoomStart();
  if (online && remote?.state && !roomClient.connected) {
    networkBusy = true;
    render();
  }
} });
for (const [id, p] of Object.entries(POLICIES2)) {
  const opt = document.createElement("option");
  opt.value = id;
  opt.textContent = `${id} \xB7 ${p.name}`;
  $("policy").append(opt);
}
$("policy").value = "D";
for (const v of privateTrainingVersions()) {
  const option = document.createElement("option");
  option.value = v.id;
  option.textContent = `${v.id} \xB7 ${v.name}${v.improved ? " \xB7 \uAE30\uC874 \uB300\uBE44 \uAC1C\uC120 \uD655\uC778" : " \xB7 \uC2E4\uD5D8 \uD6C4\uBCF4"}`;
  $("training-mode").append(option);
}
if (privateTrainingVersion(trainingMode)) $("policy").value = privateTrainingVersion(trainingMode).policy;
var seatIndex = (seat) => (seat - (state?.dealer ?? 0) + 4) % 4;
var seatName = (seat) => SEAT_NAMES[seatIndex(seat)];
var wind = (seat) => ["\u6771", "\u5357", "\u897F", "\u5317"][seatIndex(seat)];
var currentMatch = () => online ? remote?.match ?? null : practiceMatch ? matchSummary3(practiceMatch, state) : null;
function node2(tag, text, cls) {
  const el = document.createElement(tag);
  if (text !== void 0) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function riichiMarker(seat) {
  const marker = node2("span", void 0, "riichi-status"), stick = node2("span", void 0, "riichi-stick");
  marker.setAttribute("role", "img");
  marker.setAttribute("aria-label", `${seatName(seat)} \uB9AC\uCE58`);
  marker.title = `${seatName(seat)} \uB9AC\uCE58`;
  stick.setAttribute("aria-hidden", "true");
  const label2 = node2("span", "\uB9AC\uCE58");
  label2.setAttribute("aria-hidden", "true");
  marker.append(stick, label2);
  return marker;
}
function tiles(parent, types) {
  for (const t of types) parent.append(tileFace(t, { small: true }));
}
function handTile(id, legal, drawn = false) {
  const t = typeOf(id), b = tileFace(t, { button: true });
  b.dataset.id = String(id);
  b.classList.toggle("drawn-tile", drawn);
  b.disabled = auto || networkBusy || !legal.some((a) => a.type === "discard" && a.tile === t);
  b.setAttribute("aria-label", `${drawn ? "\uBC29\uAE08 \uBF51\uC740 \uD328 \xB7 " : ""}${tileName(t)} \uC120\uD0DD. \uB2E4\uC2DC \uB204\uB974\uBA74 \uBC84\uB9BD\uB2C8\uB2E4.`);
  b.setAttribute("aria-pressed", String(id === selectedTileId));
  b.onclick = () => {
    try {
      if (selectedTileId === id) confirmDiscard();
      else {
        if (!canChooseTile(id)) throw new Error("\uB0B4 \uBC84\uB9BC\uD328 \uC120\uD0DD \uCC28\uB840\uB97C \uAE30\uB2E4\uB824 \uC8FC\uC138\uC694.");
        selectedTileId = id;
        updateSelection();
      }
    } catch (e) {
      $("error").textContent = e.message;
    }
  };
  b.onkeydown = (e) => {
    if (e.key === "Escape") {
      selectedTileId = null;
      updateSelection();
    }
  };
  return b;
}
function confirmDiscard() {
  return act(discardSelection());
}
function updateSelection() {
  if (selectedTileId !== null && !canChooseTile(selectedTileId)) selectedTileId = null;
  for (const tile of $("hand").querySelectorAll("button[data-id]")) {
    const selected = Number(tile.dataset.id) === selectedTileId;
    tile.classList.toggle("selected", selected);
    tile.setAttribute("aria-pressed", String(selected));
  }
  const confirm = $("discard-confirm");
  if (confirm) {
    confirm.disabled = selectedTileId === null || auto || networkBusy;
    confirm.textContent = selectedTileId === null ? "\uBC84\uB9AC\uAE30" : `${tileName(typeOf(selectedTileId))} \uBC84\uB9AC\uAE30`;
  }
  $("selection-hint").textContent = state.end ? currentMatch()?.status === "between-rounds" ? "\uC704\uC758 \uB2E4\uC74C \uAD6D \uC2DC\uC791 \uBC84\uD2BC\uC73C\uB85C \uC810\uC218\uB97C \uC774\uC5B4\uAC11\uB2C8\uB2E4." : "\uC0C8 \uB300\uAD6D\uC73C\uB85C \uB2E4\uC2DC \uC5F0\uC2B5\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." : state.players[humanSeat].won ? "\uD654\uB8CC\uD588\uC2B5\uB2C8\uB2E4. \uB0A8\uC740 \uB300\uAD6D\uC744 \uC9C0\uCF1C\uBCF4\uC138\uC694." : auto ? "\uC120\uD0DD\uD55C \uC804\uB7B5\uC73C\uB85C \uC790\uB3D9 \uB300\uAD6D \uC911\uC785\uB2C8\uB2E4." : actor4(state) !== humanSeat ? "\uC0C1\uB300\uAC00 \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4." : state.phase === "reaction" ? "\uAC00\uB2A5\uD55C \uD589\uB3D9\uC744 \uC120\uD0DD\uD558\uC138\uC694." : selectedTileId === null ? "\uD328\uB97C \uC120\uD0DD \u2192 \uB2E4\uC2DC \uB204\uB974\uAC70\uB098 \u2018\uBC84\uB9AC\uAE30\u2019\uB85C \uD655\uC815" : `${tileName(typeOf(selectedTileId))} \uC120\uD0DD \xB7 \uB2E4\uC2DC \uB204\uB974\uAC70\uB098 \u2018\uBC84\uB9AC\uAE30\u2019\uB85C \uD655\uC815`;
}
function renderMeld(m, seat, index) {
  const key3 = `${seat}:${index}`;
  return renderMeldElement(m, seat, state.players, { key: key3, variant: state.rules.variant ?? "H", concealedKanPrivate: state.rules.concealedKanPrivate, viewerSeat: humanSeat, revealed: kanPeek.isRevealed(key3), onToggle: () => {
    if (kanPeek.isRevealed(key3)) kanPeek.clear();
    else kanPeek.reveal(key3);
  } });
}
function renderMeldZone(player, position, seat) {
  if (!player.melds.length) return;
  const zone = node2("div", void 0, `meld-zone meld-zone-${position}`), rack = node2("div", void 0, "meld-rack");
  zone.setAttribute("aria-label", `${seatName(seat)} \uBAB8\uD1B5 \xB7 \uC790\uAE30 \uAE30\uC900 \uC67C\uCABD`);
  for (const [index, m] of player.melds.entries()) {
    const group = renderMeld(m, seat, index);
    group.dataset.meldOrder = String(index + 1);
    rack.append(group);
  }
  zone.append(rack);
  $("melds").append(zone);
}
function renderMelds() {
  kanPeek.setContext(JSON.stringify([online ? "online" : "practice", humanSeat, journal.current?.id, remote?.code, remote?.gameNumber]));
  const focused = document.hasFocus() ? document.activeElement?.dataset.meldKey : null;
  $("melds").replaceChildren();
  for (const [position, seat] of Object.entries(seatPositions(humanSeat))) renderMeldZone(state.players[seat], position, seat);
  if (focused) {
    for (const button of $("melds").querySelectorAll("button[data-meld-key]")) if (button.dataset.meldKey === focused) button.focus({ preventScroll: true });
  }
  updateTableLayout();
}
function renderRiver(parent, player) {
  parent.replaceChildren();
  let row;
  for (const [index, d] of player.river.entries()) {
    if (index % 6 === 0) {
      row = node2("div", void 0, "river-row");
      parent.append(row);
    }
    const t = tileFace(typeOf(d.id), { small: true });
    t.classList.toggle("claimed", !!d.claimed);
    t.classList.toggle("riichi-discard", !!d.riichi);
    t.classList.toggle("last-discard", state.phase === "reaction" && state.reaction.id === d.id);
    const label2 = [tileName(typeOf(d.id)), d.riichi ? "\uB9AC\uCE58 \uC120\uC5B8 \uD328" : null, d.claimed ? "\uD6C4\uB85C\uC5D0 \uC0AC\uC6A9\uB428" : null].filter(Boolean).join(", ");
    t.setAttribute("aria-label", label2);
    t.title = label2;
    row.append(t);
  }
}
function renderDora() {
  const panel = $("dora-panel"), seat = state.winners[0] ?? humanSeat, view = doraDisplay(state, seat);
  panel.hidden = !view;
  panel.replaceChildren();
  if (!view) return;
  const heading = node2("div", void 0, "dora-heading"), winner = state.players[seat].won;
  const count = winner && state.players[seat].win.score.yakuman ? "\uC5ED\uB9CC \xB7 \uB3C4\uB77C \uAC00\uC0B0 \uC5C6\uC74C" : `${winner ? seatName(seat) + " \uD654\uB8CC\uD328" : "\uB0B4 \uD328"} \uB3C4\uB77C ${view.count}\uD310${view.uraCount !== null ? " \xB7 \uC6B0\uB77C\uB3C4\uB77C " + view.uraCount + "\uD310" : ""}`;
  heading.append(node2("strong", "\uB3C4\uB77C"), node2("span", count));
  panel.append(heading);
  for (const [label2, pairs] of [["\uD45C\uC2DC\uD328 \u2192 \uB3C4\uB77C", view.visible], ["\uC6B0\uB77C \uD45C\uC2DC\uD328 \u2192 \uC6B0\uB77C\uB3C4\uB77C", view.ura]]) {
    if (!pairs.length) continue;
    const group = node2("div", void 0, "dora-group");
    group.append(node2("span", label2, "dora-label"));
    for (const pair of pairs) {
      const item = node2("span", void 0, "dora-pair");
      item.title = `\uD45C\uC2DC\uD328 ${tileName(pair.indicator)} \u2192 \uB3C4\uB77C ${tileName(pair.dora)}`;
      item.append(tileFace(pair.indicator, { small: true }), node2("span", "\u2192", "dora-arrow"), tileFace(pair.dora, { small: true }));
      group.append(item);
    }
    panel.append(group);
  }
  panel.append(node2("p", "1\uC7A5\uB2F9 1\uD310 \xB7 \uD654\uB8CC \uC5ED\uC774 \uC788\uC5B4\uC57C \uB3C4\uB77C\uB97C \uAC00\uC0B0\uD569\uB2C8\uB2E4.", "dora-note"));
}
function renderHanBreakdown(detail) {
  const section = node2("div", void 0, "han-breakdown"), groups = node2("div", void 0, "han-groups");
  const bonusEntries = [...detail.bonuses];
  if (!detail.yakuman && !bonusEntries.some((e) => e.id === "dora")) bonusEntries.push({ name: "\uB3C4\uB77C", han: 0 });
  for (const [label2, entries] of [["\uC131\uB9BD \uC5ED", detail.yaku], ["\uAC00\uC0B0", detail.yakuman ? [] : bonusEntries]]) {
    if (!entries.length) continue;
    const group = node2("div", void 0, "han-group"), list = node2("ul", void 0, "han-list");
    group.append(node2("h3", label2));
    for (const entry of entries) {
      const row = node2("li");
      row.append(node2("span", entry.name), node2("strong", detail.yakuman ? "\uC5ED\uB9CC" : `${entry.han}\uD310`));
      list.append(row);
    }
    group.append(list);
    groups.append(group);
  }
  section.append(groups, node2("p", detail.summary, "han-total"));
  return section;
}
function discardMetrics(discard) {
  return `${discard.shanten === 0 ? "\uD150\uD30C\uC774 (0\uC0E8\uD150)" : discard.shanten + "\uC0E8\uD150"} \xB7 \uC720\uD6A8\uD328 \uCD94\uC815 ${discard.ukeire}\uC7A5`;
}
function renderDiscardRanking(discard) {
  const details = node2("details", void 0, "discard-ranking");
  details.append(node2("summary", `\uBC84\uB9BC\uD328 \uD6C4\uBCF4 ${discard.ranking.length}\uAC1C \xB7 \uC810\uC218\uC640 \uC774\uC720`));
  if (discard.reason) details.append(node2("p", discard.reason));
  const list = node2("ol");
  for (const row of discard.ranking) {
    const li = node2("li"), title = node2("strong", `${row.rank}\uC704 \xB7 ${tileName(row.tile)}${row.selected ? " \xB7 \uCD94\uCC9C" : ""}`);
    li.append(title, node2("span", `\uD3C9\uAC00 ${row.score.toFixed(2)} \xB7 ${row.shanten}\uC0E8\uD150 \xB7 \uC720\uD6A8\uD328 ${row.ukeire}\uC7A5`));
    li.append(node2("span", Object.entries(row.components).map(([key3, value2]) => `${{ speed: "\uC0E8\uD150", ukeire: "\uC720\uD6A8\uD328", value: "\uC5ED \uAC00\uCE58", pinfu: "\uD551\uD6C4 \uD615\uD0DC", risk: "\uC704\uD5D8" }[key3]} ${value2 >= 0 ? "+" : ""}${value2.toFixed(2)}`).join(" / "), "ranking-components"));
    list.append(li);
  }
  details.append(list, node2("p", "\uAC19\uC740 \uC804\uB7B5 \uC548\uC758 \uD6C4\uBCF4 \uBE44\uAD50\uC6A9 \uD3C9\uAC00\uC810\uC218\uC785\uB2C8\uB2E4. \uC608\uC0C1 \uC218\uC775\xB7\uD655\uB960\xB7\uAC15\uD654\uD559\uC2B5 Q\uAC12\uC774 \uC544\uB2D9\uB2C8\uB2E4."));
  if (discard.excludedCount) details.append(node2("p", `\uC0E8\uD150\uC774 \uB108\uBB34 \uB298\uC5B4\uB098\uB294 \uBC84\uB9BC\uD328 ${discard.excludedCount}\uC885\uC740 \uC774 \uC804\uB7B5\uC758 \uD6C4\uBCF4\uC5D0\uC11C \uC81C\uC678\uD588\uC2B5\uB2C8\uB2E4.`));
  return details;
}
function renderRecommendations() {
  const revision = ++recommendationRevision, list = $("recommendation-list"), status = $("recommendation-status");
  currentRecommendations = [];
  list.replaceChildren();
  if (!recommendationsEnabled) {
    status.textContent = "\uC804\uB7B5 \uCD94\uCC9C\uC744 \uAED0\uC2B5\uB2C8\uB2E4.";
    return;
  }
  if (state.phase === "end") {
    status.textContent = "\uAD6D\uC774 \uB05D\uB0AC\uC2B5\uB2C8\uB2E4. \uC0C8 \uAD6D\uC744 \uC2DC\uC791\uD558\uBA74 \uCD94\uCC9C\uC774 \uD45C\uC2DC\uB429\uB2C8\uB2E4.";
    return;
  }
  if (state.players[humanSeat].won) {
    status.textContent = "\uD654\uB8CC\uB97C \uB9C8\uCCE4\uC2B5\uB2C8\uB2E4. \uB0A8\uC740 \uB300\uAD6D\uC744 \uC9C0\uCF1C\uBCF4\uC138\uC694.";
    return;
  }
  if (auto) {
    status.textContent = "\uB0B4 \uC790\uB9AC\uB3C4 AI\uAC00 \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4. \uC790\uB3D9 \uB300\uAD6D\uC744 \uBA48\uCD94\uBA74 \uCD94\uCC9C\uC744 \uC9C1\uC811 \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
    return;
  }
  if (networkBusy) {
    status.textContent = "\uC11C\uBC84 \uC751\uB2F5\uC744 \uAE30\uB2E4\uB9AC\uB294 \uC911\uC785\uB2C8\uB2E4.";
    return;
  }
  if (actor4(state) !== humanSeat) {
    status.textContent = "\uB0B4 \uC120\uD0DD \uCC28\uB840\uAC00 \uB418\uBA74 A~E \uC804\uB7B5\uC758 \uCD94\uCC9C\uC744 \uD568\uAED8 \uBCF4\uC5EC\uC90D\uB2C8\uB2E4.";
    return;
  }
  if (needsPass(state, humanSeat)) {
    status.textContent = "\uC9C0\uAE08\uC740 \uB118\uAE30\uAE30\uB9CC \uAC00\uB2A5\uD574 0.7\uCD08 \uB4A4 \uC790\uB3D9\uC73C\uB85C \uC9C4\uD589\uD569\uB2C8\uB2E4.";
    return;
  }
  const view = observation4(state, humanSeat);
  currentRecommendations = strategyRecommendations(view, trainingWeights(view, trainingMode, TRAINING));
  const selectedVersion = privateTrainingCompatible(view) && privateTrainingVersion(trainingMode);
  if (selectedVersion) {
    for (const rec of currentRecommendations) if (rec.policy === selectedVersion.policy) rec.name = `${selectedVersion.id} \xB7 ${selectedVersion.name}`;
  }
  status.textContent = "\uBC84\uD2BC\uC744 \uB204\uB974\uBA74 \uD574\uB2F9 \uC804\uB7B5\uC758 \uC120\uD0DD\uC744 \uD55C \uBC88 \uC2E4\uD589\uD569\uB2C8\uB2E4.";
  for (const rec of currentRecommendations) {
    const card = node2("article", void 0, "recommendation-card"), title = node2("h4");
    title.append(node2("span", rec.policy, "policy-badge"), node2("span", rec.name));
    card.append(title, node2("p", rec.reason, "recommendation-reason"));
    if (rec.action.type === "discard") card.append(node2("p", discardMetrics(rec.discard), "recommendation-metrics"));
    const button = node2("button", rec.label, "recommendation-action" + (["ron", "tsumo"].includes(rec.action.type) ? " is-win" : ""));
    button.setAttribute("aria-label", `${rec.policy} \uC804\uB7B5 \uCD94\uCC9C \uC2E4\uD589: ${rec.label}`);
    button.onclick = () => actRecommendation(rec.policy, "recommended", revision);
    card.append(button);
    if (rec.discard && rec.action.type !== "discard") {
      const alternative = node2("div", void 0, "recommendation-alternative");
      alternative.append(node2("p", rec.action.type === "riichi" ? "\uB9AC\uCE58 \uC5C6\uC774 \uBC84\uB9B0\uB2E4\uBA74" : "\uAE61 \uB300\uC2E0 \uBC84\uB9B0\uB2E4\uBA74", "alternative-title"), node2("p", discardMetrics(rec.discard), "recommendation-metrics"));
      const discardButton = node2("button", rec.discard.label, "recommendation-discard");
      discardButton.setAttribute("aria-label", `${rec.policy} \uC804\uB7B5 \uBC84\uB9BC\uD328 \uB300\uC548 \uC2E4\uD589: ${rec.discard.label}`);
      discardButton.onclick = () => actRecommendation(rec.policy, "discard", revision);
      alternative.append(discardButton);
      card.append(alternative);
    }
    if (rec.discard?.ranking?.length) card.append(renderDiscardRanking(rec.discard));
    list.append(card);
  }
}
function executeRecommendation(policy, mode, revision) {
  if (!Object.hasOwn(POLICIES2, policy) || !["recommended", "discard"].includes(mode)) throw new Error("\uC804\uB7B5\uACFC \uCD94\uCC9C \uC885\uB958\uB97C \uB2E4\uC2DC \uC120\uD0DD\uD558\uC138\uC694.");
  if (!Number.isSafeInteger(revision) || revision !== recommendationRevision) throw new Error("\uB300\uAD6D \uC0C1\uD0DC\uAC00 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4. \uC0C8 \uCD94\uCC9C\uC744 \uD655\uC778\uD558\uC138\uC694.");
  if (!recommendationsEnabled) throw new Error("\uC804\uB7B5 \uCD94\uCC9C\uC744 \uBA3C\uC800 \uCF1C \uC8FC\uC138\uC694.");
  if (auto || actor4(state) !== humanSeat) throw new Error("\uB0B4\uAC00 \uC9C1\uC811 \uC120\uD0DD\uD558\uB294 \uCC28\uB840\uC5D0\uB9CC \uCD94\uCC9C\uC744 \uC2E4\uD589\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
  const rec = currentRecommendations.find((r) => r.policy === policy), action = mode === "discard" ? rec?.discard?.action : rec?.action;
  if (!action) throw new Error("\uC9C0\uAE08 \uC2E4\uD589\uD560 \uC218 \uC788\uB294 \uCD94\uCC9C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const result = playHumanAction(action);
  return result?.then ? result.then((value2) => ({ policy, action: { ...action }, ...value2 })) : { policy, action: { ...action }, ...result };
}
function actRecommendation(policy, mode, revision) {
  try {
    const result = executeRecommendation(policy, mode, revision);
    if (result?.then) return result.catch((e) => {
      $("error").textContent = e.message;
    });
    return result;
  } catch (e) {
    $("error").textContent = e.message;
  }
}
function render() {
  const variant = state.rules.variant === "S" ? "S" : "H";
  renderTrainingMode(variant);
  const match = currentMatch();
  document.querySelector(".room-label").textContent = `${variant} RULE \xB7 ${match ? matchFormatName(summaryFormat(match)) + (summaryFormat(match) === "hanchan" ? " \xB7 " + match.label : "") : online ? "4\uC778 \uB300\uAD6D" : "\uD63C\uC790 \uC5F0\uC2B5"}`;
  document.querySelector(".wind-mark").textContent = variant;
  $("s-rule-status").hidden = variant !== "S";
  if (variant === "S") $("s-rule-status").textContent = `${state.rules.roundWind === 28 ? "\uB0A8\uC7A5" : "\uB3D9\uC7A5"} \xB7 ${match ? matchFormatName(summaryFormat(match)) + " \uAE30\uB85D \xB7 " : ""}\uCE5C ${seatName(state.dealer)} \xB7 \uACF5\uD0C1 ${match?.pot ?? state.pot ?? 0}\uC810`;
  renderDora();
  const a = actor4(state), shownTurn = displayedTurn(state), p = state.players[humanSeat], positions = seatPositions(humanSeat);
  const reacting = state.phase === "reaction", humanChoice = reacting && a === humanSeat && !auto && !needsPass(state, humanSeat);
  $("game-status").textContent = match?.status === "complete" ? matchFormatName(summaryFormat(match)) + " \uC644\uB8CC" : state.end ? `${state.end === "three-winners" ? "\uC138 \uBC88\uC9F8 \uD654\uB8CC" : state.end === "win" ? "\uD654\uB8CC" : "\uC720\uAD6D"} \xB7 \uAD6D \uC885\uB8CC` : p.won ? "\uD654\uB8CC \uC644\uB8CC \xB7 \uB0A8\uC740 \uB300\uAD6D \uC9C4\uD589 \uC911" : reacting ? humanChoice ? "\uB860 \xB7 \uD6C4\uB85C \uC120\uD0DD" : "\uD6C4\uB85C \uD655\uC778 \uC911" : a === humanSeat ? "\uB0B4 \uCC28\uB840 \xB7 \uBC84\uB9BC\uD328 \uC120\uD0DD" : `${seatName(a)} \uD50C\uB808\uC774\uC5B4 \uCC28\uB840`;
  $("turn-indicator").textContent = state.end ? "\uAD6D \uC885\uB8CC" : reacting ? humanChoice ? "\uB860 \xB7 \uD6C4\uB85C \uC120\uD0DD \uAC00\uB2A5" : "\uD6C4\uB85C \uD655\uC778 \uC911" : a === humanSeat ? "\u25CF \uB0B4 \uCC28\uB840" : `${seatName(a)} \uC9C4\uD589 \uC911`;
  $("wall").textContent = `\uB0A8\uC740 \uD328 ${state.wall.length}`;
  $("win-count").textContent = `\uD654\uB8CC ${state.winners.length} / ${variant === "S" ? 1 : 3}\uBA85`;
  $("opponents").replaceChildren();
  $("rivers").replaceChildren();
  renderMelds();
  for (const [position, i] of Object.entries(positions)) {
    const pl = state.players[i];
    const windElement = $(`wind-${position}`);
    windElement.textContent = wind(i);
    windElement.classList.toggle("active-wind", i === shownTurn);
    if (position === "bottom") continue;
    const card = node2("div", void 0, `opponent opponent-${position}${pl.won ? " won" : ""}${shownTurn === i ? " active" : ""}`), title = node2("div", void 0, "player-title"), who = node2("span", void 0, "player-seat");
    who.append(node2("span", wind(i), "seat-badge"), node2("span", online ? roomMemberName(remote.members.find((m) => m.seat === i)) : "AI", "player-name"));
    title.append(who, node2("span", match ? `${match.totals[i].toLocaleString()}\uC810` : signedPoints(pl.score), "player-score"));
    card.append(title, node2("p", pl.won ? `${pl.win.order}\uBC88\uC9F8 ${pl.win.method === "ron" ? "\uB860" : "\uCBD4\uBAA8"} \xB7 ${pl.win.score.name}` : `${seatName(i)} \xB7 \uC190\uD328 ${pl.handSize ?? pl.hand.length}\uC7A5`, "player-sub"));
    if (pl.riichi) card.append(riichiMarker(i));
    if (state.end || pl.won) {
      const revealed = node2("div", void 0, "revealed-hand");
      tiles(revealed, pl.hand.filter((id) => state.end || pl.win.method !== "tsumo" || id !== pl.win.tile).map(typeOf));
      card.append(revealed);
    } else {
      const hidden = node2("div", void 0, "hidden-hand");
      hidden.setAttribute("aria-hidden", "true");
      for (let j = 0; j < (pl.handSize ?? pl.hand.length); j++) hidden.append(node2("span", void 0, "tile-back"));
      card.append(hidden);
    }
    $("opponents").append(card);
    const river = node2("div", void 0, `river river-${position}`);
    river.setAttribute("aria-label", `${seatName(i)} \uBC84\uB9BC\uD328`);
    renderRiver(river, pl);
    $("rivers").append(river);
  }
  $("self-title").replaceChildren(node2("span", wind(humanSeat), "seat-badge"), node2("span", `${seatName(humanSeat)} \xB7 \uB098`), node2("span", match ? `${matchFormatName(summaryFormat(match))} ${match.totals[humanSeat].toLocaleString()}\uC810` : `\uAD6D \uB204\uC801 ${signedPoints(p.score)}\uC810`, "self-score"));
  if (p.riichi) $("self-title").append(riichiMarker(humanSeat));
  if (p.won) $("self-title").append(node2("span", `${p.win.order}\uBC88\uC9F8 \uD654\uB8CC`, "player-sub"));
  const settledSeat = variant === "S" ? state.winners[0] : humanSeat, settlement = settledSeat === void 0 ? null : winSettlement(state, settledSeat), result = $("win-settlement");
  result.hidden = !settlement;
  result.replaceChildren();
  if (settlement) {
    result.append(node2("strong", `${variant === "S" ? seatName(settledSeat) + " \xB7 " : ""}${settlement.title}`));
    if (settlement.breakdown) result.append(renderHanBreakdown(settlement.breakdown));
    result.append(node2("p", settlement.calculation));
    if (variant === "H" && settlement.bonusDetails) result.append(node2("p", settlement.bonusDetails));
    if (settlement.previousNet !== 0) result.append(node2("p", `\uD654\uB8CC \uC804 \uB204\uC801 ${signedPoints(settlement.previousNet)}\uC810 \u2192 \uAD6D \uB204\uC801 ${signedPoints(settlement.net)}\uC810`));
  }
  const legal = a === humanSeat ? legalActions4(state) : [], hand = handDisplay(state, humanSeat), automaticPass = needsPass(state, humanSeat);
  $("hand").replaceChildren();
  for (const id of hand.held) $("hand").append(handTile(id, legal));
  if (hand.drawn !== null) {
    const group = node2("div", void 0, "drawn-group");
    group.append(node2("span", "\uBF51\uC740 \uD328", "drawn-label"), handTile(hand.drawn, legal, true));
    $("hand").append(group);
  }
  $("actions").replaceChildren();
  if (state.phase === "reaction" && a === humanSeat) {
    const label2 = node2("span", void 0, "reaction-label");
    label2.append(tileFace(typeOf(state.reaction.id), { small: true }), node2("span", tileName(typeOf(state.reaction.id))));
    $("actions").append(label2);
  }
  if (automaticPass) $("actions").append(node2("span", "\uAC00\uB2A5\uD55C \uD6C4\uB85C \uC5C6\uC74C \xB7 0.7\uCD08 \uB4A4 \uC790\uB3D9 \uB118\uAE30\uAE30", "auto-pass-note"));
  for (const action of legal.filter((a2) => a2.type !== "discard" && !(automaticPass && a2.type === "pass"))) {
    const b = node2("button", actionLabel(action, { melds: p.melds, legalActions: legal }), ["ron", "tsumo"].includes(action.type) ? "win" : "");
    b.disabled = auto || networkBusy;
    b.onclick = () => act(action);
    $("actions").append(b);
  }
  if (legal.some((a2) => a2.type === "discard")) {
    const b = node2("button", "\uBC84\uB9AC\uAE30", "discard-confirm");
    b.id = "discard-confirm";
    b.onclick = () => {
      try {
        confirmDiscard();
      } catch (e) {
        $("error").textContent = e.message;
      }
    };
    $("actions").append(b);
  }
  renderRiver($("self-river"), p);
  updateSelection();
  renderRecommendations();
  renderMatch();
  updateTableLayout();
  $("events").replaceChildren();
  for (const e of state.events.filter((e2) => ["win", "kan", "drawSettlement", "call"].includes(e2.type)).slice(-30)) {
    const settlement2 = e.type === "win" ? winSettlement(state, e.seat) : null;
    const text = settlement2 ? `${seatName(e.seat)}: ${settlement2.title} \xB7 ${settlement2.calculation}` : e.type === "call" ? `${seatName(e.seat)}: ${e.action.type}` : e.type === "kan" ? `${seatName(e.seat)}: \uAE61, \uBCF4\uCDA9\uD328 \uC218\uB839` : "\uC720\uAD6D \uD150\uD30C\uC774 \uC815\uC0B0 \uC644\uB8CC";
    $("events").append(node2("li", text));
  }
}
function updateTableLayout() {
  const surface = document.querySelector(".table-surface"), center = surface?.querySelector(".table-center"), own = $("self-river");
  if (!surface?.clientWidth || !center || !state) return;
  const style = getComputedStyle(own), rowHeight = parseFloat(style.getPropertyValue("--river-tile-height")), gap = parseFloat(style.rowGap), riverWidth = Math.max(...Array.from(surface.querySelectorAll(".river"), (el) => el.offsetWidth));
  if (!Number.isFinite(rowHeight) || !Number.isFinite(gap)) return;
  const depth = (position) => {
    const el = surface.querySelector(".river-" + position);
    return Math.max(3, el?.children.length ?? 0) * (rowHeight + gap) - gap;
  };
  const compact = matchMedia("(max-width:760px)").matches, topCard = surface.querySelector(".opponent-top"), leftCard = surface.querySelector(".opponent-left"), rightCard = surface.querySelector(".opponent-right");
  const set = (name, value2) => surface.style.setProperty(name, `${value2}px`), edge = compact ? 8 : 14, meldSizes = {};
  for (const position of ["bottom", "right", "top", "left"]) {
    const zone = surface.querySelector(".meld-zone-" + position), rack = zone?.querySelector(".meld-rack");
    if (!rack) {
      meldSizes[position] = { width: 0, height: 0 };
      continue;
    }
    const sideways = position === "left" || position === "right", scale = sideways ? 1 : Math.min(1, (surface.clientWidth - 2 * edge) / rack.offsetWidth);
    const width = (sideways ? rack.offsetHeight : rack.offsetWidth) * scale, height = (sideways ? rack.offsetWidth : rack.offsetHeight) * scale;
    zone.style.width = `${width}px`;
    zone.style.height = `${height}px`;
    zone.style.setProperty("--meld-scale", String(scale));
    meldSizes[position] = { width, height };
  }
  const topMeldBand = meldSizes.top.height ? meldSizes.top.height + 12 : 0, bottomMeldBand = meldSizes.bottom.height ? meldSizes.bottom.height + 12 : 0;
  const leftInset = edge + (meldSizes.left.width ? meldSizes.left.width + 12 : 0), rightInset = edge + (meldSizes.right.width ? meldSizes.right.width + 12 : 0);
  set("--meld-edge", edge);
  set("--top-meld-band", topMeldBand);
  set("--bottom-meld-band", bottomMeldBand);
  set("--top-card-y", 14 + topMeldBand);
  set("--left-card-x", leftInset);
  set("--right-card-x", rightInset);
  set("--bottom-river-y", 14 + bottomMeldBand);
  const sideCardHeight = Math.max(leftCard?.offsetHeight ?? 0, rightCard?.offsetHeight ?? 0), sideCardWidth = Math.max(leftCard?.offsetWidth ?? 0, rightCard?.offsetWidth ?? 0);
  const separateCards = compact && (meldSizes.left.width > 0 || meldSizes.right.width > 0), cardsTop = Math.max(compact ? 112 : 114, (topCard?.offsetTop ?? 14) + (topCard?.offsetHeight ?? 80) + 14);
  const topOffset = cardsTop + (separateCards ? sideCardHeight + 14 : 0), topDepth = depth("top"), bottomDepth = depth("bottom");
  const topBand = Math.max(topDepth, compact && !separateCards ? sideCardHeight : 0), sideSpace = (inset) => Math.max(20, (surface.clientWidth - center.offsetWidth) / 2 - 12 - inset - (compact ? 0 : sideCardWidth + 16));
  const leftScale = Math.min(1, sideSpace(leftInset) / depth("left")), rightScale = Math.min(1, sideSpace(rightInset) / depth("right"));
  const middleBand = Math.max(center.offsetHeight + 8, riverWidth * leftScale, riverWidth * rightScale, compact ? 0 : sideCardHeight), centerY = topOffset + topBand + 14 + middleBand / 2;
  set("--river-min-depth", 3 * (rowHeight + gap) - gap);
  set("--top-river-y", topOffset + (topBand - topDepth) / 2);
  set("--side-card-y", separateCards ? cardsTop + sideCardHeight / 2 : topOffset + topBand / 2);
  set("--table-center-y", centerY);
  set("--table-required-height", Math.max(centerY + middleBand / 2 + 14 + bottomDepth + 14 + bottomMeldBand, topMeldBand + bottomMeldBand + Math.max(meldSizes.left.height, meldSizes.right.height) + 2 * edge));
  set("--left-river-x", surface.clientWidth / 2 - center.offsetWidth / 2 - 12 - depth("left") * leftScale / 2);
  set("--right-river-x", surface.clientWidth / 2 + center.offsetWidth / 2 + 12 + depth("right") * rightScale / 2);
  surface.style.setProperty("--left-river-scale", String(leftScale));
  surface.style.setProperty("--right-river-scale", String(rightScale));
}
window.addEventListener("resize", updateTableLayout);
function aiAction(view) {
  return practiceAction(view, { humanSeat, policy: $("policy").value, profile: $("profile").value, mode: trainingMode, training: TRAINING });
}
function loggedStep(game, seat, action) {
  const before = beforeAction(game);
  try {
    const result = step3(game, seat, action);
    journal.record(game, seat, action, before);
    return result;
  } catch (error) {
    journal.record(game, seat, action, before, error);
    journal.error(game, error);
    renderLogs();
    throw error;
  }
}
function finishAction() {
  resolveAiReactions(state, humanSeat, aiAction, loggedStep);
  savePractice();
  renderLogs();
  render();
  schedule();
}
function playHumanAction(action) {
  if (auto || actor4(state) !== humanSeat) throw new Error("\uB0B4 \uCC28\uB840\uC5D0 \uC9C1\uC811 \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
  if (online) return playOnlineAction(action);
  loggedStep(state, humanSeat, action);
  selectedTileId = null;
  $("error").textContent = "";
  finishAction();
  return { seat: humanSeat, phase: state.phase, turn: actor4(state) };
}
async function playOnlineAction(action) {
  if (networkBusy || !roomClient.connected) throw new Error("\uC11C\uBC84 \uC751\uB2F5\uC744 \uAE30\uB2E4\uB824 \uC8FC\uC138\uC694.");
  networkBusy = true;
  selectedTileId = null;
  render();
  try {
    await roomClient.act(action);
    $("error").textContent = "";
    return { seat: humanSeat, phase: state.phase, turn: actor4(state) };
  } finally {
    networkBusy = false;
    if (online && remote?.state) render();
  }
}
function act(action) {
  try {
    const result = playHumanAction(action);
    if (result?.then) return result.catch((e) => {
      $("error").textContent = e.message;
    });
    return result;
  } catch (e) {
    $("error").textContent = e.message;
  }
}
function tick() {
  timer = null;
  if (state.phase === "end") {
    render();
    return;
  }
  const seat = actor4(state), automaticPass = needsPass(state, humanSeat);
  if (seat === humanSeat && !auto && !automaticPass) {
    render();
    return;
  }
  try {
    if (automaticPass) {
      loggedStep(state, humanSeat, { type: "pass" });
    } else {
      loggedStep(state, seat, aiAction(observation4(state)));
    }
    finishAction();
  } catch (e) {
    $("error").textContent = e.message;
    auto = false;
    updateAuto();
  }
}
function schedule() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (online) return;
  if (auto && practiceMatch?.status === "between-rounds") {
    const expected = practiceMatch.handNumber;
    timer = setTimeout(() => {
      timer = null;
      nextPracticeHand(expected);
    }, 1200);
    return;
  }
  const delay = nextDelay(state, auto, humanSeat);
  if (delay !== null) timer = setTimeout(tick, delay);
}
function updateAuto() {
  $("autoplay").setAttribute("aria-pressed", String(auto));
  $("autoplay").textContent = auto ? "\uC790\uB3D9 \uB300\uAD6D \uBA48\uCD94\uAE30" : "\uB0B4 \uC790\uB9AC\uB3C4 AI\uB85C";
}
function savePractice() {
  if (online) return;
  if (practiceMatch && state.end) recordRound3(practiceMatch, state, { logId: journal.current?.id });
  if (practiceMatch?.status === "complete") {
    auto = false;
    updateAuto();
  }
  journal.save(state);
  if (practiceMatch) matchStore.save({ match: practiceMatch, seat: humanSeat, log: journal.read(), policy: $("policy").value, profile: $("profile").value });
}
function practiceInfo() {
  const match = currentMatch();
  $("practice-info").textContent = `\uB0B4 \uC790\uB9AC\uB294 ${seatName(humanSeat)}\uC785\uB2C8\uB2E4. ${match ? matchTitle(match) + (summaryFormat(match) === "hanchan" ? " \xB7 " + match.label : "") + " \xB7 \uC810\uC218\uC640 \uC9C4\uD589 \uC0C1\uD0DC\uB97C \uC790\uB3D9 \uC800\uC7A5\uD569\uB2C8\uB2E4." : "\uC0C1\uB300 3\uBA85\uC740 AI\uC785\uB2C8\uB2E4."} \uD328\uB97C \uC120\uD0DD\uD55C \uB4A4 \uB2E4\uC2DC \uB204\uB974\uAC70\uB098 \uBC84\uB9AC\uAE30\uB85C \uD655\uC815\uD558\uC138\uC694. \uAC00\uB2A5\uD55C \uD6C4\uB85C\uAC00 \uC5C6\uC73C\uBA74 0.7\uCD08 \uB4A4 \uB118\uAE41\uB2C8\uB2E4.`;
}
function beginPracticeHand() {
  kanPeek.clear({ notify: false });
  journal.begin(state, { mode: "practice", seat: humanSeat, policy: $("policy").value, profile: $("profile").value, build: buildId });
  savePractice();
  $("seed").value = String(practiceMatch?.seed ?? state.seed);
  selectedTileId = null;
  practiceInfo();
  $("error").textContent = "";
  renderLogs();
  render();
  schedule();
}
function start(seed, variant = chosenVariant, format2 = variant === chosenVariant ? chosenFormat : defaultMatchFormat(variant)) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("\uC2DC\uB4DC\uB294 0\u20134294967295\uC758 \uC815\uC218\uC5EC\uC57C \uD569\uB2C8\uB2E4.");
  if (!["single", "hanchan"].includes(format2)) throw new Error("\uB2E8\uD310\uC804 \uB610\uB294 \uBC18\uC7A5\uC804\uC744 \uC120\uD0DD\uD558\uC138\uC694.");
  if (state && !online) savePractice();
  setVariant(variant, format2);
  showPractice();
  if (timer) clearTimeout(timer);
  auto = false;
  updateAuto();
  humanSeat = practiceSeat(seed);
  practiceMatch = createMatch3({ seed, variant, format: format2 });
  state = createMatchGame3(practiceMatch);
  beginPracticeHand();
  return { seed, variant, format: format2, seat: humanSeat, remaining: state.wall.length, match: currentMatch() };
}
function nextPracticeHand(expected = practiceMatch?.handNumber) {
  if (online || !practiceMatch) throw new Error("\uC9C4\uD589 \uC911\uC778 \uBC18\uC7A5\uC804\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const game = advanceMatch3(practiceMatch, expected);
  if (timer) clearTimeout(timer);
  state = game;
  beginPracticeHand();
  return currentMatch();
}
function restorePractice(force = false) {
  const saved = matchStore.restore({ force });
  if (!saved) return false;
  if (timer) clearTimeout(timer);
  showPractice();
  auto = false;
  updateAuto();
  practiceMatch = saved.match;
  state = saved.log.game;
  humanSeat = saved.seat;
  journal.current = saved.log;
  if (saved.policy in POLICIES2) $("policy").value = saved.policy;
  if (privateTrainingCompatible(state) && privateTrainingVersion(trainingMode)) $("policy").value = privateTrainingVersion(trainingMode).policy;
  if (saved.profile in OPPONENT_PROFILES2) $("profile").value = saved.profile;
  setVariant(state.rules.variant === "S" ? "S" : "H", practiceMatch.format ?? defaultMatchFormat(state.rules.variant));
  savePractice();
  selectedTileId = null;
  $("seed").value = String(practiceMatch.seed);
  practiceInfo();
  renderLogs();
  render();
  schedule();
  return true;
}
function renderMatch() {
  const match = currentMatch();
  $("match-panel").hidden = !match;
  $("resume-s-match").hidden = !matchStore.read()?.active || !online && !!practiceMatch;
  const active = matchStore.read()?.active;
  if (active) {
    const savedVariant = active.match.rules.variant === "S" ? "S" : "H";
    $("resume-s-match").textContent = `\uC800\uC7A5\uB41C ${savedVariant}\uB8F0 ${matchFormatName(active.match.format ?? defaultMatchFormat(savedVariant))} \uC774\uC5B4\uD558\uAE30`;
  }
  if (!match) return;
  $("match-panel").setAttribute("aria-label", matchTitle(match) + " \uC810\uC218");
  $("match-title").textContent = match.status === "complete" ? matchTitle(match) + " \uCD5C\uC885 \uACB0\uACFC" : matchTitle(match) + (summaryFormat(match) === "hanchan" ? " \xB7 " + match.label : "");
  $("match-rules-note").textContent = matchRulesDescription(match);
  $("match-save-status").textContent = online ? matchStore.persisted ? "\uC9C4\uD589 \uC0C1\uD0DC\uB294 \uBC29 \uB9CC\uB8CC\uAE4C\uC9C0 \xB7 \uC810\uC218\uD45C\uB294 \uC774 \uAE30\uAE30\uC5D0 \uC800\uC7A5" : matchStore.error ?? "\uC810\uC218\uD45C\uB97C \uD30C\uC77C\uB85C \uC800\uC7A5\uD574 \uC8FC\uC138\uC694." : matchStore.persisted ? "\uC774 \uAE30\uAE30\uC5D0 \uC790\uB3D9 \uC800\uC7A5\uB428" : matchStore.error ?? "\uC790\uB3D9 \uC800\uC7A5 \uBD88\uAC00 \xB7 \uC810\uC218\uD45C\uB97C \uB0B4\uB824\uBC1B\uC73C\uC138\uC694.";
  $("match-seat-note").textContent = `\uB0B4 \uC2DC\uC791 \uC790\uB9AC\uB294 ${SEAT_NAMES[humanSeat]}\uC785\uB2C8\uB2E4. \uC544\uB798 \uC810\uC218\uD45C\uB294 \uC2DC\uC791 \uC790\uB9AC\uB97C \uAE30\uC900\uC73C\uB85C \uB05D\uAE4C\uC9C0 \uAE30\uB85D\uD569\uB2C8\uB2E4.`;
  $("next-s-hand").hidden = online || match.status !== "between-rounds";
  $("next-s-hand").textContent = match.nextLabel ? `${match.nextLabel} \uC2DC\uC791` : "\uB2E4\uC74C \uAD6D";
  const expected = match.handNumber;
  $("next-s-hand").onclick = () => {
    try {
      nextPracticeHand(expected);
    } catch (e) {
      $("error").textContent = e.message;
    }
  };
  $("match-scores").replaceChildren();
  for (const r of match.rankings) {
    const who = r.seat === humanSeat ? "\uB098" : online ? roomMemberName(remote.members.find((m) => m.seat === r.seat)) : `AI ${r.seat + 1}`;
    $("match-scores").append(node2("div", `${r.rank}\uC704 ${who} \xB7 \uC2DC\uC791 ${SEAT_NAMES[r.seat]} \xB7 ${r.points.toLocaleString()}\uC810`));
  }
  $("match-rounds").replaceChildren();
  for (const r of match.rounds) {
    const tr = node2("tr");
    tr.append(node2("td", r.label), node2("td", roundResultName(r.result)));
    for (let i = 0; i < 4; i++) tr.append(node2("td", `${signedPoints(r.delta[i])} \u2192 ${r.totals[i].toLocaleString()}`));
    tr.append(node2("td", String(r.pot)));
    $("match-rounds").append(tr);
  }
  $("match-final-pot").textContent = match.finalTransfers.map((p) => `\uB300\uAD6D \uC885\uB8CC \uACF5\uD0C1 ${p.amount}\uC810 \u2192 \uC2DC\uC791 ${SEAT_NAMES[p.to]} \uC790\uB9AC`).join(" / ");
}
function downloadMatch(format2 = "json", summary = currentMatch()) {
  if (!summary) throw new Error("\uB300\uAD6D \uC810\uC218 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const a = node2("a"), text = format2 === "csv" ? matchCSV(summary) : JSON.stringify({ ...summary, variant: summaryVariant(summary), format: summaryFormat(summary), schema: "wellness-match-scores/v2" }, null, 2), blob = new Blob([text], { type: format2 === "csv" ? "text/csv;charset=utf-8" : "application/json" });
  a.href = URL.createObjectURL(blob);
  a.download = `${summaryVariant(summary)}-${matchFormatName(summaryFormat(summary))}-${summary.id.slice(0, 8)}-\uC810\uC218\uD45C.${format2}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
  return { filename: a.download, completedRounds: summary.rounds.length };
}
function showPractice() {
  kanPeek.clear({ notify: false });
  online = false;
  remote = null;
  networkBusy = false;
  roomClient.stop();
  $("practice-controls").hidden = false;
  $("room-panel").hidden = true;
  $("practice-mode").setAttribute("aria-pressed", "true");
  $("online-mode").setAttribute("aria-pressed", "false");
  document.querySelector(".play-layout").hidden = false;
}
function showOnline() {
  kanPeek.clear({ notify: false });
  if (state && !online) savePractice();
  if (timer) clearTimeout(timer);
  timer = null;
  online = true;
  auto = false;
  networkBusy = false;
  selectedTileId = null;
  updateAuto();
  $("practice-controls").hidden = true;
  $("room-panel").hidden = false;
  $("practice-mode").setAttribute("aria-pressed", "false");
  $("online-mode").setAttribute("aria-pressed", "true");
  document.querySelector(".play-layout").hidden = !remote?.state;
  $("resume-room").hidden = !roomClient.saved()?.code;
  $("practice-info").textContent = "\uB124 \uBA85\uC774 \uC785\uC7A5\uD558\uAC70\uB098, \uBC29\uC7A5\uC774 \uBE48\uC790\uB9AC\uB97C AI\uB85C \uCC44\uC6B0\uBA74 \uC2DC\uC791\uD569\uB2C8\uB2E4. \uAC01\uC790 \uC190\uD328\uB9CC \uBCFC \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
  renderMatch();
  renderLogs();
  renderTrainingMode(remote?.variant ?? chosenVariant);
  renderRoomStart();
}
function renderRoomStart() {
  const allowed = online && canStartWithAI(remote), button = $("start-ai-room");
  button.hidden = !allowed;
  button.disabled = roomMutationBusy || !roomClient.connected;
  button.textContent = roomMutationBusy ? "AI\uB97C \uCC44\uC6B0\uACE0 \uC2DC\uC791\uD558\uB294 \uC911\u2026" : `\uBE48\uC790\uB9AC ${4 - (remote?.members.length ?? 0)}\uAC1C\uB97C AI\uB85C \uCC44\uC6B0\uACE0 \uC2DC\uC791`;
  $("rematch-room").disabled = roomMutationBusy || !roomClient.connected;
}
function receiveRoom(snapshot) {
  if (!online) return;
  if (snapshot.state) {
    state = snapshot.state;
    humanSeat = snapshot.seat;
  }
  remote = snapshot;
  networkBusy = false;
  $("room-info").hidden = false;
  $("room-code").textContent = snapshot.code;
  $("room-code-input").value = snapshot.code;
  $("room-error").textContent = "";
  $("room-members").replaceChildren();
  if (!snapshot.state) renderTrainingMode(snapshot.variant ?? "H");
  if (snapshot.match) matchStore.saveSummary(snapshot.match, { seat: snapshot.seat });
  else renderMatch();
  for (let i = 0; i < 4; i++) {
    const member = snapshot.members[i], el = node2("div", member ? `${roomMemberName(member)}${member.id === snapshot.me ? " (\uB098)" : ""}${member.seat === null ? "" : ` \xB7 ${seatName(member.seat)}`}` : "\uC785\uC7A5 \uB300\uAE30 \uC911", `room-member${member?.id === snapshot.me ? " is-me" : ""}${member?.kind === "ai" ? " is-ai" : ""}`);
    $("room-members").append(el);
  }
  const roomFormat = snapshot.format ?? defaultMatchFormat(snapshot.variant), roomTitle = `${snapshot.variant ?? "H"}\uB8F0 ${matchFormatName(roomFormat)}`;
  const aiCount = snapshot.members.filter((member) => member.kind === "ai").length, humanCount = snapshot.members.length - aiCount;
  $("room-message").textContent = snapshot.state ? snapshot.state.end ? snapshot.match?.status === "complete" ? roomTitle + " \uC644\uB8CC \xB7 \uCD5C\uC885 \uC810\uC218\uB97C \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4." : "\uAD6D\uC774 \uB05D\uB0AC\uC2B5\uB2C8\uB2E4. \uBC29\uC7A5\uC774 \uB2E4\uC74C \uAD6D\uC744 \uC2DC\uC791\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." : `${roomTitle} \xB7 ${snapshot.match?.label ?? "\uC81C" + snapshot.gameNumber + "\uAD6D"} \xB7 \uC0AC\uB78C ${humanCount}\uBA85${aiCount ? " + AI " + aiCount + "\uBA85" : ""} \xB7 \uB0B4 \uC790\uB9AC ${seatName(snapshot.seat)}` : `${roomTitle} \xB7 ${humanCount}/4\uBA85 \uC785\uC7A5 \xB7 ${snapshot.host ? "\uCE5C\uAD6C\uB97C \uAE30\uB2E4\uB9AC\uAC70\uB098 \uBE48\uC790\uB9AC\uB97C AI\uB85C \uCC44\uC6CC \uBC14\uB85C \uC2DC\uC791\uD558\uC138\uC694." : "\uBC29\uC7A5\uC774 \uBE48\uC790\uB9AC\uB97C AI\uB85C \uCC44\uC6B0\uBA74 \uBC14\uB85C \uC2DC\uC791\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."}`;
  $("rematch-room").hidden = !(snapshot.host && snapshot.state?.end);
  $("rematch-room").textContent = snapshot.match?.status === "between-rounds" ? snapshot.match.nextLabel + " \uC2DC\uC791" : `\uAC19\uC740 \uBA64\uBC84\uB85C \uC0C8 ${matchFormatName(roomFormat)}`;
  document.querySelector(".play-layout").hidden = !snapshot.state;
  if (snapshot.state) {
    state = snapshot.state;
    humanSeat = snapshot.seat;
    if (journal.current?.mode !== "online" || journal.current.room !== snapshot.code || journal.current.gameNumber !== snapshot.gameNumber) journal.begin(state, { mode: "online", seat: humanSeat, room: snapshot.code, gameNumber: snapshot.gameNumber, build: buildId });
    journal.observe(state, snapshot.revision);
    $("practice-info").textContent = `${roomTitle} \xB7 \uBC29 ${snapshot.code} \xB7 \uB098\uB294 ${seatName(humanSeat)}. \uD328\uB97C \uC120\uD0DD\uD55C \uB4A4 \uB2E4\uC2DC \uB204\uB974\uAC70\uB098 \uBC84\uB9AC\uAE30\uB85C \uD655\uC815\uD558\uC138\uC694.`;
    render();
  }
  renderLogs();
  renderRoomStart();
}
async function connectRoom(join) {
  showOnline();
  $("room-error").textContent = "";
  for (const id of ["create-room", "join-room"]) $(id).disabled = true;
  try {
    return await roomClient.connect($("room-name").value, join ? $("room-code-input").value.trim().toUpperCase() : void 0, chosenVariant, chosenFormat);
  } finally {
    for (const id of ["create-room", "join-room"]) $(id).disabled = false;
  }
}
function roomError(error) {
  $("room-error").textContent = error.message;
}
async function mutateRoom(action) {
  if (roomMutationBusy) return;
  const generation = roomClient.generation;
  roomMutationBusy = true;
  $("room-error").textContent = "";
  renderRoomStart();
  try {
    return await action();
  } catch (error) {
    if (online && generation === roomClient.generation) roomError(error);
  } finally {
    roomMutationBusy = false;
    renderRoomStart();
  }
}
$("practice-mode").onclick = () => {
  if (online && !restorePractice(true)) randomGame();
};
$("resume-s-match").onclick = () => restorePractice(true);
$("download-match-json").onclick = () => downloadMatch();
$("download-match-csv").onclick = () => downloadMatch("csv");
$("online-mode").onclick = async () => {
  showOnline();
  if (roomClient.saved()?.code) try {
    await roomClient.resume();
  } catch (e) {
    roomError(e);
  }
};
$("create-room").onclick = () => connectRoom(false).catch(roomError);
$("join-room").onclick = () => connectRoom(true).catch(roomError);
$("resume-room").onclick = () => {
  showOnline();
  roomClient.resume().catch(roomError);
};
$("start-ai-room").onclick = () => mutateRoom(() => roomClient.startAI());
$("rematch-room").onclick = () => mutateRoom(() => roomClient.rematch());
$("copy-room-link").onclick = async () => {
  if (!remote) return;
  const url = new URL(location.href);
  url.hash = "room=" + remote.code;
  try {
    await navigator.clipboard.writeText(url.href);
    $("room-message").textContent = "\uCD08\uB300 \uB9C1\uD06C\uB97C \uBCF5\uC0AC\uD588\uC2B5\uB2C8\uB2E4. \uCE5C\uAD6C\uC5D0\uAC8C \uBCF4\uB0B4 \uC8FC\uC138\uC694.";
  } catch {
    $("room-message").textContent = `\uCE5C\uAD6C\uC5D0\uAC8C \uBC29 \uCF54\uB4DC ${remote.code}\uB97C \uC54C\uB824 \uC8FC\uC138\uC694.`;
  }
};
function renderLogs() {
  useArchive(() => archiveClient?.enqueue(journal.current));
  renderArchiveStatus();
  $("download-current-log").disabled = online && !remote?.state;
  const selected = $("saved-logs").value, logs = journal.list();
  $("saved-logs").replaceChildren();
  for (const log of logs) {
    const option = node2("option", `${log.id === journal.current?.id ? "\uD604\uC7AC \xB7 " : ""}${new Date(log.startedAt).toLocaleString("ko-KR")} \xB7 ${log.mode === "practice" ? "\uC5F0\uC2B5 " + log.seed : "4\uC778"} \xB7 ${log.seatName ?? SEAT_NAMES[log.seat]} \xB7 ${signedPoints(log.score)}\uC810${log.issues ? " \xB7 \uC815\uC0B0 \uD655\uC778 \uD544\uC694" : ""}`);
    option.value = log.id;
    $("saved-logs").append(option);
  }
  if (logs.some((log) => log.id === selected)) $("saved-logs").value = selected;
  $("log-save-status").textContent = journal.persisted ? "\uC790\uB3D9 \uC800\uC7A5\uB428 \xB7 \uCD5C\uADFC \uCD5C\uB300 10\uAD6D \xB7 \uC774 \uAE30\uAE30\uC5D0 \uBCF4\uAD00" : "\uAE30\uAE30 \uC800\uC7A5 \uBD88\uAC00 \xB7 \uC9C0\uAE08 \uD30C\uC77C\uB85C \uC800\uC7A5\uD574 \uC8FC\uC138\uC694.";
  const issue = journal.current?.actions.flatMap((entry) => entry.issues).at(-1);
  $("log-warning").hidden = !issue;
  $("log-warning").textContent = issue ? `\uC815\uC0B0 \uD655\uC778 \uD544\uC694: ${issue} \uB300\uAD6D \uB85C\uADF8\uB97C \uC800\uC7A5\uD574 \uC8FC\uC138\uC694.` : "";
  const old = $("saved-matches").value, matches = matchStore.list();
  $("saved-matches").replaceChildren();
  for (const { summary, seat } of matches) {
    const option = node2("option", `${new Date(summary.startedAt).toLocaleString("ko-KR")} \xB7 ${matchTitle(summary)} \xB7 ${summary.label} \xB7 ${summary.status === "complete" ? "\uC644\uB8CC" : "\uC9C4\uD589 \uAE30\uB85D"} \xB7 \uB098 ${summary.totals[seat].toLocaleString()}\uC810`);
    option.value = summary.id;
    $("saved-matches").append(option);
  }
  if (matches.some((x) => x.summary.id === old)) $("saved-matches").value = old;
  for (const id of ["review-match", "download-saved-match-json", "download-saved-match-csv"]) $(id).disabled = !matches.length;
}
function savedMatch() {
  return matchStore.list().find((x) => x.summary.id === $("saved-matches").value)?.summary;
}
function downloadLog(id, format2 = "json") {
  const log = journal.read(id);
  if (!log) throw new Error("\uC800\uC7A5\uB41C \uB300\uAD6D\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const text = format2 === "txt" ? logText(log) : JSON.stringify(compactLog(log)), a = node2("a"), blob = new Blob([text], { type: format2 === "txt" ? "text/plain;charset=utf-8" : "application/json" });
  a.href = URL.createObjectURL(blob);
  const filename = `${log.game.rules.variant === "S" ? "S" : "H"}-${log.game.seed ?? log.room}-${log.id.slice(0, 8)}-\uB300\uAD6D\uB85C\uADF8.${format2}`;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
  return { filename, actions: log.actions.length };
}
function saveCurrentLog(format2 = "json") {
  if (online && !remote?.state) throw new Error("\uC544\uC9C1 4\uC778 \uB300\uAD6D\uC774 \uC2DC\uC791\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
  return downloadLog(journal.current?.id, format2);
}
function download() {
  return saveCurrentLog();
}
function randomGame() {
  return start(crypto.getRandomValues(new Uint32Array(1))[0], chosenVariant);
}
function effectiveTrainingMode(view) {
  return trainingCompatible(view, TRAINING) && ["original", "trained"].includes(trainingMode) || privateTrainingCompatible(view) && privateTrainingVersion(trainingMode) ? trainingMode : "original";
}
function renderTrainingMode(variant = chosenVariant) {
  const view = state && (!online || remote?.state) && variant === "H" ? state : { rules: { variant } }, oldCompatible = trainingCompatible(view, TRAINING), privateCompatible = privateTrainingCompatible(view), enabled = hasTrainedPolicies(TRAINING), version = privateTrainingVersion(trainingMode);
  $("training-mode").value = effectiveTrainingMode(view);
  $("training-mode").disabled = variant === "S" || !oldCompatible && !privateCompatible;
  $("training-mode").querySelector('[value="trained"]').disabled = !oldCompatible || !enabled;
  for (const v of privateTrainingVersions()) $("training-mode").querySelector(`[value="${v.id}"]`).disabled = !privateCompatible;
  $("training-note").textContent = variant === "S" ? "S\uB8F0\uC740 \uC804\uC6A9 \uAE30\uBCF8 \uC804\uB7B5\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4." : privateCompatible ? version ? `${version.id} \xB7 ${version.description} \xB7 ${version.policy} \uCD94\uCC9C\uACFC \uB0B4 \uC790\uB3D9 \uB300\uAD6D\uC5D0 \uC801\uC6A9 \xB7 \uB2E4\uB978 \uCD94\uCC9C\uACFC \uC0C1\uB300 AI\uB294 \uAE30\uBCF8\uAC12` : "\uC548\uAE61 \uBE44\uACF5\uAC1C \uADDC\uCE59 \xB7 \uAE30\uBCF8 A\u2013E \uC0AC\uC6A9 \xB7 \uACE0\uB4DD\uC810/\uC800\uD310\uC218 \uC218\uBE44 \uBC84\uC804\uC744 \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." : oldCompatible ? trainingMode === "trained" ? "\uAD6C \uADDC\uCE59 \uAC80\uC99D \uAC00\uC911\uCE58\uB97C \uB0B4 \uCD94\uCC9C\uACFC \uC790\uB3D9 \uB300\uAD6D\uC5D0 \uC801\uC6A9" : "\uAE30\uC874 A\u2013E \uC804\uB7B5" : "\uC774 \uB300\uAD6D\uC758 \uADDC\uCE59\uACFC \uC77C\uCE58\uD558\uB294 \uD559\uC2B5 \uACB0\uACFC\uAC00 \uC5C6\uC5B4 \uAE30\uBCF8 A\u2013E\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4.";
}
function setTrainingMode(mode) {
  const version = privateTrainingVersion(mode);
  if (!["original", "trained"].includes(mode) && !version || mode === "trained" && !hasTrainedPolicies(TRAINING)) throw new Error("\uC0AC\uC6A9 \uAC00\uB2A5\uD55C \uC804\uB7B5 \uBC84\uC804\uC744 \uC120\uD0DD\uD558\uC138\uC694.");
  trainingMode = mode;
  if (version) $("policy").value = version.policy;
  saveTrainingMode(logStorage, mode);
  if (state && (!online || remote?.state)) render();
  else renderTrainingMode(remote?.variant ?? chosenVariant);
  return { mode, policies: version ? [version.policy] : Object.keys(TRAINING.weights) };
}
$("training-mode").onchange = () => setTrainingMode($("training-mode").value);
function persistPreferences() {
  savePreferences(logStorage, { variant: chosenVariant, format: chosenFormat, recommendations: recommendationsEnabled });
}
function setVariant(variant, format2 = variant === chosenVariant ? chosenFormat : defaultMatchFormat(variant)) {
  if (!["H", "S"].includes(variant)) throw new Error("H \uB610\uB294 S\uB97C \uC120\uD0DD\uD558\uC138\uC694.");
  if (!["single", "hanchan"].includes(format2)) throw new Error("\uB2E8\uD310\uC804 \uB610\uB294 \uBC18\uC7A5\uC804\uC744 \uC120\uD0DD\uD558\uC138\uC694.");
  chosenVariant = variant;
  chosenFormat = format2;
  for (const rule of ["H", "S"]) $("rule-" + rule.toLowerCase()).setAttribute("aria-pressed", String(variant === rule));
  for (const value2 of ["single", "hanchan"]) $("format-" + value2).setAttribute("aria-pressed", String(format2 === value2));
  $("random-game").textContent = `${variant}\uB8F0 \uC0C8 ${matchFormatName(format2)} \u21BB`;
  $("create-room").textContent = `${variant}\uB8F0 ${matchFormatName(format2)} \uBC29 \uB9CC\uB4E4\uAE30`;
  $("format-note").textContent = format2 === "single" ? "\uD55C \uAD6D \uC815\uC0B0 \uD6C4 \uC885\uB8CC\uD569\uB2C8\uB2E4. \uC120\uD0DD\uC740 \uC0C8 \uB300\uAD6D\xB7\uC0C8 \uBC29\uC5D0 \uC801\uC6A9\uB418\uBA70, \uC785\uC7A5\uD55C \uBC29\uC758 \uBC29\uC2DD\uC740 \uC720\uC9C0\uB429\uB2C8\uB2E4." : variant === "H" ? "\uB3D91\uAD6D~\uB0A84\uAD6D \uCD1D 8\uAD6D, \uC5F0\uC7A5 \uC5C6\uC774 \uC9C4\uD589\uD558\uB294 H\uB8F0 \uC5F0\uC2B5\uC6A9 \uBC29\uC2DD\uC785\uB2C8\uB2E4. \uC0C8 \uB300\uAD6D\xB7\uC0C8 \uBC29\uC5D0 \uC801\uC6A9\uB429\uB2C8\uB2E4." : "\uB3D91\uAD6D~\uB0A84\uAD6D\uAE4C\uC9C0 \uB204\uC801 \uC810\uC218\uB97C \uAE30\uB85D\uD558\uBA70 \uCE5C \uD654\uB8CC\xB7\uD150\uD30C\uC774 \uC2DC \uC5F0\uC7A5\uD569\uB2C8\uB2E4. \uC0C8 \uB300\uAD6D\xB7\uC0C8 \uBC29\uC5D0 \uC801\uC6A9\uB429\uB2C8\uB2E4.";
  persistPreferences();
}
function toggleRecommendations(enabled) {
  recommendationsEnabled = !!enabled;
  $("toggle-recommendations").setAttribute("aria-pressed", String(recommendationsEnabled));
  $("toggle-recommendations").textContent = "\uC804\uB7B5 \uCD94\uCC9C " + (recommendationsEnabled ? "\uCF1C\uC9D0" : "\uAEBC\uC9D0");
  document.querySelector(".recommendations").hidden = !recommendationsEnabled;
  document.querySelector(".play-layout").classList.toggle("without-recommendations", !recommendationsEnabled);
  persistPreferences();
  if (state) {
    renderRecommendations();
    updateTableLayout();
  }
  return { enabled: recommendationsEnabled };
}
$("format-single").onclick = () => setVariant(chosenVariant, "single");
$("format-hanchan").onclick = () => setVariant(chosenVariant, "hanchan");
$("rule-h").onclick = () => setVariant("H");
$("rule-s").onclick = () => setVariant("S");
$("toggle-recommendations").onclick = () => toggleRecommendations(!recommendationsEnabled);
setVariant(chosenVariant);
toggleRecommendations(recommendationsEnabled);
$("random-game").onclick = randomGame;
$("new-game").onclick = () => {
  try {
    start(Number($("seed").value));
  } catch (e) {
    $("error").textContent = e.message;
  }
};
$("autoplay").onclick = () => {
  auto = !auto;
  selectedTileId = null;
  updateAuto();
  render();
  schedule();
};
$("export").onclick = download;
$("review-log").onclick = () => {
  const log = journal.read($("saved-logs").value);
  if (!log) return;
  $("log-review").hidden = false;
  $("log-review").textContent = reviewText(log);
};
$("download-current-log").onclick = () => download();
$("download-json-log").onclick = () => downloadLog($("saved-logs").value);
$("download-text-log").onclick = () => downloadLog($("saved-logs").value, "txt");
$("download-saved-match-json").onclick = () => downloadMatch("json", savedMatch());
$("download-saved-match-csv").onclick = () => downloadMatch("csv", savedMatch());
$("review-match").onclick = () => {
  const m = savedMatch();
  if (!m) return;
  $("match-review").hidden = false;
  $("match-review").textContent = [`${matchTitle(m)} ${m.status === "complete" ? "\uCD5C\uC885 \uACB0\uACFC" : "\uC9C4\uD589 \uAE30\uB85D"} \xB7 ${m.label}`, m.rankings.map((r) => `${r.rank}\uC704 \uC2DC\uC791 ${SEAT_NAMES[r.seat]} ${r.points.toLocaleString()}\uC810`).join(" / "), ...m.rounds.map((r) => `${r.label} ${roundResultName(r.result)}: ${r.totals.map((n, i) => SEAT_NAMES[i] + " " + n + " (" + signedPoints(r.delta[i]) + ")").join(" / ")} \xB7 \uACF5\uD0C1 ${r.pot}`), ...m.finalTransfers.map((t) => `\uC885\uB8CC \uACF5\uD0C1 ${t.amount}\uC810 \u2192 \uC2DC\uC791 ${SEAT_NAMES[t.to]}`)].join("\n");
};
if (!restorePractice()) {
  if (matchStore.error) {
    const message = matchStore.error;
    start(crypto.getRandomValues(new Uint32Array(1))[0], "H");
    $("error").textContent = message;
  } else randomGame();
}
for (const saved of journal.list()) if (saved.id !== journal.current?.id) useArchive(() => archiveClient?.enqueue(journal.read(saved.id)));
var invitedRoom = /^#room=([A-Z2-9]{8})$/.exec(location.hash);
if (invitedRoom) {
  showOnline();
  $("room-code-input").value = invitedRoom[1];
  if (roomClient.saved()?.code === invitedRoom[1]) roomClient.resume().catch(roomError);
} else if (roomClient.saved()?.code) {
  showOnline();
  roomClient.resume().catch(roomError);
}
fetch(new URL("../results/baseline/analysis.json", import.meta.url)).then((r) => {
  if (!r.ok) throw new Error();
  return r.json();
}).then((data) => {
  const primary = data.pairedDifferences.find((x) => x.comparison === "C-B");
  $("conclusion").textContent = `\uAD6C \uADDC\uCE59 \uC2DC\uB098\uB9AC\uC624\uC5D0\uC11C C\uB294 B\uBCF4\uB2E4 \uAD6D\uB2F9 ${Math.abs(primary.meanDifference).toFixed(2)}\uC810 ${primary.meanDifference < 0 ? "\uB0AE\uC558\uC2B5\uB2C8\uB2E4" : "\uB192\uC558\uC2B5\uB2C8\uB2E4"}. \uD3C9\uADE0 1\uC704 ${data.conclusion.bestMeanPolicy}; \uC804\uCCB4 \uD6C4\uBCF4\uC5D0 \uB300\uD55C \uD655\uC815 \uC6B0\uC704\uB294 ${data.conclusion.dominatesAllWithBonferroniIntervals ? "\uD655\uC778\uB428" : "\uD655\uC778\uB418\uC9C0 \uC54A\uC74C"}.`;
  const reverse = data.profilePairs.filter((r) => r.comparison === "C-B" && r.ci95Low > 0);
  if (reverse.length) $("conclusion").textContent += " \uC0C1\uB300\uBCC4 \uC608\uC678: " + reverse.map((r) => `${r.profile} C\u2212B +${r.meanDifference.toFixed(2)}\uC810`).join(", ") + ".";
  for (const r of data.summary) {
    const tr = node2("tr", void 0, r.policy === data.conclusion.bestMeanPolicy ? "best" : "");
    for (const value2 of [`${r.policy} \xB7 ${POLICIES2[r.policy].name}`, r.meanNet.toFixed(2) + "\uC810", `${r.ci95Low.toFixed(2)} ~ ${r.ci95High.toFixed(2)}`, (r.winRate * 100).toFixed(1) + "%"]) tr.append(node2("td", value2));
    $("summary").append(tr);
  }
}).catch(() => {
  $("conclusion").textContent = "\uC644\uB8CC\uB41C \uACB0\uACFC \uD30C\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. headless \uC2E4\uD5D8 \uD6C4 \uBCF4\uACE0\uC11C\uB97C \uC0DD\uC131\uD558\uBA74 \uC5EC\uAE30\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4.";
});
void renderTrainingResults($, TRAINING);
function readGame() {
  if (online && !remote?.state) return { mode: "online", phase: "waiting", room: remote ? { code: remote.code, members: remote.members, variant: remote.variant, format: remote.format ?? defaultMatchFormat(remote.variant) } : null, legalActions: [], recommendations: [] };
  return { match: currentMatch(), variant: state.rules.variant === "S" ? "S" : "H", trainingMode: effectiveTrainingMode(state), trainingId: privateTrainingVersion(effectiveTrainingMode(state)) ? "H-private-kan-20261011-v1" : effectiveTrainingMode(state) === "trained" ? TRAINING.id : null, recommendationsEnabled, selectedVariant: chosenVariant, selectedFormat: chosenFormat, format: currentMatch() ? summaryFormat(currentMatch()) : remote?.format ?? defaultMatchFormat(state.rules.variant), mode: online ? "online" : "practice", room: online && remote ? { code: remote.code, members: remote.members, gameNumber: remote.gameNumber } : null, seat: humanSeat, phase: online && !remote?.state ? "waiting" : state.phase, turn: actor4(state), ownHand: state.players[humanSeat].hand.map(typeOf), drawnTile: handDisplay(state, humanSeat).drawn === null ? null : typeOf(handDisplay(state, humanSeat).drawn), scores: state.players.map((p) => p.score), winners: [...state.winners], legalActions: actor4(state) === humanSeat ? legalActions4(state) : [], recommendationRevision, recommendations: structuredClone(currentRecommendations) };
}
if (document.modelContext?.registerTool) {
  const life = new AbortController();
  window.addEventListener("pagehide", () => life.abort(), { once: true });
  for (const tool of [
    { name: "create_h_room", title: "4\uC778 \uB300\uAD6D \uBC29 \uB9CC\uB4E4\uAE30", description: "\uD654\uBA74\uC5D0\uC11C \uC120\uD0DD\uD55C H/S\uB8F0\uACFC \uB2E8\uD310\uC804/\uBC18\uC7A5\uC804\uC73C\uB85C \uBC29\uC744 \uB9CC\uB4ED\uB2C8\uB2E4. \uB124 \uBA85 \uC785\uC7A5 \uB610\uB294 \uBE48\uC790\uB9AC AI \uCC44\uC6B0\uAE30\uB85C \uC2DC\uC791\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { name: { type: "string", minLength: 1, maxLength: 20 } }, required: ["name"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async ({ name }) => {
      $("room-name").value = name;
      const room = await connectRoom(false);
      return { code: room.code, members: room.members };
    } },
    { name: "join_h_room", title: "4\uC778 \uB300\uAD6D \uBC29 \uC785\uC7A5", description: "\uC54C\uACE0 \uC788\uB294 \uBC29 \uCF54\uB4DC\uC640 \uB0B4 \uC774\uB984\uC73C\uB85C \uC628\uB77C\uC778 \uB300\uAD6D\uC5D0 \uC785\uC7A5\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { name: { type: "string", minLength: 1, maxLength: 20 }, code: { type: "string", pattern: "^[A-Z2-9]{8}$" } }, required: ["name", "code"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async ({ name, code }) => {
      $("room-name").value = name;
      $("room-code-input").value = code;
      const room = await connectRoom(true);
      return { code: room.code, members: room.members, seat: room.seat };
    } },
    { name: "start_h_game", title: "H\uB8F0 \uC0C8 \uAD6D", description: "\uC9C0\uC815\uD55C \uBC30\uD328 \uBC88\uD638\uB85C \uC0C8 \uAD6D\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4. \uAC19\uC740 \uBC88\uD638\uB294 \uB0B4 \uC790\uB9AC\uB3C4 \uB3D9\uC77C\uD558\uAC8C \uC7AC\uD604\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { seed: { type: "integer", minimum: 0, maximum: 4294967295 } }, required: ["seed"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ seed }) => start(seed, "H", "single") },
    { name: "start_practice_game", title: "H/S\uB8F0 \uC0C8 \uC5F0\uC2B5 \uB300\uAD6D", description: "H/S\uB8F0\uACFC \uB2E8\uD310\uC804/\uBC18\uC7A5\uC804\uC744 \uC120\uD0DD\uD574 \uC0C8 \uC5F0\uC2B5 \uB300\uAD6D\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { seed: { type: "integer", minimum: 0, maximum: 4294967295 }, variant: { type: "string", enum: ["H", "S"] }, format: { type: "string", enum: ["single", "hanchan"] } }, required: ["seed", "variant", "format"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ seed, variant, format: format2 }) => start(seed, variant, format2) },
    { name: "next_s_hand", title: "\uBC18\uC7A5\uC804 \uB2E4\uC74C \uAD6D", description: "\uD604\uC7AC \uAD6D\uC774 \uB05D\uB098\uBA74 \uC810\uC218\uB97C \uC774\uC6D4\uD558\uACE0 \uAC19\uC740 \uC790\uB9AC\uC5D0\uC11C \uB2E4\uC74C \uAD6D\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4. \uB0A84\uAD6D \uC885\uB8CC \uD6C4\uC5D0\uB294 \uAC70\uC808\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { handNumber: { type: "integer", minimum: 1 } }, required: ["handNumber"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ handNumber }) => nextPracticeHand(handNumber) },
    { name: "save_s_match_scores", title: "\uB300\uAD6D \uC810\uC218\uD45C \uC800\uC7A5", description: "\uB3D91\uAD6D\uBD80\uD130 \uD604\uC7AC \uAD6D\uAE4C\uC9C0\uC758 \uC810\uC218 \uBCC0\uD654\uC640 \uB204\uC801 \uC810\uC218, \uCD5C\uC885 \uC21C\uC704\uB97C \uD30C\uC77C\uB85C \uC800\uC7A5\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { format: { type: "string", enum: ["json", "csv"] } }, required: ["format"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ format: format2 }) => downloadMatch(format2) },
    { name: "set_recommendations", title: "\uC804\uB7B5 \uCD94\uCC9C \uCF1C\uAE30\xB7\uB044\uAE30", description: "\uD604\uC7AC \uB300\uAD6D\uC744 \uC720\uC9C0\uD558\uBA74\uC11C \uCD94\uCC9C \uD45C\uC2DC\uB97C \uCF1C\uAC70\uB098 \uB055\uB2C8\uB2E4. \uC124\uC815\uC740 \uC774 \uAE30\uAE30\uC5D0 \uC800\uC7A5\uB429\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { enabled: { type: "boolean" } }, required: ["enabled"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ enabled }) => toggleRecommendations(enabled) },
    { name: "read_h_game", title: "\uB300\uAD6D \uACF5\uAC1C \uC0C1\uD0DC", description: "\uB0B4 \uC790\uB9AC\xB7\uC190\uD328, \uACF5\uAC1C \uB300\uAD6D \uC0C1\uD0DC, \uD569\uBC95 \uD589\uB3D9\uACFC \uD654\uBA74\uC758 \uC804\uB7B5\uBCC4 \uCD94\uCC9C\uC744 \uD655\uC778\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: readGame },
    { name: "save_h_game_log", title: "\uD604\uC7AC \uB300\uAD6D \uB85C\uADF8 \uC800\uC7A5", description: "\uD604\uC7AC \uB300\uAD6D\uC758 \uD589\uB3D9\xB7\uC810\uC218 \uC774\uB3D9\xB7\uD654\uB8CC \uACC4\uC0B0\uACFC \uD328\uBCF4\uB97C JSON \uB610\uB294 \uC77D\uAE30 \uC26C\uC6B4 TXT \uD30C\uC77C\uB85C \uB0B4\uB824\uBC1B\uC2B5\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { format: { type: "string", enum: ["json", "txt"] } }, required: ["format"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ format: format2 }) => saveCurrentLog(format2) },
    { name: "play_h_recommendation", title: "\uC804\uB7B5 \uCD94\uCC9C \uD55C \uBC88 \uC2E4\uD589", description: "\uB0B4 \uC218\uB3D9 \uC120\uD0DD \uCC28\uB840\uC5D0 \uD654\uBA74\uC758 \uC804\uB7B5 \uCD94\uCC9C \uBC84\uD2BC\uC744 \uD55C \uBC88 \uC2E4\uD589\uD569\uB2C8\uB2E4. read_h_game\uC5D0\uC11C \uBC1B\uC740 \uCD5C\uC2E0 recommendationRevision\uC744 revision\uC73C\uB85C \uC804\uB2EC\uD558\uC138\uC694. mode=discard\uB294 \uAE61 \uB300\uC2E0 \uD45C\uC2DC\uB41C \uBC84\uB9BC\uD328 \uB300\uC548\uC744 \uC120\uD0DD\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { policy: { type: "string", enum: ["A", "B", "C", "D", "E"] }, mode: { type: "string", enum: ["recommended", "discard"] }, revision: { type: "integer", minimum: 0 } }, required: ["policy", "mode", "revision"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ policy, mode, revision }) => executeRecommendation(policy, mode, revision) }
  ]) Promise.resolve(document.modelContext.registerTool(tool, { signal: life.signal })).catch(() => {
  });
}
