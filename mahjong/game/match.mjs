import * as h from './h-match.mjs';
import * as s from '../s-engine/match.mjs';

// Existing saved matches were S half-games before variant/format were stored.
export const matchVariant=match=>match?.variant==='H'?'H':'S';
export const matchFormat=match=>match?.format??'hanchan';
const engine=match=>matchVariant(match)==='H'?h:s;
export function createMatch({variant='S',...options}={}){if(!['H','S'].includes(variant))throw new Error('Unknown rule variant');return (variant==='H'?h:s).createMatch(options);}
export const createMatchGame=match=>engine(match).createMatchGame(match);
export const recordRound=(match,game,options)=>engine(match).recordRound(match,game,options);
export const advanceMatch=(match,expectedHandNumber)=>engine(match).advanceMatch(match,expectedHandNumber);
export const matchTotals=(match,game)=>engine(match).matchTotals(match,game);
export const matchSummary=(match,game)=>engine(match).matchSummary(match,game);
export const assertMatch=(match,game)=>engine(match).assertMatch(match,game);
export {roundLabel,roundSeed} from '../s-engine/match.mjs';
