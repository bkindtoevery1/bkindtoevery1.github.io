import {tileName,typeOf} from '../engine/tiles.mjs';
import {tileFace} from './tile-view.mjs';

const SOURCES = {1: 'right', 2: 'across', 3: 'left'};
export const MELD_SOURCE_LABELS = {left: '왼쪽', across: '맞은편', right: '오른쪽'};

// Physical tile IDs retain the original called tile after a pon becomes a kan.
// Use the source's claimed discard, not the order of active players: an H winner
// may already have left and a chi can then come from the player across the table.
export function meldDisplay(meld, seat, players = [],
  {concealedKanPrivate = false, viewerSeat} = {}) {
  const ids = Array.isArray(meld.ids) ? [...meld.ids] : [];
  const knownKan = Number.isInteger(meld.tile) && meld.tile >= 0 && meld.tile < 34 && ids.length === 4 &&
    ids.every(id => Number.isInteger(id) && id >= 0 && id < 136 && typeOf(id) === meld.tile);
  if (!meld.open && meld.type === 'kan' && (concealedKanPrivate === true || meld.hidden === true || !knownKan)) {
    const ownerVisible = viewerSeat === seat && !meld.hidden && knownKan;
    return {source: null, calledId: null, addedId: null, private: true, ownerVisible,
      // The owner already knows these tiles. Every other viewer gets neither
      // types nor physical IDs, including when solo state holds the real tiles.
      slots: Array.from({length: 4}, (_, i) => ({id: ownerVisible ? ids[i] : null,
        tile: ownerVisible ? typeOf(ids[i]) : null, called: false, added: null, faceDown: !ownerVisible}))};
  }
  if (!meld.open) return {source: null, calledId: null, addedId: null,
    // Public kans show all four faces in both H and S; the explicit label keeps
    // a concealed declaration distinct from an open kan without hiding its type.
    slots: ids.map(id => ({id, tile: typeOf(id), called: false, added: null, faceDown: false}))};
  const source = SOURCES[(meld.from - seat + 4) % 4] ?? null;
  const river = players[meld.from]?.river ?? [];
  const calledId = river.find(discard => discard.claimed && ids.includes(discard.id))?.id ?? meld.calledId ?? ids.at(-1);
  const addedId = meld.type === 'kan' && ids.length === 4 && ids.indexOf(calledId) === 2 ? ids[3] : null;
  const others = ids.filter(id => id !== calledId && id !== addedId).sort((a, b) => typeOf(a) - typeOf(b) || a - b);
  const slots = others.map(id => ({id, tile: typeOf(id), called: false, added: null}));
  const calledIndex = source === 'left' ? 0 : source === 'across' ? 1 : slots.length;
  slots.splice(calledIndex, 0, {id: calledId, tile: typeOf(calledId), called: true,
    added: addedId === null ? null : {id: addedId, tile: typeOf(addedId)}});
  return {source, calledId, addedId, slots};
}

function node(tag, text, cls) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (cls) el.className = cls;
  return el;
}
function meldText(meld) {
  return `${meld.type === 'kan' ? (meld.open ? '명깡' : '안깡') : meld.type === 'pon' ? '퐁' : '치'} ${
    meld.type === 'chi' ? [meld.tile, meld.tile + 1, meld.tile + 2].map(tileName).join(' ') : tileName(meld.tile)}`;
}

// Render only the disclosure-safe view. Covered tiles never reach tileFace,
// titles, accessible names or data attributes with their real tile identity.
export function renderMeldElement(meld, seat, players, options = {}) {
  const display = meldDisplay(meld, seat, players, options);
  const el = node('div', undefined, 'meld');
  const source = display.source ? `${MELD_SOURCE_LABELS[display.source]}에서 가져온 ${tileName(typeOf(display.calledId))}` : '';
  const ownerLabel = display.ownerVisible ? `본인 안깡 · 상대에게 비공개 · ${tileName(display.slots[0].tile)}` : '';
  const label = display.private ? ownerLabel || '안깡 · 비공개'
    : [meldText(meld), meld.type === 'kan' && !meld.open ? '패 종류 공개' : '', source,
      display.addedId !== null ? '가깡은 가져온 패 위에 겹쳐 표시' : ''].filter(Boolean).join(' · ');
  el.setAttribute('aria-label', label); el.title = label;
  el.append(node('span', ownerLabel || (meld.type === 'kan' ? (meld.open ? '깡' : '안깡') : meld.type === 'pon' ? '퐁' : '치'), 'meld-label'));
  for (const slot of display.slots) {
    const group = node('span', undefined, 'meld-slot' + (slot.called ? ' is-called' : '') + (slot.added ? ' is-added-kan' : ''));
    const add = (tile, extra = false) => {
      const wrap = node('span', undefined, 'meld-tile' + (slot.called ? ' sideways' : ''));
      if (tile.id !== null) wrap.dataset.tileId = String(tile.id);
      wrap.setAttribute('aria-label', tile.faceDown ? '안깡 뒷면' : `${tileName(tile.tile)}${extra ? ' · 가깡으로 더한 패' : slot.called ? ' · ' + source : ''}`);
      if (tile.faceDown) {
        const back = node('span', undefined, 'tile-back meld-back');
        back.setAttribute('role', 'img'); back.setAttribute('aria-label', '안깡 뒷면'); wrap.append(back);
      } else wrap.append(tileFace(tile.tile, {small: true}));
      group.append(wrap);
    };
    add(slot); if (slot.added) add(slot.added, true); el.append(group);
  }
  return el;
}
