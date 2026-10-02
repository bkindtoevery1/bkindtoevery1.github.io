// Structural distance only; no Riichi yaku, furiten, dora or scoring rules.
// Suit decompositions are cached and combined as (melds, incomplete groups, pair).
const suitCache=new Map(),honorCache=new Map();
const pow5=Array.from({length:9},(_,i)=>5**i);
function frontier(code,honor=false) {
  const cache=honor?honorCache:suitCache;
  if(cache.has(code))return cache.get(code);
  if(!code)return [[0,0,0]];
  const len=honor?7:9,c=Array(len);let k=code;
  for(let i=0;i<len;i++){c[i]=k%5;k=Math.floor(k/5);}
  const i=c.findIndex(n=>n>0),base=pow5[i],out=new Map();
  function merge(sub,dm,dt,dp){for(const [m,t,p]of sub){const mm=m+dm,pp=p+dp;if(mm>4||pp>1)continue;const tt=Math.min(4-mm,t+dt),key=mm*2+pp;if((out.get(key)??-1)<tt)out.set(key,tt);}}
  merge(frontier(code-base,honor),0,0,0);
  if(c[i]>=3)merge(frontier(code-3*base,honor),1,0,0);
  if(c[i]>=2){const rest=frontier(code-2*base,honor);merge(rest,0,1,0);merge(rest,0,0,1);}
  if(!honor){
    if(i<7&&c[i+1]&&c[i+2])merge(frontier(code-base-pow5[i+1]-pow5[i+2]),1,0,0);
    if(i<8&&c[i+1])merge(frontier(code-base-pow5[i+1]),0,1,0);
    if(i<7&&c[i+2])merge(frontier(code-base-pow5[i+2]),0,1,0);
  }
  const result=[...out].map(([k,t])=>[Math.floor(k/2),t,k%2]);cache.set(code,result);return result;
}
function suitCode(c,offset,len){let code=0;for(let i=0;i<len;i++)code+=c[offset+i]*pow5[i];return code;}
export function shanten(c,openMelds=0,quadPairs=false) {
  let states=[[openMelds,0,0]];
  for(let s=0;s<4;s++){
    const fs=frontier(suitCode(c,s*9,s===3?7:9),s===3),next=new Map();
    for(const [m,t,p]of states)for(const [mm,tt,pp]of fs){const nm=m+mm,np=p+pp;if(nm>4||np>1)continue;const nt=Math.min(4-nm,t+tt),key=nm*2+np;if((next.get(key)??-1)<nt)next.set(key,nt);}
    states=[...next].map(([k,t])=>[Math.floor(k/2),t,k%2]);
  }
  let best=8;for(const [m,t,p]of states)best=Math.min(best,8-2*m-t-p);
  if(!openMelds){let pairs=0,unique=0;for(const n of c){if(n)unique++;pairs+=quadPairs?Math.floor(n/2):Number(n>=2);}best=Math.min(best,6-pairs+(quadPairs?0:Math.max(0,7-unique)));}
  return best;
}
export function effectiveTiles(c,openMelds,visible,rules) {
  const now=shanten(c,openMelds,rules.sevenPairsQuadAsTwo),tiles=[];let total=0;
  for(let t=0;t<34;t++)if((visible[t]??c[t])<4&&c[t]<4){c[t]++;const s=shanten(c,openMelds,rules.sevenPairsQuadAsTwo);c[t]--;if(s<now){const remaining=4-(visible[t]??c[t]);total+=remaining;tiles.push({tile:t,remaining});}}
  return {shanten:now,ukeire:total,tiles};
}
export function cacheSize(){return {suit:suitCache.size,honors:honorCache.size};}
