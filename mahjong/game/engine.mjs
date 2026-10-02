import * as h from '../engine/game.mjs';
import * as s from '../s-engine/game.mjs';
export const variantOf=state=>state?.rules?.variant==='S'?'S':'H';
const engine=state=>variantOf(state)==='S'?s:h;
export function createGame({variant='H',...options}={}){if(!['H','S'].includes(variant))throw new Error('Unknown rule variant');return (variant==='S'?s:h).createGame(options);}
export const actor=state=>engine(state).actor(state);
export const legalActions=(state,seat)=>engine(state).legalActions(state,seat);
export const observation=(state,seat)=>engine(state).observation(state,seat);
export const step=(state,seat,action,options)=>engine(state).step(state,seat,action,options);
export const assertInvariants=state=>engine(state).assertInvariants(state);
export const settleDraw=state=>engine(state).settleDraw(state);
