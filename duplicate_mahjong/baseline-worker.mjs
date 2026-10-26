var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// duplicate/engine/game.mjs
var game_exports = {};
__export(game_exports, {
  RED_IDS: () => RED_IDS,
  actor: () => actor,
  assertInvariants: () => assertInvariants,
  createGame: () => createGame,
  exhaustedSeats: () => exhaustedSeats,
  indicators: () => indicators,
  legalActions: () => legalActions,
  observation: () => observation,
  publicEvents: () => publicEvents,
  revealedUraIndicators: () => revealedUraIndicators,
  settleDraw: () => settleDraw,
  snapshot: () => snapshot,
  step: () => step,
  visibleCounts: () => visibleCounts
});

// duplicate/shared/tiles.mjs
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

// duplicate/shared/base-score.mjs
var DEFAULT_RULES = { sevenPairsQuadAsTwo: false };
function decompositions(tiles, melds = [], r = DEFAULT_RULES) {
  const c = counts(tiles), out = [];
  if (c.some((x) => x > 4) || tiles.length !== 14 - 3 * melds.length) return out;
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

// duplicate/engine/rules.mjs
var DEFAULT_RULES2 = Object.freeze({
  id: "duplicate-riichi-v1",
  variant: "D",
  dora: true,
  kanDora: true,
  uraDora: true,
  redDora: true,
  deadWall: true,
  exhaustLimit: 1,
  kuitan: true,
  multipleRon: "all",
  startingPoints: 25e3,
  maxKans: 4,
  roundWind: 27,
  abortFourKans: true
});
function normalizeRules(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("Invalid rules");
  for (const name of Object.keys(options)) if (!(name in DEFAULT_RULES2)) throw new Error(`Unknown rule: ${name}`);
  const rules = { ...DEFAULT_RULES2, ...options };
  for (const name of ["dora", "kanDora", "uraDora", "redDora", "deadWall", "kuitan", "abortFourKans"]) {
    if (typeof rules[name] !== "boolean") throw new Error(`Invalid rule: ${name}`);
  }
  if (rules.id !== DEFAULT_RULES2.id || rules.variant !== "D" || !Number.isInteger(rules.exhaustLimit) || rules.exhaustLimit < 1 || rules.exhaustLimit > 4 || !["all", "nearest"].includes(rules.multipleRon) || rules.maxKans !== 4 || ![27, 28, 29, 30].includes(rules.roundWind) || !Number.isSafeInteger(rules.startingPoints) || rules.startingPoints < 1e3 || rules.startingPoints % 100) {
    throw new Error("Unsupported rule configuration");
  }
  return rules;
}
var reservedTileCount = (rules) => rules.deadWall ? 14 : rules.dora || rules.kanDora || rules.uraDora ? rules.kanDora ? 10 : 2 : 0;

// duplicate/engine/score.mjs
var ORPHANS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
var GREEN = /* @__PURE__ */ new Set([19, 20, 21, 23, 25, 32]);
var round100 = (n) => Math.ceil(n / 100) * 100;
function doraAfter(tile) {
  if (!Number.isInteger(tile) || tile < 0 || tile > 33) throw new Error("Invalid dora indicator");
  if (tile < 27) return Math.floor(tile / 9) * 9 + (tile % 9 + 1) % 9;
  if (tile < 31) return 27 + (tile - 27 + 1) % 4;
  return 31 + (tile - 31 + 1) % 3;
}
function physicalTiles(types, melds) {
  if (!Array.isArray(types) || !Array.isArray(melds) || melds.length > 4) return null;
  const all = [...types];
  for (const meld of melds) {
    if (!meld || !["chi", "pon", "kan"].includes(meld.type) || !Number.isInteger(meld.tile) || meld.tile < 0 || meld.tile > 33) return null;
    if (meld.type === "chi") {
      if (meld.tile >= 27 || meld.tile % 9 > 6) return null;
      all.push(meld.tile, meld.tile + 1, meld.tile + 2);
    } else all.push(...Array(meld.type === "kan" ? 4 : 3).fill(meld.tile));
  }
  try {
    if (counts(all).some((n) => n > 4)) return null;
  } catch {
    return null;
  }
  return all;
}
function shapes(types, melds) {
  if (types.length !== 14 - 3 * melds.length) return [];
  const out = decompositions(types, melds, { sevenPairsQuadAsTwo: false });
  if (!melds.length) {
    const c = counts(types);
    if (ORPHANS.every((t) => c[t] >= 1) && ORPHANS.some((t) => c[t] === 2)) {
      out.push({ kind: "orphans", groups: [], pair: ORPHANS.find((t) => c[t] === 2) });
    }
  }
  return out;
}
function shapeWaits(types, melds = [], rules = {}) {
  const all = physicalTiles(types, melds);
  if (!all || types.length !== 13 - 3 * melds.length) return [];
  const c = counts(all), waits = [];
  for (let t = 0; t < 34; t++) {
    if (c[t] < 4 && shapes([...types, t], melds).length) waits.push(t);
  }
  return waits;
}
function placements(shape, winTile) {
  if (shape.kind !== "standard") return [{ kind: shape.kind, wait: "tanki", index: -1 }];
  const out = [];
  if (shape.pair === winTile) out.push({ kind: "pair", wait: "tanki", index: -1 });
  shape.groups.forEach((g, index) => {
    if (g.type === "pon" && g.tile === winTile) out.push({ kind: "pon", wait: "shanpon", index });
    if (g.type !== "chi" || winTile < g.tile || winTile > g.tile + 2) return;
    const wait = winTile === g.tile + 1 ? "kanchan" : g.tile % 9 === 0 && winTile === g.tile + 2 || g.tile % 9 === 6 && winTile === g.tile ? "penchan" : "ryanmen";
    out.push({ kind: "chi", wait, index });
  });
  return out;
}
function payments(han, fu, dealer, yakumanCount) {
  const base = yakumanCount ? 8e3 * yakumanCount : han >= 13 ? 8e3 : han >= 11 ? 6e3 : han >= 8 ? 4e3 : han >= 6 ? 3e3 : han >= 5 ? 2e3 : Math.min(2e3, fu * 2 ** (han + 2));
  return {
    ron: round100(base * (dealer ? 6 : 4)),
    tsumoDealer: round100(base * 2),
    tsumoOther: round100(base * (dealer ? 2 : 1))
  };
}
function handFu(shape, groups, placement, closed, method, pairFu, pinfu) {
  if (shape.kind === "sevenPairs") return 25;
  if (shape.kind === "orphans") return 0;
  if (pinfu && method === "tsumo") return 20;
  let fu = 20 + (closed && method === "ron" ? 10 : 0) + (method === "tsumo" ? 2 : 0) + pairFu;
  if (["tanki", "kanchan", "penchan"].includes(placement.wait)) fu += 2;
  groups.forEach((g, index) => {
    if (g.type === "chi") return;
    const openedByRon = method === "ron" && placement.kind === "pon" && index === placement.index;
    fu += (g.open || openedByRon ? 2 : 4) * (isYao(g.tile) ? 2 : 1) * (g.type === "kan" ? 4 : 1);
  });
  return fu === 20 ? 30 : Math.ceil(fu / 10) * 10;
}
function scoreRiichi(types, melds = [], context3 = {}, rules = {}) {
  const all = physicalTiles(types, melds);
  if (!all) return null;
  const ds = shapes(types, melds);
  if (!ds.length) return null;
  const winTile = context3.winTile ?? types.at(-1);
  if (!types.includes(winTile)) return null;
  const method = context3.method ?? "ron";
  if (!["ron", "tsumo"].includes(method)) return null;
  const c = counts(all), closed = melds.every((m) => !m.open);
  const suits = new Set(all.filter((t) => t < 27).map((t) => Math.floor(t / 9))), honors = all.some(isHonor);
  const seatWind = context3.seatWind ?? 27, roundWind = rules.roundWind ?? 27;
  const riichi = closed && !!(context3.riichi || context3.doubleRiichi);
  const dealer = context3.dealer ?? seatWind === 27;
  let best = null;
  for (const shape of ds) for (const placement of placements(shape, winTile)) {
    const groups = [...shape.groups, ...melds], seq = groups.filter((g) => g.type === "chi"), trip = groups.filter((g) => g.type !== "chi");
    const tripTiles = trip.map((g) => g.tile), entries = [], limits = [];
    const add = (id, name, han2, condition) => {
      if (condition) entries.push({ id, name, han: han2 });
    };
    const limit = (id, name, condition) => {
      if (condition) limits.push({ id, name, han: 0, yakuman: 1 });
    };
    const pairFu = shape.kind === "standard" ? (shape.pair >= 31 ? 2 : 0) + (shape.pair === seatWind ? 2 : 0) + (shape.pair === roundWind ? 2 : 0) : 0;
    const pinfu = shape.kind === "standard" && closed && seq.length === 4 && !pairFu && placement.wait === "ryanmen";
    const concealed = groups.reduce((n, g, index) => n + (g.type !== "chi" && !g.open && !(method === "ron" && placement.kind === "pon" && placement.index === index) ? 1 : 0), 0);
    const dragonCount = tripTiles.filter((t) => t >= 31).length, windCount = tripTiles.filter((t) => t >= 27 && t < 31).length;
    limit("orphans", "\uAD6D\uC0AC\uBB34\uC30D", shape.kind === "orphans");
    limit("fourConcealed", "\uC0AC\uC554\uAC01", concealed === 4);
    limit("fourKans", "\uC0AC\uAE61\uC790", melds.filter((m) => m.type === "kan").length === 4);
    limit("bigThreeDragons", "\uB300\uC0BC\uC6D0", dragonCount === 3);
    limit("bigFourWinds", "\uB300\uC0AC\uD76C", windCount === 4);
    limit("smallFourWinds", "\uC18C\uC0AC\uD76C", windCount === 3 && shape.pair >= 27 && shape.pair < 31);
    limit("allHonors", "\uC790\uC77C\uC0C9", all.every(isHonor));
    limit("allTerminals", "\uCCAD\uB178\uB450", all.every(isTerminal));
    limit("allGreen", "\uB179\uC77C\uC0C9", all.every((t) => GREEN.has(t)));
    if (closed && !melds.length && suits.size === 1 && !honors) {
      const offset = [...suits][0] * 9;
      limit("nineGates", "\uAD6C\uB828\uBCF4\uB4F1", c[offset] >= 3 && c[offset + 8] >= 3 && Array.from({ length: 7 }, (_, n) => offset + n + 1).every((t) => c[t] >= 1));
    }
    limit("tenhou", "\uCC9C\uD654", context3.tenhou && dealer && method === "tsumo" && !melds.length);
    limit("chiihou", "\uC9C0\uD654", context3.chiihou && !dealer && method === "tsumo" && !melds.length);
    add("doubleRiichi", "\uB354\uBE14 \uB9AC\uCE58", 2, riichi && context3.doubleRiichi);
    add("riichi", "\uB9AC\uCE58", 1, riichi && !context3.doubleRiichi);
    add("ippatsu", "\uC77C\uBC1C", 1, riichi && context3.ippatsu && !context3.rinshan);
    add("menzenTsumo", "\uBA58\uC820 \uCBD4\uBAA8", 1, closed && method === "tsumo");
    add("tanyao", "\uD0D5\uC57C\uC624", 1, (closed || rules.kuitan !== false) && all.every((t) => !isYao(t)));
    add("pinfu", "\uD551\uD6C4", 1, pinfu);
    add("sevenPairs", "\uCE60\uB300\uC790", 2, shape.kind === "sevenPairs");
    add("rinshan", "\uC601\uC0C1\uAC1C\uD654", 1, context3.rinshan && method === "tsumo");
    add("haitei", "\uD574\uC800\uB85C\uC6D4", 1, context3.lastTile && method === "tsumo" && !context3.rinshan);
    add("houtei", "\uD558\uC800\uB85C\uC5B4", 1, context3.lastTile && method === "ron" && !context3.chankan);
    add("chankan", "\uCC3D\uAE61", 1, context3.chankan && method === "ron");
    add("honroutou", "\uD63C\uB178\uB450", 2, all.every(isYao));
    add("honitsu", "\uD63C\uC77C\uC0C9", closed ? 3 : 2, suits.size === 1 && honors);
    add("chinitsu", "\uCCAD\uC77C\uC0C9", closed ? 6 : 5, suits.size === 1 && !honors);
    if (shape.kind === "standard") {
      const freq = /* @__PURE__ */ new Map();
      for (const g of seq) freq.set(g.tile, (freq.get(g.tile) ?? 0) + 1);
      const identical = [...freq.values()].reduce((n, count) => n + Math.floor(count / 2), 0);
      add("ryanpeikou", "\uB7C9\uD398\uCF54", 3, closed && identical >= 2);
      add("iipeikou", "\uC774\uD398\uCF54", 1, closed && identical === 1);
      add("toitoi", "\uB610\uC774\uB610\uC774", 2, trip.length === 4);
      add("sanankou", "\uC0BC\uC554\uAC01", 2, concealed >= 3);
      add("threeKans", "\uC0BC\uAE61\uC790", 2, melds.filter((m) => m.type === "kan").length === 3);
      add("smallThreeDragons", "\uC18C\uC0BC\uC6D0", 2, dragonCount === 2 && shape.pair >= 31);
      add(
        "sanshokuTriplets",
        "\uC0BC\uC0C9\uB3D9\uAC01",
        2,
        Array.from({ length: 9 }, (_, n) => n).some((n) => [n, n + 9, n + 18].every((t) => tripTiles.includes(t)))
      );
      const reduction = closed ? 0 : 1;
      add(
        "sanshokuSequences",
        "\uC0BC\uC0C9\uB3D9\uC21C",
        2 - reduction,
        Array.from({ length: 7 }, (_, n) => n).some((n) => [n, n + 9, n + 18].every((t) => seq.some((g) => g.tile === t)))
      );
      add(
        "ittsu",
        "\uC77C\uAE30\uD1B5\uAD00",
        2 - reduction,
        [0, 9, 18].some((n) => [n, n + 3, n + 6].every((t) => seq.some((g) => g.tile === t)))
      );
      const outside = groups.every((g) => g.type === "chi" ? [0, 6].includes(g.tile % 9) : isYao(g.tile)) && isYao(shape.pair);
      add("chanta", "\uCC2C\uD0C0", 2 - reduction, outside && honors && seq.length > 0);
      add("junchan", "\uC900\uCC2C\uD0C0", 3 - reduction, outside && !honors && seq.length > 0);
      for (const t of tripTiles) {
        add(`dragon${t}`, ["\uBC31", "\uBC1C", "\uC911"][t - 31], 1, t >= 31);
        add("roundWind", "\uC7A5\uD48D", 1, t === roundWind);
        add("seatWind", "\uC790\uD48D", 1, t === seatWind);
      }
    }
    if (!entries.length && !limits.length) continue;
    const bonuses = [];
    const bonus = (id, name, han2) => {
      if (han2) bonuses.push({ id, name, han: han2 });
    };
    const indicatorHan = (indicators3) => indicators3.reduce((n, t) => n + c[doraAfter(t)], 0);
    const visible = context3.doraIndicators ?? [], ura = context3.uraIndicators ?? [];
    const enabledIndicators = (indicators3) => context3.indicatorsFiltered ? indicators3 : indicators3.filter((_, i) => i === 0 ? rules.dora !== false : rules.kanDora !== false);
    bonus("dora", "\uB3C4\uB77C", indicatorHan(enabledIndicators(visible)));
    const enabledUra = context3.indicatorsFiltered ? ura : ura.filter((_, i) => i === 0 || rules.kanDora !== false);
    bonus("uraDora", "\uC6B0\uB77C\uB3C4\uB77C", riichi && rules.uraDora !== false ? indicatorHan(enabledUra) : 0);
    bonus("redDora", "\uC801\uB3C4\uB77C", rules.redDora !== false ? Math.max(0, Math.floor(context3.redCount ?? 0)) : 0);
    const yakumanCount = limits.length, yakuman = yakumanCount > 0;
    const hanYaku = yakuman ? 0 : entries.reduce((n, e) => n + e.han, 0);
    const bonusHan = yakuman ? 0 : bonuses.reduce((n, e) => n + e.han, 0);
    const han = hanYaku + bonusHan, fu = yakuman ? 0 : handFu(shape, groups, placement, closed, method, pairFu, pinfu);
    const points = payments(han, fu, !!dealer, yakumanCount), yakuEntries = yakuman ? limits : entries;
    const score = {
      variant: "riichi",
      name: yakuEntries.map((e) => e.name).join(" \xB7 "),
      yaku: yakuEntries[0].id,
      yakuEntries,
      eligibleYaku: yakuEntries.map((e) => e.id),
      bonuses: yakuman ? [] : bonuses,
      han,
      fu,
      hanYaku,
      bonusHan,
      yakuman,
      yakumanCount,
      base: points.ron,
      bonus: 0,
      total: points.ron,
      points,
      closed,
      shape: { ...shape, wait: placement.wait, winningPlacement: placement }
    };
    const receipt = (s) => method === "ron" ? s.points.ron : dealer ? s.points.tsumoOther * 3 : s.points.tsumoDealer + s.points.tsumoOther * 2;
    if (!best || receipt(score) > receipt(best) || receipt(score) === receipt(best) && (score.han > best.han || score.han === best.han && score.fu > best.fu)) best = score;
  }
  return best;
}

// duplicate/engine/game.mjs
var RED_IDS = /* @__PURE__ */ new Set([16, 52, 88]);
var red = (id, rules) => rules.redDora && RED_IDS.has(id);
var handTypes = (p) => p.hand.map(typeOf);
var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
var event = (s, e) => s.events.push({ n: s.events.length, ...e });
var remaining = (s) => s.walls.reduce((n, w) => n + w.length, 0);
var actor = (s) => s.phase === "turn" ? s.turn : s.phase === "reaction" ? s.reaction.pending[0] : null;
var exhaustedSeats = (s) => s.walls.flatMap((w, seat) => w.length ? [] : [seat]);
var threshold = (s) => exhaustedSeats(s).length >= s.rules.exhaustLimit;
function indicators(s, ura = false) {
  if (ura && !s.rules.uraDora) return [];
  const offset = s.rules.deadWall ? 4 : 0;
  const indices = [];
  if (ura || s.rules.dora) indices.push(0);
  if (s.rules.kanDora) for (let i = 1; i <= s.kans; i++) indices.push(i);
  return indices.map((i) => typeOf(s.dead[offset + 2 * i + (ura ? 1 : 0)]));
}
var revealedUraIndicators = (s) => s.end === "win" && s.winners.some((seat) => s.players[seat].riichi) ? indicators(s, true) : [];
function context(s, seat, method, id) {
  const p = s.players[seat], ids = [...p.hand, ...p.melds.flatMap((m) => m.ids)];
  if (method === "ron") ids.push(id);
  return {
    method,
    winTile: typeOf(id),
    seatWind: 27 + (seat - s.dealer + 4) % 4,
    dealer: seat === s.dealer,
    riichi: p.riichi,
    doubleRiichi: p.doubleRiichi,
    ippatsu: p.ippatsu,
    rinshan: p.drawSource === "kan" && method === "tsumo",
    tenhou: method === "tsumo" && seat === s.dealer && s.draws === 1 && s.calls === 0,
    chiihou: method === "tsumo" && seat !== s.dealer && p.river.length === 0 && s.calls === 0 && p.drawSource === "wall",
    lastTile: method === "ron" ? !!s.reaction?.final : threshold(s),
    chankan: method === "ron" && s.reaction?.kind === "kakan",
    doraIndicators: indicators(s),
    uraIndicators: indicators(s, true),
    indicatorsFiltered: true,
    redCount: ids.filter((id2) => red(id2, s.rules)).length
  };
}
function createGame({ seed = 1, rules = {}, dealer = 0, wall = null, pot = 0, startingScores = null } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295 || !Number.isInteger(dealer) || dealer < 0 || dealer > 3 || !Number.isSafeInteger(pot) || pot < 0 || pot % 1e3) throw new Error("Invalid seed, dealer or pot");
  if (startingScores !== null && (!Array.isArray(startingScores) || startingScores.length !== 4 || startingScores.some((n) => !Number.isSafeInteger(n)))) throw new Error("Invalid starting scores");
  const r = normalizeRules(rules), w = wall ? [...wall] : shuffledWall(seed);
  if (w.length !== 136 || new Set(w).size !== 136 || w.some((id) => !Number.isInteger(id) || id < 0 || id >= 136)) throw new Error("Invalid wall");
  const reserve = reservedTileCount(r), dead = reserve ? w.splice(136 - reserve) : [];
  const s = {
    version: 1,
    seed,
    rules: r,
    dealer,
    dead,
    walls: Array.from({ length: 4 }, () => []),
    startingScores: startingScores ? [...startingScores] : Array(4).fill(r.startingPoints),
    pot,
    initialPot: pot,
    players: Array.from({ length: 4 }, () => ({
      hand: [],
      melds: [],
      river: [],
      score: 0,
      won: false,
      win: null,
      drawn: null,
      drawSource: null,
      passLock: false,
      forbidden: [],
      riichi: false,
      riichiFuriten: false,
      riichiWaits: [],
      doubleRiichi: false,
      ippatsu: false,
      pao: null,
      stats: { winReceipt: 0, dealInLoss: 0, tsumoPaid: 0, drawLoss: 0, drawGain: 0, riichiPaid: 0, ronDeclined: 0, closedKans: 0 }
    })),
    phase: "init",
    turn: dealer,
    draws: 0,
    kans: 0,
    calls: 0,
    winners: [],
    reaction: null,
    events: [],
    ledger: [],
    end: null,
    pendingAbort: null
  };
  for (let n = 0; n < 13; n++) for (let seat = 0; seat < 4; seat++) s.players[seat].hand.push(w.shift());
  s.initialHands = s.players.map((p) => [...p.hand]);
  for (let i = 0; i < w.length; i++) s.walls[i % 4].push(w[i]);
  for (const p of s.players) p.hand.sort((a, b) => a - b);
  draw(s, dealer);
  assertInvariants(s);
  return s;
}
function transfer(s, from, to, amount, kind) {
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
function draw(s, seat, kan = false) {
  if (!s.walls[seat].length) throw new Error("Cannot draw from exhausted personal wall");
  const p = s.players[seat], id = s.walls[seat].shift();
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
  event(s, { type: kan ? "kanDraw" : "draw", seat, id });
}
function nextDraw(s, source) {
  if (threshold(s)) {
    settleDraw(s);
    return;
  }
  for (let off = 1; off <= 4; off++) {
    const seat = (source + off) % 4;
    if (s.walls[seat].length) {
      draw(s, seat);
      return;
    }
  }
  settleDraw(s);
}
function end(s, reason) {
  s.end = reason;
  s.phase = "end";
  s.reaction = null;
  event(s, { type: "end", reason });
}
function win(s, seat, method, source, id, { finish = true } = {}) {
  const p = s.players[seat], tiles = handTypes(p);
  if (method === "ron") tiles.push(typeOf(id));
  const score = scoreRiichi(tiles, p.melds, context(s, seat, method, id), s.rules);
  if (!score) throw new Error("Illegal riichi win");
  const first = s.ledger.length;
  const pao = p.pao && score.yakuman && score.yakuEntries.some((y) => y.id === p.pao.yaku) ? p.pao : null;
  if (pao) {
    const count = score.yakumanCount ?? 1, portion = score.points.ron / count;
    if (method === "tsumo") {
      transfer(s, pao.seat, seat, portion, method);
      if (count > 1) {
        for (let from = 0; from < 4; from++) if (from !== seat) {
          const amount = (from === s.dealer ? score.points.tsumoDealer : score.points.tsumoOther) * (count - 1) / count;
          transfer(s, from, seat, amount, method);
        }
      }
    } else if (source === pao.seat) transfer(s, source, seat, score.points.ron, method);
    else {
      transfer(s, pao.seat, seat, portion / 2, method);
      transfer(s, source, seat, score.points.ron - portion / 2, method);
    }
  } else if (method === "ron") transfer(s, source, seat, score.points.ron, method);
  else for (let from = 0; from < 4; from++) if (from !== seat) transfer(s, from, seat, from === s.dealer ? score.points.tsumoDealer : score.points.tsumoOther, method);
  if (s.pot) transfer(s, "pot", seat, s.pot, "pot");
  const payments2 = structuredClone(s.ledger.slice(first));
  p.won = true;
  p.win = {
    method,
    source,
    tile: id,
    order: s.winners.length + 1,
    drawNumber: s.draws,
    score,
    payments: payments2,
    receipt: payments2.reduce((n, e) => n + e.amount, 0),
    ...pao ? { pao } : {}
  };
  p.drawn = null;
  s.winners.push(seat);
  event(s, { type: "win", seat, ...p.win });
  if (finish) end(s, "win");
}
function visibleCounts(s, seat) {
  const out = Array(34).fill(0), add = (id) => out[typeOf(id)]++;
  for (let i = 0; i < 4; i++) {
    const p = s.players[i];
    for (const m of p.melds) for (const id of m.ids) add(id);
    for (const d of p.river) if (!d.claimed) add(d.id);
    if (i === seat || s.phase === "end" && p.won) for (const id of p.hand) add(id);
  }
  for (const t of indicators(s)) out[t]++;
  return out;
}
function settleDraw(s) {
  if (s.phase === "end" || !threshold(s)) throw new Error("Cannot settle this board");
  const ready = s.players.flatMap((p, seat) => {
    const waits = shapeWaits(handTypes(p), p.melds, s.rules);
    return waits.length ? [{ seat, waits }] : [];
  });
  if (ready.length && ready.length < 4) {
    const due = ready.map((p) => ({ seat: p.seat, amount: 3e3 / ready.length }));
    for (let from = 0; from < 4; from++) if (!ready.some((p) => p.seat === from)) {
      let debt = 3e3 / (4 - ready.length);
      for (const to of due) {
        const amount = Math.min(debt, to.amount);
        if (amount) {
          transfer(s, from, to.seat, amount, "draw");
          debt -= amount;
          to.amount -= amount;
        }
      }
    }
  }
  event(s, { type: "drawSettlement", ready, exhaustedSeats: exhaustedSeats(s) });
  end(s, "exhaustive-draw");
}
function canRon(s, seat) {
  const p = s.players[seat], r = s.reaction;
  if (!r || seat === r.source || p.passLock || p.riichiFuriten) return null;
  const waits = shapeWaits(handTypes(p), p.melds, s.rules);
  if (p.river.some((d) => waits.includes(typeOf(d.id)))) return null;
  return scoreRiichi([...handTypes(p), typeOf(r.id)], p.melds, context(s, seat, "ron", r.id), s.rules);
}
function riichiAnkanAllowed(p, t, rules) {
  if (typeOf(p.drawn) !== t) return false;
  const tiles = handTypes(p), next = tiles.filter((x) => x !== t), melds = [...p.melds, { type: "kan", tile: t, open: false }];
  if (!same(shapeWaits(next, melds, rules), p.riichiWaits)) return false;
  const before = [...tiles];
  before.splice(before.indexOf(t), 1);
  return p.riichiWaits.every((wait) => {
    const shapes2 = decompositions([...before, wait], p.melds, { sevenPairsQuadAsTwo: false });
    return shapes2.length && shapes2.every((shape) => shape.kind === "standard" && shape.groups.some((g) => g.type === "pon" && g.tile === t) && !shape.groups.some((g) => g.type === "chi" && g.tile <= t && t <= g.tile + 2));
  });
}
function forbiddenForCall(a, t) {
  const out = [t];
  if (a.type === "chi") {
    if (t === a.tile && t % 9 <= 5) out.push(t + 3);
    if (t === a.tile + 2 && t % 9 >= 3) out.push(t - 3);
  }
  return out;
}
function legalActions(s, seat = actor(s)) {
  if (seat === null || seat !== actor(s)) return [];
  const p = s.players[seat], tiles = handTypes(p), c = counts(tiles), out = [];
  if (s.phase === "turn") {
    if (p.drawn !== null && scoreRiichi(tiles, p.melds, context(s, seat, "tsumo", p.drawn), s.rules)) out.push({ type: "tsumo" });
    if (p.drawn !== null && s.walls[seat].length && s.kans < s.rules.maxKans) {
      for (let t = 0; t < 34; t++) if (c[t] === 4 && (!p.riichi || riichiAnkanAllowed(p, t, s.rules))) out.push({ type: "ankan", tile: t });
      if (!p.riichi) p.melds.forEach((m, i) => {
        if (m.type === "pon" && c[m.tile]) out.push({ type: "kakan", meld: i });
      });
    }
    for (const id of p.hand) if (!p.forbidden.includes(typeOf(id)) && (!p.riichi || id === p.drawn)) {
      const tile = typeOf(id);
      out.push({ type: "discard", tile, id });
      if (!p.riichi && p.melds.every((m) => !m.open) && s.startingScores[seat] + p.score >= 1e3 && remaining(s) >= 4 && s.walls[seat].length && !threshold(s)) {
        const next = [...tiles];
        next.splice(next.indexOf(tile), 1);
        if (shapeWaits(next, p.melds, s.rules).length) out.push({ type: "riichi", tile, id });
      }
    }
  } else {
    const r = s.reaction, t = typeOf(r.id);
    if (canRon(s, seat)) out.push({ type: "ron" });
    out.push({ type: "pass" });
    if (!p.riichi && r.kind === "discard" && !r.final && !s.pendingAbort && s.walls[seat].length) {
      const candidates = [];
      if (c[t] >= 2) candidates.push({ type: "pon", tile: t });
      if (c[t] >= 3 && s.kans < s.rules.maxKans) candidates.push({ type: "minkan", tile: t });
      if (seat === (r.source + 1) % 4 && t < 27) for (let start = Math.max(Math.floor(t / 9) * 9, t - 2); start <= Math.min(Math.floor(t / 9) * 9 + 6, t); start++) {
        if ([start, start + 1, start + 2].filter((x) => x !== t).every((x) => c[x])) candidates.push({ type: "chi", tile: start });
      }
      for (const a of candidates) {
        if (a.type === "minkan") {
          out.push(a);
          continue;
        }
        const cc = [...c];
        for (const x of a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x2) => x2 !== t) : [t, t]) cc[x]--;
        if (cc.some((n, tile) => n && !forbiddenForCall(a, t).includes(tile))) out.push(a);
      }
    }
  }
  return out;
}
function remove(p, types) {
  const ids = [];
  for (const t of types) {
    let i = p.hand.findIndex((id) => typeOf(id) === t && !RED_IDS.has(id));
    if (i < 0) i = p.hand.findIndex((id) => typeOf(id) === t);
    if (i < 0) throw new Error("Missing tile");
    ids.push(...p.hand.splice(i, 1));
  }
  return ids;
}
function reaction(s, source, id, kind, extra = {}) {
  s.phase = "reaction";
  s.reaction = {
    source,
    id,
    kind,
    final: kind === "discard" && threshold(s),
    pending: [1, 2, 3].map((n) => (source + n) % 4),
    answers: [],
    ...extra
  };
}
function cancelIppatsu(s) {
  for (const p of s.players) p.ippatsu = false;
}
function completeKan(s, seat, details = {}) {
  cancelIppatsu(s);
  s.kans++;
  s.calls++;
  event(s, { type: "kan", seat, ...details });
  if (s.rules.abortFourKans && s.kans === 4 && s.players.filter((p) => p.melds.some((m) => m.type === "kan")).length > 1) s.pendingAbort = "four-kans";
  draw(s, seat, true);
}
function acceptRiichi(s, r) {
  if (!r.riichi) return;
  const p = s.players[r.source];
  p.riichi = true;
  p.ippatsu = true;
  p.doubleRiichi = p.river.length === 1 && s.calls === 0;
  p.riichiWaits = shapeWaits(handTypes(p), p.melds, s.rules);
  transfer(s, r.source, "pot", 1e3, "riichi");
  event(s, { type: "riichi", seat: r.source });
}
function resolve(s) {
  const r = s.reaction, rons = r.answers.filter((x) => x.action.type === "ron");
  if (rons.length) {
    if (r.kind === "kakan") {
      const p2 = s.players[r.source];
      p2.hand.splice(p2.hand.indexOf(r.id), 1);
      p2.river.push({ id: r.id, claimed: false, robbedKan: true });
    }
    for (const ron of s.rules.multipleRon === "all" ? rons : rons.slice(0, 1)) win(s, ron.seat, "ron", r.source, r.id, { finish: false });
    end(s, "win");
    return;
  }
  if (r.kind === "kakan") {
    const p2 = s.players[r.source], m = p2.melds[r.meld], added = remove(p2, [m.tile]);
    m.ids.push(...added);
    m.type = "kan";
    completeKan(s, r.source, { callType: "kakan", tileId: added[0], ids: [...m.ids], meld: r.meld });
    return;
  }
  acceptRiichi(s, r);
  if (r.final) {
    settleDraw(s);
    return;
  }
  if (s.pendingAbort) {
    end(s, s.pendingAbort);
    return;
  }
  const calls = r.answers.filter((x) => ["pon", "minkan", "chi"].includes(x.action.type)).sort((a2, b) => (a2.action.type === "chi") - (b.action.type === "chi"));
  if (!calls.length) {
    nextDraw(s, r.source);
    return;
  }
  cancelIppatsu(s);
  s.calls++;
  const { seat, action: a } = calls[0], p = s.players[seat], t = typeOf(r.id);
  const ids = [...remove(p, a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x) => x !== t) : Array(a.type === "minkan" ? 3 : 2).fill(t)), r.id];
  s.players[r.source].river.at(-1).claimed = true;
  p.melds.push({ type: a.type === "chi" ? "chi" : a.type === "minkan" ? "kan" : "pon", tile: a.tile, open: true, from: r.source, ids });
  const open = p.melds.filter((m) => m.open && m.type !== "chi");
  const paoYaku = a.type !== "chi" && (t >= 31 && open.filter((m) => m.tile >= 31).length === 3 ? "bigThreeDragons" : t >= 27 && t < 31 && open.filter((m) => m.tile >= 27 && m.tile < 31).length === 4 ? "bigFourWinds" : null);
  if (paoYaku) p.pao = { seat: r.source, yaku: paoYaku };
  p.drawn = null;
  p.drawSource = null;
  p.forbidden = forbiddenForCall(a, t);
  s.turn = seat;
  s.phase = "turn";
  s.reaction = null;
  event(s, { type: "call", seat, action: a, from: r.source, tileId: r.id, ids: [...ids] });
  if (a.type === "minkan") completeKan(s, seat, { callType: "minkan", tileId: r.id, ids: [...ids], from: r.source });
}
function canonicalAction(s, seat, action) {
  if (!action || typeof action !== "object") return null;
  const legal = legalActions(s, seat);
  if (["discard", "riichi"].includes(action.type)) {
    const matching = legal.filter((a) => a.type === action.type && (action.tile === void 0 || a.tile === action.tile) && (action.id === void 0 || a.id === action.id));
    if (action.tile === void 0 && action.id === void 0) return null;
    return matching.find((a) => !RED_IDS.has(a.id)) ?? matching[0];
  }
  return legal.find((a) => same(a, action));
}
function step(s, seat, action, { validate = true } = {}) {
  const a = canonicalAction(s, seat, action);
  if (!a) throw new Error(`Illegal action by ${seat}`);
  const p = s.players[seat];
  const kakanId = a.type === "kakan" ? p.hand.find((id) => typeOf(id) === p.melds[a.meld].tile && !RED_IDS.has(id)) ?? p.hand.find((id) => typeOf(id) === p.melds[a.meld].tile) : null;
  event(s, { type: "action", seat, action: { ...a }, ...a.type === "kakan" ? { tileId: kakanId, meldIds: [...p.melds[a.meld].ids] } : {} });
  if (s.phase === "reaction") {
    const r = s.reaction;
    if (a.type !== "ron" && canRon(s, seat)) {
      p.passLock = true;
      p.stats.ronDeclined++;
      if (p.riichi) p.riichiFuriten = true;
    }
    r.answers.push({ seat, action: { ...a } });
    r.pending.shift();
    if (!r.pending.length) resolve(s);
  } else if (a.type === "tsumo") win(s, seat, "tsumo", seat, p.drawn);
  else if (a.type === "discard" || a.type === "riichi") {
    p.hand.splice(p.hand.indexOf(a.id), 1);
    if (p.riichi) p.ippatsu = false;
    p.river.push({ id: a.id, claimed: false, riichi: a.type === "riichi" });
    p.drawn = null;
    p.drawSource = null;
    p.forbidden = [];
    reaction(s, seat, a.id, "discard", { riichi: a.type === "riichi" });
  } else if (a.type === "ankan") {
    const ids = remove(p, Array(4).fill(a.tile));
    p.melds.push({ type: "kan", tile: a.tile, open: false, from: seat, ids });
    p.stats.closedKans++;
    completeKan(s, seat, { callType: "ankan", ids: [...ids] });
  } else if (a.type === "kakan") {
    cancelIppatsu(s);
    reaction(s, seat, kakanId, "kakan", { meld: a.meld });
  }
  if (validate) assertInvariants(s);
  return s;
}
var tileView = (id, s, drawn = null) => ({ id, type: typeOf(id), tile: typeOf(id), red: red(id, s.rules), drawn: id === drawn });
var meldView = (m, s) => ({ ...structuredClone(m), tiles: m.ids.map((id) => tileView(id, s)) });
function publicEvents(s) {
  const out = [], discards = Array(4).fill(null), pendingKan = Array(4).fill(null), melds = Array.from({ length: 4 }, () => []);
  const physical2 = (id) => Number.isInteger(id) && id >= 0 && id < 136 ? id : null;
  const preview = (seat, index, tile, callType) => {
    const count = ["ankan", "kakan", "minkan"].includes(callType) ? 4 : 3;
    const ids = s.players[seat]?.melds[index]?.ids?.slice(0, count);
    if (ids?.length === count) return ids.map((id) => ({ type: typeOf(id), red: red(id, s.rules) })).sort((a, b) => a.type - b.type);
    const types = callType === "chi" ? [tile, tile + 1, tile + 2] : Array(count).fill(tile);
    return types.filter((type) => Number.isInteger(type) && type >= 0 && type < 34).map((type) => ({ type, red: false }));
  };
  const emit = (raw, kind, { tile = null, tileId = null, source = null, callType = null, method = null, tiles } = {}) => {
    const id = physical2(tileId), type = id === null ? tile : typeOf(id);
    const item = {
      id: raw.n,
      kind,
      seat: raw.seat,
      tile: Number.isInteger(type) && type >= 0 && type < 34 ? type : null,
      tileId: id,
      red: id !== null && red(id, s.rules),
      source: Number.isInteger(source) && source >= 0 && source < 4 ? source : null,
      callType,
      method: ["ron", "tsumo"].includes(method) ? method : null
    };
    if (tiles?.length) item.tiles = tiles;
    out.push(item);
    return item;
  };
  for (const raw of s.events ?? []) {
    if (!Number.isSafeInteger(raw.n) || raw.n < 0 || !Number.isInteger(raw.seat) || raw.seat < 0 || raw.seat > 3) continue;
    const seat = raw.seat, a = raw.action;
    if (raw.type === "action") {
      if (a?.type === "discard" || a?.type === "riichi") discards[seat] = emit(raw, "discard", { tile: a.tile, tileId: a.id });
      else if (a?.type === "ankan") pendingKan[seat] = { tile: a.tile, callType: "ankan", index: melds[seat].length };
      else if (a?.type === "kakan") pendingKan[seat] = { tile: melds[seat][a.meld]?.tile ?? null, callType: "kakan", index: a.meld };
    } else if (raw.type === "call" && ["chi", "pon", "minkan"].includes(a?.type)) {
      const source = Number.isInteger(raw.from) && raw.from >= 0 && raw.from < 4 ? raw.from : null;
      const discard = source === null ? null : discards[source], index = melds[seat].length;
      melds[seat].push({ tile: a.tile, type: a.type });
      if (a.type === "minkan") pendingKan[seat] = { tile: a.tile, tileId: discard?.tileId ?? null, source, callType: "minkan", index };
      else emit(raw, "call", {
        tile: discard?.tile ?? a.tile,
        tileId: discard?.tileId ?? null,
        source,
        callType: a.type,
        tiles: preview(seat, index, a.tile, a.type)
      });
    } else if (raw.type === "kan") {
      const accepted = pendingKan[seat];
      if (!accepted) continue;
      const { tile, source = null, callType, index } = accepted, ids = s.players[seat]?.melds[index]?.ids ?? [];
      let tileId = accepted.tileId ?? null;
      if (callType === "kakan") tileId = ids[3] ?? null;
      else if (callType === "ankan") tileId = ids.find((id) => red(id, s.rules)) ?? ids[0] ?? null;
      emit(raw, "kan", { tile, tileId, source, callType, tiles: preview(seat, index, tile, callType) });
      if (callType === "ankan") melds[seat].push({ tile, type: "ankan" });
      else if (melds[seat][index]) melds[seat][index].type = callType;
      pendingKan[seat] = null;
    } else if (raw.type === "riichi") {
      const discard = discards[seat];
      emit(raw, "riichi", { tile: discard?.tile ?? null, tileId: discard?.tileId ?? null });
    } else if (raw.type === "win") emit(raw, "win", {
      tileId: raw.tile,
      source: raw.method === "ron" ? raw.source : null,
      method: raw.method
    });
  }
  return out.slice(-32);
}
function snapshot(s, seat) {
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) throw new Error("Invalid seat");
  const p = s.players[seat];
  const players = s.players.map((q, i) => ({
    seat: i,
    handSize: q.hand.length,
    score: q.score,
    points: s.startingScores[i] + q.score,
    riichi: q.riichi,
    won: q.won,
    melds: q.melds.map((m) => meldView(m, s)),
    river: q.river.map((d) => ({ ...tileView(d.id, s), claimed: d.claimed, riichi: !!d.riichi, robbedKan: !!d.robbedKan })),
    discards: q.river.map((d) => ({ tile: typeOf(d.id), red: red(d.id, s.rules), claimed: d.claimed, riichi: !!d.riichi })),
    wallRemaining: s.walls[i].length,
    exhausted: s.walls[i].length === 0,
    win: q.win ? structuredClone(q.win) : null,
    revealed: s.phase === "end" && q.won ? q.hand.map((id) => tileView(id, s)) : []
  }));
  return {
    variant: "D",
    seat,
    dealer: s.dealer,
    rules: { ...s.rules },
    phase: s.phase,
    turn: s.turn,
    end: s.end,
    actor: actor(s),
    hand: handTypes(p),
    handTiles: p.hand.map((id) => tileView(id, s, p.drawn)),
    melds: p.melds.map((m) => meldView(m, s)),
    players,
    legalActions: legalActions(s, seat),
    doraIndicators: indicators(s),
    uraIndicators: revealedUraIndicators(s),
    wallRemaining: remaining(s),
    ownWallRemaining: s.walls[seat].length,
    exhaustedSeats: exhaustedSeats(s),
    draws: s.draws,
    kans: s.kans,
    pot: s.pot,
    winners: [...s.winners],
    riichi: p.riichi,
    visible: visibleCounts(s, seat),
    publicEvents: publicEvents(s),
    lastDiscard: s.reaction ? { seat: s.reaction.source, ...tileView(s.reaction.id, s), kind: s.reaction.kind, final: s.reaction.final } : null,
    readySeats: s.phase === "end" ? s.events.findLast((e) => e.type === "drawSettlement")?.ready.map((p2) => p2.seat) ?? [] : []
  };
}
function observation(s, seat = actor(s)) {
  if (seat !== actor(s)) throw new Error("Not this player\u2019s decision");
  return snapshot(s, seat);
}
function assertInvariants(s) {
  const all = [...s.walls.flat(), ...s.dead];
  for (const p of s.players) {
    all.push(...p.hand);
    for (const m of p.melds) all.push(...m.ids);
    for (const d of p.river) if (!d.claimed) all.push(d.id);
  }
  if (all.length !== 136 || new Set(all).size !== 136 || all.some((id) => !Number.isInteger(id) || id < 0 || id >= 136)) throw new Error("Tile conservation violated");
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
  if (s.dead.length !== reservedTileCount(s.rules) || s.kans > s.rules.maxKans || s.winners.length > (s.rules.multipleRon === "all" ? 3 : 1) || s.winners.length !== s.players.filter((p) => p.won).length || new Set(s.winners).size !== s.winners.length) throw new Error("Round invariant violated");
  if (s.winners.length > 1 && s.winners.some((seat) => {
    const w = s.players[seat].win, f = s.players[s.winners[0]].win;
    return w.method !== "ron" || w.source !== f.source || w.tile !== f.tile;
  })) throw new Error("Multiple ron invariant violated");
  return true;
}

