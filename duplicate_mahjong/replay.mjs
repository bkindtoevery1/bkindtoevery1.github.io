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

// duplicate/shared/base-score.mjs
var DEFAULT_RULES = { sevenPairsQuadAsTwo: false };
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
function doraAfter(tile2) {
  if (!Number.isInteger(tile2) || tile2 < 0 || tile2 > 33) throw new Error("Invalid dora indicator");
  if (tile2 < 27) return Math.floor(tile2 / 9) * 9 + (tile2 % 9 + 1) % 9;
  if (tile2 < 31) return 27 + (tile2 - 27 + 1) % 4;
  return 31 + (tile2 - 31 + 1) % 3;
}
function physicalTiles(types, melds) {
  if (!Array.isArray(types) || !Array.isArray(melds) || melds.length > 4) return null;
  const all = [...types];
  for (const meld2 of melds) {
    if (!meld2 || !["chi", "pon", "kan"].includes(meld2.type) || !Number.isInteger(meld2.tile) || meld2.tile < 0 || meld2.tile > 33) return null;
    if (meld2.type === "chi") {
      if (meld2.tile >= 27 || meld2.tile % 9 > 6) return null;
      all.push(meld2.tile, meld2.tile + 1, meld2.tile + 2);
    } else all.push(...Array(meld2.type === "kan" ? 4 : 3).fill(meld2.tile));
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
    const points2 = payments(han, fu, !!dealer, yakumanCount), yakuEntries = yakuman ? limits : entries;
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
      base: points2.ron,
      bonus: 0,
      total: points2.ron,
      points: points2,
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
var exhaustedSeats = (s) => s.walls.flatMap((w, seat2) => w.length ? [] : [seat2]);
var threshold = (s) => exhaustedSeats(s).length >= s.rules.exhaustLimit;
function indicators(s, ura = false) {
  if (ura && !s.rules.uraDora) return [];
  const offset = s.rules.deadWall ? 4 : 0;
  const indices = [];
  if (ura || s.rules.dora) indices.push(0);
  if (s.rules.kanDora) for (let i = 1; i <= s.kans; i++) indices.push(i);
  return indices.map((i) => typeOf(s.dead[offset + 2 * i + (ura ? 1 : 0)]));
}
var revealedUraIndicators = (s) => s.end === "win" && s.winners.some((seat2) => s.players[seat2].riichi) ? indicators(s, true) : [];
function context(s, seat2, method, id) {
  const p = s.players[seat2], ids = [...p.hand, ...p.melds.flatMap((m) => m.ids)];
  if (method === "ron") ids.push(id);
  return {
    method,
    winTile: typeOf(id),
    seatWind: 27 + (seat2 - s.dealer + 4) % 4,
    dealer: seat2 === s.dealer,
    riichi: p.riichi,
    doubleRiichi: p.doubleRiichi,
    ippatsu: p.ippatsu,
    rinshan: p.drawSource === "kan" && method === "tsumo",
    tenhou: method === "tsumo" && seat2 === s.dealer && s.draws === 1 && s.calls === 0,
    chiihou: method === "tsumo" && seat2 !== s.dealer && p.river.length === 0 && s.calls === 0 && p.drawSource === "wall",
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
  for (let n = 0; n < 13; n++) for (let seat2 = 0; seat2 < 4; seat2++) s.players[seat2].hand.push(w.shift());
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
function draw(s, seat2, kan = false) {
  if (!s.walls[seat2].length) throw new Error("Cannot draw from exhausted personal wall");
  const p = s.players[seat2], id = s.walls[seat2].shift();
  p.hand.push(id);
  p.hand.sort((a, b) => a - b);
  p.drawn = id;
  p.drawSource = kan ? "kan" : "wall";
  p.passLock = false;
  p.forbidden = [];
  s.turn = seat2;
  s.phase = "turn";
  s.reaction = null;
  s.draws++;
  event(s, { type: kan ? "kanDraw" : "draw", seat: seat2, id });
}
function nextDraw(s, source) {
  if (threshold(s)) {
    settleDraw(s);
    return;
  }
  for (let off = 1; off <= 4; off++) {
    const seat2 = (source + off) % 4;
    if (s.walls[seat2].length) {
      draw(s, seat2);
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
function win(s, seat2, method, source, id, { finish = true } = {}) {
  const p = s.players[seat2], tiles2 = handTypes(p);
  if (method === "ron") tiles2.push(typeOf(id));
  const score = scoreRiichi(tiles2, p.melds, context(s, seat2, method, id), s.rules);
  if (!score) throw new Error("Illegal riichi win");
  const first = s.ledger.length;
  const pao = p.pao && score.yakuman && score.yakuEntries.some((y) => y.id === p.pao.yaku) ? p.pao : null;
  if (pao) {
    const count = score.yakumanCount ?? 1, portion = score.points.ron / count;
    if (method === "tsumo") {
      transfer(s, pao.seat, seat2, portion, method);
      if (count > 1) {
        for (let from = 0; from < 4; from++) if (from !== seat2) {
          const amount = (from === s.dealer ? score.points.tsumoDealer : score.points.tsumoOther) * (count - 1) / count;
          transfer(s, from, seat2, amount, method);
        }
      }
    } else if (source === pao.seat) transfer(s, source, seat2, score.points.ron, method);
    else {
      transfer(s, pao.seat, seat2, portion / 2, method);
      transfer(s, source, seat2, score.points.ron - portion / 2, method);
    }
  } else if (method === "ron") transfer(s, source, seat2, score.points.ron, method);
  else for (let from = 0; from < 4; from++) if (from !== seat2) transfer(s, from, seat2, from === s.dealer ? score.points.tsumoDealer : score.points.tsumoOther, method);
  if (s.pot) transfer(s, "pot", seat2, s.pot, "pot");
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
  s.winners.push(seat2);
  event(s, { type: "win", seat: seat2, ...p.win });
  if (finish) end(s, "win");
}
function visibleCounts(s, seat2) {
  const out = Array(34).fill(0), add = (id) => out[typeOf(id)]++;
  for (let i = 0; i < 4; i++) {
    const p = s.players[i];
    for (const m of p.melds) for (const id of m.ids) add(id);
    for (const d of p.river) if (!d.claimed) add(d.id);
    if (i === seat2 || s.phase === "end" && p.won) for (const id of p.hand) add(id);
  }
  for (const t of indicators(s)) out[t]++;
  return out;
}
function settleDraw(s) {
  if (s.phase === "end" || !threshold(s)) throw new Error("Cannot settle this board");
  const ready = s.players.flatMap((p, seat2) => {
    const waits = shapeWaits(handTypes(p), p.melds, s.rules);
    return waits.length ? [{ seat: seat2, waits }] : [];
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
function canRon(s, seat2) {
  const p = s.players[seat2], r = s.reaction;
  if (!r || seat2 === r.source || p.passLock || p.riichiFuriten) return null;
  const waits = shapeWaits(handTypes(p), p.melds, s.rules);
  if (p.river.some((d) => waits.includes(typeOf(d.id)))) return null;
  return scoreRiichi([...handTypes(p), typeOf(r.id)], p.melds, context(s, seat2, "ron", r.id), s.rules);
}
function riichiAnkanAllowed(p, t, rules) {
  if (typeOf(p.drawn) !== t) return false;
  const tiles2 = handTypes(p), next = tiles2.filter((x) => x !== t), melds = [...p.melds, { type: "kan", tile: t, open: false }];
  if (!same(shapeWaits(next, melds, rules), p.riichiWaits)) return false;
  const before = [...tiles2];
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
function legalActions(s, seat2 = actor(s)) {
  if (seat2 === null || seat2 !== actor(s)) return [];
  const p = s.players[seat2], tiles2 = handTypes(p), c = counts(tiles2), out = [];
  if (s.phase === "turn") {
    if (p.drawn !== null && scoreRiichi(tiles2, p.melds, context(s, seat2, "tsumo", p.drawn), s.rules)) out.push({ type: "tsumo" });
    if (p.drawn !== null && s.walls[seat2].length && s.kans < s.rules.maxKans) {
      for (let t = 0; t < 34; t++) if (c[t] === 4 && (!p.riichi || riichiAnkanAllowed(p, t, s.rules))) out.push({ type: "ankan", tile: t });
      if (!p.riichi) p.melds.forEach((m, i) => {
        if (m.type === "pon" && c[m.tile]) out.push({ type: "kakan", meld: i });
      });
    }
    for (const id of p.hand) if (!p.forbidden.includes(typeOf(id)) && (!p.riichi || id === p.drawn)) {
      const tile2 = typeOf(id);
      out.push({ type: "discard", tile: tile2, id });
      if (!p.riichi && p.melds.every((m) => !m.open) && s.startingScores[seat2] + p.score >= 1e3 && remaining(s) >= 4 && s.walls[seat2].length && !threshold(s)) {
        const next = [...tiles2];
        next.splice(next.indexOf(tile2), 1);
        if (shapeWaits(next, p.melds, s.rules).length) out.push({ type: "riichi", tile: tile2, id });
      }
    }
  } else {
    const r = s.reaction, t = typeOf(r.id);
    if (canRon(s, seat2)) out.push({ type: "ron" });
    out.push({ type: "pass" });
    if (!p.riichi && r.kind === "discard" && !r.final && !s.pendingAbort && s.walls[seat2].length) {
      const candidates = [];
      if (c[t] >= 2) candidates.push({ type: "pon", tile: t });
      if (c[t] >= 3 && s.kans < s.rules.maxKans) candidates.push({ type: "minkan", tile: t });
      if (seat2 === (r.source + 1) % 4 && t < 27) for (let start = Math.max(Math.floor(t / 9) * 9, t - 2); start <= Math.min(Math.floor(t / 9) * 9 + 6, t); start++) {
        if ([start, start + 1, start + 2].filter((x) => x !== t).every((x) => c[x])) candidates.push({ type: "chi", tile: start });
      }
      for (const a of candidates) {
        if (a.type === "minkan") {
          out.push(a);
          continue;
        }
        const cc = [...c];
        for (const x of a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x2) => x2 !== t) : [t, t]) cc[x]--;
        if (cc.some((n, tile2) => n && !forbiddenForCall(a, t).includes(tile2))) out.push(a);
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
function completeKan(s, seat2, details = {}) {
  cancelIppatsu(s);
  s.kans++;
  s.calls++;
  event(s, { type: "kan", seat: seat2, ...details });
  if (s.rules.abortFourKans && s.kans === 4 && s.players.filter((p) => p.melds.some((m) => m.type === "kan")).length > 1) s.pendingAbort = "four-kans";
  draw(s, seat2, true);
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
  const { seat: seat2, action: a } = calls[0], p = s.players[seat2], t = typeOf(r.id);
  const ids = [...remove(p, a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x) => x !== t) : Array(a.type === "minkan" ? 3 : 2).fill(t)), r.id];
  s.players[r.source].river.at(-1).claimed = true;
  p.melds.push({ type: a.type === "chi" ? "chi" : a.type === "minkan" ? "kan" : "pon", tile: a.tile, open: true, from: r.source, ids });
  const open = p.melds.filter((m) => m.open && m.type !== "chi");
  const paoYaku = a.type !== "chi" && (t >= 31 && open.filter((m) => m.tile >= 31).length === 3 ? "bigThreeDragons" : t >= 27 && t < 31 && open.filter((m) => m.tile >= 27 && m.tile < 31).length === 4 ? "bigFourWinds" : null);
  if (paoYaku) p.pao = { seat: r.source, yaku: paoYaku };
  p.drawn = null;
  p.drawSource = null;
  p.forbidden = forbiddenForCall(a, t);
  s.turn = seat2;
  s.phase = "turn";
  s.reaction = null;
  event(s, { type: "call", seat: seat2, action: a, from: r.source, tileId: r.id, ids: [...ids] });
  if (a.type === "minkan") completeKan(s, seat2, { callType: "minkan", tileId: r.id, ids: [...ids], from: r.source });
}
function canonicalAction(s, seat2, action) {
  if (!action || typeof action !== "object") return null;
  const legal = legalActions(s, seat2);
  if (["discard", "riichi"].includes(action.type)) {
    const matching = legal.filter((a) => a.type === action.type && (action.tile === void 0 || a.tile === action.tile) && (action.id === void 0 || a.id === action.id));
    if (action.tile === void 0 && action.id === void 0) return null;
    return matching.find((a) => !RED_IDS.has(a.id)) ?? matching[0];
  }
  return legal.find((a) => same(a, action));
}
function step(s, seat2, action, { validate = true } = {}) {
  const a = canonicalAction(s, seat2, action);
  if (!a) throw new Error(`Illegal action by ${seat2}`);
  const p = s.players[seat2];
  const kakanId = a.type === "kakan" ? p.hand.find((id) => typeOf(id) === p.melds[a.meld].tile && !RED_IDS.has(id)) ?? p.hand.find((id) => typeOf(id) === p.melds[a.meld].tile) : null;
  event(s, { type: "action", seat: seat2, action: { ...a }, ...a.type === "kakan" ? { tileId: kakanId, meldIds: [...p.melds[a.meld].ids] } : {} });
  if (s.phase === "reaction") {
    const r = s.reaction;
    if (a.type !== "ron" && canRon(s, seat2)) {
      p.passLock = true;
      p.stats.ronDeclined++;
      if (p.riichi) p.riichiFuriten = true;
    }
    r.answers.push({ seat: seat2, action: { ...a } });
    r.pending.shift();
    if (!r.pending.length) resolve(s);
  } else if (a.type === "tsumo") win(s, seat2, "tsumo", seat2, p.drawn);
  else if (a.type === "discard" || a.type === "riichi") {
    p.hand.splice(p.hand.indexOf(a.id), 1);
    if (p.riichi) p.ippatsu = false;
    p.river.push({ id: a.id, claimed: false, riichi: a.type === "riichi" });
    p.drawn = null;
    p.drawSource = null;
    p.forbidden = [];
    reaction(s, seat2, a.id, "discard", { riichi: a.type === "riichi" });
  } else if (a.type === "ankan") {
    const ids = remove(p, Array(4).fill(a.tile));
    p.melds.push({ type: "kan", tile: a.tile, open: false, from: seat2, ids });
    p.stats.closedKans++;
    completeKan(s, seat2, { callType: "ankan", ids: [...ids] });
  } else if (a.type === "kakan") {
    cancelIppatsu(s);
    reaction(s, seat2, kakanId, "kakan", { meld: a.meld });
  }
  if (validate) assertInvariants(s);
  return s;
}
var tileView = (id, s, drawn = null) => ({ id, type: typeOf(id), tile: typeOf(id), red: red(id, s.rules), drawn: id === drawn });
var meldView = (m, s) => ({ ...structuredClone(m), tiles: m.ids.map((id) => tileView(id, s)) });
function publicEvents(s) {
  const out = [], discards = Array(4).fill(null), pendingKan = Array(4).fill(null), melds = Array.from({ length: 4 }, () => []);
  const physical = (id) => Number.isInteger(id) && id >= 0 && id < 136 ? id : null;
  const preview = (seat2, index, tile2, callType) => {
    const count = ["ankan", "kakan", "minkan"].includes(callType) ? 4 : 3;
    const ids = s.players[seat2]?.melds[index]?.ids?.slice(0, count);
    if (ids?.length === count) return ids.map((id) => ({ type: typeOf(id), red: red(id, s.rules) })).sort((a, b) => a.type - b.type);
    const types = callType === "chi" ? [tile2, tile2 + 1, tile2 + 2] : Array(count).fill(tile2);
    return types.filter((type) => Number.isInteger(type) && type >= 0 && type < 34).map((type) => ({ type, red: false }));
  };
  const emit = (raw, kind, { tile: tile2 = null, tileId = null, source = null, callType = null, method = null, tiles: tiles2 } = {}) => {
    const id = physical(tileId), type = id === null ? tile2 : typeOf(id);
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
    if (tiles2?.length) item.tiles = tiles2;
    out.push(item);
    return item;
  };
  for (const raw of s.events ?? []) {
    if (!Number.isSafeInteger(raw.n) || raw.n < 0 || !Number.isInteger(raw.seat) || raw.seat < 0 || raw.seat > 3) continue;
    const seat2 = raw.seat, a = raw.action;
    if (raw.type === "action") {
      if (a?.type === "discard" || a?.type === "riichi") discards[seat2] = emit(raw, "discard", { tile: a.tile, tileId: a.id });
      else if (a?.type === "ankan") pendingKan[seat2] = { tile: a.tile, callType: "ankan", index: melds[seat2].length };
      else if (a?.type === "kakan") pendingKan[seat2] = { tile: melds[seat2][a.meld]?.tile ?? null, callType: "kakan", index: a.meld };
    } else if (raw.type === "call" && ["chi", "pon", "minkan"].includes(a?.type)) {
      const source = Number.isInteger(raw.from) && raw.from >= 0 && raw.from < 4 ? raw.from : null;
      const discard = source === null ? null : discards[source], index = melds[seat2].length;
      melds[seat2].push({ tile: a.tile, type: a.type });
      if (a.type === "minkan") pendingKan[seat2] = { tile: a.tile, tileId: discard?.tileId ?? null, source, callType: "minkan", index };
      else emit(raw, "call", {
        tile: discard?.tile ?? a.tile,
        tileId: discard?.tileId ?? null,
        source,
        callType: a.type,
        tiles: preview(seat2, index, a.tile, a.type)
      });
    } else if (raw.type === "kan") {
      const accepted = pendingKan[seat2];
      if (!accepted) continue;
      const { tile: tile2, source = null, callType, index } = accepted, ids = s.players[seat2]?.melds[index]?.ids ?? [];
      let tileId = accepted.tileId ?? null;
      if (callType === "kakan") tileId = ids[3] ?? null;
      else if (callType === "ankan") tileId = ids.find((id) => red(id, s.rules)) ?? ids[0] ?? null;
      emit(raw, "kan", { tile: tile2, tileId, source, callType, tiles: preview(seat2, index, tile2, callType) });
      if (callType === "ankan") melds[seat2].push({ tile: tile2, type: "ankan" });
      else if (melds[seat2][index]) melds[seat2][index].type = callType;
      pendingKan[seat2] = null;
    } else if (raw.type === "riichi") {
      const discard = discards[seat2];
      emit(raw, "riichi", { tile: discard?.tile ?? null, tileId: discard?.tileId ?? null });
    } else if (raw.type === "win") emit(raw, "win", {
      tileId: raw.tile,
      source: raw.method === "ron" ? raw.source : null,
      method: raw.method
    });
  }
  return out.slice(-32);
}
function snapshot(s, seat2) {
  if (!Number.isInteger(seat2) || seat2 < 0 || seat2 > 3) throw new Error("Invalid seat");
  const p = s.players[seat2];
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
    seat: seat2,
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
    legalActions: legalActions(s, seat2),
    doraIndicators: indicators(s),
    uraIndicators: revealedUraIndicators(s),
    wallRemaining: remaining(s),
    ownWallRemaining: s.walls[seat2].length,
    exhaustedSeats: exhaustedSeats(s),
    draws: s.draws,
    kans: s.kans,
    pot: s.pot,
    winners: [...s.winners],
    riichi: p.riichi,
    visible: visibleCounts(s, seat2),
    publicEvents: publicEvents(s),
    lastDiscard: s.reaction ? { seat: s.reaction.source, ...tileView(s.reaction.id, s), kind: s.reaction.kind, final: s.reaction.final } : null,
    readySeats: s.phase === "end" ? s.events.findLast((e) => e.type === "drawSettlement")?.ready.map((p2) => p2.seat) ?? [] : []
  };
}
function observation(s, seat2 = actor(s)) {
  if (seat2 !== actor(s)) throw new Error("Not this player\u2019s decision");
  return snapshot(s, seat2);
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
  for (let seat2 = 0; seat2 < 4; seat2++) {
    const p = s.players[seat2], extra = s.phase === "turn" && s.turn === seat2 || s.phase === "reaction" && s.reaction.kind === "kakan" && s.reaction.source === seat2 || p.win?.method === "tsumo";
    if (p.hand.length + 3 * p.melds.length !== (extra ? 14 : 13)) throw new Error(`Hand size violated seat ${seat2}`);
    for (const m of p.melds) {
      const wanted = m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : Array(m.type === "kan" ? 4 : 3).fill(m.tile);
      if (!same(m.ids.map(typeOf).sort((a, b) => a - b), wanted)) throw new Error("Illegal meld");
    }
    const st = p.stats;
    if (p.score !== st.winReceipt + st.drawGain - st.dealInLoss - st.tsumoPaid - st.drawLoss - st.riichiPaid) throw new Error("Ledger attribution violated");
  }
  if (s.dead.length !== reservedTileCount(s.rules) || s.kans > s.rules.maxKans || s.winners.length > (s.rules.multipleRon === "all" ? 3 : 1) || s.winners.length !== s.players.filter((p) => p.won).length || new Set(s.winners).size !== s.winners.length) throw new Error("Round invariant violated");
  if (s.winners.length > 1 && s.winners.some((seat2) => {
    const w = s.players[seat2].win, f = s.players[s.winners[0]].win;
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
var exhaustedSeats2 = (s) => s.walls.flatMap((w, seat2) => w.length ? [] : [seat2]);
function indicators2(s, ura = false) {
  if (ura && !s.rules.uraDora) return [];
  const offset = s.rules.deadWall ? 4 : 0;
  const indices = [];
  if (ura || s.rules.dora) indices.push(0);
  if (s.rules.kanDora) for (let i = 1; i <= s.kans; i++) indices.push(i);
  return indices.map((i) => typeOf(s.dead[offset + 2 * i + (ura ? 1 : 0)]));
}
var revealedUraIndicators2 = (s) => s.end === "win" && s.winners.some((seat2) => s.players[seat2].riichi) ? indicators2(s, true) : [];
function context2(s, seat2, method, id) {
  const p = s.players[seat2], ids = [...p.hand, ...p.melds.flatMap((m) => m.ids)];
  if (method === "ron") ids.push(id);
  return {
    method,
    winTile: typeOf(id),
    seatWind: 27 + (seat2 - s.dealer + 4) % 4,
    dealer: seat2 === s.dealer,
    riichi: p.riichi,
    doubleRiichi: p.doubleRiichi,
    ippatsu: p.ippatsu,
    rinshan: p.drawSource === "kan" && method === "tsumo",
    tenhou: method === "tsumo" && seat2 === s.dealer && s.draws === 1 && s.calls === 0,
    chiihou: method === "tsumo" && seat2 !== s.dealer && p.river.length === 0 && s.calls === 0 && p.drawSource === "wall",
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
  for (let n = 0; n < 13; n++) for (let seat2 = 0; seat2 < 4; seat2++) s.players[seat2].hand.push(w.shift());
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
function receiveTurn(s, seat2, via) {
  s.turn = seat2;
  s.phase = "turn";
  s.reaction = null;
  if (!s.milLastTurn && !s.walls[(seat2 + 1) % 4].length) s.milLastTurn = { seat: seat2, via };
}
function draw2(s, seat2, kan = false) {
  if (!s.walls[seat2].length) throw new Error("Cannot draw from exhausted personal wall");
  const p = s.players[seat2], id = s.walls[seat2].shift();
  p.hand.push(id);
  p.hand.sort((a, b) => a - b);
  p.drawn = id;
  p.drawSource = kan ? "kan" : "wall";
  p.passLock = false;
  p.forbidden = [];
  receiveTurn(s, seat2, kan ? "kan" : "draw");
  s.draws++;
  event2(s, { type: kan ? "kanDraw" : "draw", seat: seat2, id });
}
function nextDraw2(s, source) {
  const seat2 = (source + 1) % 4;
  if (!s.walls[seat2].length) {
    settleDraw2(s);
    return;
  }
  draw2(s, seat2);
}
function end2(s, reason) {
  s.end = reason;
  s.phase = "end";
  s.reaction = null;
  event2(s, { type: "end", reason });
}
function win2(s, seat2, method, source, id, { finish = true } = {}) {
  const p = s.players[seat2], tiles2 = handTypes2(p);
  if (method === "ron") tiles2.push(typeOf(id));
  const score = scoreRiichi(tiles2, p.melds, context2(s, seat2, method, id), s.rules);
  if (!score) throw new Error("Illegal riichi win");
  const first = s.ledger.length;
  const pao = p.pao && score.yakuman && score.yakuEntries.some((y) => y.id === p.pao.yaku) ? p.pao : null;
  if (pao) {
    const count = score.yakumanCount ?? 1, portion = score.points.ron / count;
    if (method === "tsumo") {
      transfer2(s, pao.seat, seat2, portion, method);
      if (count > 1) {
        for (let from = 0; from < 4; from++) if (from !== seat2) {
          const amount = (from === s.dealer ? score.points.tsumoDealer : score.points.tsumoOther) * (count - 1) / count;
          transfer2(s, from, seat2, amount, method);
        }
      }
    } else if (source === pao.seat) transfer2(s, source, seat2, score.points.ron, method);
    else {
      transfer2(s, pao.seat, seat2, portion / 2, method);
      transfer2(s, source, seat2, score.points.ron - portion / 2, method);
    }
  } else if (method === "ron") transfer2(s, source, seat2, score.points.ron, method);
  else for (let from = 0; from < 4; from++) if (from !== seat2) transfer2(s, from, seat2, from === s.dealer ? score.points.tsumoDealer : score.points.tsumoOther, method);
  if (s.pot) transfer2(s, "pot", seat2, s.pot, "pot");
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
  s.winners.push(seat2);
  event2(s, { type: "win", seat: seat2, ...p.win });
  if (finish) end2(s, "win");
}
function visibleCounts2(s, seat2) {
  const out = Array(34).fill(0), add = (id) => out[typeOf(id)]++;
  for (let i = 0; i < 4; i++) {
    const p = s.players[i];
    for (const m of p.melds) for (const id of m.ids) add(id);
    for (const d of p.river) if (!d.claimed) add(d.id);
    if (i === seat2 || s.phase === "end" && p.won) for (const id of p.hand) add(id);
  }
  for (const t of indicators2(s)) out[t]++;
  return out;
}
function settleDraw2(s) {
  const r = s.reaction;
  if (s.phase !== "reaction" || !s.milLastTurn || !r || r.kind !== "discard" || !r.final || r.source !== s.milLastTurn.seat || r.pending.length || r.answers.length !== 3 || r.answers.some((answer) => answer.action.type === "ron")) throw new Error("Cannot settle this board");
  const ready = s.players.flatMap((p, seat2) => {
    const waits = shapeWaits(handTypes2(p), p.melds, s.rules);
    return waits.length ? [{ seat: seat2, waits }] : [];
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
function canRon2(s, seat2) {
  const p = s.players[seat2], r = s.reaction;
  if (!r || seat2 === r.source || p.passLock || p.riichiFuriten) return null;
  const waits = shapeWaits(handTypes2(p), p.melds, s.rules);
  if (p.river.some((d) => waits.includes(typeOf(d.id)))) return null;
  return scoreRiichi([...handTypes2(p), typeOf(r.id)], p.melds, context2(s, seat2, "ron", r.id), s.rules);
}
function riichiAnkanAllowed2(p, t, rules) {
  if (typeOf(p.drawn) !== t) return false;
  const tiles2 = handTypes2(p), next = tiles2.filter((x) => x !== t), melds = [...p.melds, { type: "kan", tile: t, open: false }];
  if (!same2(shapeWaits(next, melds, rules), p.riichiWaits)) return false;
  const before = [...tiles2];
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
function legalActions2(s, seat2 = actor2(s)) {
  if (seat2 === null || seat2 !== actor2(s)) return [];
  const p = s.players[seat2], tiles2 = handTypes2(p), c = counts(tiles2), out = [];
  if (s.phase === "turn") {
    if (p.drawn !== null && scoreRiichi(tiles2, p.melds, context2(s, seat2, "tsumo", p.drawn), s.rules)) out.push({ type: "tsumo" });
    if (!s.milLastTurn && p.drawn !== null && s.walls[seat2].length && s.kans < s.rules.maxKans) {
      for (let t = 0; t < 34; t++) if (c[t] === 4 && (!p.riichi || riichiAnkanAllowed2(p, t, s.rules))) out.push({ type: "ankan", tile: t });
      if (!p.riichi) p.melds.forEach((m, i) => {
        if (m.type === "pon" && c[m.tile]) out.push({ type: "kakan", meld: i });
      });
    }
    for (const id of p.hand) if (!p.forbidden.includes(typeOf(id)) && (!p.riichi || id === p.drawn)) {
      const tile2 = typeOf(id);
      out.push({ type: "discard", tile: tile2, id });
      if (!p.riichi && p.melds.every((m) => !m.open) && s.startingScores[seat2] + p.score >= 1e3 && remaining2(s) >= 4 && s.walls[seat2].length && !s.milLastTurn) {
        const next = [...tiles2];
        next.splice(next.indexOf(tile2), 1);
        if (shapeWaits(next, p.melds, s.rules).length) out.push({ type: "riichi", tile: tile2, id });
      }
    }
  } else {
    const r = s.reaction, t = typeOf(r.id);
    if (canRon2(s, seat2)) out.push({ type: "ron" });
    out.push({ type: "pass" });
    if (!p.riichi && r.kind === "discard" && !r.final && !s.pendingAbort) {
      const candidates = [];
      if (c[t] >= 2) candidates.push({ type: "pon", tile: t });
      if (c[t] >= 3 && s.walls[seat2].length && s.kans < s.rules.maxKans) candidates.push({ type: "minkan", tile: t });
      if (seat2 === (r.source + 1) % 4 && t < 27) for (let start = Math.max(Math.floor(t / 9) * 9, t - 2); start <= Math.min(Math.floor(t / 9) * 9 + 6, t); start++) {
        if ([start, start + 1, start + 2].filter((x) => x !== t).every((x) => c[x])) candidates.push({ type: "chi", tile: start });
      }
      for (const a of candidates) {
        if (a.type === "minkan") {
          out.push(a);
          continue;
        }
        const cc = [...c];
        for (const x of a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x2) => x2 !== t) : [t, t]) cc[x]--;
        if (cc.some((n, tile2) => n && !forbiddenForCall2(a, t).includes(tile2))) out.push(a);
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
function completeKan2(s, seat2, details = {}) {
  cancelIppatsu2(s);
  s.kans++;
  s.calls++;
  event2(s, { type: "kan", seat: seat2, ...details });
  if (s.rules.abortFourKans && s.kans === 4 && s.players.filter((p) => p.melds.some((m) => m.type === "kan")).length > 1) s.pendingAbort = "four-kans";
  draw2(s, seat2, true);
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
  const { seat: seat2, action: a } = calls[0], p = s.players[seat2], t = typeOf(r.id);
  const ids = [...remove2(p, a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x) => x !== t) : Array(a.type === "minkan" ? 3 : 2).fill(t)), r.id];
  s.players[r.source].river.at(-1).claimed = true;
  p.melds.push({ type: a.type === "chi" ? "chi" : a.type === "minkan" ? "kan" : "pon", tile: a.tile, open: true, from: r.source, ids });
  const open = p.melds.filter((m) => m.open && m.type !== "chi");
  const paoYaku = a.type !== "chi" && (t >= 31 && open.filter((m) => m.tile >= 31).length === 3 ? "bigThreeDragons" : t >= 27 && t < 31 && open.filter((m) => m.tile >= 27 && m.tile < 31).length === 4 ? "bigFourWinds" : null);
  if (paoYaku) p.pao = { seat: r.source, yaku: paoYaku };
  p.drawn = null;
  p.drawSource = null;
  p.forbidden = forbiddenForCall2(a, t);
  receiveTurn(s, seat2, a.type);
  event2(s, { type: "call", seat: seat2, action: a, from: r.source, tileId: r.id, ids: [...ids] });
  if (a.type === "minkan") completeKan2(s, seat2, { callType: "minkan", tileId: r.id, ids: [...ids], from: r.source });
}
function canonicalAction2(s, seat2, action) {
  if (!action || typeof action !== "object") return null;
  const legal = legalActions2(s, seat2);
  if (["discard", "riichi"].includes(action.type)) {
    const matching = legal.filter((a) => a.type === action.type && (action.tile === void 0 || a.tile === action.tile) && (action.id === void 0 || a.id === action.id));
    if (action.tile === void 0 && action.id === void 0) return null;
    return matching.find((a) => !RED_IDS2.has(a.id)) ?? matching[0];
  }
  return legal.find((a) => same2(a, action));
}
function step2(s, seat2, action, { validate = true } = {}) {
  const a = canonicalAction2(s, seat2, action);
  if (!a) throw new Error(`Illegal action by ${seat2}`);
  const p = s.players[seat2];
  const kakanId = a.type === "kakan" ? p.hand.find((id) => typeOf(id) === p.melds[a.meld].tile && !RED_IDS2.has(id)) ?? p.hand.find((id) => typeOf(id) === p.melds[a.meld].tile) : null;
  event2(s, { type: "action", seat: seat2, action: { ...a }, ...a.type === "kakan" ? { tileId: kakanId, meldIds: [...p.melds[a.meld].ids] } : {} });
  if (s.phase === "reaction") {
    const r = s.reaction;
    if (a.type !== "ron" && canRon2(s, seat2)) {
      p.passLock = true;
      p.stats.ronDeclined++;
      if (p.riichi) p.riichiFuriten = true;
    }
    r.answers.push({ seat: seat2, action: { ...a } });
    r.pending.shift();
    if (!r.pending.length) resolve2(s);
  } else if (a.type === "tsumo") win2(s, seat2, "tsumo", seat2, p.drawn);
  else if (a.type === "discard" || a.type === "riichi") {
    p.hand.splice(p.hand.indexOf(a.id), 1);
    if (p.riichi) p.ippatsu = false;
    p.river.push({ id: a.id, claimed: false, riichi: a.type === "riichi" });
    p.drawn = null;
    p.drawSource = null;
    p.forbidden = [];
    reaction2(s, seat2, a.id, "discard", { riichi: a.type === "riichi" });
  } else if (a.type === "ankan") {
    const ids = remove2(p, Array(4).fill(a.tile));
    p.melds.push({ type: "kan", tile: a.tile, open: false, from: seat2, ids });
    p.stats.closedKans++;
    completeKan2(s, seat2, { callType: "ankan", ids: [...ids] });
  } else if (a.type === "kakan") {
    cancelIppatsu2(s);
    reaction2(s, seat2, kakanId, "kakan", { meld: a.meld });
  }
  if (validate) assertInvariants2(s);
  return s;
}
var tileView2 = (id, s, drawn = null) => ({ id, type: typeOf(id), tile: typeOf(id), red: red2(id, s.rules), drawn: id === drawn });
var meldView2 = (m, s) => ({ ...structuredClone(m), tiles: m.ids.map((id) => tileView2(id, s)) });
function publicEvents2(s) {
  const out = [], discards = Array(4).fill(null), pendingKan = Array(4).fill(null), melds = Array.from({ length: 4 }, () => []);
  const physical = (id) => Number.isInteger(id) && id >= 0 && id < 136 ? id : null;
  const preview = (seat2, index, tile2, callType) => {
    const count = ["ankan", "kakan", "minkan"].includes(callType) ? 4 : 3;
    const ids = s.players[seat2]?.melds[index]?.ids?.slice(0, count);
    if (ids?.length === count) return ids.map((id) => ({ type: typeOf(id), red: red2(id, s.rules) })).sort((a, b) => a.type - b.type);
    const types = callType === "chi" ? [tile2, tile2 + 1, tile2 + 2] : Array(count).fill(tile2);
    return types.filter((type) => Number.isInteger(type) && type >= 0 && type < 34).map((type) => ({ type, red: false }));
  };
  const emit = (raw, kind, { tile: tile2 = null, tileId = null, source = null, callType = null, method = null, tiles: tiles2 } = {}) => {
    const id = physical(tileId), type = id === null ? tile2 : typeOf(id);
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
    if (tiles2?.length) item.tiles = tiles2;
    out.push(item);
    return item;
  };
  for (const raw of s.events ?? []) {
    if (!Number.isSafeInteger(raw.n) || raw.n < 0 || !Number.isInteger(raw.seat) || raw.seat < 0 || raw.seat > 3) continue;
    const seat2 = raw.seat, a = raw.action;
    if (raw.type === "action") {
      if (a?.type === "discard" || a?.type === "riichi") discards[seat2] = emit(raw, "discard", { tile: a.tile, tileId: a.id });
      else if (a?.type === "ankan") pendingKan[seat2] = { tile: a.tile, callType: "ankan", index: melds[seat2].length };
      else if (a?.type === "kakan") pendingKan[seat2] = { tile: melds[seat2][a.meld]?.tile ?? null, callType: "kakan", index: a.meld };
    } else if (raw.type === "call" && ["chi", "pon", "minkan"].includes(a?.type)) {
      const source = Number.isInteger(raw.from) && raw.from >= 0 && raw.from < 4 ? raw.from : null;
      const discard = source === null ? null : discards[source], index = melds[seat2].length;
      melds[seat2].push({ tile: a.tile, type: a.type });
      if (a.type === "minkan") pendingKan[seat2] = { tile: a.tile, tileId: discard?.tileId ?? null, source, callType: "minkan", index };
      else emit(raw, "call", {
        tile: discard?.tile ?? a.tile,
        tileId: discard?.tileId ?? null,
        source,
        callType: a.type,
        tiles: preview(seat2, index, a.tile, a.type)
      });
    } else if (raw.type === "kan") {
      const accepted = pendingKan[seat2];
      if (!accepted) continue;
      const { tile: tile2, source = null, callType, index } = accepted, ids = s.players[seat2]?.melds[index]?.ids ?? [];
      let tileId = accepted.tileId ?? null;
      if (callType === "kakan") tileId = ids[3] ?? null;
      else if (callType === "ankan") tileId = ids.find((id) => red2(id, s.rules)) ?? ids[0] ?? null;
      emit(raw, "kan", { tile: tile2, tileId, source, callType, tiles: preview(seat2, index, tile2, callType) });
      if (callType === "ankan") melds[seat2].push({ tile: tile2, type: "ankan" });
      else if (melds[seat2][index]) melds[seat2][index].type = callType;
      pendingKan[seat2] = null;
    } else if (raw.type === "riichi") {
      const discard = discards[seat2];
      emit(raw, "riichi", { tile: discard?.tile ?? null, tileId: discard?.tileId ?? null });
    } else if (raw.type === "win") emit(raw, "win", {
      tileId: raw.tile,
      source: raw.method === "ron" ? raw.source : null,
      method: raw.method
    });
  }
  return out.slice(-32);
}
function snapshot2(s, seat2) {
  if (!Number.isInteger(seat2) || seat2 < 0 || seat2 > 3) throw new Error("Invalid seat");
  const p = s.players[seat2];
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
    seat: seat2,
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
    legalActions: legalActions2(s, seat2),
    doraIndicators: indicators2(s),
    uraIndicators: revealedUraIndicators2(s),
    wallRemaining: remaining2(s),
    ownWallRemaining: s.walls[seat2].length,
    exhaustedSeats: exhaustedSeats2(s),
    draws: s.draws,
    kans: s.kans,
    pot: s.pot,
    winners: [...s.winners],
    riichi: p.riichi,
    visible: visibleCounts2(s, seat2),
    publicEvents: publicEvents2(s),
    lastDiscard: s.reaction ? { seat: s.reaction.source, ...tileView2(s.reaction.id, s), kind: s.reaction.kind, final: s.reaction.final } : null,
    readySeats: s.phase === "end" ? s.events.findLast((e) => e.type === "drawSettlement")?.ready.map((p2) => p2.seat) ?? [] : []
  };
}
function observation2(s, seat2 = actor2(s)) {
  if (seat2 !== actor2(s)) throw new Error("Not this player\u2019s decision");
  return snapshot2(s, seat2);
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
  for (let seat2 = 0; seat2 < 4; seat2++) {
    const p = s.players[seat2], extra = s.phase === "turn" && s.turn === seat2 || s.phase === "reaction" && s.reaction.kind === "kakan" && s.reaction.source === seat2 || p.win?.method === "tsumo";
    if (p.hand.length + 3 * p.melds.length !== (extra ? 14 : 13)) throw new Error(`Hand size violated seat ${seat2}`);
    for (const m of p.melds) {
      const wanted = m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : Array(m.type === "kan" ? 4 : 3).fill(m.tile);
      if (!same2(m.ids.map(typeOf).sort((a, b) => a - b), wanted)) throw new Error("Illegal meld");
    }
    const st = p.stats;
    if (p.score !== st.winReceipt + st.drawGain - st.dealInLoss - st.tsumoPaid - st.drawLoss - st.riichiPaid) throw new Error("Ledger attribution violated");
  }
  if (s.dead.length !== reservedTileCount(s.rules) || s.kans > s.rules.maxKans || s.winners.length > (s.rules.multipleRon === "all" ? 3 : 1) || s.winners.length !== s.players.filter((p) => p.won).length || new Set(s.winners).size !== s.winners.length) throw new Error("Round invariant violated");
  if (s.winners.length > 1 && s.winners.some((seat2) => {
    const w = s.players[seat2].win, f = s.players[s.winners[0]].win;
    return w.method !== "ron" || w.source !== f.source || w.tile !== f.tile;
  })) throw new Error("Multiple ron invariant violated");
  return true;
}

// duplicate/shared/shanten.mjs
var pow5 = Array.from({ length: 9 }, (_, i) => 5 ** i);

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
var legalActions3 = (game, seat2 = actor3(game)) => engineFor(game).legalActions(game, seat2);
var assertInvariants3 = (game) => engineFor(game).assertInvariants(game);
var publicEvents3 = (game) => engineFor(game).publicEvents(game);
function addHonba(game) {
  const honba = honbaOf(game), seat2 = game.winners[0];
  if (!honba || seat2 === void 0) return;
  const winner = game.players[seat2], win3 = winner.win, amount = honba * 300;
  if (!Number.isSafeInteger(amount)) throw new Error("Honba payment exceeds the supported range");
  const moves = win3.pao ? [{ from: win3.pao.seat, to: seat2, amount, kind: win3.method, honba: true }] : win3.method === "ron" ? [{ from: win3.source, to: seat2, amount, kind: "ron", honba: true }] : [0, 1, 2, 3].filter((from) => from !== seat2).map((from) => ({ from, to: seat2, amount: honba * 100, kind: "tsumo", honba: true }));
  const scores = game.players.map((p) => p.score), stats = game.players.map((p) => ({ ...p.stats }));
  for (const move of moves) {
    scores[move.from] -= move.amount;
    scores[seat2] += move.amount;
    stats[move.from][move.kind === "ron" ? "dealInLoss" : "tsumoPaid"] += move.amount;
    stats[seat2].winReceipt += move.amount;
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
  const event3 = game.events.findLast((event4) => event4.type === "win" && event4.seat === seat2);
  if (event3) Object.assign(event3, { payments: structuredClone(win3.payments), receipt: win3.receipt, honba, honbaReceipt: amount });
}
function step3(game, seat2, action, options = {}) {
  const engine = engineFor(game);
  const honba = honbaOf(game);
  if (!Number.isSafeInteger(honba * 300)) throw new Error("Honba payment exceeds the supported range");
  const prior = game.winners.length;
  const couldWin = honba > 0 && (game.phase === "turn" && action?.type === "tsumo" || game.phase === "reaction" && game.reaction.pending.length === 1 && (action?.type === "ron" || game.reaction.answers.some((answer) => answer.action.type === "ron")));
  if (couldWin) {
    const next = structuredClone(game);
    engine.step(next, seat2, action, options);
    if (prior === 0 && next.winners.length) addHonba(next);
    if (options.validate !== false) engine.assertInvariants(next);
    Object.assign(game, next);
    return game;
  }
  engine.step(game, seat2, action, options);
  return game;
}
function snapshot3(game, seat2) {
  return { ...engineFor(game).snapshot(game, seat2), honba: honbaOf(game), duplicateProfile: normalizeDuplicateProfile(game.duplicateProfile) };
}

// duplicate/match.mjs
var defaults = Object.freeze({ format: "hanchan", dealerContinuation: true, agariYame: false });
var positive = (n) => Number.isSafeInteger(n) && n >= 1;
var uint32 = (n) => Number.isInteger(n) && n >= 0 && n <= 4294967295;
function normalizeMatchRules(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("Invalid match rules");
  for (const key of Object.keys(options)) if (!Object.hasOwn(defaults, key)) throw new Error(`Unknown match rule: ${key}`);
  const rules = { ...defaults, ...options };
  if (!["east", "hanchan"].includes(rules.format) || typeof rules.dealerContinuation !== "boolean" || typeof rules.agariYame !== "boolean") throw new Error("Invalid match rules");
  return rules;
}
function matchBoardCount(config = {}) {
  return normalizeMatchRules(config).format === "east" ? 4 : 8;
}
function handId({ board, honba = 0 }) {
  if (!positive(board) || !uint32(honba)) throw new Error("Invalid hand identity");
  return `${board}:${honba}`;
}

// duplicate/replay-core.mjs
var ENGINE_REPLAY_SCHEMA = "duplicate-engine-replay-v1";
var FRAME_REPLAY_SCHEMA = "duplicate-frame-replay-v1";
var REPLAY_LIMITS = Object.freeze({ bytes: 32 * 1024 * 1024, actions: 2048, frames: 2049 });
var roles = /* @__PURE__ */ new Set(["private", "participant", "viewer", "caster"]);
var kinds = /* @__PURE__ */ new Set(["discard", "call", "kan", "riichi", "win"]);
var object = (v) => v && typeof v === "object" && !Array.isArray(v);
var integer = Number.isSafeInteger;
var clone = (v) => structuredClone(v);
var sort = (v) => Array.isArray(v) ? v.map(sort) : object(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v;
var canonical = (v) => JSON.stringify(sort(v));
var equal = (a, b) => canonical(a) === canonical(b);
var ReplayError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "ReplayError";
  }
};
var require2 = (condition, message = "\uC7AC\uC0DD \uD30C\uC77C \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.") => {
  if (!condition) throw new ReplayError(message);
};
var keys = (v, allowed) => {
  require2(object(v));
  require2(Object.keys(v).every((k) => allowed.includes(k)), "\uC7AC\uC0DD \uD30C\uC77C\uC5D0 \uD5C8\uC6A9\uB418\uC9C0 \uC54A\uC740 \uC815\uBCF4\uAC00 \uC788\uC2B5\uB2C8\uB2E4.");
};
var seat = (v) => {
  require2(integer(v) && v >= 0 && v < 4, "\uC7AC\uC0DD \uC88C\uC11D\uC744 \uD655\uC778\uD558\uC138\uC694.");
  return v;
};
var number = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  require2(integer(v) && v >= min && v <= max);
  return v;
};
var text = (v, max = 160) => {
  require2(typeof v === "string" && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v));
  return v;
};
var optional = (target, source, name, read) => {
  if (source[name] !== void 0 && source[name] !== null) target[name] = read(source[name]);
};
var point = (v) => number(v, -Number.MAX_SAFE_INTEGER);
var points = (v) => {
  require2(Array.isArray(v) && v.length === 4);
  return v.map(point);
};
function identitySource(value = {}) {
  keys(value, ["kind", "mode", "code", "tableId", "handId", "matchId", "id", "aiPolicy", "aiModelSha256", "board", "honba", "handNumber"]);
  const result = {};
  for (const key of Object.keys(value)) if (value[key] !== null && value[key] !== void 0) result[key] = ["board", "handNumber"].includes(key) ? number(value[key], 1) : key === "honba" ? number(value[key]) : text(value[key]);
  return result;
}
function contextOf(value = {}) {
  keys(value, ["mode", "seriesId", "label", "code", "tableId", "duplicateProfile", "board", "honba", "repeat", "handNumber", "handId", "boardCount", "matchRules", "scoring", "roundWind", "dealer", "pot", "initialPot", "startingScores"]);
  const result = {};
  for (const key of ["mode", "seriesId", "label", "code", "tableId"]) optional(result, value, key, (v) => text(v, key === "label" ? 200 : 160));
  optional(result, value, "duplicateProfile", normalizeDuplicateProfile);
  for (const key of ["board", "handNumber", "boardCount"]) optional(result, value, key, (v) => number(v, 1, key === "boardCount" || key === "board" ? 16 : Number.MAX_SAFE_INTEGER));
  for (const key of ["honba", "repeat", "pot", "initialPot"]) optional(result, value, key, number);
  optional(result, value, "roundWind", (v) => number(v, 27, 30));
  optional(result, value, "dealer", seat);
  optional(result, value, "startingScores", points);
  if (value.matchRules !== void 0) result.matchRules = value.matchRules === null ? null : normalizeMatchRules(value.matchRules);
  if (value.scoring !== void 0) {
    keys(value.scoring, ["method", "impUnit"]);
    require2(["raw", "imp"].includes(value.scoring.method) && [100, 1e3].includes(value.scoring.impUnit));
    result.scoring = clone(value.scoring);
  }
  optional(result, value, "handId", (v) => text(v, 40));
  if (result.board !== void 0) {
    const id = handId({ board: result.board, honba: result.honba ?? 0 });
    require2(!result.handId || result.handId === id, "\uAD6D\xB7\uBCF8\uC7A5\uACFC \uC7AC\uC0DD \uAE30\uB85D \uBC88\uD638\uAC00 \uB2E4\uB985\uB2C8\uB2E4.");
    result.handId = id;
  }
  return result;
}
function membersOf(value = []) {
  require2(Array.isArray(value) && value.length <= 4);
  const seen = /* @__PURE__ */ new Set();
  return value.map((member) => {
    keys(member, ["id", "name", "seat", "ai"]);
    const s = seat(member.seat);
    require2(!seen.has(s));
    seen.add(s);
    const result = { seat: s, name: text(member.name, 80), ai: member.ai === true };
    optional(result, member, "id", (v) => text(v));
    return result;
  });
}
function tile(value) {
  require2(object(value));
  const type = value.type ?? value.tile;
  number(type, 0, 33);
  const result = { type, tile: type, red: value.red === true };
  optional(result, value, "id", (v) => {
    number(v, 0, 135);
    require2(Math.floor(v / 4) === type);
    return v;
  });
  if (value.drawn !== void 0) result.drawn = value.drawn === true;
  return result;
}
function tiles(value) {
  require2(Array.isArray(value) && value.length <= 18);
  return value.map(tile);
}
function meld(value) {
  require2(object(value) && ["chi", "pon", "kan"].includes(value.type));
  const result = { type: value.type, tile: number(value.tile, 0, 33), open: value.open === true };
  optional(result, value, "from", seat);
  if (value.tiles) result.tiles = tiles(value.tiles);
  else if (value.ids) {
    require2(Array.isArray(value.ids) && value.ids.length <= 4);
    result.tiles = value.ids.map((id) => tile({ id, type: Math.floor(id / 4), red: false }));
  } else result.tiles = [];
  return result;
}
function publicEvent(value) {
  require2(object(value) && kinds.has(value.kind));
  const result = { id: number(value.id), kind: value.kind, seat: seat(value.seat), tile: value.tile === null || value.tile === void 0 ? null : number(value.tile, 0, 33), tileId: value.tileId === null || value.tileId === void 0 ? null : number(value.tileId, 0, 135), red: value.red === true, source: value.source === null || value.source === void 0 ? null : seat(value.source), callType: value.callType ?? null, method: value.method ?? null };
  require2([null, "chi", "pon", "minkan", "ankan", "kakan"].includes(result.callType) && [null, "ron", "tsumo"].includes(result.method));
  if (result.tileId !== null && result.tile !== null) require2(Math.floor(result.tileId / 4) === result.tile);
  optional(result, value, "tiles", tiles);
  for (const key of ["drawIndex", "discardIndex", "sourceDiscardIndex"]) optional(result, value, key, number);
  optional(result, value, "sourceTileId", (v) => number(v, 0, 135));
  return result;
}
function eventsOf(value = []) {
  require2(Array.isArray(value) && value.length <= REPLAY_LIMITS.actions * 3);
  let previous = -1;
  return value.map((event3) => {
    const out = publicEvent(event3);
    require2(out.id > previous, "\uACF5\uAC1C \uD589\uB3D9 \uAE30\uB85D\uC758 \uC21C\uC11C\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    previous = out.id;
    return out;
  });
}
function accessOf(value, allowPrivate = false) {
  keys(value, ["role", "seat", "handsVisible"]);
  require2(roles.has(value.role) && (allowPrivate || value.role !== "private"));
  const result = { role: value.role, seat: value.seat === void 0 || value.seat === null ? null : seat(value.seat), handsVisible: ["private", "caster"].includes(value.role) };
  if (value.role === "participant") require2(result.seat !== null, "\uCC38\uAC00\uC790 \uC7AC\uC0DD\uC5D0\uB294 \uBCF8\uC778 \uC88C\uC11D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
  if (value.handsVisible !== void 0) require2(value.handsVisible === result.handsVisible, "\uC7AC\uC0DD \uC190\uD328 \uACF5\uAC1C \uAD8C\uD55C\uC774 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  return result;
}
function winSummary(value) {
  if (!value) return null;
  const result = {};
  optional(result, value, "method", (v) => {
    require2(["ron", "tsumo"].includes(v));
    return v;
  });
  optional(result, value, "source", seat);
  for (const key of ["receipt", "honbaReceipt", "honba"]) optional(result, value, key, number);
  for (const key of ["han", "fu"]) optional(result, value, key, (v) => number(v));
  if (value.score) {
    for (const key of ["han", "fu"]) optional(result, value.score, key, number);
  }
  return result;
}
function projectView(raw, access, pov, fullGame = null, accepted = null) {
  require2(object(raw) && Array.isArray(raw.players) && raw.players.length === 4);
  const role = access.role, phase = text(raw.phase, 24), ended = phase === "end" || phase === "ended";
  const players = raw.players.map((player, index) => {
    const s = seat(player.seat ?? index);
    require2(s === index);
    const result2 = {
      seat: s,
      handSize: number(player.handSize ?? fullGame?.players[s].hand.length, 0, 14),
      score: point(player.score),
      points: point(player.points),
      riichi: player.riichi === true,
      won: player.won === true,
      melds: (player.melds ?? []).map(meld),
      river: (player.river ?? []).map((discard) => ({ ...tile(discard), claimed: discard.claimed === true, riichi: discard.riichi === true, robbedKan: discard.robbedKan === true })),
      win: ended ? winSummary(player.win) : null
    };
    require2(result2.melds.length <= 4 && result2.river.length <= 256);
    optional(result2, player, "wallRemaining", (v) => number(v, 0, 21));
    if (player.exhausted !== void 0) result2.exhausted = player.exhausted === true;
    const allowed = access.handsVisible || role === "participant" && s === access.seat;
    if (allowed) {
      let hand = player.handTiles ?? player.revealed;
      if (fullGame) hand = fullGame.players[s].hand.map((id) => ({ id, type: Math.floor(id / 4), red: fullGame.rules.redDora && [16, 52, 88].includes(id), drawn: id === fullGame.players[s].drawn }));
      else if (s === raw.seat && raw.handTiles) hand = raw.handTiles;
      if (hand) result2.handTiles = tiles(hand);
    }
    return result2;
  });
  const dealer = seat(raw.dealer), result = {
    variant: "D",
    seat: pov,
    dealer,
    phase,
    end: raw.end === null || raw.end === void 0 ? null : text(raw.end, 40),
    actor: phase === "turn" ? seat(raw.actor ?? raw.turn) : null,
    turn: seat(raw.turn ?? raw.actor ?? dealer),
    players,
    handTiles: players[pov].handTiles ? clone(players[pov].handTiles) : [],
    hand: players[pov].handTiles?.map((t) => t.type) ?? [],
    melds: clone(players[pov].melds),
    legalActions: [],
    readOnly: true,
    doraIndicators: (raw.doraIndicators ?? []).map((v) => number(v, 0, 33)),
    uraIndicators: ended && raw.end === "win" && players.some((p) => p.won && p.riichi) ? (raw.uraIndicators ?? []).map((v) => number(v, 0, 33)) : [],
    pot: number(raw.pot ?? 0),
    draws: number(raw.draws ?? 0),
    kans: number(raw.kans ?? 0, 0, 4),
    publicEvents: eventsOf(accepted ?? raw.publicEvents ?? [])
  };
  require2(result.doraIndicators.length <= 5 && result.uraIndicators.length <= 5);
  optional(result, raw, "wallRemaining", (v) => number(v, 0, 84));
  if (players[pov].wallRemaining !== void 0) result.ownWallRemaining = players[pov].wallRemaining;
  if (raw.ownWallRemaining !== void 0 && raw.seat === pov) result.ownWallRemaining = number(raw.ownWallRemaining, 0, 21);
  optional(result, raw, "honba", number);
  optional(result, raw, "duplicateProfile", normalizeDuplicateProfile);
  if (raw.rules) result.rules = normalizeProfileRules(raw.rules, result.duplicateProfile ?? "custom");
  if (raw.lastTileTurn !== void 0) result.lastTileTurn = raw.lastTileTurn === true;
  result.exhaustedSeats = players.filter((p) => p.wallRemaining === 0).map((p) => p.seat);
  if (raw.lastDiscard) {
    result.lastDiscard = { seat: seat(raw.lastDiscard.seat ?? raw.lastDiscard.source), ...tile(raw.lastDiscard), kind: raw.lastDiscard.kind ?? "discard", final: raw.lastDiscard.final === true };
  } else result.lastDiscard = null;
  if (raw.pendingReaction) {
    const r = raw.pendingReaction;
    result.pendingReaction = { kind: text(r.kind, 24), source: seat(r.source), tileId: r.tileId === null || r.tileId === void 0 ? null : number(r.tileId, 0, 135), sourceDiscardIndex: r.sourceDiscardIndex === null || r.sourceDiscardIndex === void 0 ? null : number(r.sourceDiscardIndex) };
  }
  const visible = Array(34).fill(0), add = (t) => visible[t]++;
  for (const type of result.hand) add(type);
  for (const p of players) {
    for (const m of p.melds) for (const t of m.tiles) add(t.type);
    for (const t of p.river) if (!t.claimed) add(t.type);
  }
  for (const type of result.doraIndicators) add(type);
  result.visible = visible;
  return result;
}
function finalOf(game) {
  return { end: game.end, scores: game.players.map((p) => p.score), points: game.players.map((p, s) => game.startingScores[s] + p.score), pot: game.pot, winners: [...game.winners] };
}
function normalizeFinal(value) {
  keys(value, ["end", "scores", "points", "pot", "winners"]);
  require2(typeof value.end === "string");
  require2(Array.isArray(value.winners) && value.winners.length <= 3);
  return { end: text(value.end, 40), scores: points(value.scores), points: points(value.points), pot: number(value.pot), winners: value.winners.map(seat) };
}
function normalizeEngine(value) {
  keys(value, ["schema", "id", "createdAt", "complete", "initial", "actions", "context", "seat", "members", "source", "final"]);
  require2(value.schema === ENGINE_REPLAY_SCHEMA && value.complete === true, "\uC644\uB8CC\uB41C \uC5D4\uC9C4 \uC7AC\uC0DD \uAE30\uB85D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
  keys(value.initial, ["seed", "wall", "rules", "duplicateProfile", "dealer", "honba", "pot", "startingScores"]);
  const profile = normalizeDuplicateProfile(value.initial.duplicateProfile), initial = { seed: number(value.initial.seed, 0, 4294967295), rules: normalizeProfileRules(value.initial.rules, profile), duplicateProfile: profile, dealer: seat(value.initial.dealer), honba: number(value.initial.honba ?? 0), pot: number(value.initial.pot ?? 0), startingScores: points(value.initial.startingScores) };
  require2(initial.pot % 1e3 === 0);
  if (value.initial.wall !== void 0) {
    require2(Array.isArray(value.initial.wall) && value.initial.wall.length === 136 && new Set(value.initial.wall).size === 136);
    initial.wall = value.initial.wall.map((v) => number(v, 0, 135));
  }
  require2(Array.isArray(value.actions) && value.actions.length <= REPLAY_LIMITS.actions);
  const actions = value.actions.map((row) => {
    keys(row, ["seat", "action"]);
    keys(row.action, ["type", "tile", "id", "meld"]);
    require2(["discard", "riichi", "chi", "pon", "minkan", "ankan", "kakan", "ron", "tsumo", "pass"].includes(row.action.type));
    const action = { type: row.action.type };
    optional(action, row.action, "tile", (v) => number(v, 0, 33));
    optional(action, row.action, "id", (v) => number(v, 0, 135));
    optional(action, row.action, "meld", (v) => number(v, 0, 3));
    return { seat: seat(row.seat), action };
  });
  const result = { schema: ENGINE_REPLAY_SCHEMA, complete: true, initial, actions, context: contextOf(value.context), seat: seat(value.seat ?? 0), members: membersOf(value.members), source: identitySource(value.source), final: normalizeFinal(value.final) };
  for (const [key, expected] of Object.entries({ duplicateProfile: profile, honba: initial.honba, dealer: initial.dealer, roundWind: initial.rules.roundWind, pot: initial.pot, initialPot: initial.pot, startingScores: initial.startingScores })) if (result.context[key] !== void 0) require2(equal(result.context[key], expected), "\uC7AC\uC0DD \uC2DC\uC791 \uC815\uBCF4\uC640 \uB300\uAD6D \uBB38\uB9E5\uC774 \uB2E4\uB985\uB2C8\uB2E4.");
  for (const key of ["board", "honba", "handNumber", "handId", "code", "tableId"]) if (result.source[key] !== void 0 && result.context[key] !== void 0) require2(result.source[key] === result.context[key], "\uC7AC\uC0DD \uCD9C\uCC98\uC640 \uB300\uAD6D \uBB38\uB9E5\uC774 \uB2E4\uB985\uB2C8\uB2E4.");
  if (result.context.matchRules && result.context.board !== void 0) {
    const count = matchBoardCount(result.context.matchRules);
    require2(result.context.board <= count && (!result.context.boardCount || result.context.boardCount === count) && initial.dealer === (result.context.board - 1) % 4 && initial.rules.roundWind === 27 + Math.floor((result.context.board - 1) / 4), "\uC7AC\uC0DD \uAD6D \uC815\uBCF4\uC640 \uACBD\uAE30 \uD615\uC2DD\uC774 \uB2E4\uB985\uB2C8\uB2E4.");
  }
  optional(result, value, "id", (v) => text(v));
  optional(result, value, "createdAt", number);
  return result;
}
function openEngineReplay(input) {
  const record = normalizeEngine(input), start = createGame3(record.initial), checkpoints = /* @__PURE__ */ new Map([[0, clone(start)]]), publicTimeline = [], seen = /* @__PURE__ */ new Set();
  let state = start, cursor = 0;
  function publicChanges(game, index) {
    for (const event3 of publicEvents3(game)) if (!seen.has(event3.id)) {
      seen.add(event3.id);
      publicTimeline.push({ after: index, event: publicEvent(event3) });
    }
  }
  publicChanges(state, 0);
  for (let i = 0; i < record.actions.length; i++) {
    const row = record.actions[i];
    require2(actor3(state) === row.seat, "\uC7AC\uC0DD \uCC28\uB840\uAC00 \uC2E4\uC81C \uC5D4\uC9C4\uACFC \uB2E4\uB985\uB2C8\uB2E4.");
    const legal = legalActions3(state, row.seat).find((a) => equal(a, row.action));
    require2(legal, "\uC5D4\uC9C4\uC5D0\uC11C \uD5C8\uC6A9\uD558\uC9C0 \uC54A\uC740 \uC120\uD0DD\uC774 \uC7AC\uC0DD \uAE30\uB85D\uC5D0 \uC788\uC2B5\uB2C8\uB2E4.");
    step3(state, row.seat, clone(legal));
    publicChanges(state, i + 1);
    if ((i + 1) % 16 === 0 || i + 1 === record.actions.length) checkpoints.set(i + 1, clone(state));
  }
  require2(state.phase === "end" && equal(finalOf(state), record.final), "\uC7AC\uC0DD \uACB0\uACFC\uAC00 \uC800\uC7A5\uB41C \uC885\uB8CC \uACB0\uACFC\uC640 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  assertInvariants3(state);
  state = clone(checkpoints.get(0));
  const allowedSeats = [0, 1, 2, 3], access = { role: "private", seat: record.seat, handsVisible: true };
  return {
    frameCount: record.actions.length + 1,
    actionCount: record.actions.length,
    allowedSeats,
    access,
    context: clone(record.context),
    source: clone(record.source),
    seek(index, { role = "private", seat: pov = record.seat } = {}) {
      number(index, 0, record.actions.length);
      seat(pov);
      require2(roles.has(role), "\uC7AC\uC0DD \uACF5\uAC1C \uBC94\uC704\uB97C \uD655\uC778\uD558\uC138\uC694.");
      const checkpoint = Math.floor(index / 16) * 16;
      if (index < cursor || index - cursor > index - checkpoint) {
        state = clone(checkpoints.get(checkpoint) ?? checkpoints.get(0));
        cursor = checkpoints.has(checkpoint) ? checkpoint : 0;
      }
      while (cursor < index) {
        const row = record.actions[cursor];
        step3(state, row.seat, clone(row.action));
        cursor++;
      }
      const requested = { role, seat: role === "participant" ? pov : null, handsVisible: ["private", "caster"].includes(role) }, accepted = publicTimeline.filter((row) => row.after <= index).map((row) => row.event);
      return { index, view: projectView(snapshot3(state, pov), requested, pov, state, accepted) };
    }
  };
}
function normalizeFrames(value) {
  keys(value, ["schema", "id", "createdAt", "expiresAt", "timeBasis", "source", "context", "rules", "duplicateProfile", "matchRules", "members", "frames", "complete", "access", "coverage"]);
  require2(value.schema === FRAME_REPLAY_SCHEMA && value.complete === true, "\uC644\uB8CC\uB41C \uD654\uBA74 \uC7AC\uC0DD \uAE30\uB85D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
  const access = accessOf(value.access), profile = normalizeDuplicateProfile(value.duplicateProfile), rules = normalizeProfileRules(value.rules, profile);
  require2(Array.isArray(value.frames) && value.frames.length > 0 && value.frames.length <= REPLAY_LIMITS.frames);
  let revision = -1, capturedAt = -1;
  const frames = value.frames.map((frame) => {
    keys(frame, ["revision", "capturedAt", "view"]);
    const r = number(frame.revision), at = number(frame.capturedAt);
    require2(r >= revision && at >= capturedAt, "\uC7AC\uC0DD \uD654\uBA74\uC758 \uC2DC\uAC04\xB7\uC21C\uC11C\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    revision = r;
    capturedAt = at;
    require2(!frame.view.duplicateProfile || frame.view.duplicateProfile === profile);
    return { revision: r, capturedAt: at, view: projectView({ ...frame.view, duplicateProfile: profile, rules: frame.view.rules ?? rules }, access, access.seat ?? frame.view.seat ?? 0) };
  });
  require2(frames.at(-1).view.phase === "end" || frames.at(-1).view.phase === "ended", "\uC544\uC9C1 \uB05D\uB098\uC9C0 \uC54A\uC740 \uD654\uBA74 \uAE30\uB85D\uC740 \uC644\uB8CC \uB300\uAD6D\uC73C\uB85C \uAC00\uC838\uC62C \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  const result = { schema: FRAME_REPLAY_SCHEMA, complete: true, source: identitySource(value.source), context: contextOf(value.context), rules, duplicateProfile: profile, matchRules: value.matchRules === null || value.matchRules === void 0 ? null : normalizeMatchRules(value.matchRules), members: membersOf(value.members), frames, access, coverage: value.coverage ?? "captured-frames" };
  require2(["captured-frames", "complete-actions"].includes(result.coverage));
  optional(result, value, "id", (v) => text(v));
  optional(result, value, "createdAt", number);
  optional(result, value, "expiresAt", number);
  if (value.timeBasis !== void 0) {
    require2(value.timeBasis === "archive-time-not-action-time");
    result.timeBasis = value.timeBasis;
  }
  return result;
}
function parseReplay(input) {
  let value = input;
  try {
    if (typeof input === "string") {
      require2(new TextEncoder().encode(input).length <= REPLAY_LIMITS.bytes, "\uC7AC\uC0DD \uD30C\uC77C\uC740 32 MiB \uC774\uD558\uB85C \uAC00\uC838\uC624\uC138\uC694.");
      value = JSON.parse(input);
    } else require2(new TextEncoder().encode(JSON.stringify(input)).length <= REPLAY_LIMITS.bytes, "\uC7AC\uC0DD \uAE30\uB85D\uC774 \uB108\uBB34 \uD07D\uB2C8\uB2E4.");
    if (value?.schema === ENGINE_REPLAY_SCHEMA) {
      const record = normalizeEngine(value);
      openEngineReplay(record);
      return record;
    }
    if (value?.schema === FRAME_REPLAY_SCHEMA) return normalizeFrames(value);
    throw new ReplayError("\uC774 \uD30C\uC77C\uC740 \uC7AC\uC0DD \uAE30\uB85D\uC774 \uC544\uB2D9\uB2C8\uB2E4. \uC774\uC804 \uACB0\uACFC \uC694\uC57D \uD30C\uC77C\uC5D0\uB294 \uB300\uAD6D \uC9C4\uD589 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.");
  } catch (error) {
    if (error instanceof ReplayError) throw error;
    throw new ReplayError(error.message || "\uC7AC\uC0DD \uD30C\uC77C\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  }
}
function compactReplay(input) {
  const record = parseReplay(input);
  if (record.schema !== FRAME_REPLAY_SCHEMA) return record;
  const compactTile = (value) => {
    delete value.tile;
    if (value.red === false) delete value.red;
  };
  for (const frame of record.frames) {
    const view = frame.view;
    for (const key of ["hand", "handTiles", "melds", "visible", "legalActions", "readOnly", "variant", "exhaustedSeats", "duplicateProfile"]) delete view[key];
    if (equal(view.rules, record.rules)) delete view.rules;
    if (view.ownWallRemaining === view.players[view.seat]?.wallRemaining) delete view.ownWallRemaining;
    for (const player of view.players) {
      for (const value of player.handTiles ?? []) compactTile(value);
      for (const value of player.melds) for (const tile2 of value.tiles) compactTile(tile2);
      for (const value of player.river) {
        compactTile(value);
        for (const key of ["claimed", "riichi", "robbedKan"]) if (value[key] === false) delete value[key];
      }
    }
    for (const event3 of view.publicEvents) {
      for (const key of ["tile", "tileId", "source", "callType", "method"]) if (event3[key] === null) delete event3[key];
      if (event3.red === false) delete event3.red;
      for (const value of event3.tiles ?? []) compactTile(value);
    }
    if (view.lastDiscard) compactTile(view.lastDiscard);
  }
  return record;
}
function serializeReplay(record) {
  return JSON.stringify(compactReplay(record));
}
function createReplaySession(input) {
  const record = parseReplay(input);
  if (record.schema === ENGINE_REPLAY_SCHEMA) return openEngineReplay(record);
  const access = clone(record.access), allowedSeats = access.role === "participant" ? [access.seat] : [0, 1, 2, 3];
  return {
    frameCount: record.frames.length,
    actionCount: record.coverage === "complete-actions" ? record.frames.length - 1 : null,
    allowedSeats,
    access,
    context: clone(record.context),
    source: clone(record.source),
    seek(index, { seat: pov = access.seat ?? 0 } = {}) {
      number(index, 0, record.frames.length - 1);
      seat(pov);
      require2(allowedSeats.includes(pov), "\uC774 \uAE30\uB85D\uC5D0\uC11C\uB294 \uBCF8\uC778 \uC88C\uC11D\uB9CC \uC7AC\uC0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
      const frame = record.frames[index];
      return { index, revision: frame.revision, capturedAt: frame.capturedAt, view: projectView(frame.view, access, pov) };
    }
  };
}

// duplicate/replay-store.mjs
var DATABASE = "duplicate.replays.v1";
var VERSION = 1;
var validId = (value) => typeof value === "string" && value.length > 0 && value.length <= 1024 && !/[\u0000-\u001f]/u.test(value);
var text2 = (value) => typeof value === "string" ? value : "";
function replayMetadata(record, { id, label, createdAt = Date.now(), updatedAt = Date.now() } = {}) {
  if (!validId(id)) throw Error("\uD328\uBCF4 \uC800\uC7A5 \uBC88\uD638\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
  const context3 = record.context ?? {}, seriesId = text2(context3.seriesId), tableId = text2(context3.tableId), code = text2(context3.code);
  return {
    id,
    label: text2(label) || text2(context3.label) || "\uC800\uC7A5\uD55C \uD328\uBCF4",
    createdAt,
    updatedAt,
    seriesId,
    tableId,
    code,
    groupId: seriesId ? `${seriesId}:${tableId}` : code && tableId ? `${code}:${tableId}` : id,
    board: Number.isSafeInteger(context3.board) ? context3.board : null,
    honba: Number.isSafeInteger(context3.honba) ? context3.honba : 0,
    handNumber: Number.isSafeInteger(context3.handNumber) ? context3.handNumber : null,
    handId: text2(context3.handId),
    complete: record.complete === true,
    source: typeof record.source === "string" ? record.source : text2(record.source?.mode)
  };
}
function storageError(error) {
  return Object.assign(Error(error?.name === "QuotaExceededError" ? "\uBE0C\uB77C\uC6B0\uC800\uC758 \uD328\uBCF4 \uC800\uC7A5 \uACF5\uAC04\uC774 \uBD80\uC871\uD569\uB2C8\uB2E4. \uD328\uBCF4 \uD30C\uC77C\uB85C \uB0B4\uB824\uBC1B\uC544 \uBCF4\uAD00\uD574 \uC8FC\uC138\uC694." : "\uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uD328\uBCF4 \uC800\uC7A5\uC18C\uB97C \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uD30C\uC77C\uC740 \uC774 \uD654\uBA74\uC5D0\uC11C \uC5F4\uACE0 \uB0B4\uB824\uBC1B\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4."), { cause: error });
}
function createReplayStore({ indexedDB = globalThis.indexedDB, now = Date.now, idFactory = () => globalThis.crypto.randomUUID() } = {}) {
  let opening = null;
  async function database() {
    if (!indexedDB?.open) throw storageError();
    if (!opening) opening = new Promise((resolve3, reject) => {
      let request;
      try {
        request = indexedDB.open(DATABASE, VERSION);
      } catch (error) {
        reject(storageError(error));
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        for (const name of ["records", "metadata"]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve3(db);
      };
      request.onerror = () => {
        opening = null;
        reject(storageError(request.error));
      };
      request.onblocked = () => {
        opening = null;
        reject(Error("\uB2E4\uB978 \uD328\uBCF4 \uD0ED\uC744 \uB2EB\uACE0 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694."));
      };
    });
    return opening;
  }
  async function read(store2, key) {
    const db = await database();
    return new Promise((resolve3, reject) => {
      const transaction = db.transaction(store2, "readonly"), request = key === void 0 ? transaction.objectStore(store2).getAll() : transaction.objectStore(store2).get(key);
      let result;
      request.onsuccess = () => {
        result = request.result;
      };
      transaction.oncomplete = () => resolve3(result);
      transaction.onerror = transaction.onabort = () => reject(storageError(transaction.error ?? request.error));
    });
  }
  return {
    async saveReplay(value, { id = idFactory(), label } = {}) {
      const record = parseReplay(value), payload = serializeReplay(record);
      if (!validId(id)) throw Error("\uD328\uBCF4 \uC800\uC7A5 \uBC88\uD638\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      const db = await database();
      return new Promise((resolve3, reject) => {
        const transaction = db.transaction(["records", "metadata"], "readwrite"), request = transaction.objectStore("metadata").get(id);
        let metadata;
        request.onsuccess = () => {
          const timestamp = now();
          metadata = replayMetadata(record, { id, label: label ?? request.result?.label, createdAt: request.result?.createdAt ?? timestamp, updatedAt: timestamp });
          transaction.objectStore("records").put({ id, payload });
          transaction.objectStore("metadata").put(metadata);
        };
        transaction.oncomplete = () => resolve3(structuredClone(metadata));
        transaction.onerror = transaction.onabort = () => reject(storageError(transaction.error ?? request.error));
      });
    },
    async listReplays() {
      const values = await read("metadata");
      return values.filter((row) => validId(row?.id)).sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id)).map((row) => structuredClone(row));
    },
    async getReplay(id) {
      if (!validId(id)) throw Error("\uD328\uBCF4 \uC800\uC7A5 \uBC88\uD638\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      const value = await read("records", id);
      return value ? parseReplay(value.payload) : null;
    },
    async deleteReplay(id) {
      if (!validId(id)) throw Error("\uD328\uBCF4 \uC800\uC7A5 \uBC88\uD638\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      const db = await database();
      return new Promise((resolve3, reject) => {
        const transaction = db.transaction(["records", "metadata"], "readwrite");
        for (const name of ["records", "metadata"]) transaction.objectStore(name).delete(id);
        transaction.oncomplete = () => resolve3();
        transaction.onerror = transaction.onabort = () => reject(storageError(transaction.error));
      });
    },
    async close() {
      if (opening) {
        const db = await opening;
        db.close();
        opening = null;
      }
    }
  };
}
var shared;
var store = () => shared ??= createReplayStore();
var saveReplay = (record, options) => store().saveReplay(record, options);
var listReplays = () => store().listReplays();
var getReplay = (id) => store().getReplay(id);
var deleteReplay = (id) => store().deleteReplay(id);

// duplicate/tile-view.mjs
var SVG = "http://www.w3.org/2000/svg";
var dots = { 1: [[50, 50]], 2: [[50, 24], [50, 76]], 3: [[24, 22], [50, 50], [76, 78]], 4: [[24, 24], [76, 24], [24, 76], [76, 76]], 5: [[24, 24], [76, 24], [50, 50], [24, 76], [76, 76]], 6: [[24, 18], [76, 18], [24, 50], [76, 50], [24, 82], [76, 82]], 7: [[24, 16], [50, 31], [76, 16], [24, 57], [76, 57], [24, 84], [76, 84]], 8: [[24, 13], [76, 13], [24, 38], [76, 38], [24, 63], [76, 63], [24, 88], [76, 88]], 9: [[22, 16], [50, 16], [78, 16], [22, 50], [50, 50], [78, 50], [22, 84], [50, 84], [78, 84]] };
function element(tag, attributes) {
  const el = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, String(value));
  return el;
}
function span(text3, cls) {
  const el = document.createElement("span");
  el.className = cls;
  el.textContent = text3;
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
  for (const points2 of [[[5, 18], [24, 43], [43, 18]], [[57, 18], [76, 43], [95, 18]], [[5, 92], [24, 67], [43, 92]], [[57, 92], [76, 67], [95, 92]]]) {
    svg.append(element("path", { d: points2.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" "), fill: "none", stroke: "#166b46", "stroke-width": 8, "stroke-linecap": "butt", "stroke-linejoin": "miter", "stroke-miterlimit": 2 }));
    for (let i = 0; i < 2; i++) {
      const [x1, y1] = points2[i], [x2, y2] = points2[i + 1], length = Math.hypot(x2 - x1, y2 - y1), dx = (y2 - y1) / length * 3.5, dy = -(x2 - x1) / length * 3.5, g = element("g", { "data-bamboo-stem": "true" });
      for (const t of [0.3, 0.7]) {
        const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
        g.append(element("path", { d: `M${x - dx} ${y - dy} L${x + dx} ${y + dy}`, fill: "none", stroke: "#0d4e33", "stroke-width": 1.7 }));
      }
      svg.append(g);
    }
  }
}
function tileFace(type, { button = false, small = false } = {}) {
  const tile2 = document.createElement(button ? "button" : "span");
  tile2.className = `tile-face ${small ? "tile-small" : "tile"}`;
  tile2.dataset.type = String(type);
  tile2.dataset.suit = type < 27 ? ["m", "p", "s"][Math.floor(type / 9)] : "z";
  tile2.title = tileName(type);
  tile2.setAttribute("aria-label", tileName(type));
  if (button) tile2.type = "button";
  if (type < 9) {
    tile2.append(span(["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u4E03", "\u516B", "\u4E5D"][type], "tile-number"), span("\u842C", "tile-man"));
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
    tile2.append(svg);
  } else if (type === 31) {
    tile2.append(span("", "tile-white"));
  } else tile2.append(span({ 27: "\u6771", 28: "\u5357", 29: "\u897F", 30: "\u5317", 32: "\u767C", 33: "\u4E2D" }[type], "tile-honor"));
  for (const child of tile2.children) child.setAttribute("aria-hidden", "true");
  return tile2;
}

// duplicate/observer-links.mjs
function tournamentNavigationLinks({ baseUrl, server, defaultServer = "https://wellness-mahjong-h-lab.chayhyeon.chatgpt.site" }) {
  const api = new URL(server);
  if (api.username || api.password || api.pathname !== "/" || api.search || api.hash || !["https:", "http:"].includes(api.protocol) || api.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(api.hostname)) throw new Error("\uC11C\uBC84 \uC8FC\uC18C\uB97C \uD655\uC778\uD558\uC138\uC694.");
  return Object.fromEntries([["game", "./"], ["manager", "./tournament/"], ["observer", "./tournament/observer.html"]].map(([name, path]) => {
    const url = new URL(path, baseUrl);
    url.search = "";
    url.hash = "";
    if (api.origin !== new URL(defaultServer).origin) url.searchParams.set("server", api.origin);
    return [name, url.href];
  }));
}

// duplicate/replay.mjs
var WINDS = ["\u6771", "\u5357", "\u897F", "\u5317"];
var number2 = (value) => Number.isFinite(value) ? value.toLocaleString("ko-KR") : "\u2014";
var signed = (value) => Number.isFinite(value) ? `${value > 0 ? "+" : ""}${number2(value)}` : "\u2014";
var validTile = (value) => Number.isInteger(value) && value >= 0 && value < 34;
var ACTION_NAMES = { discard: "\uBC84\uB9BC", riichi: "\uB9AC\uCE58", call: "\uD6C4\uB85C", chi: "\uCE58", pon: "\uD401", minkan: "\uBA85\uAE61", ankan: "\uC548\uAE61", kakan: "\uAC00\uAE61", kan: "\uAE61", win: "\uD654\uB8CC", tsumo: "\uCBD4\uBAA8", ron: "\uB860", pass: "\uB118\uAE30\uAE30" };
var node = (doc, tag, text3, className) => {
  const element2 = doc.createElement(tag);
  if (text3 !== void 0) element2.textContent = String(text3);
  if (className) element2.className = className;
  return element2;
};
function replayRoundLabel(metadata = {}) {
  const board = metadata.board;
  return Number.isInteger(board) && board > 0 ? `${WINDS[Math.floor((board - 1) / 4)] ?? `${board}\uAD6D`}${(board - 1) % 4 + 1}\u5C40 ${metadata.honba ?? 0}\uBCF8\uC7A5` : "\uAD6D \uC815\uBCF4 \uC5C6\uC74C";
}
function replayPublicCaption(view, index) {
  if (index === 0) return "\uB300\uAD6D \uC2DC\uC791";
  const event3 = view.publicEvents?.at(-1);
  if (!event3) return `\uAE30\uB85D ${index} \xB7 \uACF5\uAC1C \uD589\uB3D9 \uCD94\uAC00 \uC5C6\uC74C`;
  const type = event3.kind === "win" ? event3.method : event3.callType ?? event3.kind;
  return `\uCD5C\uADFC \uACF5\uAC1C: ${Number.isInteger(event3.seat) ? `${event3.seat + 1}\uBC88 \xB7 ` : ""}${ACTION_NAMES[type] ?? "\uD589\uB3D9"}${validTile(event3.tile) ? ` ${event3.red ? "\uC801 " : ""}${tileName(event3.tile)}` : ""}`;
}
function replayFrameCaption(record, view, index) {
  if (index === 0) return "\uB300\uAD6D \uC2DC\uC791";
  if (record.schema === ENGINE_REPLAY_SCHEMA) {
    const row = record.actions[index - 1], type = row?.action?.tile ?? (Number.isInteger(row?.action?.id) ? Math.floor(row.action.id / 4) : null), request = ["chi", "pon", "minkan", "ron"].includes(row.action.type) ? " \uC694\uCCAD" : row.action.type === "kakan" ? " \uC120\uC5B8" : "";
    return `${Number(row.seat) + 1}\uBC88 \xB7 ${ACTION_NAMES[row.action.type] ?? "\uC120\uD0DD"}${request}${validTile(type) ? ` ${tileName(type)}` : ""}`;
  }
  return replayPublicCaption(view, index);
}
function replayDisplaySteps(record) {
  if (record.schema !== ENGINE_REPLAY_SCHEMA) return null;
  const steps = [{ rawIndex: 0, actionIndex: null }];
  for (let index = 0; index < record.actions.length; index++) {
    if (record.actions[index].action.type === "pass") {
      steps.at(-1).rawIndex = index + 1;
      continue;
    }
    steps.push({ rawIndex: index + 1, actionIndex: index });
  }
  return steps;
}
function createReplayDisplaySession(record, session = createReplaySession(record)) {
  const steps = replayDisplaySteps(record);
  if (!steps) return session;
  return {
    ...session,
    steps,
    frameCount: steps.length,
    actionCount: steps.length - 1,
    rawActionCount: session.actionCount,
    seek(index, options) {
      if (!Number.isInteger(index) || index < 0 || index >= steps.length) throw Error("\uD328\uBCF4 \uC7AC\uC0DD \uBC94\uC704\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      const step4 = steps[index], frame = session.seek(step4.rawIndex, options);
      return { ...frame, index, rawIndex: step4.rawIndex, actionIndex: step4.actionIndex };
    }
  };
}
function replayStepCaption(record, view, index, steps = replayDisplaySteps(record)) {
  return steps ? replayFrameCaption(record, view, steps[index]?.actionIndex === null ? 0 : steps[index].actionIndex + 1) : replayFrameCaption(record, view, index);
}
function createReplayPlayer({ session, seat: seat2 = session.allowedSeats[0], onFrame = () => {
}, onPlayState = () => {
}, onError = () => {
}, visibility = globalThis.document, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (!Number.isInteger(session?.frameCount) || session.frameCount < 1 || !session.allowedSeats.includes(seat2)) throw Error("\uD328\uBCF4 \uC7AC\uC0DD \uBC94\uC704\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
  let index = 0, playing = false, speed = 1, timer = null, destroyed = false;
  const clear = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  function pause() {
    clear();
    if (playing) {
      playing = false;
      onPlayState(false);
    }
  }
  function show(next) {
    index = Math.max(0, Math.min(session.frameCount - 1, Math.floor(next)));
    const frame = session.seek(index, { seat: seat2 });
    onFrame(frame, { seat: seat2, frameCount: session.frameCount });
    return frame;
  }
  function schedule() {
    clear();
    if (!playing || destroyed) return;
    timer = setTimer(() => {
      timer = null;
      if (visibility?.hidden) {
        pause();
        return;
      }
      try {
        show(index + 1);
        if (index === session.frameCount - 1) pause();
        else schedule();
      } catch (error) {
        pause();
        onError(error);
      }
    }, 1e3 / speed);
  }
  const hidden = () => {
    if (visibility?.hidden) pause();
  };
  visibility?.addEventListener?.("visibilitychange", hidden);
  return {
    seek(next) {
      pause();
      return show(next);
    },
    next() {
      pause();
      return show(index + 1);
    },
    previous() {
      pause();
      return show(index - 1);
    },
    play() {
      if (destroyed || session.frameCount < 2 || visibility?.hidden) return;
      if (index === session.frameCount - 1) show(0);
      playing = true;
      onPlayState(true);
      schedule();
    },
    pause,
    setSeat(value) {
      if (!session.allowedSeats.includes(value)) throw Error("\uC774 \uD328\uBCF4\uC5D0 \uD5C8\uC6A9\uB41C \uC2DC\uC810\uB9CC \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
      pause();
      seat2 = value;
      return show(index);
    },
    setSpeed(value) {
      if (![0.5, 1, 2, 4].includes(value)) throw Error("\uC9C0\uC6D0\uD558\uC9C0 \uC54A\uB294 \uC7AC\uC0DD \uC18D\uB3C4\uC785\uB2C8\uB2E4.");
      speed = value;
      if (playing) schedule();
    },
    getState() {
      return { index, seat: seat2, playing, speed };
    },
    destroy() {
      pause();
      destroyed = true;
      visibility?.removeEventListener?.("visibilitychange", hidden);
    }
  };
}
function replayHandTiles(view, player, access) {
  if (access?.role === "viewer") return null;
  const allowed = access?.handsVisible === true || access?.role === "participant" && player.seat === access.seat;
  if (!allowed) return null;
  if (player.seat === view.seat && Array.isArray(view.handTiles)) return view.handTiles;
  if (Array.isArray(player.handTiles)) return player.handTiles;
  return null;
}
function renderReplayView(view, { record, access, document: doc = globalThis.document } = {}) {
  const root = node(doc, "div"), context3 = record.context ?? {}, meta = node(doc, "div", void 0, "replay-table-meta");
  meta.append(node(doc, "strong", replayRoundLabel({ ...context3, honba: view.honba ?? context3.honba })), node(doc, "span", `\u89AA ${Number(view.dealer) + 1}\uBC88 \xB7 ${["end", "ended"].includes(view.phase) ? "\uAD6D \uC885\uB8CC" : view.phase === "reaction" ? "\uC751\uB2F5 \uD655\uC778" : "\uB300\uAD6D \uC911"}`), node(doc, "span", `\uB0A8\uC740 \uD328 ${number2(view.wallRemaining)} \xB7 \uB9AC\uCE58\uBD09 ${(view.pot ?? 0) / 1e3}\uAC1C`));
  root.append(meta);
  const dora = node(doc, "div", void 0, "replay-dora");
  dora.append(node(doc, "span", "\uB3C4\uB77C \uD45C\uC2DC\uD328"));
  for (const tile2 of view.doraIndicators ?? []) dora.append(face(tile2));
  if (!view.doraIndicators?.length) dora.append(node(doc, "span", "\uC5C6\uC74C"));
  root.append(dora);
  function face(value) {
    const tile2 = typeof value === "number" ? { type: value } : value, type = tile2?.type ?? tile2?.tile;
    if (!validTile(type)) return node(doc, "span", "?", "replay-back");
    const element2 = tileFace(type, { small: true });
    element2.classList.toggle("red", tile2.red === true);
    element2.classList.toggle("riichi", tile2.riichi === true);
    element2.classList.toggle("claimed", tile2.claimed === true);
    element2.title = `${tile2.red ? "\uC801 " : ""}${tileName(type)}`;
    return element2;
  }
  const players = node(doc, "div", void 0, "replay-players"), seat2 = view.seat ?? access?.seat ?? 0;
  for (const player of [...view.players ?? []].sort((a, b) => (a.seat - seat2 + 4) % 4 - (b.seat - seat2 + 4) % 4)) {
    const card = node(doc, "section", void 0, `replay-player${player.seat === seat2 ? " is-pov" : ""}${view.actor === player.seat && !["end", "ended"].includes(view.phase) ? " is-turn" : ""}`), head = node(doc, "div", void 0, "replay-player-head"), member = record.members?.find((m) => m.seat === player.seat);
    head.append(node(doc, "span", WINDS[(player.seat - view.dealer + 4) % 4], "replay-wind"), node(doc, "strong", member?.name ?? `${player.seat + 1}\uBC88 \uC790\uB9AC`), node(doc, "span", number2(player.points), "replay-points"));
    card.append(head);
    const detail = node(doc, "div", void 0, "replay-player-meta");
    detail.append(node(doc, "span", `\uAD6D \uC810\uC218 ${signed(player.score)}`), node(doc, "span", `\uC190\uD328 ${number2(player.handSize)}\uC7A5`));
    const flags = [player.riichi ? "\uB9AC\uCE58" : "", player.won ? "\uD654\uB8CC" : "", view.actor === player.seat && !["end", "ended"].includes(view.phase) ? "\uCC28\uB840" : ""].filter(Boolean);
    if (flags.length) detail.append(node(doc, "span", flags.join(" \xB7 "), "replay-flags"));
    card.append(detail);
    const hand = replayHandTiles(view, player, access);
    if (hand) {
      const tiles2 = node(doc, "div", void 0, "replay-tiles replay-hand");
      tiles2.setAttribute("aria-label", `${member?.name ?? `${player.seat + 1}\uBC88`}\uC758 \uACF5\uAC1C \uBC94\uC704 \uB0B4 \uC190\uD328`);
      for (const tile2 of hand) tiles2.append(face(tile2));
      card.append(tiles2);
    } else card.append(node(doc, "div", "\uC190\uD328 \uBE44\uACF5\uAC1C", "replay-concealed"));
    if (player.melds?.length) {
      const melds = node(doc, "div", void 0, "replay-melds");
      for (const meld2 of player.melds) {
        const box = node(doc, "span", void 0, "replay-meld");
        if (meld2.hidden || meld2.tile === null) {
          for (let i = 0; i < 4; i++) box.append(node(doc, "span", void 0, "replay-back"));
        } else {
          const types = meld2.type === "chi" ? [meld2.tile, meld2.tile + 1, meld2.tile + 2] : Array(["kan", "ankan", "minkan", "kakan"].includes(meld2.type) ? 4 : 3).fill(meld2.tile), tiles2 = meld2.tiles?.length ? meld2.tiles : types.map((type) => ({ type }));
          for (let i = 0; i < tiles2.length; i++) box.append(!meld2.open && tiles2.length === 4 && (i === 0 || i === 3) ? node(doc, "span", void 0, "replay-back") : face(tiles2[i]));
        }
        melds.append(box);
      }
      card.append(melds);
    }
    const river = node(doc, "div", void 0, "replay-tiles replay-river");
    river.setAttribute("aria-label", `${player.seat + 1}\uBC88 \uC790\uB9AC \uBC84\uB9BC\uD328`);
    for (const tile2 of player.river ?? []) river.append(face(tile2));
    if (!player.river?.length) river.append(node(doc, "span", "\uBC84\uB9BC\uD328 \uC5C6\uC74C", "replay-empty-river"));
    card.append(river);
    players.append(card);
  }
  root.append(players);
  if (view.publicEvents?.length) root.append(node(doc, "p", replayPublicCaption(view, 1), "hint replay-public-last"));
  return root;
}
function mountReplay(doc = globalThis.document, win3 = globalThis.window, { store: store2 = { saveReplay, listReplays, getReplay, deleteReplay }, createSession = createReplaySession } = {}) {
  const $ = (id) => doc.getElementById(id);
  let library = [], current = null, currentId = null, currentMeta = null, session = null, player = null, epoch = 0, confirmAction = null, destroyed = false;
  const error = (message) => {
    $("replay-error").textContent = message ?? "";
    $("replay-error").hidden = !message;
  }, status = (message) => {
    $("replay-status").textContent = message;
  };
  try {
    const server = new URL(win3.location.href).searchParams.get("server");
    if (server) {
      const links = tournamentNavigationLinks({ baseUrl: new URL("./", win3.location.href).href, server });
      $("replay-home-link").href = $("replay-game-link").href = links.game;
      $("replay-manager-link").href = links.manager;
    }
  } catch {
  }
  function locationId(id) {
    const url = new URL(win3.location.href);
    url.searchParams.delete("id");
    url.hash = "";
    if (id) url.searchParams.set("id", id);
    win3.history.replaceState(null, "", url.href);
  }
  function confirm(title, copy, perform) {
    player?.pause();
    confirmAction = perform;
    $("replay-confirm-title").textContent = title;
    $("replay-confirm-copy").textContent = copy;
    $("replay-confirm").hidden = false;
  }
  function hideConfirm() {
    confirmAction = null;
    $("replay-confirm").hidden = true;
  }
  function populateHands() {
    const select = $("replay-hand");
    select.replaceChildren();
    const same3 = library.filter((row) => row.groupId === currentMeta?.groupId).sort((a, b) => (a.handNumber ?? 0) - (b.handNumber ?? 0) || (a.board ?? 0) - (b.board ?? 0) || (a.honba ?? 0) - (b.honba ?? 0));
    if (!same3.some((row) => row.id === currentId)) same3.push({ ...currentMeta, id: currentId ?? "" });
    for (const row of same3) {
      const option = node(doc, "option", `${replayRoundLabel(row)}${row.handNumber ? ` \xB7 \uB300\uAD6D ${row.handNumber}` : ""}`);
      option.value = row.id;
      select.append(option);
    }
    select.value = currentId ?? "";
    select.disabled = same3.length < 2;
  }
  function renderList() {
    const list = $("replay-list");
    list.replaceChildren();
    if (!library.length) {
      list.append(node(doc, "li", "\uC544\uC9C1 \uC800\uC7A5\uD55C \uD328\uBCF4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.", "hint"));
      return;
    }
    for (const metadata of library) {
      const item = node(doc, "li"), button = node(doc, "button", void 0, metadata.id === currentId ? "active" : "");
      button.type = "button";
      button.append(node(doc, "strong", metadata.label), node(doc, "small", `${replayRoundLabel(metadata)} \xB7 ${new Date(metadata.updatedAt).toLocaleDateString("ko-KR")}`));
      button.onclick = () => void openSaved(metadata.id);
      item.append(button);
      list.append(item);
    }
  }
  async function refreshList() {
    try {
      library = await store2.listReplays();
      if (destroyed) return;
      renderList();
      if (current) populateHands();
    } catch (e) {
      if (!destroyed) error(e.message);
    }
  }
  function renderFrame(frame) {
    if (!current || !session) return;
    const { index, view } = frame;
    $("replay-table").replaceChildren(renderReplayView(view, { record: current, access: session.access, document: doc }));
    const label = replayStepCaption(current, view, index, session.steps);
    $("replay-action-label").textContent = label;
    $("replay-progress").textContent = `${index} / ${session.frameCount - 1}`;
    $("replay-step").value = String(index);
    $("replay-step").max = String(session.frameCount - 1);
    $("replay-first").disabled = $("replay-prev").disabled = index === 0;
    $("replay-last").disabled = $("replay-next").disabled = index === session.frameCount - 1;
    $("replay-play").disabled = session.frameCount < 2;
    for (const button of $("replay-actions").children) {
      const step4 = Number(button.dataset.step);
      button.firstChild?.classList?.toggle?.("active", step4 === index);
      if (step4 === index && button.firstChild) button.firstChild.textContent = `${index} \xB7 ${label}`;
    }
  }
  function showRecord(record, metadata) {
    player?.destroy();
    current = record;
    currentMeta = metadata;
    currentId = metadata.saved === false ? null : metadata.id;
    session = createReplayDisplaySession(record, createSession(record));
    hideConfirm();
    doc.body.classList.add("has-replay");
    $("replay-empty").hidden = true;
    $("replay-viewer").hidden = false;
    $("replay-title").textContent = metadata.label;
    $("replay-summary").textContent = `${replayRoundLabel(metadata)} \xB7 ${session.frameCount}\uAC1C \uAE30\uB85D${session.actionCount === null ? "" : ` \xB7 ${session.actionCount}\uD589\uB3D9`}`;
    $("replay-delete").hidden = currentId === null;
    const seat2 = $("replay-seat");
    seat2.replaceChildren();
    for (const value of session.allowedSeats) {
      const option = node(doc, "option", `${value + 1}\uBC88 \uC790\uB9AC \uC2DC\uC810`);
      option.value = String(value);
      seat2.append(option);
    }
    const initial = session.allowedSeats.includes(session.access?.seat) ? session.access.seat : session.allowedSeats[0];
    seat2.value = String(initial);
    seat2.disabled = session.allowedSeats.length < 2;
    $("replay-visibility").textContent = (session.access?.role === "viewer" ? "\uACF5\uAC1C \uAD00\uC804 \uAE30\uB85D \xB7 \uC190\uD328\uB294 \uD45C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : session.access?.handsVisible ? "\uD328\uBCF4\uC5D0 \uD3EC\uD568\uB41C \uD5C8\uC6A9 \uBC94\uC704\uC758 \uC190\uD328\uB9CC \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uB0B4\uBCF4\uB0B4\uBA74 \uADF8 \uC815\uBCF4\uAC00 \uD30C\uC77C\uC5D0 \uD3EC\uD568\uB429\uB2C8\uB2E4." : "\uC774 \uCC38\uAC00\uC790\uC5D0\uAC8C \uD5C8\uC6A9\uB41C \uC190\uD328\uC640 \uACF5\uAC1C \uC815\uBCF4\uB9CC \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uB2E4\uB978 \uC2DC\uC810\uC73C\uB85C \uBC14\uAFB8\uC5B4\uB3C4 \uACF5\uAC1C \uBC94\uC704\uAC00 \uB298\uC5B4\uB098\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.") + (session.actionCount === null ? " \uCEA1\uCC98\uB41C \uD654\uBA74 \uAE30\uB85D\uC774\uBA70 \uC77C\uBD80 \uD589\uB3D9\uC774 \uD569\uCCD0\uC838 \uC788\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uBC30\uC18D\uC740 \uC6D0\uB798 \uB300\uAD6D \uC2DC\uAC04\uC774 \uC544\uB2CC \uAE30\uB85D \uAC04\uACA9\uC5D0 \uC801\uC6A9\uD569\uB2C8\uB2E4." : "") + (record.schema === ENGINE_REPLAY_SCHEMA ? " \uCF5C\xB7\uB860\uC758 \uC694\uCCAD\uACFC \uC2E4\uC81C \uD655\uC815\uC740 \uB2E4\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uD655\uC815\uB41C \uD6C4\uB85C\xB7\uD654\uB8CC\uB294 \uD0C1\uC790\uC640 \uCD5C\uADFC \uACF5\uAC1C \uAE30\uB85D\uC744 \uD655\uC778\uD558\uC138\uC694." : "");
    const timeline = $("replay-actions");
    timeline.replaceChildren();
    for (let index = 0; index < session.frameCount; index++) {
      const item = node(doc, "li"), caption = index === 0 ? "\uB300\uAD6D \uC2DC\uC791" : record.schema === ENGINE_REPLAY_SCHEMA ? replayStepCaption(record, null, index, session.steps) : "\uCEA1\uCC98 \uAE30\uB85D", button = node(doc, "button", `${index} \xB7 ${caption}`);
      item.dataset.step = String(index);
      button.type = "button";
      button.onclick = () => {
        try {
          player.seek(index);
        } catch (e) {
          error(e.message);
        }
      };
      item.append(button);
      timeline.append(item);
    }
    player = createReplayPlayer({ session, seat: initial, visibility: doc, onFrame: renderFrame, onPlayState: (playing) => {
      $("replay-play").textContent = playing ? "\uC815\uC9C0 \u275A\u275A" : "\uC7AC\uC0DD \u25B6";
      $("replay-play").setAttribute("aria-pressed", String(playing));
    }, onError: (e) => error(e.message) });
    player.setSpeed(Number($("replay-speed").value));
    player.seek(0);
    populateHands();
    renderList();
    locationId(currentId);
    status(metadata.saved === false ? "\uC800\uC7A5\uC18C\uC5D0 \uAE30\uB85D\uD558\uC9C0 \uBABB\uD574 \uD30C\uC77C\uC744 \uC784\uC2DC\uB85C \uC5F4\uC5C8\uC2B5\uB2C8\uB2E4. \uD30C\uC77C\uB85C \uB0B4\uB824\uBC1B\uC544 \uBCF4\uAD00\uD574 \uC8FC\uC138\uC694." : "\uC800\uC7A5\uB41C \uD328\uBCF4\uB97C \uC77D\uAE30 \uC804\uC6A9\uC73C\uB85C \uC7AC\uC0DD\uD569\uB2C8\uB2E4. \uB300\uAD6D\uC774\uB098 AI\uB97C \uC9C4\uD589\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  }
  async function openSaved(id) {
    const generation = ++epoch;
    player?.pause();
    error("");
    status("\uD328\uBCF4\uB97C \uBD88\uB7EC\uC624\uACE0 \uC788\uC2B5\uB2C8\uB2E4.");
    try {
      const record = await store2.getReplay(id);
      if (destroyed || generation !== epoch) return;
      if (!record) throw Error("\uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uD328\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC800\uC7A5 \uBAA9\uB85D\uC744 \uB2E4\uC2DC \uD655\uC778\uD558\uAC70\uB098 \uD30C\uC77C\uC744 \uBD88\uB7EC\uC624\uC138\uC694.");
      const metadata = library.find((row) => row.id === id) ?? replayMetadata(record, { id });
      showRecord(record, metadata);
    } catch (e) {
      if (generation === epoch && !destroyed) {
        error(e.message);
        status("\uD328\uBCF4\uB97C \uC5F4\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      }
    }
  }
  async function importFile(file) {
    if (!file) return;
    const generation = ++epoch;
    player?.pause();
    error("");
    status("\uD328\uBCF4 \uD30C\uC77C\uC744 \uD655\uC778\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.");
    try {
      if (file.size > REPLAY_LIMITS.bytes) throw Error("\uD328\uBCF4 \uD30C\uC77C\uC740 32MiB \uC774\uD558\uB9CC \uC5F4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
      const text3 = await file.text();
      if (destroyed || generation !== epoch) return;
      const record = parseReplay(text3), label = file.name.replace(/\.json$/i, "") || "\uBD88\uB7EC\uC628 \uD328\uBCF4";
      let metadata;
      try {
        metadata = await store2.saveReplay(record, { label });
      } catch (e) {
        metadata = { ...replayMetadata(record, { id: crypto.randomUUID(), label }), saved: false };
        error(e.message);
      }
      if (destroyed || generation !== epoch) return;
      showRecord(record, metadata);
      await refreshList();
    } catch (e) {
      if (generation === epoch && !destroyed) {
        error(`\uD328\uBCF4 \uD30C\uC77C\uC744 \uC5F4 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. ${e.message}`);
        status("\uD615\uC2DD\uC744 \uD655\uC778\uD55C \uB4A4 \uB2E4\uC2DC \uBD88\uB7EC\uC624\uC138\uC694. \uAE30\uC874 \uC131\uC801 JSON\uC740 \uD328\uBCF4\uC640 \uB2E4\uB985\uB2C8\uB2E4.");
      }
    } finally {
      $("replay-file").value = "";
    }
  }
  $("replay-import").onclick = () => $("replay-file").click();
  $("replay-file").onchange = () => void importFile($("replay-file").files[0]);
  $("replay-reload").onclick = () => void refreshList();
  const drop = $("replay-drop");
  for (const name of ["dragenter", "dragover"]) drop.addEventListener(name, (event3) => {
    event3.preventDefault();
    drop.classList.add("drag-over");
  });
  for (const name of ["dragleave", "drop"]) drop.addEventListener(name, (event3) => {
    event3.preventDefault();
    drop.classList.remove("drag-over");
    if (name === "drop") void importFile(event3.dataTransfer?.files?.[0]);
  });
  $("replay-play").onclick = () => {
    if (player?.getState().playing) player.pause();
    else player?.play();
  };
  $("replay-prev").onclick = () => player?.previous();
  $("replay-next").onclick = () => player?.next();
  $("replay-first").onclick = () => player?.seek(0);
  $("replay-last").onclick = () => player?.seek(session.frameCount - 1);
  $("replay-step").oninput = () => player?.seek(Number($("replay-step").value));
  $("replay-speed").onchange = () => player?.setSpeed(Number($("replay-speed").value));
  $("replay-seat").onchange = () => player?.setSeat(Number($("replay-seat").value));
  $("replay-hand").onchange = () => void openSaved($("replay-hand").value);
  $("replay-export").onclick = () => {
    if (!current) return;
    player?.pause();
    const url = URL.createObjectURL(new Blob([serializeReplay(current)], { type: "application/json" })), a = node(doc, "a");
    a.href = url;
    a.download = `duplicate-replay-${currentMeta.board ?? "hand"}-${currentMeta.honba ?? 0}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  };
  $("replay-delete").onclick = () => {
    if (!currentId) return;
    const id = currentId;
    confirm("\uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uD328\uBCF4\uB97C \uC0AD\uC81C\uD560\uAE4C\uC694?", "\uB0B4\uBCF4\uB0B8 \uD328\uBCF4 \uD30C\uC77C\uC740 \uC0AD\uC81C\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uD544\uC694\uD55C \uD328\uBCF4\uB294 \uBA3C\uC800 \uD30C\uC77C\uB85C \uBCF4\uAD00\uD574 \uC8FC\uC138\uC694.", async () => {
      await store2.deleteReplay(id);
      if (currentId === id) {
        player?.destroy();
        current = null;
        currentId = null;
        session = null;
        doc.body.classList.remove("has-replay");
        $("replay-viewer").hidden = true;
        $("replay-empty").hidden = false;
        locationId(null);
      }
      hideConfirm();
      await refreshList();
      status("\uC774 \uBE0C\uB77C\uC6B0\uC800\uC758 \uD328\uBCF4\uB97C \uC0AD\uC81C\uD588\uC2B5\uB2C8\uB2E4.");
    });
  };
  $("replay-confirm-cancel").onclick = hideConfirm;
  $("replay-confirm-accept").onclick = async () => {
    if (!confirmAction) return;
    const action = confirmAction;
    confirmAction = null;
    try {
      await action();
    } catch (e) {
      error(e.message);
      hideConfirm();
    }
  };
  const keyboard = (event3) => {
    if (!player || event3.altKey || event3.ctrlKey || event3.metaKey || event3.target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "A"].includes(event3.target?.tagName)) return;
    if (event3.key === "ArrowLeft") {
      event3.preventDefault();
      player.previous();
    } else if (event3.key === "ArrowRight") {
      event3.preventDefault();
      player.next();
    } else if (event3.code === "Space") {
      event3.preventDefault();
      if (player.getState().playing) player.pause();
      else player.play();
    }
  };
  doc.addEventListener("keydown", keyboard);
  const destroy = () => {
    destroyed = true;
    epoch++;
    player?.destroy();
    doc.removeEventListener("keydown", keyboard);
  };
  win3.addEventListener("pagehide", destroy, { once: true });
  void refreshList().then(() => {
    const id = new URL(win3.location.href).searchParams.get("id");
    if (id && !destroyed) void openSaved(id);
  });
  return { openSaved, importFile, refreshList, destroy };
}
if (typeof document !== "undefined" && document.getElementById("replay-root")) mountReplay();
export {
  createReplayDisplaySession,
  createReplayPlayer,
  mountReplay,
  renderReplayView,
  replayDisplaySteps,
  replayFrameCaption,
  replayHandTiles,
  replayPublicCaption,
  replayRoundLabel,
  replayStepCaption
};
