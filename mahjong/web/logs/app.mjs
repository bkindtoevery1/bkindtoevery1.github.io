// engine/tiles.mjs
var typeOf = (id) => Math.floor(id / 4);
var tileName = (t) => t < 27 ? `${t % 9 + 1}${["\uB9CC", "\uD1B5", "\uC0AD"][Math.floor(t / 9)]}` : ["\uB3D9", "\uB0A8", "\uC11C", "\uBD81", "\uBC31", "\uBC1C", "\uC911"][t - 27];

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

// web/score-display.mjs
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
  const detail2 = scoreBreakdown(score);
  if (!detail2) return "";
  return detail2.yakuman ? `${detail2.yaku.map((e) => e.name).join(" \xB7 ")} \xB7 \uC5ED\uB9CC` : `${[...detail2.yaku, ...detail2.bonuses].map((e) => `${e.name} ${e.han}\uD310`).join(" + ")} = \uCD1D ${detail2.totalHan}\uD310`;
}

// web/game-log.mjs
var LOG_FORMAT = "h-mahjong-log/v1";
var COMPACT_FORMAT = "wellness-mahjong-log/v2";
var PREFIX = "h-mahjong-log-v1:";
var INDEX = PREFIX + "index";
var clone = (value) => structuredClone(value);
var scores = (game) => game.players.map((player) => player.score);
var seats = ["\uB3D9", "\uB0A8", "\uC11C", "\uBD81"];
var seatLabels = (game) => game.rules.variant === "S" ? seats.map((_, i) => seats[(i - game.dealer + 4) % 4]) : seats;
var signed = (value) => `${value > 0 ? "+" : ""}${value}`;
function actionRecord(game, seat, action, before, error = null) {
  const seats2 = seatLabels(game);
  const after = scores(game), payments = clone(game.ledger.slice(before.ledger)), issues = [];
  const delta = after.map((value, i) => value - before.scores[i]), ledgerDelta = [0, 0, 0, 0];
  for (const payment of payments) {
    if (Number.isInteger(payment.from)) ledgerDelta[payment.from] -= payment.amount;
    if (Number.isInteger(payment.to)) ledgerDelta[payment.to] += payment.amount;
  }
  if (delta.some((value, i) => value !== ledgerDelta[i])) issues.push("\uC810\uC218 \uBCC0\uD654\uC640 \uC2E4\uC81C \uC774\uCCB4 \uB0B4\uC5ED\uC774 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.");
  const wins = game.events.slice(before.events).filter((e) => e.type === "win").map((win) => {
    if (game.rules.variant === "S") {
      const actual2 = payments.filter((p) => p.to === win.seat), actualReceipt2 = actual2.reduce((n, p) => n + p.amount, 0), expected = [], pao = win.score.yakuman ? game.players[win.seat].pao : null;
      if (pao !== null && pao !== void 0) {
        if (win.method === "tsumo" || win.source === pao) expected.push({ from: pao, amount: win.score.total });
        else expected.push({ from: pao, amount: win.score.total / 2 }, { from: win.source, amount: win.score.total / 2 });
      } else if (win.method === "ron") expected.push({ from: win.source, amount: win.score.points.ron });
      else for (let from = 0; from < 4; from++) if (from !== win.seat) expected.push({ from, amount: from === game.dealer ? win.score.points.tsumoDealer : win.score.points.tsumoOther });
      if (before.pot) expected.push({ from: "pot", amount: before.pot });
      const expectedReceipt2 = expected.reduce((n, p) => n + p.amount, 0), problems2 = [];
      if (actual2.length !== expected.length || expected.some((e) => actual2.filter((p) => p.from === e.from && p.amount === e.amount).length !== 1) || actualReceipt2 !== delta[win.seat]) problems2.push("S\uB8F0 \uC9C0\uAE09\uC790 \uB610\uB294 \uC9C0\uAE09\uC561\uC774 \uC801\uC6A9 \uADDC\uCE59\uACFC \uB2E4\uB985\uB2C8\uB2E4.");
      issues.push(...problems2.map((text) => `${seats2[win.seat]}: ${text}`));
      return { seat: win.seat, method: win.method, order: win.order, score: clone(win.score), payers: expected.map((p) => p.from), expectedReceipt: expectedReceipt2, actualReceipt: actualReceipt2, scoreBefore: before.scores[win.seat], scoreAfter: after[win.seat], payments: actual2, issues: problems2 };
    }
    const payers = win.method === "tsumo" ? before.active.filter((i) => i !== win.seat) : [win.source];
    const actual = payments.filter((p) => p.to === win.seat && p.kind === win.method);
    const tsumoBonus = win.method === "tsumo" ? game.rules.tsumoBonusPerPayer : 0;
    const perPayer = win.score.total + tsumoBonus, expectedReceipt = perPayer * payers.length, actualReceipt = actual.reduce((sum, p) => sum + p.amount, 0);
    const problems = [];
    if (actual.length !== payers.length || payers.some((i) => actual.filter((p) => p.from === i && p.amount === perPayer).length !== 1)) problems.push("\uC9C0\uAE09\uC790 \uB610\uB294 \uC9C0\uAE09\uC561\uC774 \uC801\uC6A9 \uADDC\uCE59\uACFC \uB2E4\uB985\uB2C8\uB2E4.");
    if ((win.score.yaku === "pinfu" || win.score.name === "\uD551\uD6C4") && (win.score.base !== 100 || win.score.bonus !== 0 || win.score.total !== 100)) problems.push("\uD551\uD6C4 \uC5ED \uC810\uC218 \uB610\uB294 \uAC00\uC0B0\uC810\uC774 \uC798\uBABB\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    if (actualReceipt !== expectedReceipt || delta[win.seat] !== actualReceipt) problems.push("\uD654\uB8CC \uC218\uC785\uACFC \uC810\uC218 \uBCC0\uD654\uAC00 \uB2E4\uB985\uB2C8\uB2E4.");
    issues.push(...problems.map((text) => `${seats2[win.seat]}: ${text}`));
    return { seat: win.seat, method: win.method, order: win.order, score: clone(win.score), tsumoBonus, payers, perPayer, expectedReceipt, actualReceipt, scoreBefore: before.scores[win.seat], scoreAfter: after[win.seat], payments: actual, issues: problems };
  });
  const draws = game.events.slice(before.events).filter((e) => e.type === "draw" || e.type === "kanDraw").map(({ type, seat: seat2, id }) => ({ type, seat: seat2, id }));
  return { seat, action: clone(action), before: before.scores, after, delta, payments, wins, draws, issues, eventRange: [before.events, game.events.length], ...error ? { error: String(error.message ?? error) } : {} };
}
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
    for (const win of entry.wins) {
      const detail2 = variant === "S" ? scoreBreakdownText(win.score) : `\uC5ED ${win.score.base}${win.score.bonus ? " + \uAC00\uC0B0 " + win.score.bonus : ""}${win.tsumoBonus ? " + \uCBD4\uBAA8 " + win.tsumoBonus : ""}`;
      lines.push(variant === "S" ? `  ${seats2[win.seat]} ${detail2}` : `  ${seats2[win.seat]} ${win.score.name} (${detail2})`);
      if (win.issues.length) lines.push(`  \uADDC\uCE59\uC0C1 ${win.expectedReceipt}, \uC2E4\uC81C \uC218\uC785 ${win.actualReceipt}`);
    }
    for (const payment of entry.payments) lines.push(`  ${seats2[payment.from] ?? "\uACF5\uD0C1"} \u2192 ${seats2[payment.to] ?? "\uACF5\uD0C1"}: ${payment.amount}\uC810`);
    for (const draw of entry.draws) lines.push(`  ${seats2[draw.seat]} ${draw.type === "kanDraw" ? "\uBCF4\uCDA9\uD328" : "\uBF51\uC740 \uD328"}: ${tileName(typeOf(draw.id))}`);
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
    for (const win of e.wins) {
      const extra = Object.entries(win.score.bonuses ?? {}).filter(([, value]) => typeof value === "number" && value).map(([name, value]) => `${{ kan: "\uAE61", dragon: "\uC0BC\uC6D0\uD328", roundWind: "\uC7A5\uD48D", seatWind: "\uC790\uD48D" }[name] ?? name} ${value}`);
      lines.push(s ? `${seats2[win.seat]} ${win.method === "ron" ? "\uB860" : "\uCBD4\uBAA8"} \xB7 ${scoreBreakdownText(win.score)}` : `${seats2[win.seat]} ${win.score.name} ${win.method === "ron" ? "\uB860" : "\uCBD4\uBAA8"} \xB7 \uC5ED ${win.score.base}${extra.length ? " + " + extra.join(" + ") : ""}${win.tsumoBonus ? " + \uCBD4\uBAA8 " + win.tsumoBonus + " / \uC9C0\uAE09\uC790" : ""}`);
    }
    for (const p of e.payments) lines.push(`  ${seats2[p.from] ?? "\uACF5\uD0C1"} \u2192 ${seats2[p.to] ?? "\uACF5\uD0C1"}: ${p.amount}\uC810`);
    for (const issue of e.issues) lines.push(`[\uC815\uC0B0 \uD655\uC778 \uD544\uC694] ${issue}`);
  }
  if (log.mode === "online") {
    for (const entry of log.observations) if (entry.delta.some(Boolean)) lines.push(`\uC218\uC2E0 ${entry.revision}: ${entry.delta.map((v, i) => v ? seats2[i] + " " + signed(v) : "").filter(Boolean).join(" / ")}`);
  }
  if (log.mode === "online" && s) for (const seat of game.winners) {
    const win = game.players[seat].win;
    lines.push(`${seats2[seat]} ${win.method === "ron" ? "\uB860" : "\uCBD4\uBAA8"} \xB7 ${scoreBreakdownText(win.score)}`);
  }
  return lines.join("\n");
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
    const event = game.events.find((e, i) => (e.n ?? i) === p.win.event);
    if (!event) throw new Error("\uD654\uB8CC \uAE30\uB85D \uCC38\uC870\uAC00 \uC798\uBABB\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    const { n, type, seat, ...win } = event;
    p.win = clone(win);
  }
  let previous = scores(log.initialGame), cursor2 = log.initialGame.ledger?.length ?? 0, active = log.initialGame.players.flatMap((p, i) => p.won ? [] : [i]), pot = log.initialGame.pot ?? 0;
  log.actions = log.actions.map((a, n) => {
    const after = a.scores ?? previous, end = cursor2 + (a.transfers ?? 0), snapshot = { ...game, players: game.players.map((p, i) => ({ ...p, score: after[i] })), events: game.events.slice(0, a.events[1]), ledger: game.ledger.slice(0, end) };
    const entry = { n, at: a.at, ...actionRecord(snapshot, a.seat, a.action, { scores: previous, active, events: a.events[0], ledger: cursor2, pot }, a.error) };
    entry.issues = a.issues ?? entry.issues;
    for (const p of entry.payments) {
      if (p.to === "pot") pot += p.amount;
      if (p.from === "pot") pot -= p.amount;
    }
    for (const w of entry.wins) active = active.filter((i) => i !== w.seat);
    previous = after;
    cursor2 = end;
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

// web/archive-client.mjs
var archiveOrigin = () => ["localhost", "127.0.0.1"].includes(globalThis.location?.hostname) ? "http://127.0.0.1:8790" : "https://wellness-mahjong-h-lab.chayhyeon.chatgpt.site";

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

// web/logs/app.mjs
var $ = (id) => document.getElementById(id);
var STORAGE = "mahjong-archive-operator-v1";
var api = archiveOrigin();
var key = "";
var cursor = null;
var selected = null;
var generation = 0;
var detailGeneration = 0;
var busy = false;
var node = (tag, text, cls) => {
  const el = document.createElement(tag);
  if (text !== void 0) el.textContent = text;
  if (cls) el.className = cls;
  return el;
};
function message(text) {
  $("archive-message").textContent = text;
}
function lock() {
  generation++;
  detailGeneration++;
  key = "";
  selected = null;
  cursor = null;
  try {
    sessionStorage.removeItem(STORAGE);
  } catch {
  }
  $("archive-content").hidden = true;
  $("archive-login").hidden = false;
  $("admin-code").value = "";
  $("archive-list").replaceChildren();
  $("detail-hands").replaceChildren();
  $("detail-review").textContent = "";
  $("detail-text").textContent = "";
  $("detail-title").textContent = "\uD328\uBCF4\uB97C \uC120\uD0DD\uD558\uC138\uC694";
  $("detail-meta").textContent = "";
  $("detail-actions").hidden = true;
  $("detail-history").hidden = true;
}
async function request(path) {
  const response = await fetch(api + path, { headers: { Authorization: "Bearer " + key }, signal: AbortSignal.timeout(15e3) });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) lock();
    throw new Error(data.error ?? "\uD328\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
  }
  return data;
}
function query(next) {
  const p = new URLSearchParams();
  for (const [name, id] of [["q", "search"], ["variant", "filter-variant"], ["mode", "filter-mode"], ["status", "filter-status"]]) {
    const value = $(id).value.trim();
    if (value) p.set(name, value);
  }
  if (next) p.set("cursor", next);
  return "/api/archives?" + p;
}
async function list(more = false) {
  if (busy) return;
  busy = true;
  const revision = ++generation;
  message("\uD328\uBCF4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\u2026");
  $("load-more").disabled = true;
  try {
    const data = await request(query(more ? cursor : null));
    if (revision !== generation) return;
    try {
      sessionStorage.setItem(STORAGE, key);
    } catch {
    }
    $("admin-code").value = "";
    $("archive-login").hidden = true;
    $("archive-content").hidden = false;
    if (!more) $("archive-list").replaceChildren();
    for (const log of data.logs) {
      const b = node("button", void 0, "archive-item");
      b.type = "button";
      b.dataset.id = log.id;
      b.setAttribute("aria-pressed", String(log.id === selected?.id));
      b.append(node("strong", `${log.variant} \xB7 ${log.mode === "practice" ? "\uD63C\uC790 \uC5F0\uC2B5" : "4\uC778"} \xB7 ${log.status === "in-progress" ? "\uC9C4\uD589 \uC911" : "\uC885\uB8CC"}`), node("span", new Date(log.startedAt).toLocaleString("ko-KR")), node("span", `\uD328\uBCF4 ${log.id.slice(0, 8)} \xB7 ${log.seed !== null ? "\uBC30\uD328 " + log.seed : "\uBC29 " + log.room}`), node("span", `\uB0B4 \uC790\uB9AC ${["\uB3D9", "\uB0A8", "\uC11C", "\uBD81"][log.seat]} \xB7 ${log.score > 0 ? "+" : ""}${log.score}\uC810${log.issues ? " \xB7 \uC624\uB958 \uAE30\uB85D " + log.issues + "\uAC74" : ""}`));
      b.onclick = () => void detail(log.id);
      $("archive-list").append(b);
    }
    cursor = data.cursor;
    $("load-more").hidden = !cursor;
    $("archive-empty").hidden = $("archive-list").children.length > 0;
    message(`\uD328\uBCF4 ${$("archive-list").children.length}\uAC74 \uD45C\uC2DC${cursor ? " \xB7 \uC774\uC804 \uAE30\uB85D\uC774 \uB354 \uC788\uC2B5\uB2C8\uB2E4" : ""}`);
  } catch (error) {
    if (revision === generation || !key) message(error.message === "Failed to fetch" ? "\uC11C\uBC84\uC5D0 \uC5F0\uACB0\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD558\uC138\uC694." : error.message);
  } finally {
    busy = false;
    $("load-more").disabled = false;
  }
}
async function detail(id) {
  const revision = ++detailGeneration;
  message("\uC0C1\uC138 \uD328\uBCF4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\u2026");
  try {
    const compact = await request("/api/archives/" + id);
    if (revision !== detailGeneration) return;
    selected = compact;
    const log = expandLog(compact), game = log.game;
    for (const b of $("archive-list").children) b.setAttribute("aria-pressed", String(b.dataset.id === id));
    $("detail-title").textContent = `${game.rules.variant === "S" ? "S" : "H"}\uB8F0 \xB7 \uD328\uBCF4 ${id.slice(0, 8)}`;
    $("detail-meta").textContent = `${id} \xB7 ${new Date(log.updatedAt).toLocaleString("ko-KR")} \uAE30\uC900 \xB7 ${log.mode === "practice" ? "\uD63C\uC790 \uC5F0\uC2B5" : "4\uC778 \uB300\uAD6D"} \xB7 \uD654\uBA74 \uBC84\uC804 ${log.build ?? "\uBBF8\uAE30\uB85D"}`;
    $("detail-hands").replaceChildren();
    for (const [seat, p] of game.players.entries()) {
      const box = node("section", void 0, "archive-hand"), rack = node("div", void 0, "archive-hand-tiles");
      box.append(node("p", `${["\uB3D9", "\uB0A8", "\uC11C", "\uBD81"][game.rules.variant === "S" ? (seat - game.dealer + 4) % 4 : seat]}${seat === log.humanSeat ? " \xB7 \uAE30\uB85D\uD55C \uC774\uC6A9\uC790" : ""} \xB7 ${p.hand.length ? "\uAE30\uB85D \uC2DC\uC810 \uC190\uD328" : "\uBE44\uACF5\uAC1C \uC190\uD328"}`));
      for (const id2 of p.hand) rack.append(tileFace(typeOf(id2), { small: true }));
      box.append(rack);
      $("detail-hands").append(box);
    }
    $("detail-review").textContent = reviewText(log);
    $("detail-text").textContent = logText(log);
    $("detail-actions").hidden = false;
    $("detail-history").hidden = false;
    message("\uD328\uBCF4\uB97C \uBD88\uB7EC\uC654\uC2B5\uB2C8\uB2E4.");
  } catch (error) {
    if (revision === detailGeneration || !key) message(error.message);
  }
}
function download(format) {
  if (!selected) return;
  const text = format === "json" ? JSON.stringify(selected) : logText(selected), a = node("a"), url = URL.createObjectURL(new Blob([text], { type: format === "json" ? "application/json" : "text/plain;charset=utf-8" }));
  a.href = url;
  a.download = `${selected.game.rules.variant === "S" ? "S" : "H"}-${selected.id}-\uB300\uAD6D\uB85C\uADF8.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
$("login-form").onsubmit = (e) => {
  e.preventDefault();
  key = $("admin-code").value.trim();
  void list();
};
$("filter-form").onsubmit = (e) => {
  e.preventDefault();
  void list();
};
$("load-more").onclick = () => void list(true);
$("archive-logout").onclick = () => {
  lock();
  message("\uD328\uBCF4 \uC870\uD68C\uB97C \uC7A0\uAC14\uC2B5\uB2C8\uB2E4.");
};
$("download-archive").onclick = () => download("json");
$("download-archive-text").onclick = () => download("txt");
try {
  key = sessionStorage.getItem(STORAGE) ?? "";
} catch {
}
if (key) void list();
