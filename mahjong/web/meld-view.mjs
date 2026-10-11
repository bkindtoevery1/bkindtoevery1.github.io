import {typeOf} from '../engine/tiles.mjs';

const SOURCES = {1: 'right', 2: 'across', 3: 'left'};
export const MELD_SOURCE_LABELS = {left: '왼쪽', across: '맞은편', right: '오른쪽'};

// Physical tile IDs retain the original called tile after a pon becomes a kan.
// Use the source's claimed discard, not the order of active players: an H winner
// may already have left and a chi can then come from the player across the table.
export function meldDisplay(meld, seat, players = [], {variant = 'H'} = {}) {
  const ids = [...meld.ids];
  if (!meld.open) return {source: null, calledId: null, addedId: null,
    // S uses the conventional two-backed-tile marker; the two middle faces
    // still disclose the tile type. H's source does not specify this marker.
    slots: ids.map((id, index) => ({id, tile: typeOf(id), called: false, added: null,
      faceDown: variant === 'S' && meld.type === 'kan' && (index === 0 || index === ids.length - 1)}))};
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
