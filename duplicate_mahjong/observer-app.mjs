// duplicate/shared/tiles.mjs
var tileName = (t) => t < 27 ? `${t % 9 + 1}${["\uB9CC", "\uD1B5", "\uC0AD"][Math.floor(t / 9)]}` : ["\uB3D9", "\uB0A8", "\uC11C", "\uBD81", "\uBC31", "\uBC1C", "\uC911"][t - 27];

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

// duplicate/discard-metadata.mjs
function decorateDiscardTile(element2, discard, mode = "none") {
  const known = typeof discard?.tsumogiri === "boolean";
  element2.classList.toggle("is-tsumogiri", mode === "gray" && discard?.tsumogiri === true);
  const base = String(element2.title ?? "").replace(/ · (?:쯔모기리|테다시)$/, "");
  element2.title = base + (known && mode !== "none" ? ` \xB7 ${discard.tsumogiri ? "\uCBD4\uBAA8\uAE30\uB9AC" : "\uD14C\uB2E4\uC2DC"}` : "");
  element2.setAttribute("aria-label", element2.title);
  return element2;
}

// duplicate/winning-hand.mjs
var RED_IDS = /* @__PURE__ */ new Set([16, 52, 88]);
var seat = (value) => Number.isInteger(value) && value >= 0 && value < 4;
var physical = (value) => Number.isInteger(value) && value >= 0 && value < 136;
var object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var insist = (ok, message = "Invalid winning-hand presentation") => {
  if (!ok) throw new TypeError(message);
};
function tile(value) {
  insist(object(value) && physical(value.id));
  const type = Math.floor(value.id / 4);
  insist(value.type === type && (value.red === void 0 || typeof value.red === "boolean"));
  insist(value.red !== true || RED_IDS.has(value.id));
  return { id: value.id, type, red: value.red === true };
}
function meld(value) {
  insist(object(value) && ["chi", "pon", "kan"].includes(value.type) && typeof value.open === "boolean");
  insist(Number.isInteger(value.tile) && value.tile >= 0 && value.tile < 34 && Array.isArray(value.tiles));
  const tiles = value.tiles.map(tile), count = value.type === "kan" ? 4 : 3;
  insist(tiles.length === count);
  const types = tiles.map((t) => t.type).sort((a, b) => a - b), expected = value.type === "chi" ? [value.tile, value.tile + 1, value.tile + 2] : Array(count).fill(value.tile);
  insist(value.type !== "chi" || value.tile < 27 && value.tile % 9 <= 6);
  insist(types.every((type, index) => type === expected[index]));
  const result = { type: value.type, tile: value.tile, open: value.open, tiles };
  if (value.from !== void 0) {
    insist(seat(value.from));
    result.from = value.from;
  }
  return result;
}
function normalizeWinningHands(value) {
  if (value === void 0 || value === null) return [];
  insist(Array.isArray(value) && value.length <= 3);
  const seen = /* @__PURE__ */ new Set();
  const hands = value.map((row) => {
    insist(object(row) && seat(row.seat) && !seen.has(row.seat) && ["ron", "tsumo"].includes(row.method));
    seen.add(row.seat);
    insist(Array.isArray(row.tiles) && Array.isArray(row.melds) && row.melds.length <= 4);
    const tiles = row.tiles.map(tile), melds = row.melds.map(meld), winningTile = tile(row.winningTile);
    insist(tiles.length === 14 - 3 * melds.length);
    const all = [...tiles, ...melds.flatMap((m) => m.tiles)], ids = all.map((t) => t.id);
    insist(new Set(ids).size === ids.length && tiles.filter((t) => t.id === winningTile.id).length === 1);
    insist(tiles.some((t) => t.id === winningTile.id && t.type === winningTile.type && t.red === winningTile.red));
    return { seat: row.seat, method: row.method, tiles, melds, winningTile };
  });
  insist(hands.length <= 1 || hands.every((row) => row.method === "ron"));
  return hands;
}

// duplicate/winning-hand-view.mjs
function renderWinningHands(container, hands, { document: doc = container?.ownerDocument, dealer } = {}) {
  if (!container || !doc) throw new TypeError("Winning hands need a container and document");
  const normalized = normalizeWinningHands(hands);
  container.replaceChildren();
  container.hidden = normalized.length === 0;
  if (!normalized.length) return container;
  const node2 = (tag, className, text) => {
    const element2 = doc.createElement(tag);
    element2.className = className;
    if (text !== void 0) element2.textContent = text;
    return element2;
  };
  const face2 = (tile2, winning = false) => {
    const element2 = tileFace(tile2.type, { small: true });
    element2.classList.toggle("red", tile2.red);
    element2.classList.toggle("winning-hand-tile", winning);
    element2.dataset.tileId = String(tile2.id);
    const label = `${tile2.red ? "\uC801 " : ""}${tileName(tile2.type)}${winning ? " \xB7 \uD654\uB8CC\uD328" : ""}`;
    element2.title = label;
    element2.setAttribute("aria-label", label);
    return element2;
  };
  for (const hand of normalized) {
    const section = node2("section", "winning-hand");
    section.dataset.seat = String(hand.seat);
    const wind = Number.isInteger(dealer) && dealer >= 0 && dealer < 4 ? ` \xB7 ${["\u6771", "\u5357", "\u897F", "\u5317"][(hand.seat - dealer + 4) % 4]}` : "";
    section.append(node2("h4", "winning-hand-heading", `${hand.seat + 1}\uBC88 \uC790\uB9AC${wind} \xB7 ${hand.method === "ron" ? "\uB860" : "\uCBD4\uBAA8"}`));
    const row = node2("div", "winning-hand-tiles"), concealed = node2("div", "winning-hand-concealed");
    concealed.setAttribute("aria-label", "\uD654\uB8CC \uC190\uD328");
    const tiles = hand.tiles.filter((tile2) => tile2.id !== hand.winningTile.id).sort((a, b) => a.type - b.type || Number(a.red) - Number(b.red) || a.id - b.id);
    for (const tile2 of tiles) concealed.append(face2(tile2));
    const winning = node2("div", "winning-hand-winning-tile");
    winning.setAttribute("aria-label", "\uD654\uB8CC\uD328");
    winning.append(node2("span", "winning-hand-winning-label", "\uD654\uB8CC\uD328"), face2(hand.winningTile, true));
    row.append(concealed, winning);
    section.append(row);
    if (hand.melds.length) {
      const melds = node2("div", "winning-hand-melds");
      melds.setAttribute("aria-label", "\uD654\uB8CC \uD6C4\uB85C");
      for (const meld2 of hand.melds) {
        const group = node2("span", "winning-hand-meld");
        group.title = meld2.type === "chi" ? "\uCE58" : meld2.type === "pon" ? "\uD401" : meld2.open ? "\uBA85\uAE61" : "\uC548\uAE61";
        for (const tile2 of meld2.tiles) group.append(face2(tile2));
        melds.append(group);
      }
      section.append(melds);
    }
    container.append(section);
  }
  return container;
}

