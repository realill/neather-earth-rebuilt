import {A,mapPtr,read16,write16,signed} from './memory';
import {World} from './world';
export const DIRECTIONS=[1,2,4,8] as const;
const OFFSETS=[1,-1,512,-512];
export class Mechanics extends World {
  random() {
    const m=this.m;let a=(m[0xfd00]&72)+56;
    let carry=(a>>>6)&1;
    for(let p=0xfd03;p>=0xfd00;p--) {const next=m[p]>>>7;m[p]=(m[p]<<1)|carry;carry=next;}
    const index=m[0xfd00+m[0xd371]]&3;m[0xd371]=index;
    return m[0xfd00+index];
  }
  robotAt(ptr:number) {
    for(let p=A.robots;p<A.robots+48*16;p+=16) if(read16(this.m,p)===ptr) return p;
    return 0;
  }
  objectHeight(ptr:number) {
    if(!(this.m[ptr]&64)) return 0;
    const robot=this.robotAt(ptr);
    if(robot) return (this.m[robot+9]+this.m[robot+13])&255;
    for(let p=A.decorations;p<A.decorations+168;p+=3)
      if(read16(this.m,p)===ptr) return this.m[0xb0c1+this.m[p+2]];
    return 0;
  }
  terrainHeight(ptr:number) {return this.m[0xd7bc+(this.m[ptr&65535]&31)];}
  altitude(x:number,y:number) {
    const p=mapPtr(x,y);return Math.max(...[0,1,-511,-512].map(d=>this.terrainHeight(p+d)));
  }
  playerFloor(x:number,y:number) {
    const p=mapPtr(x,y);
    let z=Math.max(...[0,1,-511,-512].map(d=>Math.max(this.terrainHeight(p+d),this.objectHeight(p+d))));
    for(const d of [-513,-1,511,512,513]) if(p+d<0xfd00) z=Math.max(z,this.objectHeight(p+d));
    return z;
  }
  flipRadar(x:number,y:number,owner:number) {
    x-=read16(this.m,0xfd1c);if(x<0||x>=127)return;
    const base=0xd800+owner*256;
    for(const row of [y,(y-1)&15]) for(const col of [x,x+1])
      this.m[base+row*16+(col>>>3)]^=128>>>(col&7);
  }
  updateRadar() {
    if(this.m[0xfd52]) {
      const scroll=read16(this.m,0xfd1c);
      for(let y=0;y<16;y++) for(let x=0;x<128;x+=8) {
        let value=0;
        for(let bit=0;bit<8;bit++) value=(value<<1)|((this.m[mapPtr(scroll+x+bit,y)]&31)>=15?1:0);
        this.m[0xd800+y*16+(x>>>3)]=value;
      }
      this.m.copyWithin(0xd900,0xd800,0xd900);
      for(let p=A.robots;p<A.robots+768;p+=16) if(this.m[p+1]&&this.m[p+10]!==2)
        this.flipRadar(read16(this.m,p+2),this.m[p+4],this.m[p+10]>>>7);
      this.m[0xfd52]=0;
    }
    if(this.m[0xfd1e]&1)this.flipRadar(read16(this.m,A.playerX),this.m[A.playerY],0);
  }
  override initialize() {super.initialize();this.updateRadar();}
  ship(input:number) {
    const m=this.m;m[0xfd0c]=input;
    let x=read16(m,A.playerX),y=m[A.playerY],z=m[A.altitude];
    m[mapPtr(x,y)]&=~128;
    if(m[0xfd1e]&1)this.flipRadar(x,y,0);
    if(input&12&&m[0xfd30])m[0xfd30]--;
    if((input&3)!==0&&(input&3)!==3) {
      const nx=x+(input&1?1:-1);
      if(nx>=14&&nx<=501) {
        if(z>=this.playerFloor(nx,y))x=nx;
        let scroll=read16(m,0xfd0a);
        if(((x-scroll)&255)===13)scroll--;
        if(((x-scroll)&255)===22)scroll++;
        write16(m,0xfd0a,scroll);write16(m,0xfd06,A.map+scroll);
      }
    }
    if((input&12)!==0&&(input&12)!==12) {
      const ny=(y+(input&4?1:-1))&15;
      if(ny&&z>=this.playerFloor(x,ny))y=ny;
    }
    if(m[0xfd30]) {m[0xfd30]--;if(z<48)z+=2;}
    else if(input&16) {if(z<48)z+=2;}
    else if(z>0&&z-1>=this.playerFloor(x,y))z--;
    write16(m,A.playerX,x);m[A.playerY]=y;m[A.altitude]=z;
    let radar=m[0xfd1b],relative=(Math.floor(x/8)-radar)&255;
    if(relative<2&&radar>=8)radar-=8;
    else if(relative>=14&&radar+8!==56)radar+=8;
    if(radar!==m[0xfd1b]) {m[0xfd1b]=radar;write16(m,0xfd1c,radar*8);m[0xfd52]=1;}
    m[0xfd1e]++;m[mapPtr(x,y)]|=128;this.updateRadar();
  }
  possibilities(robot:number) {
    const m=this.m,p=read16(m,robot),pieces=m[robot+7];
    const mask=64|((m[A.altitude]-m[robot+9]-m[robot+13])&128);
    const threshold=pieces&1?8:pieces&2?12:15;
    const blocked=(ptr:number,terrain=true)=>(terrain&&(m[ptr]&31)>=threshold)||!!(m[ptr]&mask);
    let bits=0;
    if(!blocked(p-510)&&!blocked(p+2)&&(p+514>=0xfd00||!blocked(p+514,false)))bits|=1;
    if(!blocked(p-513)&&!blocked(p-514,false)&&!blocked(p-2,false)&&!blocked(p-1)&&(p+510>=0xfd00||!blocked(p+510,false)))bits|=2;
    if(p+512<0xfd00&&!blocked(p+512)&&!blocked(p+513)&&(p+1025>=0xfd00||(!blocked(p+1025,false)&&!blocked(p+1024,false)&&!blocked(p+1023,false))))bits|=4;
    if(p-1024>=A.map&&!blocked(p-1025,false)&&!blocked(p-1024)&&!blocked(p-1023))bits|=8;
    return bits;
  }
  setRobotPosition(p:number,x:number,y:number) {
    write16(this.m,p+2,x);this.m[p+4]=y;const ptr=mapPtr(x,y);write16(this.m,p,ptr);this.m[ptr]|=64;
    this.flipRadar(x,y,this.m[p+10]>>>7);
  }
  moveRobot(p:number,desired:number) {
    const m=this.m;let x=read16(m,p+2),y=m[p+4];
    if(desired) {
      if(desired!==m[p+8]) {
        const both=desired|m[p+8];
        m[p+8]=both===3?desired<<2:both===12?desired>>>2:desired;m[p+6]++;
      } else {
        if(desired&3) {
          x+=desired&1?1:-1;
          if(m[p+10]!==2&&(m[p+11]===1||m[p+11]===2)) {
            if(desired===m[p+11]) {m[p+14]--;if(!m[p+14]) {m[p+11]=0;m[p+6]=0;}}
            else m[p+14]=Math.min(99,(m[p+14]+1)&255);
          }
        } else y+=desired&4?1:-1;
        m[p+13]=this.altitude(x,y);
        if(m[p+10]===2) {this.ship(desired);m[A.altitude]=m[p+9]+m[p+13];}
      }
    }
    const terrain=m[p+13]===0?0:m[p+13]<4?3:6;
    const chassis=m[p+7]&1?0:m[p+7]&2?1:2;
    m[p+15]=m[0xb61d+terrain+chassis];
    this.setRobotPosition(p,x,y);
  }
  sight(p:number) {
    let found=0;const m=this.m;
    for(let i=0;i<4;i++) {
      const dir=DIRECTIONS[i],facing=dir===m[p+8],range=facing?(m[p+7]&128?12:10):8;
      const offsets=facing?(dir&3?[-512,0,512]:[-1,0,1]):[0];
      for(const offset of offsets) {
        let ptr=read16(m,p)+offset;
        for(let distance=0;distance<range;distance++) {
          ptr+=OFFSETS[i];if(ptr<A.map||ptr>=0xfd00)break;
          if(m[ptr]&64) {
            const target=this.robotAt(ptr);
            if(target&&((m[target+10]^m[p+10])&128)&&signed((m[target+12]-1)&255)>=0) found|=dir;
            break;
          }
        }
      }
    }
    return found;
  }
  freeBullet(p:number,manual=false) {
    const start=A.bullets+(manual?0:(this.m[p+10]&128?3:1))*9;
    for(let slot=start;slot<start+(manual?1:2)*9;slot+=9)if(!this.m[slot+1])return slot;
    return 0;
  }
  fire(robot:number,type:number,manual=false) {
    const p=this.freeBullet(robot,manual);if(!p)return false;
    const m=this.m;m[p+7]=type;m[p+6]=(type===2?7:5)+(m[robot+7]&128?1:0);
    m[p+5]=m[robot+8];m[p+8]=10;
    this.advanceBullet(p,read16(m,robot+2),m[robot+4]);
    if(m[p+1])m[0xfd53]=1;return true;
  }
  advanceBullet(p:number,x:number,y:number) {
    const m=this.m,d=m[p+5];
    if(d&1)x+=2;else if(d&2)x-=2;else if(d&4)y+=2;else if(d&8)y-=2;
    if(y<0||y>=16){m[p+1]=0;m[0xfd53]=252;return;}
    write16(m,p+2,x);m[p+4]=y;
    if(this.altitude(x,y)>=m[p+8]){m[p+1]=0;m[0xfd53]=252;return;}
    const ptr=mapPtr(x,y);write16(m,p,ptr);
    for(const dy of [-1,0,1]) for(const dx of [-1,0,1]) {
      const check=ptr+dy*512+dx;if(check<A.map||check>=0xfd00)continue;
      if(!(m[check]&64))continue;
      const target=this.robotAt(check);let sound=252;
      if(target&&signed((m[target+12]-1)&255)>=0) {
        const damage=(((60-m[target+9]-m[target+13])&255)>>>2)*(m[p+7]+1);
        const health=(m[target+12]-damage)&255;
        if(!health||health&128){m[target+12]=252;sound=200;}
        else {m[target+12]=health;sound=250;}
      }
      m[p+1]=0;m[0xfd53]=sound;return;
    }
    m[ptr]|=64;
  }
  bullet(p:number) {
    const m=this.m;m[read16(m,p)]&=~64;m[p+6]--;
    if(!m[p+6]){m[p+1]=0;m[0xfd53]=252;return;}
    this.advanceBullet(p,read16(m,p+2),m[p+4]);
  }
}