// duplicate/engine/mil-core-game.mjs
var mil_core_game_exports = {};
__export(mil_core_game_exports, {
  RED_IDS: () => RED_IDS2,
  actor: () => actor2,
  assertInvariants: () => assertInvariants2,
  createGame: () => createGame2,
  exhaustedSeats: () => exhaustedSeats2,
  indicators: () => indicators2,
  legalActions: () => legalActions2,
  observation: () => observation2,
  publicEvents: () => publicEvents2,
  revealedUraIndicators: () => revealedUraIndicators2,
  settleDraw: () => settleDraw2,
  snapshot: () => snapshot2,
  step: () => step2,
  visibleCounts: () => visibleCounts2
});

// duplicate/engine/duplicate-profile.mjs
function normalizeDuplicateProfile(value = "custom") {
  if (!["custom", "mil", "mil-riichi"].includes(value)) throw new Error("Unknown duplicate profile");
  return value;
}
var milRules = Object.freeze({
  dora: false,
  kanDora: false,
  uraDora: false,
  redDora: false,
  deadWall: false,
  exhaustLimit: 1,
  multipleRon: "all",
  abortFourKans: false
});
function normalizeProfileRules(raw = {}, profile = "custom") {
  const selected = normalizeDuplicateProfile(profile);
  if (selected === "custom") return normalizeRules(raw);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid rules");
  if (selected === "mil-riichi") {
    if (Object.hasOwn(raw, "exhaustLimit") && raw.exhaustLimit !== 1) throw new Error("MIL-riichi duplicate profile requires exhaustLimit=1");
    return normalizeRules({ deadWall: false, abortFourKans: false, ...raw, exhaustLimit: 1 });
  }
  for (const [key, value] of Object.entries(milRules)) if (Object.hasOwn(raw, key) && raw[key] !== value) throw new Error(`MIL duplicate profile requires ${key}=${value}`);
  return normalizeRules({ ...raw, ...milRules });
}