// duplicate/observer-view.mjs
var ACTIONS = { discard: "\uBC84\uB9BC", riichi: "\uB9AC\uCE58", call: "\uD6C4\uB85C", kan: "\uAE61", chi: "\uCE58", pon: "\uD401", minkan: "\uBA85\uAE61", ankan: "\uC548\uAE61", kakan: "\uAC00\uAE61", win: "\uD654\uB8CC", ron: "\uB860", tsumo: "\uCBD4\uBAA8" };
var PHASES = { skipped: "\uC774 \uBCF8\uC7A5 \uBBF8\uC9C4\uD589", "missing-record": "\uBCF8\uC7A5 \uAE30\uB85D \uC5C6\uC74C", lobby: "\uC2DC\uC791 \uB300\uAE30", playing: "\uB300\uAD6D \uC911", ended: "\uAD6D \uC885\uB8CC", complete: "\uC804\uCCB4 \uC885\uB8CC", turn: "\uB300\uAD6D \uC911", reaction: "\uC751\uB2F5 \uB300\uAE30", end: "\uAD6D \uC885\uB8CC" };
var validTile = (value) => Number.isInteger(value) && value >= 0 && value < 34;
var node = (doc, tag, cls, text) => {
  const el = doc.createElement(tag);
  el.className = cls;
  if (text !== void 0) el.textContent = String(text);
  return el;
};
var number = (value) => Number.isFinite(value) ? value.toLocaleString("ko-KR") : "\u2014";
function observerTime(value) {
  const date = new Date(value);
  return Number.isFinite(Number(value)) && Number(value) > 0 && !Number.isNaN(date.getTime()) ? date.toLocaleTimeString("ko-KR", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "\u2014";
}
function pageTables(tables, page = 0) {
  const count = Math.max(1, Math.ceil(tables.length / 4)), index = Math.min(count - 1, Math.max(0, Math.floor(page) || 0));
  return { tables: tables.slice(index * 4, index * 4 + 4), page: index, pages: count, total: tables.length };
}
function observerRoundLabel(table) {
  const board = table.board, honba = table.honba ?? table.game?.honba ?? 0, wind = table.handContext?.roundWind ?? table.game?.rules?.roundWind;
  return `${[27, 28, 29, 30].includes(wind) ? `${["\u6771", "\u5357", "\u897F", "\u5317"][wind - 27]}${(board - 1) % 4 + 1}\u5C40` : `${board ?? "\u2014"}\uAD6D`} ${honba}\uBCF8\uC7A5`;
}
function contextLabel(context) {
  return context ? `\uBCF8\uC7A5 ${context.honba ?? "\u2014"} \xB7 \uC2DC\uC791 \uACF5\uD0C1 ${number(context.pot)}\uC810 \xB7 \uC2DC\uC791 \uC810\uC218 ${(context.startingScores ?? []).map(number).join(" / ")} \xB7 \uCE5C ${Number(context.dealer) + 1}\uBC88` : "\uC2DC\uC791 \uC810\uC218\xB7\uACF5\uD0C1 \uB9E5\uB77D \uC815\uBCF4 \uC5C6\uC74C";
}
function face(doc, value, classes = "") {
  const tile2 = typeof value === "number" ? { type: value } : value, type = tile2?.type ?? tile2?.tile;
  if (!validTile(type)) return node(doc, "span", "obs-unknown-tile", "?");
  const el = tileFace(type, { small: true });
  el.classList.toggle("red", !!tile2.red);
  el.classList.toggle("riichi", !!tile2.riichi);
  el.classList.toggle("claimed", !!tile2.claimed);
  if (classes) el.classList.add(classes);
  return el;
}
function meldView(doc, meld2) {
  const box = node(doc, "span", "obs-meld"), kind = meld2.type ?? meld2.callType;
  box.title = ACTIONS[kind] ?? "\uD6C4\uB85C";
  if (meld2.hidden || meld2.tile === null) {
    for (let n = 0; n < 4; n++) box.append(node(doc, "span", "obs-tile-back"));
    return box;
  }
  const types = kind === "chi" ? [meld2.tile, meld2.tile + 1, meld2.tile + 2] : Array(kind === "kan" || ["ankan", "minkan", "kakan"].includes(kind) ? 4 : 3).fill(meld2.tile), tiles = meld2.tiles?.length ? meld2.tiles : types.map((type) => ({ type }));
  tiles.forEach((tile2, index) => {
    if ((kind === "kan" || kind === "ankan") && !meld2.open && (index === 0 || index === 3)) box.append(node(doc, "span", "obs-tile-back"));
    else box.append(face(doc, tile2));
  });
  return box;
}
function playerView(doc, table, player, { handsVisible, detail }) {
  const member = table.members?.find((m) => m.seat === player.seat), seat2 = player.seat, box = node(doc, "section", `obs-player${table.game?.actor === seat2 && table.game?.phase !== "end" ? " obs-active-player" : ""}`);
  const heading = node(doc, "div", "obs-player-heading"), name = node(doc, "strong", "obs-player-name", member?.name ?? `\uD50C\uB808\uC774\uC5B4 ${seat2 + 1}`);
  name.title = name.textContent;
  heading.append(node(doc, "span", "obs-wind", ["\u6771", "\u5357", "\u897F", "\u5317"][(seat2 - (table.game?.dealer ?? 0) + 4) % 4]), name);
  const flags = detail ? heading : node(doc, "div", "obs-compact-meta");
  if (member?.ai) flags.append(node(doc, "span", "obs-ai-label", "AI"));
  if (player.riichi) flags.append(node(doc, "span", "obs-riichi-label", "\uB9AC\uCE58"));
  if (player.won) flags.append(node(doc, "span", "obs-win-label", "\uD654\uB8CC"));
  if (table.game?.actor === seat2 && table.game?.phase !== "end") flags.append(node(doc, "span", "obs-turn-label", "\uCC28\uB840"));
  const points = node(doc, "span", "obs-points", number(player.points));
  points.title = "\uD604\uC7AC \uAD6D \uC810\uC218";
  heading.append(points);
  (detail ? heading : flags).append(node(doc, "span", `obs-score${player.score > 0 ? " positive" : player.score < 0 ? " negative" : ""}`, Number.isFinite(player.score) ? `\uAD6D ${player.score > 0 ? "+" : ""}${number(player.score)}` : "\uAD6D \u2014"));
  box.append(heading);
  const cumulative = table.cumulativeScores?.[seat2];
  if (Number.isFinite(cumulative)) (detail ? box : flags).append(node(doc, detail ? "div" : "span", "obs-cumulative", `${detail ? "\uB204\uC801 \uBCC0\uD654" : "\uB204\uC801"} ${cumulative > 0 ? "+" : ""}${number(cumulative)}`));
  if (!detail) {
    if (!handsVisible) flags.append(node(doc, "span", "obs-hand-count", `\uC190\uD328 \uBE44\uACF5\uAC1C ${Number(player.handSize) || 0}\uC7A5`));
    box.append(flags);
  }
  const hand = node(doc, "div", "obs-tiles obs-hand");
  hand.setAttribute("aria-label", handsVisible ? "\uC911\uACC4\uC790\uC6A9 \uC190\uD328" : "\uBE44\uACF5\uAC1C \uC190\uD328");
  if (handsVisible && Array.isArray(player.handTiles)) for (const tile2 of player.handTiles) hand.append(face(doc, tile2));
  else if (detail) {
    const count = Math.min(14, Math.max(0, Number(player.handSize) || 0));
    for (let n = 0; n < count; n++) hand.append(node(doc, "span", "obs-tile-back"));
    hand.append(node(doc, "span", "obs-hand-count", `\uBE44\uACF5\uAC1C ${Number(player.handSize) || 0}\uC7A5`));
  }
  const tiles = detail ? box : node(doc, "div", "obs-compact-tiles");
  if (detail || handsVisible) tiles.append(hand);
  if (player.melds?.length) {
    const melds = node(doc, "div", "obs-melds");
    for (const meld2 of player.melds) melds.append(meldView(doc, meld2));
    tiles.append(melds);
  }
  if (!detail && tiles.children.length) box.append(tiles);
  const river = node(doc, "div", "obs-tiles obs-river"), discards = detail ? player.river ?? [] : (player.river ?? []).slice(-6);
  river.setAttribute("aria-label", detail ? "\uC804\uCCB4 \uBC84\uB9BC\uD328" : "\uCD5C\uADFC \uBC84\uB9BC\uD328 \uCD5C\uB300 6\uC7A5");
  for (const tile2 of discards) river.append(decorateDiscardTile(face(doc, tile2), tile2, loadPreferences(globalThis.localStorage).discardDisplay));
  if (!discards.length) river.append(node(doc, "span", "obs-muted", "\uBC84\uB9BC\uD328 \uC5C6\uC74C"));
  if (!detail && (player.river?.length ?? 0) > 6) river.prepend(node(doc, "span", "obs-river-count", `\u2026 ${player.river.length}\uC7A5`));
  box.append(river);
  return box;
}
function eventLabel(event, table, { discardDisplay = "none" } = {}) {
  const member = table.members?.find((m) => m.seat === event.seat), kind = event.kind === "win" ? event.method : event.callType ?? event.kind;
  return `${member?.name ?? `${Number(event.seat) + 1}\uBC88 \uC790\uB9AC`} \xB7 ${kind === "discard" && discardDisplay === "text" && typeof event.tsumogiri === "boolean" ? event.tsumogiri ? "\uCBD4\uBAA8\uAE30\uB9AC" : "\uD14C\uB2E4\uC2DC" : ACTIONS[kind] ?? "\uACF5\uAC1C \uD589\uB3D9"}${validTile(event.tile) ? ` ${event.red ? "\uC801 " : ""}${tileName(event.tile)}` : ""}`;
}
function renderObserverTable(table, { handsVisible = false, detail = false, onDetail, document: doc = globalThis.document } = {}) {
  const card = node(doc, "article", `obs-table-card${detail ? " obs-table-detail" : " obs-overview-card"}`);
  card.dataset.tableId = table.id;
  const header = node(doc, "header", "obs-table-heading"), title = node(doc, "div", "");
  title.append(node(doc, "h2", "", `${table.id} \xB7 ${table.board ? observerRoundLabel(table) : "\uC900\uBE44"}`), node(doc, "span", "obs-captured", `\uD0C1 \uAE30\uB85D ${observerTime(table.capturedAt)}`));
  header.append(title, node(doc, "span", "obs-phase", PHASES[table.phase] ?? "\uAE30\uB85D \uB300\uAE30"));
  if (!detail && onDetail) {
    const button = node(doc, "button", "obs-detail-button", "\uC790\uC138\uD788 \u2197");
    button.type = "button";
    button.onclick = () => onDetail(table.id);
    header.append(button);
  }
  card.append(header);
  if (!table.game) {
    card.append(node(doc, "div", "obs-table-wait", table.phase === "missing-record" ? "\uC774 \uBCF8\uC7A5\uC758 \uAE30\uB85D\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uBBF8\uC9C4\uD589\uC774\uB098 0\uC810 \uACB0\uACFC\uB85C \uCC98\uB9AC\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : table.skipped ? "\uC774 \uD0C1\uC740 \uC774 \uBCF8\uC7A5\uC744 \uC9C4\uD589\uD558\uC9C0 \uC54A\uACE0 \uC9C0\uB098\uAC14\uC2B5\uB2C8\uB2E4. \uB300\uAD6D \uACB0\uACFC\uB97C \uB9CC\uB4E4\uC5B4 \uBE44\uAD50\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4." : table.waitingReason === "closure" ? "\uC774 \uAD6D\xB7\uBCF8\uC7A5\uC744 \uBAA8\uB4E0 \uCC38\uAC00 \uD0C1\uC774 \uB9C8\uCE58\uAC70\uB098 \uC9C0\uB098\uAC08 \uB54C\uAE4C\uC9C0 \uAE30\uB85D\uC744 \uBCF4\uD638\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4." : "\uC9C0\uC5F0 \uAE30\uC900 \uC2DC\uAC01\uC5D0 \uD45C\uC2DC\uD560 \uB300\uAD6D \uAE30\uB85D\uC744 \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC2B5\uB2C8\uB2E4."));
    return card;
  }
  const game = table.game, felt = node(doc, "div", "obs-felt"), meta = node(doc, "div", "obs-table-meta");
  meta.title = contextLabel(table.handContext);
  meta.append(node(doc, "span", "", `\uCE5C ${Number(game.dealer) + 1}\uBC88 \xB7 ${PHASES[game.phase] ?? "\uB300\uAD6D"} \xB7 \uCBD4\uBAA8 ${game.draws ?? "\u2014"}\uD68C`), node(doc, "span", "", `\uB0A8\uC740 \uD328 ${game.wallRemaining ?? "\u2014"} \xB7 \uB9AC\uCE58\uBD09 ${(game.pot ?? 0) / 1e3}\uAC1C`));
  felt.append(meta);
  const dora = node(doc, "div", "obs-dora");
  dora.append(node(doc, "span", "obs-muted", "\uB3C4\uB77C \uD45C\uC2DC\uD328"));
  for (const tile2 of game.doraIndicators ?? []) dora.append(face(doc, tile2));
  if (!game.doraIndicators?.length) dora.append(node(doc, "span", "obs-muted", "\uC5C6\uC74C"));
  felt.append(dora);
  const players = node(doc, "div", "obs-players");
  for (const player of [...game.players ?? []].sort((a, b) => a.seat - b.seat)) players.append(playerView(doc, table, player, { handsVisible, detail }));
  felt.append(players);
  card.append(felt);
  if (detail) card.append(node(doc, "p", "obs-hand-context", contextLabel(table.handContext)));
  const recent = node(doc, "ol", "obs-recent");
  recent.setAttribute("aria-label", "\uCD5C\uADFC \uACF5\uAC1C \uD589\uB3D9");
  for (const event of (game.publicEvents ?? []).slice(detail ? -8 : -3).reverse()) recent.append(node(doc, "li", "", eventLabel(event, table, loadPreferences(globalThis.localStorage))));
  if (!recent.children.length) recent.append(node(doc, "li", "obs-muted", "\uC544\uC9C1 \uACF5\uAC1C \uD589\uB3D9\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."));
  card.append(recent);
  if (game.end) card.append(node(doc, "p", "obs-end", typeof game.end === "string" ? { "win": "\uD654\uB8CC", "exhaustive-draw": "\uC720\uAD6D", "four-kans": "\uC0AC\uAE61\uC0B0\uB8CC" }[game.end] ?? "\uAD6D \uC885\uB8CC" : "\uAD6D \uC885\uB8CC"));
  if (detail && game.end === "win" && game.winningHands?.length) {
    const hands = node(doc, "div", "winning-hands");
    renderWinningHands(hands, game.winningHands, { document: doc, dealer: game.dealer });
    card.append(hands);
  }
  return card;
}
function renderObserverComparison(model, { document: doc = globalThis.document } = {}) {
  const root = node(doc, "div", "obs-comparison-result"), summary = node(doc, "p", "obs-comparison-summary", `${model.board ?? "\u2014"}\uAD6D \xB7 ${model.honba ?? 0}\uBCF8\uC7A5 \xB7 ${model.tableIds?.length ?? 0}\uD0C1 \xB7 \uD655\uC778\uB41C \uB2E4\uB978 \uC120\uD0DD ${model.summary?.differenceCount ?? 0}\uAC1C`);
  root.append(summary);
  root.append(node(doc, "p", "obs-comparison-note", model.summary?.contextsMatched ? "\uBCF8\uC7A5\xB7\uC2DC\uC791 \uC810\uC218\xB7\uACF5\uD0C1 \uB9E5\uB77D\uC774 \uC77C\uCE58\uD569\uB2C8\uB2E4. \uC774\uD6C4 \uC190\uD328\uC640 \uC120\uD0DD\uC9C0\uB294 \uC9C4\uD589\uC5D0 \uB530\uB77C \uB2EC\uB77C\uC9D1\uB2C8\uB2E4." : "\uAC19\uC740 \uBC30\uD328\uB77C\uB3C4 \uC2DC\uC791 \uC810\uC218\xB7\uACF5\uD0C1 \uB9E5\uB77D\uC740 \uB2E4\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uC804\uCCB4 \uC758\uC0AC\uACB0\uC815 \uC870\uAC74\uC758 \uC77C\uCE58\uB97C \uB73B\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4."));
  for (const note of model.notes ?? []) root.append(node(doc, "p", "obs-comparison-note", note));
  const wrap = node(doc, "div", "obs-comparison-scroll"), table = node(doc, "table", "obs-comparison-table"), head = node(doc, "thead", ""), headRow = node(doc, "tr", "");
  headRow.append(node(doc, "th", "", "\uC790\uB9AC / \uC120\uD0DD \uC21C\uBC88"));
  for (const id of model.tableIds ?? []) headRow.append(node(doc, "th", "", id));
  head.append(headRow);
  table.append(head);
  const body = node(doc, "tbody", "");
  for (const row of model.rows ?? []) {
    const tr = node(doc, "tr", row.isDifference ? "obs-difference-row" : "");
    tr.append(node(doc, "th", "", comparisonRowLabel(row)));
    for (const id of model.tableIds ?? []) {
      const choice2 = row.choices?.find((c) => c.tableId === id), cell = node(doc, "td", `obs-choice-${choice2?.status ?? "pending"}`);
      cell.append(node(doc, "span", "", choice2?.label ?? "\uAE30\uB85D \uB300\uAE30"));
      if (choice2?.result && validTile(choice2.result.tile)) cell.append(face(doc, choice2.result));
      tr.append(cell);
    }
    body.append(tr);
  }
  table.append(body);
  wrap.append(table);
  root.append(wrap);
  if (!model.rows?.length) root.append(node(doc, "div", "obs-empty", "\uD604\uC7AC \uD544\uD130\uC5D0\uC11C \uBE44\uAD50\uD560 \uACF5\uAC1C \uC120\uD0DD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC9C0\uC5F0 \uAE30\uB85D\uC774 \uC313\uC774\uBA74 \uD45C\uC2DC\uB429\uB2C8\uB2E4."));
  const scores = node(doc, "div", "obs-comparison-scores");
  for (const t of model.tables ?? []) {
    const line = node(doc, "div", "");
    line.append(node(doc, "b", "", `${t.id} \xB7 ${observerRoundLabel(t)}${t.status === "other-deal" ? " \xB7 \uB2E4\uB978 \uBCF8\uC7A5" : ""}`), node(doc, "span", "", contextLabel(t.handContext)));
    for (const p of t.points ?? []) line.append(node(doc, "span", "", `${p.name ?? `${p.seat + 1}\uBC88`} \xB7 \uD604\uC7AC ${number(p.points)} \xB7 \uAD6D ${p.score > 0 ? "+" : ""}${number(p.score)} \xB7 \uB204\uC801 ${p.cumulativeScore > 0 ? "+" : ""}${number(p.cumulativeScore)}`));
    scores.append(line);
  }
  root.append(scores);
  return root;
}
function comparisonRowLabel(row) {
  const seat2 = `${Number(row.seat) + 1}\uBC88`, draw = row.index === 0 ? "\uCBD4\uBAA8 \uC804" : Number.isInteger(row.index) ? `\uCBD4\uBAA8 ${row.index} \uB4A4` : "\uCBD4\uBAA8 \uC21C\uBC88 \uBBF8\uD655\uC778";
  const suffix = row.occurrence > 1 ? ` (${row.occurrence}\uBC88\uC9F8 \uC120\uD0DD)` : "";
  if (row.scope === "discard-trigger") {
    const tile2 = validTile(row.trigger?.tile) ? ` \xB7 ${tileName(row.trigger.tile)}` : "";
    return `${seat2}\uC758 \uBC84\uB9BC\uD328 \uD6C4\uB85C \uACB0\uACFC${tile2}${row.index !== null && row.index !== void 0 ? ` \xB7 \uBC84\uB9BC ${row.index}` : ""}${suffix}`;
  }
  if (row.scope === "self-kan") return `${seat2} \xB7 ${draw} \uC790\uC2E0\uC758 \uAE61${suffix}`;
  return `${seat2} \xB7 ${row.alignment === "draw" ? `${draw} \uBC84\uB9BC` : `\uBC84\uB9BC ${row.index ?? "\u2014"}`}${suffix}`;
}

// duplicate/observer-comparison.mjs
var seatOK = (n) => Number.isInteger(n) && n >= 0 && n < 4;
var indexOK = (n) => Number.isSafeInteger(n) && n >= 0;
var boardOK = (n) => Number.isSafeInteger(n) && n >= 1;
var tileOK = (n) => Number.isInteger(n) && n >= 0 && n < 34;
var physical2 = (n) => Number.isInteger(n) && n >= 0 && n < 136 ? n : null;
var number2 = (n) => Number.isFinite(n) ? n : null;
var winds = ["\uB3D9", "\uB0A8", "\uC11C", "\uBD81"];
var callNames = { chi: "\uCE58", pon: "\uD401", minkan: "\uB300\uBA85\uAE61", ankan: "\uC554\uAE61", kakan: "\uAC00\uAE61" };
var notes = [
  "\uAC19\uC740 \uAD6D\xB7\uAC19\uC740 \uBCF8\uC7A5\xB7\uAC19\uC740 \uC790\uB9AC\uC758 \uACF5\uAC1C \uACB0\uACFC\uB97C \uBE44\uAD50\uD569\uB2C8\uB2E4. \uC774\uC804 \uB300\uAD6D \uC218\uB098 \uC5F0\uC7A5 \uD68C\uCC28\uAC00 \uB2EC\uB77C\uB3C4 \uAC19\uC740 \uAD6D\xB7\uBCF8\uC7A5\uC740 \uAC19\uC740 \uD328\uC0B0\uC785\uB2C8\uB2E4.",
  "\uAC19\uC740 \uAD6D\xB7\uBCF8\uC7A5\uC774\uB77C\uB3C4 \uC2DC\uC791 \uC810\uC218\xB7\uACF5\uD0C1\uC740 \uD0C1\uB9C8\uB2E4 \uB2E4\uB97C \uC218 \uC788\uC2B5\uB2C8\uB2E4. \uADF8 \uCC28\uC774\uB97C \uC2E4\uB825 \uCC28\uC774\uB098 \uC644\uC804\uD788 \uAC19\uC740 \uC810\uC218 \uC870\uAC74\uC73C\uB85C \uD574\uC11D\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
  "\uAC1C\uC778 \uCBD4\uBAA8 \uBC88\uD638\uAC00 \uAC19\uC544\uB3C4 \uD6C4\uB85C \uC774\uD6C4 \uC190\uD328\xB7\uC21C\uC11C\xB7\uC120\uD0DD \uB9E5\uB77D\uC740 \uB2EC\uB77C\uC9D1\uB2C8\uB2E4. \uAC19\uC740 \uBC88\uD638\uB294 \uB3D9\uC77C\uD55C \uC120\uD0DD\uC9C0\uB098 \uC2E4\uB825\uC744 \uB73B\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
  "\uD6C4\uB85C \uD589\uC758 \uC88C\uC11D\uC740 \uC6D0\uC778 \uBC84\uB9BC\uD328\uB97C \uB0B8 \uC88C\uC11D\uC785\uB2C8\uB2E4. \uAC19\uC740 \uC2E4\uBB3C \uBC84\uB9BC\uD328 \uB610\uB294 \uD655\uC778 \uAC00\uB2A5\uD55C \uBC84\uB9BC\uD328 \uC21C\uC11C\xB7\uD328\uB9CC \uBB36\uC2B5\uB2C8\uB2E4.",
  "\uD6C4\uB85C \uACB0\uACFC \uC5C6\uC74C\uC740 \uD574\uB2F9 \uBC84\uB9BC\uD328\uC758 \uBC18\uC751\uC774 \uB05D\uB09C \uB4A4 \uC218\uB77D\uB41C \uD6C4\uB85C\uAC00 \uC5C6\uB2E4\uB294 \uB73B\uC785\uB2C8\uB2E4. \uD328\uC2A4 \uC758\uB3C4\xB7\uD6C4\uB85C \uAC00\uB2A5 \uC5EC\uBD80\xB7\uD0C8\uB77D\uD55C \uC694\uCCAD\uC740 \uCD94\uCE21\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.",
  "\uB3C4\uB2EC \uC804\xB7\uB2E4\uB978 \uAD6D\xB7\uB2E4\uB978 \uBCF8\uC7A5\xB7\uBBF8\uC9C4\uD589 \uBCF8\uC7A5\xB7\uAE30\uB85D \uC5C6\uC74C\uC740 \uCC28\uC774\uB85C \uC138\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uB204\uC801 \uC810\uC218\uB294 \uC11C\uBC84\uAC00 \uC81C\uACF5\uD55C \uB204\uC801\uAC12\uB9CC \uD45C\uC2DC\uD569\uB2C8\uB2E4."
];
function eventView(e, order) {
  if (!e || !seatOK(e.seat) || !["discard", "call", "kan", "riichi", "win"].includes(e.kind)) return null;
  const result = {
    kind: e.kind,
    seat: e.seat,
    tile: tileOK(e.tile) ? e.tile : null,
    tileId: physical2(e.tileId),
    red: e.red === true,
    source: seatOK(e.source) ? e.source : null,
    sourceTileId: physical2(e.sourceTileId),
    callType: Object.hasOwn(callNames, e.callType) ? e.callType : null,
    method: ["ron", "tsumo"].includes(e.method) ? e.method : null,
    drawIndex: indexOK(e.drawIndex) ? e.drawIndex : null,
    discardIndex: indexOK(e.discardIndex) ? e.discardIndex : null,
    sourceDiscardIndex: indexOK(e.sourceDiscardIndex) ? e.sourceDiscardIndex : null
  };
  if (Array.isArray(e.tiles)) result.tiles = e.tiles.filter((t) => tileOK(t?.type)).map((t) => ({ type: t.type, red: t.red === true }));
  return { result, order };
}
function defaultBoard(dto, tables) {
  if (boardOK(dto?.board)) return dto.board;
  const counts = /* @__PURE__ */ new Map();
  for (const table of tables) if (boardOK(table.board)) counts.set(table.board, (counts.get(table.board) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
}
var repeatOf = (table) => indexOK(table?.repeat) ? table.repeat : 0;
var honbaOf = (table) => indexOK(table?.honba ?? table?.game?.honba) ? table.honba ?? table.game.honba : 0;
function defaultHonba(tables, board) {
  const counts = /* @__PURE__ */ new Map();
  for (const table of tables) if (table.board === board) {
    const honba = honbaOf(table);
    counts.set(honba, (counts.get(honba) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? 0;
}
function contextView(t) {
  const c = t.handContext;
  if (!c || !indexOK(c.honba) || !indexOK(c.pot) || !seatOK(c.dealer) || !Number.isInteger(c.roundWind) || c.roundWind < 27 || c.roundWind > 30 || !Array.isArray(c.startingScores) || c.startingScores.length !== 4 || !c.startingScores.every(Number.isSafeInteger)) return null;
  return { honba: c.honba, pot: c.pot, dealer: c.dealer, roundWind: c.roundWind, startingScores: [...c.startingScores] };
}
function getTables(dto) {
  const tables = [], ids = /* @__PURE__ */ new Set();
  for (const t of Array.isArray(dto?.tables) ? dto.tables : []) {
    if (!t || typeof t.id !== "string" || ids.has(t.id)) continue;
    ids.add(t.id);
    tables.push(t);
  }
  for (const id of Array.isArray(dto?.waitingTables) ? dto.waitingTables : []) {
    if (typeof id !== "string" || ids.has(id)) continue;
    ids.add(id);
    tables.push({ id, board: null, phase: "waiting", game: null });
  }
  return tables;
}
function pointRows(t) {
  return Array.from({ length: 4 }, (_, seat2) => {
    const player = t.game?.players?.find((p) => p?.seat === seat2), member = t.members?.find((m) => m?.seat === seat2);
    return {
      seat: seat2,
      name: typeof member?.name === "string" ? member.name : `${winds[seat2]} \uC88C\uC11D`,
      points: number2(player?.points),
      score: number2(player?.score),
      cumulativeScore: number2(t.cumulativeScores?.[seat2])
    };
  });
}
function prepare(t, board, honba, alignment) {
  const skipped = t.skipped === true || t.phase === "skipped";
  const hasHistory = !skipped && Array.isArray(t.game?.publicEvents);
  const events = hasHistory ? t.game.publicEvents.map(eventView).filter(Boolean) : [];
  const discards = events.filter((e) => e.result.kind === "discard"), bySlot = /* @__PURE__ */ new Map(), occurrences = /* @__PURE__ */ new Map();
  for (const e of discards) {
    const index = e.result[alignment === "draw" ? "drawIndex" : "discardIndex"];
    if (index === null) continue;
    const key = `${e.result.seat}:${index}`, occurrence = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrence);
    bySlot.set(`${key}:${occurrence}`, e);
  }
  return {
    t,
    events,
    discards,
    bySlot,
    hasHistory,
    skipped,
    sameBoard: t.board === board,
    honbaMatch: honbaOf(t) === honba,
    boardMatch: t.board === board && honbaOf(t) === honba,
    waiting: !t.game && !boardOK(t.board),
    ended: !!t.game?.end || ["end", "ended", "complete"].includes(t.game?.phase) || ["ended", "complete"].includes(t.phase)
  };
}
var tileLabel = (r) => r.tile === null ? "\uD328 \uC815\uBCF4 \uC5C6\uC74C" : `${r.red ? "\uC801 " : ""}${tileName(r.tile)}`;
function resultLabel(r) {
  if (r.kind === "discard") return `${tileLabel(r)} \uD0C0\uD328`;
  const tiles = r.tiles?.map((t) => `${t.red ? "\uC801 " : ""}${tileName(t.type)}`).join(" ");
  return `${winds[r.seat]} ${callNames[r.callType] ?? "\uD6C4\uB85C"} \xB7 ${tileLabel(r)}${tiles ? ` (${tiles})` : ""}`;
}
function choice(tableId, status, result = null, label) {
  return { tableId, status, result, label: label ?? (result ? resultLabel(result) : {
    pending: "\uC544\uC9C1 \uD574\uB2F9 \uACB0\uACFC\uC5D0 \uB3C4\uB2EC\uD558\uC9C0 \uC54A\uC74C",
    "other-board": "\uB2E4\uB978 \uAD6D",
    "other-deal": "\uB2E4\uB978 \uBCF8\uC7A5",
    "missing-record": "\uD574\uB2F9 \uACF5\uAC1C \uAE30\uB85D \uC5C6\uC74C",
    skipped: "\uC774 \uBCF8\uC7A5 \uBBF8\uC9C4\uD589",
    "no-call": "\uD6C4\uB85C \uACB0\uACFC \uC5C6\uC74C"
  }[status]) };
}
function unavailable(p) {
  if (p.skipped) return choice(p.t.id, "skipped");
  if (p.t.phase === "missing-record") return choice(p.t.id, "missing-record", null, "\uC774 \uBCF8\uC7A5\uC758 \uAE30\uB85D\uC744 \uD655\uC778\uD560 \uC218 \uC5C6\uC74C");
  if (p.waiting) return choice(p.t.id, "pending", null, "\uC9C0\uC5F0\uB41C \uACF5\uAC1C \uD654\uBA74\uC744 \uAE30\uB2E4\uB9AC\uB294 \uC911");
  if (!p.sameBoard) return choice(p.t.id, "other-board");
  if (!p.honbaMatch) return choice(p.t.id, "other-deal");
  if (!p.t.game) return choice(p.t.id, "pending");
  if (!p.hasHistory) return choice(p.t.id, "missing-record");
  return null;
}
function signature(c) {
  if (c.status === "no-call") return "no-call";
  if (c.status !== "result") return null;
  const r = c.result;
  return JSON.stringify(r.kind === "discard" ? [r.tile, r.red] : [r.kind, r.seat, r.callType, r.tile, r.red, (r.tiles ?? []).map((t) => [t.type, t.red]).sort((a, b) => a[0] - b[0] || Number(a[1]) - Number(b[1]))]);
}
function finish(row, choices) {
  const known = choices.map(signature).filter((s) => s !== null), unique = new Set(known), pending = choices.some((c) => c.status === "pending");
  const isDifference = unique.size > 1, status = isDifference ? "difference" : known.length >= 2 ? "common" : pending ? "pending" : "single";
  const common = unique.size === 1 && known.length >= 2 ? choices.find((c) => signature(c) !== null) : null;
  return {
    ...row,
    status,
    isDifference,
    commonChoice: common?.result ?? null,
    commonLabel: common?.label ?? null,
    resolvedCount: known.length,
    hasPending: pending,
    choices
  };
}
function discardRows(prepared, seatFilter, alignment) {
  const slots = /* @__PURE__ */ new Map();
  for (const p of prepared) if (p.boardMatch) for (const [key, e] of p.bySlot) {
    if (seatFilter !== null && e.result.seat !== seatFilter) continue;
    const [seat2, index, occurrence] = key.split(":").map(Number);
    slots.set(key, { seat: seat2, index, occurrence });
  }
  return [...slots].map(([key, slot]) => finish({ id: `discard:${alignment}:${key}`, type: "discard", scope: "discard", ...slot, alignment, trigger: null }, prepared.map((p) => {
    const absent = unavailable(p);
    if (absent) return absent;
    const e = p.bySlot.get(key);
    if (e) return choice(p.t.id, "result", e.result);
    const own = p.discards.filter((e2) => e2.result.seat === slot.seat), field = alignment === "draw" ? "drawIndex" : "discardIndex";
    const past = own.some((e2) => e2.result[field] !== null && e2.result[field] > slot.index);
    const incomplete = own.some((e2) => e2.result[field] === null);
    return choice(p.t.id, p.ended || past || incomplete ? "missing-record" : "pending");
  })));
}
function triggerOf(r) {
  if (!seatOK(r.source)) return null;
  const tileId = r.sourceTileId ?? r.tileId;
  return { source: r.source, tile: r.tile, tileId, sourceDiscardIndex: r.sourceDiscardIndex };
}
var fallbackKey = (t) => t.sourceDiscardIndex !== null && t.tile !== null ? `${t.source}:${t.sourceDiscardIndex}:${t.tile}` : null;
var physicalKey = (t) => t.tileId !== null ? `${t.source}:${t.tileId}` : null;
function triggerMatches(t, r, allowFallback = true) {
  const source = r.kind === "discard" ? r.seat : r.source;
  if (source !== t.source) return false;
  const id = r.kind === "discard" ? r.tileId : r.sourceTileId ?? r.tileId;
  if (t.tileId !== null && id !== null) return t.tileId === id;
  if (!allowFallback) return false;
  const index = r.kind === "discard" ? r.discardIndex : r.sourceDiscardIndex;
  return t.sourceDiscardIndex !== null && index === t.sourceDiscardIndex && t.tile !== null && r.tile === t.tile;
}
function pendingMatches(t, pending) {
  if (!pending || pending.kind !== "discard" || pending.source !== t.source) return false;
  const id = physical2(pending.tileId);
  if (t.tileId !== null && id !== null) return t.tileId === id;
  return t.sourceDiscardIndex !== null && pending.sourceDiscardIndex === t.sourceDiscardIndex;
}
function triggerRows(prepared, seatFilter) {
  const groups = /* @__PURE__ */ new Map(), unknown = [];
  for (const p of prepared) if (p.boardMatch) for (const e of p.events) {
    const r = e.result;
    if (!["call", "kan"].includes(r.kind) || !seatOK(r.source) || !["chi", "pon", "minkan"].includes(r.callType)) continue;
    if (seatFilter !== null && r.source !== seatFilter) continue;
    const trigger = triggerOf(r), key = physicalKey(trigger);
    if (key) {
      if (!groups.has(key)) groups.set(key, { trigger, origins: [] });
      groups.get(key).origins.push([p, e]);
    } else unknown.push({ p, e, trigger });
  }
  const physicalFallbacks = /* @__PURE__ */ new Map();
  for (const [key, g] of groups) {
    const fallback = fallbackKey(g.trigger);
    if (fallback) {
      if (!physicalFallbacks.has(fallback)) physicalFallbacks.set(fallback, /* @__PURE__ */ new Set());
      physicalFallbacks.get(fallback).add(key);
    }
  }
  for (const { p, e, trigger } of unknown) {
    const fallback = fallbackKey(trigger), matches = fallback ? [...groups].filter(([, g]) => fallbackKey(g.trigger) === fallback) : [];
    const key = matches.length === 1 ? matches[0][0] : `fallback:${fallback ?? `${p.t.id}:${e.order}`}`;
    if (!groups.has(key)) groups.set(key, { trigger, origins: [] });
    groups.get(key).origins.push([p, e]);
  }
  return [...groups].map(([key, { trigger, origins }]) => finish({
    id: `call:trigger:${key}`,
    type: "call",
    scope: "discard-trigger",
    seat: trigger.source,
    index: trigger.sourceDiscardIndex,
    occurrence: 1,
    alignment: "trigger",
    trigger
  }, prepared.map((p) => {
    const absent = unavailable(p);
    if (absent) return absent;
    const own = origins.find(([origin]) => origin === p)?.[1];
    if (own) return choice(p.t.id, "result", own.result);
    const allowFallback = (physicalFallbacks.get(fallbackKey(trigger))?.size ?? 0) <= 1;
    const accepted = p.events.find((e) => ["call", "kan"].includes(e.result.kind) && ["chi", "pon", "minkan"].includes(e.result.callType) && triggerMatches(trigger, e.result, allowFallback));
    if (accepted) return choice(p.t.id, "result", accepted.result);
    const seen = p.discards.find((e) => triggerMatches(trigger, e.result, allowFallback));
    if (seen) {
      if (!Object.hasOwn(p.t.game, "pendingReaction")) return choice(p.t.id, "missing-record", null, "\uBC84\uB9BC\uD328 \uBC18\uC751 \uC885\uB8CC \uC815\uBCF4 \uC5C6\uC74C");
      return choice(
        p.t.id,
        pendingMatches(trigger, p.t.game.pendingReaction) ? "pending" : "no-call",
        null,
        pendingMatches(trigger, p.t.game.pendingReaction) ? "\uD574\uB2F9 \uBC84\uB9BC\uD328\uC758 \uBC18\uC751 \uB300\uAE30 \uC911" : void 0
      );
    }
    const past = trigger.sourceDiscardIndex !== null && p.discards.some((e) => e.result.seat === trigger.source && e.result.discardIndex >= trigger.sourceDiscardIndex);
    return choice(p.t.id, p.ended || past ? "missing-record" : "pending", null, p.ended || past ? "\uB3D9\uC77C \uC6D0\uC778 \uBC84\uB9BC\uD328 \uAE30\uB85D \uC5C6\uC74C" : void 0);
  })));
}
function selfKanRows(prepared, seatFilter) {
  const slots = /* @__PURE__ */ new Map(), byTable = /* @__PURE__ */ new Map();
  for (const p of prepared) {
    const own = /* @__PURE__ */ new Map(), counts = /* @__PURE__ */ new Map();
    byTable.set(p, own);
    if (!p.boardMatch) continue;
    for (const e of p.events) {
      const r = e.result;
      if (r.kind !== "kan" || !["ankan", "kakan"].includes(r.callType) || r.drawIndex === null || seatFilter !== null && r.seat !== seatFilter) continue;
      const prefix = `${r.seat}:${r.drawIndex}`, occurrence = (counts.get(prefix) ?? 0) + 1;
      counts.set(prefix, occurrence);
      const key = `${prefix}:${occurrence}`;
      own.set(key, e);
      slots.set(key, { seat: r.seat, index: r.drawIndex, occurrence });
    }
  }
  return [...slots].map(([key, slot]) => finish({ id: `call:self:${key}`, type: "call", scope: "self-kan", ...slot, alignment: "draw", trigger: null }, prepared.map((p) => {
    const absent = unavailable(p);
    if (absent) return absent;
    const e = byTable.get(p).get(key);
    if (e) return choice(p.t.id, "result", e.result);
    const past = p.events.some((e2) => e2.result.seat === slot.seat && e2.result.drawIndex !== null && e2.result.drawIndex > slot.index);
    return choice(p.t.id, p.ended || past ? "no-call" : "pending", null, p.ended || past ? "\uD574\uB2F9 \uAC1C\uC778 \uCBD4\uBAA8 \uBC88\uD638\uC758 \uC790\uCCB4 \uAE61 \uACB0\uACFC \uC5C6\uC74C" : void 0);
  })));
}
function buildObserverComparison(dto = {}, options = {}) {
  const input = getTables(dto), board = Object.hasOwn(options, "board") && options.board !== void 0 ? boardOK(options.board) ? options.board : null : defaultBoard(dto, input);
  const honba = Object.hasOwn(options, "honba") && options.honba !== void 0 ? indexOK(options.honba) ? options.honba : null : defaultHonba(input, board);
  const handId = board !== null && honba !== null ? `${board}:${honba}` : null;
  const seat2 = seatOK(options.seat) ? options.seat : null, alignment = options.alignment === "discard" ? "discard" : "draw";
  const type = ["discard", "call"].includes(options.type) ? options.type : "all";
  const prepared = input.map((t) => prepare(t, board, honba, alignment));
  const tables = prepared.map((p) => ({
    id: p.t.id,
    board: boardOK(p.t.board) ? p.t.board : null,
    repeat: repeatOf(p.t),
    handId: boardOK(p.t.board) ? `${p.t.board}:${honbaOf(p.t)}` : null,
    honba: honbaOf(p.t),
    handContext: contextView(p.t),
    phase: typeof p.t.phase === "string" ? p.t.phase : "waiting",
    skipped: p.skipped,
    revision: indexOK(p.t.revision) ? p.t.revision : null,
    capturedAt: number2(p.t.capturedAt),
    points: pointRows(p.t),
    status: p.skipped ? "skipped" : p.t.phase === "missing-record" ? "missing-record" : p.waiting ? "pending" : !p.sameBoard ? "other-board" : !p.honbaMatch ? "other-deal" : !p.t.game ? "pending" : !p.hasHistory ? "missing-record" : "available"
  }));
  let all = handId === null ? [] : [
    ...type !== "call" ? discardRows(prepared, seat2, alignment) : [],
    ...type !== "discard" ? [...triggerRows(prepared, seat2), ...selfKanRows(prepared, seat2)] : []
  ];
  all = all.map((row) => ({ ...row, id: `${handId}:${row.id}` }));
  all.sort((a, b) => a.seat - b.seat || (a.index ?? Infinity) - (b.index ?? Infinity) || a.occurrence - b.occurrence || a.id.localeCompare(b.id));
  const rows = options.differencesOnly ? all.filter((r) => r.isDifference) : all;
  const contexts = tables.filter((t) => t.status === "available").map((t) => t.handContext);
  const contextsMatched = contexts.length >= 2 && contexts.every(Boolean) && new Set(contexts.map((c) => JSON.stringify(c))).size === 1;
  return {
    board,
    honba,
    handId,
    tableIds: tables.map((t) => t.id),
    tables,
    rows,
    summary: {
      rowCount: rows.length,
      visibleRowCount: rows.length,
      totalRowCount: all.length,
      contextsMatched,
      differenceCount: all.filter((r) => r.isDifference).length,
      commonCount: all.filter((r) => r.status === "common").length,
      pendingCount: all.filter((r) => r.hasPending).length,
      tablePoints: tables.map((t) => ({ tableId: t.id, board: t.board, honba: t.honba, repeat: t.repeat, handId: t.handId, points: t.points.map((p) => ({ ...p })) }))
    },
    notes: [...notes]
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
    const canonical = observerDelaySeconds(value);
    input.value = observerDelayValue(canonical, unit);
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
function tournamentNavigationLinks({ baseUrl, server, defaultServer = "https://wellness-mahjong-h-lab.chayhyeon.chatgpt.site" }) {
  const api = new URL(server);
  if (api.username || api.password || api.pathname !== "/" || api.search || api.hash || !["https:", "http:"].includes(api.protocol) || api.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(api.hostname)) throw new Error("\uC11C\uBC84 \uC8FC\uC18C\uB97C \uD655\uC778\uD558\uC138\uC694.");
  return Object.fromEntries([["game", "./"], ["manager", "./tournament/"], ["observer", "./tournament/observer.html"], ["wiki", "./wiki.html"]].map(([name, path]) => {
    const url = new URL(path, baseUrl);
    url.search = "";
    url.hash = "";
    if (api.origin !== new URL(defaultServer).origin) url.searchParams.set("server", api.origin);
    return [name, url.href];
  }));
}

// duplicate/observer-app.mjs
var DEFAULT_OBSERVER_SERVER = "https://wellness-mahjong-h-lab.chayhyeon.chatgpt.site";
function observerPublicationMessage(data) {
  const p = data?.publication;
  if (!p) return data?.waitingTables?.length ? `${data.waitingTables.length}\uD0C1\uC740 \uC9C0\uC5F0 \uAE30\uC900 \uC2DC\uAC01\uC5D0 \uB3C4\uB2EC\uD560 \uAE30\uB85D\uC744 \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC2B5\uB2C8\uB2E4.` : "3\uCD08\uB9C8\uB2E4 \uC804\uCCB4 \uD0C1\uC758 \uC9C0\uC5F0 \uAE30\uB85D\uC744 \uD655\uC778\uD569\uB2C8\uB2E4.";
  if (p.status === "registration") return "\uCC38\uAC00 \uB4F1\uB85D \uC911 \xB7 \uBA85\uB2E8 \uD655\uC815\uACFC \uB300\uD68C \uC2DC\uC791\uC744 \uAE30\uB2E4\uB9AC\uACE0 \uC788\uC2B5\uB2C8\uB2E4.";
  if (p.status === "waiting") return p.reason === "tables-pending" ? `\uAE30\uB85D \uBCF4\uD638 \uC911 \xB7 ${(p.waitingTables ?? []).length}\uD0C1\uC774 \uAC19\uC740 \uAD6D\xB7\uBCF8\uC7A5\uC744 \uB05D\uB0B4\uAC70\uB098 \uC9C0\uB098\uAC00\uAE30\uB97C \uAE30\uB2E4\uB9BD\uB2C8\uB2E4.` : "\uC544\uC9C1 \uACF5\uAC1C \uAC00\uB2A5\uD55C \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC804\uD0C1\uC758 \uAD6D\xB7\uBCF8\uC7A5 \uC885\uB8CC\uC640 \uC124\uC815 \uC9C0\uC5F0\uC744 \uD655\uC778\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4.";
  const deal = data.selectedDeal;
  return `${deal ? `${deal.board}\uAD6D \xB7 ${deal.honba}\uBCF8\uC7A5 \xB7 ` : ""}\uC804\uD0C1 \uC644\uB8CC\xB7\uD1B5\uACFC\uC640 \uC124\uC815 \uC9C0\uC5F0\uC744 \uD655\uC778\uD55C \uACFC\uAC70 \uAE30\uB85D\uC785\uB2C8\uB2E4.`;
}
function normalizeObserverDelay(value = DEFAULT_OBSERVER_DELAY_SECONDS) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(21600, Math.max(5, Math.floor(n))) : DEFAULT_OBSERVER_DELAY_SECONDS;
}
function normalizeObserverServer(value = DEFAULT_OBSERVER_SERVER) {
  const url = new URL(value), local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || !["http:", "https:"].includes(url.protocol) || url.protocol === "http:" && !local) throw Error("\uC11C\uBC84 \uC8FC\uC18C\uB294 HTTPS \uC8FC\uC18C \uB610\uB294 \uB85C\uCEEC \uC11C\uBC84 \uC8FC\uC18C\uC5EC\uC57C \uD569\uB2C8\uB2E4.");
  return url.origin;
}
function parseObserverLink(value, base = DEFAULT_OBSERVER_SERVER) {
  const url = new URL(value, base);
  if (!["https:", "http:"].includes(url.protocol)) throw Error("\uAD00\uC804 \uB9C1\uD06C\uC758 \uC8FC\uC18C\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
  if (url.searchParams.has("repeat")) throw Error("\uAD00\uC804 \uAE30\uB85D\uC740 \uAD6D\uACFC \uBCF8\uC7A5\uC73C\uB85C \uC120\uD0DD\uD569\uB2C8\uB2E4. \uBCF8\uC7A5 \uC120\uD0DD \uB9C1\uD06C\uB85C \uB2E4\uC2DC \uC5F0\uACB0\uD574 \uC8FC\uC138\uC694.");
  if (url.searchParams.has("key")) throw Error("\uD0A4\uAC00 \uC8FC\uC18C \uCFFC\uB9AC\uC5D0 \uD3EC\uD568\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4. \uBC29\uC7A5\uC774 \uBC1C\uAE09\uD55C #key= \uD615\uC2DD\uC758 \uAD00\uC804 \uB9C1\uD06C\uB97C \uC0AC\uC6A9\uD574 \uC8FC\uC138\uC694.");
  const fragment = new URLSearchParams(url.hash.slice(1)), key = fragment.get("key"), code = (url.searchParams.get("code") ?? "").trim().toUpperCase();
  if (!key) return { code, key: null, server: normalizeObserverServer(url.searchParams.get("server") ?? DEFAULT_OBSERVER_SERVER), delaySeconds: normalizeObserverDelay(url.searchParams.get("delay") ?? DEFAULT_OBSERVER_DELAY_SECONDS), board: null, honba: null };
  if (!/^[a-f0-9]{64}$/.test(key) || !/^[A-Z2-9]{8}$/.test(code)) throw Error("\uAD00\uC804 \uB9C1\uD06C\uC758 \uB300\uD68C \uCF54\uB4DC\uC640 \uC804\uC6A9 \uD0A4\uB97C \uD655\uC778\uD574 \uC8FC\uC138\uC694.");
  const requestedBoard = Number(url.searchParams.get("board")), rawHonba = url.searchParams.get("honba"), honba = rawHonba === null ? null : Number(rawHonba);
  if (rawHonba !== null && (!url.searchParams.has("board") || !Number.isInteger(requestedBoard) || requestedBoard < 1 || requestedBoard > 16 || !Number.isInteger(honba) || honba < 0 || honba > 4294967295)) throw Error("\uBCF8\uC7A5\uC218\uB294 \uC62C\uBC14\uB978 \uAE30\uBCF8 \uAD6D \uBC88\uD638\uC640 \uD568\uAED8 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
  return { code, key, server: normalizeObserverServer(url.searchParams.get("server") ?? DEFAULT_OBSERVER_SERVER), delaySeconds: normalizeObserverDelay(url.searchParams.get("delay") ?? DEFAULT_OBSERVER_DELAY_SECONDS), board: Number.isInteger(requestedBoard) && requestedBoard >= 1 && requestedBoard <= 16 ? requestedBoard : null, honba };
}
function createObserverClient({ fetchImpl = globalThis.fetch, onState = () => {
}, onStatus = () => {
}, visibility = globalThis.document, pollMs = 3e3, timeoutMs = 12e3, setTimer = setTimeout, clearTimer = clearTimeout, now = Date.now } = {}) {
  let config = null, active = false, epoch = 0, timer = null, controller = null, pending = false, failures = 0, latestAsOf = -Infinity, destroyed = false;
  const clear = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  const cancel = () => {
    epoch++;
    clear();
    controller?.abort();
    controller = null;
    pending = false;
  };
  const schedule = (ms) => {
    clear();
    if (active && !destroyed && config && !visibility?.hidden) timer = setTimer(() => {
      timer = null;
      void poll();
    }, ms);
  };
  async function poll() {
    if (!active || destroyed || !config || pending || visibility?.hidden) return false;
    pending = true;
    const generation = epoch, current = config, start = now(), abort = new AbortController();
    controller = abort;
    const timeout = setTimer(() => abort.abort(), timeoutMs);
    onStatus({ kind: "loading", message: "\uC9C0\uC5F0 \uAE30\uB85D\uC744 \uD655\uC778\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4." });
    try {
      const url = new URL(`${current.server}/api/duplicate/competitions/${encodeURIComponent(current.code)}/observe`);
      url.searchParams.set("delaySeconds", String(current.delaySeconds));
      if (current.board !== null) {
        url.searchParams.set("board", String(current.board));
        if (current.honba !== null) url.searchParams.set("honba", String(current.honba));
      }
      const response = await fetchImpl(url.href, { method: "GET", headers: { Accept: "application/json", Authorization: `Bearer ${current.key}` }, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer", signal: abort.signal });
      if (generation !== epoch || !active) return false;
      if (!response.ok) {
        const terminal = [401, 403, 404, 410].includes(response.status);
        throw Object.assign(Error([401, 403].includes(response.status) ? "\uAD00\uC804 \uC804\uC6A9 \uD0A4\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uBC29\uC7A5\uC5D0\uAC8C \uC0C8 \uAD00\uC804 \uB9C1\uD06C\uB97C \uBC1B\uC544 \uC5F0\uACB0\uD574 \uC8FC\uC138\uC694." : [404, 410].includes(response.status) ? "\uB300\uD68C \uB610\uB294 \uAD00\uC804 \uB9C1\uD06C\uAC00 \uB9CC\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4." : "\uC11C\uBC84 \uC5F0\uACB0\uC774 \uC6D0\uD65C\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uD655\uC778\uD569\uB2C8\uB2E4."), { terminal, status: response.status });
      }
      let data;
      try {
        data = await response.json();
      } catch {
        throw Error("\uC11C\uBC84 \uC751\uB2F5\uC744 \uC77D\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uD655\uC778\uD569\uB2C8\uB2E4.");
      }
      if (generation !== epoch || !active) return false;
      if (data?.schema !== "duplicate-observer-v1" || data.code !== current.code || !["viewer", "caster"].includes(data.role) || !Array.isArray(data.tables) || !Number.isFinite(data.asOf) || !Number.isFinite(data.serverTime) || !Number.isInteger(data.delaySeconds) || data.delaySeconds < 5 || data.delaySeconds > 21600 || data.asOf > data.serverTime - data.delaySeconds * 1e3 + 1 || data.tables.some((t) => t.capturedAt !== null && t.capturedAt !== void 0 && (!Number.isFinite(t.capturedAt) || t.capturedAt > data.asOf))) throw Error("\uC11C\uBC84\uC758 \uC9C0\uC5F0 \uAD00\uC804 \uC815\uBCF4\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      if (data.publication && (!["registration", "waiting", "released"].includes(data.publication.status) || data.publication.status !== "released" && data.tables.length)) throw Error("\uC544\uC9C1 \uACF5\uAC1C\uB418\uC9C0 \uC54A\uC740 \uAD00\uC804 \uAE30\uB85D\uC740 \uD45C\uC2DC\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.");
      if (data.asOf < latestAsOf) return false;
      latestAsOf = data.asOf;
      failures = 0;
      onState(data);
      onStatus({ kind: "ready", message: observerPublicationMessage(data) });
      return true;
    } catch (error) {
      if (generation !== epoch || !active) return false;
      failures++;
      if (error.terminal) {
        active = false;
        onState(null);
      }
      onStatus({ kind: error.terminal ? "auth-error" : "error", message: error.name === "AbortError" ? "\uC11C\uBC84 \uC751\uB2F5\uC774 \uB2A6\uC2B5\uB2C8\uB2E4. \uC5F0\uACB0\uC744 \uB2E4\uC2DC \uD655\uC778\uD569\uB2C8\uB2E4." : error.message, retryMs: error.terminal ? null : Math.min(3e4, pollMs * 2 ** Math.min(failures - 1, 4)) });
      return false;
    } finally {
      clearTimer(timeout);
      if (generation === epoch) {
        pending = false;
        controller = null;
        schedule(failures ? Math.min(3e4, pollMs * 2 ** Math.min(failures - 1, 4)) : Math.max(0, pollMs - (now() - start)));
      }
    }
  }
  const visibilityChanged = () => {
    cancel();
    if (visibility?.hidden) onStatus({ kind: "paused", message: "\uC774 \uD0ED\uC774 \uC228\uACA8\uC838 \uC788\uC5B4 \uC790\uB3D9 \uD655\uC778\uC744 \uBA48\uCDC4\uC2B5\uB2C8\uB2E4." });
    else if (active) void poll();
  };
  visibility?.addEventListener?.("visibilitychange", visibilityChanged);
  return {
    connect(value) {
      cancel();
      active = false;
      config = null;
      const next = { ...value, server: normalizeObserverServer(value.server), delaySeconds: normalizeObserverDelay(value.delaySeconds), board: value.board ?? null, honba: value.honba ?? null };
      if (!/^[a-f0-9]{64}$/.test(next.key ?? "") || !/^[A-Z2-9]{8}$/.test(next.code ?? "")) throw Error("\uC720\uD6A8\uD55C \uAD00\uC804 \uC804\uC6A9 \uB9C1\uD06C\uB97C \uC5F0\uACB0\uD574 \uC8FC\uC138\uC694.");
      if (next.honba !== null && (next.board === null || !Number.isInteger(next.honba) || next.honba < 0 || next.honba > 4294967295)) throw Error("\uBCF8\uC7A5\uC218\uB294 \uAE30\uBCF8 \uAD6D \uBC88\uD638\uC640 \uD568\uAED8 \uC120\uD0DD\uD574 \uC8FC\uC138\uC694.");
      config = next;
      active = true;
      failures = 0;
      latestAsOf = -Infinity;
      onState(null);
      return poll();
    },
    refresh() {
      if (!config) return Promise.resolve(false);
      active = true;
      clear();
      return poll();
    },
    disconnect() {
      cancel();
      active = false;
      config = null;
      latestAsOf = -Infinity;
      onState(null);
    },
    destroy() {
      cancel();
      active = false;
      destroyed = true;
      config = null;
      visibility?.removeEventListener?.("visibilitychange", visibilityChanged);
    }
  };
}
function mountObserver(doc = globalThis.document, win = globalThis.window) {
  const $ = (id) => doc.getElementById(id), ui = { config: null, dto: null, mode: "overview", page: 0, tableId: null, minimum: 5 };
  const options = { document: doc }, error = (message) => {
    $("observer-error").hidden = !message;
    $("observer-error").textContent = message ?? "";
  };
  const delayInput = bindObserverDelayInput($("observer-delay"), $("observer-delay-unit"), { onError: error });
  function updateNavigation(server) {
    const links = tournamentNavigationLinks({ baseUrl: new URL("./", import.meta.url).href, server });
    for (const [id, target] of [["observer-brand", "manager"], ["observer-manager-link", "manager"], ["observer-game-link", "game"], ["observer-wiki-link", "wiki"]]) if ($(id)) $(id).href = links[target];
  }
  try {
    updateNavigation(normalizeObserverServer(new URL(win.location.href).searchParams.get("server") ?? DEFAULT_OBSERVER_SERVER));
  } catch {
  }
  function writeLocation() {
    const url = new URL(win.location.href);
    url.search = "";
    url.searchParams.set("code", ui.config.code);
    url.searchParams.set("delay", String(ui.config.delaySeconds));
    if (ui.config.server !== DEFAULT_OBSERVER_SERVER) url.searchParams.set("server", ui.config.server);
    if (ui.config.board !== null) {
      url.searchParams.set("board", String(ui.config.board));
      if (ui.config.honba !== null) url.searchParams.set("honba", String(ui.config.honba));
    }
    url.hash = new URLSearchParams({ key: ui.config.key }).toString();
    win.history.replaceState(null, "", url.href);
  }
  function setMode(mode) {
    ui.mode = mode;
    render();
  }
  function render() {
    const dto = ui.dto, tables = dto ? [...dto.tables, ...(dto.waitingTables ?? []).filter((id) => !dto.tables.some((t) => t.id === id)).map((id) => ({ id, board: dto.selectedDeal?.board ?? ui.config?.board, honba: dto.selectedDeal?.honba ?? ui.config?.honba, phase: "waiting", waitingReason: dto.publication ? "closure" : null, capturedAt: null, game: null, members: [] }))] : [];
    const caster = dto?.role === "caster" && dto.handsVisible === true;
    const protectedRecord = dto?.publication && dto.publication.status !== "released";
    $("observer-role").textContent = dto ? caster ? protectedRecord ? "\uC911\uACC4\uC790 \xB7 \uAE30\uB85D \uACF5\uAC1C \uB300\uAE30" : "\uC911\uACC4\uC790 \xB7 \uACF5\uAC1C \uAE30\uB85D\uC758 \uC190\uD328" : "\uAD00\uC804\uC790 \xB7 \uC190\uD328 \uBE44\uACF5\uAC1C" : "\uAD00\uC804 \uB9C1\uD06C \uD544\uC694";
    $("observer-role").classList.toggle("obs-caster", caster);
    $("observer-title").textContent = ui.config ? `${ui.config.code} \xB7 \uC911\uACC4\uC2E4` : "\uC5EC\uB7EC \uD0C1, \uAC19\uC740 \uBC30\uD328.";
    $("observer-privacy").textContent = caster ? "\uC911\uACC4\uC790 \uC804\uC6A9 \xB7 \uD574\uC81C\uB41C \uACFC\uAC70 \uAE30\uB85D\uC758 \uC190\uD328\uB97C \uBCF4\uC5EC \uC90D\uB2C8\uB2E4. \uC774 \uB9C1\uD06C\uB97C \uAD00\uC804\uC790\uC5D0\uAC8C \uACF5\uC720\uD558\uC9C0 \uB9C8\uC138\uC694." : "\uAD00\uC804\uC790 \uD654\uBA74 \xB7 \uBAA8\uB4E0 \uC190\uD328\uB294 \uBE44\uACF5\uAC1C\uC785\uB2C8\uB2E4. \uD574\uC81C\uB41C \uAE30\uB85D\uC758 \uBC84\uB9BC\uACFC \uD6C4\uB85C\uB9CC \uD45C\uC2DC\uD569\uB2C8\uB2E4.";
    $("observer-asof").textContent = observerTime(dto?.asOf);
    $("observer-server-time").textContent = observerTime(dto?.serverTime);
    $("observer-effective-delay").textContent = dto ? observerDelayLabel(dto.delaySeconds) : ui.config ? `${observerDelayLabel(ui.config.delaySeconds)} \uC694\uCCAD` : "\uAE30\uBCF8 5\uBD84 (300\uCD08)";
    $("observer-overview").hidden = ui.mode !== "overview";
    $("observer-detail").hidden = ui.mode !== "detail";
    $("observer-comparison").hidden = ui.mode !== "comparison";
    for (const [id, mode] of [["observer-overview-tab", "overview"], ["observer-comparison-tab", "comparison"]]) {
      $(id).classList.toggle("active", ui.mode === mode);
      $(id).setAttribute("aria-pressed", String(ui.mode === mode));
    }
    const page = pageTables(tables, ui.page);
    ui.page = page.page;
    $("observer-table-count").textContent = dto ? `${tables.length}\uD0C1 \xB7 \uD55C \uD654\uBA74\uC5D0 \uCD5C\uB300 \uB124 \uD0C1` : "\uC5F0\uACB0 \uB300\uAE30";
    $("observer-page-label").textContent = `${page.page + 1} / ${page.pages}`;
    $("observer-prev").disabled = page.page === 0;
    $("observer-next").disabled = page.page + 1 >= page.pages;
    const grid = $("observer-grid");
    grid.replaceChildren();
    for (const table of page.tables) grid.append(renderObserverTable(table, { ...options, handsVisible: caster, onDetail: (id) => {
      ui.tableId = id;
      setMode("detail");
    } }));
    if (!tables.length) {
      const empty = doc.createElement("div");
      empty.className = "obs-empty";
      empty.textContent = dto ? observerPublicationMessage(dto) : "\uAD00\uC804 \uC804\uC6A9 \uB9C1\uD06C\uB97C \uC5F0\uACB0\uD574 \uC8FC\uC138\uC694.";
      grid.append(empty);
    }
    const select = $("observer-detail-table");
    select.replaceChildren();
    for (const table of tables) {
      const option = doc.createElement("option");
      option.value = table.id;
      option.textContent = `${table.id} \xB7 ${table.board ?? "\u2014"}\uAD6D \xB7 ${table.honba ?? 0}\uBCF8\uC7A5`;
      select.append(option);
    }
    if (!tables.some((t) => t.id === ui.tableId)) ui.tableId = tables[0]?.id ?? null;
    select.value = ui.tableId ?? "";
    const detail = $("observer-detail-content");
    detail.replaceChildren();
    const selected = tables.find((t) => t.id === ui.tableId);
    if (selected) detail.append(renderObserverTable(selected, { ...options, handsVisible: caster, detail: true }));
    const comparison = $("observer-comparison-content");
    comparison.replaceChildren();
    if (dto && ui.mode === "comparison" && protectedRecord) {
      const empty = doc.createElement("div");
      empty.className = "obs-empty";
      empty.textContent = observerPublicationMessage(dto);
      comparison.append(empty);
    }
    if (dto && ui.mode === "comparison" && !protectedRecord) {
      const seat2 = $("observer-compare-seat").value, model = buildObserverComparison(dto, { board: ui.config.board ?? dto.selectedDeal?.board ?? void 0, honba: ui.config.honba ?? dto.selectedDeal?.honba ?? void 0, seat: seat2 === "" ? null : Number(seat2), type: $("observer-compare-type").value, alignment: $("observer-compare-alignment").value, differencesOnly: $("observer-compare-differences").checked });
      comparison.append(renderObserverComparison(model, options));
    }
    const board = $("observer-board"), old = ui.config?.board === null || ui.config?.board === void 0 ? "" : ui.config.honba === null ? `board:${ui.config.board}` : `${ui.config.board}:${ui.config.honba}`;
    board.replaceChildren();
    const latest = doc.createElement("option");
    latest.value = "";
    latest.textContent = dto?.publication ? "\uCD5C\uADFC \uACF5\uAC1C\uB41C \uAD6D\xB7\uBCF8\uC7A5" : "\uAC01 \uD0C1\uC758 \uCD5C\uC2E0 \uAE30\uB85D \xB7 \uC774\uC804 \uB300\uD68C";
    board.append(latest);
    const deals = dto?.availableDeals ?? (dto?.availableBoards ?? []).map((board2) => ({ board: board2, honba: 0, handId: `${board2}:0` })), known = new Map(deals.map((d) => [`${d.board}:${d.honba}`, d]));
    if (ui.config?.board !== null && ui.config?.board !== void 0 && !known.has(old)) {
      const option = doc.createElement("option");
      option.value = old;
      option.textContent = ui.config.honba === null ? `${ui.config.board}\uAD6D \xB7 \uCD5C\uADFC \uACF5\uAC1C \uBCF8\uC7A5` : `${ui.config.board}\uAD6D \xB7 ${ui.config.honba}\uBCF8\uC7A5 \xB7 \uACF5\uAC1C \uB300\uAE30`;
      board.append(option);
    }
    for (const deal of [...known.values()].sort((a, b) => a.board - b.board || a.honba - b.honba)) {
      const option = doc.createElement("option");
      option.value = `${deal.board}:${deal.honba}`;
      option.textContent = `${deal.board}\uAD6D \xB7 ${deal.honba}\uBCF8\uC7A5`;
      board.append(option);
    }
    board.value = old;
  }
  const client = createObserverClient({ visibility: doc, onState: (dto) => {
    ui.dto = dto;
    if (dto) {
      ui.minimum = Math.max(5, dto.minimumDelaySeconds ?? 5);
      delayInput.setMinimum(ui.minimum);
      $("observer-delay-minimum").textContent = `\uCD5C\uC18C ${observerDelayLabel(ui.minimum)}`;
      $("observer-link-panel").open = false;
    }
    render();
  }, onStatus: (status) => {
    $("observer-status").textContent = status.message;
    doc.body.classList.toggle("obs-connection-error", ["error", "auth-error"].includes(status.kind));
    if (["error", "auth-error"].includes(status.kind)) error(status.message);
    else if (status.kind === "ready") error("");
    if (status.kind === "auth-error") $("observer-link-panel").open = true;
  } });
  function connect(config) {
    if (ui.config?.code !== config.code || ui.config?.server !== config.server) ui.minimum = 5;
    ui.config = config;
    ui.page = 0;
    ui.tableId = null;
    delayInput.setMinimum(ui.minimum);
    delayInput.setSeconds(config.delaySeconds);
    error("");
    updateNavigation(config.server);
    writeLocation();
    void client.connect(config);
  }
  function changeDelay(value) {
    const delaySeconds = Math.max(ui.minimum, normalizeObserverDelay(value));
    delayInput.setSeconds(delaySeconds);
    if (ui.config) connect({ ...ui.config, delaySeconds });
  }
  $("observer-connect-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const config = parseObserverLink($("observer-link-input").value.trim(), win.location.href);
      if (!config.key) throw Error("\uBC29\uC7A5\uC774 \uBC1C\uAE09\uD55C #key= \uAD00\uC804 \uC804\uC6A9 \uB9C1\uD06C\uB97C \uC785\uB825\uD574 \uC8FC\uC138\uC694.");
      connect(config);
      $("observer-link-input").value = "";
    } catch (e) {
      error(e.message);
    }
  });
  $("observer-delay-form").addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      changeDelay(delayInput.getSeconds());
    } catch (e) {
      error(e.message);
    }
  });
  doc.querySelectorAll("[data-delay]").forEach((button) => button.onclick = () => changeDelay(button.dataset.delay));
  $("observer-board").onchange = () => {
    if (ui.config) {
      const selected = $("observer-board").value, parts = selected.split(":");
      connect({ ...ui.config, board: selected ? Number(parts[0] === "board" ? parts[1] : parts[0]) : null, honba: selected && parts[0] !== "board" ? Number(parts[1]) : null });
    }
  };
  $("observer-refresh").onclick = () => {
    if (ui.config) void client.refresh();
    else $("observer-link-panel").open = true;
  };
  $("observer-prev").onclick = () => {
    ui.page--;
    render();
  };
  $("observer-next").onclick = () => {
    ui.page++;
    render();
  };
  $("observer-overview-tab").onclick = () => setMode("overview");
  $("observer-comparison-tab").onclick = () => setMode("comparison");
  $("observer-detail-back").onclick = () => setMode("overview");
  $("observer-detail-table").onchange = () => {
    ui.tableId = $("observer-detail-table").value;
    render();
  };
  for (const id of ["observer-compare-seat", "observer-compare-type", "observer-compare-alignment", "observer-compare-differences"]) $(id).onchange = render;
  $("observer-focus").onclick = () => {
    const focused = doc.body.classList.toggle("obs-focus");
    $("observer-focus").setAttribute("aria-pressed", String(focused));
    $("observer-focus").textContent = focused ? "\uC77C\uBC18 \uD654\uBA74" : "\uC9D1\uC911 \uD654\uBA74";
  };
  win.addEventListener("pagehide", () => client.destroy(), { once: true });
  try {
    const config = parseObserverLink(win.location.href);
    if (config.key) connect(config);
    else render();
  } catch (e) {
    error(e.message);
    render();
  }
  return { client, destroy() {
    client.destroy();
    delayInput.destroy();
  } };
}
if (typeof document !== "undefined" && document.getElementById("observer-root")) mountObserver();
export {
  DEFAULT_OBSERVER_SERVER,
  createObserverClient,
  mountObserver,
  normalizeObserverDelay,
  normalizeObserverServer,
  observerPublicationMessage,
  parseObserverLink
};
