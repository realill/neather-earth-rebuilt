import {A, mapPtr, read16, write16, signed} from './memory';

/** Direct translations of Lbc6f–Lbd91 and Lbb09–Lbc6b. */
export class World {
  constructor(public readonly m: Uint8Array) {}
  addElement(ptr: number, type: number) {
    this.m[ptr] = type;
    this.m[(ptr+1)&65535] = type|32;
    this.m[(ptr-512)&65535] = type|32;
    this.m[(ptr-511)&65535] = type|32;
  }
  addStructure(ptr: number, type: number) {
    let data = read16(this.m, 0xbf9c+(type&127)*2);
    for (let guard=0; guard<100; guard++) {
      const element=this.m[data++], dx=this.m[data++], dy=this.m[data++];
      if (element) this.addElement(ptr,element);
      if (!(dx|dy)) return;
      ptr=(ptr+signed(dx)+signed(dy)*512)&65535;
    }
    throw new Error('Invalid structure data');
  }
  addDecoration(ptr: number, type: number) {
    for(let p=A.decorations;p<A.decorations+56*3;p+=3) if(!this.m[p+1]) {
      write16(this.m,p,ptr); this.m[p+2]=type; this.m[ptr]|=64; return;
    }
  }
  removeDecoration(ptr: number) {
    for(let p=A.decorations;p<A.decorations+56*3;p+=3) if(read16(this.m,p)===ptr) {
      this.m[p+1]=0; this.m[ptr]&=~64; return;
    }
  }
  assignBuilding(index: number, owner: number) {
    const p=A.buildings+index*5;
    this.m[p+3]=(this.m[p+3]&31)|(owner===0?64:32);
    let ptr=mapPtr(read16(this.m,p),this.m[p+2]);
    if(index<4) {
      ptr=(ptr-2048)&65535;
      this.removeDecoration(ptr); this.removeDecoration(ptr-4); this.removeDecoration(ptr+4);
      if(owner===0) { this.addDecoration(ptr,0); this.addDecoration(ptr-4,7); }
      else this.addDecoration(ptr+4,8);
    } else {
      ptr-=1024;
      this.removeDecoration(ptr+2); this.removeDecoration(ptr-2);
      this.addDecoration(ptr+(owner===0?-2:2),7+owner);
    }
  }
  countBuildings() {
    for(const p of A.counts) this.m.fill(0,p,p+7);
    for(let p=A.buildings;p<A.buildings+28*5;p+=5) {
      const type=this.m[p+3];
      if(type&128) continue;
      const owner=type&64?0:type&32?1:-1;
      if(owner===0||owner===1) this.m[A.counts[owner]+(type&7)]++;
    }
  }
  dailyResources() {
    for(let owner=0;owner<2;owner++) for(let type=0;type<7;type++) {
      const p=A.resources[owner]+type;
      this.m[p]=Math.min(99,this.m[p]+this.m[A.counts[owner]+type]*(type===0?5:2));
    }
  }
  initialize() {
    this.m.fill(0,A.map,0xfd00);
    this.m.fill(0,A.robots,A.map);
    this.m.fill(0,A.bullets,A.bullets+45);
    this.m.fill(0,0xfd04,0xfdfd);
    this.m.fill(0,A.decorations,A.decorations+168);
    write16(this.m,0xfd00,12345);write16(this.m,0xfd02,12345);
    this.m[0xd371]=0;
    write16(this.m,0xfd06,A.map);write16(this.m,A.playerX,17);
    this.m[A.playerY]=10;this.m[0xfd30]=3;
    this.m[A.resources[0]]=20;this.m[A.resources[1]]=20;
    for(const [start,high] of [[0xbda9,0],[0xbe79,256]]) {
      let p=start;
      while(this.m[p]) {
        const type=this.m[p++], x=this.m[p++]+high,y=this.m[p++];
        if(type&128) this.addStructure(mapPtr(x,y),type);
        else this.addElement(mapPtr(x,y),type);
      }
    }
    let base=A.buildings, factory=A.buildings+20;
    for(const [start,high] of [[0xbf46,0],[0xbf6e,256]]) {
      let p=start;
      while(!(this.m[p]&128)) {
        const type=this.m[p++],x=this.m[p++]+high,y=this.m[p++];
        const record=type?factory:base;
        write16(this.m,record,x);this.m[record+2]=y;this.m[record+3]=type;
        this.m[record+4]=0;
        this.addStructure(mapPtr(x,y),type?129:128);
        if(type) { this.addDecoration(mapPtr(x,y-2),type); factory+=5; }
        else base+=5;
      }
    }
    for(let i=0;i<4;i++) this.assignBuilding(i,i===0?0:1);
    this.countBuildings();this.m[0xfd52]=1;
    this.m[mapPtr(17,10)]|=128;
  }
}