// duplicate/engine/mil-core-game.mjs
var RED_IDS2 = /* @__PURE__ */ new Set([16, 52, 88]);
var red2 = (id, rules) => rules.redDora && RED_IDS2.has(id);
var handTypes2 = (p) => p.hand.map(typeOf);
var same2 = (a, b) => JSON.stringify(a) === JSON.stringify(b);
var event2 = (s, e) => s.events.push({ n: s.events.length, ...e });
var remaining2 = (s) => s.walls.reduce((n, w) => n + w.length, 0);
var actor2 = (s) => s.phase === "turn" ? s.turn : s.phase === "reaction" ? s.reaction.pending[0] : null;
var exhaustedSeats2 = (s) => s.walls.flatMap((w, seat) => w.length ? [] : [seat]);
function indicators2(s, ura = false) {
  if (ura && !s.rules.uraDora) return [];
  const offset = s.rules.deadWall ? 4 : 0;
  const indices = [];
  if (ura || s.rules.dora) indices.push(0);
  if (s.rules.kanDora) for (let i = 1; i <= s.kans; i++) indices.push(i);
  return indices.map((i) => typeOf(s.dead[offset + 2 * i + (ura ? 1 : 0)]));
}
var revealedUraIndicators2 = (s) => s.end === "win" && s.winners.some((seat) => s.players[seat].riichi) ? indicators2(s, true) : [];
function context2(s, seat, method, id) {
  const p = s.players[seat], ids = [...p.hand, ...p.melds.flatMap((m) => m.ids)];
  if (method === "ron") ids.push(id);
  return {
    method,
    winTile: typeOf(id),
    seatWind: 27 + (seat - s.dealer + 4) % 4,
    dealer: seat === s.dealer,
    riichi: p.riichi,
    doubleRiichi: p.doubleRiichi,
    ippatsu: p.ippatsu,
    rinshan: p.drawSource === "kan" && method === "tsumo",
    tenhou: method === "tsumo" && seat === s.dealer && s.draws === 1 && s.calls === 0,
    chiihou: method === "tsumo" && seat !== s.dealer && p.river.length === 0 && s.calls === 0 && p.drawSource === "wall",
    lastTile: method === "ron" ? !!s.reaction?.final : !!s.milLastTurn,
    chankan: method === "ron" && s.reaction?.kind === "kakan",
    doraIndicators: indicators2(s),
    uraIndicators: indicators2(s, true),
    indicatorsFiltered: true,
    redCount: ids.filter((id2) => red2(id2, s.rules)).length
  };
}
function createGame2({ seed = 1, rules = {}, dealer = 0, wall = null, pot = 0, startingScores = null, duplicateProfile = "mil" } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295 || !Number.isInteger(dealer) || dealer < 0 || dealer > 3 || !Number.isSafeInteger(pot) || pot < 0 || pot % 1e3) throw new Error("Invalid seed, dealer or pot");
  if (startingScores !== null && (!Array.isArray(startingScores) || startingScores.length !== 4 || startingScores.some((n) => !Number.isSafeInteger(n)))) throw new Error("Invalid starting scores");
  const profile = normalizeDuplicateProfile(duplicateProfile);
  if (profile === "custom") throw new Error("MIL core requires a MIL progression profile");
  const r = normalizeProfileRules(rules, profile), w = wall ? [...wall] : shuffledWall(seed);
  if (w.length !== 136 || new Set(w).size !== 136 || w.some((id) => !Number.isInteger(id) || id < 0 || id >= 136)) throw new Error("Invalid wall");
  const reserve = reservedTileCount(r), dead = reserve ? w.splice(136 - reserve) : [];
  const s = {
    version: 1,
    duplicateProfile: profile,
    milLastTurn: null,
    seed,
    rules: r,
    dealer,
    dead,
    walls: Array.from({ length: 4 }, () => []),
    startingScores: startingScores ? [...startingScores] : Array(4).fill(r.startingPoints),
    pot,
    initialPot: pot,
    players: Array.from({ length: 4 }, () => ({
      hand: [],
      melds: [],
      river: [],
      score: 0,
      won: false,
      win: null,
      drawn: null,
      drawSource: null,
      passLock: false,
      forbidden: [],
      riichi: false,
      riichiFuriten: false,
      riichiWaits: [],
      doubleRiichi: false,
      ippatsu: false,
      pao: null,
      stats: { winReceipt: 0, dealInLoss: 0, tsumoPaid: 0, drawLoss: 0, drawGain: 0, riichiPaid: 0, ronDeclined: 0, closedKans: 0 }
    })),
    phase: "init",
    turn: dealer,
    draws: 0,
    kans: 0,
    calls: 0,
    winners: [],
    reaction: null,
    events: [],
    ledger: [],
    end: null,
    pendingAbort: null
  };
  for (let n = 0; n < 13; n++) for (let seat = 0; seat < 4; seat++) s.players[seat].hand.push(w.shift());
  s.initialHands = s.players.map((p) => [...p.hand]);
  for (let i = 0; i < w.length; i++) s.walls[i % 4].push(w[i]);
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
function receiveTurn(s, seat, via) {
  s.turn = seat;
  s.phase = "turn";
  s.reaction = null;
  if (!s.milLastTurn && !s.walls[(seat + 1) % 4].length) s.milLastTurn = { seat, via };
}
function draw2(s, seat, kan = false) {
  if (!s.walls[seat].length) throw new Error("Cannot draw from exhausted personal wall");
  const p = s.players[seat], id = s.walls[seat].shift();
  p.hand.push(id);
  p.hand.sort((a, b) => a - b);
  p.drawn = id;
  p.drawSource = kan ? "kan" : "wall";
  p.passLock = false;
  p.forbidden = [];
  receiveTurn(s, seat, kan ? "kan" : "draw");
  s.draws++;
  event2(s, { type: kan ? "kanDraw" : "draw", seat, id });
}
function nextDraw2(s, source) {
  const seat = (source + 1) % 4;
  if (!s.walls[seat].length) {
    settleDraw2(s);
    return;
  }
  draw2(s, seat);
}
function end2(s, reason) {
  s.end = reason;
  s.phase = "end";
  s.reaction = null;
  event2(s, { type: "end", reason });
}
function win2(s, seat, method, source, id, { finish = true } = {}) {
  const p = s.players[seat], tiles = handTypes2(p);
  if (method === "ron") tiles.push(typeOf(id));
  const score = scoreRiichi(tiles, p.melds, context2(s, seat, method, id), s.rules);
  if (!score) throw new Error("Illegal riichi win");
  const first = s.ledger.length;
  const pao = p.pao && score.yakuman && score.yakuEntries.some((y) => y.id === p.pao.yaku) ? p.pao : null;
  if (pao) {
    const count = score.yakumanCount ?? 1, portion = score.points.ron / count;
    if (method === "tsumo") {
      transfer2(s, pao.seat, seat, portion, method);
      if (count > 1) {
        for (let from = 0; from < 4; from++) if (from !== seat) {
          const amount = (from === s.dealer ? score.points.tsumoDealer : score.points.tsumoOther) * (count - 1) / count;
          transfer2(s, from, seat, amount, method);
        }
      }
    } else if (source === pao.seat) transfer2(s, source, seat, score.points.ron, method);
    else {
      transfer2(s, pao.seat, seat, portion / 2, method);
      transfer2(s, source, seat, score.points.ron - portion / 2, method);
    }
  } else if (method === "ron") transfer2(s, source, seat, score.points.ron, method);
  else for (let from = 0; from < 4; from++) if (from !== seat) transfer2(s, from, seat, from === s.dealer ? score.points.tsumoDealer : score.points.tsumoOther, method);
  if (s.pot) transfer2(s, "pot", seat, s.pot, "pot");
  const payments2 = structuredClone(s.ledger.slice(first));
  p.won = true;
  p.win = {
    method,
    source,
    tile: id,
    order: s.winners.length + 1,
    drawNumber: s.draws,
    score,
    payments: payments2,
    receipt: payments2.reduce((n, e) => n + e.amount, 0),
    ...pao ? { pao } : {}
  };
  p.drawn = null;
  s.winners.push(seat);
  event2(s, { type: "win", seat, ...p.win });
  if (finish) end2(s, "win");
}
function visibleCounts2(s, seat) {
  const out = Array(34).fill(0), add = (id) => out[typeOf(id)]++;
  for (let i = 0; i < 4; i++) {
    const p = s.players[i];
    for (const m of p.melds) for (const id of m.ids) add(id);
    for (const d of p.river) if (!d.claimed) add(d.id);
    if (i === seat || s.phase === "end" && p.won) for (const id of p.hand) add(id);
  }
  for (const t of indicators2(s)) out[t]++;
  return out;
}
function settleDraw2(s) {
  const r = s.reaction;
  if (s.phase !== "reaction" || !s.milLastTurn || !r || r.kind !== "discard" || !r.final || r.source !== s.milLastTurn.seat || r.pending.length || r.answers.length !== 3 || r.answers.some((answer) => answer.action.type === "ron")) throw new Error("Cannot settle this board");
  const ready = s.players.flatMap((p, seat) => {
    const waits = shapeWaits(handTypes2(p), p.melds, s.rules);
    return waits.length ? [{ seat, waits }] : [];
  });
  if (ready.length && ready.length < 4) {
    const due = ready.map((p) => ({ seat: p.seat, amount: 3e3 / ready.length }));
    for (let from = 0; from < 4; from++) if (!ready.some((p) => p.seat === from)) {
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
  event2(s, { type: "drawSettlement", ready, exhaustedSeats: exhaustedSeats2(s) });
  end2(s, "exhaustive-draw");
}
function canRon2(s, seat) {
  const p = s.players[seat], r = s.reaction;
  if (!r || seat === r.source || p.passLock || p.riichiFuriten) return null;
  const waits = shapeWaits(handTypes2(p), p.melds, s.rules);
  if (p.river.some((d) => waits.includes(typeOf(d.id)))) return null;
  return scoreRiichi([...handTypes2(p), typeOf(r.id)], p.melds, context2(s, seat, "ron", r.id), s.rules);
}
function riichiAnkanAllowed2(p, t, rules) {
  if (typeOf(p.drawn) !== t) return false;
  const tiles = handTypes2(p), next = tiles.filter((x) => x !== t), melds = [...p.melds, { type: "kan", tile: t, open: false }];
  if (!same2(shapeWaits(next, melds, rules), p.riichiWaits)) return false;
  const before = [...tiles];
  before.splice(before.indexOf(t), 1);
  return p.riichiWaits.every((wait) => {
    const shapes2 = decompositions([...before, wait], p.melds, { sevenPairsQuadAsTwo: false });
    return shapes2.length && shapes2.every((shape) => shape.kind === "standard" && shape.groups.some((g) => g.type === "pon" && g.tile === t) && !shape.groups.some((g) => g.type === "chi" && g.tile <= t && t <= g.tile + 2));
  });
}
function forbiddenForCall2(a, t) {
  const out = [t];
  if (a.type === "chi") {
    if (t === a.tile && t % 9 <= 5) out.push(t + 3);
    if (t === a.tile + 2 && t % 9 >= 3) out.push(t - 3);
  }
  return out;
}
function legalActions2(s, seat = actor2(s)) {
  if (seat === null || seat !== actor2(s)) return [];
  const p = s.players[seat], tiles = handTypes2(p), c = counts(tiles), out = [];
  if (s.phase === "turn") {
    if (p.drawn !== null && scoreRiichi(tiles, p.melds, context2(s, seat, "tsumo", p.drawn), s.rules)) out.push({ type: "tsumo" });
    if (!s.milLastTurn && p.drawn !== null && s.walls[seat].length && s.kans < s.rules.maxKans) {
      for (let t = 0; t < 34; t++) if (c[t] === 4 && (!p.riichi || riichiAnkanAllowed2(p, t, s.rules))) out.push({ type: "ankan", tile: t });
      if (!p.riichi) p.melds.forEach((m, i) => {
        if (m.type === "pon" && c[m.tile]) out.push({ type: "kakan", meld: i });
      });
    }
    for (const id of p.hand) if (!p.forbidden.includes(typeOf(id)) && (!p.riichi || id === p.drawn)) {
      const tile = typeOf(id);
      out.push({ type: "discard", tile, id });
      if (!p.riichi && p.melds.every((m) => !m.open) && s.startingScores[seat] + p.score >= 1e3 && remaining2(s) >= 4 && s.walls[seat].length && !s.milLastTurn) {
        const next = [...tiles];
        next.splice(next.indexOf(tile), 1);
        if (shapeWaits(next, p.melds, s.rules).length) out.push({ type: "riichi", tile, id });
      }
    }
  } else {
    const r = s.reaction, t = typeOf(r.id);
    if (canRon2(s, seat)) out.push({ type: "ron" });
    out.push({ type: "pass" });
    if (!p.riichi && r.kind === "discard" && !r.final && !s.pendingAbort) {
      const candidates = [];
      if (c[t] >= 2) candidates.push({ type: "pon", tile: t });
      if (c[t] >= 3 && s.walls[seat].length && s.kans < s.rules.maxKans) candidates.push({ type: "minkan", tile: t });
      if (seat === (r.source + 1) % 4 && t < 27) for (let start = Math.max(Math.floor(t / 9) * 9, t - 2); start <= Math.min(Math.floor(t / 9) * 9 + 6, t); start++) {
        if ([start, start + 1, start + 2].filter((x) => x !== t).every((x) => c[x])) candidates.push({ type: "chi", tile: start });
      }
      for (const a of candidates) {
        if (a.type === "minkan") {
          out.push(a);
          continue;
        }
        const cc = [...c];
        for (const x of a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x2) => x2 !== t) : [t, t]) cc[x]--;
        if (cc.some((n, tile) => n && !forbiddenForCall2(a, t).includes(tile))) out.push(a);
      }
    }
  }
  return out;
}
function remove2(p, types) {
  const ids = [];
  for (const t of types) {
    let i = p.hand.findIndex((id) => typeOf(id) === t && !RED_IDS2.has(id));
    if (i < 0) i = p.hand.findIndex((id) => typeOf(id) === t);
    if (i < 0) throw new Error("Missing tile");
    ids.push(...p.hand.splice(i, 1));
  }
  return ids;
}
function reaction2(s, source, id, kind, extra = {}) {
  s.phase = "reaction";
  s.reaction = {
    source,
    id,
    kind,
    final: kind === "discard" && !!s.milLastTurn,
    pending: [1, 2, 3].map((n) => (source + n) % 4),
    answers: [],
    ...extra
  };
}
function cancelIppatsu2(s) {
  for (const p of s.players) p.ippatsu = false;
}
function completeKan2(s, seat, details = {}) {
  cancelIppatsu2(s);
  s.kans++;
  s.calls++;
  event2(s, { type: "kan", seat, ...details });
  if (s.rules.abortFourKans && s.kans === 4 && s.players.filter((p) => p.melds.some((m) => m.type === "kan")).length > 1) s.pendingAbort = "four-kans";
  draw2(s, seat, true);
}
function acceptRiichi2(s, r) {
  if (!r.riichi) return;
  const p = s.players[r.source];
  p.riichi = true;
  p.ippatsu = true;
  p.doubleRiichi = p.river.length === 1 && s.calls === 0;
  p.riichiWaits = shapeWaits(handTypes2(p), p.melds, s.rules);
  transfer2(s, r.source, "pot", 1e3, "riichi");
  event2(s, { type: "riichi", seat: r.source });
}
function resolve2(s) {
  const r = s.reaction, rons = r.answers.filter((x) => x.action.type === "ron");
  if (rons.length) {
    if (r.kind === "kakan") {
      const p2 = s.players[r.source];
      p2.hand.splice(p2.hand.indexOf(r.id), 1);
      p2.river.push({ id: r.id, claimed: false, robbedKan: true });
    }
    for (const ron of s.rules.multipleRon === "all" ? rons : rons.slice(0, 1)) win2(s, ron.seat, "ron", r.source, r.id, { finish: false });
    end2(s, "win");
    return;
  }
  if (r.kind === "kakan") {
    const p2 = s.players[r.source], m = p2.melds[r.meld], added = remove2(p2, [m.tile]);
    m.ids.push(...added);
    m.type = "kan";
    completeKan2(s, r.source, { callType: "kakan", tileId: added[0], ids: [...m.ids], meld: r.meld });
    return;
  }
  acceptRiichi2(s, r);
  if (r.final) {
    settleDraw2(s);
    return;
  }
  if (s.pendingAbort) {
    end2(s, s.pendingAbort);
    return;
  }
  const calls = r.answers.filter((x) => ["pon", "minkan", "chi"].includes(x.action.type)).sort((a2, b) => (a2.action.type === "chi") - (b.action.type === "chi"));
  if (!calls.length) {
    nextDraw2(s, r.source);
    return;
  }
  cancelIppatsu2(s);
  s.calls++;
  const { seat, action: a } = calls[0], p = s.players[seat], t = typeOf(r.id);
  const ids = [...remove2(p, a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x) => x !== t) : Array(a.type === "minkan" ? 3 : 2).fill(t)), r.id];
  s.players[r.source].river.at(-1).claimed = true;
  p.melds.push({ type: a.type === "chi" ? "chi" : a.type === "minkan" ? "kan" : "pon", tile: a.tile, open: true, from: r.source, ids });
  const open = p.melds.filter((m) => m.open && m.type !== "chi");
  const paoYaku = a.type !== "chi" && (t >= 31 && open.filter((m) => m.tile >= 31).length === 3 ? "bigThreeDragons" : t >= 27 && t < 31 && open.filter((m) => m.tile >= 27 && m.tile < 31).length === 4 ? "bigFourWinds" : null);
  if (paoYaku) p.pao = { seat: r.source, yaku: paoYaku };
  p.drawn = null;
  p.drawSource = null;
  p.forbidden = forbiddenForCall2(a, t);
  receiveTurn(s, seat, a.type);
  event2(s, { type: "call", seat, action: a, from: r.source, tileId: r.id, ids: [...ids] });
  if (a.type === "minkan") completeKan2(s, seat, { callType: "minkan", tileId: r.id, ids: [...ids], from: r.source });
}
function canonicalAction2(s, seat, action) {
  if (!action || typeof action !== "object") return null;
  const legal = legalActions2(s, seat);
  if (["discard", "riichi"].includes(action.type)) {
    const matching = legal.filter((a) => a.type === action.type && (action.tile === void 0 || a.tile === action.tile) && (action.id === void 0 || a.id === action.id));
    if (action.tile === void 0 && action.id === void 0) return null;
    return matching.find((a) => !RED_IDS2.has(a.id)) ?? matching[0];
  }
  return legal.find((a) => same2(a, action));
}
function step2(s, seat, action, { validate = true } = {}) {
  const a = canonicalAction2(s, seat, action);
  if (!a) throw new Error(`Illegal action by ${seat}`);
  const p = s.players[seat];
  const kakanId = a.type === "kakan" ? p.hand.find((id) => typeOf(id) === p.melds[a.meld].tile && !RED_IDS2.has(id)) ?? p.hand.find((id) => typeOf(id) === p.melds[a.meld].tile) : null;
  event2(s, { type: "action", seat, action: { ...a }, ...a.type === "kakan" ? { tileId: kakanId, meldIds: [...p.melds[a.meld].ids] } : {} });
  if (s.phase === "reaction") {
    const r = s.reaction;
    if (a.type !== "ron" && canRon2(s, seat)) {
      p.passLock = true;
      p.stats.ronDeclined++;
      if (p.riichi) p.riichiFuriten = true;
    }
    r.answers.push({ seat, action: { ...a } });
    r.pending.shift();
    if (!r.pending.length) resolve2(s);
  } else if (a.type === "tsumo") win2(s, seat, "tsumo", seat, p.drawn);
  else if (a.type === "discard" || a.type === "riichi") {
    p.hand.splice(p.hand.indexOf(a.id), 1);
    if (p.riichi) p.ippatsu = false;
    p.river.push({ id: a.id, claimed: false, riichi: a.type === "riichi" });
    p.drawn = null;
    p.drawSource = null;
    p.forbidden = [];
    reaction2(s, seat, a.id, "discard", { riichi: a.type === "riichi" });
  } else if (a.type === "ankan") {
    const ids = remove2(p, Array(4).fill(a.tile));
    p.melds.push({ type: "kan", tile: a.tile, open: false, from: seat, ids });
    p.stats.closedKans++;
    completeKan2(s, seat, { callType: "ankan", ids: [...ids] });
  } else if (a.type === "kakan") {
    cancelIppatsu2(s);
    reaction2(s, seat, kakanId, "kakan", { meld: a.meld });
  }
  if (validate) assertInvariants2(s);
  return s;
}
var tileView2 = (id, s, drawn = null) => ({ id, type: typeOf(id), tile: typeOf(id), red: red2(id, s.rules), drawn: id === drawn });
var meldView2 = (m, s) => ({ ...structuredClone(m), tiles: m.ids.map((id) => tileView2(id, s)) });
function publicEvents2(s) {
  const out = [], discards = Array(4).fill(null), pendingKan = Array(4).fill(null), melds = Array.from({ length: 4 }, () => []);
  const physical2 = (id) => Number.isInteger(id) && id >= 0 && id < 136 ? id : null;
  const preview = (seat, index, tile, callType) => {
    const count = ["ankan", "kakan", "minkan"].includes(callType) ? 4 : 3;
    const ids = s.players[seat]?.melds[index]?.ids?.slice(0, count);
    if (ids?.length === count) return ids.map((id) => ({ type: typeOf(id), red: red2(id, s.rules) })).sort((a, b) => a.type - b.type);
    const types = callType === "chi" ? [tile, tile + 1, tile + 2] : Array(count).fill(tile);
    return types.filter((type) => Number.isInteger(type) && type >= 0 && type < 34).map((type) => ({ type, red: false }));
  };
  const emit = (raw, kind, { tile = null, tileId = null, source = null, callType = null, method = null, tiles } = {}) => {
    const id = physical2(tileId), type = id === null ? tile : typeOf(id);
    const item = {
      id: raw.n,
      kind,
      seat: raw.seat,
      tile: Number.isInteger(type) && type >= 0 && type < 34 ? type : null,
      tileId: id,
      red: id !== null && red2(id, s.rules),
      source: Number.isInteger(source) && source >= 0 && source < 4 ? source : null,
      callType,
      method: ["ron", "tsumo"].includes(method) ? method : null
    };
    if (tiles?.length) item.tiles = tiles;
    out.push(item);
    return item;
  };
  for (const raw of s.events ?? []) {
    if (!Number.isSafeInteger(raw.n) || raw.n < 0 || !Number.isInteger(raw.seat) || raw.seat < 0 || raw.seat > 3) continue;
    const seat = raw.seat, a = raw.action;
    if (raw.type === "action") {
      if (a?.type === "discard" || a?.type === "riichi") discards[seat] = emit(raw, "discard", { tile: a.tile, tileId: a.id });
      else if (a?.type === "ankan") pendingKan[seat] = { tile: a.tile, callType: "ankan", index: melds[seat].length };
      else if (a?.type === "kakan") pendingKan[seat] = { tile: melds[seat][a.meld]?.tile ?? null, callType: "kakan", index: a.meld };
    } else if (raw.type === "call" && ["chi", "pon", "minkan"].includes(a?.type)) {
      const source = Number.isInteger(raw.from) && raw.from >= 0 && raw.from < 4 ? raw.from : null;
      const discard = source === null ? null : discards[source], index = melds[seat].length;
      melds[seat].push({ tile: a.tile, type: a.type });
      if (a.type === "minkan") pendingKan[seat] = { tile: a.tile, tileId: discard?.tileId ?? null, source, callType: "minkan", index };
      else emit(raw, "call", {
        tile: discard?.tile ?? a.tile,
        tileId: discard?.tileId ?? null,
        source,
        callType: a.type,
        tiles: preview(seat, index, a.tile, a.type)
      });
    } else if (raw.type === "kan") {
      const accepted = pendingKan[seat];
      if (!accepted) continue;
      const { tile, source = null, callType, index } = accepted, ids = s.players[seat]?.melds[index]?.ids ?? [];
      let tileId = accepted.tileId ?? null;
      if (callType === "kakan") tileId = ids[3] ?? null;
      else if (callType === "ankan") tileId = ids.find((id) => red2(id, s.rules)) ?? ids[0] ?? null;
      emit(raw, "kan", { tile, tileId, source, callType, tiles: preview(seat, index, tile, callType) });
      if (callType === "ankan") melds[seat].push({ tile, type: "ankan" });
      else if (melds[seat][index]) melds[seat][index].type = callType;
      pendingKan[seat] = null;
    } else if (raw.type === "riichi") {
      const discard = discards[seat];
      emit(raw, "riichi", { tile: discard?.tile ?? null, tileId: discard?.tileId ?? null });
    } else if (raw.type === "win") emit(raw, "win", {
      tileId: raw.tile,
      source: raw.method === "ron" ? raw.source : null,
      method: raw.method
    });
  }
  return out.slice(-32);
}
function snapshot2(s, seat) {
  if (!Number.isInteger(seat) || seat < 0 || seat > 3) throw new Error("Invalid seat");
  const p = s.players[seat];
  const players = s.players.map((q, i) => ({
    seat: i,
    handSize: q.hand.length,
    score: q.score,
    points: s.startingScores[i] + q.score,
    riichi: q.riichi,
    won: q.won,
    melds: q.melds.map((m) => meldView2(m, s)),
    river: q.river.map((d) => ({ ...tileView2(d.id, s), claimed: d.claimed, riichi: !!d.riichi, robbedKan: !!d.robbedKan })),
    discards: q.river.map((d) => ({ tile: typeOf(d.id), red: red2(d.id, s.rules), claimed: d.claimed, riichi: !!d.riichi })),
    wallRemaining: s.walls[i].length,
    exhausted: s.walls[i].length === 0,
    win: q.win ? structuredClone(q.win) : null,
    revealed: s.phase === "end" && q.won ? q.hand.map((id) => tileView2(id, s)) : []
  }));
  return {
    variant: "D",
    duplicateProfile: s.duplicateProfile,
    lastTileTurn: !!s.milLastTurn,
    seat,
    dealer: s.dealer,
    rules: { ...s.rules },
    phase: s.phase,
    turn: s.turn,
    end: s.end,
    actor: actor2(s),
    hand: handTypes2(p),
    handTiles: p.hand.map((id) => tileView2(id, s, p.drawn)),
    melds: p.melds.map((m) => meldView2(m, s)),
    players,
    legalActions: legalActions2(s, seat),
    doraIndicators: indicators2(s),
    uraIndicators: revealedUraIndicators2(s),
    wallRemaining: remaining2(s),
    ownWallRemaining: s.walls[seat].length,
    exhaustedSeats: exhaustedSeats2(s),
    draws: s.draws,
    kans: s.kans,
    pot: s.pot,
    winners: [...s.winners],
    riichi: p.riichi,
    visible: visibleCounts2(s, seat),
    publicEvents: publicEvents2(s),
    lastDiscard: s.reaction ? { seat: s.reaction.source, ...tileView2(s.reaction.id, s), kind: s.reaction.kind, final: s.reaction.final } : null,
    readySeats: s.phase === "end" ? s.events.findLast((e) => e.type === "drawSettlement")?.ready.map((p2) => p2.seat) ?? [] : []
  };
}
function observation2(s, seat = actor2(s)) {
  if (seat !== actor2(s)) throw new Error("Not this player\u2019s decision");
  return snapshot2(s, seat);
}
function assertInvariants2(s) {
  if (!["mil", "mil-riichi"].includes(s.duplicateProfile)) throw new Error("Invalid MIL progression profile");
  normalizeProfileRules(s.rules, s.duplicateProfile);
  const all = [...s.walls.flat(), ...s.dead];
  for (const p of s.players) {
    all.push(...p.hand);
    for (const m of p.melds) all.push(...m.ids);
    for (const d of p.river) if (!d.claimed) all.push(d.id);
  }
  if (all.length !== 136 || new Set(all).size !== 136 || all.some((id) => !Number.isInteger(id) || id < 0 || id >= 136)) throw new Error("Tile conservation violated");
  if (s.players.reduce((n, p) => n + p.score, 0) + s.pot !== s.initialPot || s.pot < 0) throw new Error("Score conservation violated");
  for (let seat = 0; seat < 4; seat++) {
    const p = s.players[seat], extra = s.phase === "turn" && s.turn === seat || s.phase === "reaction" && s.reaction.kind === "kakan" && s.reaction.source === seat || p.win?.method === "tsumo";
    if (p.hand.length + 3 * p.melds.length !== (extra ? 14 : 13)) throw new Error(`Hand size violated seat ${seat}`);
    for (const m of p.melds) {
      const wanted = m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : Array(m.type === "kan" ? 4 : 3).fill(m.tile);
      if (!same2(m.ids.map(typeOf).sort((a, b) => a - b), wanted)) throw new Error("Illegal meld");
    }
    const st = p.stats;
    if (p.score !== st.winReceipt + st.drawGain - st.dealInLoss - st.tsumoPaid - st.drawLoss - st.riichiPaid) throw new Error("Ledger attribution violated");
  }
  if (s.dead.length !== reservedTileCount(s.rules) || s.kans > s.rules.maxKans || s.winners.length > (s.rules.multipleRon === "all" ? 3 : 1) || s.winners.length !== s.players.filter((p) => p.won).length || new Set(s.winners).size !== s.winners.length) throw new Error("Round invariant violated");
  if (s.winners.length > 1 && s.winners.some((seat) => {
    const w = s.players[seat].win, f = s.players[s.winners[0]].win;
    return w.method !== "ron" || w.source !== f.source || w.tile !== f.tile;
  })) throw new Error("Multiple ron invariant violated");
  return true;
}

