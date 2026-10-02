import {tileName} from '../engine/tiles.mjs';
const SVG='http://www.w3.org/2000/svg';
const dots={1:[[50,50]],2:[[50,24],[50,76]],3:[[24,22],[50,50],[76,78]],4:[[24,24],[76,24],[24,76],[76,76]],5:[[24,24],[76,24],[50,50],[24,76],[76,76]],6:[[24,18],[76,18],[24,50],[76,50],[24,82],[76,82]],7:[[24,16],[50,31],[76,16],[24,57],[76,57],[24,84],[76,84]],8:[[24,13],[76,13],[24,38],[76,38],[24,63],[76,63],[24,88],[76,88]],9:[[22,16],[50,16],[78,16],[22,50],[50,50],[78,50],[22,84],[50,84],[78,84]]};
function element(tag,attributes){const el=document.createElementNS(SVG,tag);for(const [key,value]of Object.entries(attributes))el.setAttribute(key,String(value));return el;}
function span(text,cls){const el=document.createElement('span');el.className=cls;el.textContent=text;return el;}
// Local functional tile faces; accessible names always identify the exact kind.
export function tileFace(type,{button=false,small=false}={}){
 const tile=document.createElement(button?'button':'span');tile.className=`tile-face ${small?'tile-small':'tile'}`;tile.dataset.type=String(type);tile.dataset.suit=type<27?['m','p','s'][Math.floor(type/9)]:'z';tile.title=tileName(type);tile.setAttribute('aria-label',tileName(type));if(button)tile.type='button';
 if(type<9){tile.append(span(['一','二','三','四','五','六','七','八','九'][type],'tile-number'),span('萬','tile-man'));}
 else if(type<27){const n=type%9+1,svg=element('svg',{viewBox:'0 0 100 110',class:'tile-symbol','aria-hidden':'true',focusable:'false'});for(const [index,[x,y]]of dots[n].entries()){
  if(type<18){const color=n===1?'#245176':n===5&&index===2?'#b12739':index%3===0?'#b12739':'#245176';svg.append(element('circle',{cx:x,cy:y+5,r:n===1?25:n<6?14:10,fill:'none',stroke:color,'stroke-width':n===1?8:6}));svg.append(element('circle',{cx:x,cy:y+5,r:n===1?11:3,fill:color}));}
  else{const color=n===7&&index<3?'#b12739':'#1a7952',length=n===1?56:n<4?30:20,thick=n===1?13:7;svg.append(element('path',{d:`M ${x} ${y+5-length/2} v ${length} M ${x-thick/2} ${y+5-length/2+4} h ${thick} M ${x-thick/2} ${y+5+length/2-4} h ${thick}`,fill:'none',stroke:color,'stroke-width':thick,'stroke-linecap':'round'}));}
 }tile.append(svg);}
 else if(type===31){tile.append(span('','tile-white'));}
 else tile.append(span({27:'東',28:'南',29:'西',30:'北',32:'發',33:'中'}[type],'tile-honor'));
 for(const child of tile.children)child.setAttribute('aria-hidden','true');return tile;
}
