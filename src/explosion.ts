import type {Game} from './game';
export type Edge=[number,number];
export type ExplosionData={clock:number;frame:number;explosionRom:number[];interrupts:{cycles:number;edges:Edge[]}[]};
export type ExplosionFrame={at:number;attributes:Uint8Array;parity:number};
export type Explosion={duration:number;frames:ExplosionFrame[];edges:Edge[];colors:number[]};
/** Native translation of BA87–BB08. Instruction boundaries matter here: the
 * sound interrupt can itself call the RNG halfway through the color RNG routine.
 * No opcodes are decoded or executed by this implementation. */
export function runExplosion(game:Game,attributes:Uint8Array,data:ExplosionData,nextInterrupt=data.frame):Explosion {
  const m=game.m,attrs=attributes.slice(),saved=attrs.slice(),edges:Edge[]=[],colors:number[]=[];
  const frames:ExplosionFrame[]=[{at:0,attributes:attrs.slice(),parity:m[0xfd1a]}];
  let cycles=0;
  const step=(length:number,action?:()=>void)=>{
    cycles+=length;action?.();
    if(cycles>=nextInterrupt){
      const start=cycles,parity=m[0xfd1a],sound=m[0xfd53],entry=data.interrupts[parity*256+sound];
      frames.push({at:start/data.clock,attributes:attrs.slice(),parity});
      nextInterrupt+=data.frame;
      // IM2 entry (19 cycles) and JP through the game's vector (10 cycles).
      const result=game.interrupt(false);
      for(let i=0;i<entry.edges.length;i++){
        const [t,v]=entry.edges[i];edges.push([start+29+t,result.state&128?result.noise[i]:v]);
      }
      for(let row=22;row<24;row++)attrs.fill(m[0xfd1a]?78:77,row*32+6,row*32+22);
      cycles+=29+entry.cycles;
    }
  };
  const ops=(...lengths:number[])=>{for(const length of lengths)step(length);};
  const addHL=()=>ops(17,4,4,4,7,4,10); // CALL D351 and its six instructions
  const random=()=>{
    let a=0,index=0,carry=0;
    ops(17,11,10);step(7,()=>{a=m[0xfd00];});step(7,()=>{a&=72;});step(7,()=>{a+=56;});
    for(let i=0;i<2;i++)step(4,()=>{carry=a>>>7;a=((a<<1)|carry)&255;});
    step(7,()=>{index=3;});
    for(let i=0;i<4;i++){
      step(15,()=>{const v=m[0xfd00+index];m[0xfd00+index]=(v<<1)|carry;carry=v>>>7;});
      if(i<3)step(4,()=>{index--;});
    }
    step(7,()=>{index=m[0xd371];});step(7,()=>{a=m[0xfd00+index];});step(7,()=>{a&=3;});
    step(4,()=>{index=a;});step(13,()=>{m[0xd371]=a;});step(7,()=>{a=m[0xfd00+index];});ops(10,10);return a;
  };
  // Save the 20×20 gameplay attributes to the original temporary buffer.
  ops(10,10,10);
  for(let y=0;y<20;y++){
    step(11);
    for(let x=0;x<20;x++){step(16,()=>{m[0x5b00+y*20+x]=saved[(y+1)*32+x+1];});ops(4,x===19?8:13);}
    step(7);addHL();ops(10,4,y===19?7:12);
  }
  step(10);let b=244,c=1,previous=144;
  for(let iteration=0;iteration<61;iteration++){
    // Original ROM-noise subroutine: period C and B samples, then B-=3, C+=3.
    ops(17,11,10);
    for(let sample=0;sample<b;sample++){
      ops(11,7,7);step(11,()=>{edges.push([cycles-3,data.explosionRom[sample]]);});step(6);
      for(let delay=0;delay<c;delay++)ops(4,4,4,delay===c-1?7:12);
      ops(10,sample===b-1?8:13);
    }
    ops(10,4,4,4,4,4,4,10);b-=3;c+=3;
    ops(11,10,10);
    let color:number;
    for(;;){
      color=random();step(7,()=>{color&=56;});step(7);
      if(color<16){step(12);continue;}step(7);step(4);
      if(color===previous){step(12);continue;}step(7);step(4,()=>{previous=color;});break;
    }
    colors.push(color);
    for(let y=1;y<=20;y++){
      step(11);
      for(let x=1;x<=20;x++){
        const ptr=y*32+x;let value=0;
        step(7,()=>{value=attrs[ptr];});step(7,()=>{value&=56;});
        if(!value)step(12);
        else {step(7);step(7,()=>{value=attrs[ptr];});step(7,()=>{value&=199;});step(4,()=>{value|=color;});step(7,()=>{attrs[ptr]=value;});}
        ops(6,x===20?8:13);
      }
      step(7);addHL();ops(10,4,y===20?7:12);
    }
    ops(10,iteration===60?8:13);b--;
  }
  // Restore original attributes; the DE carry branch varies with the row address.
  ops(10,10,10);
  for(let y=0;y<20;y++){
    step(11);
    for(let x=0;x<20;x++){step(16,()=>{attrs[(y+1)*32+x+1]=saved[(y+1)*32+x+1];});ops(4,x===19?8:13);}
    ops(7,4,4);const carry=(((y+1)*32+21)&255)+12>255;step(carry?7:12);if(carry)step(4);
    ops(10,4,y===19?7:12);
  }
  step(10);frames.push({at:cycles/data.clock,attributes:attrs.slice(),parity:m[0xfd1a]});
  return {duration:cycles/data.clock,frames,edges,colors};
}