// duplicate/shared/shanten.mjs
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
      const tt = Math.min(4 - mm, t + dt), key = mm * 2 + pp;
      if ((out.get(key) ?? -1) < tt) out.set(key, tt);
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
      const nt = Math.min(4 - nm, t + tt), key = nm * 2 + np;
      if ((next.get(key) ?? -1) < nt) next.set(key, nt);
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

// duplicate/engine/ai.mjs
var ORPHANS2 = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
var distance = (c, melds) => Math.min(shanten(c, melds), melds ? 8 : 13 - ORPHANS2.filter((t) => c[t]).length - Number(ORPHANS2.some((t) => c[t] >= 2)));
function chooseAction(view) {
  const legal = view.legalActions;
  if (!legal?.length) throw new Error("No legal action");
  for (const type of ["tsumo", "ron"]) {
    const win3 = legal.find((a) => a.type === type);
    if (win3) return win3;
  }
  if (view.phase === "reaction") return legal.find((a) => a.type === "pass") ?? legal[0];
  const c = counts(view.hand), melds = view.melds.length, rows = [];
  for (const a of legal.filter((a2) => a2.type === "discard")) {
    c[a.tile]--;
    const d = distance(c, melds);
    let ukeire = 0;
    for (let t = 0; t < 34; t++) if (c[t] < 4 && view.visible[t] < 4) {
      c[t]++;
      if (distance(c, melds) < d) ukeire += 4 - view.visible[t];
      c[t]--;
    }
    c[a.tile]++;
    let danger = 0;
    for (const p of view.players) if (p.seat !== view.seat && p.riichi) {
      if (!p.river.some((t) => t.type === a.tile)) danger += a.tile >= 27 ? 0.7 : 1.5;
    }
    const dora = (view.doraIndicators ?? []).filter((t) => doraAfter(t) === a.tile).length;
    const red3 = view.handTiles?.find((t) => t.id === a.id)?.red ? 1 : 0;
    rows.push({ a, d, score: -100 * d + ukeire - 12 * danger - 2 * dora - 2 * red3, danger });
  }
  rows.sort((a, b) => b.score - a.score || a.a.id - b.a.id);
  if (!rows.length) return legal[0];
  const best = rows[0], riichi = legal.find((a) => a.type === "riichi" && a.id === best.a.id);
  if (riichi && best.danger < 2) return riichi;
  if (!view.players.some((p) => p.seat !== view.seat && p.riichi)) for (const a of legal.filter((a2) => a2.type === "ankan")) {
    c[a.tile] -= 4;
    const after = distance(c, melds + 1);
    c[a.tile] += 4;
    if (after <= best.d) return a;
  }
  return best.a;
}

