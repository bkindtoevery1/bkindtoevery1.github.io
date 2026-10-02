export const typeOf = id => Math.floor(id / 4);
export const isHonor = t => t >= 27;
export const isTerminal = t => t < 27 && (t % 9 === 0 || t % 9 === 8);
export const isYao = t => isHonor(t) || isTerminal(t);
export function counts(types) {const c=Array(34).fill(0); for(const t of types) {if(!Number.isInteger(t)||t<0||t>33) throw new Error('Invalid tile'); c[t]++;} return c;}
export function parseTiles(s) {
  const out=[]; let consumed='';
  for(const m of s.replace(/\s/g,'').matchAll(/([1-9]+)([mpsz])/g)) {
    consumed+=m[0]; const offset={m:0,p:9,s:18,z:27}[m[2]];
    for(const ch of m[1]) {const n=Number(ch); if(m[2]==='z'&&n>7) throw new Error('Invalid honor');out.push(offset+n-1);}
  }
  if(consumed!==s.replace(/\s/g,'')) throw new Error('Expected compact tiles, e.g. 123m456p789s1122z');
  if(counts(out).some(c=>c>4)) throw new Error('More than four copies');
  return out;
}
export const tileName = t => t < 27 ? `${t%9+1}${['만','통','삭'][Math.floor(t/9)]}` : ['동','남','서','북','백','발','중'][t-27];
export function rng(seed) {let a=seed>>>0; return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
export function shuffledWall(seed) {const a=Array.from({length:136},(_,i)=>i),r=rng(seed);for(let i=135;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
