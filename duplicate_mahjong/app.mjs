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
function scoreRiichi(types, melds = [], context2 = {}, rules = {}) {
  const all = physicalTiles(types, melds);
  if (!all) return null;
  const ds = shapes(types, melds);
  if (!ds.length) return null;
  const winTile = context2.winTile ?? types.at(-1);
  if (!types.includes(winTile)) return null;
  const method = context2.method ?? "ron";
  if (!["ron", "tsumo"].includes(method)) return null;
  const c = counts(all), closed = melds.every((m) => !m.open);
  const suits = new Set(all.filter((t) => t < 27).map((t) => Math.floor(t / 9))), honors = all.some(isHonor);
  const seatWind = context2.seatWind ?? 27, roundWind = rules.roundWind ?? 27;
  const riichi = closed && !!(context2.riichi || context2.doubleRiichi);
  const dealer = context2.dealer ?? seatWind === 27;
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
    limit("tenhou", "\uCC9C\uD654", context2.tenhou && dealer && method === "tsumo" && !melds.length);
    limit("chiihou", "\uC9C0\uD654", context2.chiihou && !dealer && method === "tsumo" && !melds.length);
    add("doubleRiichi", "\uB354\uBE14 \uB9AC\uCE58", 2, riichi && context2.doubleRiichi);
    add("riichi", "\uB9AC\uCE58", 1, riichi && !context2.doubleRiichi);
    add("ippatsu", "\uC77C\uBC1C", 1, riichi && context2.ippatsu && !context2.rinshan);
    add("menzenTsumo", "\uBA58\uC820 \uCBD4\uBAA8", 1, closed && method === "tsumo");
    add("tanyao", "\uD0D5\uC57C\uC624", 1, (closed || rules.kuitan !== false) && all.every((t) => !isYao(t)));
    add("pinfu", "\uD551\uD6C4", 1, pinfu);
    add("sevenPairs", "\uCE60\uB300\uC790", 2, shape.kind === "sevenPairs");
    add("rinshan", "\uC601\uC0C1\uAC1C\uD654", 1, context2.rinshan && method === "tsumo");
    add("haitei", "\uD574\uC800\uB85C\uC6D4", 1, context2.lastTile && method === "tsumo" && !context2.rinshan);
    add("houtei", "\uD558\uC800\uB85C\uC5B4", 1, context2.lastTile && method === "ron" && !context2.chankan);
    add("chankan", "\uCC3D\uAE61", 1, context2.chankan && method === "ron");
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
    const indicatorHan = (indicators2) => indicators2.reduce((n, t) => n + c[doraAfter(t)], 0);
    const visible = context2.doraIndicators ?? [], ura = context2.uraIndicators ?? [];
    const enabledIndicators = (indicators2) => context2.indicatorsFiltered ? indicators2 : indicators2.filter((_, i) => i === 0 ? rules.dora !== false : rules.kanDora !== false);
    bonus("dora", "\uB3C4\uB77C", indicatorHan(enabledIndicators(visible)));
    const enabledUra = context2.indicatorsFiltered ? ura : ura.filter((_, i) => i === 0 || rules.kanDora !== false);
    bonus("uraDora", "\uC6B0\uB77C\uB3C4\uB77C", riichi && rules.uraDora !== false ? indicatorHan(enabledUra) : 0);
    bonus("redDora", "\uC801\uB3C4\uB77C", rules.redDora !== false ? Math.max(0, Math.floor(context2.redCount ?? 0)) : 0);
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
function completeKan(s, seat) {
  cancelIppatsu(s);
  s.kans++;
  s.calls++;
  event(s, { type: "kan", seat });
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
    const p2 = s.players[r.source], m = p2.melds[r.meld];
    m.ids.push(...remove(p2, [m.tile]));
    m.type = "kan";
    completeKan(s, r.source);
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
  event(s, { type: "call", seat, action: a, from: r.source });
  if (a.type === "minkan") completeKan(s, seat);
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
  event(s, { type: "action", seat, action: { ...a } });
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
    p.melds.push({ type: "kan", tile: a.tile, open: false, from: seat, ids: remove(p, Array(4).fill(a.tile)) });
    p.stats.closedKans++;
    completeKan(s, seat);
  } else if (a.type === "kakan") {
    cancelIppatsu(s);
    reaction(s, seat, p.hand.find((id) => typeOf(id) === p.melds[a.meld].tile), "kakan", { meld: a.meld });
  }
  if (validate) assertInvariants(s);
  return s;
}
var tileView = (id, s, drawn = null) => ({ id, type: typeOf(id), tile: typeOf(id), red: red(id, s.rules), drawn: id === drawn });
var meldView = (m, s) => ({ ...structuredClone(m), tiles: m.ids.map((id) => tileView(id, s)) });
function publicEvents(s) {
  const out = [], discards = Array(4).fill(null), pendingKan = Array(4).fill(null), melds = Array.from({ length: 4 }, () => []);
  const physical = (id) => Number.isInteger(id) && id >= 0 && id < 136 ? id : null;
  const preview = (seat, index, tile, callType) => {
    const count = ["ankan", "kakan", "minkan"].includes(callType) ? 4 : 3;
    const ids = s.players[seat]?.melds[index]?.ids?.slice(0, count);
    if (ids?.length === count) return ids.map((id) => ({ type: typeOf(id), red: red(id, s.rules) })).sort((a, b) => a.type - b.type);
    const types = callType === "chi" ? [tile, tile + 1, tile + 2] : Array(count).fill(tile);
    return types.filter((type) => Number.isInteger(type) && type >= 0 && type < 34).map((type) => ({ type, red: false }));
  };
  const emit = (raw, kind, { tile = null, tileId = null, source = null, callType = null, method = null, tiles } = {}) => {
    const id = physical(tileId), type = id === null ? tile : typeOf(id);
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
    const win2 = legal.find((a) => a.type === type);
    if (win2) return win2;
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
    const red2 = view.handTiles?.find((t) => t.id === a.id)?.red ? 1 : 0;
    rows.push({ a, d, score: -100 * d + ukeire - 12 * danger - 2 * dora - 2 * red2, danger });
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
function driveAI(s, humanSeats = [], maxSteps = 500) {
  if (!Array.isArray(humanSeats) || humanSeats.some((seat) => !Number.isInteger(seat) || seat < 0 || seat > 3) || !Number.isInteger(maxSteps) || maxSteps < 0 || maxSteps > 1e4) throw new Error("Invalid AI drive options");
  let steps = 0;
  while (s.phase !== "end" && steps < maxSteps) {
    const seat = actor(s);
    if (humanSeats.includes(seat)) break;
    step(s, seat, chooseAction(snapshot(s, seat)));
    steps++;
  }
  return { state: s, steps, finished: s.phase === "end", waitingForHuman: humanSeats.includes(actor(s)) };
}

// duplicate/tile-view.mjs
var SVG = "http://www.w3.org/2000/svg";
var dots = { 1: [[50, 50]], 2: [[50, 24], [50, 76]], 3: [[24, 22], [50, 50], [76, 78]], 4: [[24, 24], [76, 24], [24, 76], [76, 76]], 5: [[24, 24], [76, 24], [50, 50], [24, 76], [76, 76]], 6: [[24, 18], [76, 18], [24, 50], [76, 50], [24, 82], [76, 82]], 7: [[24, 16], [50, 31], [76, 16], [24, 57], [76, 57], [24, 84], [76, 84]], 8: [[24, 13], [76, 13], [24, 38], [76, 38], [24, 63], [76, 63], [24, 88], [76, 88]], 9: [[22, 16], [50, 16], [78, 16], [22, 50], [50, 50], [78, 50], [22, 84], [50, 84], [78, 84]] };
function element(tag, attributes) {
  const el = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, String(value));
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

// duplicate/preferences.mjs
var PREFERENCES_STORAGE_KEY = "duplicate.preferences.v1";
var DEFAULT_PREFERENCES = Object.freeze({
  lastDiscard: true,
  actionBubbles: true,
  animations: true,
  turnHighlight: true,
  recentActions: true,
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
  ["autoWin", "\uC790\uB3D9 \uD654\uB8CC", "\uB860\xB7\uCBD4\uBAA8\uAC00 \uAC00\uB2A5\uD558\uBA74 \uC790\uB3D9\uC73C\uB85C \uD654\uB8CC\uD569\uB2C8\uB2E4."],
  ["autoPass", "\uCF5C \uC5C6\uC73C\uBA74 \uC790\uB3D9 \uB118\uAE40", "\uC120\uD0DD\uD560 \uCF5C\uC774 \uC5C6\uC73C\uBA74 \uC790\uB3D9\uC73C\uB85C \uB118\uAE41\uB2C8\uB2E4."]
];
function element2(document2, tag, className, text) {
  const node = document2.createElement(tag);
  if (className) node.className = className;
  if (text !== void 0) node.textContent = text;
  return node;
}
function mountPersonalSettings(container, { value, onChange, onPreview } = {}) {
  if (!container?.ownerDocument) throw new TypeError("A settings container is required");
  const document2 = container.ownerDocument, controls = /* @__PURE__ */ new Map();
  let current = normalizePreferences(value);
  const root = element2(document2, "div", "personal-settings");
  const heading = element2(document2, "div", "panel-heading");
  heading.append(element2(document2, "span", "eyebrow", "PERSONAL SETTINGS"), element2(document2, "h1", "", "\uB0B4 \uD654\uBA74\uC5D0 \uB9DE\uAC8C."));
  root.append(heading, element2(document2, "p", "intro", "\uAC1C\uC778 \uC124\uC815\uC740 \uC774 \uBE0C\uB77C\uC6B0\uC800\uC5D0 \uC800\uC7A5\uB418\uACE0 \uBC14\uB85C \uC801\uC6A9\uB429\uB2C8\uB2E4."));
  function update(patch) {
    current = normalizePreferences({ ...current, ...patch });
    refresh();
    onChange?.({ ...current });
  }
  function group(title, definitions) {
    const fieldset = element2(document2, "fieldset", "personal-settings-group");
    fieldset.append(element2(document2, "legend", "personal-settings-title", title));
    for (const [key, title2, description] of definitions) {
      const label = element2(document2, "label", "switch-row personal-setting-switch");
      const words = element2(document2, "span", "");
      words.append(element2(document2, "strong", "", title2), element2(document2, "small", "", description));
      const input = element2(document2, "input", "");
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
  displayGroup.append(element2(document2, "p", "hint personal-settings-note", "\uAE30\uAE30\uC758 \u2018\uB3D9\uC791 \uC904\uC774\uAE30\u2019\uAC00 \uCF1C\uC838 \uC788\uC73C\uBA74 \uC774 \uC124\uC815\uACFC \uAD00\uACC4\uC5C6\uC774 \uC560\uB2C8\uBA54\uC774\uC158\uC744 \uC904\uC785\uB2C8\uB2E4."));
  const notificationGroup = group("\uC54C\uB9BC", NOTIFICATION_OPTIONS);
  const volumeLabel = element2(document2, "label", "field personal-settings-volume");
  const volumeHeading = element2(document2, "span", "personal-settings-volume-heading");
  const volumeOutput = element2(document2, "output", "", "");
  volumeHeading.append(element2(document2, "span", "", "\uC54C\uB9BC \uC74C\uB7C9"), volumeOutput);
  const volume = element2(document2, "input", "");
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
  const preview = element2(document2, "button", "secondary full", "\uD45C\uC2DC\xB7\uC54C\uB9BC \uBBF8\uB9AC\uBCF4\uAE30");
  preview.type = "button";
  preview.dataset.action = "preview-sound";
  preview.addEventListener("click", () => onPreview?.({ ...current }));
  notificationGroup.append(volumeLabel, preview, element2(document2, "p", "hint personal-settings-note", "\uC18C\uB9AC\uB294 \uD654\uBA74\uC744 \uB204\uB978 \uB4A4 \uC7AC\uC0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC9C4\uB3D9\uC740 \uC9C0\uC6D0\uD558\uB294 \uAE30\uAE30\uC640 \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C\uB9CC \uC791\uB3D9\uD569\uB2C8\uB2E4."));
  group("\uC870\uC791", CONTROL_OPTIONS);
  const reset = element2(document2, "button", "secondary full personal-settings-reset", "\uB0B4 \uC124\uC815 \uCD08\uAE30\uD654");
  reset.type = "button";
  reset.dataset.action = "reset-preferences";
  reset.addEventListener("click", () => update(DEFAULT_PREFERENCES));
  root.append(reset, element2(document2, "p", "hint", "\uC774 \uBE0C\uB77C\uC6B0\uC800\uC758 \uAC1C\uC778 \uC124\uC815\uC744 \uAE30\uBCF8\uAC12\uC73C\uB85C \uB418\uB3CC\uB9BD\uB2C8\uB2E4."));
  function refresh() {
    for (const [key, control] of controls) {
      if (key === "volume") {
        control.value = String(current.volume);
        const percent = `${Math.round(current.volume * 100)}%`;
        control.setAttribute("aria-valuetext", percent);
        volumeOutput.textContent = percent;
      } else control.checked = current[key];
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
var acceptedEvents = (view) => {
  const byId = /* @__PURE__ */ new Map();
  for (const event2 of view.publicEvents ?? []) if (Number.isSafeInteger(event2?.id) && event2.id >= 0 && KINDS.has(event2.kind)) byId.set(event2.id, event2);
  return [...byId.values()].sort((a, b) => a.id - b.id).map(copy);
};
function createFeedbackTracker() {
  let mounted = false, board = null, cursor = -1, history = [], lastDiscard = null;
  const result = (events = [], newBoard = false) => ({ events: copy(events), history: copy(history), lastDiscard: copy(lastDiscard), newBoard });
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
      history = incoming.slice(-6);
      lastDiscard = incoming.findLast((event2) => event2.kind === "discard") ?? null;
      return result([], true);
    }
    if (latest <= cursor) return result();
    const events = incoming.filter((event2) => event2.id > cursor), merged = new Map(history.map((event2) => [event2.id, event2]));
    for (const event2 of incoming) merged.set(event2.id, event2);
    history = [...merged.values()].sort((a, b) => a.id - b.id).slice(-6);
    lastDiscard = incoming.findLast((event2) => event2.kind === "discard") ?? lastDiscard;
    cursor = latest;
    return result(events);
  } };
}

// duplicate/feedback-view.mjs
var POSITIONS = ["bottom", "right", "top", "left"];
var ACTIONS = { discard: "\uBC84\uB9BC", riichi: "\uB9AC\uCE58", chi: "\uCE58", pon: "\uD401", minkan: "\uBA85\uAE61", ankan: "\uC548\uAE61", kakan: "\uAC00\uAE61", kan: "\uAE61", ron: "\uB860", tsumo: "\uCBD4\uBAA8" };
var FLAGS = ["lastDiscard", "actionBubbles", "animations", "turnHighlight", "recentActions", "callPreview", "sound", "vibration", "reducedMotion"];
var validSeat = (seat) => Number.isInteger(seat) && seat >= 0 && seat < 4;
var validTile = (tile) => Number.isInteger(tile) && tile >= 0 && tile < 34;
var actionName = (event2) => ACTIONS[event2.kind === "win" ? event2.method : event2.kind === "call" || event2.kind === "kan" ? event2.callType ?? event2.kind : event2.kind] ?? "\uC120\uD0DD";
var sourceSeat = (event2) => validSeat(event2?.source) ? event2.source : validSeat(event2?.sourceSeat) ? event2.sourceSeat : validSeat(event2?.source?.seat) ? event2.source.seat : null;
function createFeedbackPresenter({ table, handArea, historyContainer, getPreferences, getPlayerName }) {
  if (!table || !handArea) throw new Error("Feedback needs the table and hand area");
  const document2 = table.ownerDocument, window2 = document2.defaultView;
  const media = window2?.matchMedia?.("(prefers-reduced-motion: reduce)");
  const timers = /* @__PURE__ */ new Map(), ghosts = /* @__PURE__ */ new Set(), transientMarks = /* @__PURE__ */ new Set(), voices = /* @__PURE__ */ new Set(), seen = /* @__PURE__ */ new Set();
  let view = null, lastDiscard = null, preferences = {}, logItems = [], initialized = false, destroyed = false, delay = 0, audio = null;
  const node = (tag, className, text) => {
    const el = document2.createElement(tag);
    el.className = className;
    if (text !== void 0) el.textContent = text;
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
  const name = (seat) => {
    try {
      const result = getPlayerName?.(seat);
      if (typeof result === "string" && result.trim()) return result;
    } catch {
    }
    return validSeat(seat) ? ["\u6771", "\u5357", "\u897F", "\u5317"][(seat - (view?.dealer ?? 0) + 4) % 4] : "\uD50C\uB808\uC774\uC5B4";
  };
  const relative = (seat) => (seat - (view?.seat ?? 0) + 4) % 4;
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
    for (const [element3, cls] of transientMarks) element3.classList.remove(cls);
    transientMarks.clear();
  }
  function resetEffects() {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
    stopGhosts();
    stopSound();
    stopVibration();
    clearMarks();
    for (const el of callouts) {
      el.hidden = true;
      el.replaceChildren();
      el.classList.remove("feedback-enter");
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
  function mark(element3, cls, key, ms = 1100) {
    if (!element3) return;
    element3.classList.add(cls);
    const entry = [element3, cls];
    transientMarks.add(entry);
    later(`mark-${key}`, () => {
      element3.classList.remove(cls);
      transientMarks.delete(entry);
    }, ms);
  }
  function riverTile(discard, seat = discard?.seat) {
    if (!discard) return null;
    const candidates = Array.from(table.querySelectorAll(".river [data-discard-id]")).filter((el) => !validSeat(seat) || Number(el.dataset.seat) === seat);
    const physical = discard.tileId ?? (Number.isInteger(discard.tile?.id) ? discard.tile.id : null);
    if (physical !== null && physical !== void 0) {
      const exact = candidates.find((el) => el.dataset.tileId === String(physical) || el.dataset.id === String(physical) || el.dataset.discardId === String(physical));
      if (exact) return exact;
    }
    const discardId = discard.discardId ?? (physical === null || physical === void 0 ? discard.id : null);
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
      const seat = ((view?.seat ?? 0) + index) % 4, player = view?.players?.[seat], marker = riichiMarkers[index];
      marker.hidden = !view || !preferences.actionBubbles || !player?.riichi;
      marker.dataset.seat = String(seat);
      marker.title = marker.hidden ? "" : `${name(seat)} \xB7 \uB9AC\uCE58`;
    }
  }
  function textFor(event2) {
    const tile = validTile(event2.tile) ? ` ${event2.red ? "\uC801 " : ""}${tileName(event2.tile)}` : "";
    const source = sourceSeat(event2), from = source !== null && source !== event2.seat ? ` \u2190 ${name(source)}` : "";
    return `${name(event2.seat)} \xB7 ${actionName(event2)}${tile}${from}`;
  }
  function renderHistory() {
    if (!historyContainer) return;
    historyContainer.hidden = !preferences.recentActions || !logItems.length;
    historyContainer.replaceChildren();
    if (historyContainer.hidden) return;
    const heading = node("div", "feedback-history-heading", "\uCD5C\uADFC \uC120\uD0DD");
    const list = node("ol", "feedback-history-list");
    for (const event2 of logItems.slice(-6)) {
      const item = node("li", `feedback-history-item feedback-history-${event2.kind}`);
      item.append(node("span", "feedback-history-player", name(event2.seat)), node("b", "feedback-history-action", actionName(event2)));
      if (validTile(event2.tile)) item.append(node("span", "feedback-history-tile", `${event2.red ? "\uC801 " : ""}${tileName(event2.tile)}`));
      const source = sourceSeat(event2);
      if (source !== null && source !== event2.seat) item.append(node("span", "feedback-history-source", `\u2190 ${name(source)}`));
      list.append(item);
    }
    historyContainer.append(heading, list);
  }
  function showCallout(event2, preview2 = false) {
    if (!preferences.actionBubbles || !validSeat(event2.seat)) return;
    const index = relative(event2.seat), box = callouts[index];
    box.replaceChildren();
    box.dataset.kind = event2.kind;
    box.dataset.seat = String(event2.seat);
    box.append(node("div", "feedback-callout-player", `${preview2 ? "\uBBF8\uB9AC\uBCF4\uAE30 \xB7 " : ""}${name(event2.seat)}`));
    const line = node("div", "feedback-callout-main");
    line.append(node("strong", "feedback-callout-action", actionName(event2)));
    if (validTile(event2.tile)) {
      const tile = tileFace(event2.tile, { small: true });
      tile.classList.toggle("red", !!event2.red);
      line.append(tile);
    }
    box.append(line);
    const source = sourceSeat(event2);
    if (source !== null && source !== event2.seat) box.append(node("div", "feedback-callout-source", `\u2190 ${name(source)}`));
    box.hidden = false;
    box.classList.remove("feedback-enter");
    if (preferences.motion) {
      void box.offsetWidth;
      box.classList.add("feedback-enter");
    }
    later(`callout-${index}`, () => {
      box.hidden = true;
      box.classList.remove("feedback-enter");
    }, event2.kind === "discard" ? 950 : 1700);
  }
  function animateDiscard(event2) {
    if (!preferences.motion || !validTile(event2.tile) || !validSeat(event2.seat)) return;
    const target = riverTile(event2);
    if (!target || typeof target.animate !== "function") return;
    const destination = target.getBoundingClientRect(), bounds = layer.getBoundingClientRect();
    if (!destination.width || !bounds.width) return;
    const position = POSITIONS[relative(event2.seat)], source = position === "bottom" ? handArea : table.querySelector(`#opponent-${position}`);
    const origin = source?.getBoundingClientRect();
    if (!origin?.width) return;
    const ghost = tileFace(event2.tile, { small: true });
    ghost.classList.add("feedback-ghost");
    ghost.classList.toggle("red", !!event2.red);
    ghost.setAttribute("aria-hidden", "true");
    const x = destination.left - bounds.left, y = destination.top - bounds.top;
    Object.assign(ghost.style, { left: `${x}px`, top: `${y}px`, width: `${destination.width}px`, height: `${destination.height}px` });
    layer.append(ghost);
    ghosts.add(ghost);
    const dx = origin.left + origin.width / 2 - destination.left - destination.width / 2, dy = origin.top + origin.height / 2 - destination.top - destination.height / 2;
    ghost.animate([{ transform: `translate(${dx}px,${dy}px) scale(.9)`, opacity: 0.7 }, { transform: "translate(0,0) scale(1)", opacity: 1 }], { duration: 175, easing: "cubic-bezier(.2,.7,.2,1)" });
    later(`ghost-${event2.id ?? event2.seat}`, () => {
      ghost.remove();
      ghosts.delete(ghost);
    }, 210);
  }
  function highlightCall(event2) {
    if (!preferences.actionBubbles && !preferences.animations) return;
    const source = sourceSeat(event2);
    if (source !== null && source !== event2.seat) mark(riverTile({ ...event2, id: event2.sourceDiscardId ?? null }, source), "feedback-claimed-source", `source-${event2.seat}`, 1e3);
    const position = POSITIONS[relative(event2.seat)], container = position === "bottom" ? handArea.querySelector("#self-melds") : table.querySelector(`#meld-${position}`);
    const melds = Array.from(container?.querySelectorAll(".meld") ?? []);
    const matches = melds.filter((meld) => Array.from(meld.querySelectorAll("[data-type]")).some((tile) => Number(tile.dataset.type) === event2.tile));
    mark((event2.callType === "kakan" ? matches.at(-1) : melds.at(-1)) ?? melds.at(-1), "feedback-meld-hit", `meld-${event2.seat}`, 1200);
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
    for (const event2 of events) line.append(node("strong", "", `${name(event2.seat)} \xB7 ${actionName(event2)}`));
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
    if ((!initialized || newBoard) && preferences.recentActions) logItems = history.filter((event2) => validSeat(event2.seat)).slice(-6);
    if (!initialized || newBoard) initialized = true;
    const fresh = [];
    for (const event2 of events) {
      if (!validSeat(event2?.seat) || !["discard", "call", "kan", "riichi", "win"].includes(event2.kind)) continue;
      const id = String(event2.id ?? `${event2.kind}:${event2.seat}:${event2.tileId ?? event2.tile}:${sourceSeat(event2)}`);
      if (seen.has(id)) continue;
      seen.add(id);
      fresh.push(event2);
    }
    while (seen.size > 256) seen.delete(seen.values().next().value);
    if (!before.recentActions && preferences.recentActions && !firstUpdate && !newBoard) logItems = history.filter((event2) => validSeat(event2.seat)).slice(-6);
    if (preferences.recentActions) {
      const existing = new Set(logItems.map((event2) => event2.id));
      for (const event2 of fresh) if (!existing.has(event2.id)) {
        logItems.push(event2);
        existing.add(event2.id);
      }
      logItems = logItems.slice(-6);
    }
    renderLastDiscard();
    renderTurn();
    renderRiichi();
    renderHistory();
    for (const event2 of fresh) {
      showCallout(event2);
      if (event2.kind === "discard") animateDiscard(event2);
      if (event2.kind === "call" || event2.kind === "kan") highlightCall(event2);
    }
    const wins = fresh.filter((event2) => event2.kind === "win");
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
    const tile = view.handTiles?.find((item) => validTile(item.type)) ?? (validTile(lastDiscard?.tile) ? lastDiscard : null);
    const event2 = { id: "feedback-preview", kind: "riichi", seat: view.seat, tile: tile?.type ?? tile?.tile ?? null, red: !!tile?.red };
    showCallout(event2, true);
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
      const demo = node("div", "feedback-history-preview", `\uBBF8\uB9AC\uBCF4\uAE30 \xB7 ${textFor(event2)}`);
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

// duplicate/app.mjs
var DEFAULT_SERVER = "https://wellness-mahjong-h-lab.chayhyeon.chatgpt.site";
var $ = (id) => document.getElementById(id);
var number = (n) => Number(n).toLocaleString("ko-KR");
var signed = (n) => n === null || n === void 0 ? "\u2014" : `${n > 0 ? "+" : ""}${number(n)}`;
var winds = ["\u6771", "\u5357", "\u897F", "\u5317"];
var positions = ["bottom", "right", "top", "left"];
var switchDefinitions = [["dora", "\uB3C4\uB77C", "\uCCAB \uBC88\uC9F8 \uB3C4\uB77C \uD45C\uC2DC\uD328"], ["kanDora", "\uAE61\uB3C4\uB77C", "\uAE61\uB9C8\uB2E4 \uCD94\uAC00 \uB3C4\uB77C \uD45C\uC2DC\uD328"], ["uraDora", "\uC6B0\uB77C\uB3C4\uB77C", "\uB9AC\uCE58 \uD654\uB8CC \uC2DC \uACF5\uAC1C\uD558\uB294 \uB4B7 \uD45C\uC2DC\uD328"], ["redDora", "\uC801\uB3C4\uB77C", "\uB9CC\xB7\uD1B5\xB7\uC0AD\uC758 \uC8015 \uAC01 1\uC7A5"], ["deadWall", "\uC655\uD328", "\uD328\uC0B0\uC5D0\uC11C 14\uC7A5 \uC81C\uC678"], ["kuitan", "\uCFE0\uC774\uD0D5", "\uBD80\uB978 \uC190\uD328\uC758 \uD0D5\uC57C\uC624 \uD5C8\uC6A9"], ["abortFourKans", "\uC0AC\uAE61\uC0B0\uB8CC", "2\uBA85 \uC774\uC0C1\uC774 \uD569\uACC4 4\uAE61\uC774\uBA74 \uC720\uAD6D"]];
var S = { mode: "practice", panel: "practice", practice: null, online: null, credentials: null, view: null, selected: null, riichiSelecting: false, busy: false, timer: null, poll: null, worker: null, endHidden: false, endKey: null, endRevealAt: 0, resultTimer: null, toastTimer: null, settings: null, roomRules: null, ruleContext: "practice", ruleReadOnly: false, creatingRoom: false, boardCount: 8, preferences: { ...DEFAULT_PREFERENCES }, autoWin: true, autoPass: true, server: DEFAULT_SERVER, gameEpoch: 0 };
var personalSettingsUI;
var feedbackTracker = createFeedbackTracker();
var feedback = createFeedbackPresenter({ table: $("table"), handArea: $("hand-area"), historyContainer: $("recent-actions"), getPreferences: () => S.preferences, getPlayerName: (seat) => playerName(seat) });
function playerName(seat, view = S.view) {
  if (!view) return winds[seat] ?? "\uD50C\uB808\uC774\uC5B4";
  const wind = winds[(seat - view.dealer + 4) % 4];
  const member = S.mode === "online" ? S.online?.members?.find((p) => p.seat === seat) : null;
  const name = member?.name ?? (seat === view.seat ? "\uB098" : `AI ${(seat - view.seat + 4) % 4}`);
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
var seedForBoard = (base, index) => base + Math.imul(index, 2654435769) >>> 0;
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
function currentRules() {
  return S.mode === "online" ? S.online?.rules ?? S.roomRules : S.practice?.game.rules ?? S.settings;
}
function ruleSummary() {
  const r = currentRules(), box = $("rule-chips");
  box.replaceChildren();
  box.className = "rule-chips";
  for (const [key, name] of switchDefinitions.slice(0, 6)) {
    box.append(textNode("span", `${name} ${r[key] ? "ON" : "OFF"}`, `chip ${r[key] ? "" : "off"}`));
  }
  box.append(textNode("span", `${r.exhaustLimit}\uBA85 \uC18C\uC9C4 \uC720\uAD6D`, "chip"));
  $("rules-summary-title").textContent = S.mode === "online" ? S.online ? "\uC774 \uBC29\uC758 \uB300\uAD6D \uADDC\uCE59" : "\uC0C8 \uB300\uD68C \uADDC\uCE59" : "\uD604\uC7AC \uC5F0\uC2B5 \uADDC\uCE59";
  $("rules-open-second").textContent = S.mode === "online" && S.online ? "\uADDC\uCE59 \uBCF4\uAE30" : "\uADDC\uCE59 \uC124\uC815";
  const roomRules = S.online?.rules ?? S.roomRules;
  $("room-rules-preview").textContent = `${S.online?.boardCount ?? S.boardCount}\uAD6D \xB7 \uB3C4\uB77C ${roomRules.dora ? "\uC788\uC74C" : "\uC5C6\uC74C"} \xB7 \uC655\uD328 ${roomRules.deadWall ? "\uC788\uC74C" : "\uC5C6\uC74C"} \xB7 ${roomRules.exhaustLimit}\uBA85 \uC18C\uC9C4 \uC720\uAD6D`;
  $("room-rules-open").textContent = S.online ? "\uBC29 \uADDC\uCE59 \uBCF4\uAE30" : "\uBC29 \uADDC\uCE59 \uC124\uC815";
}
function showPanel(panel) {
  S.panel = panel;
  for (const name of ["practice", "online", "settings"]) {
    $(`${name}-panel`).hidden = name !== panel;
    $(`${name}-tab`).classList.toggle("active", name === panel);
    $(`${name}-tab`).setAttribute("aria-pressed", String(name === panel));
  }
  $("layout").classList.toggle("personal-settings-open", panel === "settings");
}
function openPersonalSettings() {
  showPanel("settings");
  if (matchMedia("(max-width:850px)").matches) $("settings-panel").scrollIntoView({ block: "start", behavior: "auto" });
}
function setMode(mode) {
  clearPlayTimer();
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
    S.view = snapshot(S.practice.game, S.practice.seat);
    render();
    schedulePractice();
  }
}
function applyPreferences(value) {
  S.preferences = normalizePreferences(value);
  savePreferences(localStorage, S.preferences);
  S.autoWin = S.preferences.autoWin;
  S.autoPass = S.preferences.autoPass;
  $("auto-win").checked = S.autoWin;
  $("auto-pass").checked = S.autoPass;
  personalSettingsUI?.setValue(S.preferences);
  if (S.preferences.sound) feedback.unlock();
  render();
  if (S.mode === "practice") schedulePractice();
  else scheduleOnlineAuto();
}
function newPractice() {
  const raw = $("practice-seed").value.trim();
  if (!/^\d{1,10}$/.test(raw) || Number(raw) > 4294967295) {
    toast("\uBC30\uD328 \uBC88\uD638\uB294 0\uBD80\uD130 4294967295\uAE4C\uC9C0 \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
    return;
  }
  clearPlayTimer();
  S.worker?.terminate();
  S.worker = null;
  const seed = Number(raw), seat = Number($("practice-seat").value), count = Number($("practice-count").value);
  S.practice = { seed, seat, count, index: 0, results: [], game: createGame({ seed, rules: S.settings, dealer: 0 }) };
  S.gameEpoch++;
  S.mode = "practice";
  S.endHidden = false;
  S.endKey = null;
  S.selected = null;
  S.riichiSelecting = false;
  savePractice();
  setMode("practice");
}
function schedulePractice() {
  clearPlayTimer();
  if (S.mode !== "practice" || !S.practice || S.practice.game.phase === "end") return;
  const game = S.practice.game, seat = actor(game), view = snapshot(game, S.practice.seat), human = seat === S.practice.seat;
  if (!human) {
    S.timer = setTimeout(() => {
      try {
        driveAI(game, [S.practice.seat], 500);
        afterPracticeStep();
      } catch (error) {
        showGameError(error);
      }
    }, 260);
  } else if (S.autoWin && view.legalActions.some((a) => ["ron", "tsumo"].includes(a.type))) {
    S.timer = setTimeout(() => play(view.legalActions.find((a) => ["ron", "tsumo"].includes(a.type))), 450);
  } else if (S.autoPass && view.legalActions.length === 1 && view.legalActions[0].type === "pass") {
    S.timer = setTimeout(() => play(view.legalActions[0]), 450);
  }
}
function showGameError(error) {
  console.error(error);
  toast(`\uC9C4\uD589 \uC624\uB958: ${error.message}`);
  $("table-status").textContent = "\uC9C4\uD589\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694.";
}
function afterPracticeStep() {
  S.selected = null;
  S.riichiSelecting = false;
  S.view = snapshot(S.practice.game, S.practice.seat);
  savePractice();
  if (S.practice.game.phase === "end") finishPractice();
  render();
  schedulePractice();
}
function finishPractice() {
  const p = S.practice;
  if (p.results.some((r) => r.index === p.index)) return;
  const result = { index: p.index, board: p.index + 1, seed: seedForBoard(p.seed, p.index), seat: p.seat, score: p.game.players[p.seat].score, reference: null, referenceStatus: "loading" };
  p.results.push(result);
  savePractice();
  const job = { seed: result.seed, rules: p.game.rules, dealer: p.index % 4, seat: p.seat };
  try {
    S.worker?.terminate();
    S.worker = new Worker(new URL("./baseline-worker.mjs?v=76363baffd7faf60", import.meta.url), { type: "module" });
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
        const game = createGame(job);
        driveAI(game, [], 2e3);
        if (game.phase !== "end") throw new Error("AI limit");
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
    try {
      step(S.practice.game, S.practice.seat, action);
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
function selectTile(tile) {
  if (!S.view || S.view.actor !== S.view.seat || S.view.phase !== "turn" || S.busy) return;
  const type = S.riichiSelecting ? "riichi" : "discard", action = S.view.legalActions.find((a) => a.type === type && a.id === tile.id);
  if (!action) return;
  if (S.selected === tile.id) {
    play(action);
    return;
  }
  S.selected = tile.id;
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
  const self = v.players[v.seat], ownName = S.mode === "online" ? S.online?.members?.find((p) => p.seat === v.seat)?.name ?? "\uB098" : "\uB098";
  $("self-name").replaceChildren(textNode("b", `${ownName}${self.riichi ? " \xB7 \uB9AC\uCE58" : ""}`), textNode("span", winds[(v.seat - v.dealer + 4) % 4]));
  $("self-points").textContent = number(self.points ?? v.rules.startingPoints + self.score);
  $("self-wall").textContent = `\uAC1C\uC778 \uD328\uC0B0 ${v.ownWallRemaining}\uC7A5${self.exhausted ? " \xB7 \uC18C\uC9C4" : ""}`;
  for (const tile of [...v.handTiles].sort((a, b) => Number(a.drawn) - Number(b.drawn) || a.id - b.id)) {
    const el = tileFace(tile.type, { button: true });
    el.classList.toggle("red", tile.red);
    el.classList.toggle("drawn", tile.drawn);
    el.classList.toggle("selected", tile.id === S.selected);
    el.dataset.id = tile.id;
    el.title = `${tile.red ? "\uC801 " : ""}${tileName(tile.type)}${tile.drawn ? " \xB7 \uBC29\uAE08 \uBF51\uC740 \uD328" : ""}`;
    el.setAttribute("aria-label", el.title);
    el.setAttribute("aria-pressed", String(tile.id === S.selected));
    const legal = v.legalActions.some((a) => a.type === (S.riichiSelecting ? "riichi" : "discard") && a.id === tile.id);
    el.classList.toggle("disabled", !legal);
    el.disabled = !legal || S.busy;
    el.addEventListener("click", () => selectTile(tile));
    hand.append(el);
  }
  $("self-name").dataset.seat = String(v.seat);
  $("self-melds").dataset.seat = String(v.seat);
  renderMelds($("self-melds"), self.melds);
}
function renderMelds(container, melds = []) {
  container.replaceChildren();
  for (const meld of melds) {
    const box = document.createElement("span");
    box.className = "meld";
    if (meld.hidden || meld.tile === null) {
      for (let n = 0; n < 4; n++) box.append(textNode("span", "", "hidden-kan"));
    } else {
      const types = meld.type === "chi" ? [meld.tile, meld.tile + 1, meld.tile + 2] : Array(meld.type === "kan" ? 4 : 3).fill(meld.tile), reds = /* @__PURE__ */ new Map();
      for (const t of meld.tiles ?? []) if (t.red) reds.set(t.type, (reds.get(t.type) ?? 0) + 1);
      for (const [i, type] of types.entries()) {
        if (meld.type === "kan" && !meld.open && (i === 0 || i === 3)) box.append(textNode("span", "", "hidden-kan"));
        else {
          const tile = tileFace(type, { small: true });
          if (reds.get(type) > 0) {
            tile.classList.add("red");
            reds.set(type, reds.get(type) - 1);
          }
          if (meld.open && i === 0) tile.classList.add("called");
          box.append(tile);
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
    $("round-name").textContent = "\uB300\uD68C \uC900\uBE44";
    $("board-number").textContent = "LOBBY";
    $("wall-count").textContent = "\u2014";
    $("pot-label").textContent = "\uB9AC\uCE58\uBD09 0";
    $("exhausted-label").textContent = "";
    $("turn-compass").replaceChildren();
    $("dora-tiles").replaceChildren();
    $("table-status").textContent = S.online?.phase === "lobby" ? "\uCC38\uAC00\uC790\uB97C \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC2B5\uB2C8\uB2E4." : "\uB300\uD68C\uB97C \uB9CC\uB4E4\uAC70\uB098 \uCF54\uB4DC\uB85C \uCC38\uAC00\uD558\uC138\uC694.";
    $("board-label").textContent = S.online ? `\uC628\uB77C\uC778 \xB7 \uB300\uAE30\uC2E4 ${S.online.tableId ?? ""}` : "\uC628\uB77C\uC778 \uB300\uC804";
    $("seat-label").textContent = "";
    return;
  }
  const board = S.mode === "practice" ? S.practice.index + 1 : S.online.board, count = S.mode === "practice" ? S.practice.count : S.online.boardCount;
  $("board-label").textContent = `${S.mode === "practice" ? "\uC5F0\uC2B5" : "\uC628\uB77C\uC778"} ${board} / ${count}\uAD6D`;
  $("seat-label").textContent = `\uB0B4 \uC790\uB9AC ${winds[(v.seat - v.dealer + 4) % 4]}`;
  $("round-name").textContent = `${winds[v.rules.roundWind - 27]} ${(board - 1) % 4 + 1} \u5C40`;
  $("board-number").textContent = `BOARD ${String(board).padStart(2, "0")}`;
  $("wall-count").textContent = String(v.ownWallRemaining);
  $("pot-label").textContent = `\uB9AC\uCE58\uBD09 ${v.pot / 1e3}`;
  $("exhausted-label").textContent = `\uC18C\uC9C4 ${v.exhaustedSeats.length} / ${v.rules.exhaustLimit}`;
  const shownActor = v.phase === "reaction" ? v.lastDiscard?.seat : v.turn;
  for (let relative = 0; relative < 4; relative++) {
    const seat = (v.seat + relative) % 4, player = v.players[seat], position = positions[relative], river = $(`river-${position}`);
    river.classList.toggle("long-river", player.river.length > 24);
    for (const discarded of player.river) {
      const tile = tileFace(discarded.type ?? discarded.tile, { small: true });
      tile.classList.toggle("red", discarded.red);
      tile.classList.toggle("riichi", discarded.riichi);
      tile.classList.toggle("claimed", discarded.claimed);
      tile.dataset.discardId = String(discarded.id);
      tile.dataset.tileId = String(discarded.id);
      tile.dataset.seat = String(seat);
      river.append(tile);
    }
    if (relative) {
      const panel = $(`opponent-${position}`), member = S.mode === "online" ? S.online.members.find((p) => p.seat === seat) : { name: `AI ${relative}`, ai: true };
      const label = document.createElement("div");
      label.className = `player-label ${shownActor === seat && v.phase !== "end" ? "active" : ""}`;
      label.append(textNode("span", winds[(seat - v.dealer + 4) % 4], "player-wind"), textNode("span", member?.name ?? "\uB300\uAE30 \uC911"));
      if (player.riichi) label.append(textNode("span", "\u7ACB\u76F4", "player-status"));
      panel.append(label, textNode("div", number(player.points ?? v.rules.startingPoints + player.score), "player-score"), textNode("div", player.exhausted ? "\uD328\uC0B0 \uC18C\uC9C4" : `\uD328\uC0B0 ${player.wallRemaining}`, `player-wall ${player.exhausted ? "exhausted" : ""}`));
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
    const seat = (v.seat + relative) % 4;
    compass.append(textNode("span", winds[(seat - v.dealer + 4) % 4], `${positions[relative]} ${shownActor === seat && v.phase !== "end" ? "active" : ""}`));
  }
  $("dora-tiles").replaceChildren();
  for (const type of v.doraIndicators) $("dora-tiles").append(tileFace(type, { small: true }));
  if (!v.doraIndicators.length) $("dora-tiles").append(textNode("span", v.rules.kanDora ? " \uAE61\u5F8C \uD45C\uC2DC" : " \uC5C6\uC74C"));
  let status = "";
  if (v.phase === "end") status = v.end === "win" ? "\uD654\uB8CC \xB7 \uAD6D \uC885\uB8CC" : "\uC720\uAD6D \xB7 \uAD6D \uC885\uB8CC";
  else if (v.actor === v.seat) status = v.phase === "reaction" && v.lastDiscard ? `${winds[(v.lastDiscard.seat - v.dealer + 4) % 4]}\uC758 ${tileName(v.lastDiscard.type ?? v.lastDiscard.tile)} \xB7 \uB860/\uD6C4\uB85C \uC120\uD0DD` : "\uB0B4 \uCC28\uB840\uC785\uB2C8\uB2E4.";
  else status = v.phase === "reaction" ? "\uB860\xB7\uCF5C \uD655\uC778 \uC911" : `${winds[(v.turn - v.dealer + 4) % 4]}\uC758 \uCC28\uB840`;
  $("table-status").textContent = status;
}
var actionNames = { tsumo: "\uCBD4\uBAA8", ron: "\uB860", pon: "\uD401", minkan: "\uBA85\uAE61", ankan: "\uC548\uAE61", kakan: "\uAC00\uAE61", chi: "\uCE58", pass: "\uB118\uAE30\uAE30" };
function callPreview(action, view) {
  const box = document.createElement("span");
  box.className = "call-preview";
  box.setAttribute("aria-hidden", "true");
  const source = view.lastDiscard, hand = [...view.handTiles].sort((a, b) => Number(!!a.red) - Number(!!b.red));
  let tiles = [];
  if (action.type === "kakan") {
    const meld = view.melds[action.meld];
    if (!meld) return box;
    tiles = [...meld.tiles ?? [], hand.find((t) => t.type === meld.tile)].filter(Boolean);
  } else if (action.type === "ankan") tiles = hand.filter((t) => t.type === action.tile);
  else {
    const wanted = action.type === "chi" ? [action.tile, action.tile + 1, action.tile + 2] : Array(action.type === "minkan" ? 4 : 3).fill(action.tile);
    let claimed = false;
    tiles = wanted.map((type) => {
      if (!claimed && type === (source?.type ?? source?.tile)) {
        claimed = true;
        return { type, red: !!source.red, claimed: true };
      }
      const index = hand.findIndex((t) => t.type === type);
      return index < 0 ? { type } : hand.splice(index, 1)[0];
    });
  }
  for (const t of tiles) {
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
      const next = textNode("button", hasNext() ? "\uB2E4\uC74C \uAD6D" : S.mode === "practice" ? "\uC0C8 \uC5F0\uC2B5" : "\uB300\uD68C \uC644\uB8CC", "primary");
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
  return S.mode === "practice" ? S.practice.index + 1 < S.practice.count : S.online?.board < S.online?.boardCount;
}
function renderEnd() {
  const v = S.view, ended = v?.phase === "end";
  $("resume-result").hidden = !ended;
  if (!ended) {
    $("end-overlay").hidden = true;
    S.endKey = null;
    return;
  }
  const key = `${S.mode}:${S.mode === "practice" ? S.practice.seed : S.online.code}:${S.mode === "practice" ? S.practice.index : S.online.board}`;
  if (S.endKey !== key) {
    S.endKey = key;
    S.endHidden = false;
  }
  $("end-overlay").hidden = S.endHidden || Date.now() < S.endRevealAt;
  $("end-title").textContent = v.end === "win" ? "\uD654\uB8CC" : v.end === "exhaustive-draw" ? "\uD669\uD328 \uC720\uAD6D" : "\uC0AC\uAE61\uC0B0\uB8CC";
  $("end-eyebrow").textContent = `BOARD ${S.mode === "practice" ? S.practice.index + 1 : S.online.board} \xB7 RESULT`;
  const details = $("end-details");
  details.replaceChildren();
  for (const seat of v.winners ?? []) {
    const p = v.players[seat], win2 = p.win;
    if (!win2) continue;
    const box = document.createElement("div");
    box.className = "winner-block";
    box.append(textNode("strong", `${winds[(seat - v.dealer + 4) % 4]} \xB7 ${win2.method === "tsumo" ? "\uCBD4\uBAA8" : "\uB860"} \xB7 ${win2.score.yakuman ? "\uC5ED\uB9CC" : `${win2.score.han}\uD310 ${win2.score.fu}\uBD80`}`), textNode("div", win2.score.name ?? ""));
    const bonuses = win2.score.bonuses;
    if (Array.isArray(bonuses) && bonuses.length) box.append(textNode("div", bonuses.map((b) => `${b.name} ${b.han}`).join(" \xB7 ")));
    else if (bonuses && Object.values(bonuses).some(Boolean)) box.append(textNode("div", [bonuses.dora ? `\uB3C4\uB77C ${bonuses.dora}` : "", bonuses.uraDora ? `\uC6B0\uB77C ${bonuses.uraDora}` : "", bonuses.redDora ? `\uC801\uB3C4\uB77C ${bonuses.redDora}` : ""].filter(Boolean).join(" \xB7 ")));
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
    if (v.pot) details.append(textNode("p", `\uB0A8\uC740 \uB9AC\uCE58 \uACF5\uD0C1 ${number(v.pot)}\uC810\uC740 \uC774\uBC88 \uAD6D\uC758 \uC810\uC218 \uBCC0\uD654\uC5D0 \uD3EC\uD568\uB429\uB2C8\uB2E4.`, "hint"));
  }
  const points = $("end-points");
  points.replaceChildren();
  for (let seat = 0; seat < 4; seat++) {
    const row = document.createElement("div");
    row.className = `end-score-row ${seat === v.seat ? "self" : ""}`;
    const name = S.mode === "online" ? S.online.members.find((p) => p.seat === seat)?.name : seat === v.seat ? "\uB098" : `AI ${(seat - v.seat + 4) % 4}`;
    row.append(textNode("span", `${winds[(seat - v.dealer + 4) % 4]} \xB7 ${name ?? "\uD50C\uB808\uC774\uC5B4"}`), textNode("b", signed(v.players[seat].score), v.players[seat].score > 0 ? "positive" : v.players[seat].score < 0 ? "negative" : ""));
    points.append(row);
  }
  $("next-board").textContent = hasNext() ? "\uB2E4\uC74C \uAD6D" : S.mode === "practice" ? "\uC0C8 \uC5F0\uC2B5" : "\uB300\uD68C \uC644\uB8CC";
  $("next-board").disabled = S.busy || S.mode === "online" && (!S.online.host || !hasNext());
}
function setMetric(id, value) {
  const el = $(id);
  el.textContent = signed(value);
  el.classList.toggle("positive", value > 0);
  el.classList.toggle("negative", value < 0);
}
function renderComparison() {
  const online = S.mode === "online", record = online ? S.online?.comparison : S.practice?.results.find((r) => r.index === S.practice.index);
  $("result-caption").textContent = online ? "\uAC19\uC740 \uC790\uB9AC \xB7 \uC0AC\uB78C" : "AI \uAE30\uC900";
  $("my-result-label").textContent = online ? "\uC644\uB8CC \uAD6D \uC810\uC218 \uD569\uACC4" : "\uB0B4 \uC810\uC218 \uBCC0\uD654";
  $("reference-label").textContent = online ? "\uAC19\uC740 \uC790\uB9AC \uD3C9\uADE0 \uD569\uACC4" : "AI \uAE30\uC900 \uB300\uAD6D";
  setMetric("my-result", record?.score ?? null);
  setMetric("reference-result", online ? record?.mean : record?.reference);
  setMetric("difference-result", online ? record?.difference : record?.reference !== null && record?.reference !== void 0 ? record.score - record.reference : null);
  $("comparison-note").textContent = online ? record?.samples >= 2 ? `\uC644\uB8CC\uB41C \uC0AC\uB78C \uCC38\uAC00\uC790 ${record.samples}\uBA85 \xB7 \uAC19\uC740 \uADDC\uCE59\xB7\uAD6D\xB7\uC790\uB9AC \uBE44\uAD50` : "\uAC19\uC740 \uC790\uB9AC\uC5D0\uC11C \uC644\uB8CC\uD55C \uC0AC\uB78C\uC774 2\uBA85 \uC774\uC0C1\uC774\uBA74 \uD3C9\uADE0\uC744 \uD45C\uC2DC\uD569\uB2C8\uB2E4." : record?.referenceStatus === "loading" ? "\uAC19\uC740 \uBC30\uD328\uC758 AI \uAE30\uC900 \uB300\uAD6D\uC744 \uACC4\uC0B0 \uC911\uC785\uB2C8\uB2E4." : record?.referenceStatus === "done" ? "\uC0AC\uB78C \uCC38\uAC00\uC790 \uD3C9\uADE0\uACFC \uBCC4\uAC1C\uC778 AI \uAE30\uC900 \uB300\uAD6D\uC785\uB2C8\uB2E4." : record?.referenceStatus === "error" ? "AI \uAE30\uC900 \uB300\uAD6D \uACC4\uC0B0\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4." : "\uAD6D\uC774 \uB05D\uB098\uBA74 \uAC19\uC740 \uC790\uB9AC\uC758 \uACB0\uACFC\uB97C \uBE44\uAD50\uD569\uB2C8\uB2E4.";
  const history = $("result-history");
  history.replaceChildren();
  const rows = online ? record?.boards ?? [] : S.practice?.results ?? [];
  for (const r of rows.slice(-8)) {
    const row = document.createElement("div");
    row.className = "result-history-row";
    const difference = online ? r.difference : r.reference === null ? null : r.score - r.reference;
    row.append(textNode("span", `${r.board}\uAD6D`), textNode("span", signed(r.score)), textNode("span", difference === null ? "\uBE44\uAD50 \uB300\uAE30" : signed(difference), difference > 0 ? "positive" : difference < 0 ? "negative" : ""));
    history.append(row);
  }
  $("standings-open").hidden = !online || !S.online?.standings?.length;
}
function renderRoom() {
  const room = S.online;
  $("room-info").hidden = !room;
  $("online-create").disabled = S.busy || !!room;
  $("online-join").disabled = S.busy || !!room;
  $("online-name").disabled = !!room;
  $("online-code").disabled = !!room;
  if (!room) return;
  $("room-code").textContent = room.code;
  const members = $("room-members");
  members.replaceChildren();
  for (let seat = 0; seat < 4; seat++) {
    const p = room.members.find((m) => m.seat === seat), row = document.createElement("div");
    row.className = "member-row";
    row.append(textNode("span", `${winds[seat]} \xB7 ${p?.name ?? "\uBE48\uC790\uB9AC"}`), textNode("small", p ? p.ai ? "AI" : seat === room.seat ? "\uB098" : "\uCC38\uAC00\uC790" : "\uB300\uAE30"));
    members.append(row);
  }
  $("start-ai").hidden = room.phase !== "lobby" || !room.host;
  $("start-ai").disabled = S.busy;
}
function render() {
  const online = S.mode === "online";
  $("connection").replaceChildren(textNode("i", ""), textNode("span", online ? S.online ? `\uC628\uB77C\uC778 \xB7 \uD14C\uC774\uBE14 ${S.online.tableId}` : "\uC628\uB77C\uC778 \uC900\uBE44" : "\uB85C\uCEEC \uC5F0\uC2B5"));
  $("connection").classList.remove("error");
  ruleSummary();
  renderRoom();
  renderTable();
  renderHand();
  renderActions();
  const boardKey = S.view ? online ? `${S.server}:${S.online.code}:${S.online.tableId}:${S.online.board}:${S.view.seat}` : `practice:${S.practice.seed}:${S.practice.index}:${S.view.seat}:${S.gameEpoch}` : null;
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
  $("game-footnote").textContent = online ? "\uB300\uD68C\uB294 \uC0DD\uC131 \uD6C4 6\uC2DC\uAC04 \uC720\uC9C0\uB429\uB2C8\uB2E4. \uAC19\uC740 \uD0ED\uC5D0\uC11C \uC0C8\uB85C\uACE0\uCE68\uD558\uBA74 \uC790\uAE30 \uC790\uB9AC\uB85C \uB3CC\uC544\uC635\uB2C8\uB2E4." : "\uD328\uB97C \uB450 \uBC88 \uB204\uB974\uAC70\uB098 \uC120\uD0DD \uD6C4 \uBC84\uB9AC\uAE30\uB97C \uB204\uB974\uC138\uC694. \uD0A4\uBCF4\uB4DC \u2190 \u2192 / Enter / Esc \uC9C0\uC6D0.";
}
async function request(path = "", body = null, authenticated = true) {
  const headers = { "Content-Type": "application/json" };
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
  const changed = !S.online || S.online.revision !== state.revision || S.online.board !== state.board || S.online.phase !== state.phase;
  S.online = state;
  $("online-code").value = state.code;
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
  const name = $("online-name").value.trim();
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
    const state = await request(create ? "" : `/${code}/join`, create ? { name, rules: S.roomRules, boardCount: S.boardCount } : { name }, false);
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
  const legal = S.view.legalActions;
  if (S.autoWin && legal.some((a) => ["ron", "tsumo"].includes(a.type))) {
    const action = legal.find((a) => ["ron", "tsumo"].includes(a.type));
    S.timer = setTimeout(() => play(action), 450);
  } else if (S.autoPass && legal.length === 1 && legal[0].type === "pass") {
    S.timer = setTimeout(() => play(legal[0]), 350);
  }
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
  if (!hasNext()) {
    $("practice-seed").value = String(randomSeed());
    newPractice();
    return;
  }
  const p = S.practice;
  p.index++;
  p.game = createGame({ seed: seedForBoard(p.seed, p.index), rules: p.game.rules, dealer: p.index % 4 });
  S.endKey = null;
  S.endHidden = false;
  S.selected = null;
  S.riichiSelecting = false;
  afterPracticeStep();
}
function openRules(context2 = S.mode === "online" ? "room" : "practice", create = false) {
  S.ruleContext = context2;
  S.ruleReadOnly = context2 === "room" && !!S.online;
  S.creatingRoom = create && !S.ruleReadOnly;
  const rules = S.ruleReadOnly ? S.online.rules : context2 === "room" ? S.roomRules : S.settings;
  for (const [key] of switchDefinitions) $(`rule-${key}`).checked = rules[key];
  $("rule-exhaustLimit").value = rules.exhaustLimit;
  $("rule-multipleRon").value = rules.multipleRon;
  $("rule-startingPoints").value = rules.startingPoints;
  $("rule-boardCount").value = S.ruleReadOnly ? S.online.boardCount : S.boardCount;
  $("rules-dialog-title").textContent = S.ruleReadOnly ? "\uC774 \uBC29\uC758 \uB300\uAD6D \uADDC\uCE59" : create ? "\uB300\uD68C \uB9CC\uB4E4\uAE30" : context2 === "room" ? "\uC0C8 \uB300\uD68C \uADDC\uCE59" : "\uC5F0\uC2B5 \uADDC\uCE59";
  $("rules-dialog-note").textContent = S.ruleReadOnly ? "\uBC29\uC744 \uB9CC\uB4E4 \uB54C \uD655\uC815\uD55C \uACF5\uD1B5 \uADDC\uCE59\uC785\uB2C8\uB2E4. \uCC38\uAC00\uC790\uB294 \uBCC0\uACBD\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4." : context2 === "room" ? "\uC774 \uB300\uD68C\uC758 \uBAA8\uB4E0 \uD14C\uC774\uBE14\uC5D0 \uAC19\uC740 \uADDC\uCE59\uC744 \uC801\uC6A9\uD569\uB2C8\uB2E4. \uAC1C\uC778 \uD654\uBA74\xB7\uC54C\uB9BC \uC124\uC815\uACFC \uBCC4\uB3C4\uB85C \uC800\uC7A5\uD569\uB2C8\uB2E4." : "\uB2E4\uC74C \uC0C8 \uC5F0\uC2B5\uBD80\uD130 \uC801\uC6A9\uB429\uB2C8\uB2E4. \uC628\uB77C\uC778 \uB300\uD68C\uC758 \uADDC\uCE59\uC740 \uB530\uB85C \uC124\uC815\uD569\uB2C8\uB2E4.";
  $("rules-dialog").classList.toggle("rules-readonly", S.ruleReadOnly);
  for (const input of $("rules-dialog").querySelectorAll('#rule-switches input,[id^="rule-"]')) input.disabled = S.ruleReadOnly;
  $("rule-boardCount-field").hidden = context2 !== "room";
  $("create-room-name-field").hidden = !S.creatingRoom;
  $("create-room-name").value = $("online-name").value;
  $("rules-save").hidden = S.ruleReadOnly;
  $("rules-save").textContent = S.creatingRoom ? "\uC774 \uADDC\uCE59\uC73C\uB85C \uB300\uD68C \uB9CC\uB4E4\uAE30" : context2 === "room" ? "\uB300\uD68C \uADDC\uCE59 \uC800\uC7A5" : "\uC5F0\uC2B5 \uADDC\uCE59 \uC800\uC7A5";
  $("rules-dialog").showModal();
}
function fillPreset(noDora = false) {
  for (const [key] of switchDefinitions) $(`rule-${key}`).checked = noDora ? ["kuitan", "abortFourKans"].includes(key) : DEFAULT_RULES2[key];
  $("rule-exhaustLimit").value = 1;
  $("rule-multipleRon").value = "all";
  $("rule-startingPoints").value = 25e3;
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
    const rules = normalizeRules(raw);
    if (S.ruleContext === "room") {
      S.roomRules = rules;
      S.boardCount = Number($("rule-boardCount").value);
      writeStorage(localStorage, "duplicate.room-rules.v1", { rules: S.roomRules, boardCount: S.boardCount });
    } else {
      S.settings = rules;
      writeStorage(localStorage, "duplicate.settings.v1", { rules: S.settings });
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
  const table = document.createElement("table");
  table.className = "standings";
  const head = document.createElement("thead"), row = document.createElement("tr");
  for (const label of ["\uC774\uB984", "\uAD6C\uBD84", "\uC644\uB8CC", "\uC810\uC218 \uD569\uACC4", "\uD3C9\uADE0 \uB300\uBE44"]) row.append(textNode("th", label));
  head.append(row);
  table.append(head);
  const body = document.createElement("tbody");
  for (const p of S.online?.standings ?? []) {
    const r = document.createElement("tr");
    r.append(textNode("td", p.name), textNode("td", p.ai ? "AI" : "\uC0AC\uB78C"), textNode("td", `${p.completedBoards}\uAD6D`), textNode("td", signed(p.score)), textNode("td", signed(p.difference)));
    body.append(r);
  }
  table.append(body);
  box.append(table);
  $("standings-dialog").showModal();
}
function exportResult() {
  const record = S.mode === "practice" ? { format: "duplicate-practice-v1", createdAt: (/* @__PURE__ */ new Date()).toISOString(), seed: S.practice.seed, seat: S.practice.seat, rules: S.practice.game.rules, results: S.practice.results, game: S.practice.game } : { format: "duplicate-online-result-v1", createdAt: (/* @__PURE__ */ new Date()).toISOString(), code: S.online?.code, tableId: S.online?.tableId, seat: S.online?.seat, rules: S.online?.rules, comparison: S.online?.comparison, standings: S.online?.standings, game: S.view };
  const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: "application/json" })), a = document.createElement("a");
  a.href = url;
  a.download = `duplicate-${S.mode}-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
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
$("preset-standard").onclick = () => fillPreset(false);
$("preset-no-dora").onclick = () => fillPreset(true);
$("online-create").onclick = () => openRules("room", true);
$("online-join").onclick = () => connectRoom(false);
$("start-ai").onclick = () => roomOperation("start-ai");
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
$("auto-pass").onchange = () => applyPreferences({ ...S.preferences, autoPass: $("auto-pass").checked });
$("online-code").oninput = () => {
  $("online-code").value = $("online-code").value.toUpperCase().replace(/[^A-Z2-9]/g, "");
};
document.addEventListener("keydown", (event2) => {
  if (document.querySelector("dialog[open]") || ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  if (event2.key === "Escape") {
    S.selected = null;
    S.riichiSelecting = false;
    renderHand();
    renderActions();
    return;
  }
  const legal = S.view?.legalActions.filter((a) => a.type === (S.riichiSelecting ? "riichi" : "discard")) ?? [];
  if (!legal.length) return;
  if (["ArrowLeft", "ArrowRight"].includes(event2.key)) {
    event2.preventDefault();
    const index = legal.findIndex((a) => a.id === S.selected), next = index < 0 ? 0 : (index + (event2.key === "ArrowRight" ? 1 : -1) + legal.length) % legal.length;
    S.selected = legal[next].id;
    renderHand();
    renderActions();
    $("hand").querySelector(`[data-id="${S.selected}"]`)?.focus();
  }
  if (event2.key === "Enter" && document.activeElement.tagName !== "BUTTON") {
    event2.preventDefault();
    const action = legal.find((a) => a.id === S.selected);
    if (action) play(action);
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && S.credentials) pollRoom();
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
  S.settings = normalizeRules(storedSettings?.rules ?? {});
} catch {
  S.settings = normalizeRules();
}
var storedRoomRules = readStorage(localStorage, "duplicate.room-rules.v1");
try {
  S.roomRules = normalizeRules(storedRoomRules?.rules ?? storedSettings?.rules ?? {});
  const count = storedRoomRules?.boardCount ?? storedSettings?.boardCount;
  S.boardCount = [1, 4, 8, 16].includes(count) ? count : 8;
} catch {
  S.roomRules = normalizeRules();
}
S.preferences = loadPreferences(localStorage);
S.autoWin = S.preferences.autoWin;
S.autoPass = S.preferences.autoPass;
$("auto-win").checked = S.autoWin;
$("auto-pass").checked = S.autoPass;
personalSettingsUI = mountPersonalSettings($("settings-panel"), { value: S.preferences, onChange: applyPreferences, onPreview: () => feedback.preview(S.view ?? snapshot(S.practice.game, S.practice.seat)) });
var saved = readStorage(localStorage, "duplicate.practice.v1");
try {
  if (saved?.game && saved.game.rules.id === DEFAULT_RULES2.id && Number.isInteger(saved.seat) && saved.seat >= 0 && saved.seat < 4 && Number.isInteger(saved.index) && saved.index < saved.count) {
    assertInvariants(saved.game);
    S.practice = saved;
  }
} catch {
  S.practice = null;
}
if (!S.practice) {
  const seed = randomSeed();
  S.practice = { seed, seat: 0, count: 8, index: 0, results: [], game: createGame({ seed, rules: S.settings, dealer: 0 }) };
}
$("practice-seed").value = S.practice.seed;
$("practice-seat").value = S.practice.seat;
$("practice-count").value = S.practice.count;
$("online-name").value = readStorage(localStorage, "duplicate.name") ?? "";
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
$("server-base").value = S.server;
$("server-save").onclick = () => {
  if (S.credentials) {
    toast("\uB300\uD68C \uC5F0\uACB0\uC744 \uC885\uB8CC\uD55C \uB4A4 \uC11C\uBC84\uB97C \uBC14\uAFD4 \uC8FC\uC138\uC694.");
    return;
  }
  try {
    S.server = normalizeServer($("server-base").value);
    $("server-base").value = S.server;
    writeStorage(localStorage, "duplicate.server", S.server);
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
S.view = S.mode === "practice" ? snapshot(S.practice.game, S.practice.seat) : null;
setMode(S.mode);
if (S.credentials) schedulePoll();
if (S.practice.game.phase === "end" && !S.practice.results.some((r) => r.index === S.practice.index)) finishPractice();
