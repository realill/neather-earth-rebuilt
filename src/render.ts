import {A, mapPtr, read16, signed} from './memory';

/** Original 160×160 one-bit renderer, translated from Lccbd–Ld071. */
export class Renderer {
  readonly buffer = new Uint8Array(3200);
  elevation=0;
  constructor(public readonly m: Uint8Array) {}
  blank() {
    const b=this.buffer;b.fill(0);
    for(let y=0;y<40;y++) b.fill(255,y*20,y*20+10-Math.floor(y/8)*2);
    const diagonal=(src:number,p:number,count:number)=>{
      for(let n=0;n<count;n++) {
        for(let y=0;y<8;y++) {b[p++]=this.m[src+y*2];b[p++]=this.m[src+y*2+1];p+=18;}
        p-=2;
      }
    };
    diagonal(0xd6a8,10,6);diagonal(0xd6a8,136*20+18,3);diagonal(0xd6b8,128*20+18,4);
  }
  sprite(index:number,x:number,y:number,elevation=this.elevation) {
    // Z80 rotates and wraps the coordinate bytes before calculating clipping.
    let e=x&255;e=((e<<1)|(e>>>7))&255;
    const nibble=(e+y-24)&255;
    e=((e<<1)|(e>>>7))&255;
    const bottom=(y*8+100-e-elevation)&255;
    const left=signed(nibble)>>1;
    if(left>=20 || bottom>=226) return;
    const ptr=read16(this.m,0xd6e8+(((index&63)*2+(nibble&1))*2));
    const height=this.m[ptr],width=this.m[ptr+1];
    for(let row=0;row<height;row++) {
      const screenY=bottom-row;
      if(screenY<0) break;
      if(screenY>=160) continue;
      for(let col=0;col<width;col++) {
        const screenX=left+col;
        if(screenX<0||screenX>=20) continue;
        const data=ptr+2+(row*width+col)*2;
        const out=screenY*20+screenX;
        this.buffer[out]=(this.buffer[out]&this.m[data])|this.m[data+1];
      }
    }
  }
  robot(ptr:number,x:number,y:number) {
    this.elevation=this.m[ptr+13];
    const bits=this.m[ptr+7], dir=Math.max(0,Math.log2(this.m[ptr+8])|0);
    for(let piece=0;piece<8;piece++) if(bits&(1<<piece)) {
      this.sprite(22+this.m[0xd6c8+piece*4+dir],x,y);
      this.elevation+=this.m[A.heights+piece];
    }
  }
  private findAt(start:number,count:number,stride:number,ptr:number) {
    for(let p=start;p<start+count*stride;p+=stride) if(read16(this.m,p)===ptr) return p;
    return 0;
  }
  private moreInFront(p:number,current:number,object=false) {
    const v=this.m[p];
    if(!object && ((v&32)||!(v&31))) return current;
    const dx=signed(((current&255)-(p&255))&255);
    const dy=((p>>>8)-0xdd>>>1)-((current>>>8)-0xdd>>>1);
    const delta=signed((dy+dx)&255);
    return delta<0 || (delta===0&&dx>=0)?current:p;
  }
  private terrainInFront(ptr:number,current=ptr) {
    for(const p of [ptr+511,ptr+512,ptr-1,ptr+513])
      if(p>=A.map&&p<0xfd00) current=this.moreInFront(p,current);
    return current;
  }
  private playerInFront(ptr:number) {
    let current=this.terrainInFront(ptr);
    for(const p of [ptr-513,ptr-1,ptr+511,ptr+512,ptr+513]) if(p>=A.map&&p<0xfd00&&(this.m[p]&64)) {
      current=this.moreInFront(p,current,true);current=this.terrainInFront(p,current);
    }
    return current;
  }
  render() {
    this.blank();const scroll=read16(this.m,0xfd06)-A.map;
    this.sprite(1,read16(this.m,A.playerX)-scroll,this.m[A.playerY],0);
    let deferredPlayer: [number,number]|undefined;
    // Diagonals, from the top of the screen toward the camera.
    for(let diagonal=31;diagonal>=-14;diagonal--) {
      for(let y=0;y<16;y++) {
        const x=diagonal+y;if(x<0||x>=32) continue;
        const ptr=mapPtr(scroll+x,y), cell=this.m[ptr];
        if(!cell) continue;
        if(!(cell&32)&&(cell&31)) this.sprite(cell&31,x,y,0);
        if(cell&64) {
          let object=this.findAt(A.robots,48,16,ptr),bullet=false;
          if(!object) {
            const deco=this.findAt(A.decorations,56,3,ptr);
            if(deco) {
              const type=this.m[deco+2];this.sprite(this.m[0xce56+type],x,y,this.m[0xce5f+type]);
            } else {object=this.findAt(A.bullets,5,9,ptr);bullet=!!object;}
          }
          if(object) {
            const front=this.terrainInFront(ptr);
            if(front!==ptr) {this.m[front]|=64;this.m[object]=front&255;this.m[object+1]=front>>>8;}
            else {
              const ox=read16(this.m,object+2),oy=this.m[object+4],original=mapPtr(ox,oy);
              if(original!==ptr) {
                this.m[ptr]&=~64;this.m[object]=original&255;this.m[object+1]=original>>>8;
              }
              if(bullet) this.sprite(43+this.m[object+7]*2+(this.m[object+5]>=3?1:0),ox-scroll,oy,this.m[object+8]);
              else this.robot(object,ox-scroll,oy);
            }
          }
        }
        if(this.m[ptr]&128) {
          if(deferredPlayer) {
            this.m[ptr]&=~128;this.sprite(0,...deferredPlayer,this.m[A.altitude]);
          } else {
            const front=this.playerInFront(ptr);
            if(front!==ptr) {this.m[front]|=128;deferredPlayer=[x,y];}
            else this.sprite(0,x,y,this.m[A.altitude]);
          }
        }
      }
    }
    return this.buffer;
  }
}