// duplicate/engine/live-game.mjs
var honbaOf = (game) => {
  const honba = game.honba ?? 0;
  if (!Number.isSafeInteger(honba) || honba < 0) throw new Error("Invalid honba");
  return honba;
};
var engineFor = (game) => normalizeDuplicateProfile(game.duplicateProfile) === "custom" ? game_exports : mil_core_game_exports;
function createGame3({ honba = 0, duplicateProfile = "custom", ...options } = {}) {
  const profile = normalizeDuplicateProfile(duplicateProfile);
  honbaOf({ honba });
  const game = profile === "custom" ? createGame(options) : createGame2({ ...options, duplicateProfile: profile });
  game.honba = honba;
  game.duplicateProfile = profile;
  return game;
}
var actor3 = (game) => engineFor(game).actor(game);
function addHonba(game) {
  const honba = honbaOf(game), seat = game.winners[0];
  if (!honba || seat === void 0) return;
  const winner = game.players[seat], win3 = winner.win, amount = honba * 300;
  if (!Number.isSafeInteger(amount)) throw new Error("Honba payment exceeds the supported range");
  const moves = win3.pao ? [{ from: win3.pao.seat, to: seat, amount, kind: win3.method, honba: true }] : win3.method === "ron" ? [{ from: win3.source, to: seat, amount, kind: "ron", honba: true }] : [0, 1, 2, 3].filter((from) => from !== seat).map((from) => ({ from, to: seat, amount: honba * 100, kind: "tsumo", honba: true }));
  const scores = game.players.map((p) => p.score), stats = game.players.map((p) => ({ ...p.stats }));
  for (const move of moves) {
    scores[move.from] -= move.amount;
    scores[seat] += move.amount;
    stats[move.from][move.kind === "ron" ? "dealInLoss" : "tsumoPaid"] += move.amount;
    stats[seat].winReceipt += move.amount;
  }
  if (scores.some((n) => !Number.isSafeInteger(n)) || stats.some((s) => Object.values(s).some((n) => !Number.isSafeInteger(n))) || !Number.isSafeInteger(win3.receipt + amount)) throw new Error("Honba settlement exceeds the supported range");
  for (let i = 0; i < 4; i++) {
    game.players[i].score = scores[i];
    Object.assign(game.players[i].stats, stats[i]);
  }
  game.ledger.push(...moves);
  win3.payments.push(...structuredClone(moves));
  win3.receipt += amount;
  win3.honba = honba;
  win3.honbaReceipt = amount;
  const event3 = game.events.findLast((event4) => event4.type === "win" && event4.seat === seat);
  if (event3) Object.assign(event3, { payments: structuredClone(win3.payments), receipt: win3.receipt, honba, honbaReceipt: amount });
}
function step3(game, seat, action, options = {}) {
  const engine = engineFor(game);
  const honba = honbaOf(game);
  if (!Number.isSafeInteger(honba * 300)) throw new Error("Honba payment exceeds the supported range");
  const prior = game.winners.length;
  const couldWin = honba > 0 && (game.phase === "turn" && action?.type === "tsumo" || game.phase === "reaction" && game.reaction.pending.length === 1 && (action?.type === "ron" || game.reaction.answers.some((answer) => answer.action.type === "ron")));
  if (couldWin) {
    const next = structuredClone(game);
    engine.step(next, seat, action, options);
    if (prior === 0 && next.winners.length) addHonba(next);
    if (options.validate !== false) engine.assertInvariants(next);
    Object.assign(game, next);
    return game;
  }
  engine.step(game, seat, action, options);
  return game;
}
function snapshot3(game, seat) {
  return { ...engineFor(game).snapshot(game, seat), honba: honbaOf(game), duplicateProfile: normalizeDuplicateProfile(game.duplicateProfile) };
}

