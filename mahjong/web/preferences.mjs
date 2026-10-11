const KEY='wellness-mahjong-preferences-v1';
export const defaultMatchFormat=variant=>variant==='S'?'hanchan':'single';
export const matchFormatName=format=>format==='hanchan'?'반장전':'단판전';
export function readPreferences(storage){try{const saved=JSON.parse(storage?.getItem(KEY)??'{}'),variant=saved?.variant==='S'?'S':'H';return {recommendations:saved?.recommendations!==false,variant,format:['single','hanchan'].includes(saved?.format)?saved.format:defaultMatchFormat(variant)};}catch{return {recommendations:true,variant:'H',format:'single'};}}
export function savePreferences(storage,value){try{const variant=value.variant==='S'?'S':'H',format=['single','hanchan'].includes(value.format)?value.format:defaultMatchFormat(variant);storage?.setItem(KEY,JSON.stringify({recommendations:!!value.recommendations,variant,format}));return !!storage;}catch{return false;}}
