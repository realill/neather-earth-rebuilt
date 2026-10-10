import {A,read16} from './memory';
import {Renderer} from './render';
export class Screen {
  readonly pixels=new Uint8Array(6144);
  readonly attrs=new Uint8Array(768);
  private constructionVisited=1;
  x=0;y=0;lineX=0;lineY=0;attribute=71;sx=1;sy=1;
  constructor(public m:Uint8Array,public renderer:Renderer) {}
  clear(){this.constructionVisited=1;this.pixels.fill(0);this.attrs.fill(0);this.sx=this.sy=1;}
  position(x:number,y:number){this.x=this.lineX=x;this.y=this.lineY=y;}
  char(code:number) {
    const ptr=0x6680+code*8;
    for(let row=0;row<8;row++)for(let bit=0;bit<8;bit++) {
      const on=this.m[ptr+row]&(128>>>bit);
      for(let dy=0;dy<this.sy;dy++)for(let dx=0;dx<this.sx;dx++) {
        const x=this.x*8+bit*this.sx+dx,y=this.y*8+row*this.sy+dy;
        if(x<0||x>=256||y<0||y>=192)continue;
        const p=y*32+(x>>>3),mask=128>>>(x&7);
        if(on)this.pixels[p]|=mask;else this.pixels[p]&=~mask;
      }
    }
    for(let dy=0;dy<this.sy;dy++)for(let dx=0;dx<this.sx;dx++)
      this.attrs[(this.y+dy)*32+this.x+dx]=this.attribute;
    this.x+=this.sx;
  }
  text(text:string,x:number,y:number,attribute=71,sx=1,sy=1){
    this.position(x,y);this.attribute=attribute;this.sx=sx;this.sy=sy;
    for(const char of text)this.char(char.charCodeAt(0));
  }
  script(ptr:number) {
    for(let guard=0;guard<2000;guard++) {
      const command=this.m[ptr++];
      if(command===0)return;
      if(command===1){const y=this.m[ptr++],x=this.m[ptr++];this.position(x,y);}
      else if(command===2)this.attribute=this.m[ptr++];
      else if(command===3){this.lineY++;this.x=this.lineX;this.y=this.lineY;}
      else if(command===4){const v=this.m[ptr++];this.sx=(v&15)||1;this.sy=(v>>>4)||1;}
      else this.char(command);
    }
    throw new Error('Invalid UI script');
  }
  frame() {
    this.clear();this.attrs.fill(7);
    for(let x=0;x<22;x++){this.pixels[x]=255;this.pixels[175*32+x]=255;this.attrs[x]=120;this.attrs[21*32+x]=120;}
    for(let x=1;x<21;x++){this.pixels[7*32+x]=255;this.pixels[168*32+x]=255;}
    for(let y=1;y<175;y++){
      this.pixels[y*32]=y<7||y>=169?128:129;
      this.pixels[y*32+21]=y<7||y>=169?1:129;
    }
    for(let y=1;y<=20;y++){
      this.attrs[y*32]=this.attrs[y*32+21]=120;
      for(let x=1;x<=20;x++)this.attrs[y*32+x]=112;
    }
    for(let i=0;i<4;i++){this.attrs[0x233+i*30]=113;this.attrs[0x234+i*30]=113;}
    this.attrs[0x253]=65;this.attrs[0x254]=65;
    this.attrs.fill(65,0x271,0x275);this.attrs.fill(65,0x28f,0x295);
    this.script(0xd1c5);
  }
  gameArea(){
    const b=this.renderer.render();
    for(let y=0;y<160;y++)this.pixels.set(b.subarray(y*20,y*20+20),(y+8)*32+1);
    const m=this.m;this.radar();
    this.text(String(read16(m,0xfd37)).padStart(5,' '),27,0,87);
    this.text(`${String(m[0xfd36]).padStart(2,'0')}.${String(m[0xfd35]).padStart(2,'0')}`,27,1,87);
  }
  radar(parity=this.m[0xfd1a]){
    const base=parity?0xd900:0xd800,attribute=parity?78:77;
    for(let y=0;y<16;y++)for(let x=0;x<16;x++) {
      this.pixels[(176+y)*32+6+x]=this.m[base+y*16+x];
      this.attrs[((176+y)>>>3)*32+6+x]=attribute;
    }
  }
  clearHud(){
    for(let y=16;y<192;y++)this.pixels.fill(0,y*32+22,y*32+32);
    for(let y=2;y<24;y++)this.attrs.fill(0,y*32+22,y*32+32);
    this.sx=this.sy=1;
  }
  stats(){
    this.clearHud();this.script(0xd1eb);
    for(let type=0;type<7;type++){
      this.text(String(this.m[A.counts[1]+type]),22,6+type,71);
      this.text(String(this.m[A.counts[0]+type]),31,6+type,71);
      this.text(String(this.m[A.resources[0]+type]).padStart(2,' '),30,17+type,78);
    }
    this.text(String(this.m[0xfd49]).padStart(2,'0'),22,13,71);
    this.text(String(this.m[0xfd41]).padStart(2,'0'),30,13,71);
  }
  strength(p:number){this.script(0xa820);this.text(`${String(this.m[p+12]&128?0:this.m[p+12]).padStart(3,' ')}%`,25,23,71);}
  highlight(row:number){for(let y=row;y<row+2;y++)this.attrs.fill(79,y*32+23,y*32+31);}
  robotMenu(p:number,selection:number){
    this.clearHud();this.script(0xa738);this.position(23,18);this.attribute=69;
    this.script(0xa848+this.m[p+11]*27);
    if(this.m[p+11]===1||this.m[p+11]===2)this.text(String(this.m[p+14]>>>1).padStart(2,' '),25,19,69);
    this.strength(p);this.highlight(4+selection*3);
  }
  menu(script:number,p:number,selection:number,firstRow:number){this.clearHud();this.script(script);this.strength(p);this.highlight(firstRow+selection*3);}
  drawMasked(ptr:number,x:number,bottom:number,skip=0,maxHeight=255){
    const height=this.m[ptr],width=this.m[ptr+1];
    for(let row=skip;row<Math.min(height,skip+maxHeight);row++)for(let col=0;col<width;col++) {
      const y=bottom-(row-skip),screenX=x+col;
      if(y<0||y>=192||screenX<0||screenX>=32)continue;
      const p=y*32+screenX,data=ptr+2+(row*width+col)*2;
      this.pixels[p]=(this.pixels[p]&this.m[data])|this.m[data+1];
    }
  }
  construction(pieces:number,left:Uint8Array,column:number,selection:number){
    const visited=this.constructionVisited|(column===2?1<<selection:0);
    this.clear();this.constructionVisited=visited;this.script(0xc8be);
    for(let part=0;part<8;part++)if(visited&(1<<part))this.attrs.fill(69,(22-part*3)*32+21,(22-part*3)*32+32);
    for(let piece=0;piece<8;piece++) {
      const graphic=this.m[0xd6c8+piece*4+1];
      this.drawMasked(read16(this.m,0xd740+(graphic*2+1)*2),16,191-piece*24,1,24);
      for(let row=0;row<3;row++)this.attrs.fill(pieces&(1<<piece)?71:6,(21-piece*3+row)*32+16,(21-piece*3+row)*32+20);
    }
    for(let i=0;i<7;i++)this.text(String(left[i]).padStart(2,' '),13,i===0?9:10+i,68);
    this.text(String(left.reduce((a,b)=>a+b,0)).padStart(3,' '),12,18,68);
    // Preview uses a temporary robot record; construction pauses the simulation.
    const temp=0x5a00,saved=this.m.slice(temp,temp+16);
    this.m[temp+7]=pieces;this.m[temp+8]=4;this.m[temp+13]=0;
    this.renderer.buffer.fill(0);this.renderer.robot(temp,7,10);
    for(let y=0;y<72;y++)this.pixels.set(this.renderer.buffer.subarray((82+y)*20,(82+y)*20+4),(120+y)*32);
    this.m.set(saved,temp);
    for(let y=15;y<24;y++)this.attrs.fill(70,y*32,y*32+4);
    if(column===2)this.attrs.fill(70,(22-selection*3)*32+21,(22-selection*3)*32+32);
    else for(const y of [21,22])this.attrs.fill(70,y*32+4+column*6,y*32+9+column*6);
  }
  title(){
    this.clear();this.script(0xc1e6);this.script(0xc109);
    this.attribute=this.m[0xd3e4]===1?69:70;this.script(0xc128);
    this.attribute=this.m[0xd3e4]===2?69:70;this.script(0xc13f);
    this.attribute=this.m[0xd3e4]===3?69:70;this.script(0xc159);
  }
  redefine(labels:string[]){
    this.clear();this.script(0xc350);
    const names=['   UP',' DOWN',' LEFT','RIGHT',' FIRE','PAUSE','ABORT',' SAVE'];
    for(let i=0;i<Math.min(8,labels.length+1);i++){
      const y=7+i*2+(i>=5?1:0);
      this.text('PRESS KEY FOR ',3,y,70);this.text(names[i],17,y,69);this.text('  ',22,y,69);
      if(labels[i])this.text(labels[i],24,y,70);
    }
  }
  rgba(){
    const out=new Uint8ClampedArray(256*192*4);
    for(let y=0;y<192;y++)for(let x=0;x<256;x++) {
      const attr=this.attrs[(y>>>3)*32+(x>>>3)];
      const ink=!!(this.pixels[y*32+(x>>>3)]&(128>>>(x&7)));
      const color=ink?attr&7:(attr>>>3)&7,level=attr&64?255:205,p=(y*256+x)*4;
      out[p]=color&2?level:0;out[p+1]=color&4?level:0;out[p+2]=color&1?level:0;out[p+3]=255;
    }
    return out;
  }
}
