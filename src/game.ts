import {Mechanics,DIRECTIONS} from './mechanics';
import {A,mapPtr,read16,write16,signed} from './memory';
const bits=(n:number)=>{let c=0;for(;n;n&=n-1)c++;return c;};
export class Game extends Mechanics {
  outcome:'playing'|'won'|'lost'='playing';
  onExplosion?:()=>void;
  onSound?: (state:number,noise:number[])=>void;
  interrupt(emitSound=true) {
    const m=this.m;m[0xfd34]++;m[0xfd1a]^=1;
    if(!m[0xfd53])return {state:0,noise:[] as number[]};
    let state=(m[0xfd53]+1)&255;if(state===128)state=0;m[0xfd53]=state;
    const noise:number[]=[];
    if(state&128)for(let i=0;i<30;i++)noise.push(this.random()&16?1:0);
    if(state&&emitSound)this.onSound?.(state,noise);
    return {state,noise};
  }
  countRobots() {
    for(let owner=0;owner<2;owner++) {
      let count=0;for(let i=0;i<24;i++)if(this.m[A.robots+owner*384+i*16+1])count++;
      this.m[A.counts[owner]+7]=count;
    }
  }
  quote(pieces:number,owner=0) {
    const left=this.m.slice(A.resources[owner],A.resources[owner]+7);let general=0;
    for(let piece=0;piece<8;piece++) if(pieces&(1<<piece)) {
      const type=this.m[A.factoryTypes+piece],cost=this.m[A.costs+piece];
      const available=Math.min(left[type],cost);left[type]-=available;general+=cost-available;
    }
    const affordable=left[0]>=general;left[0]-=general;
    return {left,general,affordable};
  }
  legal(pieces:number) {return bits(pieces&7)===1&&bits(pieces&120)>0&&bits(pieces&120)<=3;}
  baseClear(index:number) {
    const p=A.buildings+index*5,ptr=mapPtr(read16(this.m,p),this.m[p+2]);
    return ![0,512,511,513].some(d=>this.m[ptr+d]&64);
  }
  build(index:number,pieces:number) {
    const m=this.m,b=A.buildings+index*5;
    if(m[b+3]!==64||!this.baseClear(index)||!this.legal(pieces))return 0;
    let p=A.robots;while(p<A.robots+384&&m[p+1])p+=16;if(p===A.robots+384)return 0;
    const quote=this.quote(pieces);if(!quote.affordable)return 0;
    m.set(quote.left,A.resources[0]);
    m[p+7]=pieces;m[p+8]=4;m[p+10]=0;m[p+13]=0;m[p+9]=this.height(pieces);
    m[p+5]=4;m[p+6]=5;m[p+11]=0;m[p+12]=100;m[p+15]=1;
    this.setRobotPosition(p,read16(m,b),m[b+2]);this.countRobots();m[0xfd30]=5;return p;
  }
  height(pieces:number) {let n=0;for(let i=0;i<8;i++)if(pieces&(1<<i))n+=this.m[A.heights+i];return n;}
  targetGroup(order:number,owner:number) {
    const base=order===5||order===8;
    return {start:A.buildings+(base?0:20),count:base?4:24,flag:order===6?0:owner?64:32};
  }
  nearest(p:number,order:number) {
    const m=this.m,owner=m[p+10]>>>7,x=read16(m,p+2);let best=255,distance=8192;
    if(order===3) {
      for(let i=0;i<24;i++) {
        const target=A.robots+(1-owner)*384+i*16;
        if(!m[target+1])continue;const d=Math.abs(read16(m,target+2)-x);
        if(d<distance){distance=d;best=i;}
      }
    } else {
      const group=this.targetGroup(order,owner);
      for(let i=0;i<group.count;i++) {
        const b=group.start+i*5;if((m[b+3]&224)!==group.flag)continue;
        let taken=false;
        for(let r=A.robots+owner*384;r<A.robots+(owner+1)*384;r+=16)
          if(m[r+1]&&m[r+11]===order&&m[r+14]===i){taken=true;break;}
        if(taken)continue;const d=Math.abs(read16(m,b)-x);
        if(d<distance){distance=d;best=i;}
      }
    }
    return best;
  }
  order(p:number,order:number,argument=0) {
    const m=this.m;m[p+11]=order;
    if((order===4||order===5)&&!(m[p+7]&64)){m[p+11]=0;return false;}
    m[p+14]=order>=3?255:argument;
    if(order>=3){m[p+14]=this.nearest(p,order);if(m[p+14]===255){m[p+11]=0;return false;}}
    return true;
  }
  pickDirection(possible:number) {
    if(!(possible&15))return 0;
    let c=possible;
    for(let tries=0;tries<10000;tries++) {
      c&=this.random();const n=bits(c&15);if(n===1)return c;if(n===0)c=possible;
    }
    throw new Error('Random direction did not converge');
  }
  prefer(possible:number,good:number) {
    const d=good&3;
    if(!(possible&d))return this.pickDirection(possible);
    if(this.random()&d)return d;
    if(this.random()&d)return d;
    return this.pickDirection(possible&(d^252));
  }
  chooseDirection(p:number,possible:number) {
    const m=this.m,order=m[p+11],owner=m[p+10]>>>7;
    if(order===0)return 0;
    if(order<3)return this.prefer(possible,order);
    let target:number,building=order!==3;
    if(!building) {
      let index=m[p+14];target=A.robots+(1-owner)*384+index*16;
      if(index&128||!m[target+1]||Math.abs(read16(m,target+2)-read16(m,p+2))>=50) {
        m[p+14]=255;index=this.nearest(p,3);m[p+14]=index;
        if(index===255)return this.pickDirection(possible);
        target=A.robots+(1-owner)*384+index*16;
      }
      target+=2;
    } else {
      const group=this.targetGroup(order,owner);
      // Eight-bit multiplication is an observable feature of the original.
      target=group.start+((m[p+14]*5)&255);
      if((m[target+3]&224)!==group.flag) {
        const index=this.nearest(p,order);
        if(index===255){if(owner)m[p+11]=3;return 0;}
        m[p+14]=index;
        // The original leaves HL after the search table on this first cycle.
        target=group.start+group.count*5;
      }
    }
    const dx=read16(m,p+2)-read16(m,target);
    let dy=signed((m[p+4]-m[target+2])&255);
    if(building&&dx!==0)dy=signed((dy-3)&255);
    const good=(dx<0?1:dx>0?2:0)|(dy<0?4:dy>0?8:0);
    if(!good) {
      if(order===4||order===5){this.nuclear(p);return 0;}
      if(m[p+8]===4)return 0;m[p+6]=255;return 4;
    }
    const distance=Math.abs(signed(dx&255));
    if(distance>=8)return this.prefer(possible,good);
    if(!(good&possible))return this.pickDirection(possible);
    const choices=good&possible;
    if((choices&3)&&distance)m[p+6]=distance-1;
    return this.pickDirection(choices);
  }
  enemyRobot(p:number) {
    const m=this.m;let order=m[p+11];
    if(order) {
      if(this.random()&31)return;
      if(order>=4) {
        const g=this.targetGroup(order,1),target=g.start+((m[p+14]*5)&255);
        if((m[target+3]&224)!==g.flag&&m[p+4]===m[target+2]&&read16(m,p+2)===read16(m,target))return;
      }
    }
    m[p+11]=3;
    if(m[p+7]&64){const r=this.random();order=4+((r|(r>>>7))&1);}
    else {const r=this.random();order=6+(r&1?0:r&2?1:2);}
    m[p+11]=order;m[p+14]=255;m[p+14]=this.nearest(p,order);
    if(m[p+14]===255)m[p+11]=3;
  }
  enemy() {
    const m=this.m,index=this.random()&31;if(index>=24)return;
    const p=A.robots+384+index*16;m[0xfd51]=1;
    if(m[p+1]){this.enemyRobot(p);return;}
    let base=-1;
    for(let i=0;i<4;i++)if((this.random()&1)&&m[A.buildings+i*5+3]===32){base=i;break;}
    if(base<0||!this.baseClear(base))return;
    this.random();const pieces=this.random();m[p+7]=pieces;
    if(!this.legal(pieces)||bits((pieces>>>3)&15)<((Math.floor(m[0xfd49]/8)+1)&3))return;
    const q=this.quote(pieces,1);
    // The AI checks its general-resource spending limit before affordability.
    const buffer=this.m.slice(A.resources[1],A.resources[1]+7);buffer.set(q.left.slice(1),1);
    m.set(buffer,0xfd29);
    if(q.general>Math.max(11,m[A.resources[1]]>>>1)||!q.affordable)return;
    m.set(q.left,0xfd29);m.set(q.left,A.resources[1]);
    const b=A.buildings+base*5;m[p+10]=128;
    this.setRobotPosition(p,read16(m,b),m[b+2]);
    m[p+5]=4;m[p+8]=4;m[p+6]=3;m[p+13]=0;m[p+11]=0;m[p+15]=1;m[p+12]=100;m[p+14]=255;
    m[p+9]=this.height(pieces);this.countRobots();
  }
  robot(p:number,input=0) {
    const m=this.m,hp=m[p+12];
    if(hp&128) {m[p+12]++;if(hp&1)m[read16(m,p)]|=64;else m[read16(m,p)]&=~64;return;}
    if(!hp) {
      const ptr=read16(m,p);m[ptr]&=~64;
      if(!((m[ptr]|m[ptr+1]|m[ptr-511]|m[ptr-512])&63))this.addElement(ptr,6+(this.random()&1));
      this.flipRadar(read16(m,p+2),m[p+4],m[p+10]>>>7);m[p+1]=0;this.countRobots();return;
    }
    if(m[p+10]===1)return;
    m[0xfd51]=m[p+10]>>>7;m[p+15]--;if(m[p+15])return;
    m[read16(m,p)]&=~64;this.flipRadar(read16(m,p+2),m[p+4],m[p+10]>>>7);
    const possible=this.possibilities(p);
    if(m[p+10]===2) {
      let desired=input;if(desired===m[p+8])desired&=possible;
      if(bits(desired&15)!==1)desired=m[p+5]&possible;
      m[p+5]=desired;m[0xfd0c]=desired;this.moveRobot(p,desired);return;
    }
    const enemies=this.sight(p);
    if(enemies) {
      if(enemies&m[p+8]) {
        m[p+5]=enemies&m[p+8]&possible;
        if(this.freeBullet(p)) {
          const weapon=this.random()&56&m[p+7];
          if(weapon) {const type=weapon&32?3:weapon&16?2:1;this.fire(p,type);m[p+5]=0;}
        }
        m[p+6]=1;
      } else {m[p+5]=bits(enemies&15)===1?enemies:this.pickDirection(enemies);m[p+6]=2;}
    } else {
      m[p+6]--;
      if((m[p+6]&128)||!(m[p+5]&possible)) {
        m[p+6]=3+(this.random()&3);
        const direction=possible?this.chooseDirection(p,possible):possible;
        if(!m[p+1])return;m[p+5]=direction;
      }
    }
    this.moveRobot(p,m[p+5]);
  }
  destroyBuilding(index:number) {
    const m=this.m,p=A.buildings+index*5;let ptr=mapPtr(read16(m,p),m[p+2]);m[p+3]=128;
    if(index<4){for(const dx of [0,-4,4])this.removeDecoration(ptr-2048+dx);}
    else {for(const dx of [2,0,-2])this.removeDecoration(ptr-1024+dx);}
    let src=index<4?0xbfb2:0xbfe2;
    for(let guard=0;guard<100;guard++) {
      const type=m[src++],dx=signed(m[src++]),dy=signed(m[src++]);
      if(type)this.addElement(ptr,6+(this.random()&1));
      if(!(dx|dy))return;ptr+=dx+dy*512;
    }
  }
  nuclear(p:number) {
    const m=this.m,x=read16(m,p+2),y=m[p+4];
    for(let i=0;i<28;i++) {
      const b=A.buildings+i*5;if(m[b+3]&128)continue;
      const dx=Math.abs(x-read16(m,b)),dy=Math.abs(signed((y+(i<4?5:1)-m[b+2])&255));
      if(dx<(i<4?7:5)&&dy<(i<4?7:5)&&dx+dy<(i<4?10:7)){this.destroyBuilding(i);break;}
    }
    const origin=read16(m,p)-2052;
    for(let row=0;row<9;row++) {
      const edge=row===0||row===8?2:row===1||row===7?1:0;
      if(origin+row*512<0xdf00||origin+row*512>=0xfd00)continue;
      for(let col=edge;col<9-edge;col++) {
        const ptr=origin+row*512+col;
        if(m[ptr]&64) {const robot=this.robotAt(ptr);if(robot){m[robot+1]=0;m[ptr]&=~64;}}
        const v=m[ptr];if(!(v&32)&&(v&31)>=17&&(v&31)<21)this.addElement(ptr,6+(this.random()&1));
      }
    }
    m[p+1]=0;m[mapPtr(read16(m,A.playerX),m[A.playerY])]|=128;
    // The effect loops 61 times: B starts at 244 and loses four per iteration.
    if(this.onExplosion)this.onExplosion();
    else {
      let previous=0;
      for(let i=0;i<61;i++) {let color;do{color=this.random()&56;}while(color<16||color===previous);previous=color;}
    }
    m[0xfd52]=1;this.countRobots();this.countBuildings();
  }
  units(input=0) {
    this.enemy();
    for(let p=A.robots;p<A.robots+768;p+=16)if(this.m[p+1])this.robot(p,input);
    for(let p=A.bullets;p<A.bullets+45;p+=9)if(this.m[p+1])this.bullet(p);
  }
  clock() {
    const m=this.m;this.random();m[0xfd35]+=5;
    if(m[0xfd35]===60){m[0xfd35]=0;m[0xfd36]++;if(m[0xfd36]===24){m[0xfd36]=0;write16(m,0xfd37,read16(m,0xfd37)+1);this.dailyResources();}}
    if(!m[A.counts[1]])this.outcome='won';else if(!m[A.counts[0]])this.outcome='lost';
    let changed=false;
    for(let i=0;i<28;i++) {
      const p=A.buildings+i*5,ptr=mapPtr(read16(m,p),m[p+2]);
      if(!(m[ptr]&64)){m[p+4]=0;continue;}
      m[p+4]++;if(m[p+4]<144)continue;m[p+4]=0;
      const robot=this.robotAt(ptr);if(robot){this.assignBuilding(i,m[robot+10]>>>7);changed=true;}
    }
    if(changed)this.countBuildings();
    m[0xfd34]=0;
  }
}