// duplicate/basic-ai.mjs
var RED_IDS3 = /* @__PURE__ */ new Set([16, 52, 88]);
var ORPHANS3 = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
var physical = (id) => Number.isInteger(id) && id >= 0 && id < 136;
var simple = (type) => type < 27 && type % 9 !== 0 && type % 9 !== 8;
var distance2 = (c, melds) => Math.min(shanten(c, melds), melds ? 8 : 13 - ORPHANS3.filter((type) => c[type]).length - Number(ORPHANS3.some((type) => c[type] >= 2)));
var meldTypes = (meld) => meld.type === "chi" ? [meld.tile, meld.tile + 1, meld.tile + 2] : [meld.tile];
function fixedYakuhai(melds, view) {
  const wind = 27 + (view.seat - view.dealer + 4) % 4, round = view.rules?.roundWind ?? 27;
  return melds.some((meld) => meld.type !== "chi" && (meld.tile >= 31 || meld.tile === wind || meld.tile === round));
}
function credibleYaku(c, melds, view) {
  return fixedYakuhai(melds, view) || view.rules?.kuitan === true && melds.every((meld) => meldTypes(meld).every(simple)) && c.every((number, type) => !number || simple(type));
}
function quality(c, meldCount, visible) {
  const d = distance2(c, meldCount);
  let ukeire = 0;
  for (let type = 0; type < 34; type++) if (c[type] < 4 && visible[type] < 4) {
    c[type]++;
    if (distance2(c, meldCount) < d) ukeire += 4 - visible[type];
    c[type]--;
  }
  return { d, ukeire };
}
var better = (a, b) => a.d < b.d - 1e-10 || Math.abs(a.d - b.d) < 1e-10 && a.ukeire > b.ukeire + 1e-10;
function bestDiscard(c, melds, view, visible, forbidden2 = []) {
  let best = null;
  for (let type = 0; type < 34; type++) if (c[type] && !forbidden2.includes(type)) {
    c[type]--;
    if (credibleYaku(c, melds, view)) {
      const value = quality(c, melds.length, visible);
      if (!best || better(value, best)) best = { ...value, discard: type };
    }
    c[type]++;
  }
  return best;
}
function forbidden(call, called) {
  const out = [called];
  if (call.type === "chi") {
    if (called === call.tile && called % 9 <= 5) out.push(called + 3);
    if (called === call.tile + 2 && called % 9 >= 3) out.push(called - 3);
  }
  return out;
}
function consume(view, call, called) {
  const own = view.handTiles;
  if (!Array.isArray(own) || own.length !== view.hand.length || own.some((tile) => !physical(tile.id) || tile.type !== Math.floor(tile.id / 4)) || new Set(own.map((tile) => tile.id)).size !== own.length) return null;
  if (JSON.stringify([...own.map((tile) => tile.type)].sort((a, b) => a - b)) !== JSON.stringify([...view.hand].sort((a, b) => a - b))) return null;
  const wanted = call.type === "chi" ? [call.tile, call.tile + 1, call.tile + 2].filter((type) => type !== called) : Array(call.type === "minkan" ? 3 : 2).fill(called), remaining3 = [...own].sort((a, b) => a.id - b.id);
  if (wanted.length !== (call.type === "minkan" ? 3 : 2)) return null;
  for (const type of wanted) {
    let index = remaining3.findIndex((tile) => tile.type === type && !RED_IDS3.has(tile.id));
    if (index < 0) index = remaining3.findIndex((tile) => tile.type === type);
    if (index < 0) return null;
    remaining3.splice(index, 1);
  }
  return counts(remaining3.map((tile) => tile.type));
}
function replacementQuality(c, melds, view, visible) {
  let weight = 0, d = 0, ukeire = 0;
  for (let type = 0; type < 34; type++) {
    const remaining3 = 4 - visible[type];
    if (remaining3 <= 0 || c[type] >= 4) continue;
    c[type]++;
    const complete = distance2(c, melds.length) === -1 && credibleYaku(c, melds, view), seen = [...visible];
    seen[type]++;
    const value = complete ? { d: -1, ukeire: 0 } : bestDiscard(c, melds, view, seen);
    c[type]--;
    if (!value) return null;
    weight += remaining3;
    d += remaining3 * value.d;
    ukeire += remaining3 * value.ukeire;
  }
  return weight ? { d: d / weight, ukeire: ukeire / weight } : null;
}
function chooseAction2(view) {
  const legal = view.legalActions;
  if (!legal?.length) throw new Error("No legal action");
  for (const type of ["tsumo", "ron"]) {
    const win3 = legal.find((action) => action.type === type);
    if (win3) return win3;
  }
  if (view.phase !== "reaction") {
    const melds2 = view.melds ?? [];
    if (melds2.some((meld) => meld.open) && !fixedYakuhai(melds2, view) && view.rules?.kuitan === true) {
      const c = counts(view.hand), safe = legal.filter((action) => {
        if (action.type !== "discard") return false;
        c[action.tile]--;
        const yaku = credibleYaku(c, melds2, view);
        c[action.tile]++;
        return yaku;
      });
      if (safe.length) return chooseAction({ ...view, legalActions: safe });
    }
    return chooseAction(view);
  }
  const pass = legal.find((action) => action.type === "pass") ?? legal[0], source = view.lastDiscard, called = source?.type ?? source?.tile, id = source?.id ?? source?.tileId;
  if (source?.kind !== "discard" || !physical(id) || Math.floor(id / 4) !== called || source.seat === view.seat) return pass;
  if (view.players?.some((player) => player.seat !== view.seat && player.riichi)) return pass;
  const visible = Array.from({ length: 34 }, (_, type) => Number.isInteger(view.visible?.[type]) ? Math.min(4, Math.max(0, view.visible[type])) : counts(view.hand)[type]);
  const melds = view.melds ?? [], before = quality(counts(view.hand), melds.length, visible), rows = [];
  for (const call of legal.filter((action) => ["chi", "pon", "minkan"].includes(action.type))) {
    if (call.type === "chi" && (view.seat !== (source.seat + 1) % 4 || call.tile < 0 || call.tile >= 27 || call.tile % 9 > 6 || called < call.tile || called > call.tile + 2)) continue;
    if (call.type !== "chi" && call.tile !== called) continue;
    const c = consume(view, call, called);
    if (!c) continue;
    const next = [...melds, { type: call.type === "minkan" ? "kan" : call.type, tile: call.tile, open: true, from: source.seat }];
    const value = call.type === "minkan" ? replacementQuality(c, next, view, visible) : bestDiscard(c, next, view, visible, forbidden(call, called));
    if (value && better(value, before)) rows.push({ call, ...value });
  }
  rows.sort((a, b) => a.d - b.d || b.ukeire - a.ukeire || ["pon", "chi", "minkan"].indexOf(a.call.type) - ["pon", "chi", "minkan"].indexOf(b.call.type) || a.call.tile - b.call.tile);
  return rows[0]?.call ?? pass;
}
function driveAI(game, humanSeats = [], maxSteps = 500) {
  if (!Array.isArray(humanSeats) || humanSeats.some((seat) => !Number.isInteger(seat) || seat < 0 || seat > 3) || !Number.isInteger(maxSteps) || maxSteps < 0 || maxSteps > 1e4) throw new Error("Invalid AI drive options");
  let steps = 0;
  while (!["end", "ended"].includes(game.phase) && steps < maxSteps) {
    const seat = actor3(game);
    if (humanSeats.includes(seat)) break;
    step3(game, seat, chooseAction2(snapshot3(game, seat)));
    steps++;
  }
  return { state: game, steps, finished: ["end", "ended"].includes(game.phase), waitingForHuman: humanSeats.includes(actor3(game)) };
}

