const KEY='wellness-mahjong-preferences-v1';
export function readPreferences(storage){try{const saved=JSON.parse(storage?.getItem(KEY)??'{}');return {recommendations:saved?.recommendations!==false,variant:saved?.variant==='S'?'S':'H'};}catch{return {recommendations:true,variant:'H'};}}
export function savePreferences(storage,value){try{storage?.setItem(KEY,JSON.stringify({recommendations:!!value.recommendations,variant:value.variant==='S'?'S':'H'}));return !!storage;}catch{return false;}}
