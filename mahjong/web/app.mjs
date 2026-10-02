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
function scoreHand(tiles2, melds = [], context = {}, r = DEFAULT_RULES) {
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
    add("menzen", closed && (!r.menzenRequiresTsumo || context.method === "tsumo"));
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
      if (context.method === "ron" && context.winTile !== void 0) {
        const t = context.winTile, otherPlacement = d.pair === t || d.groups.some((g) => g.type === "chi" && t >= g.tile && t <= g.tile + 2);
        if (!otherPlacement && d.groups.some((g) => g.type === "pon" && g.tile === t)) concealed--;
      }
      add("sanankou", concealed >= 3);
    }
    const trip = gs.filter((g) => g.type !== "chi"), bonuses = {
      kan: melds.filter((m) => m.type === "kan").length * r.kanBonus,
      dragon: trip.filter((g) => g.tile >= 31).length * r.dragonBonus,
      roundWind: trip.filter((g) => g.tile === r.roundWind).length * r.roundWindBonus,
      seatWind: trip.filter((g) => g.tile === (context.seatWind ?? 27)).length * r.seatWindBonus
    };
    for (const id of ids) allEligible.add(id);
    ids.sort((a, b) => YAKU[b][1] - YAKU[a][1]);
    const base = YAKU[ids[0]][1], bonus = Object.values(bonuses).reduce((a, b) => a + b, 0), total = base + bonus;
    if (!best || total > best.total) best = { yaku: ids[0], name: YAKU[ids[0]][0], base, bonus, total, bonuses, eligibleYaku: ids, closed, shape: d };
  }
  best.eligibleYaku = [...allEligible].sort((a, b) => YAKU[b][1] - YAKU[a][1]);
  return best;
}
function winningTiles(tiles2, melds = [], context = {}, r = DEFAULT_RULES) {
  const c = counts([...tiles2, ...melds.flatMap((m) => m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : Array(m.type === "kan" ? 4 : 3).fill(m.tile))]);
  const out = [];
  for (let t = 0; t < 34; t++) if (c[t] < 4) {
    const score = scoreHand([...tiles2, t], melds, { ...context, method: "ron", winTile: t }, r);
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
      const tt = Math.min(4 - mm, t + dt), key2 = mm * 2 + pp;
      if ((out.get(key2) ?? -1) < tt) out.set(key2, tt);
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
      const nt = Math.min(4 - nm, t + tt), key2 = nm * 2 + np;
      if ((next.get(key2) ?? -1) < nt) next.set(key2, nt);
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
    const metrics = value13(c, melds, o, w, t);
    c[t]++;
    const r = { tile: t, ...metrics };
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

// web/practice-flow.mjs
var AUTO_PASS_DELAY_MS = 700;
var SEAT_NAMES = ["\uB3D9", "\uB0A8", "\uC11C", "\uBD81"];
var practiceSeat = (seed) => seed >>> 16 & 3;
function displayedTurn(state2) {
  if (state2.phase === "reaction") return state2.reaction.source;
  return state2.phase === "turn" ? state2.turn : null;
}
function resolveAiReactions(state2, humanSeat2, choose, apply = step) {
  while (state2.phase === "reaction" && actor(state2) !== humanSeat2) {
    const seat = actor(state2);
    apply(state2, seat, choose(observation(state2, seat)));
  }
}
function handDisplay(state2, seat = 0) {
  const player = state2.players[seat];
  const drawn = state2.phase === "turn" && actor(state2) === seat && !player.won && player.drawn !== null && player.hand.includes(player.drawn) ? player.drawn : null;
  return { held: player.hand.filter((id) => id !== drawn), drawn };
}
function needsAutomaticPass(state2, seat = 0) {
  if (state2.phase !== "reaction" || actor(state2) !== seat) return false;
  const actions = legalActions(state2, seat);
  return actions.length === 1 && actions[0].type === "pass";
}
function nextDelay(state2, autoplay, seat = 0) {
  if (state2.phase === "end") return null;
  if (needsAutomaticPass(state2, seat)) return AUTO_PASS_DELAY_MS;
  if (actor(state2) !== seat || autoplay) return autoplay ? 30 : 90;
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
  if (action.type === "tsumo") return "\uC9C0\uAE08 \uCBD4\uBAA8 \uD654\uB8CC\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.";
  if (action.type === "ron") return policy === "C" ? "\uC774 \uADDC\uCE59\uC5D0\uC11C\uB294 \uB860\uC744 \uB118\uAE38 \uC218 \uC5C6\uC5B4 \uD654\uB8CC\uD569\uB2C8\uB2E4." : "\uC644\uC131\uB41C \uD328\uB85C \uC9C0\uAE08 \uB860 \uD654\uB8CC\uD569\uB2C8\uB2E4.";
  if (action.type === "pass") {
    if (view.legalActions.some((a) => a.type === "ron")) return "\uD569\uBC95\uC801\uC778 \uB860\uC744 \uB118\uAE30\uACE0 \uCBD4\uBAA8\uB97C \uAE30\uB2E4\uB9AC\uB294 \uC120\uD0DD\uC785\uB2C8\uB2E4.";
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
  return Object.entries(POLICIES).map(([policy, config]) => {
    const action = chooseAction(view, policy);
    let discard = null;
    if (discards.length && action.type !== "tsumo") {
      const selected = action.type === "discard" ? action : chooseAction({ ...view, legalActions: discards }, policy);
      const metrics = evaluateDiscards({ ...view, legalActions: [selected] }, policy)[0];
      discard = {
        action: { ...selected },
        label: actionLabel(selected),
        shanten: metrics.shanten,
        ukeire: metrics.ukeire
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
  for (const [key2, value] of Object.entries(attributes)) el.setAttribute(key2, String(value));
  return el;
}
function span(text, cls) {
  const el = document.createElement("span");
  el.className = cls;
  el.textContent = text;
  return el;
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
    for (const [index, [x, y]] of dots[n].entries()) {
      if (type < 18) {
        const color = n === 1 ? "#245176" : n === 5 && index === 2 ? "#b12739" : index % 3 === 0 ? "#b12739" : "#245176";
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
  return !auto2 && Number.isInteger(id) && state2.phase === "turn" && actor(state2) === seat && state2.players[seat].hand.includes(id) && legalActions(state2, seat).some((a) => a.type === "discard" && a.tile === typeOf(id));
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
var key = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
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
  async connect(name, code) {
    this.stop();
    const generation = this.generation;
    const saved = this.saved();
    this.session = { key: saved?.key ?? key(), name, code: code ?? null };
    this.snapshot = null;
    this.onStatus("\uBC29\uC5D0 \uC5F0\uACB0 \uC911\u2026");
    const data = await this.request(code ? `rooms/${code}/join` : "rooms", { name });
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
function winSettlement(state2, seat) {
  const player = state2.players[seat], win2 = player.win;
  if (!win2) return null;
  const { score } = win2;
  const payerCount = win2.method === "tsumo" ? state2.players.length - win2.order : 1;
  const tsumoBonus = win2.method === "tsumo" ? state2.rules.tsumoBonusPerPayer : 0;
  const perPayer = score.total + tsumoBonus, expectedReceipt = perPayer * payerCount;
  const receipt = Array.isArray(state2.ledger) ? state2.ledger.filter((payment) => payment.to === seat && payment.kind === win2.method).reduce((sum, payment) => sum + payment.amount, 0) : expectedReceipt;
  const parts = [`\uC5ED ${score.base}`];
  if (score.bonus) parts.push(`\uAC00\uC0B0 ${score.bonus}`);
  if (win2.method === "tsumo") parts.push(`\uCBD4\uBAA8 ${tsumoBonus}`);
  return {
    payerCount,
    perPayer,
    receipt,
    expectedReceipt,
    net: player.score,
    previousNet: player.score - receipt,
    title: `${score.name} ${win2.method === "tsumo" ? "\uCBD4\uBAA8" : "\uB860"} \xB7 \uC774\uBC88 \uD654\uB8CC +${receipt}\uC810`,
    calculation: `(${parts.join(" + ")}) \xD7 ${payerCount}\uBA85 = +${expectedReceipt}\uC810${receipt !== expectedReceipt ? ` \xB7 \uC2E4\uC81C \uC774\uCCB4 +${receipt}\uC810 (\uC815\uC0B0 \uD655\uC778 \uD544\uC694)` : ""}`
  };
}

// web/game-log.mjs
var LOG_FORMAT = "h-mahjong-log/v1";
var PREFIX = "h-mahjong-log-v1:";
var INDEX = PREFIX + "index";
var MAX_LOGS = 10;
var MAX_CHARS = 15e5;
var clone = (value) => structuredClone(value);
var scores = (game) => game.players.map((player) => player.score);
var seats = ["\uB3D9", "\uB0A8", "\uC11C", "\uBD81"];
var signed = (value) => `${value > 0 ? "+" : ""}${value}`;
function beforeAction(game) {
  return { scores: scores(game), active: game.players.flatMap((p, i) => p.won ? [] : [i]), events: game.events.length, ledger: game.ledger.length };
}
function actionRecord(game, seat, action, before, error = null) {
  const after = scores(game), payments = clone(game.ledger.slice(before.ledger)), issues = [];
  const delta = after.map((value, i) => value - before.scores[i]), ledgerDelta = [0, 0, 0, 0];
  for (const payment of payments) {
    ledgerDelta[payment.from] -= payment.amount;
    ledgerDelta[payment.to] += payment.amount;
  }
  if (delta.some((value, i) => value !== ledgerDelta[i])) issues.push("\uC810\uC218 \uBCC0\uD654\uC640 \uC2E4\uC81C \uC774\uCCB4 \uB0B4\uC5ED\uC774 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  const wins = game.events.slice(before.events).filter((e) => e.type === "win").map((win2) => {
    const payers = win2.method === "tsumo" ? before.active.filter((i) => i !== win2.seat) : [win2.source];
    const actual = payments.filter((p) => p.to === win2.seat && p.kind === win2.method);
    const tsumoBonus = win2.method === "tsumo" ? game.rules.tsumoBonusPerPayer : 0;
    const perPayer = win2.score.total + tsumoBonus, expectedReceipt = perPayer * payers.length, actualReceipt = actual.reduce((sum, p) => sum + p.amount, 0);
    const problems = [];
    if (actual.length !== payers.length || payers.some((i) => actual.filter((p) => p.from === i && p.amount === perPayer).length !== 1)) problems.push("\uC9C0\uAE09\uC790 \uB610\uB294 \uC9C0\uAE09\uC561\uC774 \uC801\uC6A9 \uADDC\uCE59\uACFC \uB2E4\uB985\uB2C8\uB2E4.");
    if ((win2.score.yaku === "pinfu" || win2.score.name === "\uD551\uD6C4") && (win2.score.base !== 100 || win2.score.bonus !== 0 || win2.score.total !== 100)) problems.push("\uD551\uD6C4 \uC5ED \uC810\uC218 \uB610\uB294 \uAC00\uC0B0\uC810\uC774 \uC798\uBABB\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    if (actualReceipt !== expectedReceipt || delta[win2.seat] !== actualReceipt) problems.push("\uD654\uB8CC \uC218\uC785\uACFC \uC810\uC218 \uBCC0\uD654\uAC00 \uB2E4\uB985\uB2C8\uB2E4.");
    issues.push(...problems.map((text) => `${seats[win2.seat]}: ${text}`));
    return { seat: win2.seat, method: win2.method, order: win2.order, score: clone(win2.score), tsumoBonus, payers, perPayer, expectedReceipt, actualReceipt, scoreBefore: before.scores[win2.seat], scoreAfter: after[win2.seat], payments: actual, issues: problems };
  });
  const draws = game.events.slice(before.events).filter((e) => e.type === "draw" || e.type === "kanDraw").map(({ type, seat: seat2, id }) => ({ type, seat: seat2, id }));
  return { seat, action: clone(action), before: before.scores, after, delta, payments, wins, draws, issues, ...error ? { error: String(error.message ?? error) } : {} };
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
    return { id: log.id, startedAt: log.startedAt, updatedAt: log.updatedAt, mode: log.mode, seed: log.game.seed ?? null, seat: log.humanSeat, status: log.game.end ?? "in-progress", score: log.game.players[log.humanSeat].score, actions: log.actions.length, issues: log.actions.reduce((n, a) => n + a.issues.length, 0) + log.errors.length };
  }
  list() {
    const all = this.index().filter((x) => x.id !== this.current?.id);
    return this.current ? [this.summary(), ...all] : all;
  }
  read(id = this.current?.id) {
    if (id === this.current?.id) return clone(this.current);
    try {
      const log = JSON.parse(this.storage?.getItem(PREFIX + id) ?? "null");
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
    const text = JSON.stringify(this.current), summary = { ...this.summary(), chars: text.length };
    if (text.length > MAX_CHARS) return false;
    const previous = this.index().filter((x) => x.id !== summary.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const keep = [summary], remove = [];
    let size = text.length;
    for (const entry of previous) {
      if (keep.length < MAX_LOGS && size + (entry.chars ?? 0) <= MAX_CHARS) {
        keep.push(entry);
        size += entry.chars ?? 0;
      } else remove.push(entry);
    }
    try {
      this.storage.setItem(PREFIX + summary.id, text);
      this.storage.setItem(INDEX, JSON.stringify(keep));
      for (const entry of remove) this.storage.removeItem(PREFIX + entry.id);
      this.persisted = true;
    } catch {
      return false;
    }
    return true;
  }
};
function logText(log) {
  const game = log.game, lines = [
    "H\uB8F0 \uB9C8\uC791 \uB300\uAD6D \uB85C\uADF8",
    `\uC2DC\uC791: ${log.startedAt}`,
    `\uCD5C\uADFC \uC800\uC7A5: ${log.updatedAt}`,
    `\uBAA8\uB4DC: ${log.mode === "practice" ? "\uD63C\uC790 \uC5F0\uC2B5" : "4\uC778 \uB300\uAD6D (\uBC1B\uC740 \uACF5\uAC1C \uC815\uBCF4\uC640 \uB0B4 \uC190\uD328)"}`,
    `\uB0B4 \uC790\uB9AC: ${seats[log.humanSeat]}`,
    `\uBC30\uD328 \uBC88\uD638: ${game.seed ?? "\uC11C\uBC84 \uBE44\uACF5\uAC1C"}`,
    `\uD654\uBA74 \uBC84\uC804: ${log.build ?? "\uBBF8\uAE30\uB85D"}`,
    `\uCBD4\uBAA8 \uBCF4\uB108\uC2A4: \uC9C0\uAE09\uC790\uB9C8\uB2E4 ${game.rules.tsumoBonusPerPayer}\uC810`,
    `\uCD5C\uC885 \uC810\uC218: ${scores(game).map((score, i) => `${seats[i]} ${signed(score)}`).join(" / ")}`,
    ""
  ];
  for (const entry of log.actions) {
    const action = entry.action, tile = Number.isInteger(action.tile) ? ` ${tileName(action.tile)}` : "";
    lines.push(`#${entry.n + 1} ${seats[entry.seat]} ${action.type}${tile} | \uC804 ${entry.before.join(", ")} \u2192 \uD6C4 ${entry.after.join(", ")}`);
    for (const win2 of entry.wins) lines.push(`  ${seats[win2.seat]} ${win2.score.name} ${win2.method === "tsumo" ? "\uCBD4\uBAA8" : "\uB860"}: \uC5ED ${win2.score.base} + \uAC00\uC0B0 ${win2.score.bonus} + \uCBD4\uBAA8 ${win2.tsumoBonus}, \uC9C0\uAE09\uC790 ${win2.payers.length}\uBA85, \uADDC\uCE59\uC0C1 ${win2.expectedReceipt}, \uC2E4\uC81C \uC218\uC785 ${win2.actualReceipt}`);
    for (const payment of entry.payments) lines.push(`  ${seats[payment.from]} \u2192 ${seats[payment.to]}: ${payment.amount}\uC810 (${payment.kind})`);
    for (const draw2 of entry.draws) lines.push(`  ${seats[draw2.seat]} ${draw2.type === "kanDraw" ? "\uBCF4\uCDA9\uD328" : "\uBF51\uC740 \uD328"}: ${tileName(typeOf(draw2.id))}`);
    for (const issue of entry.issues) lines.push(`  [\uC815\uC0B0 \uD655\uC778 \uD544\uC694] ${issue}`);
    if (entry.error) lines.push(`  [\uC2E4\uD589 \uC624\uB958] ${entry.error}`);
  }
  for (const entry of log.observations) lines.push(`\uC218\uC2E0 ${entry.revision}: ${entry.before.join(", ")} \u2192 ${entry.after.join(", ")} (\uC218\uC2E0 \uC0AC\uC774\uC758 \uAC1C\uBCC4 \uD589\uB3D9\uC740 \uC11C\uBC84\uC5D0\uC11C \uD655\uC778 \uD544\uC694)`);
  lines.push("", "\uD604\uC7AC \uC190\uD328\xB7\uD6C4\uB85C (JSON\uC5D0\uB294 \uC6D0\uBCF8 \uD328 \uBC88\uD638\uC640 \uC0C1\uC138 \uAE30\uB85D \uD3EC\uD568)");
  for (let seat = 0; seat < 4; seat++) {
    const p = game.players[seat];
    lines.push(`${seats[seat]}: ${p.hand.map((id) => tileName(typeOf(id))).join(" ")} / ${p.melds.map((m) => `${m.type} ${m.ids.map((id) => tileName(typeOf(id))).join(" ")}`).join(" / ")}`);
  }
  for (const error of log.errors) lines.push(`[\uC624\uB958 ${error.at}] ${error.message}`);
  return lines.join("\n") + "\n";
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
var logStorage = null;
try {
  logStorage = localStorage;
} catch {
}
var journal = new GameJournal({ storage: logStorage });
var buildId = new URL(import.meta.url).searchParams.get("v") ?? "local-source";
var needsPass = (s, seat) => online && s === state ? s.phase === "reaction" && remote?.legalActions.length === 1 && remote.legalActions[0].type === "pass" : needsAutomaticPass(s, seat);
var actor2 = (s) => online && remote && s === state ? remote.legalActions.length ? humanSeat : actor(s) : actor(s);
var legalActions2 = (s) => online && s === state ? remote?.legalActions ?? [] : legalActions(s);
var observation2 = (s) => online && s === state ? remote?.observation : observation(s);
var canChooseTile = (id) => online ? !networkBusy && roomClient.connected && state.players[humanSeat].hand.includes(id) && legalActions2(state).some((a) => a.type === "discard" && a.tile === typeOf(id)) : canSelectTile(state, humanSeat, id, auto);
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
for (const [id, p] of Object.entries(POLICIES)) {
  const opt = document.createElement("option");
  opt.value = id;
  opt.textContent = `${id} \xB7 ${p.name}`;
  $("policy").append(opt);
}
$("policy").value = "D";
function node(tag, text, cls) {
  const el = document.createElement(tag);
  if (text !== void 0) el.textContent = text;
  if (cls) el.className = cls;
  return el;
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
  $("selection-hint").textContent = state.end ? "\uC0C8 \uB300\uAD6D\uC73C\uB85C \uB2E4\uC2DC \uC5F0\uC2B5\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." : state.players[humanSeat].won ? "\uD654\uB8CC\uD588\uC2B5\uB2C8\uB2E4. \uB0A8\uC740 \uB300\uAD6D\uC744 \uC9C0\uCF1C\uBCF4\uC138\uC694." : auto ? "\uC120\uD0DD\uD55C \uC804\uB7B5\uC73C\uB85C \uC790\uB3D9 \uB300\uAD6D \uC911\uC785\uB2C8\uB2E4." : actor2(state) !== humanSeat ? "\uC0C1\uB300\uAC00 \uC9C4\uD589 \uC911\uC785\uB2C8\uB2E4." : state.phase === "reaction" ? "\uAC00\uB2A5\uD55C \uD589\uB3D9\uC744 \uC120\uD0DD\uD558\uC138\uC694." : selectedTileId === null ? "\uD328\uB97C \uC120\uD0DD \u2192 \uB2E4\uC2DC \uB204\uB974\uAC70\uB098 \u2018\uBC84\uB9AC\uAE30\u2019\uB85C \uD655\uC815" : `${tileName(typeOf(selectedTileId))} \uC120\uD0DD \xB7 \uB2E4\uC2DC \uB204\uB974\uAC70\uB098 \u2018\uBC84\uB9AC\uAE30\u2019\uB85C \uD655\uC815`;
}
function renderMeld(m) {
  const el = node("div", void 0, "meld");
  el.setAttribute("aria-label", meldText(m));
  el.append(node("span", m.type === "kan" ? m.open ? "\uAE61" : "\uC548\uAE61" : m.type === "pon" ? "\uD401" : "\uCE58", "meld-label"));
  tiles(el, m.ids.map(typeOf));
  return el;
}
function renderRiver(parent, player) {
  parent.replaceChildren();
  for (const d of player.river) {
    const t = tileFace(typeOf(d.id), { small: true });
    t.classList.toggle("claimed", !!d.claimed);
    t.classList.toggle("last-discard", state.phase === "reaction" && state.reaction.id === d.id);
    if (d.claimed) t.setAttribute("aria-label", `${tileName(typeOf(d.id))}, \uD6C4\uB85C\uC5D0 \uC0AC\uC6A9\uB428`);
    parent.append(t);
  }
}
function discardMetrics(discard) {
  return `${discard.shanten === 0 ? "\uD150\uD30C\uC774 (0\uC0E8\uD150)" : discard.shanten + "\uC0E8\uD150"} \xB7 \uC720\uD6A8\uD328 \uCD94\uC815 ${discard.ukeire}\uC7A5`;
}
function renderRecommendations() {
  const revision = ++recommendationRevision, list = $("recommendation-list"), status = $("recommendation-status");
  currentRecommendations = [];
  list.replaceChildren();
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
  if (actor2(state) !== humanSeat) {
    status.textContent = "\uB0B4 \uC120\uD0DD \uCC28\uB840\uAC00 \uB418\uBA74 A~E \uC804\uB7B5\uC758 \uCD94\uCC9C\uC744 \uD568\uAED8 \uBCF4\uC5EC\uC90D\uB2C8\uB2E4.";
    return;
  }
  if (needsPass(state, humanSeat)) {
    status.textContent = "\uC9C0\uAE08\uC740 \uB118\uAE30\uAE30\uB9CC \uAC00\uB2A5\uD574 0.7\uCD08 \uB4A4 \uC790\uB3D9\uC73C\uB85C \uC9C4\uD589\uD569\uB2C8\uB2E4.";
    return;
  }
  currentRecommendations = strategyRecommendations(observation2(state, humanSeat));
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
      alternative.append(node("p", "\uAE61 \uB300\uC2E0 \uBC84\uB9B0\uB2E4\uBA74", "alternative-title"), node("p", discardMetrics(rec.discard), "recommendation-metrics"));
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
  if (!Object.hasOwn(POLICIES, policy) || !["recommended", "discard"].includes(mode)) throw new Error("\uC804\uB7B5\uACFC \uCD94\uCC9C \uC885\uB958\uB97C \uB2E4\uC2DC \uC120\uD0DD\uD558\uC138\uC694.");
  if (!Number.isSafeInteger(revision) || revision !== recommendationRevision) throw new Error("\uB300\uAD6D \uC0C1\uD0DC\uAC00 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4. \uC0C8 \uCD94\uCC9C\uC744 \uD655\uC778\uD558\uC138\uC694.");
  if (auto || actor2(state) !== humanSeat) throw new Error("\uB0B4\uAC00 \uC9C1\uC811 \uC120\uD0DD\uD558\uB294 \uCC28\uB840\uC5D0\uB9CC \uCD94\uCC9C\uC744 \uC2E4\uD589\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
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
  const a = actor2(state), shownTurn = displayedTurn(state), p = state.players[humanSeat], positions = seatPositions(humanSeat);
  const reacting = state.phase === "reaction", humanChoice = reacting && a === humanSeat && !auto && !needsPass(state, humanSeat);
  $("game-status").textContent = state.end ? `${state.end === "three-winners" ? "\uC138 \uBC88\uC9F8 \uD654\uB8CC" : "\uC720\uAD6D"} \xB7 \uAD6D \uC885\uB8CC` : p.won ? "\uD654\uB8CC \uC644\uB8CC \xB7 \uB0A8\uC740 \uB300\uAD6D \uC9C4\uD589 \uC911" : reacting ? humanChoice ? "\uB860 \xB7 \uD6C4\uB85C \uC120\uD0DD" : "\uD6C4\uB85C \uD655\uC778 \uC911" : a === humanSeat ? "\uB0B4 \uCC28\uB840 \xB7 \uBC84\uB9BC\uD328 \uC120\uD0DD" : `${SEAT_NAMES[a]} \uD50C\uB808\uC774\uC5B4 \uCC28\uB840`;
  $("turn-indicator").textContent = state.end ? "\uAD6D \uC885\uB8CC" : reacting ? humanChoice ? "\uB860 \xB7 \uD6C4\uB85C \uC120\uD0DD \uAC00\uB2A5" : "\uD6C4\uB85C \uD655\uC778 \uC911" : a === humanSeat ? "\u25CF \uB0B4 \uCC28\uB840" : `${SEAT_NAMES[a]} \uC9C4\uD589 \uC911`;
  $("wall").textContent = `\uB0A8\uC740 \uD328 ${state.wall.length}`;
  $("win-count").textContent = `\uD654\uB8CC ${state.winners.length} / 3\uBA85`;
  $("opponents").replaceChildren();
  $("rivers").replaceChildren();
  for (const [position, i] of Object.entries(positions)) {
    const wind = $(`wind-${position}`);
    wind.textContent = ["\u6771", "\u5357", "\u897F", "\u5317"][i];
    wind.classList.toggle("active-wind", i === shownTurn);
    if (position === "bottom") continue;
    const pl = state.players[i], card = node("div", void 0, `opponent opponent-${position}${pl.won ? " won" : ""}${shownTurn === i ? " active" : ""}`), title = node("div", void 0, "player-title"), who = node("span", void 0, "player-seat");
    who.append(node("span", ["\u6771", "\u5357", "\u897F", "\u5317"][i], "seat-badge"), node("span", online ? remote.members.find((m) => m.seat === i)?.name ?? "\uD50C\uB808\uC774\uC5B4" : "AI", "player-name"));
    title.append(who, node("span", `${pl.score > 0 ? "+" : ""}${pl.score}`, "player-score"));
    card.append(title, node("p", pl.won ? `${pl.win.order}\uBC88\uC9F8 ${pl.win.method === "ron" ? "\uB860" : "\uCBD4\uBAA8"} \xB7 ${pl.win.score.name}` : `${SEAT_NAMES[i]} \xB7 \uC190\uD328 ${pl.handSize ?? pl.hand.length}\uC7A5`, "player-sub"));
    for (const m of pl.melds) card.append(renderMeld(m));
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
    river.setAttribute("aria-label", `${SEAT_NAMES[i]} \uBC84\uB9BC\uD328`);
    renderRiver(river, pl);
    $("rivers").append(river);
  }
  $("self-title").replaceChildren(node("span", ["\u6771", "\u5357", "\u897F", "\u5317"][humanSeat], "seat-badge"), node("span", `${SEAT_NAMES[humanSeat]} \xB7 \uB098`), node("span", `\uAD6D \uB204\uC801 ${signedPoints(p.score)}\uC810`, "self-score"));
  if (p.won) $("self-title").append(node("span", `${p.win.order}\uBC88\uC9F8 \uD654\uB8CC`, "player-sub"));
  const settlement = winSettlement(state, humanSeat), result = $("win-settlement");
  result.hidden = !settlement;
  result.replaceChildren();
  if (settlement) {
    result.append(node("strong", settlement.title), node("p", settlement.calculation));
    if (settlement.previousNet !== 0) result.append(node("p", `\uD654\uB8CC \uC804 \uB204\uC801 ${signedPoints(settlement.previousNet)}\uC810 \u2192 \uAD6D \uB204\uC801 ${signedPoints(settlement.net)}\uC810`));
  }
  $("melds").replaceChildren();
  for (const m of p.melds) $("melds").append(renderMeld(m));
  const legal = a === humanSeat ? legalActions2(state) : [], hand = handDisplay(state, humanSeat), automaticPass = needsPass(state, humanSeat);
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
  $("events").replaceChildren();
  for (const e of state.events.filter((e2) => ["win", "kan", "drawSettlement", "call"].includes(e2.type)).slice(-30)) {
    const settlement2 = e.type === "win" ? winSettlement(state, e.seat) : null;
    const text = settlement2 ? `${SEAT_NAMES[e.seat]}: ${settlement2.title} \xB7 ${settlement2.calculation}` : e.type === "call" ? `${SEAT_NAMES[e.seat]}: ${e.action.type}` : e.type === "kan" ? `${SEAT_NAMES[e.seat]}: \uAE61, \uBCF4\uCDA9\uD328 \uC218\uB839` : "\uC720\uAD6D \uD150\uD30C\uC774 \uC815\uC0B0 \uC644\uB8CC";
    $("events").append(node("li", text));
  }
}
function aiAction(view) {
  const spec = view.seat === humanSeat ? { id: $("policy").value } : OPPONENT_PROFILES[$("profile").value][(view.seat - humanSeat + 4) % 4 - 1];
  return chooseAction(view, spec.id, spec.weights);
}
function loggedStep(game, seat, action) {
  const before = beforeAction(game);
  try {
    const result = step(game, seat, action);
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
  journal.save(state);
  renderLogs();
  render();
  schedule();
}
function playHumanAction(action) {
  if (auto || actor2(state) !== humanSeat) throw new Error("\uB0B4 \uCC28\uB840\uC5D0 \uC9C1\uC811 \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
  if (online) return playOnlineAction(action);
  loggedStep(state, humanSeat, action);
  selectedTileId = null;
  $("error").textContent = "";
  finishAction();
  return { seat: humanSeat, phase: state.phase, turn: actor2(state) };
}
async function playOnlineAction(action) {
  if (networkBusy || !roomClient.connected) throw new Error("\uC11C\uBC84 \uC751\uB2F5\uC744 \uAE30\uB2E4\uB824 \uC8FC\uC138\uC694.");
  networkBusy = true;
  selectedTileId = null;
  render();
  try {
    await roomClient.act(action);
    $("error").textContent = "";
    return { seat: humanSeat, phase: state.phase, turn: actor2(state) };
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
  const seat = actor2(state), automaticPass = needsPass(state, humanSeat);
  if (seat === humanSeat && !auto && !automaticPass) {
    render();
    return;
  }
  try {
    if (automaticPass) {
      loggedStep(state, humanSeat, { type: "pass" });
    } else {
      loggedStep(state, seat, aiAction(observation2(state)));
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
  const delay = nextDelay(state, auto, humanSeat);
  if (delay !== null) timer = setTimeout(tick, delay);
}
function updateAuto() {
  $("autoplay").setAttribute("aria-pressed", String(auto));
  $("autoplay").textContent = auto ? "\uC790\uB3D9 \uB300\uAD6D \uBA48\uCD94\uAE30" : "\uB0B4 \uC790\uB9AC\uB3C4 AI\uB85C";
}
function start(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("\uC2DC\uB4DC\uB294 0\u20134294967295\uC758 \uC815\uC218\uC5EC\uC57C \uD569\uB2C8\uB2E4.");
  showPractice();
  if (timer) clearTimeout(timer);
  auto = false;
  selectedTileId = null;
  updateAuto();
  humanSeat = practiceSeat(seed);
  state = createGame({ seed });
  journal.begin(state, { mode: "practice", seat: humanSeat, policy: $("policy").value, profile: $("profile").value, build: buildId });
  renderLogs();
  $("seed").value = String(seed);
  $("practice-info").textContent = `\uB0B4 \uC790\uB9AC\uB294 ${SEAT_NAMES[humanSeat]}\uC785\uB2C8\uB2E4. \uC0C1\uB300 3\uBA85\uC740 AI\uC774\uBA70 \uB3D9\uBD80\uD130 \uC2DC\uC791\uD569\uB2C8\uB2E4. \uD328\uB97C \uC120\uD0DD\uD55C \uB4A4 \uB2E4\uC2DC \uB204\uB974\uAC70\uB098 \uBC84\uB9AC\uAE30\uB85C \uD655\uC815\uD558\uC138\uC694. \uAC00\uB2A5\uD55C \uD6C4\uB85C\uAC00 \uC5C6\uC73C\uBA74 0.7\uCD08 \uB4A4 \uB118\uAE30\uBA70, \uB300\uAD6D \uB85C\uADF8\uB294 \uC774 \uAE30\uAE30\uC5D0 \uC790\uB3D9 \uC800\uC7A5\uB429\uB2C8\uB2E4.`;
  $("error").textContent = "";
  render();
  schedule();
  return { seed, seat: humanSeat, remaining: state.wall.length };
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
  renderLogs();
}
function receiveRoom(snapshot) {
  if (!online) return;
  remote = snapshot;
  networkBusy = false;
  $("room-info").hidden = false;
  $("room-code").textContent = snapshot.code;
  $("room-code-input").value = snapshot.code;
  $("room-error").textContent = "";
  $("room-members").replaceChildren();
  for (let i = 0; i < 4; i++) {
    const member = snapshot.members[i], el = node("div", member ? `${member.name}${member.id === snapshot.me ? " (\uB098)" : ""}${member.seat === null ? "" : ` \xB7 ${SEAT_NAMES[member.seat]}`}` : "\uC785\uC7A5 \uB300\uAE30 \uC911", `room-member${member?.id === snapshot.me ? " is-me" : ""}`);
    $("room-members").append(el);
  }
  $("room-message").textContent = snapshot.state ? snapshot.state.end ? "\uAD6D\uC774 \uB05D\uB0AC\uC2B5\uB2C8\uB2E4. \uBC29\uC7A5\uC774 \uC0C8 \uAD6D\uC744 \uC2DC\uC791\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4." : `\uC81C${snapshot.gameNumber}\uAD6D \xB7 \uB0B4 \uC790\uB9AC ${SEAT_NAMES[snapshot.seat]}` : `${snapshot.members.length}/4\uBA85 \uC785\uC7A5 \xB7 \uBC29 \uCF54\uB4DC\uB97C \uCE5C\uAD6C\uC5D0\uAC8C \uC54C\uB824 \uC8FC\uC138\uC694.`;
  $("rematch-room").hidden = !(snapshot.host && snapshot.state?.end);
  document.querySelector(".play-layout").hidden = !snapshot.state;
  if (snapshot.state) {
    state = snapshot.state;
    humanSeat = snapshot.seat;
    if (journal.current?.mode !== "online" || journal.current.room !== snapshot.code || journal.current.gameNumber !== snapshot.gameNumber) journal.begin(state, { mode: "online", seat: humanSeat, room: snapshot.code, gameNumber: snapshot.gameNumber, build: buildId });
    journal.observe(state, snapshot.revision);
    $("practice-info").textContent = `4\uC778 \uB300\uAD6D \xB7 \uBC29 ${snapshot.code} \xB7 \uB098\uB294 ${SEAT_NAMES[humanSeat]}. \uD328\uB97C \uC120\uD0DD\uD55C \uB4A4 \uB2E4\uC2DC \uB204\uB974\uAC70\uB098 \uBC84\uB9AC\uAE30\uB85C \uD655\uC815\uD558\uC138\uC694.`;
    render();
  }
  renderLogs();
}
async function connectRoom(join) {
  showOnline();
  $("room-error").textContent = "";
  for (const id of ["create-room", "join-room"]) $(id).disabled = true;
  try {
    return await roomClient.connect($("room-name").value, join ? $("room-code-input").value.trim().toUpperCase() : void 0);
  } finally {
    for (const id of ["create-room", "join-room"]) $(id).disabled = false;
  }
}
function roomError(error) {
  $("room-error").textContent = error.message;
}
$("practice-mode").onclick = randomGame;
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
  $("download-current-log").disabled = online && !remote?.state;
  const selected = $("saved-logs").value, logs = journal.list();
  $("saved-logs").replaceChildren();
  for (const log of logs) {
    const option = node("option", `${log.id === journal.current?.id ? "\uD604\uC7AC \xB7 " : ""}${new Date(log.startedAt).toLocaleString("ko-KR")} \xB7 ${log.mode === "practice" ? "\uC5F0\uC2B5 " + log.seed : "4\uC778"} \xB7 ${SEAT_NAMES[log.seat]} \xB7 ${signedPoints(log.score)}\uC810${log.issues ? " \xB7 \uC815\uC0B0 \uD655\uC778 \uD544\uC694" : ""}`);
    option.value = log.id;
    $("saved-logs").append(option);
  }
  if (logs.some((log) => log.id === selected)) $("saved-logs").value = selected;
  $("log-save-status").textContent = journal.persisted ? "\uC790\uB3D9 \uC800\uC7A5\uB428 \xB7 \uCD5C\uADFC \uCD5C\uB300 10\uAD6D \xB7 \uC774 \uAE30\uAE30\uC5D0 \uBCF4\uAD00" : "\uAE30\uAE30 \uC800\uC7A5 \uBD88\uAC00 \xB7 \uC9C0\uAE08 \uD30C\uC77C\uB85C \uC800\uC7A5\uD574 \uC8FC\uC138\uC694.";
  const issue = journal.current?.actions.flatMap((entry) => entry.issues).at(-1);
  $("log-warning").hidden = !issue;
  $("log-warning").textContent = issue ? `\uC815\uC0B0 \uD655\uC778 \uD544\uC694: ${issue} \uB300\uAD6D \uB85C\uADF8\uB97C \uC800\uC7A5\uD574 \uC8FC\uC138\uC694.` : "";
}
function downloadLog(id, format = "json") {
  const log = journal.read(id);
  if (!log) throw new Error("\uC800\uC7A5\uB41C \uB300\uAD6D\uC744 \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const text = format === "txt" ? logText(log) : JSON.stringify(log, null, 2), a = node("a"), blob = new Blob([text], { type: format === "txt" ? "text/plain;charset=utf-8" : "application/json" });
  a.href = URL.createObjectURL(blob);
  const filename = `H-${log.game.seed ?? log.room}-${log.id.slice(0, 8)}-\uB300\uAD6D\uB85C\uADF8.${format}`;
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
  return start(crypto.getRandomValues(new Uint32Array(1))[0]);
}
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
$("download-current-log").onclick = () => download();
$("download-json-log").onclick = () => downloadLog($("saved-logs").value);
$("download-text-log").onclick = () => downloadLog($("saved-logs").value, "txt");
randomGame();
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
    for (const value of [`${r.policy} \xB7 ${POLICIES[r.policy].name}`, r.meanNet.toFixed(2) + "\uC810", `${r.ci95Low.toFixed(2)} ~ ${r.ci95High.toFixed(2)}`, (r.winRate * 100).toFixed(1) + "%"]) tr.append(node("td", value));
    $("summary").append(tr);
  }
}).catch(() => {
  $("conclusion").textContent = "\uC644\uB8CC\uB41C \uACB0\uACFC \uD30C\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. headless \uC2E4\uD5D8 \uD6C4 \uBCF4\uACE0\uC11C\uB97C \uC0DD\uC131\uD558\uBA74 \uC5EC\uAE30\uC5D0 \uD45C\uC2DC\uB429\uB2C8\uB2E4.";
});
function readGame() {
  if (online && !remote?.state) return { mode: "online", phase: "waiting", room: remote ? { code: remote.code, members: remote.members } : null, legalActions: [], recommendations: [] };
  return { mode: online ? "online" : "practice", room: online && remote ? { code: remote.code, members: remote.members, gameNumber: remote.gameNumber } : null, seat: humanSeat, phase: online && !remote?.state ? "waiting" : state.phase, turn: actor2(state), ownHand: state.players[humanSeat].hand.map(typeOf), drawnTile: handDisplay(state, humanSeat).drawn === null ? null : typeOf(handDisplay(state, humanSeat).drawn), scores: state.players.map((p) => p.score), winners: [...state.winners], legalActions: actor2(state) === humanSeat ? legalActions2(state) : [], recommendationRevision, recommendations: structuredClone(currentRecommendations) };
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
    { name: "start_h_game", title: "H\uB8F0 \uC0C8 \uAD6D", description: "\uC9C0\uC815\uD55C \uBC30\uD328 \uBC88\uD638\uB85C \uC0C8 \uAD6D\uC744 \uC2DC\uC791\uD569\uB2C8\uB2E4. \uAC19\uC740 \uBC88\uD638\uB294 \uB0B4 \uC790\uB9AC\uB3C4 \uB3D9\uC77C\uD558\uAC8C \uC7AC\uD604\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { seed: { type: "integer", minimum: 0, maximum: 4294967295 } }, required: ["seed"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ seed }) => start(seed) },
    { name: "read_h_game", title: "H\uB8F0 \uACF5\uAC1C \uC0C1\uD0DC", description: "\uB0B4 \uC790\uB9AC\xB7\uC190\uD328, \uACF5\uAC1C \uB300\uAD6D \uC0C1\uD0DC, \uD569\uBC95 \uD589\uB3D9\uACFC \uD654\uBA74\uC758 \uC804\uB7B5\uBCC4 \uCD94\uCC9C\uC744 \uD655\uC778\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: readGame },
    { name: "save_h_game_log", title: "\uD604\uC7AC \uB300\uAD6D \uB85C\uADF8 \uC800\uC7A5", description: "\uD604\uC7AC \uB300\uAD6D\uC758 \uD589\uB3D9\xB7\uC810\uC218 \uC774\uB3D9\xB7\uD654\uB8CC \uACC4\uC0B0\uACFC \uD328\uBCF4\uB97C JSON \uB610\uB294 \uC77D\uAE30 \uC26C\uC6B4 TXT \uD30C\uC77C\uB85C \uB0B4\uB824\uBC1B\uC2B5\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { format: { type: "string", enum: ["json", "txt"] } }, required: ["format"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ format }) => saveCurrentLog(format) },
    { name: "play_h_recommendation", title: "\uC804\uB7B5 \uCD94\uCC9C \uD55C \uBC88 \uC2E4\uD589", description: "\uB0B4 \uC218\uB3D9 \uC120\uD0DD \uCC28\uB840\uC5D0 \uD654\uBA74\uC758 \uC804\uB7B5 \uCD94\uCC9C \uBC84\uD2BC\uC744 \uD55C \uBC88 \uC2E4\uD589\uD569\uB2C8\uB2E4. read_h_game\uC5D0\uC11C \uBC1B\uC740 \uCD5C\uC2E0 recommendationRevision\uC744 revision\uC73C\uB85C \uC804\uB2EC\uD558\uC138\uC694. mode=discard\uB294 \uAE61 \uB300\uC2E0 \uD45C\uC2DC\uB41C \uBC84\uB9BC\uD328 \uB300\uC548\uC744 \uC120\uD0DD\uD569\uB2C8\uB2E4.", inputSchema: { type: "object", properties: { policy: { type: "string", enum: ["A", "B", "C", "D", "E"] }, mode: { type: "string", enum: ["recommended", "discard"] }, revision: { type: "integer", minimum: 0 } }, required: ["policy", "mode", "revision"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: ({ policy, mode, revision }) => executeRecommendation(policy, mode, revision) }
  ]) Promise.resolve(document.modelContext.registerTool(tool, { signal: life.signal })).catch(() => {
  });
}
