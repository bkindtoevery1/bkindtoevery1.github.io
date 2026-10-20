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
function doraAfter(tile3) {
  if (!Number.isInteger(tile3) || tile3 < 0 || tile3 > 33) throw new Error("Invalid dora indicator");
  if (tile3 < 27) return Math.floor(tile3 / 9) * 9 + (tile3 % 9 + 1) % 9;
  if (tile3 < 31) return 27 + (tile3 - 27 + 1) % 4;
  return 31 + (tile3 - 31 + 1) % 3;
}
function physicalTiles(types, melds) {
  if (!Array.isArray(types) || !Array.isArray(melds) || melds.length > 4) return null;
  const all = [...types];
  for (const meld3 of melds) {
    if (!meld3 || !["chi", "pon", "kan"].includes(meld3.type) || !Number.isInteger(meld3.tile) || meld3.tile < 0 || meld3.tile > 33) return null;
    if (meld3.type === "chi") {
      if (meld3.tile >= 27 || meld3.tile % 9 > 6) return null;
      all.push(meld3.tile, meld3.tile + 1, meld3.tile + 2);
    } else all.push(...Array(meld3.type === "kan" ? 4 : 3).fill(meld3.tile));
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
    const score2 = {
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
    if (!best || receipt(score2) > receipt(best) || receipt(score2) === receipt(best) && (score2.han > best.han || score2.han === best.han && score2.fu > best.fu)) best = score2;
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
var exhaustedSeats = (s) => s.walls.flatMap((w, seat5) => w.length ? [] : [seat5]);
var threshold = (s) => exhaustedSeats(s).length >= s.rules.exhaustLimit;
function indicators(s, ura = false) {
  if (ura && !s.rules.uraDora) return [];
  const offset = s.rules.deadWall ? 4 : 0;
  const indices = [];
  if (ura || s.rules.dora) indices.push(0);
  if (s.rules.kanDora) for (let i = 1; i <= s.kans; i++) indices.push(i);
  return indices.map((i) => typeOf(s.dead[offset + 2 * i + (ura ? 1 : 0)]));
}
var revealedUraIndicators = (s) => s.end === "win" && s.winners.some((seat5) => s.players[seat5].riichi) ? indicators(s, true) : [];
function context(s, seat5, method, id) {
  const p = s.players[seat5], ids = [...p.hand, ...p.melds.flatMap((m) => m.ids)];
  if (method === "ron") ids.push(id);
  return {
    method,
    winTile: typeOf(id),
    seatWind: 27 + (seat5 - s.dealer + 4) % 4,
    dealer: seat5 === s.dealer,
    riichi: p.riichi,
    doubleRiichi: p.doubleRiichi,
    ippatsu: p.ippatsu,
    rinshan: p.drawSource === "kan" && method === "tsumo",
    tenhou: method === "tsumo" && seat5 === s.dealer && s.draws === 1 && s.calls === 0,
    chiihou: method === "tsumo" && seat5 !== s.dealer && p.river.length === 0 && s.calls === 0 && p.drawSource === "wall",
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
  for (let n = 0; n < 13; n++) for (let seat5 = 0; seat5 < 4; seat5++) s.players[seat5].hand.push(w.shift());
  s.initialHands = s.players.map((p) => [...p.hand]);
  for (let i = 0; i < w.length; i++) s.walls[i % 4].push(w[i]);
  for (const p of s.players) p.hand.sort((a, b) => a - b);
  draw(s, dealer);
  assertInvariants(s);
  return s;
}
function transfer(s, from, to, amount2, kind) {
  if (!Number.isSafeInteger(amount2) || amount2 <= 0) throw new Error("Invalid transfer");
  if (from === "pot") s.pot -= amount2;
  else s.players[from].score -= amount2;
  if (to === "pot") s.pot += amount2;
  else s.players[to].score += amount2;
  s.ledger.push({ from, to, amount: amount2, kind });
  if (kind === "riichi") s.players[from].stats.riichiPaid += amount2;
  else if (kind === "pot") s.players[to].stats.winReceipt += amount2;
  else if (kind === "draw") {
    s.players[from].stats.drawLoss += amount2;
    s.players[to].stats.drawGain += amount2;
  } else {
    s.players[from].stats[kind === "ron" ? "dealInLoss" : "tsumoPaid"] += amount2;
    s.players[to].stats.winReceipt += amount2;
  }
}
function draw(s, seat5, kan = false) {
  if (!s.walls[seat5].length) throw new Error("Cannot draw from exhausted personal wall");
  const p = s.players[seat5], id = s.walls[seat5].shift();
  p.hand.push(id);
  p.hand.sort((a, b) => a - b);
  p.drawn = id;
  p.drawSource = kan ? "kan" : "wall";
  p.passLock = false;
  p.forbidden = [];
  s.turn = seat5;
  s.phase = "turn";
  s.reaction = null;
  s.draws++;
  event(s, { type: kan ? "kanDraw" : "draw", seat: seat5, id });
}
function nextDraw(s, source) {
  if (threshold(s)) {
    settleDraw(s);
    return;
  }
  for (let off = 1; off <= 4; off++) {
    const seat5 = (source + off) % 4;
    if (s.walls[seat5].length) {
      draw(s, seat5);
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
function win(s, seat5, method, source, id, { finish = true } = {}) {
  const p = s.players[seat5], tiles2 = handTypes(p);
  if (method === "ron") tiles2.push(typeOf(id));
  const score2 = scoreRiichi(tiles2, p.melds, context(s, seat5, method, id), s.rules);
  if (!score2) throw new Error("Illegal riichi win");
  const first = s.ledger.length;
  const pao = p.pao && score2.yakuman && score2.yakuEntries.some((y) => y.id === p.pao.yaku) ? p.pao : null;
  if (pao) {
    const count = score2.yakumanCount ?? 1, portion = score2.points.ron / count;
    if (method === "tsumo") {
      transfer(s, pao.seat, seat5, portion, method);
      if (count > 1) {
        for (let from = 0; from < 4; from++) if (from !== seat5) {
          const amount2 = (from === s.dealer ? score2.points.tsumoDealer : score2.points.tsumoOther) * (count - 1) / count;
          transfer(s, from, seat5, amount2, method);
        }
      }
    } else if (source === pao.seat) transfer(s, source, seat5, score2.points.ron, method);
    else {
      transfer(s, pao.seat, seat5, portion / 2, method);
      transfer(s, source, seat5, score2.points.ron - portion / 2, method);
    }
  } else if (method === "ron") transfer(s, source, seat5, score2.points.ron, method);
  else for (let from = 0; from < 4; from++) if (from !== seat5) transfer(s, from, seat5, from === s.dealer ? score2.points.tsumoDealer : score2.points.tsumoOther, method);
  if (s.pot) transfer(s, "pot", seat5, s.pot, "pot");
  const payments2 = structuredClone(s.ledger.slice(first));
  p.won = true;
  p.win = {
    method,
    source,
    tile: id,
    order: s.winners.length + 1,
    drawNumber: s.draws,
    score: score2,
    payments: payments2,
    receipt: payments2.reduce((n, e) => n + e.amount, 0),
    ...pao ? { pao } : {}
  };
  p.drawn = null;
  s.winners.push(seat5);
  event(s, { type: "win", seat: seat5, ...p.win });
  if (finish) end(s, "win");
}
function visibleCounts(s, seat5) {
  const out = Array(34).fill(0), add = (id) => out[typeOf(id)]++;
  for (let i = 0; i < 4; i++) {
    const p = s.players[i];
    for (const m of p.melds) for (const id of m.ids) add(id);
    for (const d of p.river) if (!d.claimed) add(d.id);
    if (i === seat5 || s.phase === "end" && p.won) for (const id of p.hand) add(id);
  }
  for (const t of indicators(s)) out[t]++;
  return out;
}
function settleDraw(s) {
  if (s.phase === "end" || !threshold(s)) throw new Error("Cannot settle this board");
  const ready = s.players.flatMap((p, seat5) => {
    const waits = shapeWaits(handTypes(p), p.melds, s.rules);
    return waits.length ? [{ seat: seat5, waits }] : [];
  });
  if (ready.length && ready.length < 4) {
    const due = ready.map((p) => ({ seat: p.seat, amount: 3e3 / ready.length }));
    for (let from = 0; from < 4; from++) if (!ready.some((p) => p.seat === from)) {
      let debt = 3e3 / (4 - ready.length);
      for (const to of due) {
        const amount2 = Math.min(debt, to.amount);
        if (amount2) {
          transfer(s, from, to.seat, amount2, "draw");
          debt -= amount2;
          to.amount -= amount2;
        }
      }
    }
  }
  event(s, { type: "drawSettlement", ready, exhaustedSeats: exhaustedSeats(s) });
  end(s, "exhaustive-draw");
}
function canRon(s, seat5) {
  const p = s.players[seat5], r = s.reaction;
  if (!r || seat5 === r.source || p.passLock || p.riichiFuriten) return null;
  const waits = shapeWaits(handTypes(p), p.melds, s.rules);
  if (p.river.some((d) => waits.includes(typeOf(d.id)))) return null;
  return scoreRiichi([...handTypes(p), typeOf(r.id)], p.melds, context(s, seat5, "ron", r.id), s.rules);
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
function legalActions(s, seat5 = actor(s)) {
  if (seat5 === null || seat5 !== actor(s)) return [];
  const p = s.players[seat5], tiles2 = handTypes(p), c = counts(tiles2), out = [];
  if (s.phase === "turn") {
    if (p.drawn !== null && scoreRiichi(tiles2, p.melds, context(s, seat5, "tsumo", p.drawn), s.rules)) out.push({ type: "tsumo" });
    if (p.drawn !== null && s.walls[seat5].length && s.kans < s.rules.maxKans) {
      for (let t = 0; t < 34; t++) if (c[t] === 4 && (!p.riichi || riichiAnkanAllowed(p, t, s.rules))) out.push({ type: "ankan", tile: t });
      if (!p.riichi) p.melds.forEach((m, i) => {
        if (m.type === "pon" && c[m.tile]) out.push({ type: "kakan", meld: i });
      });
    }
    for (const id of p.hand) if (!p.forbidden.includes(typeOf(id)) && (!p.riichi || id === p.drawn)) {
      const tile3 = typeOf(id);
      out.push({ type: "discard", tile: tile3, id });
      if (!p.riichi && p.melds.every((m) => !m.open) && s.startingScores[seat5] + p.score >= 1e3 && remaining(s) >= 4 && s.walls[seat5].length && !threshold(s)) {
        const next = [...tiles2];
        next.splice(next.indexOf(tile3), 1);
        if (shapeWaits(next, p.melds, s.rules).length) out.push({ type: "riichi", tile: tile3, id });
      }
    }
  } else {
    const r = s.reaction, t = typeOf(r.id);
    if (canRon(s, seat5)) out.push({ type: "ron" });
    out.push({ type: "pass" });
    if (!p.riichi && r.kind === "discard" && !r.final && !s.pendingAbort && s.walls[seat5].length) {
      const candidates = [];
      if (c[t] >= 2) candidates.push({ type: "pon", tile: t });
      if (c[t] >= 3 && s.kans < s.rules.maxKans) candidates.push({ type: "minkan", tile: t });
      if (seat5 === (r.source + 1) % 4 && t < 27) for (let start = Math.max(Math.floor(t / 9) * 9, t - 2); start <= Math.min(Math.floor(t / 9) * 9 + 6, t); start++) {
        if ([start, start + 1, start + 2].filter((x) => x !== t).every((x) => c[x])) candidates.push({ type: "chi", tile: start });
      }
      for (const a of candidates) {
        if (a.type === "minkan") {
          out.push(a);
          continue;
        }
        const cc = [...c];
        for (const x of a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x2) => x2 !== t) : [t, t]) cc[x]--;
        if (cc.some((n, tile3) => n && !forbiddenForCall(a, t).includes(tile3))) out.push(a);
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
function completeKan(s, seat5, details = {}) {
  cancelIppatsu(s);
  s.kans++;
  s.calls++;
  event(s, { type: "kan", seat: seat5, ...details });
  if (s.rules.abortFourKans && s.kans === 4 && s.players.filter((p) => p.melds.some((m) => m.type === "kan")).length > 1) s.pendingAbort = "four-kans";
  draw(s, seat5, true);
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
  const { seat: seat5, action: a } = calls[0], p = s.players[seat5], t = typeOf(r.id);
  const ids = [...remove(p, a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x) => x !== t) : Array(a.type === "minkan" ? 3 : 2).fill(t)), r.id];
  s.players[r.source].river.at(-1).claimed = true;
  p.melds.push({ type: a.type === "chi" ? "chi" : a.type === "minkan" ? "kan" : "pon", tile: a.tile, open: true, from: r.source, ids });
  const open = p.melds.filter((m) => m.open && m.type !== "chi");
  const paoYaku = a.type !== "chi" && (t >= 31 && open.filter((m) => m.tile >= 31).length === 3 ? "bigThreeDragons" : t >= 27 && t < 31 && open.filter((m) => m.tile >= 27 && m.tile < 31).length === 4 ? "bigFourWinds" : null);
  if (paoYaku) p.pao = { seat: r.source, yaku: paoYaku };
  p.drawn = null;
  p.drawSource = null;
  p.forbidden = forbiddenForCall(a, t);
  s.turn = seat5;
  s.phase = "turn";
  s.reaction = null;
  event(s, { type: "call", seat: seat5, action: a, from: r.source, tileId: r.id, ids: [...ids] });
  if (a.type === "minkan") completeKan(s, seat5, { callType: "minkan", tileId: r.id, ids: [...ids], from: r.source });
}
function canonicalAction(s, seat5, action) {
  if (!action || typeof action !== "object") return null;
  const legal = legalActions(s, seat5);
  if (["discard", "riichi"].includes(action.type)) {
    const matching = legal.filter((a) => a.type === action.type && (action.tile === void 0 || a.tile === action.tile) && (action.id === void 0 || a.id === action.id));
    if (action.tile === void 0 && action.id === void 0) return null;
    return matching.find((a) => !RED_IDS.has(a.id)) ?? matching[0];
  }
  return legal.find((a) => same(a, action));
}
function step(s, seat5, action, { validate = true } = {}) {
  const a = canonicalAction(s, seat5, action);
  if (!a) throw new Error(`Illegal action by ${seat5}`);
  const p = s.players[seat5];
  const kakanId = a.type === "kakan" ? p.hand.find((id) => typeOf(id) === p.melds[a.meld].tile && !RED_IDS.has(id)) ?? p.hand.find((id) => typeOf(id) === p.melds[a.meld].tile) : null;
  event(s, { type: "action", seat: seat5, action: { ...a }, ...a.type === "kakan" ? { tileId: kakanId, meldIds: [...p.melds[a.meld].ids] } : {} });
  if (s.phase === "reaction") {
    const r = s.reaction;
    if (a.type !== "ron" && canRon(s, seat5)) {
      p.passLock = true;
      p.stats.ronDeclined++;
      if (p.riichi) p.riichiFuriten = true;
    }
    r.answers.push({ seat: seat5, action: { ...a } });
    r.pending.shift();
    if (!r.pending.length) resolve(s);
  } else if (a.type === "tsumo") win(s, seat5, "tsumo", seat5, p.drawn);
  else if (a.type === "discard" || a.type === "riichi") {
    p.hand.splice(p.hand.indexOf(a.id), 1);
    if (p.riichi) p.ippatsu = false;
    p.river.push({ id: a.id, claimed: false, riichi: a.type === "riichi" });
    p.drawn = null;
    p.drawSource = null;
    p.forbidden = [];
    reaction(s, seat5, a.id, "discard", { riichi: a.type === "riichi" });
  } else if (a.type === "ankan") {
    const ids = remove(p, Array(4).fill(a.tile));
    p.melds.push({ type: "kan", tile: a.tile, open: false, from: seat5, ids });
    p.stats.closedKans++;
    completeKan(s, seat5, { callType: "ankan", ids: [...ids] });
  } else if (a.type === "kakan") {
    cancelIppatsu(s);
    reaction(s, seat5, kakanId, "kakan", { meld: a.meld });
  }
  if (validate) assertInvariants(s);
  return s;
}
var tileView = (id, s, drawn = null) => ({ id, type: typeOf(id), tile: typeOf(id), red: red(id, s.rules), drawn: id === drawn });
var meldView = (m, s) => ({ ...structuredClone(m), tiles: m.ids.map((id) => tileView(id, s)) });
function publicEvents(s) {
  const out = [], discards = Array(4).fill(null), pendingKan = Array(4).fill(null), melds = Array.from({ length: 4 }, () => []);
  const physical4 = (id) => Number.isInteger(id) && id >= 0 && id < 136 ? id : null;
  const preview = (seat5, index, tile3, callType) => {
    const count = ["ankan", "kakan", "minkan"].includes(callType) ? 4 : 3;
    const ids = s.players[seat5]?.melds[index]?.ids?.slice(0, count);
    if (ids?.length === count) return ids.map((id) => ({ type: typeOf(id), red: red(id, s.rules) })).sort((a, b) => a.type - b.type);
    const types = callType === "chi" ? [tile3, tile3 + 1, tile3 + 2] : Array(count).fill(tile3);
    return types.filter((type) => Number.isInteger(type) && type >= 0 && type < 34).map((type) => ({ type, red: false }));
  };
  const emit = (raw, kind, { tile: tile3 = null, tileId = null, source = null, callType = null, method = null, tiles: tiles2 } = {}) => {
    const id = physical4(tileId), type = id === null ? tile3 : typeOf(id);
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
    const seat5 = raw.seat, a = raw.action;
    if (raw.type === "action") {
      if (a?.type === "discard" || a?.type === "riichi") discards[seat5] = emit(raw, "discard", { tile: a.tile, tileId: a.id });
      else if (a?.type === "ankan") pendingKan[seat5] = { tile: a.tile, callType: "ankan", index: melds[seat5].length };
      else if (a?.type === "kakan") pendingKan[seat5] = { tile: melds[seat5][a.meld]?.tile ?? null, callType: "kakan", index: a.meld };
    } else if (raw.type === "call" && ["chi", "pon", "minkan"].includes(a?.type)) {
      const source = Number.isInteger(raw.from) && raw.from >= 0 && raw.from < 4 ? raw.from : null;
      const discard = source === null ? null : discards[source], index = melds[seat5].length;
      melds[seat5].push({ tile: a.tile, type: a.type });
      if (a.type === "minkan") pendingKan[seat5] = { tile: a.tile, tileId: discard?.tileId ?? null, source, callType: "minkan", index };
      else emit(raw, "call", {
        tile: discard?.tile ?? a.tile,
        tileId: discard?.tileId ?? null,
        source,
        callType: a.type,
        tiles: preview(seat5, index, a.tile, a.type)
      });
    } else if (raw.type === "kan") {
      const accepted = pendingKan[seat5];
      if (!accepted) continue;
      const { tile: tile3, source = null, callType, index } = accepted, ids = s.players[seat5]?.melds[index]?.ids ?? [];
      let tileId = accepted.tileId ?? null;
      if (callType === "kakan") tileId = ids[3] ?? null;
      else if (callType === "ankan") tileId = ids.find((id) => red(id, s.rules)) ?? ids[0] ?? null;
      emit(raw, "kan", { tile: tile3, tileId, source, callType, tiles: preview(seat5, index, tile3, callType) });
      if (callType === "ankan") melds[seat5].push({ tile: tile3, type: "ankan" });
      else if (melds[seat5][index]) melds[seat5][index].type = callType;
      pendingKan[seat5] = null;
    } else if (raw.type === "riichi") {
      const discard = discards[seat5];
      emit(raw, "riichi", { tile: discard?.tile ?? null, tileId: discard?.tileId ?? null });
    } else if (raw.type === "win") emit(raw, "win", {
      tileId: raw.tile,
      source: raw.method === "ron" ? raw.source : null,
      method: raw.method
    });
  }
  return out.slice(-32);
}
function snapshot(s, seat5) {
  if (!Number.isInteger(seat5) || seat5 < 0 || seat5 > 3) throw new Error("Invalid seat");
  const p = s.players[seat5];
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
    seat: seat5,
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
    legalActions: legalActions(s, seat5),
    doraIndicators: indicators(s),
    uraIndicators: revealedUraIndicators(s),
    wallRemaining: remaining(s),
    ownWallRemaining: s.walls[seat5].length,
    exhaustedSeats: exhaustedSeats(s),
    draws: s.draws,
    kans: s.kans,
    pot: s.pot,
    winners: [...s.winners],
    riichi: p.riichi,
    visible: visibleCounts(s, seat5),
    publicEvents: publicEvents(s),
    lastDiscard: s.reaction ? { seat: s.reaction.source, ...tileView(s.reaction.id, s), kind: s.reaction.kind, final: s.reaction.final } : null,
    readySeats: s.phase === "end" ? s.events.findLast((e) => e.type === "drawSettlement")?.ready.map((p2) => p2.seat) ?? [] : []
  };
}
function observation(s, seat5 = actor(s)) {
  if (seat5 !== actor(s)) throw new Error("Not this player\u2019s decision");
  return snapshot(s, seat5);
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
  for (let seat5 = 0; seat5 < 4; seat5++) {
    const p = s.players[seat5], extra = s.phase === "turn" && s.turn === seat5 || s.phase === "reaction" && s.reaction.kind === "kakan" && s.reaction.source === seat5 || p.win?.method === "tsumo";
    if (p.hand.length + 3 * p.melds.length !== (extra ? 14 : 13)) throw new Error(`Hand size violated seat ${seat5}`);
    for (const m of p.melds) {
      const wanted = m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : Array(m.type === "kan" ? 4 : 3).fill(m.tile);
      if (!same(m.ids.map(typeOf).sort((a, b) => a - b), wanted)) throw new Error("Illegal meld");
    }
    const st = p.stats;
    if (p.score !== st.winReceipt + st.drawGain - st.dealInLoss - st.tsumoPaid - st.drawLoss - st.riichiPaid) throw new Error("Ledger attribution violated");
  }
  if (s.dead.length !== reservedTileCount(s.rules) || s.kans > s.rules.maxKans || s.winners.length > (s.rules.multipleRon === "all" ? 3 : 1) || s.winners.length !== s.players.filter((p) => p.won).length || new Set(s.winners).size !== s.winners.length) throw new Error("Round invariant violated");
  if (s.winners.length > 1 && s.winners.some((seat5) => {
    const w = s.players[seat5].win, f = s.players[s.winners[0]].win;
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
var exhaustedSeats2 = (s) => s.walls.flatMap((w, seat5) => w.length ? [] : [seat5]);
function indicators2(s, ura = false) {
  if (ura && !s.rules.uraDora) return [];
  const offset = s.rules.deadWall ? 4 : 0;
  const indices = [];
  if (ura || s.rules.dora) indices.push(0);
  if (s.rules.kanDora) for (let i = 1; i <= s.kans; i++) indices.push(i);
  return indices.map((i) => typeOf(s.dead[offset + 2 * i + (ura ? 1 : 0)]));
}
var revealedUraIndicators2 = (s) => s.end === "win" && s.winners.some((seat5) => s.players[seat5].riichi) ? indicators2(s, true) : [];
function context2(s, seat5, method, id) {
  const p = s.players[seat5], ids = [...p.hand, ...p.melds.flatMap((m) => m.ids)];
  if (method === "ron") ids.push(id);
  return {
    method,
    winTile: typeOf(id),
    seatWind: 27 + (seat5 - s.dealer + 4) % 4,
    dealer: seat5 === s.dealer,
    riichi: p.riichi,
    doubleRiichi: p.doubleRiichi,
    ippatsu: p.ippatsu,
    rinshan: p.drawSource === "kan" && method === "tsumo",
    tenhou: method === "tsumo" && seat5 === s.dealer && s.draws === 1 && s.calls === 0,
    chiihou: method === "tsumo" && seat5 !== s.dealer && p.river.length === 0 && s.calls === 0 && p.drawSource === "wall",
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
  for (let n = 0; n < 13; n++) for (let seat5 = 0; seat5 < 4; seat5++) s.players[seat5].hand.push(w.shift());
  s.initialHands = s.players.map((p) => [...p.hand]);
  for (let i = 0; i < w.length; i++) s.walls[i % 4].push(w[i]);
  for (const p of s.players) p.hand.sort((a, b) => a - b);
  draw2(s, dealer);
  assertInvariants2(s);
  return s;
}
function transfer2(s, from, to, amount2, kind) {
  if (!Number.isSafeInteger(amount2) || amount2 <= 0) throw new Error("Invalid transfer");
  if (from === "pot") s.pot -= amount2;
  else s.players[from].score -= amount2;
  if (to === "pot") s.pot += amount2;
  else s.players[to].score += amount2;
  s.ledger.push({ from, to, amount: amount2, kind });
  if (kind === "riichi") s.players[from].stats.riichiPaid += amount2;
  else if (kind === "pot") s.players[to].stats.winReceipt += amount2;
  else if (kind === "draw") {
    s.players[from].stats.drawLoss += amount2;
    s.players[to].stats.drawGain += amount2;
  } else {
    s.players[from].stats[kind === "ron" ? "dealInLoss" : "tsumoPaid"] += amount2;
    s.players[to].stats.winReceipt += amount2;
  }
}
function receiveTurn(s, seat5, via) {
  s.turn = seat5;
  s.phase = "turn";
  s.reaction = null;
  if (!s.milLastTurn && !s.walls[(seat5 + 1) % 4].length) s.milLastTurn = { seat: seat5, via };
}
function draw2(s, seat5, kan = false) {
  if (!s.walls[seat5].length) throw new Error("Cannot draw from exhausted personal wall");
  const p = s.players[seat5], id = s.walls[seat5].shift();
  p.hand.push(id);
  p.hand.sort((a, b) => a - b);
  p.drawn = id;
  p.drawSource = kan ? "kan" : "wall";
  p.passLock = false;
  p.forbidden = [];
  receiveTurn(s, seat5, kan ? "kan" : "draw");
  s.draws++;
  event2(s, { type: kan ? "kanDraw" : "draw", seat: seat5, id });
}
function nextDraw2(s, source) {
  const seat5 = (source + 1) % 4;
  if (!s.walls[seat5].length) {
    settleDraw2(s);
    return;
  }
  draw2(s, seat5);
}
function end2(s, reason) {
  s.end = reason;
  s.phase = "end";
  s.reaction = null;
  event2(s, { type: "end", reason });
}
function win2(s, seat5, method, source, id, { finish = true } = {}) {
  const p = s.players[seat5], tiles2 = handTypes2(p);
  if (method === "ron") tiles2.push(typeOf(id));
  const score2 = scoreRiichi(tiles2, p.melds, context2(s, seat5, method, id), s.rules);
  if (!score2) throw new Error("Illegal riichi win");
  const first = s.ledger.length;
  const pao = p.pao && score2.yakuman && score2.yakuEntries.some((y) => y.id === p.pao.yaku) ? p.pao : null;
  if (pao) {
    const count = score2.yakumanCount ?? 1, portion = score2.points.ron / count;
    if (method === "tsumo") {
      transfer2(s, pao.seat, seat5, portion, method);
      if (count > 1) {
        for (let from = 0; from < 4; from++) if (from !== seat5) {
          const amount2 = (from === s.dealer ? score2.points.tsumoDealer : score2.points.tsumoOther) * (count - 1) / count;
          transfer2(s, from, seat5, amount2, method);
        }
      }
    } else if (source === pao.seat) transfer2(s, source, seat5, score2.points.ron, method);
    else {
      transfer2(s, pao.seat, seat5, portion / 2, method);
      transfer2(s, source, seat5, score2.points.ron - portion / 2, method);
    }
  } else if (method === "ron") transfer2(s, source, seat5, score2.points.ron, method);
  else for (let from = 0; from < 4; from++) if (from !== seat5) transfer2(s, from, seat5, from === s.dealer ? score2.points.tsumoDealer : score2.points.tsumoOther, method);
  if (s.pot) transfer2(s, "pot", seat5, s.pot, "pot");
  const payments2 = structuredClone(s.ledger.slice(first));
  p.won = true;
  p.win = {
    method,
    source,
    tile: id,
    order: s.winners.length + 1,
    drawNumber: s.draws,
    score: score2,
    payments: payments2,
    receipt: payments2.reduce((n, e) => n + e.amount, 0),
    ...pao ? { pao } : {}
  };
  p.drawn = null;
  s.winners.push(seat5);
  event2(s, { type: "win", seat: seat5, ...p.win });
  if (finish) end2(s, "win");
}
function visibleCounts2(s, seat5) {
  const out = Array(34).fill(0), add = (id) => out[typeOf(id)]++;
  for (let i = 0; i < 4; i++) {
    const p = s.players[i];
    for (const m of p.melds) for (const id of m.ids) add(id);
    for (const d of p.river) if (!d.claimed) add(d.id);
    if (i === seat5 || s.phase === "end" && p.won) for (const id of p.hand) add(id);
  }
  for (const t of indicators2(s)) out[t]++;
  return out;
}
function settleDraw2(s) {
  const r = s.reaction;
  if (s.phase !== "reaction" || !s.milLastTurn || !r || r.kind !== "discard" || !r.final || r.source !== s.milLastTurn.seat || r.pending.length || r.answers.length !== 3 || r.answers.some((answer) => answer.action.type === "ron")) throw new Error("Cannot settle this board");
  const ready = s.players.flatMap((p, seat5) => {
    const waits = shapeWaits(handTypes2(p), p.melds, s.rules);
    return waits.length ? [{ seat: seat5, waits }] : [];
  });
  if (ready.length && ready.length < 4) {
    const due = ready.map((p) => ({ seat: p.seat, amount: 3e3 / ready.length }));
    for (let from = 0; from < 4; from++) if (!ready.some((p) => p.seat === from)) {
      let debt = 3e3 / (4 - ready.length);
      for (const to of due) {
        const amount2 = Math.min(debt, to.amount);
        if (amount2) {
          transfer2(s, from, to.seat, amount2, "draw");
          debt -= amount2;
          to.amount -= amount2;
        }
      }
    }
  }
  event2(s, { type: "drawSettlement", ready, exhaustedSeats: exhaustedSeats2(s) });
  end2(s, "exhaustive-draw");
}
function canRon2(s, seat5) {
  const p = s.players[seat5], r = s.reaction;
  if (!r || seat5 === r.source || p.passLock || p.riichiFuriten) return null;
  const waits = shapeWaits(handTypes2(p), p.melds, s.rules);
  if (p.river.some((d) => waits.includes(typeOf(d.id)))) return null;
  return scoreRiichi([...handTypes2(p), typeOf(r.id)], p.melds, context2(s, seat5, "ron", r.id), s.rules);
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
function legalActions2(s, seat5 = actor2(s)) {
  if (seat5 === null || seat5 !== actor2(s)) return [];
  const p = s.players[seat5], tiles2 = handTypes2(p), c = counts(tiles2), out = [];
  if (s.phase === "turn") {
    if (p.drawn !== null && scoreRiichi(tiles2, p.melds, context2(s, seat5, "tsumo", p.drawn), s.rules)) out.push({ type: "tsumo" });
    if (!s.milLastTurn && p.drawn !== null && s.walls[seat5].length && s.kans < s.rules.maxKans) {
      for (let t = 0; t < 34; t++) if (c[t] === 4 && (!p.riichi || riichiAnkanAllowed2(p, t, s.rules))) out.push({ type: "ankan", tile: t });
      if (!p.riichi) p.melds.forEach((m, i) => {
        if (m.type === "pon" && c[m.tile]) out.push({ type: "kakan", meld: i });
      });
    }
    for (const id of p.hand) if (!p.forbidden.includes(typeOf(id)) && (!p.riichi || id === p.drawn)) {
      const tile3 = typeOf(id);
      out.push({ type: "discard", tile: tile3, id });
      if (!p.riichi && p.melds.every((m) => !m.open) && s.startingScores[seat5] + p.score >= 1e3 && remaining2(s) >= 4 && s.walls[seat5].length && !s.milLastTurn) {
        const next = [...tiles2];
        next.splice(next.indexOf(tile3), 1);
        if (shapeWaits(next, p.melds, s.rules).length) out.push({ type: "riichi", tile: tile3, id });
      }
    }
  } else {
    const r = s.reaction, t = typeOf(r.id);
    if (canRon2(s, seat5)) out.push({ type: "ron" });
    out.push({ type: "pass" });
    if (!p.riichi && r.kind === "discard" && !r.final && !s.pendingAbort) {
      const candidates = [];
      if (c[t] >= 2) candidates.push({ type: "pon", tile: t });
      if (c[t] >= 3 && s.walls[seat5].length && s.kans < s.rules.maxKans) candidates.push({ type: "minkan", tile: t });
      if (seat5 === (r.source + 1) % 4 && t < 27) for (let start = Math.max(Math.floor(t / 9) * 9, t - 2); start <= Math.min(Math.floor(t / 9) * 9 + 6, t); start++) {
        if ([start, start + 1, start + 2].filter((x) => x !== t).every((x) => c[x])) candidates.push({ type: "chi", tile: start });
      }
      for (const a of candidates) {
        if (a.type === "minkan") {
          out.push(a);
          continue;
        }
        const cc = [...c];
        for (const x of a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x2) => x2 !== t) : [t, t]) cc[x]--;
        if (cc.some((n, tile3) => n && !forbiddenForCall2(a, t).includes(tile3))) out.push(a);
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
function completeKan2(s, seat5, details = {}) {
  cancelIppatsu2(s);
  s.kans++;
  s.calls++;
  event2(s, { type: "kan", seat: seat5, ...details });
  if (s.rules.abortFourKans && s.kans === 4 && s.players.filter((p) => p.melds.some((m) => m.type === "kan")).length > 1) s.pendingAbort = "four-kans";
  draw2(s, seat5, true);
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
  const { seat: seat5, action: a } = calls[0], p = s.players[seat5], t = typeOf(r.id);
  const ids = [...remove2(p, a.type === "chi" ? [a.tile, a.tile + 1, a.tile + 2].filter((x) => x !== t) : Array(a.type === "minkan" ? 3 : 2).fill(t)), r.id];
  s.players[r.source].river.at(-1).claimed = true;
  p.melds.push({ type: a.type === "chi" ? "chi" : a.type === "minkan" ? "kan" : "pon", tile: a.tile, open: true, from: r.source, ids });
  const open = p.melds.filter((m) => m.open && m.type !== "chi");
  const paoYaku = a.type !== "chi" && (t >= 31 && open.filter((m) => m.tile >= 31).length === 3 ? "bigThreeDragons" : t >= 27 && t < 31 && open.filter((m) => m.tile >= 27 && m.tile < 31).length === 4 ? "bigFourWinds" : null);
  if (paoYaku) p.pao = { seat: r.source, yaku: paoYaku };
  p.drawn = null;
  p.drawSource = null;
  p.forbidden = forbiddenForCall2(a, t);
  receiveTurn(s, seat5, a.type);
  event2(s, { type: "call", seat: seat5, action: a, from: r.source, tileId: r.id, ids: [...ids] });
  if (a.type === "minkan") completeKan2(s, seat5, { callType: "minkan", tileId: r.id, ids: [...ids], from: r.source });
}
function canonicalAction2(s, seat5, action) {
  if (!action || typeof action !== "object") return null;
  const legal = legalActions2(s, seat5);
  if (["discard", "riichi"].includes(action.type)) {
    const matching = legal.filter((a) => a.type === action.type && (action.tile === void 0 || a.tile === action.tile) && (action.id === void 0 || a.id === action.id));
    if (action.tile === void 0 && action.id === void 0) return null;
    return matching.find((a) => !RED_IDS2.has(a.id)) ?? matching[0];
  }
  return legal.find((a) => same2(a, action));
}
function step2(s, seat5, action, { validate = true } = {}) {
  const a = canonicalAction2(s, seat5, action);
  if (!a) throw new Error(`Illegal action by ${seat5}`);
  const p = s.players[seat5];
  const kakanId = a.type === "kakan" ? p.hand.find((id) => typeOf(id) === p.melds[a.meld].tile && !RED_IDS2.has(id)) ?? p.hand.find((id) => typeOf(id) === p.melds[a.meld].tile) : null;
  event2(s, { type: "action", seat: seat5, action: { ...a }, ...a.type === "kakan" ? { tileId: kakanId, meldIds: [...p.melds[a.meld].ids] } : {} });
  if (s.phase === "reaction") {
    const r = s.reaction;
    if (a.type !== "ron" && canRon2(s, seat5)) {
      p.passLock = true;
      p.stats.ronDeclined++;
      if (p.riichi) p.riichiFuriten = true;
    }
    r.answers.push({ seat: seat5, action: { ...a } });
    r.pending.shift();
    if (!r.pending.length) resolve2(s);
  } else if (a.type === "tsumo") win2(s, seat5, "tsumo", seat5, p.drawn);
  else if (a.type === "discard" || a.type === "riichi") {
    p.hand.splice(p.hand.indexOf(a.id), 1);
    if (p.riichi) p.ippatsu = false;
    p.river.push({ id: a.id, claimed: false, riichi: a.type === "riichi" });
    p.drawn = null;
    p.drawSource = null;
    p.forbidden = [];
    reaction2(s, seat5, a.id, "discard", { riichi: a.type === "riichi" });
  } else if (a.type === "ankan") {
    const ids = remove2(p, Array(4).fill(a.tile));
    p.melds.push({ type: "kan", tile: a.tile, open: false, from: seat5, ids });
    p.stats.closedKans++;
    completeKan2(s, seat5, { callType: "ankan", ids: [...ids] });
  } else if (a.type === "kakan") {
    cancelIppatsu2(s);
    reaction2(s, seat5, kakanId, "kakan", { meld: a.meld });
  }
  if (validate) assertInvariants2(s);
  return s;
}
var tileView2 = (id, s, drawn = null) => ({ id, type: typeOf(id), tile: typeOf(id), red: red2(id, s.rules), drawn: id === drawn });
var meldView2 = (m, s) => ({ ...structuredClone(m), tiles: m.ids.map((id) => tileView2(id, s)) });
function publicEvents2(s) {
  const out = [], discards = Array(4).fill(null), pendingKan = Array(4).fill(null), melds = Array.from({ length: 4 }, () => []);
  const physical4 = (id) => Number.isInteger(id) && id >= 0 && id < 136 ? id : null;
  const preview = (seat5, index, tile3, callType) => {
    const count = ["ankan", "kakan", "minkan"].includes(callType) ? 4 : 3;
    const ids = s.players[seat5]?.melds[index]?.ids?.slice(0, count);
    if (ids?.length === count) return ids.map((id) => ({ type: typeOf(id), red: red2(id, s.rules) })).sort((a, b) => a.type - b.type);
    const types = callType === "chi" ? [tile3, tile3 + 1, tile3 + 2] : Array(count).fill(tile3);
    return types.filter((type) => Number.isInteger(type) && type >= 0 && type < 34).map((type) => ({ type, red: false }));
  };
  const emit = (raw, kind, { tile: tile3 = null, tileId = null, source = null, callType = null, method = null, tiles: tiles2 } = {}) => {
    const id = physical4(tileId), type = id === null ? tile3 : typeOf(id);
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
    const seat5 = raw.seat, a = raw.action;
    if (raw.type === "action") {
      if (a?.type === "discard" || a?.type === "riichi") discards[seat5] = emit(raw, "discard", { tile: a.tile, tileId: a.id });
      else if (a?.type === "ankan") pendingKan[seat5] = { tile: a.tile, callType: "ankan", index: melds[seat5].length };
      else if (a?.type === "kakan") pendingKan[seat5] = { tile: melds[seat5][a.meld]?.tile ?? null, callType: "kakan", index: a.meld };
    } else if (raw.type === "call" && ["chi", "pon", "minkan"].includes(a?.type)) {
      const source = Number.isInteger(raw.from) && raw.from >= 0 && raw.from < 4 ? raw.from : null;
      const discard = source === null ? null : discards[source], index = melds[seat5].length;
      melds[seat5].push({ tile: a.tile, type: a.type });
      if (a.type === "minkan") pendingKan[seat5] = { tile: a.tile, tileId: discard?.tileId ?? null, source, callType: "minkan", index };
      else emit(raw, "call", {
        tile: discard?.tile ?? a.tile,
        tileId: discard?.tileId ?? null,
        source,
        callType: a.type,
        tiles: preview(seat5, index, a.tile, a.type)
      });
    } else if (raw.type === "kan") {
      const accepted = pendingKan[seat5];
      if (!accepted) continue;
      const { tile: tile3, source = null, callType, index } = accepted, ids = s.players[seat5]?.melds[index]?.ids ?? [];
      let tileId = accepted.tileId ?? null;
      if (callType === "kakan") tileId = ids[3] ?? null;
      else if (callType === "ankan") tileId = ids.find((id) => red2(id, s.rules)) ?? ids[0] ?? null;
      emit(raw, "kan", { tile: tile3, tileId, source, callType, tiles: preview(seat5, index, tile3, callType) });
      if (callType === "ankan") melds[seat5].push({ tile: tile3, type: "ankan" });
      else if (melds[seat5][index]) melds[seat5][index].type = callType;
      pendingKan[seat5] = null;
    } else if (raw.type === "riichi") {
      const discard = discards[seat5];
      emit(raw, "riichi", { tile: discard?.tile ?? null, tileId: discard?.tileId ?? null });
    } else if (raw.type === "win") emit(raw, "win", {
      tileId: raw.tile,
      source: raw.method === "ron" ? raw.source : null,
      method: raw.method
    });
  }
  return out.slice(-32);
}
function snapshot2(s, seat5) {
  if (!Number.isInteger(seat5) || seat5 < 0 || seat5 > 3) throw new Error("Invalid seat");
  const p = s.players[seat5];
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
    seat: seat5,
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
    legalActions: legalActions2(s, seat5),
    doraIndicators: indicators2(s),
    uraIndicators: revealedUraIndicators2(s),
    wallRemaining: remaining2(s),
    ownWallRemaining: s.walls[seat5].length,
    exhaustedSeats: exhaustedSeats2(s),
    draws: s.draws,
    kans: s.kans,
    pot: s.pot,
    winners: [...s.winners],
    riichi: p.riichi,
    visible: visibleCounts2(s, seat5),
    publicEvents: publicEvents2(s),
    lastDiscard: s.reaction ? { seat: s.reaction.source, ...tileView2(s.reaction.id, s), kind: s.reaction.kind, final: s.reaction.final } : null,
    readySeats: s.phase === "end" ? s.events.findLast((e) => e.type === "drawSettlement")?.ready.map((p2) => p2.seat) ?? [] : []
  };
}
function observation2(s, seat5 = actor2(s)) {
  if (seat5 !== actor2(s)) throw new Error("Not this player\u2019s decision");
  return snapshot2(s, seat5);
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
  for (let seat5 = 0; seat5 < 4; seat5++) {
    const p = s.players[seat5], extra = s.phase === "turn" && s.turn === seat5 || s.phase === "reaction" && s.reaction.kind === "kakan" && s.reaction.source === seat5 || p.win?.method === "tsumo";
    if (p.hand.length + 3 * p.melds.length !== (extra ? 14 : 13)) throw new Error(`Hand size violated seat ${seat5}`);
    for (const m of p.melds) {
      const wanted = m.type === "chi" ? [m.tile, m.tile + 1, m.tile + 2] : Array(m.type === "kan" ? 4 : 3).fill(m.tile);
      if (!same2(m.ids.map(typeOf).sort((a, b) => a - b), wanted)) throw new Error("Illegal meld");
    }
    const st = p.stats;
    if (p.score !== st.winReceipt + st.drawGain - st.dealInLoss - st.tsumoPaid - st.drawLoss - st.riichiPaid) throw new Error("Ledger attribution violated");
  }
  if (s.dead.length !== reservedTileCount(s.rules) || s.kans > s.rules.maxKans || s.winners.length > (s.rules.multipleRon === "all" ? 3 : 1) || s.winners.length !== s.players.filter((p) => p.won).length || new Set(s.winners).size !== s.winners.length) throw new Error("Round invariant violated");
  if (s.winners.length > 1 && s.winners.some((seat5) => {
    const w = s.players[seat5].win, f = s.players[s.winners[0]].win;
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
var legalActions3 = (game, seat5 = actor3(game)) => engineFor(game).legalActions(game, seat5);
var assertInvariants3 = (game) => engineFor(game).assertInvariants(game);
var publicEvents3 = (game) => engineFor(game).publicEvents(game);
function addHonba(game) {
  const honba = honbaOf(game), seat5 = game.winners[0];
  if (!honba || seat5 === void 0) return;
  const winner = game.players[seat5], win3 = winner.win, amount2 = honba * 300;
  if (!Number.isSafeInteger(amount2)) throw new Error("Honba payment exceeds the supported range");
  const moves = win3.pao ? [{ from: win3.pao.seat, to: seat5, amount: amount2, kind: win3.method, honba: true }] : win3.method === "ron" ? [{ from: win3.source, to: seat5, amount: amount2, kind: "ron", honba: true }] : [0, 1, 2, 3].filter((from) => from !== seat5).map((from) => ({ from, to: seat5, amount: honba * 100, kind: "tsumo", honba: true }));
  const scores = game.players.map((p) => p.score), stats = game.players.map((p) => ({ ...p.stats }));
  for (const move of moves) {
    scores[move.from] -= move.amount;
    scores[seat5] += move.amount;
    stats[move.from][move.kind === "ron" ? "dealInLoss" : "tsumoPaid"] += move.amount;
    stats[seat5].winReceipt += move.amount;
  }
  if (scores.some((n) => !Number.isSafeInteger(n)) || stats.some((s) => Object.values(s).some((n) => !Number.isSafeInteger(n))) || !Number.isSafeInteger(win3.receipt + amount2)) throw new Error("Honba settlement exceeds the supported range");
  for (let i = 0; i < 4; i++) {
    game.players[i].score = scores[i];
    Object.assign(game.players[i].stats, stats[i]);
  }
  game.ledger.push(...moves);
  win3.payments.push(...structuredClone(moves));
  win3.receipt += amount2;
  win3.honba = honba;
  win3.honbaReceipt = amount2;
  const event3 = game.events.findLast((event4) => event4.type === "win" && event4.seat === seat5);
  if (event3) Object.assign(event3, { payments: structuredClone(win3.payments), receipt: win3.receipt, honba, honbaReceipt: amount2 });
}
function step3(game, seat5, action, options = {}) {
  const engine = engineFor(game);
  const honba = honbaOf(game);
  if (!Number.isSafeInteger(honba * 300)) throw new Error("Honba payment exceeds the supported range");
  const prior = game.winners.length;
  const couldWin = honba > 0 && (game.phase === "turn" && action?.type === "tsumo" || game.phase === "reaction" && game.reaction.pending.length === 1 && (action?.type === "ron" || game.reaction.answers.some((answer) => answer.action.type === "ron")));
  if (couldWin) {
    const next = structuredClone(game);
    engine.step(next, seat5, action, options);
    if (prior === 0 && next.winners.length) addHonba(next);
    if (options.validate !== false) engine.assertInvariants(next);
    Object.assign(game, next);
    return game;
  }
  engine.step(game, seat5, action, options);
  return game;
}
function snapshot3(game, seat5) {
  return { ...engineFor(game).snapshot(game, seat5), honba: honbaOf(game), duplicateProfile: normalizeDuplicateProfile(game.duplicateProfile) };
}

// duplicate/basic-ai.mjs
var RED_IDS3 = /* @__PURE__ */ new Set([16, 52, 88]);
var ORPHANS3 = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
var physical = (id) => Number.isInteger(id) && id >= 0 && id < 136;
var simple = (type) => type < 27 && type % 9 !== 0 && type % 9 !== 8;
var distance2 = (c, melds) => Math.min(shanten(c, melds), melds ? 8 : 13 - ORPHANS3.filter((type) => c[type]).length - Number(ORPHANS3.some((type) => c[type] >= 2)));
var meldTypes = (meld3) => meld3.type === "chi" ? [meld3.tile, meld3.tile + 1, meld3.tile + 2] : [meld3.tile];
function fixedYakuhai(melds, view) {
  const wind = 27 + (view.seat - view.dealer + 4) % 4, round = view.rules?.roundWind ?? 27;
  return melds.some((meld3) => meld3.type !== "chi" && (meld3.tile >= 31 || meld3.tile === wind || meld3.tile === round));
}
function credibleYaku(c, melds, view) {
  return fixedYakuhai(melds, view) || view.rules?.kuitan === true && melds.every((meld3) => meldTypes(meld3).every(simple)) && c.every((number3, type) => !number3 || simple(type));
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
  if (!Array.isArray(own) || own.length !== view.hand.length || own.some((tile3) => !physical(tile3.id) || tile3.type !== Math.floor(tile3.id / 4)) || new Set(own.map((tile3) => tile3.id)).size !== own.length) return null;
  if (JSON.stringify([...own.map((tile3) => tile3.type)].sort((a, b) => a - b)) !== JSON.stringify([...view.hand].sort((a, b) => a - b))) return null;
  const wanted = call.type === "chi" ? [call.tile, call.tile + 1, call.tile + 2].filter((type) => type !== called) : Array(call.type === "minkan" ? 3 : 2).fill(called), remaining3 = [...own].sort((a, b) => a.id - b.id);
  if (wanted.length !== (call.type === "minkan" ? 3 : 2)) return null;
  for (const type of wanted) {
    let index = remaining3.findIndex((tile3) => tile3.type === type && !RED_IDS3.has(tile3.id));
    if (index < 0) index = remaining3.findIndex((tile3) => tile3.type === type);
    if (index < 0) return null;
    remaining3.splice(index, 1);
  }
  return counts(remaining3.map((tile3) => tile3.type));
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
    if (melds2.some((meld3) => meld3.open) && !fixedYakuhai(melds2, view) && view.rules?.kuitan === true) {
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
  if (!Array.isArray(humanSeats) || humanSeats.some((seat5) => !Number.isInteger(seat5) || seat5 < 0 || seat5 > 3) || !Number.isInteger(maxSteps) || maxSteps < 0 || maxSteps > 1e4) throw new Error("Invalid AI drive options");
  let steps = 0;
  while (!["end", "ended"].includes(game.phase) && steps < maxSteps) {
    const seat5 = actor3(game);
    if (humanSeats.includes(seat5)) break;
    step3(game, seat5, chooseAction2(snapshot3(game, seat5)));
    steps++;
  }
  return { state: game, steps, finished: ["end", "ended"].includes(game.phase), waitingForHuman: humanSeats.includes(actor3(game)) };
}

// duplicate/discard-metadata.mjs
var physical2 = (value) => Number.isInteger(value) && value >= 0 && value < 136;
var seat = (value) => Number.isInteger(value) && value >= 0 && value < 4;
function discardMetadata(game) {
  const drawn = Array(4), last = Array(4), byEvent = /* @__PURE__ */ new Map(), byTile = /* @__PURE__ */ new Map();
  for (const raw of game?.events ?? []) {
    if (!seat(raw.seat)) continue;
    const s = raw.seat, action = raw.action;
    if (raw.type === "draw" || raw.type === "kanDraw") drawn[s] = physical2(raw.id) ? raw.id : void 0;
    else if (raw.type === "call") drawn[s] = ["chi", "pon"].includes(action?.type) ? null : void 0;
    else if (raw.type === "action" && action?.type === "kakan" || raw.type === "kan") drawn[s] = void 0;
    else if (raw.type === "action" && ["discard", "riichi"].includes(action?.type)) {
      last[s] = null;
      if (physical2(action.id) && drawn[s] !== void 0 && Number.isSafeInteger(raw.n)) {
        const value = { seat: s, tileId: action.id, tsumogiri: drawn[s] === action.id };
        byEvent.set(raw.n, value);
        byTile.set(`${s}:${action.id}`, value);
        last[s] = value;
      }
      drawn[s] = void 0;
    } else if (raw.type === "riichi" && last[s] && Number.isSafeInteger(raw.n)) byEvent.set(raw.n, last[s]);
  }
  return { byEvent, byTile };
}
function withDiscardEvents(game, events) {
  const { byEvent } = discardMetadata(game);
  return (events ?? []).map((value) => {
    const { tsumogiri, ...event3 } = value, known = byEvent.get(event3.id);
    return known && known.seat === event3.seat && known.tileId === event3.tileId ? { ...event3, tsumogiri: known.tsumogiri } : event3;
  });
}
function withDiscardMetadata(game, view) {
  if (!view) return view;
  const { byTile } = discardMetadata(game);
  const annotate = (value, s) => {
    const { tsumogiri, ...tile3 } = value, known = byTile.get(`${s}:${tile3.id ?? tile3.tileId}`);
    return known ? { ...tile3, tsumogiri: known.tsumogiri } : tile3;
  };
  return {
    ...view,
    players: (view.players ?? []).map((player, index) => ({ ...player, river: (player.river ?? []).map((tile3) => annotate(tile3, player.seat ?? index)) })),
    publicEvents: withDiscardEvents(game, view.publicEvents),
    ...view.lastDiscard ? { lastDiscard: annotate(view.lastDiscard, view.lastDiscard.seat ?? view.lastDiscard.source) } : {}
  };
}
function decorateDiscardTile(element4, discard, mode = "none") {
  const known = typeof discard?.tsumogiri === "boolean";
  element4.classList.toggle("is-tsumogiri", mode === "gray" && discard?.tsumogiri === true);
  const base = String(element4.title ?? "").replace(/ · (?:쯔모기리|테다시)$/, "");
  element4.title = base + (known && mode !== "none" ? ` \xB7 ${discard.tsumogiri ? "\uCBD4\uBAA8\uAE30\uB9AC" : "\uD14C\uB2E4\uC2DC"}` : "");
  element4.setAttribute("aria-label", element4.title);
  return element4;
}

// duplicate/winning-hand.mjs
var RED_IDS4 = /* @__PURE__ */ new Set([16, 52, 88]);
var seat2 = (value) => Number.isInteger(value) && value >= 0 && value < 4;
var physical3 = (value) => Number.isInteger(value) && value >= 0 && value < 136;
var object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var insist = (ok, message = "Invalid winning-hand presentation") => {
  if (!ok) throw new TypeError(message);
};
function tile(value) {
  insist(object(value) && physical3(value.id));
  const type = Math.floor(value.id / 4);
  insist(value.type === type && (value.red === void 0 || typeof value.red === "boolean"));
  insist(value.red !== true || RED_IDS4.has(value.id));
  return { id: value.id, type, red: value.red === true };
}
function meld(value) {
  insist(object(value) && ["chi", "pon", "kan"].includes(value.type) && typeof value.open === "boolean");
  insist(Number.isInteger(value.tile) && value.tile >= 0 && value.tile < 34 && Array.isArray(value.tiles));
  const tiles2 = value.tiles.map(tile), count = value.type === "kan" ? 4 : 3;
  insist(tiles2.length === count);
  const types = tiles2.map((t) => t.type).sort((a, b) => a - b), expected = value.type === "chi" ? [value.tile, value.tile + 1, value.tile + 2] : Array(count).fill(value.tile);
  insist(value.type !== "chi" || value.tile < 27 && value.tile % 9 <= 6);
  insist(types.every((type, index) => type === expected[index]));
  const result = { type: value.type, tile: value.tile, open: value.open, tiles: tiles2 };
  if (value.from !== void 0) {
    insist(seat2(value.from));
    result.from = value.from;
  }
  return result;
}
function normalizeWinningHands(value) {
  if (value === void 0 || value === null) return [];
  insist(Array.isArray(value) && value.length <= 3);
  const seen = /* @__PURE__ */ new Set();
  const hands = value.map((row) => {
    insist(object(row) && seat2(row.seat) && !seen.has(row.seat) && ["ron", "tsumo"].includes(row.method));
    seen.add(row.seat);
    insist(Array.isArray(row.tiles) && Array.isArray(row.melds) && row.melds.length <= 4);
    const tiles2 = row.tiles.map(tile), melds = row.melds.map(meld), winningTile = tile(row.winningTile);
    insist(tiles2.length === 14 - 3 * melds.length);
    const all = [...tiles2, ...melds.flatMap((m) => m.tiles)], ids = all.map((t) => t.id);
    insist(new Set(ids).size === ids.length && tiles2.filter((t) => t.id === winningTile.id).length === 1);
    insist(tiles2.some((t) => t.id === winningTile.id && t.type === winningTile.type && t.red === winningTile.red));
    return { seat: row.seat, method: row.method, tiles: tiles2, melds, winningTile };
  });
  insist(hands.length <= 1 || hands.every((row) => row.method === "ron"));
  return hands;
}
var ended = (value) => value && (value.phase === "end" || value.phase === "ended") && value.end === "win";
function engineWinningHands(game) {
  insist(Array.isArray(game.winners) && game.winners.length > 0 && game.winners.length <= 3 && Array.isArray(game.players));
  const asTile = (id) => {
    insist(physical3(id));
    return { id, type: Math.floor(id / 4), red: game.rules?.redDora === true && RED_IDS4.has(id) };
  };
  const hands = game.winners.map((winner) => {
    insist(seat2(winner));
    const player = game.players[winner];
    insist(player?.won === true && Array.isArray(player.hand) && Array.isArray(player.melds) && ["ron", "tsumo"].includes(player.win?.method));
    const winningTile = asTile(player.win.tile), tiles2 = player.hand.map(asTile);
    if (player.win.method === "ron" && !tiles2.some((tile3) => tile3.id === winningTile.id)) tiles2.push(winningTile);
    const melds = player.melds.map((value) => {
      insist(object(value) && Array.isArray(value.ids));
      return { type: value.type, tile: value.tile, open: value.open, ...value.from === void 0 ? {} : { from: value.from }, tiles: value.ids.map(asTile) };
    });
    return { seat: winner, method: player.win.method, tiles: tiles2, melds, winningTile };
  });
  return normalizeWinningHands(hands);
}
function withWinningHands(game, view) {
  if (!object(view)) return view;
  const result = structuredClone(view);
  delete result.winningHands;
  if (!ended(game) || !ended(view)) return result;
  try {
    result.winningHands = engineWinningHands(game);
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
  }
  return result;
}

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
  const tile3 = document.createElement(button ? "button" : "span");
  tile3.className = `tile-face ${small ? "tile-small" : "tile"}`;
  tile3.dataset.type = String(type);
  tile3.dataset.suit = type < 27 ? ["m", "p", "s"][Math.floor(type / 9)] : "z";
  tile3.title = tileName(type);
  tile3.setAttribute("aria-label", tileName(type));
  if (button) tile3.type = "button";
  if (type < 9) {
    tile3.append(span(["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u4E03", "\u516B", "\u4E5D"][type], "tile-number"), span("\u842C", "tile-man"));
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
    tile3.append(svg);
  } else if (type === 31) {
    tile3.append(span("", "tile-white"));
  } else tile3.append(span({ 27: "\u6771", 28: "\u5357", 29: "\u897F", 30: "\u5317", 32: "\u767C", 33: "\u4E2D" }[type], "tile-honor"));
  for (const child of tile3.children) child.setAttribute("aria-hidden", "true");
  return tile3;
}

// duplicate/winning-hand-view.mjs
function renderWinningHands(container, hands, { document: doc = container?.ownerDocument, dealer } = {}) {
  if (!container || !doc) throw new TypeError("Winning hands need a container and document");
  const normalized = normalizeWinningHands(hands);
  container.replaceChildren();
  container.hidden = normalized.length === 0;
  if (!normalized.length) return container;
  const node = (tag, className, text3) => {
    const element4 = doc.createElement(tag);
    element4.className = className;
    if (text3 !== void 0) element4.textContent = text3;
    return element4;
  };
  const face = (tile3, winning = false) => {
    const element4 = tileFace(tile3.type, { small: true });
    element4.classList.toggle("red", tile3.red);
    element4.classList.toggle("winning-hand-tile", winning);
    element4.dataset.tileId = String(tile3.id);
    const label = `${tile3.red ? "\uC801 " : ""}${tileName(tile3.type)}${winning ? " \xB7 \uD654\uB8CC\uD328" : ""}`;
    element4.title = label;
    element4.setAttribute("aria-label", label);
    return element4;
  };
  for (const hand of normalized) {
    const section = node("section", "winning-hand");
    section.dataset.seat = String(hand.seat);
    const wind = Number.isInteger(dealer) && dealer >= 0 && dealer < 4 ? ` \xB7 ${["\u6771", "\u5357", "\u897F", "\u5317"][(hand.seat - dealer + 4) % 4]}` : "";
    section.append(node("h4", "winning-hand-heading", `${hand.seat + 1}\uBC88 \uC790\uB9AC${wind} \xB7 ${hand.method === "ron" ? "\uB860" : "\uCBD4\uBAA8"}`));
    const row = node("div", "winning-hand-tiles"), concealed = node("div", "winning-hand-concealed");
    concealed.setAttribute("aria-label", "\uD654\uB8CC \uC190\uD328");
    const tiles2 = hand.tiles.filter((tile3) => tile3.id !== hand.winningTile.id).sort((a, b) => a.type - b.type || Number(a.red) - Number(b.red) || a.id - b.id);
    for (const tile3 of tiles2) concealed.append(face(tile3));
    const winning = node("div", "winning-hand-winning-tile");
    winning.setAttribute("aria-label", "\uD654\uB8CC\uD328");
    winning.append(node("span", "winning-hand-winning-label", "\uD654\uB8CC\uD328"), face(hand.winningTile, true));
    row.append(concealed, winning);
    section.append(row);
    if (hand.melds.length) {
      const melds = node("div", "winning-hand-melds");
      melds.setAttribute("aria-label", "\uD654\uB8CC \uD6C4\uB85C");
      for (const meld3 of hand.melds) {
        const group = node("span", "winning-hand-meld");
        group.title = meld3.type === "chi" ? "\uCE58" : meld3.type === "pon" ? "\uD401" : meld3.open ? "\uBA85\uAE61" : "\uC548\uAE61";
        for (const tile3 of meld3.tiles) group.append(face(tile3));
        melds.append(group);
      }
      section.append(melds);
    }
    container.append(section);
  }
  return container;
}

// duplicate/round-results-view.mjs
var winds = ["\uB3D9", "\uB0A8", "\uC11C", "\uBD81"];
var validSeat = (value) => Number.isInteger(value) && value >= 0 && value < 4;
var finite = (value) => typeof value === "number" && Number.isFinite(value);
var format = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 });
var score = (value) => `${value > 0 ? "+" : ""}${format.format(value)}\uC810`;
function element2(document2, tag, className, text3) {
  const node = document2.createElement(tag);
  if (className) node.className = className;
  if (text3 !== void 0) node.textContent = text3;
  return node;
}
function renderRoundResults(container, rows, { seat: seat5, ai = false, ownTableId, document: document2 = container?.ownerDocument } = {}) {
  if (!container || !document2?.createElement) throw new TypeError("A round-results container and document are required");
  const expanded = new Set(Array.from(container.querySelectorAll?.(".round-score-card") ?? []).filter((card) => card.querySelector?.("details")?.open).map((card) => card.dataset.board));
  const root = element2(document2, "div", "round-score-content"), heading = element2(document2, "div", "round-score-heading");
  heading.append(element2(document2, "h2", "", "\uAD6D\uBCC4 \uC810\uC218 \uBE44\uAD50"), element2(document2, "p", "", "\uAC19\uC740 \uC2DC\uC791 \uC790\uB9AC \xB7 \uBCF8\uC7A5 \uD569\uC0B0"));
  root.append(heading);
  const seen = /* @__PURE__ */ new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || !Number.isInteger(row.board) || row.board < 1 || row.board > 16 || seen.has(row.board)) continue;
    seen.add(row.board);
    const card = element2(document2, "section", "round-score-card");
    card.dataset.board = String(row.board);
    const title = element2(document2, "div", "round-score-card-heading");
    title.append(element2(document2, "h3", "", `${winds[Math.floor((row.board - 1) / 4)]}${(row.board - 1) % 4 + 1}\uAD6D`), element2(document2, "span", "round-score-scope", "\uBCF8\uC7A5 \uD569\uC0B0"));
    card.append(title);
    const complete = row.status === "complete", average = complete && validSeat(seat5) && Array.isArray(row.averages) ? row.averages.find((value) => value?.seat === seat5 && value.ai === ai) : null;
    const referenceRequested = complete && row.referenceLabel === "AI \uAE30\uC900", reference = referenceRequested && finite(row.referenceMean);
    const comparable = average && Number.isInteger(average.samples) && average.samples >= 2 && finite(average.mean);
    card.append(element2(document2, "strong", "round-score-mean", !complete ? "\uBE44\uAD50 \uB300\uAE30" : referenceRequested ? reference ? `AI \uAE30\uC900 ${score(row.referenceMean)}` : "AI \uAE30\uC900 \uBE44\uAD50 \uB300\uAE30" : comparable ? `\uD3C9\uADE0 \uC810\uC218 \uC99D\uAC10 ${score(average.mean)}` : "\uBE44\uAD50\uB300\uC0C1 \uBD80\uC871"));
    if (complete && validSeat(seat5)) card.append(element2(document2, "p", "round-score-cohort", `${winds[seat5]} \uC2DC\uC791 \uC790\uB9AC \xB7 ${referenceRequested ? "AI \uAE30\uC900 \uB300\uAD6D" : `${ai ? "AI" : "\uC0AC\uB78C"}${comparable ? ` ${average.samples}\uBA85` : ""}`}`));
    const publicEntries = complete && Array.isArray(row.entries) ? row.entries.filter((entry) => entry && typeof entry.tableId === "string" && typeof entry.name === "string" && validSeat(entry.seat) && Number.isSafeInteger(entry.score)) : [];
    const knownTable = typeof ownTableId === "string" && ownTableId.length > 0 && publicEntries.some((entry) => entry.tableId === ownTableId);
    const entries = knownTable ? publicEntries.filter((entry) => entry.tableId !== ownTableId) : [];
    if (entries.length) {
      const details = element2(document2, "details", "round-score-details");
      details.open = expanded.has(String(row.board));
      details.append(element2(document2, "summary", "", "\uB2E4\uB978 \uD0C1 \uC810\uC218 \uC790\uC138\uD788"));
      const table = element2(document2, "table", "round-score-table");
      table.append(element2(document2, "caption", "", "\uB0B4 \uD0C1 \uC81C\uC678 \xB7 \uC2DC\uC791 \uC790\uB9AC \uAE30\uC900 \xB7 \uBCF8\uC7A5 \uD569\uC0B0"));
      const head = element2(document2, "thead", ""), header = element2(document2, "tr", "");
      for (const label of ["\uD0C1", "\uC774\uB984", "\uC790\uB9AC", "\uC810\uC218\uC99D\uAC10"]) {
        const cell = element2(document2, "th", "", label);
        cell.setAttribute("scope", "col");
        header.append(cell);
      }
      head.append(header);
      table.append(head);
      const body = element2(document2, "tbody", "");
      for (const entry of entries) {
        const own = entry.seat === seat5 && entry.ai === true === ai, tr = element2(document2, "tr", own ? "is-own-cohort" : "");
        if (own) tr.dataset.ownCohort = "true";
        const name = element2(document2, "td", "", entry.name);
        if (entry.ai === true) name.append(element2(document2, "span", "round-score-ai", " AI"));
        tr.append(element2(document2, "td", "", entry.tableId), name, element2(document2, "td", "", winds[entry.seat]), element2(document2, "td", "round-score-delta", score(entry.score)));
        body.append(tr);
      }
      table.append(body);
      details.append(table);
      card.append(details);
    } else if (complete) card.append(element2(document2, "p", "round-score-empty", knownTable ? "\uB2E4\uB978 \uCC38\uC5EC \uD0C1\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." : "\uB0B4 \uD0C1 \uC815\uBCF4\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4 \uB2E4\uB978 \uD0C1\uC758 \uACB0\uACFC\uB97C \uAD6C\uBD84\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4."));
    root.append(card);
  }
  if (!seen.size) root.append(element2(document2, "p", "round-score-empty", "\uAD6D\uBCC4 \uACB0\uACFC\uB294 \uB300\uAD6D\uC774 \uB05D\uB09C \uB4A4 \uD45C\uC2DC\uB429\uB2C8\uB2E4."));
  container.replaceChildren(root);
}

// duplicate/match.mjs
var defaults = Object.freeze({ format: "hanchan", dealerContinuation: true, agariYame: false });
var positive = (n) => Number.isSafeInteger(n) && n >= 1;
var nonnegative = (n) => Number.isSafeInteger(n) && n >= 0;
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
function seedForHonba(baseSeed, honba) {
  if (!uint32(baseSeed) || !uint32(honba)) throw new Error("Invalid honba seed");
  let mixed = honba >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 2146121005);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 2221713035);
  mixed ^= mixed >>> 16;
  return (baseSeed ^ mixed) >>> 0;
}
function pointsAtEnd(game) {
  if (!Array.isArray(game?.players) || game.players.length !== 4) throw new Error("Missing final players");
  const starts = game.startingScores ?? Array(4).fill(game.rules?.startingPoints);
  if (!Array.isArray(starts) || starts.length !== 4 || starts.some((n) => !Number.isSafeInteger(n))) throw new Error("Missing starting scores");
  return starts.map((n, seat5) => {
    const score2 = game.players[seat5]?.score, total = n + score2;
    if (!Number.isSafeInteger(score2) || !Number.isSafeInteger(total)) throw new Error("Invalid final score");
    return total;
  });
}
function dealerReady(game) {
  if (Array.isArray(game.readySeats)) return game.readySeats.includes(game.dealer);
  const settlement = game.events?.findLast((event3) => event3.type === "drawSettlement");
  if (!Array.isArray(settlement?.ready)) throw new Error("Missing exhaustive-draw tenpai result");
  return settlement.ready.some((player) => player.seat === game.dealer);
}
function nextHandPlan({ board, repeat = 0, honba = 0, handNumber = 1, boardCount, game, matchRules = null } = {}) {
  const config = matchRules === null ? null : normalizeMatchRules(matchRules);
  const count = boardCount ?? (config ? matchBoardCount(config) : null);
  if (!positive(board) || !positive(count) || board > count || !uint32(repeat) || !nonnegative(honba) || !positive(handNumber)) throw new Error("Invalid match position");
  if (config && count !== matchBoardCount(config)) throw new Error("Match format and board count differ");
  if (!game || !["end", "ended"].includes(game.phase) && !game.end) throw new Error("The current hand has not ended");
  const pot = game.pot ?? 0;
  if (!nonnegative(pot) || pot % 1e3) throw new Error("Invalid final pot");
  let finalPoints = null;
  const complete = (reason2) => ({
    complete: true,
    continues: false,
    reason: reason2,
    board,
    repeat,
    honba,
    handNumber,
    pot,
    startingScores: finalPoints ? [...finalPoints] : null,
    pendingPotNote: pot ? "\uB0A8\uC740 \uB9AC\uCE58 \uACF5\uD0C1\uC740 \uBBF8\uC218\uB839 \uC0C1\uD0DC\uB85C \uD45C\uC2DC\uD558\uBA70 \uC784\uC758\uB85C \uBC30\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : null
  });
  if (config === null) {
    if (board === count) return complete("legacy-complete");
    if (!positive(handNumber + 1)) throw new Error("Hand number exceeds the supported range");
    return { complete: false, continues: false, reason: "legacy-next", board: board + 1, repeat: 0, honba: 0, handNumber: handNumber + 1, pot: 0, startingScores: null, pendingPotNote: null };
  }
  finalPoints = pointsAtEnd(game);
  if (!Number.isInteger(game.dealer) || game.dealer < 0 || game.dealer > 3) throw new Error("Invalid dealer");
  let continues = false, reason, nextHonba;
  if (game.end === "win") {
    if (!Array.isArray(game.winners) || !game.winners.length) throw new Error("Missing winning seats");
    const dealerWon = game.winners.includes(game.dealer);
    continues = config.dealerContinuation && dealerWon;
    reason = dealerWon ? "dealer-win" : "non-dealer-win";
    nextHonba = dealerWon ? honba + 1 : 0;
  } else if (game.end === "exhaustive-draw") {
    const ready = dealerReady(game);
    continues = config.dealerContinuation && ready;
    reason = ready ? "dealer-tenpai" : "dealer-noten";
    nextHonba = honba + 1;
  } else if (game.end === "four-kans") {
    continues = true;
    reason = "four-kans";
    nextHonba = honba + 1;
  } else throw new Error("Unsupported match hand result");
  const leader = [0, 1, 2, 3].sort((a, b) => finalPoints[b] - finalPoints[a] || a - b)[0];
  if (board === count && continues && config.agariYame && leader === game.dealer && ["win", "exhaustive-draw"].includes(game.end)) return complete("all-last-leader");
  if (!continues && board === count) return complete("match-complete");
  const nextBoard = continues ? board : board + 1, nextRepeat = continues ? repeat + 1 : 0, nextNumber = handNumber + 1;
  if (!uint32(nextRepeat) || !nonnegative(nextHonba) || !positive(nextNumber)) throw new Error("Match counters exceed the supported range");
  return {
    complete: false,
    continues,
    reason,
    board: nextBoard,
    repeat: nextRepeat,
    honba: nextHonba,
    handNumber: nextNumber,
    pot,
    startingScores: [...finalPoints],
    pendingPotNote: null
  };
}

// duplicate/practice-series.mjs
var seedForPracticeBoard = (base, index) => base + Math.imul(index, 2654435769) >>> 0;
function resolvePracticeSeat(choice = "random", draw3 = () => globalThis.crypto.getRandomValues(new Uint32Array(1))[0]) {
  if (choice === "random") {
    const value = draw3();
    if (!Number.isInteger(value) || value < 0 || value > 4294967295) throw Error("Invalid random seat draw");
    return value % 4;
  }
  if (!["0", "1", "2", "3"].includes(String(choice))) throw Error("Invalid practice seat");
  return Number(choice);
}
function seriesProgress(value) {
  const board = value?.board ?? (value?.index ?? 0) + 1, repeat = value?.repeat ?? 0, honba = value?.honba ?? value?.game?.honba ?? 0;
  return { board, repeat, honba, handNumber: value?.handNumber ?? (value?.index ?? 0) + 1, handId: handId({ board, honba }) };
}
function formatName(matchRules, count) {
  return matchRules ? matchRules.format === "east" ? "\uB3D9\uD48D\uC804" : "\uBC18\uC7A5\uC804" : `\uAE30\uC874 ${count ?? "\u2014"}\uAD6D \xB7 \uB3C5\uB9BD \uC9C4\uD589`;
}
function handLabel(value) {
  const p = seriesProgress(value), game = value?.game, wind = game?.rules?.roundWind ?? value?.handContext?.roundWind ?? (value?.matchRules ? 27 + Math.floor((p.board - 1) / 4) : 27);
  return `${["\u6771", "\u5357", "\u897F", "\u5317"][wind - 27] ?? "\u2014"}${(p.board - 1) % 4 + 1}\u5C40 ${p.honba}\uBCF8\uC7A5`;
}
function gameOptions(practice, progress2) {
  const rules = practice.matchRules ? { ...practice.rules ?? practice.game.rules, roundWind: 27 + Math.floor((progress2.board - 1) / 4) } : { ...practice.rules ?? practice.game.rules };
  return { seed: seedForHonba(seedForPracticeBoard(practice.seed, progress2.board - 1), progress2.honba), rules, duplicateProfile: normalizeDuplicateProfile(practice.duplicateProfile), dealer: (progress2.board - 1) % 4, honba: progress2.honba, pot: progress2.pot ?? 0, startingScores: progress2.startingScores ?? null };
}
function createPracticeSeries({ seed, seat: seat5 = 0, matchRules = {}, rules = {}, duplicateProfile = "custom", aiPolicy = "simple" }) {
  const config = normalizeMatchRules(matchRules), profile = normalizeDuplicateProfile(duplicateProfile), practice = { seed, seat: seat5, count: matchBoardCount(config), index: 0, board: 1, repeat: 0, honba: 0, handNumber: 1, handId: "1:0", results: [], matchRules: config, rules: normalizeProfileRules(rules, profile), duplicateProfile: profile, aiPolicy };
  practice.game = createGame3(gameOptions(practice, practice));
  return practice;
}
function localNextPlan(practice) {
  return nextHandPlan({ ...seriesProgress(practice), boardCount: practice.count, game: practice.game, matchRules: practice.matchRules ?? null });
}
function advancePracticeSeries(practice) {
  const next = localNextPlan(practice);
  if (next.complete) return false;
  Object.assign(practice, { board: next.board, index: next.board - 1, repeat: next.repeat, honba: next.honba, handNumber: next.handNumber, handId: handId(next) });
  practice.game = createGame3(gameOptions(practice, next));
  return true;
}
function practiceBaselineOptions(practice, view = null, context3 = null) {
  const p = seriesProgress(practice), game = view ?? practice.game, rules = game.rules ?? practice.rules ?? practice.game.rules;
  const startingScores = context3?.startingScores ?? game.startingScores ?? game.players?.map((player) => player.points - player.score), pot = context3?.pot ?? game.initialPot ?? (practice.matchRules ? null : 0);
  if (!Array.isArray(startingScores) || startingScores.length !== 4 || startingScores.some((n) => !Number.isSafeInteger(n)) || !Number.isSafeInteger(pot)) throw Error("\uAE30\uC900 \uB300\uAD6D\uC758 \uC2DC\uC791 \uC810\uC218\uC640 \uACF5\uD0C1 \uC815\uBCF4\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  return { seed: seedForHonba(seedForPracticeBoard(practice.seed, p.board - 1), p.honba), rules: { ...rules }, duplicateProfile: normalizeDuplicateProfile(practice.duplicateProfile ?? game.duplicateProfile), dealer: game.dealer, honba: game.honba ?? p.honba, pot, startingScores: [...startingScores], seat: practice.seat };
}
function restorePracticeSeries(saved2) {
  if (!saved2?.game || !Number.isInteger(saved2.seat) || saved2.seat < 0 || saved2.seat > 3 || !Number.isInteger(saved2.index) || saved2.index < 0 || !Number.isInteger(saved2.count) || saved2.index >= saved2.count) throw Error("Invalid saved practice");
  const practice = structuredClone(saved2);
  assertInvariants3(practice.game);
  practice.duplicateProfile = normalizeDuplicateProfile(practice.duplicateProfile ?? practice.game.duplicateProfile);
  if (practice.duplicateProfile !== normalizeDuplicateProfile(practice.game.duplicateProfile)) throw Error("Saved duplicate profile differs");
  normalizeProfileRules(practice.game.rules, practice.duplicateProfile);
  practice.rules = normalizeProfileRules(practice.rules ?? practice.game.rules, practice.duplicateProfile);
  if (practice.matchRules) {
    practice.matchRules = normalizeMatchRules(practice.matchRules);
    if (practice.count !== matchBoardCount(practice.matchRules)) throw Error("Saved format differs");
  } else practice.matchRules = null;
  const p = seriesProgress(practice);
  if (p.board !== practice.index + 1 || saved2.handId && saved2.handId !== p.handId || !Number.isSafeInteger(p.repeat) || p.repeat < 0 || !Number.isSafeInteger(p.honba) || p.honba < 0 || !Number.isSafeInteger(p.handNumber) || p.handNumber < 1) throw Error("Invalid saved progress");
  Object.assign(practice, p);
  return practice;
}

// duplicate/practice-flow.mjs
var PRACTICE_AI_DELAY_MS = 700;
var ended2 = (game) => game.phase === "end" || game.phase === "ended" || !!game.end;
function check(game, humanSeat) {
  if (!game || typeof game !== "object" || !Number.isInteger(humanSeat) || humanSeat < 0 || humanSeat > 3) throw Error("Invalid practice game or human seat");
}
function summary(game, humanSeat, forcedPasses, actions = 0) {
  const finished = ended2(game), nextActor = finished ? null : actor3(game);
  return { changed: forcedPasses + actions > 0, forcedPasses, actions, finished, waitingForHuman: !finished && nextActor === humanSeat, nextActor };
}
function settleForcedPracticePasses(game, humanSeat) {
  check(game, humanSeat);
  let forcedPasses = 0;
  while (!ended2(game)) {
    const seat5 = actor3(game);
    if (seat5 === null || seat5 === void 0) break;
    const legal = legalActions3(game, seat5);
    if (legal.length !== 1 || legal[0].type !== "pass") break;
    if (forcedPasses >= 8) throw Error("Unexpected forced practice-pass cycle");
    step3(game, seat5, legal[0]);
    forcedPasses++;
  }
  return summary(game, humanSeat, forcedPasses);
}
function advancePracticeAI(game, humanSeat) {
  check(game, humanSeat);
  const before = settleForcedPracticePasses(game, humanSeat);
  if (before.finished || before.waitingForHuman || before.nextActor === null || before.nextActor === void 0) return before;
  const seat5 = before.nextActor, view = snapshot3(game, seat5), action = chooseAction2(view);
  step3(game, seat5, action);
  const after = settleForcedPracticePasses(game, humanSeat);
  return summary(game, humanSeat, before.forcedPasses + after.forcedPasses, 1);
}

// duplicate/automatic-player.mjs
function forcedPlayerPass(view) {
  if (!view || view.phase !== "reaction" || view.end || !Number.isInteger(view.seat) || view.seat < 0 || view.seat > 3 || view.actor !== view.seat) return null;
  const legal = view.legalActions;
  return Array.isArray(legal) && legal.length === 1 && legal[0]?.type === "pass" ? legal[0] : null;
}
function automaticPlayerAction(view, { autoWin = true } = {}) {
  if (!view || ["end", "ended"].includes(view.phase) || view.end || !Number.isInteger(view.seat) || view.actor !== view.seat) return null;
  const legal = view.legalActions;
  if (!Array.isArray(legal) || !legal.length) return null;
  const win3 = legal.find((action) => action.type === "tsumo" || action.type === "ron");
  if (win3) return autoWin ? win3 : null;
  const pass = forcedPlayerPass(view);
  if (pass) return pass;
  if (view.phase !== "turn" || legal.length !== 1 || legal[0].type !== "discard") return null;
  const self = view.players?.find((player) => player.seat === view.seat), discard = legal[0];
  if (self?.riichi !== true || !Number.isInteger(discard.id)) return null;
  const drawn = view.handTiles?.filter((tile3) => tile3.drawn === true) ?? [];
  return drawn.length === 1 && drawn[0].id === discard.id ? discard : null;
}

// duplicate/competition-scoring.mjs
var IMP_SCALE_SOURCE_URL = "https://www.mahjong.ru/index.php/mahjong/mahjong-rules/490-mahjong-rules-duplicate";
var IMP_THRESHOLDS = Object.freeze([2, 6, 10, 16, 24, 32, 40, 48, 56, 64, 72, 84, 96, 108, 132, 156, 180, 212, 244, 296]);
function normalizeScoring(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options) || Object.keys(options).some((k) => !["method", "impUnit"].includes(k))) throw Error("Invalid competition scoring");
  const result = { method: "raw", impUnit: 100, ...options };
  if (!["raw", "imp"].includes(result.method) || ![100, 1e3].includes(result.impUnit)) throw Error("Invalid competition scoring");
  return result;
}
function normalizeNewCompetitionScoring(options = {}, profile = "custom") {
  if (!["mil", "mil-riichi", "custom"].includes(profile)) throw Error("Unknown duplicate profile");
  const config = normalizeScoring(options);
  if (["mil", "mil-riichi"].includes(profile) && !Object.hasOwn(options, "method")) config.method = "imp";
  return config;
}

// duplicate/hand-order.mjs
function orderedHandTiles(tiles2 = []) {
  return [...tiles2].sort((a, b) => Number(!!a.drawn) - Number(!!b.drawn) || a.id - b.id);
}
function orderedHandActions(view, type = "discard") {
  const actions = new Map((view?.legalActions ?? []).filter((action) => action.type === type).map((action) => [action.id, action]));
  return orderedHandTiles(view?.handTiles).flatMap((tile3) => actions.has(tile3.id) ? [actions.get(tile3.id)] : []);
}

// duplicate/preferences.mjs
var PREFERENCES_STORAGE_KEY = "duplicate.preferences.v1";
var DEFAULT_PREFERENCES = Object.freeze({
  lastDiscard: true,
  actionBubbles: true,
  animations: true,
  turnHighlight: true,
  recentActions: true,
  discardDisplay: "none",
  callPreview: true,
  sound: false,
  vibration: false,
  reducedMotion: false,
  autoWin: true,
  autoPass: true,
  volume: 0.35
});
function normalizePreferences(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const preferences = { ...DEFAULT_PREFERENCES };
  for (const [key, fallback] of Object.entries(DEFAULT_PREFERENCES)) {
    if (typeof fallback === "boolean" && typeof source[key] === "boolean") preferences[key] = source[key];
  }
  preferences.autoPass = true;
  if (["none", "gray", "text"].includes(source.discardDisplay)) {
    preferences.discardDisplay = source.discardDisplay;
  }
  if (typeof source.volume === "number" && Number.isFinite(source.volume)) {
    preferences.volume = Math.max(0, Math.min(1, source.volume));
  }
  return preferences;
}
function loadPreferences(storage) {
  try {
    return normalizePreferences(JSON.parse(storage.getItem(PREFERENCES_STORAGE_KEY) ?? "null"));
  } catch {
    return normalizePreferences();
  }
}
function savePreferences(storage, value) {
  try {
    storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(normalizePreferences(value)));
    return true;
  } catch {
    return false;
  }
}

// duplicate/personal-settings.mjs
var DISPLAY_OPTIONS = [
  ["lastDiscard", "\uB9C8\uC9C0\uB9C9 \uBC84\uB9BC\uD328 \uD45C\uC2DC", "\uBC29\uAE08 \uBC84\uB9B0 \uD328\uB97C \uD14C\uB450\uB9AC\uB85C \uD45C\uC2DC\uD569\uB2C8\uB2E4."],
  ["actionBubbles", "\uD589\uB3D9 \uB9D0\uD48D\uC120", "\uCE58\xB7\uD401\xB7\uAE61\xB7\uB9AC\uCE58\xB7\uB860\xB7\uCBD4\uBAA8\uB97C \uB9D0\uD48D\uC120\uC73C\uB85C \uD45C\uC2DC\uD569\uB2C8\uB2E4."],
  ["animations", "\uC560\uB2C8\uBA54\uC774\uC158", "\uD328\uC640 \uD589\uB3D9 \uD45C\uC2DC\uC758 \uC6C0\uC9C1\uC784\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4."],
  ["turnHighlight", "\uD604\uC7AC \uCC28\uB840 \uAC15\uC870", "\uC9C0\uAE08 \uD589\uB3D9\uD560 \uCC28\uB840\uC778 \uC790\uB9AC\uB97C \uAC15\uC870\uD569\uB2C8\uB2E4."],
  ["recentActions", "\uCD5C\uADFC \uD589\uB3D9 \uAE30\uB85D", "\uCD5C\uADFC \uCF5C\uACFC \uD654\uB8CC\uB97C \uAE30\uB85D\uC73C\uB85C \uBCF4\uC5EC \uC90D\uB2C8\uB2E4."],
  ["callPreview", "\uCF5C \uBBF8\uB9AC \uBCF4\uAE30", "\uCE58\xB7\uD401\xB7\uAE61\uC73C\uB85C \uB9CC\uB4E4 \uD328\uB97C \uC120\uD0DD \uC804\uC5D0 \uBCF4\uC5EC \uC90D\uB2C8\uB2E4."],
  ["reducedMotion", "\uB3D9\uC791 \uC904\uC774\uAE30", "\uC6C0\uC9C1\uC784\uC744 \uC904\uC774\uACE0 \uD589\uB3D9\uC744 \uAC04\uACB0\uD558\uAC8C \uD45C\uC2DC\uD569\uB2C8\uB2E4."]
];
var NOTIFICATION_OPTIONS = [
  ["sound", "\uC54C\uB9BC \uC18C\uB9AC", "\uB0B4 \uCC28\uB840\uC640 \uD589\uB3D9 \uC54C\uB9BC\uC5D0 \uC18C\uB9AC\uB97C \uC0AC\uC6A9\uD569\uB2C8\uB2E4."],
  ["vibration", "\uC9C4\uB3D9 \uC54C\uB9BC", "\uC9C0\uC6D0\uD558\uB294 \uAE30\uAE30\uC5D0\uC11C \uC9E7\uC740 \uC9C4\uB3D9\uC73C\uB85C \uC54C\uB9BD\uB2C8\uB2E4."]
];
var CONTROL_OPTIONS = [
  ["autoWin", "\uC790\uB3D9 \uD654\uB8CC", "\uB860\xB7\uCBD4\uBAA8\uAC00 \uAC00\uB2A5\uD558\uBA74 \uC790\uB3D9\uC73C\uB85C \uD654\uB8CC\uD569\uB2C8\uB2E4."]
];
function element3(document2, tag, className, text3) {
  const node = document2.createElement(tag);
  if (className) node.className = className;
  if (text3 !== void 0) node.textContent = text3;
  return node;
}
function mountPersonalSettings(container, { value, onChange, onPreview } = {}) {
  if (!container?.ownerDocument) throw new TypeError("A settings container is required");
  const document2 = container.ownerDocument, controls = /* @__PURE__ */ new Map();
  let current = normalizePreferences(value);
  const root = element3(document2, "div", "personal-settings");
  const heading = element3(document2, "div", "panel-heading");
  heading.append(element3(document2, "span", "eyebrow", "PERSONAL SETTINGS"), element3(document2, "h1", "", "\uB0B4 \uD654\uBA74\uC5D0 \uB9DE\uAC8C."));
  root.append(heading, element3(document2, "p", "intro", "\uAC1C\uC778 \uC124\uC815\uC740 \uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0 \uC800\uC7A5\uB418\uACE0 \uBC14\uB85C \uC801\uC6A9\uB429\uB2C8\uB2E4."));
  function update(patch) {
    current = normalizePreferences({ ...current, ...patch });
    refresh();
    onChange?.({ ...current });
  }
  function group(title, definitions) {
    const fieldset = element3(document2, "fieldset", "personal-settings-group");
    fieldset.append(element3(document2, "legend", "personal-settings-title", title));
    for (const [key, title2, description] of definitions) {
      const label = element3(document2, "label", "switch-row personal-setting-switch");
      const words = element3(document2, "span", "");
      words.append(element3(document2, "strong", "", title2), element3(document2, "small", "", description));
      const input = element3(document2, "input", "");
      input.type = "checkbox";
      input.name = key;
      input.dataset.preference = key;
      input.setAttribute("role", "switch");
      input.setAttribute("aria-label", title2);
      input.addEventListener("change", () => update({ [key]: input.checked }));
      controls.set(key, input);
      label.append(words, input);
      fieldset.append(label);
    }
    root.append(fieldset);
    return fieldset;
  }
  const displayGroup = group("\uD589\uB3D9 \uD45C\uC2DC", DISPLAY_OPTIONS);
  const discardLabel = element3(document2, "label", "field personal-settings-discard-display");
  discardLabel.append(element3(document2, "span", "", "\uCBD4\uBAA8\uAE30\uB9AC\xB7\uD14C\uB2E4\uC2DC \uAD6C\uBD84"));
  const discardDisplay = element3(document2, "select", "");
  discardDisplay.name = "discardDisplay";
  discardDisplay.dataset.preference = "discardDisplay";
  discardDisplay.setAttribute("aria-label", "\uCBD4\uBAA8\uAE30\uB9AC\xB7\uD14C\uB2E4\uC2DC \uAD6C\uBD84");
  for (const [value2, label] of [["none", "\uD45C\uC2DC \uC548 \uD568"], ["gray", "\uCBD4\uBAA8\uAE30\uB9AC \uD328\uB97C \uD68C\uC0C9\uC73C\uB85C"], ["text", "\uBC84\uB9BC \uC54C\uB9BC\uC5D0 \uAE00\uC790\uB85C"]]) {
    const option = element3(document2, "option", "", label);
    option.value = value2;
    discardDisplay.append(option);
  }
  discardDisplay.addEventListener("change", () => update({ discardDisplay: discardDisplay.value }));
  controls.set("discardDisplay", discardDisplay);
  discardLabel.append(discardDisplay, element3(document2, "small", "", "\uD68C\uC0C9\uC740 \uCBD4\uBAA8\uAE30\uB9AC \uD328\uC5D0\uB9CC \uC801\uC6A9\uD569\uB2C8\uB2E4. \uAE00\uC790 \uD45C\uC2DC\uB294 \uCBD4\uBAA8\uAE30\uB9AC\xB7\uD14C\uB2E4\uC2DC\uB97C \uBAA8\uB450 \uAD6C\uBD84\uD569\uB2C8\uB2E4. \uAD6C\uBD84 \uC815\uBCF4\uAC00 \uC5C6\uB294 \uC774\uC804 \uD328\uBCF4\uC5D0\uB294 \uD45C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
  displayGroup.append(discardLabel);
  displayGroup.append(element3(document2, "p", "hint personal-settings-note", "\uAE30\uAE30\uC758 \u2018\uB3D9\uC791 \uC904\uC774\uAE30\u2019\uAC00 \uCF1C\uC838 \uC788\uC73C\uBA74 \uC774 \uC124\uC815\uACFC \uAD00\uACC4\uC5C6\uC774 \uC560\uB2C8\uBA54\uC774\uC158\uC744 \uC904\uC785\uB2C8\uB2E4."));
  const notificationGroup = group("\uC54C\uB9BC", NOTIFICATION_OPTIONS);
  const volumeLabel = element3(document2, "label", "field personal-settings-volume");
  const volumeHeading = element3(document2, "span", "personal-settings-volume-heading");
  const volumeOutput = element3(document2, "output", "", "");
  volumeHeading.append(element3(document2, "span", "", "\uC54C\uB9BC \uC74C\uB7C9"), volumeOutput);
  const volume = element3(document2, "input", "");
  volume.type = "range";
  volume.name = "volume";
  volume.min = "0";
  volume.max = "1";
  volume.step = "0.05";
  volume.dataset.preference = "volume";
  volume.setAttribute("aria-label", "\uC54C\uB9BC \uC74C\uB7C9");
  volume.addEventListener("input", () => update({ volume: Number(volume.value) }));
  controls.set("volume", volume);
  volumeLabel.append(volumeHeading, volume);
  const preview = element3(document2, "button", "secondary full", "\uD45C\uC2DC\xB7\uC54C\uB9BC \uBBF8\uB9AC\uBCF4\uAE30");
  preview.type = "button";
  preview.dataset.action = "preview-sound";
  preview.addEventListener("click", () => onPreview?.({ ...current }));
  notificationGroup.append(volumeLabel, preview, element3(document2, "p", "hint personal-settings-note", "\uC18C\uB9AC\uB294 \uD654\uBA74\uC744 \uB204\uB978 \uB4A4 \uC7AC\uC0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC9C4\uB3D9\uC740 \uC9C0\uC6D0\uD558\uB294 \uAE30\uAE30\uC640 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C\uB9CC \uC791\uB3D9\uD569\uB2C8\uB2E4."));
  group("\uC870\uC791", CONTROL_OPTIONS);
  const reset = element3(document2, "button", "secondary full personal-settings-reset", "\uB0B4 \uC124\uC815 \uCD08\uAE30\uD654");
  reset.type = "button";
  reset.dataset.action = "reset-preferences";
  reset.addEventListener("click", () => update(DEFAULT_PREFERENCES));
  root.append(reset, element3(document2, "p", "hint", "\uC774 \uBE0C\uB77C\uC6B0\uC800\uC758 \uAC1C\uC778 \uC124\uC815\uC744 \uAE30\uBCF8\uAC12\uC73C\uB85C \uB418\uB3CC\uB9BD\uB2C8\uB2E4."));
  function refresh() {
    for (const [key, control] of controls) {
      if (key === "volume") {
        control.value = String(current.volume);
        const percent = `${Math.round(current.volume * 100)}%`;
        control.setAttribute("aria-valuetext", percent);
        volumeOutput.textContent = percent;
      } else if (control.type === "checkbox") control.checked = current[key];
      else control.value = String(current[key]);
    }
  }
  container.replaceChildren(root);
  refresh();
  return {
    setValue(value2) {
      current = normalizePreferences(value2);
      refresh();
    }
  };
}

// duplicate/feedback-model.mjs
var KINDS = /* @__PURE__ */ new Set(["discard", "call", "kan", "riichi", "win"]);
var copy = (value) => structuredClone(value);
var PUBLIC_FIELDS = ["id", "kind", "seat", "tile", "tileId", "red", "source", "callType", "method", "drawIndex", "discardIndex", "sourceDiscardIndex", "sourceTileId", "sourceDiscardId"];
var publicCopy = (event3) => {
  const safe = {};
  for (const field of PUBLIC_FIELDS) if (Object.hasOwn(event3, field) && (event3[field] === null || ["string", "number", "boolean"].includes(typeof event3[field]))) safe[field] = event3[field];
  if (typeof event3.tsumogiri === "boolean") safe.tsumogiri = event3.tsumogiri;
  if (Array.isArray(event3.tiles)) safe.tiles = event3.tiles.map((tile3) => Object.fromEntries(["id", "type", "red"].filter((field) => Object.hasOwn(tile3 ?? {}, field) && (field === "red" ? typeof tile3[field] === "boolean" : Number.isInteger(tile3[field]))).map((field) => [field, tile3[field]])));
  return safe;
};
var acceptedEvents = (view) => {
  const byId = /* @__PURE__ */ new Map();
  for (const event3 of view.publicEvents ?? []) if (Number.isSafeInteger(event3?.id) && event3.id >= 0 && KINDS.has(event3.kind)) byId.set(event3.id, publicCopy(event3));
  return [...byId.values()].sort((a, b) => a.id - b.id).map(copy);
};
var physicalId = (event3) => Number.isInteger(event3?.tileId) && event3.tileId >= 0 && event3.tileId < 136 ? event3.tileId : null;
var sameDeclaration = (discard, riichi) => discard?.kind === "discard" && discard.seat === riichi.seat && (physicalId(discard) !== null && physicalId(riichi) !== null ? physicalId(discard) === physicalId(riichi) : Number.isSafeInteger(discard.discardIndex) && discard.discardIndex === riichi.discardIndex);
function pendingDeclaration(view, event3) {
  const last = view?.lastDiscard;
  if (view?.phase !== "reaction" || last?.seat !== event3.seat) return false;
  const id = last.tileId ?? last.id;
  if (physicalId(event3) === null || physicalId(event3) !== id) return false;
  return view.players?.[event3.seat]?.river?.some((tile3) => tile3.riichi && (tile3.tileId ?? tile3.id) === id) ?? false;
}
function coalesceFeedbackEvents(events, { view = null, relatedEvents = [] } = {}) {
  const key = (event3) => event3.id ?? event3, known = /* @__PURE__ */ new Map();
  for (const event3 of [...relatedEvents, ...events]) if (event3 && typeof event3 === "object" && !known.has(key(event3))) known.set(key(event3), event3);
  const pool = [...known.values()];
  if (pool.every((event3) => Number.isSafeInteger(event3.id))) pool.sort((a, b) => a.id - b.id);
  const suppressed = /* @__PURE__ */ new Set(), links = /* @__PURE__ */ new Map();
  for (let index = 0; index < pool.length; index++) {
    const event3 = pool[index];
    if (event3.kind !== "riichi") continue;
    if (event3.riichiDiscardId !== void 0) {
      const discard = pool.find((item) => item.id === event3.riichiDiscardId && sameDeclaration(item, event3));
      if (discard) {
        suppressed.add(key(discard));
        links.set(key(event3), discard);
      }
      continue;
    }
    for (let prior = index - 1; prior >= 0; prior--) {
      const discard = pool[prior];
      if (!sameDeclaration(discard, event3)) continue;
      suppressed.add(key(discard));
      if (discard.id !== void 0) links.set(key(event3), discard);
      break;
    }
  }
  const shown = [], seen = /* @__PURE__ */ new Set();
  for (const original of events) {
    if (!original || typeof original !== "object") continue;
    const id = key(original);
    if (seen.has(id) || suppressed.has(id) || original.kind === "discard" && pendingDeclaration(view, original)) continue;
    seen.add(id);
    const event3 = known.get(id), linked = links.get(id), discardId = linked?.id ?? event3.riichiDiscardId, display = { ...event3 };
    if (typeof display.tsumogiri !== "boolean") delete display.tsumogiri;
    if (event3.kind === "riichi" && discardId !== void 0) {
      display.riichiDiscardId = discardId;
      if (typeof linked?.tsumogiri === "boolean") {
        if (typeof event3.tsumogiri === "boolean" && event3.tsumogiri !== linked.tsumogiri) delete display.tsumogiri;
        else display.tsumogiri = linked.tsumogiri;
      }
    }
    shown.push(copy(display));
  }
  return shown;
}
function createFeedbackTracker() {
  let mounted = false, board = null, cursor = -1, history = [], lastDiscard = null;
  const result = (events = [], newBoard = false, view = null) => ({ events: coalesceFeedbackEvents(events, { view, relatedEvents: history }), history: coalesceFeedbackEvents(history, { view }).slice(-6), lastDiscard: copy(lastDiscard), newBoard });
  return { update(view, boardKey) {
    if (!view) {
      mounted = false;
      board = null;
      cursor = -1;
      history = [];
      lastDiscard = null;
      return result();
    }
    const incoming = acceptedEvents(view), latest = incoming.at(-1)?.id ?? -1;
    if (!mounted || boardKey !== board) {
      mounted = true;
      board = boardKey;
      cursor = latest;
      history = incoming.slice(-32);
      lastDiscard = incoming.findLast((event3) => event3.kind === "discard") ?? null;
      return result([], true, view);
    }
    if (latest <= cursor) return result([], false, view);
    const events = incoming.filter((event3) => event3.id > cursor), merged = new Map(history.map((event3) => [event3.id, event3]));
    for (const event3 of incoming) merged.set(event3.id, event3);
    history = [...merged.values()].sort((a, b) => a.id - b.id).slice(-32);
    lastDiscard = incoming.findLast((event3) => event3.kind === "discard") ?? lastDiscard;
    cursor = latest;
    return result(events, false, view);
  } };
}

// duplicate/feedback-view.mjs
var POSITIONS = ["bottom", "right", "top", "left"];
var ACTIONS = { discard: "\uBC84\uB9BC", riichi: "\uB9AC\uCE58", chi: "\uCE58", pon: "\uD401", minkan: "\uBA85\uAE61", ankan: "\uC548\uAE61", kakan: "\uAC00\uAE61", kan: "\uAE61", ron: "\uB860", tsumo: "\uCBD4\uBAA8" };
var FLAGS = ["lastDiscard", "actionBubbles", "animations", "turnHighlight", "recentActions", "callPreview", "sound", "vibration", "reducedMotion"];
var validSeat2 = (seat5) => Number.isInteger(seat5) && seat5 >= 0 && seat5 < 4;
var validTile = (tile3) => Number.isInteger(tile3) && tile3 >= 0 && tile3 < 34;
var discardDetail = (event3, mode) => mode === "text" && ["discard", "riichi"].includes(event3.kind) && typeof event3.tsumogiri === "boolean" ? event3.tsumogiri ? "\uCBD4\uBAA8\uAE30\uB9AC" : "\uD14C\uB2E4\uC2DC" : null;
var actionName = (event3, mode = "none") => {
  const base = ACTIONS[event3.kind === "win" ? event3.method : event3.kind === "call" || event3.kind === "kan" ? event3.callType ?? event3.kind : event3.kind] ?? "\uC120\uD0DD", detail = discardDetail(event3, mode);
  return detail ? event3.kind === "riichi" ? `\uB9AC\uCE58 \xB7 ${detail}` : detail : base;
};
var sourceSeat = (event3) => validSeat2(event3?.source) ? event3.source : validSeat2(event3?.sourceSeat) ? event3.sourceSeat : validSeat2(event3?.source?.seat) ? event3.source.seat : null;
function createFeedbackPresenter({ table, handArea, historyContainer, getPreferences, getPlayerName }) {
  if (!table || !handArea) throw new Error("Feedback needs the table and hand area");
  const document2 = table.ownerDocument, window2 = document2.defaultView;
  const media = window2?.matchMedia?.("(prefers-reduced-motion: reduce)");
  const timers = /* @__PURE__ */ new Map(), ghosts = /* @__PURE__ */ new Set(), transientMarks = /* @__PURE__ */ new Set(), voices = /* @__PURE__ */ new Set(), seen = /* @__PURE__ */ new Set();
  let view = null, lastDiscard = null, preferences = {}, logItems = [], initialized = false, destroyed = false, delay = 0, audio = null;
  const node = (tag, className, text3) => {
    const el = document2.createElement(tag);
    el.className = className;
    if (text3 !== void 0) el.textContent = text3;
    return el;
  };
  const layer = node("div", "feedback-layer");
  layer.setAttribute("aria-hidden", "true");
  const callouts = POSITIONS.map((position) => {
    const el = node("div", `feedback-callout feedback-${position}`);
    el.hidden = true;
    layer.append(el);
    return el;
  });
  const calloutEvents = Array(4).fill(null);
  const riichiMarkers = POSITIONS.map((position) => {
    const el = node("div", `feedback-riichi-marker feedback-riichi-${position}`);
    el.hidden = true;
    el.append(node("span", "feedback-riichi-stick"), node("span", "feedback-riichi-label", "\u7ACB\u76F4"));
    layer.append(el);
    return el;
  });
  const winner = node("div", "feedback-win-banner");
  winner.hidden = true;
  layer.append(winner);
  const announcement = node("div", "feedback-announcement");
  announcement.setAttribute("role", "status");
  announcement.setAttribute("aria-live", "polite");
  announcement.setAttribute("aria-atomic", "true");
  table.append(layer, announcement);
  historyContainer?.classList.add("feedback-history");
  const name = (seat5) => {
    try {
      const result = getPlayerName?.(seat5);
      if (typeof result === "string" && result.trim()) return result;
    } catch {
    }
    return validSeat2(seat5) ? ["\u6771", "\u5357", "\u897F", "\u5317"][(seat5 - (view?.dealer ?? 0) + 4) % 4] : "\uD50C\uB808\uC774\uC5B4";
  };
  const relative = (seat5) => (seat5 - (view?.seat ?? 0) + 4) % 4;
  const later = (key, callback, ms) => {
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => {
      timers.delete(key);
      if (!destroyed) callback();
    }, ms));
  };
  function stopGhosts() {
    for (const ghost of ghosts) {
      ghost.getAnimations?.().forEach((animation) => animation.cancel());
      ghost.remove();
    }
    ghosts.clear();
  }
  function stopSound() {
    for (const voice of voices) {
      try {
        voice.oscillator.stop();
      } catch {
      }
      voice.oscillator.disconnect();
      voice.gain.disconnect();
    }
    voices.clear();
  }
  function stopVibration() {
    try {
      window2?.navigator?.vibrate?.(0);
    } catch {
    }
  }
  function clearMarks() {
    for (const [element4, cls] of transientMarks) element4.classList.remove(cls);
    transientMarks.clear();
  }
  function resetEffects() {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    stopGhosts();
    stopSound();
    stopVibration();
    clearMarks();
    for (const [index, el] of callouts.entries()) {
      el.hidden = true;
      el.replaceChildren();
      el.classList.remove("feedback-enter");
      calloutEvents[index] = null;
    }
    for (const el of riichiMarkers) el.hidden = true;
    winner.hidden = true;
    winner.replaceChildren();
    announcement.textContent = "";
    delay = 0;
    table.querySelectorAll(".feedback-last-discard").forEach((el) => el.classList.remove("feedback-last-discard"));
  }
  function readPreferences() {
    let input = {};
    try {
      input = getPreferences?.() ?? {};
    } catch {
    }
    const next = Object.fromEntries(FLAGS.map((key) => [key, input[key] === true]));
    next.discardDisplay = ["none", "gray", "text"].includes(input.discardDisplay) ? input.discardDisplay : "none";
    const volume = Number(input.volume);
    next.volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0.35;
    next.motion = next.animations && !next.reducedMotion && !media?.matches;
    return next;
  }
  function syncPreferences() {
    const before = preferences;
    preferences = readPreferences();
    table.classList.toggle("feedback-no-motion", !preferences.motion);
    table.classList.toggle("feedback-turn-muted", !preferences.turnHighlight);
    if (!preferences.motion) {
      stopGhosts();
      for (const el of callouts) el.classList.remove("feedback-enter");
      winner.classList.remove("feedback-enter");
    }
    if (!preferences.actionBubbles) {
      for (const el of callouts) el.hidden = true;
      winner.hidden = true;
      delay = 0;
    }
    if (before.discardDisplay !== preferences.discardDisplay) for (const [index, box] of callouts.entries()) {
      const event3 = calloutEvents[index], label = box.querySelector(".feedback-callout-action");
      if (!box.hidden && event3 && label) {
        label.textContent = actionName(event3, preferences.discardDisplay);
        label.classList.toggle("feedback-discard-detail", !!discardDetail(event3, preferences.discardDisplay));
      }
    }
    if (!preferences.actionBubbles && !preferences.animations) clearMarks();
    if (!preferences.actionBubbles && !preferences.recentActions) announcement.textContent = "";
    if (!preferences.lastDiscard) table.querySelectorAll(".feedback-last-discard").forEach((el) => el.classList.remove("feedback-last-discard"));
    if (!preferences.recentActions) {
      logItems = [];
      if (historyContainer) {
        historyContainer.replaceChildren();
        historyContainer.hidden = true;
      }
    }
    if (!preferences.sound || preferences.volume === 0) stopSound();
    if (before.vibration && !preferences.vibration) stopVibration();
    return before;
  }
  function mark(element4, cls, key, ms = 1100) {
    if (!element4) return;
    element4.classList.add(cls);
    const entry = [element4, cls];
    transientMarks.add(entry);
    later(`mark-${key}`, () => {
      element4.classList.remove(cls);
      transientMarks.delete(entry);
    }, ms);
  }
  function riverTile(discard, seat5 = discard?.seat) {
    if (!discard) return null;
    const candidates = Array.from(table.querySelectorAll(".river [data-discard-id]")).filter((el) => !validSeat2(seat5) || Number(el.dataset.seat) === seat5);
    const physical4 = discard.tileId ?? (Number.isInteger(discard.tile?.id) ? discard.tile.id : null);
    if (physical4 !== null && physical4 !== void 0) {
      const exact = candidates.find((el) => el.dataset.tileId === String(physical4) || el.dataset.id === String(physical4) || el.dataset.discardId === String(physical4));
      if (exact) return exact;
    }
    const discardId = discard.discardId ?? (physical4 === null || physical4 === void 0 ? discard.id : null);
    if (discardId !== null && discardId !== void 0) {
      const exact = candidates.find((el) => el.dataset.discardId === String(discardId));
      if (exact) return exact;
    }
    const type = validTile(discard.tile) ? discard.tile : discard.type;
    const matches = validTile(type) ? candidates.filter((el) => Number(el.dataset.type) === type) : candidates;
    return matches.at(-1) ?? null;
  }
  function renderLastDiscard() {
    table.querySelectorAll(".feedback-last-discard").forEach((el) => el.classList.remove("feedback-last-discard"));
    if (preferences.lastDiscard && view) riverTile(lastDiscard)?.classList.add("feedback-last-discard");
  }
  function renderTurn() {
    const myTurn = !!view && view.phase !== "end" && view.phase !== "ended" && view.actor === view.seat;
    table.classList.toggle("feedback-my-turn", preferences.turnHighlight && myTurn);
    handArea.classList.toggle("feedback-my-turn", preferences.turnHighlight && myTurn);
  }
  function renderRiichi() {
    for (let index = 0; index < 4; index++) {
      const seat5 = ((view?.seat ?? 0) + index) % 4, player = view?.players?.[seat5], marker = riichiMarkers[index];
      marker.hidden = !view || !preferences.actionBubbles || !player?.riichi;
      marker.dataset.seat = String(seat5);
      marker.title = marker.hidden ? "" : `${name(seat5)} \xB7 \uB9AC\uCE58`;
    }
  }
  function textFor(event3) {
    const tile3 = validTile(event3.tile) ? ` ${event3.red ? "\uC801 " : ""}${tileName(event3.tile)}` : "";
    const source = sourceSeat(event3), from = source !== null && source !== event3.seat ? ` \u2190 ${name(source)}` : "";
    return `${name(event3.seat)} \xB7 ${actionName(event3, preferences.discardDisplay)}${tile3}${from}`;
  }
  function renderHistory() {
    if (!historyContainer) return;
    historyContainer.hidden = !preferences.recentActions || !logItems.length;
    historyContainer.replaceChildren();
    if (historyContainer.hidden) return;
    const heading = node("div", "feedback-history-heading", "\uCD5C\uADFC \uC120\uD0DD");
    const list = node("ol", "feedback-history-list");
    for (const event3 of logItems.slice(-6)) {
      const item = node("li", `feedback-history-item feedback-history-${event3.kind}`);
      item.append(node("span", "feedback-history-player", name(event3.seat)), node("b", "feedback-history-action", actionName(event3, preferences.discardDisplay)));
      if (validTile(event3.tile)) item.append(node("span", "feedback-history-tile", `${event3.red ? "\uC801 " : ""}${tileName(event3.tile)}`));
      const source = sourceSeat(event3);
      if (source !== null && source !== event3.seat) item.append(node("span", "feedback-history-source", `\u2190 ${name(source)}`));
      list.append(item);
    }
    historyContainer.append(heading, list);
  }
  function showCallout(event3, preview2 = false) {
    if (!preferences.actionBubbles || !validSeat2(event3.seat)) return;
    const index = relative(event3.seat), box = callouts[index];
    box.replaceChildren();
    box.dataset.kind = event3.kind;
    box.dataset.seat = String(event3.seat);
    calloutEvents[index] = { kind: event3.kind, callType: event3.callType, method: event3.method, ...typeof event3.tsumogiri === "boolean" ? { tsumogiri: event3.tsumogiri } : {} };
    box.append(node("div", "feedback-callout-player", `${preview2 ? "\uBBF8\uB9AC\uBCF4\uAE30 \xB7 " : ""}${name(event3.seat)}`));
    const line = node("div", "feedback-callout-main");
    line.append(node("strong", `feedback-callout-action${discardDetail(event3, preferences.discardDisplay) ? " feedback-discard-detail" : ""}`, actionName(event3, preferences.discardDisplay)));
    if (validTile(event3.tile)) {
      const tile3 = tileFace(event3.tile, { small: true });
      tile3.classList.toggle("red", !!event3.red);
      line.append(tile3);
    }
    box.append(line);
    const source = sourceSeat(event3);
    if (source !== null && source !== event3.seat) box.append(node("div", "feedback-callout-source", `\u2190 ${name(source)}`));
    box.hidden = false;
    box.classList.remove("feedback-enter");
    if (preferences.motion) {
      void box.offsetWidth;
      box.classList.add("feedback-enter");
    }
    later(`callout-${index}`, () => {
      box.hidden = true;
      box.classList.remove("feedback-enter");
    }, event3.kind === "discard" ? 950 : 1700);
  }
  function animateDiscard(event3) {
    if (!preferences.motion || !validTile(event3.tile) || !validSeat2(event3.seat)) return;
    const target = riverTile(event3);
    if (!target || typeof target.animate !== "function") return;
    const destination = target.getBoundingClientRect(), bounds = layer.getBoundingClientRect();
    if (!destination.width || !bounds.width) return;
    const position = POSITIONS[relative(event3.seat)], source = position === "bottom" ? handArea : table.querySelector(`#opponent-${position}`);
    const origin = source?.getBoundingClientRect();
    if (!origin?.width) return;
    const ghost = tileFace(event3.tile, { small: true });
    ghost.classList.add("feedback-ghost");
    ghost.classList.toggle("red", !!event3.red);
    ghost.setAttribute("aria-hidden", "true");
    const x = destination.left - bounds.left, y = destination.top - bounds.top;
    Object.assign(ghost.style, { left: `${x}px`, top: `${y}px`, width: `${destination.width}px`, height: `${destination.height}px` });
    layer.append(ghost);
    ghosts.add(ghost);
    const dx = origin.left + origin.width / 2 - destination.left - destination.width / 2, dy = origin.top + origin.height / 2 - destination.top - destination.height / 2;
    ghost.animate([{ transform: `translate(${dx}px,${dy}px) scale(.9)`, opacity: 0.7 }, { transform: "translate(0,0) scale(1)", opacity: 1 }], { duration: 175, easing: "cubic-bezier(.2,.7,.2,1)" });
    later(`ghost-${event3.id ?? event3.seat}`, () => {
      ghost.remove();
      ghosts.delete(ghost);
    }, 210);
  }
  function highlightCall(event3) {
    if (!preferences.actionBubbles && !preferences.animations) return;
    const source = sourceSeat(event3);
    if (source !== null && source !== event3.seat) mark(riverTile({ ...event3, id: event3.sourceDiscardId ?? null }, source), "feedback-claimed-source", `source-${event3.seat}`, 1e3);
    const position = POSITIONS[relative(event3.seat)], container = position === "bottom" ? handArea.querySelector("#self-melds") : table.querySelector(`#meld-${position}`);
    const melds = Array.from(container?.querySelectorAll(".meld") ?? []);
    const matches = melds.filter((meld3) => Array.from(meld3.querySelectorAll("[data-type]")).some((tile3) => Number(tile3.dataset.type) === event3.tile));
    mark((event3.callType === "kakan" ? matches.at(-1) : melds.at(-1)) ?? melds.at(-1), "feedback-meld-hit", `meld-${event3.seat}`, 1200);
  }
  async function unlock() {
    if (destroyed) return;
    const current = readPreferences();
    if (!current.sound || current.volume === 0) return;
    try {
      if (!audio) {
        const Context = window2?.AudioContext ?? window2?.webkitAudioContext;
        if (!Context) return;
        audio = new Context();
      }
      if (audio.state === "suspended") await audio.resume();
    } catch {
    }
  }
  function sound(kind) {
    if (!preferences.sound || preferences.volume === 0 || document2.hidden || !audio || audio.state !== "running") return;
    const tones = kind === "win" ? [[523, 0.15, 0], [659, 0.18, 0.07], [784, 0.24, 0.14]] : kind === "riichi" ? [[523, 0.1, 0], [784, 0.16, 0.1]] : kind === "turn" ? [[659, 0.07, 0], [880, 0.1, 0.08]] : kind === "call" || kind === "kan" ? [[587, 0.1, 0], [698, 0.13, 0.08]] : [[880, 0.045, 0]];
    for (const [frequency, duration, offset] of tones) {
      const oscillator = audio.createOscillator(), gain = audio.createGain(), start = audio.currentTime + offset;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(preferences.volume * (kind === "discard" ? 0.035 : 0.07), start + 8e-3);
      gain.gain.exponentialRampToValueAtTime(1e-4, start + duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      const voice = { oscillator, gain };
      voices.add(voice);
      oscillator.onended = () => {
        voices.delete(voice);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + duration + 0.015);
    }
  }
  function vibrate(kind) {
    if (!preferences.vibration || document2.hidden) return;
    try {
      window2?.navigator?.vibrate?.(kind === "win" ? [35, 35, 55] : kind === "riichi" ? [20, 25, 35] : kind === "discard" ? 10 : kind === "turn" ? 25 : 20);
    } catch {
    }
  }
  function announceWins(events) {
    if (!events.length || !preferences.actionBubbles) return;
    winner.replaceChildren(node("span", "feedback-win-eyebrow", events.length > 1 ? `${events.length}\uBA85 \uB3D9\uC2DC \uD654\uB8CC` : "\uD654\uB8CC"));
    const line = node("div", "feedback-win-names");
    for (const event3 of events) line.append(node("strong", "", `${name(event3.seat)} \xB7 ${actionName(event3)}`));
    winner.append(line);
    winner.hidden = false;
    winner.classList.toggle("feedback-enter", preferences.motion);
    delay = preferences.motion ? 720 : 520;
    later("win-banner", () => {
      winner.hidden = true;
      winner.classList.remove("feedback-enter");
      delay = 0;
    }, 1600);
  }
  function update({ view: nextView, events = [], history = [], lastDiscard: nextDiscard = null, newBoard = false } = {}) {
    if (destroyed) return { winDelayMs: 0 };
    const firstUpdate = !initialized, previousView = view, before = syncPreferences();
    view = nextView ?? null;
    lastDiscard = nextDiscard;
    delay = 0;
    const becameMyTurn = !firstUpdate && !newBoard && previousView && previousView.actor !== previousView.seat && view?.actor === view?.seat && view?.phase !== "end" && view?.phase !== "ended";
    if (newBoard || !view) {
      resetEffects();
      seen.clear();
      logItems = [];
    }
    if (!view) {
      initialized = true;
      renderLastDiscard();
      renderTurn();
      renderRiichi();
      renderHistory();
      return { winDelayMs: 0 };
    }
    const presented = coalesceFeedbackEvents(events, { view, relatedEvents: [...logItems, ...history] }), visibleHistory = coalesceFeedbackEvents(history, { view, relatedEvents: logItems });
    const eventId = (event3) => String(event3.id ?? `${event3.kind}:${event3.seat}:${event3.tileId ?? event3.tile}:${sourceSeat(event3)}`), visibleEvents = new Map(presented.map((event3) => [eventId(event3), event3]));
    if ((!initialized || newBoard) && preferences.recentActions) logItems = visibleHistory.filter((event3) => validSeat2(event3.seat)).slice(-6);
    if (!initialized || newBoard) initialized = true;
    const fresh = [];
    for (const event3 of events) {
      if (!validSeat2(event3?.seat) || !["discard", "call", "kan", "riichi", "win"].includes(event3.kind)) continue;
      const id = eventId(event3);
      if (seen.has(id)) continue;
      seen.add(id);
      if (visibleEvents.has(id)) fresh.push(visibleEvents.get(id));
    }
    while (seen.size > 256) seen.delete(seen.values().next().value);
    if (!before.recentActions && preferences.recentActions && !firstUpdate && !newBoard) logItems = visibleHistory.filter((event3) => validSeat2(event3.seat)).slice(-6);
    if (preferences.recentActions) {
      logItems = coalesceFeedbackEvents([...logItems, ...visibleHistory, ...fresh], { view }).filter((event3) => validSeat2(event3.seat)).slice(-6);
    }
    renderLastDiscard();
    renderTurn();
    renderRiichi();
    renderHistory();
    for (const event3 of fresh) {
      showCallout(event3);
      if (event3.kind === "discard") animateDiscard(event3);
      if (event3.kind === "call" || event3.kind === "kan") highlightCall(event3);
    }
    const wins = fresh.filter((event3) => event3.kind === "win");
    announceWins(wins);
    if (fresh.length) {
      const priority = { discard: 0, call: 1, kan: 2, riichi: 3, win: 4 };
      const strongest = fresh.reduce((a, b) => priority[b.kind] > priority[a.kind] ? b : a);
      if (preferences.actionBubbles || preferences.recentActions) announcement.textContent = wins.length ? wins.map(textFor).join(" / ") : textFor(strongest);
      const cue = becameMyTurn && strongest.kind === "discard" ? "turn" : strongest.kind;
      sound(cue);
      vibrate(cue);
    } else if (becameMyTurn) {
      sound("turn");
      vibrate("turn");
    }
    return { winDelayMs: delay };
  }
  function preview(nextView) {
    if (destroyed) return;
    syncPreferences();
    if (nextView) view = nextView;
    if (!view) return;
    const tile3 = view.handTiles?.find((item) => validTile(item.type)) ?? (validTile(lastDiscard?.tile) ? lastDiscard : null);
    const event3 = { id: "feedback-preview", kind: "riichi", seat: view.seat, tile: tile3?.type ?? tile3?.tile ?? null, red: !!tile3?.red };
    showCallout(event3, true);
    renderTurn();
    if (preferences.turnHighlight) {
      table.classList.add("feedback-my-turn");
      handArea.classList.add("feedback-my-turn");
      later("preview-turn", renderTurn, 1600);
    }
    if (preferences.lastDiscard) {
      const target = riverTile(lastDiscard);
      mark(target, "feedback-preview-discard", "preview-discard", 1600);
    }
    if (preferences.animations && lastDiscard) animateDiscard({ ...lastDiscard, kind: "discard", tile: lastDiscard.tile ?? lastDiscard.type });
    if (preferences.recentActions && historyContainer) {
      renderHistory();
      historyContainer.hidden = false;
      const demo = node("div", "feedback-history-preview", `\uBBF8\uB9AC\uBCF4\uAE30 \xB7 ${textFor(event3)}`);
      historyContainer.prepend(demo);
      later("preview-history", renderHistory, 1600);
    }
    void unlock().then(() => {
      if (!destroyed) {
        preferences = readPreferences();
        sound("riichi");
      }
    });
    vibrate("riichi");
  }
  const motionChanged = () => {
    if (destroyed) return;
    syncPreferences();
    renderTurn();
    renderRiichi();
    renderLastDiscard();
  };
  media?.addEventListener?.("change", motionChanged);
  return {
    update,
    preview,
    unlock,
    get winDelayMs() {
      return delay;
    },
    destroy() {
      if (destroyed) return;
      resetEffects();
      destroyed = true;
      media?.removeEventListener?.("change", motionChanged);
      layer.remove();
      announcement.remove();
      historyContainer?.replaceChildren();
      if (historyContainer) historyContainer.hidden = true;
      table.classList.remove("feedback-my-turn", "feedback-no-motion", "feedback-turn-muted");
      handArea.classList.remove("feedback-my-turn");
      if (audio) {
        void audio.close().catch(() => {
        });
        audio = null;
      }
    }
  };
}

// duplicate/remote-practice.mjs
var STORAGE_KEY = "duplicate.mortal-practice.v1";
var sameMatch = (a, b) => JSON.stringify(a ? normalizeMatchRules(a) : null) === JSON.stringify(b ? normalizeMatchRules(b) : null);
function createRemotePractice({ getServer, onState, onError = () => {
}, storage = globalThis.sessionStorage, fetchImpl = globalThis.fetch, pollMs = 1200 } = {}) {
  let credentials = null, context3 = null, state = null, timer = null, active = false, epoch = 0, loading = false, lastError = "";
  const persist = () => {
    try {
      if (credentials) storage.setItem(STORAGE_KEY, JSON.stringify({ credentials, context: context3 }));
      else storage.removeItem(STORAGE_KEY);
    } catch {
    }
  };
  function schedule() {
    clearTimeout(timer);
    if (active && credentials) timer = setTimeout(poll, pollMs);
  }
  async function request2(server, path, body, key) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15e3);
    try {
      const response = await fetchImpl(`${server}/api/duplicate/competitions${path}`, { method: body === null ? "GET" : "POST", headers: { "Content-Type": "application/json", ...key ? { Authorization: `Bearer ${key}` } : {} }, body: body === null ? void 0 : JSON.stringify(body), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw Object.assign(new Error(data.error ?? "Mortal \uC5F0\uC2B5 \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."), { status: response.status });
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("Mortal \uC5F0\uC2B5 \uC11C\uBC84 \uC751\uB2F5\uC774 \uB2A6\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC5F0\uACB0\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.");
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  function apply(value, generation) {
    if (generation !== epoch || !credentials || value.code !== credentials.code) return false;
    if (value.practice !== true || value.seat !== context3.seat || value.boardCount !== context3.count || !sameMatch(value.matchRules, context3.matchRules) || normalizeDuplicateProfile(value.duplicateProfile) !== normalizeDuplicateProfile(context3.duplicateProfile)) throw new Error("\uC5F0\uC2B5 \uC5F0\uACB0 \uC815\uBCF4\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC0C8 \uC5F0\uC2B5\uC744 \uC2DC\uC791\uD574 \uC8FC\uC138\uC694.");
    if (state && value.revision < state.revision) return false;
    state = value;
    lastError = "";
    onState(value);
    return true;
  }
  async function poll() {
    if (!active || !credentials || loading) return;
    const generation = epoch, current = credentials;
    loading = true;
    try {
      const value = await request2(current.server, `/${current.code}/state`, null, current.key);
      apply(value, generation);
    } catch (error) {
      if (generation === epoch) {
        const terminal = [401, 403, 404].includes(error.status);
        if (terminal) {
          credentials = null;
          persist();
        }
        if (lastError !== error.message) {
          lastError = error.message;
          onError(error, { terminal });
        }
      }
    } finally {
      loading = false;
      schedule();
    }
  }
  return {
    restore(expected) {
      try {
        const saved2 = JSON.parse(storage.getItem(STORAGE_KEY) || "null"), c = saved2?.credentials, p = saved2?.context;
        if (!c || !p || p.seed !== expected.seed || p.seat !== expected.seat || p.count !== expected.count || !sameMatch(p.matchRules, expected.matchRules) || normalizeDuplicateProfile(p.duplicateProfile) !== normalizeDuplicateProfile(expected.duplicateProfile) || typeof c.key !== "string" || !/^[a-f0-9]{64}$/.test(c.key) || !/^[A-Z2-9]{8}$/.test(c.code) || c.seat !== p.seat || typeof c.server !== "string") return false;
        const server = new URL(c.server);
        if (!["https:", "http:"].includes(server.protocol) || server.username || server.password || server.origin !== c.server) return false;
        credentials = c;
        context3 = p;
        return true;
      } catch {
        return false;
      }
    },
    async start(options) {
      const config = options.matchRules ? normalizeMatchRules(options.matchRules) : null, count = config ? matchBoardCount(config) : options.count;
      const duplicateProfile = normalizeDuplicateProfile(options.duplicateProfile), generation = ++epoch;
      clearTimeout(timer);
      credentials = null;
      context3 = { seed: options.seed, seat: options.seat, count, matchRules: config, duplicateProfile };
      state = null;
      persist();
      const server = getServer(), value = await request2(server, "", { name: options.name ?? "\uB098", boardCount: count, rules: options.rules, duplicateProfile, ...config ? { matchRules: config } : {}, aiPolicy: "mortal", practice: { seed: options.seed, seat: options.seat } }, null);
      if (generation !== epoch) return null;
      if (typeof value.key !== "string" || !/^[a-f0-9]{64}$/.test(value.key)) throw new Error("Mortal \uC5F0\uC2B5 \uC811\uC18D \uC815\uBCF4\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      credentials = { code: value.code, key: value.key, seat: value.seat, tableId: value.tableId, server };
      persist();
      apply(value, generation);
      const begun = await request2(server, `/${value.code}/start-ai`, { revision: value.revision, actionId: crypto.randomUUID() }, value.key);
      apply(begun, generation);
      schedule();
      return state;
    },
    async act(action) {
      if (!credentials || !state) throw new Error("Mortal \uC5F0\uC2B5\uC5D0 \uB2E4\uC2DC \uC5F0\uACB0\uD574 \uC8FC\uC138\uC694.");
      const generation = epoch, current = credentials, value = await request2(current.server, `/${current.code}/action`, { action, revision: state.revision, actionId: crypto.randomUUID() }, current.key);
      apply(value, generation);
      schedule();
      return state;
    },
    async next() {
      if (!credentials || !state) throw new Error("Mortal \uC5F0\uC2B5\uC5D0 \uB2E4\uC2DC \uC5F0\uACB0\uD574 \uC8FC\uC138\uC694.");
      const generation = epoch, current = credentials, value = await request2(current.server, `/${current.code}/next`, { revision: state.revision, actionId: crypto.randomUUID() }, current.key);
      apply(value, generation);
      schedule();
      return state;
    },
    async replays() {
      if (!credentials) throw new Error("Mortal \uC5F0\uC2B5\uC5D0 \uB2E4\uC2DC \uC5F0\uACB0\uD574 \uC8FC\uC138\uC694.");
      const current = credentials;
      return request2(current.server, `/${current.code}/replays`, null, current.key);
    },
    async replay(handId2) {
      if (!credentials) throw new Error("Mortal \uC5F0\uC2B5\uC5D0 \uB2E4\uC2DC \uC5F0\uACB0\uD574 \uC8FC\uC138\uC694.");
      const parts = typeof handId2 === "string" && handId2.match(/^([1-9]\d?):(0|[1-9]\d*)$/);
      if (!parts || Number(parts[1]) > 16 || !Number.isSafeInteger(Number(parts[2]))) throw new Error("\uB9AC\uD50C\uB808\uC774 \uAD6D\xB7\uBCF8\uC7A5 \uBC88\uD638\uB97C \uD655\uC778\uD558\uC138\uC694.");
      const current = credentials;
      return request2(current.server, `/${current.code}/replays?handId=${encodeURIComponent(handId2)}`, null, current.key);
    },
    activate() {
      active = true;
      void poll();
    },
    deactivate() {
      active = false;
      clearTimeout(timer);
    },
    clear() {
      epoch++;
      active = false;
      clearTimeout(timer);
      credentials = null;
      context3 = null;
      state = null;
      persist();
    },
    poll,
    get connected() {
      return !!credentials;
    },
    get state() {
      return state;
    },
    get server() {
      return credentials?.server ?? null;
    }
  };
}

// duplicate/observer-delay.mjs
var DEFAULT_OBSERVER_DELAY_SECONDS = 300;
var factor = (unit) => {
  if (!["seconds", "minutes"].includes(unit)) throw Error("\uC9C0\uC5F0 \uB2E8\uC704\uB97C \uD655\uC778\uD558\uC138\uC694.");
  return unit === "minutes" ? 60 : 1;
};
function observerDelaySeconds(value, unit = "seconds", { minimumSeconds = 5 } = {}) {
  if (!["number", "string"].includes(typeof value) || String(value).trim() === "") throw Error("\uC911\uACC4 \uC9C0\uC5F0 \uC2DC\uAC04\uC744 \uC785\uB825\uD558\uC138\uC694.");
  const seconds = Number(value) * factor(unit), rounded = Math.round(seconds);
  if (!Number.isFinite(seconds) || Math.abs(seconds - rounded) > 1e-7 || !Number.isSafeInteger(rounded)) throw Error("\uC911\uACC4 \uC9C0\uC5F0\uC740 1\uCD08 \uB2E8\uC704\uB85C \uC785\uB825\uD558\uC138\uC694. \uBD84 \uB2E8\uC704 \uC18C\uC218\uB97C \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
  if (!Number.isInteger(minimumSeconds) || minimumSeconds < 5 || minimumSeconds > 21600) throw Error("\uCD5C\uC18C \uC911\uACC4 \uC9C0\uC5F0\uC744 \uD655\uC778\uD558\uC138\uC694.");
  if (rounded < minimumSeconds || rounded > 21600) throw Error(`\uC911\uACC4 \uC9C0\uC5F0\uC740 ${minimumSeconds}\u201321600\uCD08 \uBC94\uC704\uB85C \uC785\uB825\uD558\uC138\uC694.`);
  return rounded;
}
function observerDelayValue(seconds, unit = "seconds") {
  return String(observerDelaySeconds(seconds) / factor(unit));
}
function observerDelayLabel(seconds) {
  const value = observerDelaySeconds(seconds);
  return value % 60 === 0 ? `${value / 60}\uBD84 (${value}\uCD08)` : `${value}\uCD08`;
}
function bindObserverDelayInput(input, select, { seconds = 300, minimumSeconds = 5, onError = () => {
} } = {}) {
  let unit = select.value || "minutes", minimum = minimumSeconds;
  function constraints() {
    const scale = factor(unit);
    input.min = String(minimum / scale);
    input.max = String(21600 / scale);
    input.step = unit === "minutes" ? "any" : "1";
    input.inputMode = unit === "minutes" ? "decimal" : "numeric";
    input.setAttribute("aria-label", `\uC911\uACC4 \uC9C0\uC5F0 ${unit === "minutes" ? "\uBD84" : "\uCD08"}`);
  }
  function setSeconds(value) {
    const canonical2 = observerDelaySeconds(value);
    input.value = observerDelayValue(canonical2, unit);
    constraints();
  }
  const change = () => {
    try {
      const value = observerDelaySeconds(input.value, unit);
      const next = select.value;
      factor(next);
      unit = next;
      setSeconds(value);
    } catch (error) {
      select.value = unit;
      onError(error.message);
    }
  };
  select.addEventListener("change", change);
  setSeconds(seconds);
  return {
    getSeconds: () => observerDelaySeconds(input.value, unit, { minimumSeconds: minimum }),
    setSeconds,
    setMinimum(value) {
      observerDelaySeconds(value);
      minimum = value;
      constraints();
    },
    destroy() {
      select.removeEventListener("change", change);
    }
  };
}

// duplicate/observer-links.mjs
var CODE = /^[A-Z2-9]{8}$/;
var KEY = /^[a-f0-9]{64}$/;
function observerLink({ baseUrl, code, key, server, delaySeconds = DEFAULT_OBSERVER_DELAY_SECONDS }) {
  if (!CODE.test(code ?? "") || !KEY.test(key ?? "") || !Number.isSafeInteger(delaySeconds) || delaySeconds < 5 || delaySeconds > 21600) throw new Error("\uAD00\uC804 \uB9C1\uD06C \uC815\uBCF4\uAC00 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  const api = new URL(server);
  if (!["https:", "http:"].includes(api.protocol) || api.username || api.password || api.pathname !== "/" || api.search || api.hash) throw new Error("\uC11C\uBC84 \uC8FC\uC18C\uB97C \uD655\uC778\uD558\uC138\uC694.");
  if (api.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(api.hostname)) throw new Error("\uACF5\uAC1C \uC11C\uBC84\uB294 HTTPS \uC8FC\uC18C\uB97C \uC0AC\uC6A9\uD558\uC138\uC694.");
  const url = new URL("./tournament/observer.html", baseUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("code", code);
  url.searchParams.set("server", api.origin);
  url.searchParams.set("delay", String(delaySeconds));
  url.hash = new URLSearchParams({ key }).toString();
  return url.href;
}
function mountObserverLinks({ document: document2, getRoom, getServer, request: request2, toast: toast2, baseUrl = globalThis.location?.href, clipboard = globalThis.navigator?.clipboard }) {
  const $2 = (id) => document2.getElementById(id), open = $2("observer-links-open"), dialog = $2("observer-links-dialog"), create = $2("observer-links-create"), delay = $2("observer-min-delay");
  const delayInput = bindObserverDelayInput(delay, $2("observer-min-delay-unit"), { onError: toast2 });
  let issuing = false, roomCode = null;
  function clear() {
    for (const role of ["viewer", "caster"]) {
      $2(`observer-${role}-url`).value = "";
      $2(`observer-${role}-open`).removeAttribute("href");
    }
    $2("observer-issued-links").hidden = true;
  }
  function update() {
    const room = getRoom();
    open.hidden = !room?.organizer;
    open.disabled = issuing;
    if (room?.code !== roomCode) {
      roomCode = room?.code ?? null;
      clear();
      delayInput.setSeconds(room?.observer?.minimumDelaySeconds ?? DEFAULT_OBSERVER_DELAY_SECONDS);
      if (dialog.open) dialog.close();
    }
    create.disabled = issuing || !room?.organizer;
  }
  open.addEventListener("click", () => {
    update();
    if (!getRoom()?.organizer) return;
    dialog.showModal();
  });
  create.addEventListener("click", async () => {
    const room = getRoom();
    if (issuing || !room?.organizer) return;
    let value;
    try {
      value = delayInput.getSeconds();
    } catch (error) {
      toast2(error.message);
      delay.focus();
      return;
    }
    issuing = true;
    update();
    create.textContent = "\uC911\uACC4 \uB9C1\uD06C\uB97C \uB9CC\uB4E4\uACE0 \uC788\uC2B5\uB2C8\uB2E4\u2026";
    try {
      const result = await request2(`/${room.code}/observer-access`, { delaySeconds: value });
      if (getRoom()?.code !== room.code || !getRoom()?.organizer) return;
      if (result.code !== room.code || !KEY.test(result.viewerKey ?? "") || !KEY.test(result.casterKey ?? "") || result.viewerKey === result.casterKey || result.delaySeconds < 5) throw new Error("\uC911\uACC4 \uB9C1\uD06C \uC751\uB2F5\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      for (const role of ["viewer", "caster"]) {
        const url = observerLink({ baseUrl, code: result.code, key: result[`${role}Key`], server: getServer(), delaySeconds: result.delaySeconds });
        $2(`observer-${role}-url`).value = url;
        $2(`observer-${role}-open`).href = url;
      }
      $2("observer-issued-links").hidden = false;
      $2("observer-link-status").textContent = `\uCD5C\uC18C ${observerDelayLabel(result.delaySeconds)} \uC9C0\uC5F0${room.tournament ? " \xB7 \uC804\uD0C1\uC758 \uAC19\uC740 \uAD6D\xB7\uBCF8\uC7A5 \uC885\uB8CC\xB7\uD1B5\uACFC \uD6C4 \uAE30\uB85D \uACF5\uAC1C" : ""} \xB7 \uAE30\uC874 \uB9C1\uD06C\uB294 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAD00\uC804 \uCC3D\uC5D0\uC11C \uB354 \uAE34 \uC9C0\uC5F0\uC744 \uC124\uC815\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`;
      toast2("\uAD00\uC804\xB7\uC911\uACC4 \uB9C1\uD06C\uB97C \uB9CC\uB4E4\uC5C8\uC2B5\uB2C8\uB2E4.");
    } catch (error) {
      toast2(error.message);
    } finally {
      issuing = false;
      create.textContent = "\uB9C1\uD06C \uB9CC\uB4E4\uAE30 \xB7 \uC7AC\uBC1C\uAE09";
      update();
    }
  });
  for (const role of ["viewer", "caster"]) $2(`observer-${role}-copy`).addEventListener("click", async () => {
    const input = $2(`observer-${role}-url`);
    if (!input.value) return;
    try {
      await clipboard.writeText(input.value);
      toast2(role === "caster" ? "\uC911\uACC4\uC790 \uC804\uC6A9 \uB9C1\uD06C\uB97C \uBCF5\uC0AC\uD588\uC2B5\uB2C8\uB2E4." : "\uC77C\uBC18 \uAD00\uC804 \uB9C1\uD06C\uB97C \uBCF5\uC0AC\uD588\uC2B5\uB2C8\uB2E4.");
    } catch {
      input.focus();
      input.select();
      toast2("\uC120\uD0DD\uB41C \uB9C1\uD06C\uB97C \uBCF5\uC0AC\uD574 \uC8FC\uC138\uC694.");
    }
  });
  update();
  return { update };
}

// duplicate/accounts/protocol.mjs
var protocol_exports = {};
__export(protocol_exports, {
  ACCOUNT_PROTOCOL: () => ACCOUNT_PROTOCOL,
  PRIVACY_VERSION: () => PRIVACY_VERSION,
  SESSION_TTL_MS: () => SESSION_TTL_MS,
  base64url: () => base64url,
  decryptAccountRequest: () => decryptAccountRequest,
  decryptAccountResult: () => decryptAccountResult,
  encryptAccountRequest: () => encryptAccountRequest,
  encryptAccountResult: () => encryptAccountResult,
  fromBase64url: () => fromBase64url,
  randomSecret: () => randomSecret,
  sha256: () => sha256,
  signAccountSession: () => signAccountSession,
  validateNickname: () => validateNickname,
  validatePassword: () => validatePassword,
  verifyAccountSession: () => verifyAccountSession
});
var ACCOUNT_PROTOCOL = "duplicate-accounts-v1";
var PRIVACY_VERSION = "2026-10-20-v1";
var SESSION_TTL_MS = 8 * 60 * 60 * 1e3;
var encoder = new TextEncoder();
var decoder = new TextDecoder("utf-8", { fatal: true });
var requestAAD = encoder.encode(`${ACCOUNT_PROTOCOL}:request`);
var resultAAD = encoder.encode(`${ACCOUNT_PROTOCOL}:result`);
var clock = (value) => typeof value === "function" ? value() : value;
var object2 = (value) => value && typeof value === "object" && !Array.isArray(value);
function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function fromBase64url(value, max = 16384) {
  if (typeof value !== "string" || !value.length || value.length > max || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error("Invalid encoded account data");
  const text3 = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(text3, (char) => char.charCodeAt(0));
}
function randomSecret() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}
async function sha256(value) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))].map((n) => n.toString(16).padStart(2, "0")).join("");
}
function validateNickname(value) {
  if (typeof value !== "string") throw Error("\uB2C9\uB124\uC784\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
  const nickname = value.normalize("NFKC").trim();
  if ([...nickname].length < 1 || [...nickname].length > 20 || /[\u0000-\u001f\u007f-\u009f]/u.test(nickname)) throw Error("\uB2C9\uB124\uC784\uC740 \uC81C\uC5B4\uBB38\uC790 \uC5C6\uC774 1\u201320\uC790\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
  return { nickname, normalized: nickname.toLowerCase() };
}
function validatePassword(value) {
  if (typeof value !== "string" || [...value].length < 15 || [...value].length > 128 || encoder.encode(value).length > 512) throw Error("\uBE44\uBC00\uBC88\uD638\uB294 15\u2013128\uC790\uB85C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
  return value;
}
var encode = (value) => {
  if (!object2(value)) throw Error("Invalid account payload");
  const bytes = encoder.encode(JSON.stringify(value));
  if (bytes.length > 8192) throw Error("Account payload is too large");
  return bytes;
};
var decode = (bytes) => {
  const result = JSON.parse(decoder.decode(bytes));
  if (!object2(result)) throw Error("Invalid account payload");
  return result;
};
async function encryptAccountRequest(payload, publicJwk) {
  const publicKey = await crypto.subtle.importKey("jwk", publicJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  const rawKey = crypto.getRandomValues(new Uint8Array(32)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt", "decrypt"]);
  const [wrappedKey, ciphertext] = await Promise.all([
    crypto.subtle.encrypt("RSA-OAEP", publicKey, rawKey),
    crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: requestAAD }, key, encode(payload))
  ]);
  rawKey.fill(0);
  return { envelope: { wrappedKey: base64url(wrappedKey), iv: base64url(iv), ciphertext: base64url(ciphertext) }, key };
}
async function decryptAccountRequest(envelope, privateJwk) {
  if (!object2(envelope)) throw Error("Invalid account envelope");
  const iv = fromBase64url(envelope.iv, 32);
  if (iv.length !== 12) throw Error("Invalid account IV");
  const privateKey = await crypto.subtle.importKey("jwk", privateJwk, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
  const rawKey = new Uint8Array(await crypto.subtle.decrypt("RSA-OAEP", privateKey, fromBase64url(envelope.wrappedKey, 1024)));
  if (rawKey.length !== 32) throw Error("Invalid account key");
  const key = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt", "decrypt"]);
  rawKey.fill(0);
  const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: requestAAD }, key, fromBase64url(envelope.ciphertext));
  return { payload: decode(bytes), key };
}
async function encryptAccountResult(payload, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12)), ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: resultAAD }, key, encode(payload));
  return { iv: base64url(iv), ciphertext: base64url(ciphertext) };
}
async function decryptAccountResult(envelope, key) {
  if (!object2(envelope)) throw Error("Invalid account result");
  const iv = fromBase64url(envelope.iv, 32);
  if (iv.length !== 12) throw Error("Invalid account IV");
  return decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: resultAAD }, key, fromBase64url(envelope.ciphertext)));
}
async function signAccountSession(user, privateJwk, { now = Date.now, jti = crypto.randomUUID() } = {}) {
  const time = clock(now), { nickname } = validateNickname(user.nickname);
  if (!/^[a-f0-9-]{36}$/.test(user.id ?? "") || !Number.isSafeInteger(user.version) || user.version < 0 || !Number.isSafeInteger(time) || !/^[-a-zA-Z0-9_]{8,128}$/.test(jti)) throw Error("Invalid account session");
  const claims = { iss: ACCOUNT_PROTOCOL, aud: "duplicate-tournament", sub: user.id, nickname, ver: user.version, jti, iat: Math.floor(time / 1e3), exp: Math.floor((time + SESSION_TTL_MS) / 1e3) };
  const body = [{ alg: "EdDSA", typ: "JWT" }, claims].map((value) => base64url(encoder.encode(JSON.stringify(value)))).join(".");
  const key = await crypto.subtle.importKey("jwk", privateJwk, "Ed25519", false, ["sign"]);
  const signature = await crypto.subtle.sign("Ed25519", key, encoder.encode(body));
  return { token: `${body}.${base64url(signature)}`, expiresAt: claims.exp * 1e3, sessionId: jti };
}
async function verifyAccountSession(token, publicJwk, { now = Date.now } = {}) {
  if (typeof token !== "string" || token.length > 4096) throw Error("\uACC4\uC815 \uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
  const parts = token.split(".");
  if (parts.length !== 3) throw Error("\uACC4\uC815 \uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
  const header = decode(fromBase64url(parts[0], 256)), claims = decode(fromBase64url(parts[1], 2048));
  if (header.alg !== "EdDSA" || header.typ !== "JWT" || Object.keys(header).some((name) => !["alg", "typ"].includes(name))) throw Error("\uACC4\uC815 \uC778\uC99D \uD615\uC2DD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  const key = await crypto.subtle.importKey("jwk", publicJwk, "Ed25519", false, ["verify"]);
  if (!await crypto.subtle.verify("Ed25519", key, fromBase64url(parts[2], 128), encoder.encode(`${parts[0]}.${parts[1]}`))) throw Error("\uACC4\uC815 \uC778\uC99D\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.");
  const time = clock(now), nickname = validateNickname(claims.nickname).nickname;
  if (claims.iss !== ACCOUNT_PROTOCOL || claims.aud !== "duplicate-tournament" || !/^[a-f0-9-]{36}$/.test(claims.sub ?? "") || !/^[-a-zA-Z0-9_]{8,128}$/.test(claims.jti ?? "") || !Number.isSafeInteger(claims.ver) || claims.ver < 0 || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) || claims.iat * 1e3 > time + 3e4 || claims.exp * 1e3 <= time || claims.exp <= claims.iat || (claims.exp - claims.iat) * 1e3 > SESSION_TTL_MS) throw Error("\uACC4\uC815 \uB85C\uADF8\uC778\uC774 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uB85C\uADF8\uC778\uD574 \uC8FC\uC138\uC694.");
  return { id: claims.sub, nickname, version: claims.ver, sessionId: claims.jti, expiresAt: claims.exp * 1e3 };
}

// duplicate/accounts/client.mjs
var SESSION_KEY = "duplicate.account.v1";
var abortError = () => Object.assign(new Error("\uACC4\uC815 \uC694\uCCAD\uC744 \uCDE8\uC18C\uD588\uC2B5\uB2C8\uB2E4."), { name: "AbortError" });
function normalizeAccountServer(server) {
  const origin = new URL(server);
  if (!["https:", "http:"].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash || origin.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) throw Error("\uACC4\uC815 \uC11C\uBC84 \uC8FC\uC18C\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
  return origin.origin;
}
function createAccountClient({ server, storage = globalThis.sessionStorage, fetchImpl = globalThis.fetch, cryptoProtocol = protocol_exports, now = Date.now, sleep = (ms, signal) => new Promise((resolve3, reject) => {
  const timer = setTimeout(done, ms);
  function done() {
    signal?.removeEventListener("abort", cancel);
    resolve3();
  }
  function cancel() {
    clearTimeout(timer);
    reject(abortError());
  }
  if (signal?.aborted) cancel();
  else signal?.addEventListener("abort", cancel, { once: true });
}), timeoutMs = 6e4 } = {}) {
  const origin = new URL(normalizeAccountServer(server));
  let session = null;
  const listeners = /* @__PURE__ */ new Set(), pending = /* @__PURE__ */ new Set();
  function valid(value) {
    return value && typeof value.token === "string" && value.token.length > 0 && Number.isFinite(value.expiresAt) && value.expiresAt > now() && typeof value.user?.id === "string" && typeof value.user?.nickname === "string";
  }
  function publish(value) {
    session = valid(value) ? { user: { id: value.user.id, nickname: value.user.nickname }, token: value.token, expiresAt: value.expiresAt } : null;
    try {
      if (session) storage?.setItem(SESSION_KEY, JSON.stringify({ ...session, server: origin.origin }));
      else {
        const saved2 = JSON.parse(storage?.getItem(SESSION_KEY) || "null");
        if (!saved2?.server || saved2.server === origin.origin) storage?.removeItem(SESSION_KEY);
      }
    } catch {
    }
    for (const listener of listeners) listener(getSession());
  }
  try {
    const saved2 = JSON.parse(storage?.getItem(SESSION_KEY) || "null");
    if (valid(saved2) && saved2.server === origin.origin) session = { user: { id: saved2.user.id, nickname: saved2.user.nickname }, token: saved2.token, expiresAt: saved2.expiresAt };
    else if (saved2?.server === origin.origin || !saved2?.server) storage?.removeItem(SESSION_KEY);
  } catch {
  }
  function getSession() {
    if (session && !valid(session)) publish(null);
    return session ? structuredClone(session) : null;
  }
  async function json(path, options, signal) {
    const response = await fetchImpl(`${origin.origin}/api/duplicate${path}`, { ...options, signal, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
    let data;
    try {
      data = await response.json();
    } catch {
      throw Error("\uACC4\uC815 \uC11C\uBC84 \uC751\uB2F5\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    if (!response.ok) throw Object.assign(Error(data?.error ?? "\uACC4\uC815 \uC11C\uBC84\uB97C \uC0AC\uC6A9\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694."), { status: response.status });
    return data;
  }
  async function capabilities({ signal } = {}) {
    return json("/accounts/capabilities", { method: "GET", headers: { Accept: "application/json" } }, signal);
  }
  async function operation(name, fields = {}, authenticated = false) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 6e4));
    pending.add(controller);
    try {
      const current = getSession();
      if (authenticated && !current) throw Error("\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
      const cap = await capabilities({ signal: controller.signal });
      if (!cap.available || !cap.encryptionKey || cap.protocol !== cryptoProtocol.ACCOUNT_PROTOCOL) throw Error("\uACC4\uC815 \uC11C\uBE44\uC2A4\uAC00 \uC5F0\uACB0\uB418\uC5B4 \uC788\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAC8C\uC784\uC740 \uC190\uB2D8\uC73C\uB85C \uC774\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
      const clean = { ...fields };
      if ("nickname" in clean && cryptoProtocol.validateNickname) clean.nickname = cryptoProtocol.validateNickname(clean.nickname).nickname;
      for (const field of ["password", "newPassword"]) if (field in clean && cryptoProtocol.validatePassword) cryptoProtocol.validatePassword(clean[field]);
      const payload = { operation: name, ...clean, ...authenticated ? { token: current.token } : {} }, encrypted = await cryptoProtocol.encryptAccountRequest(payload, cap.encryptionKey), receiptSecret = cryptoProtocol.randomSecret(), started = now();
      const queued = await json("/accounts/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: crypto.randomUUID(), operation: name, receiptSecret, envelope: encrypted.envelope }) }, controller.signal);
      if (typeof queued.id !== "string" || !queued.id) throw Error("\uACC4\uC815 \uC694\uCCAD \uC811\uC218 \uC815\uBCF4\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      let result;
      while (!controller.signal.aborted && now() - started < Math.min(timeoutMs, 6e4)) {
        await sleep(Math.min(3e3, Math.max(100, queued.pollAfterMs ?? 500)), controller.signal);
        const job = await json(`/accounts/jobs/${encodeURIComponent(queued.id)}`, { method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${receiptSecret}` } }, controller.signal);
        if (job.status === "complete") {
          result = await cryptoProtocol.decryptAccountResult(job.envelope, encrypted.key);
          break;
        }
        if (["failed", "expired"].includes(job.status)) throw Error("\uACC4\uC815 \uC694\uCCAD\uC774 \uC644\uB8CC\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
      }
      if (controller.signal.aborted || !result) throw abortError();
      if (result.ok !== true) throw Object.assign(Error(result.error ?? "\uACC4\uC815 \uC694\uCCAD\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."), { code: result.code, status: result.status });
      if (["login", "register", "recover"].includes(name)) publish(result);
      else if (name === "delete" || name === "logout") publish(null);
      else if (result.user) publish({ ...current, ...result, token: result.token ?? current?.token, expiresAt: result.expiresAt ?? current?.expiresAt });
      return result;
    } catch (error) {
      if (controller.signal.aborted) throw Error("\uACC4\uC815 \uC694\uCCAD \uC2DC\uAC04\uC774 \uCD08\uACFC\uB418\uC5C8\uAC70\uB098 \uCDE8\uC18C\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
      throw error;
    } finally {
      clearTimeout(timer);
      pending.delete(controller);
    }
  }
  return {
    capabilities,
    getSession,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    cancel() {
      for (const controller of pending) controller.abort();
    },
    register: (fields) => operation("register", fields),
    login: (fields) => operation("login", fields),
    profile: () => operation("profile", {}, true),
    rename: (fields) => operation("rename", fields, true),
    changePassword: (fields) => operation("password", fields, true),
    recover: (fields) => operation("recover", fields),
    delete: (fields) => operation("delete", fields, true),
    resetRecovery: (fields) => operation("recovery-reset", fields, true),
    async logout() {
      try {
        return await operation("logout", {}, true);
      } finally {
        publish(null);
      }
    }
  };
}

// duplicate/replay-core.mjs
var ENGINE_REPLAY_SCHEMA = "duplicate-engine-replay-v1";
var FRAME_REPLAY_SCHEMA = "duplicate-frame-replay-v1";
var REPLAY_LIMITS = Object.freeze({ bytes: 32 * 1024 * 1024, actions: 2048, frames: 2049 });
var roles = /* @__PURE__ */ new Set(["private", "participant", "viewer", "caster"]);
var kinds = /* @__PURE__ */ new Set(["discard", "call", "kan", "riichi", "win"]);
var object3 = (v) => v && typeof v === "object" && !Array.isArray(v);
var integer = Number.isSafeInteger;
var clone = (v) => structuredClone(v);
var sort = (v) => Array.isArray(v) ? v.map(sort) : object3(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])])) : v;
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
  require2(object3(v));
  require2(Object.keys(v).every((k) => allowed.includes(k)), "\uC7AC\uC0DD \uD30C\uC77C\uC5D0 \uD5C8\uC6A9\uB418\uC9C0 \uC54A\uC740 \uC815\uBCF4\uAC00 \uC788\uC2B5\uB2C8\uB2E4.");
};
var seat3 = (v) => {
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
  optional(result, value, "dealer", seat3);
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
    const s = seat3(member.seat);
    require2(!seen.has(s));
    seen.add(s);
    const result = { seat: s, name: text(member.name, 80), ai: member.ai === true };
    optional(result, member, "id", (v) => text(v));
    return result;
  });
}
function tile2(value) {
  require2(object3(value));
  const type = value.type ?? value.tile;
  number(type, 0, 33);
  const result = { type, tile: type, red: value.red === true };
  optional(result, value, "id", (v) => {
    number(v, 0, 135);
    require2(Math.floor(v / 4) === type);
    return v;
  });
  if (value.drawn !== void 0) result.drawn = value.drawn === true;
  if (typeof value.tsumogiri === "boolean") result.tsumogiri = value.tsumogiri;
  return result;
}
function tiles(value) {
  require2(Array.isArray(value) && value.length <= 18);
  return value.map(tile2);
}
function meld2(value) {
  require2(object3(value) && ["chi", "pon", "kan"].includes(value.type));
  const result = { type: value.type, tile: number(value.tile, 0, 33), open: value.open === true };
  optional(result, value, "from", seat3);
  if (value.tiles) result.tiles = tiles(value.tiles);
  else if (value.ids) {
    require2(Array.isArray(value.ids) && value.ids.length <= 4);
    result.tiles = value.ids.map((id) => tile2({ id, type: Math.floor(id / 4), red: false }));
  } else result.tiles = [];
  return result;
}
function publicEvent(value) {
  require2(object3(value) && kinds.has(value.kind));
  const result = { id: number(value.id), kind: value.kind, seat: seat3(value.seat), tile: value.tile === null || value.tile === void 0 ? null : number(value.tile, 0, 33), tileId: value.tileId === null || value.tileId === void 0 ? null : number(value.tileId, 0, 135), red: value.red === true, source: value.source === null || value.source === void 0 ? null : seat3(value.source), callType: value.callType ?? null, method: value.method ?? null };
  require2([null, "chi", "pon", "minkan", "ankan", "kakan"].includes(result.callType) && [null, "ron", "tsumo"].includes(result.method));
  if (result.tileId !== null && result.tile !== null) require2(Math.floor(result.tileId / 4) === result.tile);
  optional(result, value, "tiles", tiles);
  if (typeof value.tsumogiri === "boolean") result.tsumogiri = value.tsumogiri;
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
  const result = { role: value.role, seat: value.seat === void 0 || value.seat === null ? null : seat3(value.seat), handsVisible: ["private", "caster"].includes(value.role) };
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
  optional(result, value, "source", seat3);
  for (const key of ["receipt", "honbaReceipt", "honba"]) optional(result, value, key, number);
  for (const key of ["han", "fu"]) optional(result, value, key, (v) => number(v));
  if (value.score) {
    for (const key of ["han", "fu"]) optional(result, value.score, key, number);
  }
  return result;
}
function projectView(raw, access, pov, fullGame = null, accepted = null) {
  if (fullGame) {
    raw = withWinningHands(fullGame, withDiscardMetadata(fullGame, raw));
    if (accepted) accepted = withDiscardEvents(fullGame, accepted);
  }
  require2(object3(raw) && Array.isArray(raw.players) && raw.players.length === 4);
  const role = access.role, phase = text(raw.phase, 24), ended3 = phase === "end" || phase === "ended";
  const players = raw.players.map((player, index) => {
    const s = seat3(player.seat ?? index);
    require2(s === index);
    const result2 = {
      seat: s,
      handSize: number(player.handSize ?? fullGame?.players[s].hand.length, 0, 14),
      score: point(player.score),
      points: point(player.points),
      riichi: player.riichi === true,
      won: player.won === true,
      melds: (player.melds ?? []).map(meld2),
      river: (player.river ?? []).map((discard) => ({ ...tile2(discard), claimed: discard.claimed === true, riichi: discard.riichi === true, robbedKan: discard.robbedKan === true })),
      win: ended3 ? winSummary(player.win) : null
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
  const dealer = seat3(raw.dealer), result = {
    variant: "D",
    seat: pov,
    dealer,
    phase,
    end: raw.end === null || raw.end === void 0 ? null : text(raw.end, 40),
    actor: phase === "turn" ? seat3(raw.actor ?? raw.turn) : null,
    turn: seat3(raw.turn ?? raw.actor ?? dealer),
    players,
    handTiles: players[pov].handTiles ? clone(players[pov].handTiles) : [],
    hand: players[pov].handTiles?.map((t) => t.type) ?? [],
    melds: clone(players[pov].melds),
    legalActions: [],
    readOnly: true,
    doraIndicators: (raw.doraIndicators ?? []).map((v) => number(v, 0, 33)),
    uraIndicators: ended3 && raw.end === "win" && players.some((p) => p.won && p.riichi) ? (raw.uraIndicators ?? []).map((v) => number(v, 0, 33)) : [],
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
    result.lastDiscard = { seat: seat3(raw.lastDiscard.seat ?? raw.lastDiscard.source), ...tile2(raw.lastDiscard), kind: raw.lastDiscard.kind ?? "discard", final: raw.lastDiscard.final === true };
  } else result.lastDiscard = null;
  if (raw.pendingReaction) {
    const r = raw.pendingReaction;
    result.pendingReaction = { kind: text(r.kind, 24), source: seat3(r.source), tileId: r.tileId === null || r.tileId === void 0 ? null : number(r.tileId, 0, 135), sourceDiscardIndex: r.sourceDiscardIndex === null || r.sourceDiscardIndex === void 0 ? null : number(r.sourceDiscardIndex) };
  }
  const visible = Array(34).fill(0), add = (t) => visible[t]++;
  for (const type of result.hand) add(type);
  for (const p of players) {
    for (const m of p.melds) for (const t of m.tiles) add(t.type);
    for (const t of p.river) if (!t.claimed) add(t.type);
  }
  for (const type of result.doraIndicators) add(type);
  result.visible = visible;
  if (ended3 && raw.end === "win" && raw.winningHands) {
    result.winningHands = normalizeWinningHands(raw.winningHands);
    require2(result.winningHands.every((hand) => players[hand.seat].won), "\uD654\uB8CC\uC790 \uC815\uBCF4\uC640 \uACF5\uAC1C \uD654\uB8CC\uD328\uAC00 \uB2E4\uB985\uB2C8\uB2E4.");
  }
  return result;
}
function finalOf(game) {
  return { end: game.end, scores: game.players.map((p) => p.score), points: game.players.map((p, s) => game.startingScores[s] + p.score), pot: game.pot, winners: [...game.winners] };
}
function normalizeFinal(value) {
  keys(value, ["end", "scores", "points", "pot", "winners"]);
  require2(typeof value.end === "string");
  require2(Array.isArray(value.winners) && value.winners.length <= 3);
  return { end: text(value.end, 40), scores: points(value.scores), points: points(value.points), pot: number(value.pot), winners: value.winners.map(seat3) };
}
function normalizeEngine(value) {
  keys(value, ["schema", "id", "createdAt", "complete", "initial", "actions", "context", "seat", "members", "source", "final"]);
  require2(value.schema === ENGINE_REPLAY_SCHEMA && value.complete === true, "\uC644\uB8CC\uB41C \uC5D4\uC9C4 \uC7AC\uC0DD \uAE30\uB85D\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.");
  keys(value.initial, ["seed", "wall", "rules", "duplicateProfile", "dealer", "honba", "pot", "startingScores"]);
  const profile = normalizeDuplicateProfile(value.initial.duplicateProfile), initial = { seed: number(value.initial.seed, 0, 4294967295), rules: normalizeProfileRules(value.initial.rules, profile), duplicateProfile: profile, dealer: seat3(value.initial.dealer), honba: number(value.initial.honba ?? 0), pot: number(value.initial.pot ?? 0), startingScores: points(value.initial.startingScores) };
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
    return { seat: seat3(row.seat), action };
  });
  const result = { schema: ENGINE_REPLAY_SCHEMA, complete: true, initial, actions, context: contextOf(value.context), seat: seat3(value.seat ?? 0), members: membersOf(value.members), source: identitySource(value.source), final: normalizeFinal(value.final) };
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
      seat3(pov);
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
function captureEngineReplay(game, { context: context3 = {}, seat: pov = 0, members = [], source = {}, initialWall, id, createdAt = Date.now() } = {}) {
  require2(game?.phase === "end" && game.end, "\uB300\uAD6D\uC774 \uB05D\uB09C \uB4A4 \uC7AC\uC0DD \uAE30\uB85D\uC744 \uC800\uC7A5\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
  const initial = { seed: game.seed, rules: clone(game.rules), duplicateProfile: game.duplicateProfile ?? "custom", dealer: game.dealer, honba: game.honba ?? 0, pot: game.initialPot ?? 0, startingScores: [...game.startingScores ?? Array(4).fill(game.rules.startingPoints)] };
  if (initialWall) initial.wall = clone(initialWall);
  const record = normalizeEngine({ schema: ENGINE_REPLAY_SCHEMA, complete: true, initial, actions: game.events.filter((event3) => event3.type === "action").map((event3) => ({ seat: event3.seat, action: clone(event3.action) })), context: context3, seat: pov, members, source, final: finalOf(game), createdAt, ...id ? { id } : {} });
  const replay = openEngineReplay(record), last = replay.seek(replay.frameCount - 1).view;
  require2(equal(last.players.map((player) => ({ hand: player.handTiles.map((tile3) => tile3.id), melds: player.melds, river: player.river })), projectView(snapshot3(game, pov), { role: "private", seat: pov, handsVisible: true }, pov, game).players.map((player) => ({ hand: player.handTiles.map((tile3) => tile3.id), melds: player.melds, river: player.river }))), "\uC6D0\uBCF8 \uBC30\uD328\uC640 \uC7AC\uC0DD \uAE30\uB85D\uC774 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  return record;
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
      for (const value of player.melds) for (const tile3 of value.tiles) compactTile(tile3);
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
      let request2;
      try {
        request2 = indexedDB.open(DATABASE, VERSION);
      } catch (error) {
        reject(storageError(error));
        return;
      }
      request2.onupgradeneeded = () => {
        const db = request2.result;
        for (const name of ["records", "metadata"]) if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
      };
      request2.onsuccess = () => {
        const db = request2.result;
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        resolve3(db);
      };
      request2.onerror = () => {
        opening = null;
        reject(storageError(request2.error));
      };
      request2.onblocked = () => {
        opening = null;
        reject(Error("\uB2E4\uB978 \uD328\uBCF4 \uD0ED\uC744 \uB2EB\uACE0 \uB2E4\uC2DC \uD655\uC778\uD574 \uC8FC\uC138\uC694."));
      };
    });
    return opening;
  }
  async function read(store2, key) {
    const db = await database();
    return new Promise((resolve3, reject) => {
      const transaction = db.transaction(store2, "readonly"), request2 = key === void 0 ? transaction.objectStore(store2).getAll() : transaction.objectStore(store2).get(key);
      let result;
      request2.onsuccess = () => {
        result = request2.result;
      };
      transaction.oncomplete = () => resolve3(result);
      transaction.onerror = transaction.onabort = () => reject(storageError(transaction.error ?? request2.error));
    });
  }
  return {
    async saveReplay(value, { id = idFactory(), label } = {}) {
      const record = parseReplay(value), payload = serializeReplay(record);
      if (!validId(id)) throw Error("\uD328\uBCF4 \uC800\uC7A5 \uBC88\uD638\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
      const db = await database();
      return new Promise((resolve3, reject) => {
        const transaction = db.transaction(["records", "metadata"], "readwrite"), request2 = transaction.objectStore("metadata").get(id);
        let metadata;
        request2.onsuccess = () => {
          const timestamp = now();
          metadata = replayMetadata(record, { id, label: label ?? request2.result?.label, createdAt: request2.result?.createdAt ?? timestamp, updatedAt: timestamp });
          transaction.objectStore("records").put({ id, payload });
          transaction.objectStore("metadata").put(metadata);
        };
        transaction.oncomplete = () => resolve3(structuredClone(metadata));
        transaction.onerror = transaction.onabort = () => reject(storageError(transaction.error ?? request2.error));
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
var getReplay = (id) => store().getReplay(id);

// duplicate/replay-preservation.mjs
async function ensureReplayArchived(descriptor, { load, preserve, invalidate = () => {
} } = {}) {
  if (!descriptor) return null;
  const { id } = descriptor;
  if (typeof id !== "string" || !id || typeof load !== "function" || typeof preserve !== "function") throw new Error("\uD328\uBCF4 \uC800\uC7A5 \uC815\uBCF4\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
  if (await load(id)) return { id };
  await invalidate(id);
  for (let attempt = 0; attempt < 2; attempt++) {
    const metadata = await preserve(descriptor, { force: true });
    if (metadata == null) {
      if (attempt === 0) continue;
      throw new Error("\uD328\uBCF4\uB97C \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB300\uAD6D\uC744 \uC720\uC9C0\uD55C \uCC44 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
    }
    if (typeof metadata !== "object" || metadata.id !== id) throw new Error("\uC800\uC7A5\uD55C \uD328\uBCF4\uC758 \uB300\uAD6D \uC815\uBCF4\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
    if (!await load(id)) throw new Error("\uC800\uC7A5\uB41C \uD328\uBCF4\uB97C \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uB300\uAD6D\uC744 \uC720\uC9C0\uD55C \uCC44 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.");
    return metadata;
  }
}

// duplicate/result-payment.mjs
var seat4 = (value) => Number.isInteger(value) && value >= 0 && value < 4;
var amount = (value) => Number.isSafeInteger(value) && value >= 0;
function winScoreLabel(score2 = {}) {
  if (Number.isInteger(score2.yakumanCount) && score2.yakumanCount > 1) return `${score2.yakumanCount}\uBC30 \uC5ED\uB9CC`;
  if (score2.yakuman || score2.yakumanCount === 1) return "\uC5ED\uB9CC";
  return Number.isInteger(score2.han) && Number.isInteger(score2.fu) ? `${score2.han}\uD310 ${score2.fu}\uBD80` : "\uD310\xB7\uBD80 \uC815\uBCF4 \uC5C6\uC74C";
}
function recordedPayments(win3, winnerSeat) {
  if (!Array.isArray(win3?.payments) || !win3.payments.length) return null;
  let base = 0, honba = 0, pot = 0;
  for (const payment of win3.payments) {
    const deposit = payment?.from === "pot";
    if (!payment || payment.to !== winnerSeat || !amount(payment.amount) || !(deposit || seat4(payment.from) && payment.from !== winnerSeat) || deposit && (payment.kind !== "pot" || payment.honba === true) || !deposit && !["ron", "tsumo"].includes(payment.kind) || !deposit && ["ron", "tsumo"].includes(win3.method) && payment.kind !== win3.method || payment.honba !== void 0 && typeof payment.honba !== "boolean") return null;
    if (deposit) pot += payment.amount;
    else if (payment.honba === true) honba += payment.amount;
    else base += payment.amount;
  }
  const total = base + honba + pot;
  if (![base, honba, pot, total].every(amount) || win3.receipt !== void 0 && (!amount(win3.receipt) || win3.receipt !== total) || win3.honbaReceipt !== void 0 && (!amount(win3.honbaReceipt) || win3.honbaReceipt !== honba)) return null;
  return { base, honba, pot, total };
}
function winnerPaymentSummary(view, winnerSeat) {
  const player = seat4(winnerSeat) ? view?.players?.[winnerSeat] : null, win3 = player?.win;
  if (!win3) return null;
  const result = {
    seat: winnerSeat,
    dealer: seat4(view?.dealer) ? winnerSeat === view.dealer : null,
    scoreLabel: winScoreLabel(win3.score),
    baseReceipt: null,
    honbaReceipt: null,
    potReceipt: null,
    totalReceipt: null,
    netScore: Number.isSafeInteger(player.score) ? player.score : null,
    outgoingPayments: null,
    riichiExpense: null,
    otherChange: null,
    complete: false,
    note: null
  };
  const payments2 = win3.payments, hasPayments = Array.isArray(payments2) && payments2.length > 0;
  if (hasPayments) {
    const recorded = recordedPayments(win3, winnerSeat);
    if (recorded) Object.assign(result, { baseReceipt: recorded.base, honbaReceipt: recorded.honba, potReceipt: recorded.pot, totalReceipt: recorded.total, complete: true });
    else result.note = "\uC815\uC0B0 \uAE30\uB85D\uC758 \uD569\uACC4\uB098 \uC218\uCDE8\uC778\uC774 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC544 \uC138\uBD80 \uC218\uC785\uC744 \uD45C\uC2DC\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.";
  } else {
    if (amount(win3.receipt)) result.totalReceipt = win3.receipt;
    result.note = "\uC774\uC804 \uAE30\uB85D\uC5D0 \uC9C0\uAE09 \uB0B4\uC5ED\uC774 \uC5C6\uC5B4 \uAE30\uBCF8 \uD654\uB8CC\xB7\uBCF8\uC7A5\xB7\uACF5\uD0C1 \uC218\uC785\uC744 \uAD6C\uBD84\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.";
  }
  const winnerSeats = [.../* @__PURE__ */ new Set([...view.winners ?? [], ...view.players.flatMap((p, i) => p?.win ? [i] : [])])];
  if (result.complete && winnerSeats.every((s) => seat4(s) && recordedPayments(view.players[s]?.win, s))) {
    const outgoing = winnerSeats.reduce((sum, s) => sum + view.players[s].win.payments.reduce((n, p) => n + (p.from === winnerSeat ? p.amount : 0), 0), 0);
    if (amount(outgoing)) result.outgoingPayments = outgoing;
  }
  if (result.totalReceipt !== null && result.netScore !== null) {
    const change = result.netScore - result.totalReceipt + (result.outgoingPayments ?? 0);
    if (result.outgoingPayments !== null && player.riichi === true && change === -1e3) {
      result.riichiExpense = 1e3;
      result.otherChange = 0;
    } else result.otherChange = change;
  }
  return result;
}

// duplicate/app.mjs
var DEFAULT_SERVER = "https://wellness-mahjong-h-lab.chayhyeon.chatgpt.site";
var snapshot4 = (game, seat5) => withWinningHands(game, withDiscardMetadata(game, snapshot3(game, seat5)));
var $ = (id) => document.getElementById(id);
var number2 = (n) => Number(n).toLocaleString("ko-KR");
var signed = (n) => n === null || n === void 0 ? "\u2014" : `${n > 0 ? "+" : ""}${number2(n)}`;
var winds2 = ["\u6771", "\u5357", "\u897F", "\u5317"];
var positions = ["bottom", "right", "top", "left"];
var milFixed = ["dora", "kanDora", "uraDora", "redDora", "deadWall", "exhaustLimit", "multipleRon", "abortFourKans"];
var usesMilProgression = (value) => value === "mil" || value === "mil-riichi";
var profileName = (value) => value === "mil-riichi" ? "MIL \uBC29\uC2DD + \uB9AC\uCE58 \uC635\uC158" : value === "mil" ? "MIL \uC6D0\uD615 \xB7 \uB3C4\uB77C \uC5C6\uC74C" : "\uC0AC\uC6A9\uC790 \uADDC\uCE59";
function setupRules(raw = {}, profile = "mil-riichi") {
  const value = { ...raw };
  if (profile === "mil") for (const key of milFixed) delete value[key];
  else if (profile === "mil-riichi") delete value.exhaustLimit;
  return normalizeProfileRules(value, profile);
}
var switchDefinitions = [["dora", "\uB3C4\uB77C", "\uCCAB \uBC88\uC9F8 \uB3C4\uB77C \uD45C\uC2DC\uD328"], ["kanDora", "\uAE61\uB3C4\uB77C", "\uAE61\uB9C8\uB2E4 \uCD94\uAC00 \uB3C4\uB77C \uD45C\uC2DC\uD328"], ["uraDora", "\uC6B0\uB77C\uB3C4\uB77C", "\uB9AC\uCE58 \uD654\uB8CC \uC2DC \uACF5\uAC1C\uD558\uB294 \uB4B7 \uD45C\uC2DC\uD328"], ["redDora", "\uC801\uB3C4\uB77C", "\uB9CC\xB7\uD1B5\xB7\uC0AD\uC758 \uC8015 \uAC01 1\uC7A5"], ["deadWall", "\uC655\uD328", "\uD328\uC0B0\uC5D0\uC11C 14\uC7A5 \uC81C\uC678"], ["kuitan", "\uCFE0\uC774\uD0D5", "\uBA58\uC820\uC774 \uC544\uB2C8\uC5B4\uB3C4 \uD0D5\uC57C\uC624 \uC778\uC815"], ["abortFourKans", "\uC0AC\uAE61\uC0B0\uB8CC", "2\uBA85 \uC774\uC0C1\uC774 \uD569\uACC4 4\uAE61\uC774\uBA74 \uC720\uAD6D"]];
var S = { mode: "practice", panel: "practice", largeBoard: true, practice: null, practiceRemote: null, practiceError: "", online: null, credentials: null, view: null, selected: null, riichiSelecting: false, busy: false, timer: null, poll: null, worker: null, endHidden: false, endKey: null, endRevealAt: 0, resultTimer: null, toastTimer: null, settings: null, roomRules: null, roomAI: "simple", aiCapabilities: null, ruleContext: "practice", ruleReadOnly: false, creatingRoom: false, boardCount: 8, practiceMatchRules: null, roomMatchRules: null, practiceDuplicateProfile: "mil-riichi", roomDuplicateProfile: "mil-riichi", roomScoring: normalizeNewCompetitionScoring({}, "mil-riichi"), preferences: { ...DEFAULT_PREFERENCES }, autoWin: true, server: DEFAULT_SERVER, gameEpoch: 0 };
var personalSettingsUI;
var gameAccountClient;
var gameAccountServer;
var replayPending = /* @__PURE__ */ new Map();
var replaySaved = /* @__PURE__ */ new Set();
var replayErrors = /* @__PURE__ */ new Map();
var openingReplay = false;
var replayHistoryPending = /* @__PURE__ */ new Set();
async function archiveRemoteHistory(mode, room) {
  if (!room?.code) return;
  const server = S.server, credentials = S.credentials;
  const stillCurrent = () => S.server === server && (mode === "online" ? S.credentials === credentials && credentials?.code === room.code : remotePractice.state?.code === room.code);
  const progressId = seriesProgress(room).handId, key = `${mode}:${server}:${room.code}:${room.tableId}:${progressId}:${room.game?.phase}`;
  if (replayHistoryPending.has(key)) return;
  replayHistoryPending.add(key);
  try {
    if (!stillCurrent()) return;
    const listing = await (mode === "online" ? request(`/${room.code}/replays`) : remotePractice.replays());
    for (const entry of listing.entries ?? []) {
      if (!entry.available || !stillCurrent()) continue;
      const id = `remote:${server}:${room.code}:${room.tableId}:${room.seat}:${entry.handId}`;
      if (replaySaved.has(id)) continue;
      if (await getReplay(id)) {
        replaySaved.add(id);
        continue;
      }
      if (!stillCurrent()) return;
      await preserveReplay({ id, capture: async () => {
        const record = await (mode === "online" ? request(`/${room.code}/replays?handId=${encodeURIComponent(entry.handId)}`) : remotePractice.replay(entry.handId));
        if (record.source?.code !== room.code || record.source?.tableId !== room.tableId || record.context?.handId !== entry.handId) throw Error("\uD328\uBCF4\uC640 \uB300\uD68C \uC815\uBCF4\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
        return record;
      } });
    }
  } catch {
  } finally {
    replayHistoryPending.delete(key);
  }
}
function replayDescriptor(mode = S.mode) {
  if (mode === "practice") {
    const p = S.practice;
    if (!p) return null;
    const remote = p.aiPolicy === "mortal", room2 = S.practiceRemote, game = p.game, view = remote ? room2?.game : game;
    if (view?.phase !== "end") return null;
    if (!p.replaySeriesId) {
      p.replaySeriesId = crypto.randomUUID();
      savePractice();
    }
    const context3 = { ...seriesProgress(p), mode: "practice", seriesId: p.replaySeriesId, matchRules: p.matchRules, label: `${handLabel(p)} \xB7 ${remote ? "Mortal" : "\uD63C\uC790 \uC5F0\uC2B5"}` };
    const id = remote ? `remote:${S.server}:${room2.code}:${room2.tableId}:${p.seat}:${context3.handId}` : `practice:${p.replaySeriesId}:${context3.handId}`;
    return { id, capture: () => remote ? remotePractice.replay(context3.handId) : captureEngineReplay(game, { seat: p.seat, context: context3, source: { mode: "practice", aiPolicy: "simple" } }) };
  }
  const room = S.online, credentials = S.credentials;
  if (room?.game?.phase !== "end" || !credentials) return null;
  const hand = seriesProgress(room);
  return { id: `remote:${S.server}:${room.code}:${room.tableId}:${room.seat}:${hand.handId}`, capture: () => request(`/${room.code}/replays?handId=${encodeURIComponent(hand.handId)}`) };
}
function preserveReplay(descriptor, { force = false } = {}) {
  if (!descriptor) return Promise.resolve(null);
  const { id } = descriptor;
  if (replaySaved.has(id)) return Promise.resolve({ id });
  if (replayPending.has(id)) return replayPending.get(id);
  if (!force && replayErrors.has(id)) return Promise.resolve(null);
  let captured;
  try {
    captured = descriptor.capture();
  } catch (error) {
    captured = Promise.reject(error);
  }
  const task = Promise.resolve(captured).then((record) => saveReplay(record, { id })).then((metadata) => {
    replaySaved.add(id);
    replayErrors.delete(id);
    return metadata;
  }).catch((error) => {
    replayErrors.set(id, error.message);
    if (force) throw error;
    toast("\uC774 \uAD6D\uC758 \uD328\uBCF4\uB97C \uC790\uB3D9 \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \u2018\uC774 \uAD6D \uD328\uBCF4\u2019\uC5D0\uC11C \uB2E4\uC2DC \uC800\uC7A5\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
    return null;
  }).finally(() => replayPending.delete(id));
  replayPending.set(id, task);
  return task;
}
function archiveEndedReplay(mode) {
  void preserveReplay(replayDescriptor(mode));
}
async function savePracticeReplayBeforeReset() {
  const descriptor = replayDescriptor("practice");
  if (!descriptor) return true;
  const priorBusy = S.busy;
  S.busy = true;
  clearPlayTimer();
  render();
  try {
    await ensureReplayArchived(descriptor, { load: getReplay, preserve: preserveReplay, invalidate: (id) => replaySaved.delete(id) });
    return true;
  } catch (error) {
    toast(`\uD328\uBCF4 \uC800\uC7A5\uC744 \uB9C8\uCE58\uC9C0 \uBABB\uD574 \uC774\uC804 \uC5F0\uC2B5\uC744 \uC720\uC9C0\uD588\uC2B5\uB2C8\uB2E4. ${error.message}`);
    return false;
  } finally {
    S.busy = priorBusy;
    render();
  }
}
async function openCurrentReplay() {
  if (openingReplay) return;
  const descriptor = replayDescriptor();
  if (!descriptor) {
    toast("\uAD6D\uC774 \uB05D\uB09C \uB4A4 \uD328\uBCF4\uB97C \uC5F4 \uC218 \uC788\uC2B5\uB2C8\uB2E4.");
    return;
  }
  openingReplay = true;
  $("open-current-replay").disabled = true;
  try {
    if (replaySaved.has(descriptor.id) && !await getReplay(descriptor.id)) replaySaved.delete(descriptor.id);
    const current = replayDescriptor();
    if (current?.id !== descriptor.id) throw Error("\uB300\uAD6D\uC774 \uBC14\uB00C\uC5C8\uC2B5\uB2C8\uB2E4. \uD604\uC7AC \uAD6D\uC758 \uD328\uBCF4\uB97C \uB2E4\uC2DC \uC5F4\uC5B4 \uC8FC\uC138\uC694.");
    const saved2 = await preserveReplay(current, { force: true });
    if (saved2) location.assign(`./replay.html?id=${encodeURIComponent(saved2.id)}`);
  } catch (error) {
    toast(`\uD328\uBCF4 \uC800\uC7A5: ${error.message}`);
  } finally {
    openingReplay = false;
    $("open-current-replay").disabled = S.view?.phase !== "end";
  }
}
function accountSession() {
  if (gameAccountServer !== S.server) {
    gameAccountClient?.cancel?.();
    gameAccountServer = S.server;
    gameAccountClient = createAccountClient({ server: S.server, storage: sessionStorage });
  }
  return gameAccountClient.getSession();
}
function syncAccountUI() {
  const account = accountSession(), link = $("tournament-link"), url = new URL("./tournament/", location.href);
  if (S.server !== DEFAULT_SERVER) url.searchParams.set("server", S.server);
  link.href = url.href;
  const observerURL = new URL("./tournament/observer.html", location.href);
  if (S.server !== DEFAULT_SERVER) observerURL.searchParams.set("server", S.server);
  $("observer-nav-link").href = observerURL.href;
  const wikiURL = new URL("./wiki.html", location.href);
  if (S.server !== DEFAULT_SERVER) wikiURL.searchParams.set("server", S.server);
  $("wiki-nav-link").href = $("help-wiki-link").href = wikiURL.href;
  $("account-status").textContent = account ? `${account.user.nickname} \xB7 \uB85C\uADF8\uC778` : "\uAC8C\uC2A4\uD2B8 \xB7 \uACC4\uC815 \uB85C\uADF8\uC778\uC740 \uC6B4\uC601 \uD398\uC774\uC9C0";
  if (!S.credentials && account) $("online-name").value = account.user.nickname;
  $("online-name").disabled = !!S.credentials || !!account;
}
var observerLinks = mountObserverLinks({ document, getRoom: () => S.online, getServer: () => S.server, request: (...args) => request(...args), toast });
var feedbackTracker = createFeedbackTracker();
var feedback = createFeedbackPresenter({ table: $("table"), handArea: $("hand-area"), historyContainer: $("recent-actions"), getPreferences: () => S.preferences, getPlayerName: (seat5) => playerName(seat5) });
var remotePractice = createRemotePractice({ getServer: () => S.server, onState: applyPrivatePractice, onError: (error, { terminal }) => {
  S.practiceError = terminal ? "Mortal \uC5F0\uC2B5\uC744 \uC0C8\uB85C \uC2DC\uC791\uD574 \uC8FC\uC138\uC694." : "\uC5F0\uACB0 \uC7AC\uC2DC\uB3C4 \uC911";
  if (S.mode === "practice" && S.practice?.aiPolicy === "mortal") {
    toast(error.message);
    render();
  }
} });
var activeRoom = () => S.mode === "online" ? S.online : S.practiceRemote;
function playerName(seat5, view = S.view) {
  if (!view) return winds2[seat5] ?? "\uD50C\uB808\uC774\uC5B4";
  const wind = winds2[(seat5 - view.dealer + 4) % 4];
  const member = activeRoom()?.members?.find((p) => p.seat === seat5);
  const name = member?.name ?? (seat5 === view.seat ? "\uB098" : `AI ${(seat5 - view.seat + 4) % 4}`);
  return `${wind} \xB7 ${name}`;
}
function readStorage(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) || "null");
  } catch {
    return null;
  }
}
function writeStorage(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
  }
}
function randomSeed() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return bytes[0];
}
function renderAIOptions() {
  const mortal = S.aiCapabilities?.policies?.find((p) => p.id === "mortal"), available = !!mortal?.available;
  for (const id of ["practice-ai", "rule-aiPolicy"]) {
    const option = $(id).querySelector('option[value="mortal"]');
    option.disabled = !available;
    option.textContent = available ? "Mortal \xB7 \uCEE4\uBBA4\uB2C8\uD2F0 v3" : "Mortal \xB7 \uC5F0\uACB0 \uB300\uAE30";
  }
  $("practice-ai-status").textContent = $("practice-ai").value === "mortal" ? available ? "Mortal \uC5F0\uACB0\uB428 \xB7 \uC11C\uBC84\uC5D0\uC11C \uB300\uAD6D\uD569\uB2C8\uB2E4." : "Mortal \uC5F0\uACB0 \uB300\uAE30 \xB7 AI \uC5F0\uACB0\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694." : "\uAE30\uBCF8 AI\uB294 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uC2E4\uD589\uB429\uB2C8\uB2E4.";
  $("room-ai-status").textContent = available ? "Mortal \uC5F0\uACB0\uB428. \uC120\uD0DD\uD55C AI\uB294 \uC774 \uB300\uD68C\uC758 \uBE48\uC790\uB9AC\uC5D0 \uC801\uC6A9\uB429\uB2C8\uB2E4." : "\uAE30\uBCF8 AI\uB97C \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. Mortal\uC740 \uC5F0\uACB0 \uB300\uAE30 \uC911\uC785\uB2C8\uB2E4.";
  $("practice-disconnect").hidden = !remotePractice.connected;
  $("practice-new").disabled = S.busy;
  for (const id of ["practice-ai", "practice-seed", "practice-seat", "practice-count", "random-seed", "practice-disconnect"]) $(id).disabled = S.busy;
}
async function refreshAICapabilities() {
  const server = S.server, controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8e3);
  try {
    const response = await fetch(`${server}/api/duplicate/ai/capabilities`, { signal: controller.signal });
    if (!response.ok) throw new Error("Unavailable");
    const status = await response.json();
    if (server === S.server) S.aiCapabilities = status;
  } catch {
    if (server === S.server) S.aiCapabilities = { policies: [{ id: "simple", available: true }, { id: "mortal", available: false }] };
  } finally {
    clearTimeout(timeout);
    renderAIOptions();
  }
}
function progress() {
  return seriesProgress(S.mode === "online" ? S.online : S.practice?.aiPolicy === "mortal" ? S.practiceRemote ?? S.practice : S.practice);
}
function currentMatchRules() {
  return S.mode === "online" ? S.online?.matchRules ?? (S.online ? null : S.roomMatchRules) : S.practice?.matchRules ?? null;
}
function currentNextHand() {
  return S.mode === "online" ? S.online?.nextHand : S.practice?.aiPolicy === "mortal" ? S.practiceRemote?.nextHand : S.practice?.game.phase === "end" ? localNextPlan(S.practice) : null;
}
function textNode(tag, value, className = "") {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  return el;
}
function toast(message) {
  $("toast").textContent = message;
  $("toast").hidden = false;
  clearTimeout(S.toastTimer);
  S.toastTimer = setTimeout(() => $("toast").hidden = true, 4200);
}
function clearPlayTimer() {
  clearTimeout(S.timer);
  S.timer = null;
}
function savePractice() {
  if (S.practice) writeStorage(localStorage, "duplicate.practice.v1", S.practice);
}
function currentDuplicateProfile() {
  return normalizeDuplicateProfile(S.mode === "online" ? S.online?.duplicateProfile ?? (S.online ? "custom" : S.roomDuplicateProfile) : S.practice?.duplicateProfile ?? S.practice?.game?.duplicateProfile);
}
function currentRules() {
  return S.mode === "online" ? S.online?.rules ?? S.roomRules : S.practice?.game.rules ?? S.settings;
}
function ruleSummary() {
  const r = currentRules(), box = $("rule-chips");
  box.replaceChildren();
  box.className = "rule-chips";
  box.append(textNode("span", profileName(currentDuplicateProfile()), "chip"));
  for (const [key, name] of switchDefinitions.slice(0, 6)) box.append(textNode("span", `${name} ${r[key] ? "ON" : "OFF"}`, `chip ${r[key] ? "" : "off"}`));
  box.append(textNode("span", usesMilProgression(currentDuplicateProfile()) ? "\uD558\uAC00 \uC0B0 \uC18C\uC9C4 \xB7 \uB9C8\uC9C0\uB9C9 \uCC28\uB840" : `${r.exhaustLimit}\uBA85 \uC18C\uC9C4 \uC720\uAD6D`, "chip"));
  const match = currentMatchRules(), count = S.mode === "online" ? S.online?.boardCount ?? S.boardCount : S.practice?.count;
  box.append(textNode("span", formatName(match, count), "chip"));
  box.append(textNode("span", `\uCE5C \uC5F0\uC7A5 ${match?.dealerContinuation ? "ON" : "OFF"}`, "chip"));
  $("rules-series-summary").textContent = match ? `${formatName(match)} \xB7 \uCE5C \uC5F0\uC7A5 ${match.dealerContinuation ? "\uC788\uC74C" : "\uC5C6\uC74C"} \xB7 \uC544\uAC00\uB9AC\uC57C\uBA54 ${match.agariYame ? "ON" : "OFF"}` : "\uAE30\uC874 \uB300\uAD6D \xB7 \uAC01 \uAD6D \uB3C5\uB9BD \xB7 \uCE5C \uC5F0\uC7A5 \uC5C6\uC74C";
  $("rules-summary-title").textContent = S.mode === "online" ? S.online ? "\uC774 \uBC29\uC758 \uB300\uAD6D \uADDC\uCE59" : "\uC0C8 \uB300\uD68C \uADDC\uCE59" : "\uD604\uC7AC \uC5F0\uC2B5 \uADDC\uCE59";
  $("rules-open-second").textContent = S.mode === "online" && S.online ? "\uADDC\uCE59 \uBCF4\uAE30" : "\uADDC\uCE59 \uC124\uC815";
  const roomRules = S.online?.rules ?? S.roomRules, roomMatch = S.online ? S.online.matchRules : S.roomMatchRules;
  $("room-rules-preview").textContent = `${profileName(S.online?.duplicateProfile ?? (S.online ? "custom" : S.roomDuplicateProfile))} \xB7 ${formatName(roomMatch, S.online?.boardCount ?? S.boardCount)} \xB7 \uCE5C \uC5F0\uC7A5 ${roomMatch?.dealerContinuation ? "ON" : "OFF"} \xB7 \uC544\uAC00\uB9AC\uC57C\uBA54 ${roomMatch?.agariYame ? "ON" : "OFF"} \xB7 \uB3C4\uB77C ${roomRules.dora ? "\uC788\uC74C" : "\uC5C6\uC74C"} \xB7 \uC131\uC801 ${(S.online?.scoring ?? S.roomScoring).method === "imp" ? "IMP" : "\uC6D0\uC810\uC218"} \xB7 ${(S.online?.aiPolicy ?? S.roomAI) === "mortal" ? "Mortal" : "\uAE30\uBCF8 AI"}`;
  $("room-rules-open").textContent = S.online ? "\uBC29 \uADDC\uCE59 \uBCF4\uAE30" : "\uBC29 \uADDC\uCE59 \uC124\uC815";
}
function syncGameLayout() {
  const active = !!S.view && S.panel !== "settings", focused = active && S.largeBoard;
  document.body.classList.toggle("game-focus", focused);
  const button = $("game-view-toggle");
  button.hidden = !active;
  button.textContent = focused ? "\uB3CC\uC544\uAC00\uAE30" : "\uB300\uAD6D \uD06C\uAC8C \uBCF4\uAE30";
  button.setAttribute("aria-expanded", String(!focused));
}
function showPanel(panel) {
  S.panel = panel;
  for (const name of ["practice", "online", "settings"]) {
    $(`${name}-panel`).hidden = name !== panel;
    $(`${name}-tab`).classList.toggle("active", name === panel);
    $(`${name}-tab`).setAttribute("aria-pressed", String(name === panel));
  }
  $("layout").classList.toggle("personal-settings-open", panel === "settings");
  syncGameLayout();
}
function openPersonalSettings() {
  showPanel("settings");
  if (matchMedia("(max-width:850px)").matches) $("settings-panel").scrollIntoView({ block: "start", behavior: "auto" });
}
function setMode(mode) {
  S.largeBoard = true;
  clearPlayTimer();
  remotePractice.deactivate();
  S.mode = mode;
  showPanel(mode);
  S.selected = null;
  S.riichiSelecting = false;
  S.endHidden = false;
  S.endKey = null;
  if (mode === "online") {
    S.view = S.credentials ? S.online?.game ?? null : null;
    render();
    if (S.credentials) pollRoom();
  } else {
    S.view = S.practice.aiPolicy === "mortal" ? S.practiceRemote?.game ?? null : snapshot4(S.practice.game, S.practice.seat);
    render();
    if (S.practice.aiPolicy === "mortal") remotePractice.activate();
    schedulePractice();
  }
}
function applyPreferences(value) {
  S.preferences = normalizePreferences(value);
  savePreferences(localStorage, S.preferences);
  S.autoWin = S.preferences.autoWin;
  $("auto-win").checked = S.autoWin;
  personalSettingsUI?.setValue(S.preferences);
  if (S.preferences.sound) feedback.unlock();
  render();
  if (S.mode === "practice") schedulePractice();
  else scheduleOnlineAuto();
}
async function newPractice() {
  if (S.busy) return;
  const raw = $("practice-seed").value.trim();
  if (!/^\d{1,10}$/.test(raw) || Number(raw) > 4294967295) {
    toast("\uBC30\uD328 \uBC88\uD638\uB294 0\uBD80\uD130 4294967295\uAE4C\uC9C0 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
    return;
  }
  clearPlayTimer();
  if (!await savePracticeReplayBeforeReset()) return;
  const aiPolicy = $("practice-ai").value;
  if (aiPolicy === "mortal") {
    S.busy = true;
    renderAIOptions();
    await refreshAICapabilities();
    if (!S.aiCapabilities?.policies?.find((p) => p.id === "mortal")?.available) {
      S.busy = false;
      renderAIOptions();
      toast("Mortal\uC5D0 \uC5F0\uACB0\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. AI \uC5F0\uACB0\uC744 \uD655\uC778\uD55C \uB4A4 \uB2E4\uC2DC \uC2DC\uC791\uD574 \uC8FC\uC138\uC694.");
      if (S.mode === "practice") schedulePractice();
      else scheduleOnlineAuto();
      return;
    }
  }
  clearPlayTimer();
  S.worker?.terminate();
  S.worker = null;
  const seed = Number(raw), seatChoice = $("practice-seat").value, seat5 = resolvePracticeSeat(seatChoice, randomSeed), matchRules = normalizeMatchRules({ ...S.practiceMatchRules, format: $("practice-count").value }), count = matchBoardCount(matchRules);
  remotePractice.clear();
  S.practiceRemote = null;
  S.practiceError = "";
  S.practice = { ...createPracticeSeries({ seed, seat: seat5, matchRules, rules: S.settings, duplicateProfile: S.practiceDuplicateProfile, aiPolicy }), seatChoice };
  S.gameEpoch++;
  S.mode = "practice";
  S.endHidden = false;
  S.endKey = null;
  S.selected = null;
  S.riichiSelecting = false;
  savePractice();
  setMode("practice");
  if (aiPolicy === "mortal") {
    S.busy = true;
    render();
    try {
      await remotePractice.start({ seed, seat: seat5, count, matchRules, rules: S.settings, duplicateProfile: S.practiceDuplicateProfile, name: readStorage(localStorage, "duplicate.name") ?? "\uB098" });
      if (S.mode === "practice") remotePractice.activate();
    } catch (error) {
      S.practiceError = "Mortal \uC5F0\uC2B5\uC744 \uC0C8\uB85C \uC2DC\uC791\uD574 \uC8FC\uC138\uC694.";
      toast(error.message);
    } finally {
      S.busy = false;
      render();
      schedulePractice();
    }
  }
}
function schedulePractice() {
  if (S.practice?.aiPolicy === "mortal") {
    clearPlayTimer();
    const v = S.view;
    if (S.mode !== "practice" || !v || v.phase === "end" || v.actor !== v.seat || S.busy) return;
    const action = automaticPlayerAction(v, { autoWin: S.autoWin });
    if (action) S.timer = setTimeout(() => play(action), action.type === "discard" ? PRACTICE_AI_DELAY_MS : action.type === "pass" ? 0 : 450);
    return;
  }
  clearPlayTimer();
  if (S.mode !== "practice" || S.busy || !S.practice || S.practice.game.phase === "end") return;
  const practice = S.practice, game = practice.game, epoch = S.gameEpoch, seat5 = actor3(game), view = snapshot4(game, practice.seat), human = seat5 === practice.seat;
  if (!human) {
    S.timer = setTimeout(() => {
      if (S.busy || S.mode !== "practice" || S.practice !== practice || practice.game !== game || S.gameEpoch !== epoch) return;
      try {
        advancePracticeAI(game, practice.seat);
        afterPracticeStep();
      } catch (error) {
        showGameError(error);
      }
    }, PRACTICE_AI_DELAY_MS);
  } else {
    const action = automaticPlayerAction(view, { autoWin: S.autoWin });
    if (action) S.timer = setTimeout(() => play(action), action.type === "discard" ? PRACTICE_AI_DELAY_MS : action.type === "pass" ? 0 : 450);
  }
}
function showGameError(error) {
  console.error(error);
  toast(`\uC9C4\uD589 \uC624\uB958: ${error.message}`);
  $("table-status").textContent = "\uC9C4\uD589\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.";
}
function afterPracticeStep() {
  settleForcedPracticePasses(S.practice.game, S.practice.seat);
  S.selected = null;
  S.riichiSelecting = false;
  S.view = snapshot4(S.practice.game, S.practice.seat);
  savePractice();
  if (S.practice.game.phase === "end") {
    finishPractice();
    archiveEndedReplay("practice");
  }
  render();
  schedulePractice();
}
function applyPrivatePractice(state) {
  if (S.practice?.aiPolicy !== "mortal") return;
  const changed = !S.practiceRemote || S.practiceRemote.revision !== state.revision || S.practiceRemote.handId !== state.handId || S.practiceRemote.board !== state.board;
  const replayHandChanged = !S.practiceRemote || S.practiceRemote.handId !== state.handId || S.practiceRemote.board !== state.board;
  S.practiceRemote = state;
  S.practiceError = "";
  Object.assign(S.practice, seriesProgress(state), { index: state.board - 1, count: state.boardCount, matchRules: state.matchRules ?? null, duplicateProfile: normalizeDuplicateProfile(state.duplicateProfile) });
  savePractice();
  if (state.game?.phase === "end") {
    finishPractice(state.game);
    archiveEndedReplay("practice");
  }
  if (replayHandChanged || state.game?.phase === "end" && changed) void archiveRemoteHistory("practice", state);
  if (S.mode === "practice") {
    S.view = state.game;
    if (changed) {
      S.selected = null;
      S.riichiSelecting = false;
    }
    render();
    schedulePractice();
  }
}
async function privateOperation(operation, action) {
  if (S.busy) return;
  S.busy = true;
  clearPlayTimer();
  renderActions();
  try {
    if (operation === "next") await remotePractice.next();
    else await remotePractice.act(action);
  } catch (error) {
    toast(error.message);
    await remotePractice.poll();
  } finally {
    S.busy = false;
    render();
    schedulePractice();
  }
}
function finishPractice(view = null) {
  const p = S.practice, current = seriesProgress(p);
  if (p.results.some((r) => handId({ board: r.board ?? r.index + 1, honba: r.honba ?? 0 }) === current.handId)) return;
  const result = { ...current, index: current.handNumber - 1, seat: p.seat, score: view?.players[p.seat].score ?? p.game.players[p.seat].score, reference: null, referenceStatus: "loading", continues: !!(p.aiPolicy === "mortal" ? S.practiceRemote?.nextHand : localNextPlan(p))?.continues, seatScores: (view?.players ?? p.game.players).map((player) => player.score), members: Array.from({ length: 4 }, (_, seat5) => ({ seat: seat5, name: seat5 === p.seat ? "\uB098" : `AI ${(seat5 - p.seat + 4) % 4}`, ai: seat5 !== p.seat })) };
  p.results.push(result);
  savePractice();
  let job;
  try {
    job = practiceBaselineOptions(p, view, S.practiceRemote?.handContext);
    result.seed = job.seed;
  } catch {
    result.referenceStatus = "error";
    savePractice();
    return;
  }
  try {
    S.worker?.terminate();
    S.worker = new Worker(new URL("./baseline-worker.mjs?v=f9052a72189cc9c3", import.meta.url), { type: "module" });
    S.worker.onmessage = (e) => {
      if (e.data.error) {
        result.referenceStatus = "error";
        toast("AI \uAE30\uC900 \uB300\uAD6D\uC744 \uACC4\uC0B0\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      } else {
        result.reference = e.data.score;
        result.referenceStatus = "done";
      }
      savePractice();
      if (S.mode === "practice") renderComparison();
      S.worker?.terminate();
      S.worker = null;
    };
    S.worker.onerror = () => {
      result.referenceStatus = "error";
      savePractice();
      renderComparison();
    };
    S.worker.postMessage(job);
  } catch {
    setTimeout(() => {
      try {
        const game = createGame3(job);
        driveAI(game, [], 2e3);
        if (game.phase !== "end") throw Error("AI limit");
        result.reference = game.players[job.seat].score;
        result.referenceStatus = "done";
      } catch {
        result.referenceStatus = "error";
      }
      savePractice();
      if (S.mode === "practice") renderComparison();
    }, 30);
  }
}
async function play(action) {
  if (S.busy || !action) return;
  clearPlayTimer();
  if (S.mode === "practice") {
    if (S.practice.aiPolicy === "mortal") {
      await privateOperation("act", action);
      return;
    }
    try {
      step3(S.practice.game, S.practice.seat, action);
      afterPracticeStep();
    } catch (error) {
      showGameError(error);
    }
    return;
  }
  if (!S.credentials || !S.online) return;
  S.busy = true;
  renderActions();
  try {
    const state = await request(`/${S.credentials.code}/action`, { action, revision: S.online.revision, actionId: crypto.randomUUID() });
    applyRoomState(state);
  } catch (error) {
    toast(error.message);
    await pollRoom();
  } finally {
    S.busy = false;
    renderHand();
    renderActions();
    scheduleOnlineAuto();
  }
}
function selectTile(tile3) {
  if (!S.view || S.view.actor !== S.view.seat || S.view.phase !== "turn" || S.busy) return;
  const type = S.riichiSelecting ? "riichi" : "discard", action = S.view.legalActions.find((a) => a.type === type && a.id === tile3.id);
  if (!action) return;
  if (S.selected === tile3.id) {
    play(action);
    return;
  }
  S.selected = tile3.id;
  renderHand();
  renderActions();
}
function renderHand() {
  const hand = $("hand");
  hand.replaceChildren();
  const v = S.view;
  if (!v) {
    $("self-name").replaceChildren(textNode("b", "\uB098"), textNode("span", "\u2014"));
    $("self-points").textContent = "\u2014";
    $("self-wall").textContent = "\uB300\uD68C \uCC38\uAC00 \uD6C4 \uD45C\uC2DC";
    $("self-melds").replaceChildren();
    return;
  }
  const self = v.players[v.seat], ownName = activeRoom()?.members?.find((p) => p.seat === v.seat)?.name ?? "\uB098";
  $("self-name").replaceChildren(textNode("b", `${ownName}${self.riichi ? " \xB7 \uB9AC\uCE58" : ""}`), textNode("span", winds2[(v.seat - v.dealer + 4) % 4]));
  $("self-points").textContent = number2(self.points ?? v.rules.startingPoints + self.score);
  $("self-wall").textContent = `\uAC1C\uC778 \uD328\uC0B0 ${v.ownWallRemaining}\uC7A5${self.exhausted ? " \xB7 \uC18C\uC9C4" : ""}`;
  for (const tile3 of orderedHandTiles(v.handTiles)) {
    const el = tileFace(tile3.type, { button: true });
    el.classList.toggle("red", tile3.red);
    el.classList.toggle("drawn", tile3.drawn);
    el.classList.toggle("selected", tile3.id === S.selected);
    el.dataset.id = tile3.id;
    el.title = `${tile3.red ? "\uC801 " : ""}${tileName(tile3.type)}${tile3.drawn ? " \xB7 \uBC29\uAE08 \uBF51\uC740 \uD328" : ""}`;
    el.setAttribute("aria-label", el.title);
    el.setAttribute("aria-pressed", String(tile3.id === S.selected));
    const legal = v.legalActions.some((a) => a.type === (S.riichiSelecting ? "riichi" : "discard") && a.id === tile3.id);
    el.classList.toggle("disabled", !legal);
    el.disabled = !legal || S.busy;
    el.addEventListener("click", () => selectTile(tile3));
    hand.append(el);
  }
  $("self-name").dataset.seat = String(v.seat);
  $("self-melds").dataset.seat = String(v.seat);
  renderMelds($("self-melds"), self.melds);
}
function renderMelds(container, melds = []) {
  container.replaceChildren();
  for (const meld3 of melds) {
    const box = document.createElement("span");
    box.className = "meld";
    if (meld3.hidden || meld3.tile === null) {
      for (let n = 0; n < 4; n++) box.append(textNode("span", "", "hidden-kan"));
    } else {
      const types = meld3.type === "chi" ? [meld3.tile, meld3.tile + 1, meld3.tile + 2] : Array(meld3.type === "kan" ? 4 : 3).fill(meld3.tile), reds = /* @__PURE__ */ new Map();
      for (const t of meld3.tiles ?? []) if (t.red) reds.set(t.type, (reds.get(t.type) ?? 0) + 1);
      for (const [i, type] of types.entries()) {
        if (meld3.type === "kan" && !meld3.open && (i === 0 || i === 3)) box.append(textNode("span", "", "hidden-kan"));
        else {
          const tile3 = tileFace(type, { small: true });
          if (reds.get(type) > 0) {
            tile3.classList.add("red");
            reds.set(type, reds.get(type) - 1);
          }
          if (meld3.open && i === 0) tile3.classList.add("called");
          box.append(tile3);
        }
      }
    }
    container.append(box);
  }
}
function renderTable() {
  const v = S.view;
  for (const position of positions) {
    const river = $(`river-${position}`);
    river.replaceChildren();
    if (position !== "bottom") {
      $(`opponent-${position}`).replaceChildren();
      $(`meld-${position}`).replaceChildren();
    }
  }
  if (!v) {
    const privateGame = S.mode === "practice" && S.practice?.aiPolicy === "mortal";
    $("round-name").textContent = privateGame ? "Mortal \uC5F0\uC2B5" : "\uB300\uD68C \uC900\uBE44";
    $("board-number").textContent = privateGame ? "PRACTICE" : "LOBBY";
    $("wall-count").textContent = "\u2014";
    $("pot-label").textContent = "\uB9AC\uCE58\uBD09 0";
    $("exhausted-label").textContent = "";
    $("turn-compass").replaceChildren();
    $("dora-tiles").replaceChildren();
    $("table-status").textContent = privateGame ? S.practiceError || "Mortal \uC5F0\uC2B5\uC5D0 \uC5F0\uACB0\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4." : S.online?.tournament?.status === "registration" ? "\uCC38\uAC00 \uB4F1\uB85D \uC911 \xB7 \uBA85\uB2E8 \uD655\uC815 \uB4A4 \uBAA8\uB4E0 \uD0C1\uC774 \uC2DC\uC791\uD569\uB2C8\uB2E4." : S.online?.phase === "lobby" ? "\uCC38\uAC00\uC790\uB97C \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC2B5\uB2C8\uB2E4." : "\uB300\uD68C\uB97C \uB9CC\uB4E4\uAC70\uB098 \uCF54\uB4DC\uB85C \uCC38\uAC00\uD558\uC138\uC694.";
    $("board-label").textContent = privateGame ? "Mortal \uC5F0\uC2B5 \uC900\uBE44" : S.online ? `\uC628\uB77C\uC778 \xB7 \uB300\uAE30\uC2E4 ${S.online.tableId ?? ""}` : "\uC628\uB77C\uC778 \uB300\uC804";
    $("seat-label").textContent = "";
    return;
  }
  const context3 = progress(), board = context3.board, count = S.mode === "practice" ? S.practice.count : S.online.boardCount;
  $("board-label").textContent = `${S.mode === "practice" ? "\uC5F0\uC2B5" : "\uC628\uB77C\uC778"} \xB7 ${board}/${count}\uAE30\uBCF8\uAD6D \xB7 \uB300\uAD6D ${context3.handNumber}`;
  $("seat-label").textContent = `\uB0B4 \uC790\uB9AC ${winds2[(v.seat - v.dealer + 4) % 4]}`;
  $("round-name").textContent = handLabel({ ...context3, game: v });
  $("board-number").textContent = `DEAL ${context3.handId}`;
  $("wall-count").textContent = String(v.ownWallRemaining);
  $("pot-label").textContent = `\uB9AC\uCE58\uBD09 ${v.pot / 1e3}`;
  $("exhausted-label").textContent = usesMilProgression(v.duplicateProfile) ? v.lastTileTurn ? "MIL \uB9C8\uC9C0\uB9C9 \uCC28\uB840" : "MIL \uAC1C\uC778 \uD328\uC0B0" : `\uC18C\uC9C4 ${v.exhaustedSeats.length} / ${v.rules.exhaustLimit}`;
  const shownActor = v.phase === "reaction" ? v.lastDiscard?.seat : v.turn;
  for (let relative = 0; relative < 4; relative++) {
    const seat5 = (v.seat + relative) % 4, player = v.players[seat5], position = positions[relative], river = $(`river-${position}`);
    river.classList.toggle("long-river", player.river.length > 24);
    for (const discarded of player.river) {
      const tile3 = tileFace(discarded.type ?? discarded.tile, { small: true });
      tile3.classList.toggle("red", discarded.red);
      tile3.classList.toggle("riichi", discarded.riichi);
      tile3.classList.toggle("claimed", discarded.claimed);
      tile3.dataset.discardId = String(discarded.id);
      tile3.dataset.tileId = String(discarded.id);
      tile3.dataset.seat = String(seat5);
      decorateDiscardTile(tile3, discarded, S.preferences.discardDisplay);
      river.append(tile3);
    }
    if (relative) {
      const panel = $(`opponent-${position}`), member = activeRoom()?.members?.find((p) => p.seat === seat5) ?? { name: `AI ${relative}`, ai: true };
      const label = document.createElement("div");
      label.className = `player-label ${shownActor === seat5 && v.phase !== "end" ? "active" : ""}`;
      label.append(textNode("span", winds2[(seat5 - v.dealer + 4) % 4], "player-wind"), textNode("span", member?.name ?? "\uB300\uAE30 \uC911"));
      if (player.riichi) label.append(textNode("span", "\u7ACB\u76F4", "player-status"));
      panel.append(label, textNode("div", number2(player.points ?? v.rules.startingPoints + player.score), "player-score"), textNode("div", player.exhausted ? "\uD328\uC0B0 \uC18C\uC9C4" : `\uD328\uC0B0 ${player.wallRemaining}`, `player-wall ${player.exhausted ? "exhausted" : ""}`));
      if (position === "top") {
        const backs = document.createElement("div");
        backs.className = "tile-backs";
        for (let i = 0; i < player.handSize; i++) backs.append(textNode("span", "", "tile-back"));
        panel.append(backs);
      }
      renderMelds($(`meld-${position}`), player.melds);
    }
  }
  const compass = $("turn-compass");
  compass.replaceChildren();
  for (let relative = 0; relative < 4; relative++) {
    const seat5 = (v.seat + relative) % 4;
    compass.append(textNode("span", winds2[(seat5 - v.dealer + 4) % 4], `${positions[relative]} ${shownActor === seat5 && v.phase !== "end" ? "active" : ""}`));
  }
  $("dora-tiles").replaceChildren();
  for (const type of v.doraIndicators) $("dora-tiles").append(tileFace(type, { small: true }));
  if (!v.doraIndicators.length) $("dora-tiles").append(textNode("span", v.rules.kanDora ? " \uAE61\u5F8C \uD45C\uC2DC" : " \uC5C6\uC74C"));
  let status = "";
  if (v.phase === "end") status = v.end === "win" ? "\uD654\uB8CC \xB7 \uAD6D \uC885\uB8CC" : "\uC720\uAD6D \xB7 \uAD6D \uC885\uB8CC";
  else if (v.actor === v.seat && v.lastTileTurn && v.phase === "turn") status = "MIL \uB9C8\uC9C0\uB9C9 \uCC28\uB840 \xB7 \uD654\uB8CC \uB610\uB294 \uBC84\uB9BC\uB9CC \uAC00\uB2A5\uD569\uB2C8\uB2E4.";
  else if (forcedPlayerPass(v)) status = "";
  else if (v.actor === v.seat) status = v.phase === "reaction" && v.lastDiscard ? `${winds2[(v.lastDiscard.seat - v.dealer + 4) % 4]}\uC758 ${tileName(v.lastDiscard.type ?? v.lastDiscard.tile)} \xB7 \uB860/\uD6C4\uB85C \uC120\uD0DD` : "\uB0B4 \uCC28\uB840\uC785\uB2C8\uB2E4.";
  else if (activeRoom()?.aiWaiting) status = "Mortal \uC120\uD0DD\uC744 \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC2B5\uB2C8\uB2E4.";
  else status = v.phase === "reaction" ? "\uB860\xB7\uCF5C \uD655\uC778 \uC911" : `${winds2[(v.turn - v.dealer + 4) % 4]}\uC758 \uCC28\uB840`;
  $("table-status").textContent = status;
}
var actionNames = { tsumo: "\uCBD4\uBAA8", ron: "\uB860", pon: "\uD401", minkan: "\uBA85\uAE61", ankan: "\uC548\uAE61", kakan: "\uAC00\uAE61", chi: "\uCE58", pass: "\uB118\uAE30\uAE30" };
function callPreview(action, view) {
  const box = document.createElement("span");
  box.className = "call-preview";
  box.setAttribute("aria-hidden", "true");
  const source = view.lastDiscard, hand = [...view.handTiles].sort((a, b) => Number(!!a.red) - Number(!!b.red));
  let tiles2 = [];
  if (action.type === "kakan") {
    const meld3 = view.melds[action.meld];
    if (!meld3) return box;
    tiles2 = [...meld3.tiles ?? [], hand.find((t) => t.type === meld3.tile)].filter(Boolean);
  } else if (action.type === "ankan") tiles2 = hand.filter((t) => t.type === action.tile);
  else {
    const wanted = action.type === "chi" ? [action.tile, action.tile + 1, action.tile + 2] : Array(action.type === "minkan" ? 4 : 3).fill(action.tile);
    let claimed = false;
    tiles2 = wanted.map((type) => {
      if (!claimed && type === (source?.type ?? source?.tile)) {
        claimed = true;
        return { type, red: !!source.red, claimed: true };
      }
      const index = hand.findIndex((t) => t.type === type);
      return index < 0 ? { type } : hand.splice(index, 1)[0];
    });
  }
  for (const t of tiles2) {
    const face = tileFace(t.type, { small: true });
    face.classList.toggle("red", !!t.red);
    face.classList.toggle("call-target", !!t.claimed);
    box.append(face);
  }
  return box;
}
function renderActions() {
  const box = $("actions");
  box.replaceChildren();
  const v = S.view, legal = v?.legalActions ?? [];
  if (!v) {
    $("action-hint").textContent = "\uB300\uAE30\uC2E4\uC5D0\uC11C \uB300\uAD6D\uC744 \uC2DC\uC791\uD558\uC138\uC694.";
    return;
  }
  if (v.phase === "end") {
    $("action-hint").textContent = "\uAD6D\uC774 \uB05D\uB0AC\uC2B5\uB2C8\uB2E4. \uACB0\uACFC\uB97C \uD655\uC778\uD558\uC138\uC694.";
    if (S.mode === "practice" || S.online.host) {
      const next = textNode("button", hasNext() ? currentNextHand()?.continues ? "\uC5F0\uC7A5 \uB300\uAD6D" : "\uB2E4\uC74C \uAD6D" : S.mode === "practice" ? "\uC0C8 \uC5F0\uC2B5" : "\uB300\uD68C \uC644\uB8CC", "primary");
      next.disabled = S.busy || S.mode === "online" && !hasNext();
      next.onclick = () => advance();
      box.append(next);
    }
    return;
  }
  if (v.actor !== v.seat) {
    $("action-hint").textContent = "\uB2E4\uB978 \uD50C\uB808\uC774\uC5B4\uC758 \uC120\uD0DD\uC744 \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC2B5\uB2C8\uB2E4.";
    return;
  }
  if (forcedPlayerPass(v)) {
    $("action-hint").textContent = "";
    return;
  }
  $("action-hint").textContent = S.riichiSelecting ? "\uB9AC\uCE58\uD560 \uBC84\uB9BC\uD328\uB97C \uC120\uD0DD\uD558\uC138\uC694." : v.phase === "reaction" ? "\uB860\xB7\uCE58\xB7\uD401\xB7\uAE61 \uB610\uB294 \uB118\uAE30\uAE30\uB97C \uC120\uD0DD\uD558\uC138\uC694." : S.selected !== null ? "\uC120\uD0DD\uD55C \uD328\uB97C \uB2E4\uC2DC \uB204\uB974\uBA74 \uBC84\uB9BD\uB2C8\uB2E4." : "\uD328\uB97C \uB450 \uBC88 \uB204\uB974\uAC70\uB098 \uC120\uD0DD \uD6C4 \uBC84\uB9AC\uAE30\uB97C \uB204\uB974\uC138\uC694.";
  for (const action of legal.filter((a) => !["discard", "riichi"].includes(a.type))) {
    const button = textNode("button", `${actionNames[action.type] ?? action.type}${action.type === "chi" ? ` ${tileName(action.tile)}\uBD80\uD130` : ["ankan", "minkan"].includes(action.type) ? ` ${tileName(action.tile)}` : ""}`, ["tsumo", "ron"].includes(action.type) ? "win-action" : "secondary");
    if (S.preferences.callPreview && ["chi", "pon", "minkan", "ankan", "kakan"].includes(action.type)) {
      button.classList.add("call-preview-button");
      button.append(callPreview(action, v));
    }
    button.disabled = S.busy;
    button.onclick = () => play(action);
    box.append(button);
  }
  if (legal.some((a) => a.type === "riichi")) {
    const button = textNode("button", S.riichiSelecting ? "\uB9AC\uCE58 \uCDE8\uC18C" : "\uB9AC\uCE58", "riichi-action");
    button.disabled = S.busy;
    button.onclick = () => {
      S.riichiSelecting = !S.riichiSelecting;
      S.selected = null;
      renderHand();
      renderActions();
    };
    box.append(button);
  }
  if (legal.some((a) => a.type === "discard")) {
    const action = legal.find((a) => a.type === (S.riichiSelecting ? "riichi" : "discard") && a.id === S.selected), button = textNode("button", S.riichiSelecting ? "\uB9AC\uCE58 \uC120\uC5B8" : "\uBC84\uB9AC\uAE30", "primary");
    button.disabled = !action || S.busy;
    button.onclick = () => play(action);
    box.append(button);
  }
}
function hasNext() {
  if (S.mode === "online") return S.online?.hasNext ?? S.online?.board < S.online?.boardCount;
  if (S.practice?.aiPolicy === "mortal") return S.practiceRemote?.hasNext ?? S.practiceRemote?.board < S.practiceRemote?.boardCount;
  return S.practice?.game.phase === "end" ? !localNextPlan(S.practice).complete : false;
}
function renderEnd() {
  const v = S.view, ended3 = v?.phase === "end";
  $("resume-result").hidden = !ended3;
  if (!ended3) {
    $("end-overlay").hidden = true;
    S.endKey = null;
    return;
  }
  const key = `${S.mode}:${S.mode === "practice" ? S.practice.seed : S.online.code}:${progress().handId}`;
  if (S.endKey !== key) {
    S.endKey = key;
    S.endHidden = false;
  }
  $("end-overlay").hidden = S.endHidden || Date.now() < S.endRevealAt;
  $("end-title").textContent = v.end === "win" ? "\uD654\uB8CC" : v.end === "exhaustive-draw" ? "\uD669\uD328 \uC720\uAD6D" : "\uC0AC\uAE61\uC0B0\uB8CC";
  $("end-eyebrow").textContent = `${handLabel({ ...progress(), game: v })} \xB7 RESULT`;
  const details = $("end-details");
  details.replaceChildren();
  renderWinningHands($("end-winning-hands"), v.winningHands, { dealer: v.dealer });
  for (const seat5 of v.winners ?? []) {
    const p = v.players[seat5], win3 = p.win;
    if (!win3) continue;
    const summary2 = winnerPaymentSummary(v, seat5), score2 = win3.score ?? {}, box = document.createElement("div");
    box.className = "winner-block";
    box.append(textNode("strong", `${summary2.dealer === true ? "\uCE5C(\u89AA)" : summary2.dealer === false ? "\uC790(\u5B50)" : "\uCE5C\xB7\uC790 \uD655\uC778 \uBD88\uAC00"} \xB7 ${winds2[(seat5 - v.dealer + 4) % 4]} \xB7 ${win3.method === "tsumo" ? "\uCBD4\uBAA8" : "\uB860"} \xB7 ${summary2.scoreLabel}`), textNode("div", score2.name ?? ""));
    const bonuses = score2.bonuses;
    if (Array.isArray(bonuses) && bonuses.length) box.append(textNode("div", bonuses.map((b) => `${b.name} ${b.han}`).join(" \xB7 ")));
    else if (bonuses && Object.values(bonuses).some(Boolean)) box.append(textNode("div", [bonuses.dora ? `\uB3C4\uB77C ${bonuses.dora}` : "", bonuses.uraDora ? `\uC6B0\uB77C ${bonuses.uraDora}` : "", bonuses.redDora ? `\uC801\uB3C4\uB77C ${bonuses.redDora}` : ""].filter(Boolean).join(" \xB7 ")));
    const payments2 = document.createElement("dl");
    payments2.className = "winner-payments";
    const paymentRow = (label, value, { net = false, total = false } = {}) => {
      const term = textNode("dt", label, total ? "payment-total" : ""), valueNode = textNode("dd", value === null ? "\uD655\uC778 \uBD88\uAC00" : `${net ? signed(value) : number2(value)}\uC810`, total ? "payment-total" : "");
      payments2.append(term, valueNode);
    };
    paymentRow("\uAE30\uBCF8 \uD654\uB8CC \uC218\uC785 (\uBCF8\uC7A5\xB7\uACF5\uD0C1 \uC81C\uC678)", summary2.baseReceipt);
    paymentRow("\uBCF8\uC7A5 \uC218\uC785", summary2.honbaReceipt);
    paymentRow("\uACF5\uD0C1 \uC218\uC785", summary2.potReceipt);
    paymentRow("\uD654\uB8CC \uC218\uC785 \uD569\uACC4", summary2.totalReceipt, { total: true });
    if (summary2.outgoingPayments > 0) paymentRow("\uB2E4\uB978 \uD654\uB8CC\uC790\uC5D0\uAC8C \uC9C0\uAE09", -summary2.outgoingPayments, { net: true });
    if (summary2.riichiExpense !== null) paymentRow("\uBCF8\uC778 \uB9AC\uCE58 \uC120\uC5B8 \uC9C0\uCD9C", -summary2.riichiExpense, { net: true });
    if (summary2.otherChange !== null && summary2.otherChange !== 0) paymentRow("\uAE30\uD0C0 \uC99D\uAC10", summary2.otherChange, { net: true });
    paymentRow("\uC774 \uAD6D \uC810\uC218 \uC99D\uAC10", summary2.netScore, { net: true, total: true });
    box.append(payments2);
    if (summary2.note) box.append(textNode("p", summary2.note, "hint payment-note"));
    details.append(box);
  }
  if (v.uraIndicators?.length) {
    const line = document.createElement("div");
    line.className = "winner-block";
    line.append(textNode("div", "\uC6B0\uB77C\uB3C4\uB77C \uD45C\uC2DC\uD328"));
    for (const type of v.uraIndicators) line.append(tileFace(type, { small: true }));
    details.append(line);
  }
  if (v.end === "exhaustive-draw") {
    details.append(textNode("p", `\uC18C\uC9C4 ${v.exhaustedSeats.length}\uBA85 \xB7 \uD150\uD30C\uC774 \uBC8C\uC810 \uC815\uC0B0`, "hint"));
    if (v.pot) details.append(textNode("p", currentMatchRules() ? `\uB0A8\uC740 \uB9AC\uCE58 \uACF5\uD0C1 ${number2(v.pot)}\uC810 \xB7 ${hasNext() ? "\uB2E4\uC74C \uB300\uAD6D\uC73C\uB85C \uC774\uC5B4\uC9D1\uB2C8\uB2E4." : "\uBBF8\uC218\uB839 \uC0C1\uD0DC\uB85C \uD45C\uC2DC\uD558\uBA70 \uC784\uC758\uB85C \uBC30\uBD84\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."}` : `\uB0A8\uC740 \uB9AC\uCE58 \uACF5\uD0C1 ${number2(v.pot)}\uC810\uC740 \uC774\uBC88 \uAD6D\uC758 \uC810\uC218 \uBCC0\uD654\uC5D0 \uD3EC\uD568\uB429\uB2C8\uB2E4.`, "hint"));
  }
  const points2 = $("end-points");
  points2.replaceChildren(textNode("h3", "\uC774 \uAD6D \uC810\uC218 \uC99D\uAC10", "end-points-heading"));
  for (let seat5 = 0; seat5 < 4; seat5++) {
    const row = document.createElement("div");
    row.className = `end-score-row ${seat5 === v.seat ? "self" : ""}`;
    const name = activeRoom()?.members?.find((p) => p.seat === seat5)?.name ?? (seat5 === v.seat ? "\uB098" : `AI ${(seat5 - v.seat + 4) % 4}`);
    row.append(textNode("span", `${winds2[(seat5 - v.dealer + 4) % 4]} \xB7 ${name ?? "\uD50C\uB808\uC774\uC5B4"}`), textNode("b", signed(v.players[seat5].score), v.players[seat5].score > 0 ? "positive" : v.players[seat5].score < 0 ? "negative" : ""));
    points2.append(row);
  }
  $("next-board").textContent = hasNext() ? currentNextHand()?.continues ? "\uC5F0\uC7A5 \uB300\uAD6D" : "\uB2E4\uC74C \uAD6D" : S.mode === "practice" ? "\uC0C8 \uC5F0\uC2B5" : "\uB300\uD68C \uC644\uB8CC";
  $("next-board").disabled = S.busy || S.mode === "online" && (!S.online.host || !hasNext());
}
function setMetric(id, value) {
  const el = $(id);
  el.textContent = signed(value);
  el.classList.toggle("positive", value > 0);
  el.classList.toggle("negative", value < 0);
}
function finalRows(room) {
  return room?.tournament?.finalResults?.standings ?? [];
}
function renderRoundScorePanel() {
  const panel = $("round-score-panel");
  panel.hidden = !S.view;
  if (!S.view) return;
  let rows = S.mode === "online" ? S.online?.roundResults ?? [] : null;
  if (!rows) {
    const practice = S.practice, history = practice?.results ?? [], count = practice?.count ?? 8;
    rows = Array.from({ length: count }, (_, index) => {
      const board = index + 1, group = history.filter((row) => (row.board ?? row.index + 1) === board), next = currentNextHand();
      const complete = group.some((row) => row.continues === false) || history.some((row) => (row.board ?? row.index + 1) > board) || progress().board === board && S.view.phase === "end" && next && !next.continues;
      const entries = [];
      if (complete && group.length) for (let seat5 = 0; seat5 < 4; seat5++) {
        const available = group.every((row) => Array.isArray(row.seatScores) && Number.isFinite(row.seatScores[seat5]));
        if (!available && seat5 !== practice.seat) continue;
        const member = group.at(-1).members?.find((member2) => member2.seat === seat5) ?? { name: seat5 === practice.seat ? "\uB098" : `AI ${(seat5 - practice.seat + 4) % 4}`, ai: seat5 !== practice.seat };
        entries.push({ tableId: "\uC5F0\uC2B5", name: member.name, seat: seat5, ai: member.ai, score: group.reduce((sum, row) => sum + (available ? row.seatScores[seat5] : row.score), 0), hands: group.length });
      }
      return { board, status: complete && group.length ? "complete" : "waiting", entries, averages: [], referenceLabel: "AI \uAE30\uC900", referenceMean: complete && group.length && group.every((row) => Number.isFinite(row.reference)) ? group.reduce((sum, row) => sum + row.reference, 0) : null };
    });
  }
  renderRoundResults(panel, rows, { seat: S.view.seat, ownTableId: S.mode === "online" ? S.online?.tableId : "\uC5F0\uC2B5", ai: false });
}
function renderComparison() {
  renderRoundScorePanel();
  const online = S.mode === "online", tournament = online && S.online?.tournament?.version === 1, final = tournament && S.online.tournament.status === "final", scoring = normalizeScoring(S.online?.scoring ?? {}), record = tournament ? final ? S.online.finalStanding ?? finalRows(S.online).find((row) => row.tableId === S.online.tableId && row.seat === S.online.seat) : null : online ? S.online?.comparison : S.practice?.results.find((r) => handId({ board: r.board ?? r.index + 1, honba: r.honba ?? 0 }) === progress().handId);
  $("result-caption").textContent = tournament ? final ? "\uCD5C\uC885 \uD655\uC815 \xB7 \uAC19\uC740 \uCD5C\uCD08 \uC790\uB9AC" : "\uB300\uD68C \uC131\uC801 \uD655\uC815 \uB300\uAE30" : online ? "\uAC19\uC740 \uC790\uB9AC \xB7 \uC0AC\uB78C" : "\uAE30\uBCF8 AI \uAE30\uC900";
  $("my-result-label").textContent = online ? "\uC810\uC218 \uC99D\uAC10 \uD569\uACC4" : "\uB0B4 \uC810\uC218 \uBCC0\uD654";
  $("reference-label").textContent = online ? "\uAC19\uC740 \uC790\uB9AC \uD3C9\uADE0 \uD569\uACC4" : "\uAE30\uBCF8 AI \uAE30\uC900 \uB300\uAD6D";
  $("difference-label").textContent = tournament && scoring.method === "imp" ? "IMP \uD569\uACC4" : "\uAE30\uC900 \uB300\uBE44";
  setMetric("my-result", record?.score ?? null);
  setMetric("reference-result", online ? record?.mean : record?.reference);
  setMetric("difference-result", online ? tournament && scoring.method === "imp" ? record?.imp : record?.difference : record?.reference !== null && record?.reference !== void 0 ? record.score - record.reference : null);
  $("scoring-result-details").hidden = !tournament || !final;
  $("scoring-result-details").textContent = tournament && final ? `\uC6D0\uC810\uC218 \uD3C9\uADE0 \uB300\uBE44 ${signed(record?.difference)}\uC810 \xB7 IMP ${signed(record?.imp)} \xB7 ${scoring.impUnit.toLocaleString("ko-KR")}\uC810 \uB2E8\uC704 \xB7 \uAC19\uC740 \uCD5C\uCD08 \uC790\uB9AC ${record?.samples ?? 0}\uBA85 (${record?.ai ? "AI" : "\uC0AC\uB78C"})` : "";
  $("comparison-note").textContent = tournament ? !final ? "\uBAA8\uB4E0 \uCC38\uAC00 \uD0C1\uC774 \uB300\uD68C\uB97C \uB9C8\uCE58\uBA74 \uC131\uC801\uC744 \uC790\uB3D9 \uD655\uC815\uD569\uB2C8\uB2E4. \uBCF8\uC7A5\uC744 \uD3EC\uD568\uD55C \uAD6D\uBCC4 \uC810\uC218 \uC99D\uAC10\uC744 \uAC19\uC740 \uCD5C\uCD08 \uC790\uB9AC\uB07C\uB9AC \uBE44\uAD50\uD569\uB2C8\uB2E4." : record?.samples >= 2 ? "\uD655\uC815 \uC131\uC801 \xB7 \uBCF8\uC7A5\uC744 \uD3EC\uD568\uD55C \uAD6D\uBCC4 \uBE44\uAD50\uC785\uB2C8\uB2E4. \uC6D0\uC810\uC218\uC640 IMP\uB97C \uD568\uAED8 \uD45C\uC2DC\uD558\uBA70 \uC0AC\uB78C\uACFC AI\uB294 \uB530\uB85C \uBE44\uAD50\uD569\uB2C8\uB2E4." : "\uAC19\uC740 \uCD5C\uCD08 \uC790\uB9AC\uC758 \uAC19\uC740 \uAD6C\uBD84 \uCC38\uAC00\uC790\uAC00 2\uBA85 \uBBF8\uB9CC\uC774\uBBC0\uB85C \uD3C9\uADE0 \uB300\uBE44\xB7IMP\xB7\uC21C\uC704\uB97C \uD45C\uC2DC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : online ? record?.boards?.some((row) => row.contextMismatch) ? "\uBCF8\uC7A5\xB7\uACF5\uD0C1\xB7\uC2DC\uC791 \uC810\uC218\uAC00 \uB2E4\uB978 \uD0C1\uC740 \uC810\uC218 \uBE44\uAD50\uC5D0\uC11C \uC81C\uC678\uD569\uB2C8\uB2E4. \uAC19\uC740 \uC870\uAC74\uC758 \uC644\uB8CC \uB300\uAD6D\uC774 2\uAC1C \uC774\uC0C1\uC77C \uB54C \uD3C9\uADE0\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4." : record?.samples >= 2 ? `\uC644\uB8CC\uB41C \uC0AC\uB78C \uCC38\uAC00\uC790 ${record.samples}\uBA85 \xB7 \uAC19\uC740 \uBC30\uD328\xB7\uC790\uB9AC\xB7\uBCF8\uC7A5\xB7\uC2DC\uC791 \uC810\uC218\xB7\uACF5\uD0C1 \uC870\uAC74\uC758 \uBE44\uAD50\uC785\uB2C8\uB2E4.` : "\uAC19\uC740 \uBC30\uD328\xB7\uC790\uB9AC\xB7\uBCF8\uC7A5\xB7\uC2DC\uC791 \uC810\uC218\xB7\uACF5\uD0C1 \uC870\uAC74\uC5D0\uC11C \uC644\uB8CC\uD55C \uC0AC\uB78C\uC774 2\uBA85 \uC774\uC0C1\uC774\uBA74 \uD3C9\uADE0\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4." : record?.referenceStatus === "loading" ? "\uAC19\uC740 \uBC30\uD328\uC758 AI \uAE30\uC900 \uB300\uAD6D\uC744 \uACC4\uC0B0 \uC911\uC785\uB2C8\uB2E4." : record?.referenceStatus === "done" ? "\uAC19\uC740 \uBC30\uD328\xB7\uBCF8\uC7A5\xB7\uC2DC\uC791 \uC810\uC218\xB7\uACF5\uD0C1\uC758 \uAE30\uBCF8 AI \uAE30\uC900\uC785\uB2C8\uB2E4. \uC774\uD6C4 \uC9C4\uD589 \uACBD\uB85C\uB294 \uB530\uB85C \uBE44\uAD50\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : record?.referenceStatus === "error" ? "AI \uAE30\uC900 \uB300\uAD6D \uACC4\uC0B0\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4." : "\uAD6D\uC774 \uB05D\uB098\uBA74 \uAC19\uC740 \uC790\uB9AC\uC758 \uACB0\uACFC\uB97C \uBE44\uAD50\uD569\uB2C8\uB2E4.";
  const history = $("result-history");
  history.replaceChildren();
  const rows = tournament ? record?.rounds ?? [] : online ? record?.boards ?? [] : S.practice?.results ?? [];
  for (const r of rows.slice(-8)) {
    const row = document.createElement("div");
    row.className = "result-history-row";
    const difference = online ? tournament && scoring.method === "imp" ? r.imp : r.difference : r.reference === null ? null : r.score - r.reference;
    row.append(textNode("span", tournament ? `${r.board}\uAD6D \xB7 \uBCF8\uC7A5 \uD3EC\uD568` : `${r.board}\uAD6D \xB7 ${r.honba ?? 0}\uBCF8\uC7A5`), textNode("span", signed(r.score)), textNode("span", difference === null ? "\uBE44\uAD50 \uB300\uAE30" : `${signed(difference)}${tournament && scoring.method === "imp" ? " IMP" : ""}`, difference > 0 ? "positive" : difference < 0 ? "negative" : ""));
    history.append(row);
  }
  $("standings-open").hidden = !online || tournament && !final || !S.online?.standings?.length;
}
function renderRoom() {
  observerLinks.update();
  syncAccountUI();
  const room = S.online;
  $("room-info").hidden = !room;
  $("online-create").disabled = S.busy || !!room;
  $("online-join").disabled = S.busy || !!room;
  $("online-name").disabled = !!room || !!accountSession();
  $("online-code").disabled = !!room;
  if (!room) return;
  $("room-code").textContent = room.code;
  const members = $("room-members");
  members.replaceChildren();
  for (let seat5 = 0; seat5 < 4; seat5++) {
    const p = room.members.find((m) => m.seat === seat5), row = document.createElement("div");
    row.className = "member-row";
    row.append(textNode("span", `${winds2[seat5]} \xB7 ${p?.name ?? "\uBE48\uC790\uB9AC"}`), textNode("small", p ? p.ai ? "AI" : seat5 === room.seat ? "\uB098" : "\uCC38\uAC00\uC790" : "\uB300\uAE30"));
    members.append(row);
  }
  const t = room.tournament, registration = t?.status === "registration";
  $("start-ai").hidden = t ? !(registration && room.host && room.members.length < 4) : room.phase !== "lobby" || !room.host;
  $("start-ai").textContent = t ? "\uB0B4 \uD0C1\uC758 \uBE48\uC790\uB9AC\uB97C AI\uB85C \uCC44\uC6B0\uAE30" : "\uBE48\uC790\uB9AC\uB97C AI\uB85C \uCC44\uC6B0\uACE0 \uC2DC\uC791";
  $("start-ai").disabled = S.busy;
  $("start-tournament").hidden = !registration || !room.organizer;
  $("start-tournament").disabled = S.busy || !t?.canStart;
  $("tournament-status").textContent = t ? registration ? `\uCC38\uAC00 \uB4F1\uB85D \uC911 \xB7 ${t.tableCount}\uD0C1 ${t.participantCount}\uBA85. ${t.blockedReason ?? (room.organizer ? "\uBA85\uB2E8\uC744 \uD655\uC815\uD558\uBA74 \uBAA8\uB4E0 \uD0C1\uC774 \uC2DC\uC791\uD558\uBA70 \uCD94\uAC00 \uCC38\uAC00\uAC00 \uB9C8\uAC10\uB429\uB2C8\uB2E4." : "\uCD5C\uCD08 \uBC29\uC7A5\uC758 \uB300\uD68C \uC2DC\uC791\uC744 \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC2B5\uB2C8\uB2E4.")}` : t.status === "final" ? "\uC804\uD0C1 \uB300\uD68C \uC885\uB8CC \xB7 \uCD5C\uC885 \uC131\uC801\uC774 \uD655\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4." : "\uB300\uD68C \uC9C4\uD589 \uC911 \xB7 \uCC38\uAC00 \uB4F1\uB85D \uB9C8\uAC10. \uC804\uD0C1 \uC885\uB8CC \uD6C4 \uC131\uC801\uC744 \uC790\uB3D9 \uD655\uC815\uD569\uB2C8\uB2E4." : "\uC774\uC804 \uB300\uD68C \xB7 \uAE30\uC874 \uD14C\uC774\uBE14\uBCC4 \uC2DC\uC791 \uBC29\uC2DD\uC744 \uC720\uC9C0\uD569\uB2C8\uB2E4.";
}
function render() {
  syncGameLayout();
  const online = S.mode === "online";
  $("connection").replaceChildren(textNode("i", ""), textNode("span", online ? S.online ? `\uC628\uB77C\uC778 \xB7 \uD14C\uC774\uBE14 ${S.online.tableId}${S.online.aiPolicy === "mortal" ? " \xB7 Mortal" : ""}` : "\uC628\uB77C\uC778 \uC900\uBE44" : S.practice?.aiPolicy === "mortal" ? S.practiceError || "Mortal \uC5F0\uC2B5" : "\uB85C\uCEEC \uC5F0\uC2B5"));
  $("connection").classList.remove("error");
  ruleSummary();
  renderAIOptions();
  renderRoom();
  renderTable();
  renderHand();
  renderActions();
  const boardKey = S.view ? online ? `${S.server}:${S.online.code}:${S.online.tableId}:${progress().handId}:${S.view.seat}` : `practice:${S.practice.seed}:${progress().handId}:${S.view.seat}:${S.gameEpoch}` : null;
  const state = feedbackTracker.update(S.view, boardKey);
  if (state.newBoard) {
    clearTimeout(S.resultTimer);
    S.endRevealAt = 0;
  }
  const result = feedback.update({ view: S.view, ...state });
  if (result?.winDelayMs > 0 && S.view?.phase === "end") {
    S.endRevealAt = Date.now() + result.winDelayMs;
    clearTimeout(S.resultTimer);
    S.resultTimer = setTimeout(() => {
      S.endRevealAt = 0;
      renderEnd();
    }, result.winDelayMs);
  }
  renderEnd();
  renderComparison();
  $("open-current-replay").disabled = openingReplay || S.view?.phase !== "end";
  $("game-footnote").textContent = online ? "\uB300\uD68C\uB294 \uC0DD\uC131 \uD6C4 6\uC2DC\uAC04 \uC720\uC9C0\uB429\uB2C8\uB2E4. \uC644\uB8CC\uD55C \uAD6D\uC740 \uD328\uBCF4\uC2E4\uC5D0\uC11C \uB2E4\uC2DC \uBCFC \uC218 \uC788\uC2B5\uB2C8\uB2E4." : S.practice?.aiPolicy === "mortal" ? "Mortal \uC5F0\uC2B5\uC740 \uC11C\uBC84 \uC5F0\uACB0\uC774 \uD544\uC694\uD569\uB2C8\uB2E4. \uAC19\uC740 \uD0ED\uC5D0\uC11C \uC0C8\uB85C\uACE0\uCE68\uD558\uBA74 \uC9C4\uD589\uC744 \uBCF5\uC6D0\uD569\uB2C8\uB2E4." : "\uC644\uB8CC\uD55C \uAD6D\uC740 \uD328\uBCF4\uC2E4\uC5D0 \uC800\uC7A5\uB429\uB2C8\uB2E4. \uD328\uB97C \uB450 \uBC88 \uB204\uB974\uAC70\uB098 \uC120\uD0DD \uD6C4 \uBC84\uB9AC\uC138\uC694. \u2190 \u2192 / Enter / Esc \uC9C0\uC6D0.";
}
async function request(path = "", body = null, authenticated = true) {
  const headers = { "Content-Type": "application/json" };
  const account = body !== null && (path === "" || /\/join$/.test(path)) ? accountSession() : null;
  if (account) headers["X-Duplicate-Account-Token"] = account.token;
  if (authenticated && S.credentials) headers.Authorization = `Bearer ${S.credentials.key}`;
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15e3);
  try {
    const response = await fetch(`${S.server}/api/duplicate/competitions${path}`, { method: body === null ? "GET" : "POST", headers, body: body === null ? void 0 : JSON.stringify(body), signal: controller.signal });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("\uC11C\uBC84 \uC751\uB2F5\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
    }
    if (!response.ok) throw new Error(result.error ?? "\uC694\uCCAD\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
    return result;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("\uC11C\uBC84 \uC751\uB2F5\uC774 \uB2A6\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694.");
    if (error instanceof TypeError) throw new Error("\uC628\uB77C\uC778 \uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
function applyRoomState(state) {
  if (!S.credentials || state.code !== S.credentials.code || state.tableId !== S.credentials.tableId) return;
  if (S.online?.code === state.code && S.online.tableId === state.tableId && state.revision < S.online.revision) return;
  const changed = !S.online || S.online.revision !== state.revision || S.online.board !== state.board || S.online.phase !== state.phase, replayHandChanged = !S.online || S.online.handId !== state.handId || S.online.board !== state.board;
  S.online = state;
  $("online-code").value = state.code;
  if (state.game?.phase === "end") archiveEndedReplay("online");
  if (replayHandChanged || state.game?.phase === "end" && changed) void archiveRemoteHistory("online", state);
  if (S.mode !== "online") return;
  S.view = state.game;
  if (changed) {
    S.selected = null;
    S.riichiSelecting = false;
  }
  render();
  scheduleOnlineAuto();
}
async function connectRoom(create) {
  if (S.busy || S.credentials) return;
  const name = accountSession()?.user.nickname ?? $("online-name").value.trim();
  if (!name) {
    toast("\uD50C\uB808\uC774\uC5B4 \uC774\uB984\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
    $("online-name").focus();
    return;
  }
  const code = $("online-code").value.toUpperCase().trim();
  if (!create && !/^[A-Z2-9]{8}$/.test(code)) {
    toast("8\uC790\uB9AC \uB300\uD68C \uCF54\uB4DC\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
    return;
  }
  S.busy = true;
  renderRoom();
  try {
    const state = await request(create ? "" : `/${code}/join`, create ? { name, rules: S.roomRules, duplicateProfile: S.roomDuplicateProfile, scoring: S.roomScoring, matchRules: S.roomMatchRules, boardCount: matchBoardCount(S.roomMatchRules), aiPolicy: S.roomAI } : { name }, false);
    S.credentials = { code: state.code, key: state.key, seat: state.seat, tableId: state.tableId, server: S.server };
    writeStorage(sessionStorage, "duplicate.room.v1", S.credentials);
    writeStorage(localStorage, "duplicate.name", name);
    $("online-code").value = state.code;
    S.endKey = null;
    applyRoomState(state);
    schedulePoll();
    toast(create ? "\uB300\uD68C\uB97C \uB9CC\uB4E4\uC5C8\uC2B5\uB2C8\uB2E4. \uCF54\uB4DC\uB97C \uACF5\uC720\uD574 \uC8FC\uC138\uC694." : "\uB300\uD68C\uC5D0 \uCC38\uAC00\uD588\uC2B5\uB2C8\uB2E4.");
  } catch (error) {
    toast(error.message);
  } finally {
    S.busy = false;
    renderRoom();
    renderHand();
    renderActions();
  }
}
function schedulePoll() {
  clearTimeout(S.poll);
  if (S.credentials) S.poll = setTimeout(pollRoom, 1200);
}
async function pollRoom() {
  const credentials = S.credentials;
  if (!credentials) return;
  try {
    const state = await request(`/${credentials.code}/state`);
    if (S.credentials !== credentials) return;
    applyRoomState(state);
  } catch (error) {
    if (S.credentials !== credentials) return;
    if (S.mode === "online") {
      $("connection").classList.add("error");
      $("connection").lastChild.textContent = "\uC5F0\uACB0 \uC7AC\uC2DC\uB3C4 \uC911";
    }
    if (/만료|찾을 수|접속키|인증/.test(error.message)) {
      toast(error.message);
      leaveRoom(false);
      return;
    }
  } finally {
    schedulePoll();
  }
}
function scheduleOnlineAuto() {
  clearPlayTimer();
  if (S.mode !== "online" || S.busy || !S.view || S.view.phase === "end" || S.view.actor !== S.view.seat) return;
  const action = automaticPlayerAction(S.view, { autoWin: S.autoWin });
  if (action) S.timer = setTimeout(() => play(action), action.type === "discard" ? PRACTICE_AI_DELAY_MS : action.type === "pass" ? 0 : 450);
}
async function roomOperation(operation) {
  if (S.busy || !S.online) return;
  S.busy = true;
  renderRoom();
  renderActions();
  try {
    const state = await request(`/${S.credentials.code}/${operation}`, { revision: S.online.revision, actionId: crypto.randomUUID() });
    S.endHidden = false;
    S.endKey = null;
    applyRoomState(state);
  } catch (error) {
    toast(error.message);
    await pollRoom();
  } finally {
    S.busy = false;
    renderRoom();
    renderHand();
    renderActions();
    scheduleOnlineAuto();
  }
}
function leaveRoom(showToast = true) {
  clearTimeout(S.poll);
  clearPlayTimer();
  S.credentials = null;
  S.online = null;
  try {
    sessionStorage.removeItem("duplicate.room.v1");
  } catch {
  }
  S.view = null;
  render();
  if (showToast) toast("\uC774 \uD0ED\uC758 \uB300\uD68C \uC5F0\uACB0\uC744 \uC885\uB8CC\uD588\uC2B5\uB2C8\uB2E4. \uC0C8\uB85C \uCC38\uAC00\uD558\uBA74 \uB2E4\uB978 \uC790\uB9AC\uC5D0 \uBC30\uC815\uB429\uB2C8\uB2E4.");
}
async function advance() {
  if (S.mode === "online") {
    if (hasNext() && S.online.host) await roomOperation("next");
    return;
  }
  if (S.busy || !await savePracticeReplayBeforeReset()) return;
  if (!hasNext()) {
    $("practice-seed").value = String(randomSeed());
    newPractice();
    return;
  }
  if (S.practice.aiPolicy === "mortal") {
    await privateOperation("next");
    return;
  }
  const p = S.practice;
  if (!advancePracticeSeries(p)) return;
  S.endKey = null;
  S.endHidden = false;
  S.selected = null;
  S.riichiSelecting = false;
  afterPracticeStep();
}
function openRules(context3 = S.mode === "online" ? "room" : "practice", create = false) {
  S.ruleContext = context3;
  S.ruleReadOnly = context3 === "room" && !!S.online;
  S.creatingRoom = create && !S.ruleReadOnly;
  const rules = S.ruleReadOnly ? S.online.rules : context3 === "room" ? S.roomRules : S.settings;
  $("rule-duplicateProfile").value = S.ruleReadOnly ? S.online.duplicateProfile ?? "custom" : context3 === "room" ? S.roomDuplicateProfile : S.practiceDuplicateProfile;
  for (const [key] of switchDefinitions) $(`rule-${key}`).checked = rules[key];
  $("rule-exhaustLimit").value = rules.exhaustLimit;
  $("rule-multipleRon").value = rules.multipleRon;
  $("rule-startingPoints").value = rules.startingPoints;
  const match = S.ruleReadOnly ? S.online.matchRules : context3 === "room" ? S.roomMatchRules : { ...S.practiceMatchRules, format: $("practice-count").value };
  const format2 = $("rule-format");
  format2.querySelector("option[value=legacy]")?.remove();
  if (S.ruleReadOnly && !match) {
    const option = textNode("option", `\uAE30\uC874 ${S.online.boardCount}\uAD6D \xB7 \uB3C5\uB9BD \uC9C4\uD589`);
    option.value = "legacy";
    format2.append(option);
  }
  format2.value = match?.format ?? "legacy";
  $("rule-dealerContinuation").checked = match?.dealerContinuation ?? false;
  $("rule-agariYame").checked = match?.agariYame ?? false;
  $("rule-match-note").textContent = S.ruleReadOnly && !match ? "\uC774 \uB300\uD68C\uB294 \uC774\uC804 \uB3C5\uB9BD \uB300\uAD6D \uBC29\uC2DD\uC73C\uB85C \uACC4\uC18D \uC9C4\uD589\uD569\uB2C8\uB2E4." : "\uAE30\uBCF8\uAD6D\uC740 \uB3D9\uD48D\uC804 4\uAD6D, \uBC18\uC7A5\uC804 8\uAD6D\uC785\uB2C8\uB2E4. \uB9C8\uC9C0\uB9C9 \uAD6D\uB3C4 \uCE5C \uC5F0\uC7A5 \uC870\uAC74\uC744 \uD655\uC778\uD569\uB2C8\uB2E4.";
  const scoring = normalizeScoring((S.ruleReadOnly ? S.online.scoring : S.roomScoring) ?? {});
  $("rule-scoring-method").value = scoring.method;
  $("rule-scoring-unit").value = String(scoring.impUnit);
  $("rule-scoring-fields").hidden = context3 !== "room";
  $("rule-aiPolicy").value = S.ruleReadOnly ? S.online.aiPolicy ?? "simple" : S.roomAI;
  $("rule-aiPolicy-field").hidden = context3 !== "room";
  $("rules-dialog-title").textContent = S.ruleReadOnly ? "\uC774 \uBC29\uC758 \uB300\uAD6D \uADDC\uCE59" : create ? "\uB300\uD68C \uB9CC\uB4E4\uAE30" : context3 === "room" ? "\uC0C8 \uB300\uD68C \uADDC\uCE59" : "\uC5F0\uC2B5 \uADDC\uCE59";
  $("rules-dialog-note").textContent = S.ruleReadOnly ? "\uBC29\uC744 \uB9CC\uB4E4 \uB54C \uD655\uC815\uD55C \uACF5\uD1B5 \uADDC\uCE59\uC785\uB2C8\uB2E4. \uCC38\uAC00\uC790\uB294 \uBCC0\uACBD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." : context3 === "room" ? "\uC774 \uB300\uD68C\uC758 \uBAA8\uB4E0 \uD14C\uC774\uBE14\uC5D0 \uAC19\uC740 \uADDC\uCE59\uC744 \uC801\uC6A9\uD569\uB2C8\uB2E4. \uAC1C\uC778 \uD654\uBA74\xB7\uC54C\uB9BC \uC124\uC815\uACFC \uBCC4\uB3C4\uB85C \uC800\uC7A5\uD569\uB2C8\uB2E4." : "\uB2E4\uC74C \uC0C8 \uC5F0\uC2B5\uBD80\uD130 \uC801\uC6A9\uB429\uB2C8\uB2E4. \uC628\uB77C\uC778 \uB300\uD68C\uC758 \uADDC\uCE59\uC740 \uB530\uB85C \uC124\uC815\uD569\uB2C8\uB2E4.";
  $("rules-dialog").classList.toggle("rules-readonly", S.ruleReadOnly);
  for (const input of $("rules-dialog").querySelectorAll('#rule-switches input,[id^="rule-"]')) input.disabled = S.ruleReadOnly;
  updateProfileControls();
  for (const id of ["preset-standard", "preset-no-dora", "preset-mil-riichi"]) $(id).disabled = S.ruleReadOnly;
  $("rule-format-field").hidden = false;
  $("create-room-name-field").hidden = !S.creatingRoom;
  $("create-room-name").value = accountSession()?.user.nickname ?? $("online-name").value;
  $("create-room-name").readOnly = !!accountSession();
  $("rules-save").hidden = S.ruleReadOnly;
  $("rules-save").textContent = S.creatingRoom ? "\uC774 \uADDC\uCE59\uC73C\uB85C \uB300\uD68C \uB9CC\uB4E4\uAE30" : context3 === "room" ? "\uB300\uD68C \uADDC\uCE59 \uC800\uC7A5" : "\uC5F0\uC2B5 \uADDC\uCE59 \uC800\uC7A5";
  $("rules-dialog").showModal();
}
function updateWallQuota() {
  const rules = {};
  for (const key of ["dora", "kanDora", "uraDora", "deadWall"]) rules[key] = $(`rule-${key}`).checked;
  const left = 84 - reservedTileCount(rules), quotas = Array.from({ length: 4 }, (_, seat5) => Math.floor(left / 4) + (seat5 < left % 4 ? 1 : 0));
  $("rule-wall-quota").textContent = `\uBC30\uD328 \uAC01 13\uC7A5 + \uAC1C\uC778 \uD328\uC0B0 ${quotas.join(" / ")}\uC7A5 \xB7 \uCD5C\uCD08 \uC790\uB9AC 1\xB72\xB73\xB74 \uC21C\uC11C, \uCE5C \uCCAB \uCBD4\uBAA8 \uD3EC\uD568`;
}
function updateProfileControls() {
  const profile = $("rule-duplicateProfile").value, mil = profile === "mil", progression = usesMilProgression(profile);
  $("rule-exhaustLimit").querySelector('option[value="1"]').textContent = progression ? "\uD558\uAC00 \uC18C\uC9C4 \uD6C4 \uB9C8\uC9C0\uB9C9 \uCC28\uB840 \xB7 MIL" : "1\uBA85 \uC18C\uC9C4";
  if (mil) {
    for (const key of ["dora", "kanDora", "uraDora", "redDora", "deadWall", "abortFourKans"]) $(`rule-${key}`).checked = false;
    $("rule-multipleRon").value = "all";
  }
  if (progression) $("rule-exhaustLimit").value = 1;
  for (const key of milFixed) $(`rule-${key}`).disabled = S.ruleReadOnly || mil || progression && key === "exhaustLimit";
  $("rule-duplicateProfile").disabled = S.ruleReadOnly;
  $("rule-profile-custom").hidden = !progression || S.ruleReadOnly;
  updateWallQuota();
  $("rule-profile-note").textContent = mil ? "MIL \uC6D0\uD615: \uAF43 \uC5C6\uC774 136\uC7A5, \uAC01\uC790 \uBC30\uD328 13\uC7A5\uACFC \uAC1C\uC778 \uD328\uC0B0 21\uC7A5. \uB3C4\uB77C\xB7\uC655\uD328\xB7\uC0AC\uAE61\uC0B0\uB8CC\uB294 \uC5C6\uACE0 \uBCF5\uC218 \uB860\uC744 \uBAA8\uB450 \uC778\uC815\uD569\uB2C8\uB2E4. \uD558\uAC00\uC758 \uC0B0 \uC18C\uC9C4\uC744 \uAE30\uC900\uC73C\uB85C \uB9C8\uC9C0\uB9C9 \uCC28\uB840\uB97C \uD310\uC815\uD569\uB2C8\uB2E4." : profile === "mil-riichi" ? "\uAE30\uBCF8 \uC124\uC815: \uB3C4\uB77C\xB7\uAE61\uB3C4\uB77C\xB7\uC6B0\uB77C\uB3C4\uB77C\xB7\uC801\uB3C4\uB77C ON, \uC655\uD328 OFF. \uD45C\uC2DC\uD328\uB9CC \uC608\uC57D\uD574 \uAC1C\uC778 \uD328\uC0B0\uC740 19 / 19 / 18 / 18\uC7A5\uC785\uB2C8\uB2E4. \uC544\uB798 \uC635\uC158\uC744 \uBCC0\uACBD\uD560 \uC218 \uC788\uC73C\uBA70 \uD558\uAC00\uC758 \uC0B0 \uC18C\uC9C4\uC744 \uAE30\uC900\uC73C\uB85C \uB9C8\uC9C0\uB9C9 \uCC28\uB840\uB97C \uD310\uC815\uD569\uB2C8\uB2E4. MIL \uC9C4\uD589\uC5D0 \uB9AC\uCE58 \uC635\uC158\uC744 \uB354\uD55C \uBCC0\uD615\uC785\uB2C8\uB2E4." : "\uC655\uD328\xB7\uB3C4\uB77C\uC640 n\uBA85 \uD328\uC0B0 \uC18C\uC9C4 \uC720\uAD6D\uC744 \uC9C1\uC811 \uC124\uC815\uD569\uB2C8\uB2E4. MIL\uC758 \uD558\uAC00 \uD328\uC0B0 \uAE30\uC900 \uC885\uB8CC \uC870\uAC74\uACFC \uAD6C\uBD84\uB429\uB2C8\uB2E4.";
}
function fillPreset(profile = "mil-riichi") {
  const rules = normalizeProfileRules({}, profile);
  $("rule-duplicateProfile").value = profile;
  for (const [key] of switchDefinitions) $(`rule-${key}`).checked = rules[key];
  $("rule-exhaustLimit").value = rules.exhaustLimit;
  $("rule-multipleRon").value = rules.multipleRon;
  $("rule-startingPoints").value = rules.startingPoints;
  $("rule-dealerContinuation").checked = true;
  $("rule-agariYame").checked = false;
  const scoring = normalizeNewCompetitionScoring({}, profile);
  $("rule-scoring-method").value = scoring.method;
  $("rule-scoring-unit").value = String(scoring.impUnit);
  updateProfileControls();
}
function saveRules() {
  if (S.ruleReadOnly || S.busy) return;
  try {
    if (S.creatingRoom && !$("create-room-name").value.trim()) {
      $("create-room-name").focus();
      toast("\uBC29\uC7A5 \uC774\uB984\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
      return;
    }
    const raw = { ...DEFAULT_RULES2 };
    for (const [key] of switchDefinitions) raw[key] = $(`rule-${key}`).checked;
    raw.exhaustLimit = Number($("rule-exhaustLimit").value);
    raw.multipleRon = $("rule-multipleRon").value;
    raw.startingPoints = Number($("rule-startingPoints").value);
    if (raw.startingPoints > 1e5) throw new Error("\uC2DC\uC791 \uC810\uC218\uB294 100,000\uC810 \uC774\uD558\uB85C \uC124\uC815\uD574 \uC8FC\uC138\uC694.");
    const duplicateProfile = normalizeDuplicateProfile($("rule-duplicateProfile").value), rules = normalizeProfileRules(raw, duplicateProfile), matchRules = normalizeMatchRules({ format: $("rule-format").value, dealerContinuation: $("rule-dealerContinuation").checked, agariYame: $("rule-agariYame").checked });
    if (S.ruleContext === "room") {
      S.roomScoring = normalizeScoring({ method: $("rule-scoring-method").value, impUnit: Number($("rule-scoring-unit").value) });
      S.roomRules = rules;
      S.roomDuplicateProfile = duplicateProfile;
      S.roomMatchRules = matchRules;
      S.boardCount = matchBoardCount(matchRules);
      S.roomAI = $("rule-aiPolicy").value;
      if (S.creatingRoom && S.roomAI === "mortal" && !S.aiCapabilities?.policies?.find((p) => p.id === "mortal")?.available) throw new Error("Mortal \uC5F0\uACB0\uC744 \uD655\uC778\uD55C \uB4A4 \uB300\uD68C\uB97C \uB9CC\uB4E4\uC5B4 \uC8FC\uC138\uC694.");
      writeStorage(localStorage, "duplicate.room-rules.v1", { rules: S.roomRules, duplicateProfile: S.roomDuplicateProfile, scoring: S.roomScoring, matchRules: S.roomMatchRules, boardCount: S.boardCount, aiPolicy: S.roomAI });
    } else {
      S.settings = rules;
      S.practiceDuplicateProfile = duplicateProfile;
      S.practiceMatchRules = matchRules;
      $("practice-count").value = matchRules.format;
      writeStorage(localStorage, "duplicate.settings.v1", { rules: S.settings, duplicateProfile: S.practiceDuplicateProfile, matchRules });
    }
    const create = S.creatingRoom;
    if (create) $("online-name").value = $("create-room-name").value.trim();
    $("rules-dialog").close();
    ruleSummary();
    if (create) connectRoom(true);
    else toast(S.ruleContext === "room" ? "\uC0C8 \uB300\uD68C\uC758 \uADDC\uCE59\uC744 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4." : "\uB2E4\uC74C \uC0C8 \uC5F0\uC2B5\uC5D0 \uC801\uC6A9\uD560 \uADDC\uCE59\uC744 \uC800\uC7A5\uD588\uC2B5\uB2C8\uB2E4.");
  } catch (error) {
    toast(error.message);
  }
}
function showStandings() {
  const box = $("standings-table");
  box.replaceChildren();
  const modern = S.online?.tournament?.version === 1, rows = modern ? finalRows(S.online) : S.online?.standings ?? [];
  if (modern && S.online.tournament.status !== "final") {
    box.append(textNode("p", "\uBAA8\uB4E0 \uD0C1\uC758 \uC885\uB8CC\uC640 \uC131\uC801 \uD655\uC815\uC744 \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC2B5\uB2C8\uB2E4."));
    $("standings-dialog").showModal();
    return;
  }
  $("standings-note").textContent = modern ? "\uD655\uC815 \uC131\uC801 \xB7 \uAC19\uC740 \uCD5C\uCD08 \uC790\uB9AC\uB07C\uB9AC \uBCF8\uC7A5\uC744 \uD3EC\uD568\uD55C \uAD6D\uBCC4 \uC810\uC218 \uC99D\uAC10\uC744 \uBE44\uAD50\uD569\uB2C8\uB2E4. \uC0AC\uB78C\uACFC AI\uB294 \uBCC4\uB3C4 \uC21C\uC704\uC774\uBA70 \uD45C\uBCF8 2\uBA85 \uBBF8\uB9CC\uC740 \uD3C9\uADE0 \uB300\uBE44\xB7IMP\xB7\uC21C\uC704 \uC5C6\uC74C\uC785\uB2C8\uB2E4. IMP\uB294 \uC774 \uC571\uC758 \uB9AC\uCE58\uC6A9 \uD658\uC0B0\uC785\uB2C8\uB2E4." : "\uC774\uC804 \uB300\uD68C \xB7 \uAC19\uC740 \uBC30\uD328\xB7\uC810\uC218 \uB9E5\uB77D\uC758 \uC644\uB8CC \uACB0\uACFC\uB97C \uBE44\uAD50\uD569\uB2C8\uB2E4.";
  const table = document.createElement("table");
  table.className = "standings";
  const head = document.createElement("thead"), row = document.createElement("tr");
  for (const label of modern ? ["\uC21C\uC704", "\uC774\uB984", "\uAD6C\uBD84", "\uCD5C\uCD08 \uC790\uB9AC", "\uC810\uC218 \uC99D\uAC10", "\uC6D0\uC810\uC218 \uD3C9\uADE0 \uB300\uBE44", "IMP", "\uD45C\uBCF8"] : ["\uC774\uB984", "\uAD6C\uBD84", "\uC644\uB8CC", "\uC810\uC218 \uD569\uACC4", "\uD3C9\uADE0 \uB300\uBE44"]) row.append(textNode("th", label));
  head.append(row);
  table.append(head);
  const body = document.createElement("tbody");
  for (const p of rows) {
    const r = document.createElement("tr"), values = modern ? [p.rank ?? "\u2014", p.name, p.ai ? "AI" : "\uC0AC\uB78C", winds2[p.seat], signed(p.score), signed(p.difference), signed(p.imp), p.samples] : [p.name, p.ai ? "AI" : "\uC0AC\uB78C", `${p.completedBoards}\uAD6D`, signed(p.score), signed(p.difference)];
    for (const value of values) r.append(textNode("td", value));
    body.append(r);
  }
  table.append(body);
  box.append(table);
  $("standings-dialog").showModal();
}
function mountIMPTable() {
  const table = $("imp-scale-table"), head = document.createElement("thead"), tr = document.createElement("tr");
  for (const label of ["\uD658\uC0B0\xB7\uBC18\uC62C\uB9BC\uD55C \uCC28\uC774\uC758 \uC808\uB313\uAC12", "IMP"]) tr.append(textNode("th", label));
  head.append(tr);
  table.append(head);
  const body = document.createElement("tbody");
  for (let imp = 0; imp <= IMP_THRESHOLDS.length; imp++) {
    const from = imp === 0 ? 0 : IMP_THRESHOLDS[imp - 1], to = IMP_THRESHOLDS[imp] - 1, row = document.createElement("tr");
    row.append(textNode("td", Number.isFinite(to) ? `${from}\u2013${to}` : `${from} \uC774\uC0C1`), textNode("td", String(imp)));
    body.append(row);
  }
  table.append(body);
  $("imp-scale-source").href = IMP_SCALE_SOURCE_URL;
}
function exportResult() {
  const record = S.mode === "practice" ? { format: "duplicate-practice-v1", createdAt: (/* @__PURE__ */ new Date()).toISOString(), seed: S.practice.seed, seat: S.practice.seat, rules: S.practice.game.rules, duplicateProfile: S.practice.duplicateProfile, matchRules: S.practice.matchRules, progress: progress(), aiPolicy: S.practice.aiPolicy ?? "simple", modelSha256: S.practiceRemote?.aiModelSha256 ?? null, results: S.practice.results, game: S.practice.aiPolicy === "mortal" ? S.practiceRemote?.game ?? null : S.practice.game } : { format: "duplicate-online-result-v1", createdAt: (/* @__PURE__ */ new Date()).toISOString(), code: S.online?.code, tableId: S.online?.tableId, seat: S.online?.seat, rules: S.online?.rules, duplicateProfile: S.online?.duplicateProfile, scoring: S.online?.scoring, tournament: S.online?.tournament, matchRules: S.online?.matchRules, progress: progress(), comparison: S.online?.comparison, standings: S.online?.standings, game: S.view };
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" })), a = document.createElement("a");
  a.href = url;
  a.download = `duplicate-${S.mode}-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
mountIMPTable();
for (const [key, title, description] of switchDefinitions) {
  const row = document.createElement("label");
  row.className = "switch-row";
  const words = document.createElement("span");
  words.append(textNode("strong", title), textNode("small", description));
  const input = document.createElement("input");
  input.type = "checkbox";
  input.id = `rule-${key}`;
  input.setAttribute("aria-label", title);
  row.append(words, input);
  $("rule-switches").append(row);
}
$("practice-tab").onclick = () => setMode("practice");
$("online-tab").onclick = () => setMode("online");
$("settings-tab").onclick = openPersonalSettings;
$("settings-open").onclick = openPersonalSettings;
$("practice-new").onclick = newPractice;
$("random-seed").onclick = () => $("practice-seed").value = String(randomSeed());
$("practice-rules-open").onclick = () => openRules("practice");
$("room-rules-open").onclick = () => openRules("room");
$("rules-open-second").onclick = () => openRules();
$("help-open").onclick = () => $("help-dialog").showModal();
$("rules-save").onclick = saveRules;
$("rule-duplicateProfile").onchange = () => {
  if ($("rule-duplicateProfile").value === "mil-riichi") {
    const rules = normalizeProfileRules({}, "mil-riichi");
    for (const [key] of switchDefinitions) $(`rule-${key}`).checked = rules[key];
    $("rule-multipleRon").value = rules.multipleRon;
    $("rule-scoring-method").value = "imp";
  }
  updateProfileControls();
};
$("rule-profile-custom").onclick = () => {
  $("rule-duplicateProfile").value = "custom";
  updateProfileControls();
};
for (const key of ["dora", "kanDora", "uraDora", "deadWall"]) $(`rule-${key}`).onchange = updateWallQuota;
$("preset-standard").onclick = () => fillPreset("custom");
$("preset-no-dora").onclick = () => fillPreset("mil");
$("preset-mil-riichi").onclick = () => fillPreset("mil-riichi");
$("online-create").onclick = () => openRules("room", true);
$("online-join").onclick = () => connectRoom(false);
$("start-ai").onclick = () => roomOperation("start-ai");
$("start-tournament").onclick = () => roomOperation("start");
$("leave-room").onclick = () => leaveRoom();
$("next-board").onclick = advance;
$("dismiss-result").onclick = () => {
  S.endHidden = true;
  renderEnd();
};
$("resume-result").onclick = () => {
  S.endHidden = false;
  S.endRevealAt = 0;
  renderEnd();
};
$("export-result").onclick = exportResult;
$("standings-open").onclick = showStandings;
$("copy-invite").onclick = async () => {
  const url = new URL(location.href);
  url.search = "";
  url.searchParams.set("code", S.online.code);
  if (S.server !== DEFAULT_SERVER) url.searchParams.set("server", S.server);
  try {
    await navigator.clipboard.writeText(url.href);
    toast("\uCD08\uB300 \uB9C1\uD06C\uB97C \uBCF5\uC0AC\uD588\uC2B5\uB2C8\uB2E4.");
  } catch {
    toast(`\uCD08\uB300 \uCF54\uB4DC: ${S.online.code}`);
  }
};
$("auto-win").onchange = () => applyPreferences({ ...S.preferences, autoWin: $("auto-win").checked });
$("practice-ai").onchange = () => {
  writeStorage(localStorage, "duplicate.practice-ai.v1", $("practice-ai").value);
  renderAIOptions();
};
$("ai-refresh").onclick = refreshAICapabilities;
$("practice-disconnect").onclick = () => {
  remotePractice.clear();
  S.practiceRemote = null;
  S.practiceError = "Mortal \uC5F0\uC2B5\uC744 \uC0C8\uB85C \uC2DC\uC791\uD574 \uC8FC\uC138\uC694.";
  if (S.mode === "practice" && S.practice.aiPolicy === "mortal") S.view = null;
  render();
};
$("open-current-replay").onclick = openCurrentReplay;
$("game-view-toggle").onclick = () => {
  S.largeBoard = !document.body.classList.contains("game-focus");
  showPanel(S.mode);
  render();
  const target = S.largeBoard ? $("game-view-toggle").closest(".game-column") : $(`${S.mode}-panel`);
  target.scrollIntoView({ block: "start", behavior: "auto" });
};
$("online-code").oninput = () => {
  $("online-code").value = $("online-code").value.toUpperCase().replace(/[^A-Z2-9]/g, "");
};
document.addEventListener("keydown", (event3) => {
  if (document.querySelector("dialog[open]") || ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  if (event3.key === "Escape") {
    S.selected = null;
    S.riichiSelecting = false;
    renderHand();
    renderActions();
    return;
  }
  const legal = orderedHandActions(S.view, S.riichiSelecting ? "riichi" : "discard");
  if (!legal.length) return;
  if (["ArrowLeft", "ArrowRight"].includes(event3.key)) {
    event3.preventDefault();
    const index = legal.findIndex((a) => a.id === S.selected), next = index < 0 ? event3.key === "ArrowLeft" ? legal.length - 1 : 0 : (index + (event3.key === "ArrowRight" ? 1 : -1) + legal.length) % legal.length;
    S.selected = legal[next].id;
    renderHand();
    renderActions();
    $("hand").querySelector(`[data-id="${S.selected}"]`)?.focus();
  }
  if (event3.key === "Enter" && document.activeElement.tagName !== "BUTTON") {
    event3.preventDefault();
    const action = legal.find((a) => a.id === S.selected);
    if (action) play(action);
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    if (S.credentials) pollRoom();
    if (S.mode === "practice" && S.practice?.aiPolicy === "mortal") remotePractice.activate();
    void refreshAICapabilities();
  }
});
window.addEventListener("beforeunload", savePractice);
document.addEventListener("pointerdown", () => {
  void feedback.unlock();
}, { passive: true });
document.addEventListener("keydown", () => {
  void feedback.unlock();
}, { passive: true });
var storedSettings = readStorage(localStorage, "duplicate.settings.v1");
try {
  S.practiceDuplicateProfile = normalizeDuplicateProfile(storedSettings?.duplicateProfile ?? "mil-riichi");
  S.settings = setupRules(storedSettings?.rules ?? {}, S.practiceDuplicateProfile);
} catch {
  S.practiceDuplicateProfile = "mil-riichi";
  S.settings = setupRules();
}
try {
  S.practiceMatchRules = normalizeMatchRules(storedSettings?.matchRules ?? {});
} catch {
  S.practiceMatchRules = normalizeMatchRules();
}
var storedRoomRules = readStorage(localStorage, "duplicate.room-rules.v1");
try {
  S.roomDuplicateProfile = normalizeDuplicateProfile(storedRoomRules?.duplicateProfile ?? "mil-riichi");
  S.roomRules = setupRules(storedRoomRules?.rules ?? {}, S.roomDuplicateProfile);
  S.roomMatchRules = normalizeMatchRules(storedRoomRules?.matchRules ?? {});
  S.boardCount = matchBoardCount(S.roomMatchRules);
} catch {
  S.roomDuplicateProfile = "mil-riichi";
  S.roomRules = setupRules();
  S.roomMatchRules = normalizeMatchRules();
  S.boardCount = 8;
}
try {
  S.roomScoring = normalizeNewCompetitionScoring(storedRoomRules?.scoring, S.roomDuplicateProfile);
} catch {
  S.roomScoring = normalizeNewCompetitionScoring({}, S.roomDuplicateProfile);
}
S.roomAI = storedRoomRules?.aiPolicy === "mortal" ? "mortal" : "simple";
S.preferences = loadPreferences(localStorage);
S.autoWin = S.preferences.autoWin;
$("auto-win").checked = S.autoWin;
personalSettingsUI = mountPersonalSettings($("settings-panel"), { value: S.preferences, onChange: applyPreferences, onPreview: () => feedback.preview(S.view ?? snapshot4(S.practice.game, S.practice.seat)) });
var saved = readStorage(localStorage, "duplicate.practice.v1");
try {
  S.practice = restorePracticeSeries(saved);
} catch {
  S.practice = null;
}
if (!S.practice) {
  S.practice = { ...createPracticeSeries({ seed: randomSeed(), seat: resolvePracticeSeat("random", randomSeed), matchRules: S.practiceMatchRules, rules: S.settings, duplicateProfile: S.practiceDuplicateProfile }), seatChoice: "random" };
  savePractice();
}
$("practice-seed").value = S.practice.seed;
$("practice-seat").value = ["random", "0", "1", "2", "3"].includes(String(S.practice.seatChoice)) ? String(S.practice.seatChoice) : "random";
$("practice-count").value = S.practice.matchRules?.format ?? S.practiceMatchRules.format;
$("online-name").value = readStorage(localStorage, "duplicate.name") ?? "";
$("practice-count").onchange = () => {
  S.practiceMatchRules = normalizeMatchRules({ ...S.practiceMatchRules, format: $("practice-count").value });
  writeStorage(localStorage, "duplicate.settings.v1", { rules: S.settings, duplicateProfile: S.practiceDuplicateProfile, matchRules: S.practiceMatchRules });
};
$("practice-ai").value = readStorage(localStorage, "duplicate.practice-ai.v1") ?? S.practice.aiPolicy ?? "simple";
function normalizeServer(value) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("http \uB610\uB294 https \uC11C\uBC84 \uC8FC\uC18C\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
  if (location.protocol === "https:" && url.protocol === "http:" && !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("\uACF5\uAC1C \uD398\uC774\uC9C0\uC5D0\uC11C\uB294 HTTPS \uC11C\uBC84 \uC8FC\uC18C\uB97C \uC0AC\uC6A9\uD574 \uC8FC\uC138\uC694.");
  return url.origin;
}
S.credentials = readStorage(sessionStorage, "duplicate.room.v1");
var parameters = new URL(location.href).searchParams;
var invite = parameters.get("code");
try {
  S.server = normalizeServer(S.credentials?.server ?? parameters.get("server") ?? readStorage(localStorage, "duplicate.server") ?? DEFAULT_SERVER);
} catch {
  S.server = DEFAULT_SERVER;
  S.credentials = null;
}
if (S.practice.aiPolicy === "mortal") {
  if (!remotePractice.restore(S.practice)) S.practiceError = "Mortal \uC5F0\uC2B5\uC744 \uC0C8\uB85C \uC2DC\uC791\uD574 \uC8FC\uC138\uC694.";
} else S.practice.aiPolicy = "simple";
$("server-base").value = S.server;
$("server-save").onclick = () => {
  if (S.credentials || remotePractice.connected) {
    toast("\uB300\uD68C \uB610\uB294 Mortal \uC5F0\uC2B5 \uC5F0\uACB0\uC744 \uC885\uB8CC\uD55C \uB4A4 \uC11C\uBC84\uB97C \uBC14\uAFD4 \uC8FC\uC138\uC694.");
    return;
  }
  try {
    S.server = normalizeServer($("server-base").value);
    $("server-base").value = S.server;
    writeStorage(localStorage, "duplicate.server", S.server);
    void refreshAICapabilities();
    toast("\uC628\uB77C\uC778 \uC11C\uBC84 \uC8FC\uC18C\uB97C \uC801\uC6A9\uD588\uC2B5\uB2C8\uB2E4.");
  } catch (error) {
    toast(error.message);
  }
};
if (invite && /^[A-Z2-9]{8}$/.test(invite)) {
  $("online-code").value = invite;
  S.mode = "online";
}
if (S.credentials) S.mode = "online";
S.view = S.mode === "practice" ? snapshot4(S.practice.game, S.practice.seat) : null;
setMode(S.mode);
if (S.credentials) schedulePoll();
if (S.practice.game.phase === "end" && !S.practice.results.some((r) => handId({ board: r.board ?? r.index + 1, honba: r.honba ?? 0 }) === seriesProgress(S.practice).handId)) finishPractice();
if (S.practice.aiPolicy !== "mortal" && S.practice.game.phase === "end") archiveEndedReplay("practice");
void refreshAICapabilities();
setInterval(() => {
  if (!document.hidden) void refreshAICapabilities();
}, 3e4);
if (parameters.get("create") === "1" && !S.credentials) {
  setMode("online");
  openRules("room", true);
}
