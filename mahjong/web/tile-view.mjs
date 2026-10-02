import {tileName} from '../engine/tiles.mjs';
const SVG='http://www.w3.org/2000/svg';
const dots={1:[[50,50]],2:[[50,24],[50,76]],3:[[24,22],[50,50],[76,78]],4:[[24,24],[76,24],[24,76],[76,76]],5:[[24,24],[76,24],[50,50],[24,76],[76,76]],6:[[24,18],[76,18],[24,50],[76,50],[24,82],[76,82]],7:[[24,16],[50,31],[76,16],[24,57],[76,57],[24,84],[76,84]],8:[[24,13],[76,13],[24,38],[76,38],[24,63],[76,63],[24,88],[76,88]],9:[[22,16],[50,16],[78,16],[22,50],[50,50],[78,50],[22,84],[50,84],[78,84]]};
function element(tag,attributes){const el=document.createElementNS(SVG,tag);for(const [key,value]of Object.entries(attributes))el.setAttribute(key,String(value));return el;}
function span(text,cls){const el=document.createElement('span');el.className=cls;el.textContent=text;return el;}
function bird(svg){
 svg.setAttribute('data-design','bamboo-bird');
 // A recognisable one-bamboo bird, drawn locally so it stays crisp at hand size.
 for(const d of ['M47 60 Q16 66 17 98 Q38 91 51 67','M49 62 Q32 81 37 103 Q54 92 56 65','M54 62 Q54 86 69 99 Q76 78 62 60'])svg.append(element('path',{d,fill:'#1a7952',stroke:'#125c40','stroke-width':2}));
 svg.append(element('path',{d:'M28 47 Q22 30 34 19 Q48 13 55 27 L65 43 Q77 55 63 68 Q48 78 34 65 Q25 58 28 47Z',fill:'#1a7952'}));
 svg.append(element('path',{d:'M34 46 Q45 35 63 48 Q61 63 41 66 Q49 55 34 46Z',fill:'#2d526f'}));
 svg.append(element('path',{d:'M53 24 L72 32 L55 35Z',fill:'#b12739'}));
 svg.append(element('circle',{cx:45,cy:25,r:4,fill:'#fff7dc'}),element('circle',{cx:46,cy:25,r:2,fill:'#173d32'}));
 svg.append(element('path',{d:'M32 17 L27 10 M38 15 L37 7 M49 68 L50 82 M50 82 L42 86 M50 82 L58 85',fill:'none',stroke:'#b12739','stroke-width':3,'stroke-linecap':'round'}));
}
function eightBamboo(svg){
 svg.setAttribute('data-design','bamboo-eight');
 // Joined, angular tips keep each V readable even on a small river tile.
 // Two stems per chevron: upper V and lower ∧ tips face the middle.
 for(const points of [[[5,18],[24,43],[43,18]],[[57,18],[76,43],[95,18]],[[5,92],[24,67],[43,92]],[[57,92],[76,67],[95,92]]]){
  svg.append(element('path',{d:points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' '),fill:'none',stroke:'#166b46','stroke-width':8,'stroke-linecap':'butt','stroke-linejoin':'miter','stroke-miterlimit':2}));
  for(let i=0;i<2;i++){
   const [x1,y1]=points[i],[x2,y2]=points[i+1],length=Math.hypot(x2-x1,y2-y1),dx=(y2-y1)/length*3.5,dy=-(x2-x1)/length*3.5,g=element('g',{'data-bamboo-stem':'true'});
   for(const t of [.3,.7]){const x=x1+(x2-x1)*t,y=y1+(y2-y1)*t;g.append(element('path',{d:`M${x-dx} ${y-dy} L${x+dx} ${y+dy}`,fill:'none',stroke:'#0d4e33','stroke-width':1.7}));}
   svg.append(g);
  }
 }
}
// Local functional tile faces; accessible names always identify the exact kind.
export function tileFace(type,{button=false,small=false}={}){
 const tile=document.createElement(button?'button':'span');tile.className=`tile-face ${small?'tile-small':'tile'}`;tile.dataset.type=String(type);tile.dataset.suit=type<27?['m','p','s'][Math.floor(type/9)]:'z';tile.title=tileName(type);tile.setAttribute('aria-label',tileName(type));if(button)tile.type='button';
 if(type<9){tile.append(span(['一','二','三','四','五','六','七','八','九'][type],'tile-number'),span('萬','tile-man'));}
 else if(type<27){const n=type%9+1,svg=element('svg',{viewBox:'0 0 100 110',class:'tile-symbol','aria-hidden':'true',focusable:'false'});if(type===18)bird(svg);else if(type===25)eightBamboo(svg);else for(const [index,[x,y]]of dots[n].entries()){
  if(type<18){const color='#222222';svg.append(element('circle',{cx:x,cy:y+5,r:n===1?25:n<6?14:10,fill:'none',stroke:color,'stroke-width':n===1?8:6}));svg.append(element('circle',{cx:x,cy:y+5,r:n===1?11:3,fill:color}));}
  else{const color=n===7&&index<3?'#b12739':'#1a7952',length=n===1?56:n<4?30:20,thick=n===1?13:7;svg.append(element('path',{d:`M ${x} ${y+5-length/2} v ${length} M ${x-thick/2} ${y+5-length/2+4} h ${thick} M ${x-thick/2} ${y+5+length/2-4} h ${thick}`,fill:'none',stroke:color,'stroke-width':thick,'stroke-linecap':'round'}));}
 }tile.append(svg);}
 else if(type===31){tile.append(span('','tile-white'));}
 else tile.append(span({27:'東',28:'南',29:'西',30:'北',32:'發',33:'中'}[type],'tile-honor'));
 for(const child of tile.children)child.setAttribute('aria-hidden','true');return tile;
}
