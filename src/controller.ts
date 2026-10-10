import {A,mapPtr,read16} from './memory';
import {Game} from './game';
import {Renderer} from './render';
import {Screen} from './screen';
import {runExplosion,type Explosion,type ExplosionData} from './explosion';
export type Mode='title'|'redefine'|'flight'|'robot'|'direct'|'orders'|'capture'|'destroy'|'distance'|'combat'|'construction'|'end';
export class Controller {
  mode:Mode='title';screen:Screen;renderer:Renderer;
  redefined:string[]=[];
  private effects:{effect:Explosion;pixels:Uint8Array;elapsed:number;frame:number}[]=[];
  private endSoundPending=false;
  onExplosionAudio?:(effect:Explosion)=>void;
  get exploding(){return this.effects.length>0;}
  resetEffects(){this.effects=[];this.endSoundPending=false;this.releaseMask=0;}
  configureExplosion(data:ExplosionData){
    this.game.onExplosion=()=>{
      // The original redraws the destroyed landscape before flashing its attributes.
      this.screen.gameArea();
      const pixels=this.screen.pixels.slice(),effect=runExplosion(this.game,this.screen.attrs,data);
      this.effects.push({effect,pixels,elapsed:0,frame:0});
      if(this.effects.length===1)this.onExplosionAudio?.(effect);
    };
  }
  private showExplosion(){
    const current=this.effects[0];if(!current)return;
    while(current.frame+1<current.effect.frames.length&&current.effect.frames[current.frame+1].at<=current.elapsed)current.frame++;
    const frame=current.effect.frames[current.frame];
    this.screen.pixels.set(current.pixels);this.screen.attrs.set(frame.attributes);this.screen.radar(frame.parity);
  }
  private releaseMask=0;
  private manualShot=false;
  endFrames=0;onEnd?:()=>void;onBeep?:(...pitches:number[])=>void;
  selectedRobot=0;selection=0;base=0;pieces=0;column=2;distance=0;distanceOrder=1;distanceTouched=false;
  directReturn:Mode='robot';lastInput=0;paused=false;message='';
  constructor(public game:Game){this.renderer=new Renderer(game.m);this.screen=new Screen(game.m,this.renderer);this.screen.title();}
  start(){this.resetEffects();this.game.initialize();this.game.outcome='playing';this.mode='flight';this.selectedRobot=0;this.selection=0;this.directReturn='robot';this.distance=0;this.distanceOrder=1;this.distanceTouched=false;this.paused=false;this.lastInput=0;this.releaseMask=0;this.draw();}
  title(){this.resetEffects();this.mode='title';this.paused=false;this.selectedRobot=0;this.lastInput=0;this.releaseMask=0;this.message='Select controls, redefine keys, or press 0 to start.';this.draw();}
  leave(){const m=this.game.m,p=this.selectedRobot;if(p){m[p+10]=0;m[p+6]=0;}m[0xfd30]=5;this.mode='flight';this.selectedRobot=0;}
  landed(){
    const m=this.game.m,ptr=mapPtr(read16(m,A.playerX),m[A.playerY]);
    if(!(m[ptr]&64))return;
    const robot=this.game.robotAt(ptr);
    if(robot&&robot<A.robots+384&&m[A.altitude]===m[robot+9]+m[robot+13]){
      this.selectedRobot=robot;m[robot+10]=1;this.mode='robot';this.selection=3;return;
    }
    if(m[A.altitude]!==15)return;
    for(let i=0;i<4;i++) {
      const b=A.buildings+i*5;
      if(m[b+3]===64&&read16(m,b)===read16(m,A.playerX)&&m[b+2]-4===m[A.playerY]&&this.game.baseClear(i)&&m[0xfd41]<24){
        this.mode='construction';this.base=i;this.pieces=0;this.column=2;this.selection=0;return;
      }
    }
  }
  interrupt(){
    if(this.paused)return;
    if(this.exploding){
      const current=this.effects[0];current.elapsed+=0.02;
      if(current.elapsed>=current.effect.duration){
        this.effects.shift();
        if(this.exploding)this.onExplosionAudio?.(this.effects[0].effect);
        else if(this.endSoundPending){this.onEnd?.();this.endSoundPending=false;}
      }
      if(this.exploding)this.showExplosion();else this.draw();
      return;
    }
    if(this.mode==='end'){if(this.endFrames)this.endFrames--;return;}
    if(this.paused||this.mode==='construction'||this.mode==='redefine')return;
    if(this.mode==='title'){
      const m=this.game.m;m[0xfd33]=(m[0xfd33]+1)&15;
      if(!(m[0xfd33]&1))for(let y=1;y<8;y++)this.screen.attrs.fill(64+(m[0xfd33]>>>1),y*32+10,y*32+22);
      return;
    }
    this.game.interrupt();this.screen.radar();
  }
  private worldTick(input:number){
    const m=this.game.m;
    if(this.mode==='flight')this.game.ship(input);
    this.game.units(this.mode==='direct'?input:0);
    if(this.mode!=='flight'){
      if(m[0xfd1e]&1)this.game.flipRadar(read16(m,A.playerX),m[A.playerY],0);
      m[0xfd1e]++;this.game.updateRadar();
    }
    this.game.clock();
  }
  private finishTick(){
    if(this.game.outcome!=='playing'){
      this.mode='end';this.endFrames=100;
      if(this.exploding)this.endSoundPending=true;else this.onEnd?.();
      this.message='Press a control key to return to the title.';
    }else if(this.selectedRobot&&!this.game.m[this.selectedRobot+1])this.leave();
    this.draw();
  }
  step(input:number){
    if(this.exploding||this.paused||this.mode==='title'||this.mode==='redefine'||this.mode==='end')return;
    if(this.releaseMask){if(input&this.releaseMask)return;this.releaseMask=0;}
    this.lastInput=input;
    if(this.mode==='construction'){
      this.constructionInput(input);if(input&16&&this.mode==='construction')this.releaseMask=16;
      this.draw();return;
    }
    if(this.selectedRobot&&!this.game.m[this.selectedRobot+1])this.leave();
    if(this.mode==='flight'){
      this.worldTick(input);
      if(this.game.outcome==='playing'){this.landed();if((this.mode as Mode)==='robot')this.releaseMask=31;}
    }else if(this.mode==='direct'||this.mode==='distance'){
      // These two original loops update the world before polling the controls.
      this.worldTick(input);
      if(this.game.outcome==='playing'&&this.game.m[this.selectedRobot+1]){
        this.menuInput(input);if(input&16)this.releaseMask=31;
      }
    }else{
      // A menu confirmation returns immediately; only a successful manual shot
      // advances the clock, without updating all the other robots first.
      this.manualShot=false;this.menuInput(input);
      if(input&16){if(this.manualShot)this.game.clock();if((this.mode as Mode)!=='flight')this.releaseMask=31;}
      else this.worldTick(input);
    }
    this.finishTick();
  }
  constructionInput(input:number){
    const oldColumn=this.column,oldSelection=this.selection;
    if(!(input&16)){
      if(input&3){const next=this.column+(input&1?1:0)-(input&2?1:0);if(next>=0&&next<3)this.column=next;}
      else if(this.column===2){const next=this.selection+(input&8?1:0)-(input&4?1:0);if(next>=0&&next<8)this.selection=next;}
    }
    if(this.column!==oldColumn||this.selection!==oldSelection)this.onBeep?.(20);
    if(!(input&16))return;
    if(this.column===0){this.onBeep?.(200);this.game.m[0xfd30]=5;this.mode='flight';return;}
    if(this.column===1){if(this.game.build(this.base,this.pieces)){this.onBeep?.(80,75,70,65,60,55,50,45,40,35,30,25,20,200);this.mode='flight';this.message='Robot deployed. Land on it to issue orders.';}else this.message='Choose a chassis and 1–3 weapons.';return;}
    const removing=!!(this.pieces&(1<<this.selection));
    // The original refunds/removes the old chassis before checking its replacement.
    if(!removing&&this.selection<3)this.pieces&=~7;
    let candidate=this.pieces;
    if(removing)candidate&=~(1<<this.selection);else candidate|=1<<this.selection;
    if(this.game.quote(candidate).affordable&&((candidate&120).toString(2).match(/1/g)?.length??0)<=3){this.pieces=candidate;this.onBeep?.(removing?120:100);}
    else {this.message='Insufficient resources, or too many weapons.';this.onBeep?.(120);}
  }
  menuInput(input:number){
    const m=this.game.m,p=this.selectedRobot;
    if(this.mode==='direct'){if(input&16){this.onBeep?.(120);m[p+10]=1;this.mode=this.directReturn;}return;}
    if(this.mode==='distance'){
      const oldDistance=this.distance;
      if(!(input&16)&&(input&12))this.distance=Math.max(0,Math.min(50,this.distance+(input&8?5:-5)));
      if(this.distance!==oldDistance){this.distanceTouched=true;this.onBeep?.(20);}
      if(input&16){this.onBeep?.(120);this.game.order(p,this.distance?this.distanceOrder:0,this.distance*2);this.mode='robot';this.selection=1;}return;
    }
    const oldSelection=this.selection;
    const count=this.mode==='robot'?4:this.mode==='orders'?5:this.mode==='combat'?6:3;
    if(!(input&16)&&(input&12))this.selection=Math.max(0,Math.min(count-1,this.selection+(input&4?1:-1)));
    if(this.selection!==oldSelection)this.onBeep?.(20);
    if(!(input&16))return;
    this.onBeep?.(100);
    const selection=this.selection;
    if(this.mode==='robot'){
      if(selection===0){this.mode='direct';this.directReturn='robot';m[p+10]=2;m[p+5]=0;}
      if(selection===1){this.mode='orders';this.selection=0;}
      if(selection===2){this.mode='combat';this.selection=5;}
      if(selection===3){this.onBeep?.(120);this.leave();}
    } else if(this.mode==='orders'){
      if(selection===0){this.onBeep?.(120);this.game.order(p,0);this.mode='robot';this.selection=1;}
      else if(selection<3){this.mode='distance';this.distanceOrder=selection;this.distance=0;this.distanceTouched=false;m[p+11]=selection;}
      else{this.mode=selection===3?'destroy':'capture';this.selection=0;}
    } else if(this.mode==='capture'||this.mode==='destroy'){
      const order=(this.mode==='capture'?6:3)+selection;
      if(!this.game.order(p,order)){this.game.order(p,0);this.message='Order cannot be carried out. Robot will stop and defend.';}
      this.onBeep?.(120);this.mode='robot';this.selection=1;
    } else if(this.mode==='combat'){
      if(selection===5){this.mode='robot';this.selection=2;}
      else if(selection===4){this.mode='direct';this.directReturn='combat';m[p+10]=2;m[p+5]=0;}
      else if(selection===0){if(m[p+7]&64){this.game.nuclear(p);this.leave();}else this.onBeep?.(250);}
      else {const type=4-selection;if(m[p+7]&(1<<(type+2))){this.manualShot=this.game.fire(p,type,true);if(!this.manualShot)this.onBeep?.(250);}else this.onBeep?.(250);}
    }
  }
  draw(){
    if(this.exploding){this.showExplosion();return;}
    const s=this.screen,m=this.game.m,p=this.selectedRobot;
    if(this.mode==='title'){s.title();return;}
    if(this.mode==='redefine'){s.redefine(this.redefined);return;}
    if(this.mode==='construction'){s.construction(this.pieces,this.game.quote(this.pieces).left,this.column,this.selection);return;}
    s.frame();s.gameArea();
    if(this.mode==='flight'||this.mode==='end')s.stats();
    else if(this.mode==='direct'&&this.directReturn==='combat')s.menu(0xac06,p,this.selection,4);
    else if(this.mode==='robot'||this.mode==='direct')s.robotMenu(p,this.selection);
    else if(this.mode==='orders')s.menu(0xa977,p,this.selection,7);
    else if(this.mode==='capture'||this.mode==='destroy')s.menu(this.mode==='capture'?0xab54:0xaad8,p,this.selection,12);
    else if(this.mode==='combat')s.menu(0xac06,p,this.selection,4);
    else if(this.mode==='distance'){
      s.clearHud();s.script(this.distanceOrder===1?0xaa1f:0xaa32);s.script(0xaa43);s.strength(p);
      if(this.distanceTouched||this.distance)s.text(`${String(this.distance).padStart(2,' ')} MILES`,23,13,70);
    }
    if(this.mode==='end')s.script(this.game.outcome==='won'?0xaeb7:0xae7c);
  }
}
