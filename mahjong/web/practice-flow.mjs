import {actor, legalActions, observation, step} from '../game/engine.mjs';

export const AUTO_PASS_DELAY_MS = 700;
export const SEAT_NAMES = ['동', '남', '서', '북'];

// A random 32-bit deal number gives a uniform seat; replay keeps the same seat.
export const practiceSeat = seed => (seed >>> 16) & 3;

// A reaction is a check on the last play, not a new draw/discard turn.
export function displayedTurn(state) {
  if (state.phase === 'reaction') return state.reaction.source;
  return state.phase === 'turn' ? state.turn : null;
}

// Resolve the other players' checks together without painting intermediate seats.
// Always stop at the human: their legal choices and 700ms automatic pass stay intact.
// Each decision receives only the engine's own-hand/public-information view.
export function resolveAiReactions(state, humanSeat, choose, apply = step) {
  while (state.phase === 'reaction' && actor(state) !== humanSeat) {
    const seat = actor(state);
    apply(state, seat, choose(observation(state, seat)));
  }
}

export function handDisplay(state, seat = 0) {
  const player = state.players[seat];
  const drawn = state.phase === 'turn' && actor(state) === seat && !player.won
    && player.drawn !== null && player.hand.includes(player.drawn) ? player.drawn : null;
  return {held: player.hand.filter(id => id !== drawn), drawn};
}

export function needsAutomaticPass(state, seat = 0) {
  if (state.phase !== 'reaction' || actor(state) !== seat) return false;
  const actions = legalActions(state, seat);
  return actions.length === 1 && actions[0].type === 'pass';
}

export function nextDelay(state, autoplay, seat = 0) {
  if (state.phase === 'end') return null;
  if (needsAutomaticPass(state, seat)) return AUTO_PASS_DELAY_MS;
  if (actor(state) !== seat || autoplay) return autoplay ? 30 : 90;
  return null;
}
