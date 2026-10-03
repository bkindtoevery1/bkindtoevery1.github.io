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
var DEFAULT_RULES = Object.freeze({
  id: "H-2026-literal-v1",
  ronPassAllowed: true,
  passRonLock: "none",
  selfDiscardFuriten: false,
  pinfuClosedOnly: false,
  peikouClosedOnly: false,
  ryanpeikouDistinctSuits: true,
  concealedKanBreaksMenzen: true,
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
  roundWind: 27
});
function ruleset(overrides = {}) {
  for (const k of Object.keys(overrides)) if (!(k in DEFAULT_RULES)) throw new Error(`Unknown H ruleset key: ${k}`);
  const r = { ...DEFAULT_RULES, ...overrides, greenTiles: [...overrides.greenTiles ?? DEFAULT_RULES.greenTiles] };
  for (const k of Object.keys(DEFAULT_RULES)) {
    if (typeof DEFAULT_RULES[k] === "boolean" && typeof r[k] !== "boolean") throw new Error(`Invalid boolean ${k}`);
    if (typeof DEFAULT_RULES[k] === "number" && (!Number.isSafeInteger(r[k]) || r[k] < 0)) throw new Error(`Invalid number ${k}`);
  }
  if (!["none", "until-draw"].includes(r.passRonLock) || !["all", "nearest"].includes(r.multipleRon) || !["next-active", "next-seat"].includes(r.chiFrom)) throw new Error("Invalid rules enum");
  if (!["structural", "public-possible"].includes(r.drawWaitAvailability)) throw new Error("Invalid draw wait rule");
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
  if (counts(all).some((x) => x > 4)) return null;
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
    add("allGreen", all.every((t) => r.greenTiles.includes(t)));
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
      kan: melds.filter((m) => m.type === "kan").length * r.kanBonus,
      dragon: trip.filter((g) => g.tile >= 31).length * r.dragonBonus,
      roundWind: trip.filter((g) => g.tile === r.roundWind).length * r.roundWindBonus,
      seatWind: trip.filter((g) => g.tile === (context2.seatWind ?? 27)).length * r.seatWindBonus
    };
    for (const id of ids) allEligible.add(id);
    ids.sort((a, b) => YAKU[b][1] - YAKU[a][1]);
    const base = YAKU[ids[0]][1], bonus = Object.values(bonuses).reduce((a, b) => a + b, 0), total = base + bonus;
    if (!best || total > best.total) best = { yaku: ids[0], name: YAKU[ids[0]][0], base, bonus, total, bonuses, eligibleYaku: ids, closed, shape: d };
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
    for (const m of p.melds) for (const id of m.ids) add(id);
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
    finishOrDraw(s, r.source);
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
  const players = s.players.map((p2, i) => ({ seat: i, won: p2.won, score: p2.score, handSize: p2.hand.length, melds: p2.melds.map(meldView), discards: p2.river.map((d) => ({ tile: typeOf(d.id), claimed: d.claimed })), revealed: p2.won && s.rules.revealWinnerHand ? p2.hand.filter((id) => s.rules.revealTsumoWinningTile || p2.win.method !== "tsumo" || id !== p2.win.tile).map(typeOf) : [] }));
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
  id: "S-2026-v2",
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
  revealTsumoWinningTile: true
});
function sRules(overrides = {}) {
  for (const key3 of Object.keys(overrides)) if (!(key3 in S_DEFAULTS)) throw new Error(`Unknown S rule: ${key3}`);
  const rules = { ...S_DEFAULTS, ...overrides };
  for (const key3 of Object.keys(S_DEFAULTS)) {
    const value = rules[key3], base = S_DEFAULTS[key3];
    if (typeof value !== typeof base || typeof base === "number" && (!Number.isSafeInteger(value) || value < 0)) throw new Error(`Invalid S rule: ${key3}`);
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
    for (const m of p.melds) for (const id of m.ids) add(id);
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
  const players = s.players.map((p2, i) => ({ seat: i, won: p2.won, score: p2.score, handSize: p2.hand.length, riichi: p2.riichi, melds: p2.melds.map(meldView2), discards: p2.river.map((d) => ({ tile: typeOf(d.id), claimed: d.claimed, riichi: !!d.riichi })), revealed: p2.won && s.rules.revealWinnerHand ? handTypes2(p2) : [] }));
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
function createGame3({ variant = "H", ...options } = {}) {
  if (!["H", "S"].includes(variant)) throw new Error("Unknown rule variant");
  return (variant === "S" ? game_exports2 : game_exports).createGame(options);
}
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
  mixed: [{ id: "A" }, { id: "D" }, { id: "E" }]
});
function policyConfig(id, weights = {}) {
  if (!POLICIES[id]) throw new Error(`Unknown policy ${id}`);
  for (const [k, v] of Object.entries(weights)) if (!["speed", "ukeire", "value", "pinfu", "risk", "maxShantenLoss", "callCost"].includes(k) || !Number.isFinite(v) || v < 0) throw new Error(`Invalid policy weight ${k}`);
  return { ...POLICIES[id], ...weights };
}
function potential(c, melds, o) {
  const tiles2 = [];
  for (let t = 0; t < 34; t++) for (let k = 0; k < c[t]; k++) tiles2.push(t);
  for (const m of melds) tiles2.push(...m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : Array(3).fill(m.tile));
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
  attract(1e3, (t) => o.rules.greenTiles.includes(t));
  if (!melds.some((m) => m.type === "chi")) val = Math.max(val, 200 * Math.min(1, (2 * (triplets + openTrip) + pairs) / 9));
  if (!melds.length) val = Math.max(val, 400 * (pairs / 7) ** 3);
  for (let t = 27; t < 34; t++) {
    const unit = t >= 31 ? o.rules.dragonBonus : (t === o.rules.roundWind ? o.rules.roundWindBonus : 0) + (t === 27 + (o.seat - o.dealer + 4) % 4 ? o.rules.seatWindBonus : 0);
    val += unit * (frequency[t] >= 3 ? 1 : frequency[t] === 2 ? 0.45 : 0.05);
  }
  val += melds.filter((m) => m.type === "kan").length * o.rules.kanBonus;
  return { value: val, pinfu };
}
function publicRisk(tile, o) {
  const availability = (4 - o.visible[tile]) / 4, shape = tile >= 27 ? 0.45 : [0, 8].includes(tile % 9) ? 0.7 : 1;
  let threat = 0;
  for (const p of o.players) if (p.seat !== o.seat && !p.won) {
    const suits = p.melds.filter((m) => m.tile < 27).map((m) => Math.floor(m.tile / 9));
    const focus2 = suits.length >= 2 && new Set(suits).size === 1 && tile < 27 && Math.floor(tile / 9) === suits[0] ? 1.35 : 1;
    threat += (0.15 + Math.min(1, p.discards.length / 16) + p.melds.length * 0.25) * focus2;
  }
  return availability * shape * threat;
}
function value13(c, melds, o, w, discard = null) {
  const e = effectiveTiles(c, melds.length, o.visible, o.rules), p = potential(c, melds, o);
  const activeFactor = 0.6 + o.activeCount / 5;
  const risk = discard === null ? 0 : publicRisk(discard, o);
  const score = -w.speed * e.shanten + w.ukeire * e.ukeire + w.value * p.value * activeFactor + w.pinfu * p.pinfu - w.risk * risk * (e.shanten >= 2 ? 1.35 : 1);
  return { score, shanten: e.shanten, ukeire: e.ukeire, value: p.value, pinfu: p.pinfu, risk };
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
  let value = closed ? 100 : 0, connections = 0;
  for (let t = 0; t < 27; t++) {
    if (t % 9 < 8) connections += Math.min(c[t], c[t + 1]);
    if (t % 9 < 7) connections += 0.35 * Math.min(c[t], c[t + 2]);
  }
  for (let t = 27; t < 34; t++) if (t >= 31 || t === o.rules.roundWind || t === 27 + (o.seat - o.dealer + 4) % 4) value += all[t] >= 3 ? 200 : all[t] === 2 ? 75 : 0;
  value += (o.doraIndicators ?? []).reduce((n, t) => n + all[doraAfter(t)] * 100, 0);
  const size = all.reduce((a, b) => a + b, 0), simple = all.reduce((n, count, t) => n + (!isYao(t) ? count : 0), 0);
  value += 100 * (simple / size) ** 5;
  for (let suit = 0; suit < 3; suit++) value = Math.max(value, 600 * (all.slice(suit * 9, suit * 9 + 9).reduce((a, b) => a + b, 0) / size) ** 5);
  const pinfu = closed ? connections / 4 - c.filter((n) => n >= 3).length * 0.3 : 0;
  let risk = 0;
  if (discard !== null) {
    for (const p of o.players) if (p.seat !== o.seat && !p.discards.some((d) => d.tile === discard)) risk += (p.riichi ? 3 : 0.2 + Math.min(1, p.discards.length / 16)) * (4 - o.visible[discard]) / 4 * (discard >= 27 ? 0.45 : 1);
  }
  return { shanten: s, ukeire, value, pinfu, risk, score: -w.speed * s + w.ukeire * ukeire + w.value * value + w.pinfu * pinfu - w.risk * risk };
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
function reasonFor(action, view, policy) {
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
  return focus[policy];
}
function strategyRecommendations(view) {
  if (!view.legalActions.length) return [];
  const discards = view.legalActions.filter((a) => a.type === "discard");
  return Object.entries(POLICIES2).map(([policy, config]) => {
    const action = chooseAction3(view, policy);
    let discard = null;
    if (discards.length && action.type !== "tsumo") {
      const selected = action.type === "discard" ? action : chooseAction3({ ...view, legalActions: discards }, policy);
      const metrics2 = evaluateDiscards3({ ...view, legalActions: [selected] }, policy)[0];
      discard = {
        action: { ...selected },
        label: actionLabel(selected),
        shanten: metrics2.shanten,
        ukeire: metrics2.ukeire
      };
    }
    return {
      policy,
      name: config.name,
      action: { ...action },
      label: actionLabel(action, view),
      reason: reasonFor(action, view, policy),
      discard
    };
  });
}

// web/tile-view.mjs
var SVG = "http://www.w3.org/2000/svg";
var dots = { 1: [[50, 50]], 2: [[50, 24], [50, 76]], 3: [[24, 22], [50, 50], [76, 78]], 4: [[24, 24], [76, 24], [24, 76], [76, 76]], 5: [[24, 24], [76, 24], [50, 50], [24, 76], [76, 76]], 6: [[24, 18], [76, 18], [24, 50], [76, 50], [24, 82], [76, 82]], 7: [[24, 16], [50, 31], [76, 16], [24, 57], [76, 57], [24, 84], [76, 84]], 8: [[24, 13], [76, 13], [24, 38], [76, 38], [24, 63], [76, 63], [24, 88], [76, 88]], 9: [[22, 16], [50, 16], [78, 16], [22, 50], [50, 50], [78, 50], [22, 84], [50, 84], [78, 84]] };
function element(tag, attributes) {
  const el = document.createElementNS(SVG, tag);
  for (const [key3, value] of Object.entries(attributes)) el.setAttribute(key3, String(value));
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
var API_ORIGIN = ["127.0.0.1", "localhost"].includes(location.hostname) ? "http://127.0.0.1:8790" : "https://wellness-mahjong-h-lab.chayhyeon.chatgpt.site";
var key2 = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
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
  async connect(name, code, variant = "H") {
    this.stop();
    const generation = this.generation;
    const saved = this.saved();
    this.session = { key: saved?.key ?? key2(), name, code: code ?? null };
    this.snapshot = null;
    this.onStatus("\uBC29\uC5D0 \uC5F0\uACB0 \uC911\u2026");
    const data = await this.request(code ? `rooms/${code}/join` : "rooms", { name, ...code ? {} : { variant } });
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
};

// web/score-display.mjs
var signedPoints = (value) => `${value > 0 ? "+" : ""}${value}`;
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
  const receipt = Array.isArray(state2.ledger) ? state2.ledger.filter((payment) => payment.to === seat && payment.kind === win3.method).reduce((sum2, payment) => sum2 + payment.amount, 0) : expectedReceipt;
  const parts = [`\uC5ED ${score.base}`];
  if (score.bonus) parts.push(`\uAC00\uC0B0 ${score.bonus}`);
  if (win3.method === "tsumo") parts.push(`\uCBD4\uBAA8 ${tsumoBonus}`);
  return {
    payerCount,
    perPayer,
    receipt,
    expectedReceipt,
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
var clone = (value) => structuredClone(value);
var scores = (game) => game.players.map((player) => player.score);
var seats = ["\uB3D9", "\uB0A8", "\uC11C", "\uBD81"];
var seatLabels = (game) => game.rules.variant === "S" ? seats.map((_, i) => seats[(i - game.dealer + 4) % 4]) : seats;
var signed = (value) => `${value > 0 ? "+" : ""}${value}`;
function beforeAction(game) {
  return { scores: scores(game), active: game.players.flatMap((p, i) => p.won ? [] : [i]), events: game.events.length, ledger: game.ledger.length, pot: game.pot ?? 0 };
}
function actionRecord(game, seat, action, before, error = null) {
  const seats2 = seatLabels(game);
  const after = scores(game), payments = clone(game.ledger.slice(before.ledger)), issues = [];
  const delta = after.map((value, i) => value - before.scores[i]), ledgerDelta = [0, 0, 0, 0];
  for (const payment of payments) {
    if (Number.isInteger(payment.from)) ledgerDelta[payment.from] -= payment.amount;
    if (Number.isInteger(payment.to)) ledgerDelta[payment.to] += payment.amount;
  }
  if (delta.some((value, i) => value !== ledgerDelta[i])) issues.push("\uC810\uC218 \uBCC0\uD654\uC640 \uC2E4\uC81C \uC774\uCCB4 \uB0B4\uC5ED\uC774 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
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
    const perPayer = win3.score.total + tsumoBonus, expectedReceipt = perPayer * payers.length, actualReceipt = actual.reduce((sum2, p) => sum2 + p.amount, 0);
    const problems = [];
    if (actual.length !== payers.length || payers.some((i) => actual.filter((p) => p.from === i && p.amount === perPayer).length !== 1)) problems.push("\uC9C0\uAE09\uC790 \uB610\uB294 \uC9C0\uAE09\uC561\uC774 \uC801\uC6A9 \uADDC\uCE59\uACFC \uB2E4\uB985\uB2C8\uB2E4.");
    if ((win3.score.yaku === "pinfu" || win3.score.name === "\uD551\uD6C4") && (win3.score.base !== 100 || win3.score.bonus !== 0 || win3.score.total !== 100)) problems.push("\uD551\uD6C4 \uC5ED \uC810\uC218 \uB610\uB294 \uAC00\uC0B0\uC810\uC774 \uC798\uBABB\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
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
      const value = JSON.parse(this.storage?.getItem(INDEX) ?? "[]");
      return Array.isArray(value) ? value.filter((x) => x && typeof x.id === "string" && typeof x.updatedAt === "string" && Number.isSafeInteger(x.chars) && x.chars >= 0) : [];
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
    `${variant === "S" ? "\uC774\uBC88 \uAD6D \uC99D\uAC10" : "\uCD5C\uC885 \uC810\uC218"}: ${scores(game).map((score, i) => `${seats2[i]} ${signed(score)}`).join(" / ")}`,
    ""
  ];
  if (game.startingScores) lines.push(`\uBC18\uC7A5 \uB204\uC801 (\uC885\uB8CC \uACF5\uD0C1 \uBCC4\uB3C4): ${game.startingScores.map((n, i) => seats2[i] + " " + (n + game.players[i].score)).join(" / ")}`, "");
  for (const entry of log.actions) {
    const action = entry.action, tile = Number.isInteger(action.tile) ? ` ${tileName(action.tile)}` : "";
    if (action.type !== "pass") lines.push(`#${entry.n + 1} ${seats2[entry.seat]} ${{ discard: "\uBC84\uB9BC", riichi: "\uB9AC\uCE58\xB7\uBC84\uB9BC", tsumo: "\uCBD4\uBAA8", ron: "\uB860", chi: "\uCE58", pon: "\uD401", ankan: "\uC548\uAE61", minkan: "\uBA85\uAE61", kakan: "\uAC00\uAE61" }[action.type] ?? action.type}${tile}`);
    for (const win3 of entry.wins) {
      const detail = variant === "S" ? scoreBreakdownText(win3.score) : `\uC5ED ${win3.score.base}${win3.score.bonus ? " + \uAC00\uC0B0 " + win3.score.bonus : ""}${win3.tsumoBonus ? " + \uCBD4\uBAA8 " + win3.tsumoBonus : ""}`;
      lines.push(variant === "S" ? `  ${seats2[win3.seat]} ${detail}` : `  ${seats2[win3.seat]} ${win3.score.name} (${detail})`);
      if (win3.issues.length) lines.push(`  \uADDC\uCE59\uC0C1 ${win3.expectedReceipt}, \uC2E4\uC81C \uC218\uC785 ${win3.actualReceipt}`);
    }
    for (const payment of entry.payments) lines.push(`  ${seats2[payment.from] ?? "\uACF5\uD0C1"} \u2192 ${seats2[payment.to] ?? "\uACF5\uD0C1"}: ${payment.amount}\uC810`);
    for (const draw3 of entry.draws) lines.push(`  ${seats2[draw3.seat]} ${draw3.type === "kanDraw" ? "\uBCF4\uCDA9\uD328" : "\uBF51\uC740 \uD328"}: ${tileName(typeOf(draw3.id))}`);
    for (const issue of entry.issues) lines.push(`  [\uC815\uC0B0 \uD655\uC778 \uD544\uC694] ${issue}`);
    if (entry.error) lines.push(`  [\uC2E4\uD589 \uC624\uB958] ${entry.error}`);
  }
  for (const entry of log.observations) if (entry.delta.some(Boolean)) lines.push(`\uC218\uC2E0 ${entry.revision} \uC810\uC218 \uBCC0\uB3D9: ${entry.delta.map((v, i) => v ? seats2[i] + " " + signed(v) : "").filter(Boolean).join(" / ")}`);
  if (log.mode === "online" && variant === "S") for (const seat of game.winners) lines.push(`${seats2[seat]} ${scoreBreakdownText(game.players[seat].win.score)}`);
  lines.push("", "\uD604\uC7AC \uC190\uD328\xB7\uD6C4\uB85C (JSON\uC5D0\uB294 \uC6D0\uBCF8 \uD328 \uBC88\uD638\uC640 \uC0C1\uC138 \uAE30\uB85D \uD3EC\uD568)");
  for (let seat = 0; seat < 4; seat++) {
    const p = game.players[seat];
    lines.push(`${seats2[seat]}: ${p.hand.map((id) => tileName(typeOf(id))).join(" ")} / ${p.melds.map((m) => `${m.type} ${m.ids.map((id) => tileName(typeOf(id))).join(" ")}`).join(" / ")}`);
  }
  for (const error of log.errors) lines.push(`[\uC624\uB958 ${error.at}] ${error.message}`);
  return lines.join("\n") + "\n";
}
function reviewText(input) {
  const log = expandLog(input), game = log.game, seats2 = seatLabels(game), s = game.rules.variant === "S", lines = [`${s ? "S" : "H"}\uB8F0 \xB7 ${game.seed ?? log.room}`, `${s ? "\uC774\uBC88 \uAD6D \uC99D\uAC10" : "\uCD5C\uC885"}: ${game.players.map((p, i) => seats2[i] + " " + signed(p.score)).join(" / ")}`];
  for (const e of log.actions) {
    if (["ankan", "minkan", "kakan"].includes(e.action.type)) lines.push(`${seats2[e.seat]} ${e.action.type === "ankan" ? "\uC548\uAE61" : e.action.type === "minkan" ? "\uBA85\uAE61" : "\uAC00\uAE61"}${Number.isInteger(e.action.tile) ? " \xB7 " + tileName(e.action.tile) : ""} (\uC774\uB54C\uB294 \uC810\uC218 \uC774\uB3D9 \uC5C6\uC74C)`);
    for (const win3 of e.wins) {
      const extra = Object.entries(win3.score.bonuses ?? {}).filter(([, value]) => typeof value === "number" && value).map(([name, value]) => `${{ kan: "\uAE61", dragon: "\uC0BC\uC6D0\uD328", roundWind: "\uC7A5\uD48D", seatWind: "\uC790\uD48D" }[name] ?? name} ${value}`);
      lines.push(s ? `${seats2[win3.seat]} ${win3.method === "ron" ? "\uB860" : "\uCBD4\uBAA8"} \xB7 ${scoreBreakdownText(win3.score)}` : `${seats2[win3.seat]} ${win3.score.name} ${win3.method === "ron" ? "\uB860" : "\uCBD4\uBAA8"} \xB7 \uC5ED ${win3.score.base}${extra.length ? " + " + extra.join(" + ") : ""}${win3.tsumoBonus ? " + \uCBD4\uBAA8 " + win3.tsumoBonus + " / \uC9C0\uAE09\uC790" : ""}`);
    }
    for (const p of e.payments) lines.push(`  ${seats2[p.from] ?? "\uACF5\uD0C1"} \u2192 ${seats2[p.to] ?? "\uACF5\uD0C1"}: ${p.amount}\uC810`);
    for (const issue of e.issues) lines.push(`[\uC815\uC0B0 \uD655\uC778 \uD544\uC694] ${issue}`);
  }
  if (log.mode === "online") {
    for (const entry of log.observations) if (entry.delta.some(Boolean)) lines.push(`\uC218\uC2E0 ${entry.revision}: ${entry.delta.map((v, i) => v ? seats2[i] + " " + signed(v) : "").filter(Boolean).join(" / ")}`);
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
function readPreferences(storage) {
  try {
    const saved = JSON.parse(storage?.getItem(KEY) ?? "{}");
    return { recommendations: saved?.recommendations !== false, variant: saved?.variant === "S" ? "S" : "H" };
  } catch {
    return { recommendations: true, variant: "H" };
  }
}
function savePreferences(storage, value) {
  try {
    storage?.setItem(KEY, JSON.stringify({ recommendations: !!value.recommendations, variant: value.variant === "S" ? "S" : "H" }));
    return !!storage;
  } catch {
    return false;
  }
}

// s-engine/match.mjs
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
function createMatch({ seed = 1, id = crypto.randomUUID(), rules = {}, settings = {}, now = (/* @__PURE__ */ new Date()).toISOString() } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295 || typeof id !== "string" || !id) throw new Error("Invalid match seed/id");
  for (const k of Object.keys(settings)) if (!(k in MATCH_DEFAULTS)) throw new Error("Unknown match setting");
  const config = { ...MATCH_DEFAULTS, ...settings };
  if (!["none", "win-or-tenpai"].includes(config.dealerContinuation) || config.honbaPoints !== 0 || config.finalPot !== "top" || config.endOnBankrupt !== false) throw new Error("Unsupported match settings");
  const r = sRules({ ...rules, roundWind: 27 });
  return { version: 1, id, seed, startedAt: now, rules: r, settings: config, roundIndex: 0, repeat: 0, handNumber: 1, status: "playing", scores: Array(4).fill(r.startingPoints), pot: 0, rounds: [], next: null, finalTransfers: [] };
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
  const retained = match.settings.dealerContinuation === "win-or-tenpai" && (game.winners.includes(game.dealer) || game.end === "exhaustive-draw" && dealerReady);
  match.rounds.push({ handNumber: match.handNumber, roundIndex: match.roundIndex, repeat: match.repeat, label: roundLabel(match.roundIndex, match.repeat), dealer: game.dealer, seed: game.seed, result: game.end, winner: game.winners[0] ?? null, delta, totals: [...match.scores], pot: match.pot, retained, logId });
  if (match.roundIndex === 7 && !retained) {
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
    startedAt: match.startedAt,
    roundIndex: match.roundIndex,
    repeat: match.repeat,
    handNumber: match.handNumber,
    label: roundLabel(match.roundIndex, match.repeat),
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
  if (match.version !== 1 || !["playing", "between-rounds", "complete"].includes(match.status) || !Number.isInteger(match.roundIndex) || match.roundIndex < 0 || match.roundIndex > 7 || !Number.isInteger(match.handNumber) || match.handNumber < 1 || !Number.isInteger(match.repeat) || match.repeat < 0) throw new Error("Invalid S match progress");
  if (match.scores.length !== 4 || match.scores.some((n) => !Number.isSafeInteger(n)) || sum(match.scores) + match.pot !== 4 * match.rules.startingPoints) throw new Error("Match score conservation violated");
  if (!Number.isSafeInteger(match.pot) || match.pot < 0 || match.pot % 1e3) throw new Error("Invalid match pot");
  if (game.matchContext?.id !== match.id || game.matchContext.handNumber !== match.handNumber || game.matchContext.roundIndex !== match.roundIndex || game.matchContext.repeat !== match.repeat || game.dealer !== match.roundIndex % 4 || game.rules.roundWind !== (match.roundIndex < 4 ? 27 : 28)) throw new Error("Match round mismatch");
  if (!Array.isArray(game.startingScores) || game.startingScores.length !== 4 || game.startingScores.some((n) => !Number.isSafeInteger(n))) throw new Error("Missing match starting balances");
  const banked = game.startingScores.map((n, i) => n + (match.status === "playing" ? 0 : game.players[i].score) + match.finalTransfers.filter((t) => t.to === i).reduce((sum2, t) => sum2 + t.amount, 0));
  if (banked.some((n, i) => n !== match.scores[i]) || match.status === "playing" && game.initialPot !== match.pot) throw new Error("Match carried balances mismatch");
  if (match.status !== "playing" && !game.end) throw new Error("Unfinished round cannot be settled");
  if (match.rounds.length !== match.handNumber - (match.status === "playing" ? 1 : 0)) throw new Error("Duplicate or missing round result");
  assertInvariants2(game);
  if (match.status === "playing" && sum(matchTotals(match, game)) + game.pot !== 4 * match.rules.startingPoints) throw new Error("Live match score conservation violated");
  return true;
}

// web/match-store.mjs
var KEY2 = "wellness-s-match-v1";
var clone3 = (x) => structuredClone(x);
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
      this.error = "\uC800\uC7A5\uB41C \uBC18\uC7A5\uC744 \uC77D\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uC800\uC7A5 \uB370\uC774\uD130\uB294 \uC720\uC9C0\uD588\uC2B5\uB2C8\uB2E4.";
      return null;
    }
  }
  save({ match, seat, log, policy, profile }) {
    const data = this.read();
    if (!data) return false;
    if (data.active?.match.id !== match.id && data.active) {
      const old = data.active;
      data.history.unshift({ seat: old.seat, summary: matchSummary(old.match, expandLog(old.log).game) });
      data.history = data.history.slice(0, 9);
    }
    data.active = { match: clone3(match), seat, policy, profile, log: compactLog(log) };
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
      this.error = "\uBC18\uC7A5 \uC790\uB3D9 \uC800\uC7A5 \uACF5\uAC04\uC774 \uBD80\uC871\uD569\uB2C8\uB2E4. \uC810\uC218\uD45C\uC640 \uD604\uC7AC \uB85C\uADF8\uB97C \uD30C\uC77C\uB85C \uC800\uC7A5\uD574 \uC8FC\uC138\uC694.";
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
    const entry = { seat, summary: clone3(summary) }, previous = data.history.find((x) => x.summary.id === summary.id);
    if (JSON.stringify(previous) === JSON.stringify(entry)) return this.persisted;
    data.history = [entry, ...data.history.filter((x) => x.summary.id !== summary.id)].slice(0, data.active ? 9 : 10);
    return this.write();
  }
  restore({ force = false } = {}) {
    const data = this.read();
    if (!data?.active || !force && !data.resume) return null;
    try {
      const saved = clone3(data.active), log = expandLog(saved.log);
      if (!Number.isInteger(saved.seat) || saved.seat < 0 || saved.seat > 3 || log.humanSeat !== saved.seat) throw new Error("Invalid saved seat");
      assertMatch(saved.match, log.game);
      saved.log = log;
      return saved;
    } catch {
      this.error = "\uC800\uC7A5\uB41C \uBC18\uC7A5\uC758 \uC810\uC218 \uB610\uB294 \uD328 \uC0C1\uD0DC\uAC00 \uB9DE\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uAE30\uB85D\uC740 \uC720\uC9C0\uD588\uC2B5\uB2C8\uB2E4.";
      return null;
    }
  }
  list() {
    const data = this.read();
    if (!data) return [];
    try {
      const active = data.active;
      return [...active ? [{ seat: active.seat, summary: matchSummary(active.match, expandLog(active.log).game) }] : [], ...data.history];
    } catch {
      this.error = "\uC800\uC7A5\uB41C \uBC18\uC7A5 \uC810\uC218\uD45C\uB97C \uC77D\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uAE30\uC874 \uAE30\uB85D\uC740 \uC720\uC9C0\uD588\uC2B5\uB2C8\uB2E4.";
      return [];
    }
  }
};
function matchCSV(summary, names = ["\uC2DC\uC791 \uB3D9", "\uC2DC\uC791 \uB0A8", "\uC2DC\uC791 \uC11C", "\uC2DC\uC791 \uBD81"]) {
  const cell = (value) => '"' + String(value ?? "").replaceAll('"', '""') + '"', rows = [["\uAD6D", "\uACB0\uACFC", ...names.map((n) => n + " \uC99D\uAC10"), ...names.map((n) => n + " \uB204\uC801"), "\uACF5\uD0C1"]];
  for (const r of summary.rounds) rows.push([r.label, r.result === "win" ? "\uD654\uB8CC" : "\uC720\uAD6D", ...r.delta, ...r.totals, r.pot]);
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
  constructor({ storage = null, fetcher = globalThis.fetch, origin = archiveOrigin(), onStatus = () => {
  }, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
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
var sMatch = null;
var logStorage = null;
try {
  logStorage = localStorage;
} catch {
}
var matchStore = new MatchStore(logStorage);
var preferences = readPreferences(logStorage);
var recommendationsEnabled = preferences.recommendations;
var chosenVariant = preferences.variant;
var journal = new GameJournal({ storage: logStorage });
var buildId = new URL(import.meta.url).searchParams.get("v") ?? "local-source";
var archiveStatuses = /* @__PURE__ */ new Map();
var archiveClient = new ArchiveClient({ storage: logStorage, onStatus: (status) => {
  archiveStatuses.set(status.id, status);
  renderArchiveStatus();
} });
function renderArchiveStatus() {
  const id = journal.current?.id, status = archiveStatuses.get(id);
  $("archive-status").textContent = `\uC11C\uBC84 \uD328\uBCF4 ${id?.slice(0, 8) ?? "\uC900\uBE44 \uC911"} \xB7 ${{ saved: "\uC800\uC7A5\uB428", waiting: "\uC800\uC7A5 \uB300\uAE30", uploading: "\uC5C5\uB85C\uB4DC \uC911" }[status?.state] ?? status?.message ?? "\uC800\uC7A5 \uB300\uAE30"}`;
}
window.addEventListener("online", () => archiveClient.retry());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") void archiveClient.flush({ keepalive: true });
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
var seatIndex = (seat) => state?.rules.variant === "S" ? (seat - state.dealer + 4) % 4 : seat;
var seatName = (seat) => SEAT_NAMES[seatIndex(seat)];
var wind = (seat) => ["\u6771", "\u5357", "\u897F", "\u5317"][seatIndex(seat)];
var currentMatch = () => online ? remote?.match ?? null : sMatch ? matchSummary(sMatch, state) : null;
function node(tag, text, cls) {
  const el = document.createElement(tag);
  if (text !== void 0) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function riichiMarker(seat) {
  const marker = node("span", void 0, "riichi-status"), stick = node("span", void 0, "riichi-stick");
  marker.setAttribute("role", "img");
  marker.setAttribute("aria-label", `${seatName(seat)} \uB9AC\uCE58`);
  marker.title = `${seatName(seat)} \uB9AC\uCE58`;
  stick.setAttribute("aria-hidden", "true");
  const label = node("span", "\uB9AC\uCE58");
  label.setAttribute("aria-hidden", "true");
  marker.append(stick, label);
  return marker;
}
function tiles(parent, types) {
  for (const t of types) parent.append(tileFace(t, { small: true }));
}
function meldText(m) {
  return `${m.type === "kan" ? m.open ? "\uBA85\uAE61" : "\uC548\uAE61" : m.type === "pon" ? "\uD401" : "\uCE58"} ${m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2].map(tileName).join(" ") : tileName(m.tile)}`;
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
function renderMeld(m) {
  const el = node("div", void 0, "meld");
  el.setAttribute("aria-label", meldText(m));
  el.title = meldText(m);
  el.append(node("span", m.type === "kan" ? m.open ? "\uAE61" : "\uC548\uAE61" : m.type === "pon" ? "\uD401" : "\uCE58", "meld-label"));
  tiles(el, m.ids.map(typeOf));
  return el;
}
function renderMeldZone(player, position, seat) {
  if (!player.melds.length) return;
  const zone = node("div", void 0, `meld-zone meld-zone-${position}`), rack = node("div", void 0, "meld-rack");
  zone.setAttribute("aria-label", `${seatName(seat)} \uACF5\uAC1C \uBAB8\uD1B5 \xB7 \uC790\uAE30 \uAE30\uC900 \uC67C\uCABD`);
  for (const m of player.melds) rack.append(renderMeld(m));
  zone.append(rack);
  $("melds").append(zone);
}
function renderRiver(parent, player) {
  parent.replaceChildren();
  let row;
  for (const [index, d] of player.river.entries()) {
    if (index % 6 === 0) {
      row = node("div", void 0, "river-row");
      parent.append(row);
    }
    const t = tileFace(typeOf(d.id), { small: true });
    t.classList.toggle("claimed", !!d.claimed);
    t.classList.toggle("riichi-discard", !!d.riichi);
    t.classList.toggle("last-discard", state.phase === "reaction" && state.reaction.id === d.id);
    const label = [tileName(typeOf(d.id)), d.riichi ? "\uB9AC\uCE58 \uC120\uC5B8 \uD328" : null, d.claimed ? "\uD6C4\uB85C\uC5D0 \uC0AC\uC6A9\uB428" : null].filter(Boolean).join(", ");
    t.setAttribute("aria-label", label);
    t.title = label;
    row.append(t);
  }
}
function renderDora() {
  const panel = $("dora-panel"), seat = state.winners[0] ?? humanSeat, view = doraDisplay(state, seat);
  panel.hidden = !view;
  panel.replaceChildren();
  if (!view) return;
  const heading = node("div", void 0, "dora-heading"), winner = state.players[seat].won;
  const count = winner && state.players[seat].win.score.yakuman ? "\uC5ED\uB9CC \xB7 \uB3C4\uB77C \uAC00\uC0B0 \uC5C6\uC74C" : `${winner ? seatName(seat) + " \uD654\uB8CC\uD328" : "\uB0B4 \uD328"} \uB3C4\uB77C ${view.count}\uD310${view.uraCount !== null ? " \xB7 \uC6B0\uB77C\uB3C4\uB77C " + view.uraCount + "\uD310" : ""}`;
  heading.append(node("strong", "\uB3C4\uB77C"), node("span", count));
  panel.append(heading);
  for (const [label, pairs] of [["\uD45C\uC2DC\uD328 \u2192 \uB3C4\uB77C", view.visible], ["\uC6B0\uB77C \uD45C\uC2DC\uD328 \u2192 \uC6B0\uB77C\uB3C4\uB77C", view.ura]]) {
    if (!pairs.length) continue;
    const group = node("div", void 0, "dora-group");
    group.append(node("span", label, "dora-label"));
    for (const pair of pairs) {
      const item = node("span", void 0, "dora-pair");
      item.title = `\uD45C\uC2DC\uD328 ${tileName(pair.indicator)} \u2192 \uB3C4\uB77C ${tileName(pair.dora)}`;
      item.append(tileFace(pair.indicator, { small: true }), node("span", "\u2192", "dora-arrow"), tileFace(pair.dora, { small: true }));
      group.append(item);
    }
    panel.append(group);
  }
  panel.append(node("p", "1\uC7A5\uB2F9 1\uD310 \xB7 \uD654\uB8CC \uC5ED\uC774 \uC788\uC5B4\uC57C \uB3C4\uB77C\uB97C \uAC00\uC0B0\uD569\uB2C8\uB2E4.", "dora-note"));
}
function renderHanBreakdown(detail) {
  const section = node("div", void 0, "han-breakdown"), groups = node("div", void 0, "han-groups");
  const bonusEntries = [...detail.bonuses];
  if (!detail.yakuman && !bonusEntries.some((e) => e.id === "dora")) bonusEntries.push({ name: "\uB3C4\uB77C", han: 0 });
  for (const [label, entries] of [["\uC131\uB9BD \uC5ED", detail.yaku], ["\uAC00\uC0B0", detail.yakuman ? [] : bonusEntries]]) {
    if (!entries.length) continue;
    const group = node("div", void 0, "han-group"), list = node("ul", void 0, "han-list");
    group.append(node("h3", label));
    for (const entry of entries) {
      const row = node("li");
      row.append(node("span", entry.name), node("strong", detail.yakuman ? "\uC5ED\uB9CC" : `${entry.han}\uD310`));
      list.append(row);
    }
    group.append(list);
    groups.append(group);
  }
  section.append(groups, node("p", detail.summary, "han-total"));
  return section;
}
function discardMetrics(discard) {
  return `${discard.shanten === 0 ? "\uD150\uD30C\uC774 (0\uC0E8\uD150)" : discard.shanten + "\uC0E8\uD150"} \xB7 \uC720\uD6A8\uD328 \uCD94\uC815 ${discard.ukeire}\uC7A5`;
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
  currentRecommendations = strategyRecommendations(observation4(state, humanSeat));
  status.textContent = "\uBC84\uD2BC\uC744 \uB204\uB974\uBA74 \uD574\uB2F9 \uC804\uB7B5\uC758 \uC120\uD0DD\uC744 \uD55C \uBC88 \uC2E4\uD589\uD569\uB2C8\uB2E4.";
  for (const rec of currentRecommendations) {
    const card = node("article", void 0, "recommendation-card"), title = node("h4");
    title.append(node("span", rec.policy, "policy-badge"), node("span", rec.name));
    card.append(title, node("p", rec.reason, "recommendation-reason"));
    if (rec.action.type === "discard") card.append(node("p", discardMetrics(rec.discard), "recommendation-metrics"));
    const button = node("button", rec.label, "recommendation-action" + (["ron", "tsumo"].includes(rec.action.type) ? " is-win" : ""));
    button.setAttribute("aria-label", `${rec.policy} \uC804\uB7B5 \uCD94\uCC9C \uC2E4\uD589: ${rec.label}`);
    button.onclick = () => actRecommendation(rec.policy, "recommended", revision);
    card.append(button);
    if (rec.discard && rec.action.type !== "discard") {
      const alternative = node("div", void 0, "recommendation-alternative");
      alternative.append(node("p", rec.action.type === "riichi" ? "\uB9AC\uCE58 \uC5C6\uC774 \uBC84\uB9B0\uB2E4\uBA74" : "\uAE61 \uB300\uC2E0 \uBC84\uB9B0\uB2E4\uBA74", "alternative-title"), node("p", discardMetrics(rec.discard), "recommendation-metrics"));
      const discardButton = node("button", rec.discard.label, "recommendation-discard");
      discardButton.setAttribute("aria-label", `${rec.policy} \uC804\uB7B5 \uBC84\uB9BC\uD328 \uB300\uC548 \uC2E4\uD589: ${rec.discard.label}`);
      discardButton.onclick = () => actRecommendation(rec.policy, "discard", revision);
      alternative.append(discardButton);
      card.append(alternative);
    }
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
  return result?.then ? result.then((value) => ({ policy, action: { ...action }, ...value })) : { policy, action: { ...action }, ...result };
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
  const match = currentMatch();
  document.querySelector(".room-label").textContent = `${variant} RULE \xB7 ${match ? match.label : online ? "4\uC778 \uB300\uAD6D" : "\uD63C\uC790 \uC5F0\uC2B5"}`;
  document.querySelector(".wind-mark").textContent = variant;
  $("s-rule-status").hidden = variant !== "S";
  if (variant === "S") $("s-rule-status").textContent = `${state.rules.roundWind === 28 ? "\uB0A8\uC7A5" : "\uB3D9\uC7A5"} \xB7 ${match ? "\uBC18\uC7A5 \uB204\uC801 \uAE30\uB85D \xB7 " : ""}\uCE5C ${seatName(state.dealer)} \xB7 \uACF5\uD0C1 ${match?.pot ?? state.pot ?? 0}\uC810`;
  renderDora();
  const a = actor4(state), shownTurn = displayedTurn(state), p = state.players[humanSeat], positions = seatPositions(humanSeat);
  const reacting = state.phase === "reaction", humanChoice = reacting && a === humanSeat && !auto && !needsPass(state, humanSeat);
  $("game-status").textContent = match?.status === "complete" ? "\uB0A84\uAD6D \uC885\uB8CC \xB7 \uBC18\uC7A5 \uC644\uB8CC" : state.end ? `${state.end === "three-winners" ? "\uC138 \uBC88\uC9F8 \uD654\uB8CC" : state.end === "win" ? "\uD654\uB8CC" : "\uC720\uAD6D"} \xB7 \uAD6D \uC885\uB8CC` : p.won ? "\uD654\uB8CC \uC644\uB8CC \xB7 \uB0A8\uC740 \uB300\uAD6D \uC9C4\uD589 \uC911" : reacting ? humanChoice ? "\uB860 \xB7 \uD6C4\uB85C \uC120\uD0DD" : "\uD6C4\uB85C \uD655\uC778 \uC911" : a === humanSeat ? "\uB0B4 \uCC28\uB840 \xB7 \uBC84\uB9BC\uD328 \uC120\uD0DD" : `${seatName(a)} \uD50C\uB808\uC774\uC5B4 \uCC28\uB840`;
  $("turn-indicator").textContent = state.end ? "\uAD6D \uC885\uB8CC" : reacting ? humanChoice ? "\uB860 \xB7 \uD6C4\uB85C \uC120\uD0DD \uAC00\uB2A5" : "\uD6C4\uB85C \uD655\uC778 \uC911" : a === humanSeat ? "\u25CF \uB0B4 \uCC28\uB840" : `${seatName(a)} \uC9C4\uD589 \uC911`;
  $("wall").textContent = `\uB0A8\uC740 \uD328 ${state.wall.length}`;
  $("win-count").textContent = `\uD654\uB8CC ${state.winners.length} / ${variant === "S" ? 1 : 3}\uBA85`;
  $("opponents").replaceChildren();
  $("rivers").replaceChildren();
  $("melds").replaceChildren();
  for (const [position, i] of Object.entries(positions)) {
    const pl = state.players[i];
    renderMeldZone(pl, position, i);
    const windElement = $(`wind-${position}`);
    windElement.textContent = wind(i);
    windElement.classList.toggle("active-wind", i === shownTurn);
    if (position === "bottom") continue;
    const card = node("div", void 0, `opponent opponent-${position}${pl.won ? " won" : ""}${shownTurn === i ? " active" : ""}`), title = node("div", void 0, "player-title"), who = node("span", void 0, "player-seat");
    who.append(node("span", wind(i), "seat-badge"), node("span", online ? remote.members.find((m) => m.seat === i)?.name ?? "\uD50C\uB808\uC774\uC5B4" : "AI", "player-name"));
    title.append(who, node("span", match ? `${match.totals[i].toLocaleString()}\uC810` : signedPoints(pl.score), "player-score"));
    card.append(title, node("p", pl.won ? `${pl.win.order}\uBC88\uC9F8 ${pl.win.method === "ron" ? "\uB860" : "\uCBD4\uBAA8"} \xB7 ${pl.win.score.name}` : `${seatName(i)} \xB7 \uC190\uD328 ${pl.handSize ?? pl.hand.length}\uC7A5`, "player-sub"));
    if (pl.riichi) card.append(riichiMarker(i));
    if (state.end || pl.won) {
      const revealed = node("div", void 0, "revealed-hand");
      tiles(revealed, pl.hand.filter((id) => state.end || pl.win.method !== "tsumo" || id !== pl.win.tile).map(typeOf));
      card.append(revealed);
    } else {
      const hidden = node("div", void 0, "hidden-hand");
      hidden.setAttribute("aria-hidden", "true");
      for (let j = 0; j < (pl.handSize ?? pl.hand.length); j++) hidden.append(node("span", void 0, "tile-back"));
      card.append(hidden);
    }
    $("opponents").append(card);
    const river = node("div", void 0, `river river-${position}`);
    river.setAttribute("aria-label", `${seatName(i)} \uBC84\uB9BC\uD328`);
    renderRiver(river, pl);
    $("rivers").append(river);
  }
  $("self-title").replaceChildren(node("span", wind(humanSeat), "seat-badge"), node("span", `${seatName(humanSeat)} \xB7 \uB098`), node("span", match ? `\uBC18\uC7A5 ${match.totals[humanSeat].toLocaleString()}\uC810` : `\uAD6D \uB204\uC801 ${signedPoints(p.score)}\uC810`, "self-score"));
  if (p.riichi) $("self-title").append(riichiMarker(humanSeat));
  if (p.won) $("self-title").append(node("span", `${p.win.order}\uBC88\uC9F8 \uD654\uB8CC`, "player-sub"));
  const settledSeat = variant === "S" ? state.winners[0] : humanSeat, settlement = settledSeat === void 0 ? null : winSettlement(state, settledSeat), result = $("win-settlement");
  result.hidden = !settlement;
  result.replaceChildren();
  if (settlement) {
    result.append(node("strong", `${variant === "S" ? seatName(settledSeat) + " \xB7 " : ""}${settlement.title}`));
    if (settlement.breakdown) result.append(renderHanBreakdown(settlement.breakdown));
    result.append(node("p", settlement.calculation));
    if (settlement.previousNet !== 0) result.append(node("p", `\uD654\uB8CC \uC804 \uB204\uC801 ${signedPoints(settlement.previousNet)}\uC810 \u2192 \uAD6D \uB204\uC801 ${signedPoints(settlement.net)}\uC810`));
  }
  const legal = a === humanSeat ? legalActions4(state) : [], hand = handDisplay(state, humanSeat), automaticPass = needsPass(state, humanSeat);
  $("hand").replaceChildren();
  for (const id of hand.held) $("hand").append(handTile(id, legal));
  if (hand.drawn !== null) {
    const group = node("div", void 0, "drawn-group");
    group.append(node("span", "\uBF51\uC740 \uD328", "drawn-label"), handTile(hand.drawn, legal, true));
    $("hand").append(group);
  }
  $("actions").replaceChildren();
  if (state.phase === "reaction" && a === humanSeat) {
    const label = node("span", void 0, "reaction-label");
    label.append(tileFace(typeOf(state.reaction.id), { small: true }), node("span", tileName(typeOf(state.reaction.id))));
    $("actions").append(label);
  }
  if (automaticPass) $("actions").append(node("span", "\uAC00\uB2A5\uD55C \uD6C4\uB85C \uC5C6\uC74C \xB7 0.7\uCD08 \uB4A4 \uC790\uB3D9 \uB118\uAE30\uAE30", "auto-pass-note"));
  for (const action of legal.filter((a2) => a2.type !== "discard" && !(automaticPass && a2.type === "pass"))) {
    const b = node("button", actionLabel(action, { melds: p.melds, legalActions: legal }), ["ron", "tsumo"].includes(action.type) ? "win" : "");
    b.disabled = auto || networkBusy;
    b.onclick = () => act(action);
    $("actions").append(b);
  }
  if (legal.some((a2) => a2.type === "discard")) {
    const b = node("button", "\uBC84\uB9AC\uAE30", "discard-confirm");
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
    $("events").append(node("li", text));
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
  const set = (name, value) => surface.style.setProperty(name, `${value}px`), edge = compact ? 8 : 14, meldSizes = {};
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
  const spec = view.seat === humanSeat ? { id: $("policy").value } : OPPONENT_PROFILES2[$("profile").value][(view.seat - humanSeat + 4) % 4 - 1];
  return chooseAction3(view, spec.id, spec.weights);
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
  if (auto && sMatch?.status === "between-rounds") {
    const expected = sMatch.handNumber;
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
  if (sMatch && state.end) recordRound(sMatch, state, { logId: journal.current?.id });
  if (sMatch?.status === "complete") {
    auto = false;
    updateAuto();
  }
  journal.save(state);
  if (sMatch) matchStore.save({ match: sMatch, seat: humanSeat, log: journal.read(), policy: $("policy").value, profile: $("profile").value });
}
function practiceInfo() {
  const match = currentMatch();
  $("practice-info").textContent = `\uB0B4 \uC790\uB9AC\uB294 ${seatName(humanSeat)}\uC785\uB2C8\uB2E4. ${match ? "S\uB8F0 \uBC18\uC7A5 \xB7 " + match.label + " \xB7 \uC810\uC218\uC640 \uC9C4\uD589 \uC0C1\uD0DC\uB97C \uC790\uB3D9 \uC800\uC7A5\uD569\uB2C8\uB2E4." : "\uC0C1\uB300 3\uBA85\uC740 AI\uC785\uB2C8\uB2E4."} \uD328\uB97C \uC120\uD0DD\uD55C \uB4A4 \uB2E4\uC2DC \uB204\uB974\uAC70\uB098 \uBC84\uB9AC\uAE30\uB85C \uD655\uC815\uD558\uC138\uC694. \uAC00\uB2A5\uD55C \uD6C4\uB85C\uAC00 \uC5C6\uC73C\uBA74 0.7\uCD08 \uB4A4 \uB118\uAE41\uB2C8\uB2E4.`;
}
function beginPracticeHand() {
  journal.begin(state, { mode: "practice", seat: humanSeat, policy: $("policy").value, profile: $("profile").value, build: buildId });
  savePractice();
  $("seed").value = String(sMatch?.seed ?? state.seed);
  selectedTileId = null;
  practiceInfo();
  $("error").textContent = "";
  renderLogs();
  render();
  schedule();
}
function start(seed, variant = chosenVariant) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("\uC2DC\uB4DC\uB294 0\u20134294967295\uC758 \uC815\uC218\uC5EC\uC57C \uD569\uB2C8\uB2E4.");
  if (state && !online) savePractice();
  setVariant(variant);
  showPractice();
  if (timer) clearTimeout(timer);
  auto = false;
  updateAuto();
  humanSeat = practiceSeat(seed);
  sMatch = variant === "S" ? createMatch({ seed }) : null;
  state = sMatch ? createMatchGame(sMatch) : createGame3({ seed });
  if (!sMatch) matchStore.setResume(false);
  beginPracticeHand();
  return { seed, variant, seat: humanSeat, remaining: state.wall.length, ...sMatch ? { match: currentMatch() } : {} };
}
function nextPracticeHand(expected = sMatch?.handNumber) {
  if (online || !sMatch) throw new Error("\uC9C4\uD589 \uC911\uC778 S\uB8F0 \uBC18\uC7A5\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const game = advanceMatch(sMatch, expected);
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
  sMatch = saved.match;
  state = saved.log.game;
  humanSeat = saved.seat;
  journal.current = saved.log;
  if (saved.policy in POLICIES2) $("policy").value = saved.policy;
  if (saved.profile in OPPONENT_PROFILES2) $("profile").value = saved.profile;
  setVariant("S");
  savePractice();
  selectedTileId = null;
  $("seed").value = String(sMatch.seed);
  practiceInfo();
  renderLogs();
  render();
  schedule();
  return true;
}
function renderMatch() {
  const match = currentMatch();
  $("match-panel").hidden = !match;
  $("resume-s-match").hidden = !matchStore.read()?.active || !online && !!sMatch;
  if (!match) return;
  $("match-starting-points").textContent = match.startingPoints.toLocaleString();
  $("match-title").textContent = match.status === "complete" ? "S\uB8F0 \uBC18\uC7A5 \uCD5C\uC885 \uACB0\uACFC" : `S\uB8F0 \uBC18\uC7A5 \xB7 ${match.label}`;
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
    const who = r.seat === humanSeat ? "\uB098" : online ? remote.members.find((m) => m.seat === r.seat)?.name ?? "\uC0C1\uB300" : `AI ${r.seat + 1}`;
    $("match-scores").append(node("div", `${r.rank}\uC704 ${who} \xB7 ${seatName(r.seat)} \xB7 ${r.points.toLocaleString()}\uC810`));
  }
  $("match-rounds").replaceChildren();
  for (const r of match.rounds) {
    const tr = node("tr");
    tr.append(node("td", r.label), node("td", r.result === "win" ? "\uD654\uB8CC" : "\uC720\uAD6D"));
    for (let i = 0; i < 4; i++) tr.append(node("td", `${signedPoints(r.delta[i])} \u2192 ${r.totals[i].toLocaleString()}`));
    tr.append(node("td", String(r.pot)));
    $("match-rounds").append(tr);
  }
  $("match-final-pot").textContent = match.finalTransfers.map((p) => `\uB0A84\uAD6D \uC885\uB8CC \uACF5\uD0C1 ${p.amount}\uC810 \u2192 \uC2DC\uC791 ${SEAT_NAMES[p.to]} \uC790\uB9AC`).join(" / ");
}
function downloadMatch(format = "json", summary = currentMatch()) {
  if (!summary) throw new Error("S\uB8F0 \uBC18\uC7A5 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const a = node("a"), text = format === "csv" ? matchCSV(summary) : JSON.stringify({ format: "wellness-s-match-scores/v1", ...summary }, null, 2), blob = new Blob([text], { type: format === "csv" ? "text/csv;charset=utf-8" : "application/json" });
  a.href = URL.createObjectURL(blob);
  a.download = `S-\uBC18\uC7A5-${summary.id.slice(0, 8)}-\uC810\uC218\uD45C.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
  return { filename: a.download, completedRounds: summary.rounds.length };
}
function showPractice() {
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
  $("practice-info").textContent = "\uAC19\uC740 \uBC29 \uCF54\uB4DC\uB85C \uB124 \uBA85\uC774 \uBAA8\uC774\uBA74 \uC2DC\uC791\uD569\uB2C8\uB2E4. \uAC01\uC790 \uC190\uD328\uB9CC \uBCFC \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
  renderMatch();
  renderLogs();
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
  if (snapshot.match) matchStore.saveSummary(snapshot.match, { seat: snapshot.seat });
  else renderMatch();
  for (let i = 0; i < 4; i++) {
    const member = snapshot.members[i], el = node("div", member ? `${member.name}${member.id === snapshot.me ? " (\uB098)" : ""}${member.seat === null ? "" : ` \xB7 ${seatName(member.seat)}`}` : "\uC785\uC7A5 \uB300\uAE30 \uC911", `room-member${member?.id === snapshot.me ? " is-me" : ""}`);
    $("room-members").append(el);
  }
  $("room-message").textContent = snapshot.state ? snapshot.state.end ? snapshot.match?.status === "complete" ? "\uB0A84\uAD6D \uC885\uB8CC \xB7 \uBC18\uC7A5 \uCD5C\uC885 \uC810\uC218\uB97C \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4." : "\uAD6D\uC774 \uB05D\uB0AC\uC2B5\uB2C8\uB2E4. \uBC29\uC7A5\uC774 \uB2E4\uC74C \uAD6D\uC744 \uC2DC\uC791\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." : `${snapshot.variant ?? "H"}\uB8F0 \xB7 \uC81C${snapshot.gameNumber}\uAD6D \xB7 \uB0B4 \uC790\uB9AC ${seatName(snapshot.seat)}` : `${snapshot.variant ?? "H"}\uB8F0 \xB7 ${snapshot.members.length}/4\uBA85 \uC785\uC7A5 \xB7 \uBC29 \uCF54\uB4DC\uB97C \uCE5C\uAD6C\uC5D0\uAC8C \uC54C\uB824 \uC8FC\uC138\uC694.`;
  $("rematch-room").hidden = !(snapshot.host && snapshot.state?.end);
  $("rematch-room").textContent = snapshot.match?.status === "between-rounds" ? snapshot.match.nextLabel + " \uC2DC\uC791" : snapshot.variant === "S" ? "\uAC19\uC740 \uBA64\uBC84\uB85C \uC0C8 \uBC18\uC7A5" : "\uAC19\uC740 \uBA64\uBC84\uB85C \uC0C8 \uAD6D";
  document.querySelector(".play-layout").hidden = !snapshot.state;
  if (snapshot.state) {
    state = snapshot.state;
    humanSeat = snapshot.seat;
    if (journal.current?.mode !== "online" || journal.current.room !== snapshot.code || journal.current.gameNumber !== snapshot.gameNumber) journal.begin(state, { mode: "online", seat: humanSeat, room: snapshot.code, gameNumber: snapshot.gameNumber, build: buildId });
    journal.observe(state, snapshot.revision);
    $("practice-info").textContent = `4\uC778 \uB300\uAD6D \xB7 \uBC29 ${snapshot.code} \xB7 \uB098\uB294 ${seatName(humanSeat)}. \uD328\uB97C \uC120\uD0DD\uD55C \uB4A4 \uB2E4\uC2DC \uB204\uB974\uAC70\uB098 \uBC84\uB9AC\uAE30\uB85C \uD655\uC815\uD558\uC138\uC694.`;
    render();
  }
  renderLogs();
}
async function connectRoom(join) {
  showOnline();
  $("room-error").textContent = "";
  for (const id of ["create-room", "join-room"]) $(id).disabled = true;
  try {
    return await roomClient.connect($("room-name").value, join ? $("room-code-input").value.trim().toUpperCase() : void 0, chosenVariant);
  } finally {
    for (const id of ["create-room", "join-room"]) $(id).disabled = false;
  }
}
function roomError(error) {
  $("room-error").textContent = error.message;
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
$("rematch-room").onclick = () => roomClient.rematch().catch(roomError);
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
  archiveClient.enqueue(journal.current);
  renderArchiveStatus();
  $("download-current-log").disabled = online && !remote?.state;
  const selected = $("saved-logs").value, logs = journal.list();
  $("saved-logs").replaceChildren();
  for (const log of logs) {
    const option = node("option", `${log.id === journal.current?.id ? "\uD604\uC7AC \xB7 " : ""}${new Date(log.startedAt).toLocaleString("ko-KR")} \xB7 ${log.mode === "practice" ? "\uC5F0\uC2B5 " + log.seed : "4\uC778"} \xB7 ${log.seatName ?? SEAT_NAMES[log.seat]} \xB7 ${signedPoints(log.score)}\uC810${log.issues ? " \xB7 \uC815\uC0B0 \uD655\uC778 \uD544\uC694" : ""}`);
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
    const option = node("option", `${new Date(summary.startedAt).toLocaleString("ko-KR")} \xB7 ${summary.label} \xB7 ${summary.status === "complete" ? "\uC644\uB8CC" : "\uC9C4\uD589 \uAE30\uB85D"} \xB7 \uB098 ${summary.totals[seat].toLocaleString()}\uC810`);
    option.value = summary.id;
    $("saved-matches").append(option);
  }
  if (matches.some((x) => x.summary.id === old)) $("saved-matches").value = old;
  for (const id of ["review-match", "download-saved-match-json", "download-saved-match-csv"]) $(id).disabled = !matches.length;
}
function savedMatch() {
  return matchStore.list().find((x) => x.summary.id === $("saved-matches").value)?.summary;
}
function downloadLog(id, format = "json") {
  const log = journal.read(id);
  if (!log) throw new Error("\uC800\uC7A5\uB41C \uB300\uAD6D\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const text = format === "txt" ? logText(log) : JSON.stringify(compactLog(log)), a = node("a"), blob = new Blob([text], { type: format === "txt" ? "text/plain;charset=utf-8" : "application/json" });
  a.href = URL.createObjectURL(blob);
  const filename = `${log.game.rules.variant === "S" ? "S" : "H"}-${log.game.seed ?? log.room}-${log.id.slice(0, 8)}-\uB300\uAD6D\uB85C\uADF8.${format}`;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
  return { filename, actions: log.actions.length };
}
function saveCurrentLog(format = "json") {
  if (online && !remote?.state) throw new Error("\uC544\uC9C1 4\uC778 \uB300\uAD6D\uC774 \uC2DC\uC791\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
  return downloadLog(journal.current?.id, format);
}
function download() {
  return saveCurrentLog();
}
function randomGame() {
  return start(crypto.getRandomValues(new Uint32Array(1))[0], chosenVariant);
}
function persistPreferences() {
  savePreferences(logStorage, { variant: chosenVariant, recommendations: recommendationsEnabled });
}
function setVariant(variant) {
  if (!["H", "S"].includes(variant)) throw new Error("H \uB610\uB294 S\uB97C \uC120\uD0DD\uD558\uC138\uC694.");
  chosenVariant = variant;
  for (const rule of ["H", "S"]) $("rule-" + rule.toLowerCase()).setAttribute("aria-pressed", String(variant === rule));
  $("random-game").textContent = variant === "S" ? "S\uB8F0 \uC0C8 \uBC18\uC7A5 \u21BB" : "H\uB8F0 \uC0C8 \uB300\uAD6D \u21BB";
  $("create-room").textContent = variant + "\uB8F0 \uBC29 \uB9CC\uB4E4\uAE30";
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
  $("match-review").textContent = [`S\uB8F0 ${m.status === "complete" ? "\uBC18\uC7A5 \uCD5C\uC885 \uACB0\uACFC" : "\uBC18\uC7A5 \uC9C4\uD589 \uAE30\uB85D"} \xB7 ${m.label}`, m.rankings.map((r) => `${r.rank}\uC704 \uC2DC\uC791 ${SEAT_NAMES[r.seat]} ${r.points.toLocaleString()}\uC810`).join(" / "), ...m.rounds.map((r) => `${r.label} ${r.result === "win" ? "\uD654\uB8CC" : "\uC720\uAD6D"}: ${r.totals.map((n, i) => SEAT_NAMES[i] + " " + n + " (" + signedPoints(r.delta[i]) + ")").join(" / ")} \xB7 \uACF5\uD0C1 ${r.pot}`), ...m.finalTransfers.map((t) => `\uC885\uB8CC \uACF5\uD0C1 ${t.amount}\uC810 \u2192 \uC2DC\uC791 ${SEAT_NAMES[t.to]}`)].join("\n");
};
if (!restorePractice()) {
  if (matchStore.error) {
    const message = matchStore.error;
    start(crypto.getRandomValues(new Uint32Array(1))[0], "H");
    $("error").textContent = message;
  } else randomGame();
}
for (const saved of journal.list()) if (saved.id !== journal.current?.id) archiveClient.enqueue(journal.read(saved.id));
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
  $("conclusion").textContent = `\uC774 \uC2DC\uB098\uB9AC\uC624\uC5D0\uC11C C\uB294 B\uBCF4\uB2E4 \uAD6D\uB2F9 ${Math.abs(primary.meanDifference).toFixed(2)}\uC810 ${primary.meanDifference < 0 ? "\uB0AE\uC558\uC2B5\uB2C8\uB2E4" : "\uB192\uC558\uC2B5\uB2C8\uB2E4"}. \uD3C9\uADE0 1\uC704 ${data.conclusion.bestMeanPolicy}; \uC804\uCCB4 \uD6C4\uBCF4\uC5D0 \uB300\uD55C \uD655\uC815 \uC6B0\uC704\uB294 ${data.conclusion.dominatesAllWithBonferroniIntervals ? "\uD655\uC778\uB428" : "\uD655\uC778\uB418\uC9C0 \uC54A\uC74C"}.`;
  const reverse = data.profilePairs.filter((r) => r.comparison === "C-B" && r.ci95Low > 0);
  if (reverse.length) $("conclusion").textContent += " \uC0C1\uB300\uBCC4 \uC608\uC678: " + reverse.map((r) => `${r.profile} C\u2212B +${r.meanDifference.toFixed(2)}\uC810`).join(", ") + ".";
  for (const r of data.summary) {
    const tr = node("tr", void 0, r.policy === data.conclusion.bestMeanPolicy ? "best" : "");
    for (const value of [`${r.policy} \xB7 ${POLICIES2[r.policy].name}`, r.meanNet.toFixed(2) + "\uC810", `${r.ci95Low.toFixed(2)} ~ ${r.ci95High.toFixed(2)}`, (r.winRate * 100).toFixed(1) + "%"]) tr.append(node("td", value));
    $("summary").append(tr);
  }
}).catch(() => {
  $("conclusion").textContent = "\uC644\uB8CC\uB41C \uACB0\uACFC \uD30C\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. headless \uC2E4\uD5D8 \uD6C4 \uBCF4\uACE0\uC11C\uB97C \uC0DD\uC131\uD558\uBA74 \uC5EC\uAE30\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4.";
});
function readGame() {
  if (online && !remote?.state) return { mode: "online", phase: "waiting", room: remote ? { code: remote.code, members: remote.members } : null, legalActions: [], recommendations: [] };
  return { match: currentMatch(), variant: state.rules.variant === "S" ? "S" : "H", recommendationsEnabled, selectedVariant: chosenVariant, mode: online ? "online" : "practice", room: online && remote ? { code: remote.code, members: remote.members, gameNumber: remote.gameNumber } : null, seat: humanSeat, phase: online && !remote?.state ? "waiting" : state.phase, turn: actor4(state), ownHand: state.players[humanSeat].hand.map(typeOf), drawnTile: handDisplay(state, humanSeat).drawn === null ? null : typeOf(handDisplay(state, humanSeat).drawn), scores: state.players.map((p) => p.score), winners: [...state.winners], legalActions: actor4(state) === humanSeat ? legalActions4(state) : [], recommendationRevision, recommendations: structuredClone(currentRecommendations) };
}
if (document.modelContext?.registerTool) {
  const life = new AbortController();
  window.addEventListener("pagehide", () => life.abort(), { once: true });
  for (const tool of [
    { name: "create_h_room", title: "4\uC778 \uB300\uAD6D \uBC29 \uB9CC\uB4E4\uAE30", description: "\uB0B4 \uC774\uB984\uC73C\uB85C \uC0C8 \uC628\uB77C\uC778 \uBC29\uC744 \uB9CC\uB4ED\uB2C8\uB2E4. \uB124 \uBA85\uC774 \uBAA8\uC774\uBA74 \uC2DC\uC791\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { name: { type: "string", minLength: 1, maxLength: 20 } }, required: ["name"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: async ({ name }) => {
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
    { name: "start_h_game", title: "H\uB8F0 \uC0C8 \uAD6D", description: "\uC9C0\uC815\uD55C \uBC30\uD328 \uBC88\uD638\uB85C \uC0C8 \uAD6D\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4. \uAC19\uC740 \uBC88\uD638\uB294 \uB0B4 \uC790\uB9AC\uB3C4 \uB3D9\uC77C\uD558\uAC8C \uC7AC\uD604\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { seed: { type: "integer", minimum: 0, maximum: 4294967295 } }, required: ["seed"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ seed }) => start(seed, "H") },
    { name: "start_practice_game", title: "H/S\uB8F0 \uC0C8 \uC5F0\uC2B5 \uB300\uAD6D", description: "H\uB294 \uD55C \uAD6D, S\uB294 \uB3D91\uAD6D\uBD80\uD130 \uB0A84\uAD6D\uAE4C\uC9C0 \uC0C8 \uBC18\uC7A5\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { seed: { type: "integer", minimum: 0, maximum: 4294967295 }, variant: { type: "string", enum: ["H", "S"] } }, required: ["seed", "variant"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ seed, variant }) => start(seed, variant) },
    { name: "next_s_hand", title: "S\uB8F0 \uB2E4\uC74C \uAD6D", description: "\uD604\uC7AC \uAD6D\uC774 \uB05D\uB098\uBA74 \uC810\uC218\uB97C \uC774\uC6D4\uD558\uACE0 \uAC19\uC740 \uC790\uB9AC\uC5D0\uC11C \uB2E4\uC74C \uAD6D\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4. \uB0A84\uAD6D \uC885\uB8CC \uD6C4\uC5D0\uB294 \uAC70\uC808\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { handNumber: { type: "integer", minimum: 1 } }, required: ["handNumber"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ handNumber }) => nextPracticeHand(handNumber) },
    { name: "save_s_match_scores", title: "S\uB8F0 \uBC18\uC7A5 \uC810\uC218\uD45C \uC800\uC7A5", description: "\uB3D91\uAD6D\uBD80\uD130 \uD604\uC7AC \uAD6D\uAE4C\uC9C0\uC758 \uC810\uC218 \uBCC0\uD654\uC640 \uB204\uC801 \uC810\uC218, \uCD5C\uC885 \uC21C\uC704\uB97C \uD30C\uC77C\uB85C \uC800\uC7A5\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { format: { type: "string", enum: ["json", "csv"] } }, required: ["format"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ format }) => downloadMatch(format) },
    { name: "set_recommendations", title: "\uC804\uB7B5 \uCD94\uCC9C \uCF1C\uAE30\xB7\uB044\uAE30", description: "\uD604\uC7AC \uB300\uAD6D\uC744 \uC720\uC9C0\uD558\uBA74\uC11C \uCD94\uCC9C \uD45C\uC2DC\uB97C \uCF1C\uAC70\uB098 \uB055\uB2C8\uB2E4. \uC124\uC815\uC740 \uC774 \uAE30\uAE30\uC5D0 \uC800\uC7A5\uB429\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { enabled: { type: "boolean" } }, required: ["enabled"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ enabled }) => toggleRecommendations(enabled) },
    { name: "read_h_game", title: "\uB300\uAD6D \uACF5\uAC1C \uC0C1\uD0DC", description: "\uB0B4 \uC790\uB9AC\xB7\uC190\uD328, \uACF5\uAC1C \uB300\uAD6D \uC0C1\uD0DC, \uD569\uBC95 \uD589\uB3D9\uACFC \uD654\uBA74\uC758 \uC804\uB7B5\uBCC4 \uCD94\uCC9C\uC744 \uD655\uC778\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: readGame },
    { name: "save_h_game_log", title: "\uD604\uC7AC \uB300\uAD6D \uB85C\uADF8 \uC800\uC7A5", description: "\uD604\uC7AC \uB300\uAD6D\uC758 \uD589\uB3D9\xB7\uC810\uC218 \uC774\uB3D9\xB7\uD654\uB8CC \uACC4\uC0B0\uACFC \uD328\uBCF4\uB97C JSON \uB610\uB294 \uC77D\uAE30 \uC26C\uC6B4 TXT \uD30C\uC77C\uB85C \uB0B4\uB824\uBC1B\uC2B5\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { format: { type: "string", enum: ["json", "txt"] } }, required: ["format"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ format }) => saveCurrentLog(format) },
    { name: "play_h_recommendation", title: "\uC804\uB7B5 \uCD94\uCC9C \uD55C \uBC88 \uC2E4\uD589", description: "\uB0B4 \uC218\uB3D9 \uC120\uD0DD \uCC28\uB840\uC5D0 \uD654\uBA74\uC758 \uC804\uB7B5 \uCD94\uCC9C \uBC84\uD2BC\uC744 \uD55C \uBC88 \uC2E4\uD589\uD569\uB2C8\uB2E4. read_h_game\uC5D0\uC11C \uBC1B\uC740 \uCD5C\uC2E0 recommendationRevision\uC744 revision\uC73C\uB85C \uC804\uB2EC\uD558\uC138\uC694. mode=discard\uB294 \uAE61 \uB300\uC2E0 \uD45C\uC2DC\uB41C \uBC84\uB9BC\uD328 \uB300\uC548\uC744 \uC120\uD0DD\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { policy: { type: "string", enum: ["A", "B", "C", "D", "E"] }, mode: { type: "string", enum: ["recommended", "discard"] }, revision: { type: "integer", minimum: 0 } }, required: ["policy", "mode", "revision"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ policy, mode, revision }) => executeRecommendation(policy, mode, revision) }
  ]) Promise.resolve(document.modelContext.registerTool(tool, { signal: life.signal })).catch(() => {
  });
}