// duplicate/action-statistics.mjs
var STAT_KEYS = Object.freeze(["discard", "riichi", "call", "kan", "win", "dealIn"]);
var METRICS = Object.freeze([
  ["call", "\uD6C4\uB85C", "neutral"],
  ["riichi", "\uB9AC\uCE58", "neutral"],
  ["kan", "\uAE61", "neutral"],
  ["win", "\uD654\uB8CC", "higher"],
  ["dealIn", "\uBC29\uCD1D", "lower"]
]);
var integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
var plain = (value) => !!value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value));
var MAX_HANDS = Math.floor(Number.MAX_SAFE_INTEGER / 140);
function validateActionStats(stats, hands = 1) {
  if (!integer(hands, 1, MAX_HANDS) || !plain(stats) || Reflect.ownKeys(stats).length !== STAT_KEYS.length || !Reflect.ownKeys(stats).every((key) => STAT_KEYS.includes(key)) || !STAT_KEYS.every((key) => integer(stats[key], 0, hands * (key === "discard" ? 140 : ["call", "kan"].includes(key) ? 4 : 1))) || stats.riichi > stats.discard || stats.win + stats.dealIn > hands) throw Error("Invalid action statistics");
  return Object.fromEntries(STAT_KEYS.map((key) => [key, stats[key]]));
}
function actionStatsFromGame(game, seat = 0) {
  if (game?.phase !== "end" || !integer(seat, 0, 3)) throw Error("Hand has not ended");
  const player = game.players?.[seat];
  if (!Array.isArray(player?.river) || !Array.isArray(player.melds) || typeof player.riichi !== "boolean" || !Array.isArray(game.winners) || !game.winners.every((winner) => integer(winner, 0, 3)) || new Set(game.winners).size !== game.winners.length) throw Error("Missing hand outcomes");
  let dealIn = 0;
  for (const winner of game.winners) {
    const win3 = game.players[winner]?.win;
    if (!win3 || !["ron", "tsumo"].includes(win3.method) || win3.method === "ron" && (!integer(win3.source, 0, 3) || win3.source === winner)) throw Error("Missing winning outcome");
    if (win3.method === "ron" && win3.source === seat) dealIn = 1;
  }
  return validateActionStats({
    discard: player.river.filter((tile) => !tile.robbedKan).length,
    // A declaration discarded into ron is not an accepted riichi.
    riichi: Number(player.riichi),
    // An upgraded pon remains one accepted open meld, not a second call.
    call: player.melds.filter((meld) => meld.open).length,
    kan: player.melds.filter((meld) => meld.type === "kan").length,
    win: Number(game.winners.includes(seat)),
    dealIn
  });
}

// duplicate/baseline-worker.mjs
self.onmessage = (event3) => {
  try {
    const options = event3.data, game = createGame3(options);
    driveAI(game, [], 2e3);
    if (game.phase !== "end") throw new Error("AI \uAE30\uC900 \uB300\uAD6D\uC758 \uC9C4\uD589 \uD55C\uB3C4\uB97C \uCD08\uACFC\uD588\uC2B5\uB2C8\uB2E4.");
    self.postMessage({ score: game.players[options.seat].score, stats: actionStatsFromGame(game, options.seat) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
