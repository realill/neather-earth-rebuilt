import {A} from './memory';
import {Controller, type Mode} from './controller';
const modes:Mode[]=['flight','robot','direct','orders','capture','destroy','distance','combat','end'];
/** Validate the complete record before touching live memory. */
export function restore(controller:Controller,raw:string){
  const d=JSON.parse(raw),integer=(v:unknown,min:number,max:number)=>Number.isInteger(v)&&Number(v)>=min&&Number(v)<=max;
  if(!d||d.version!==1||!Array.isArray(d.memory)||d.memory.length!==65536||!d.memory.every((v:unknown)=>integer(v,0,255))||!modes.includes(d.mode)||!integer(d.selection,0,5)||!['robot','combat'].includes(d.directReturn)||!integer(d.distance,0,50)||d.distance%5||![1,2].includes(d.distanceOrder)||!['playing','won','lost'].includes(d.outcome))throw new Error('Invalid save');
  if(d.distanceTouched!==undefined&&typeof d.distanceTouched!=='boolean')throw new Error('Invalid distance state');
  if(d.mode==='end'?d.outcome==='playing':d.outcome!=='playing')throw new Error('Invalid outcome');
  if(!integer(d.robot,0,65535)||(d.robot!==0&&(d.robot<A.robots||d.robot>=A.robots+384||(d.robot-A.robots)%16||!d.memory[d.robot+1])))throw new Error('Invalid robot');
  if(!['flight','end'].includes(d.mode)&&!d.robot)throw new Error('Missing controlled robot');
  const maxSelection=({robot:3,orders:4,capture:2,destroy:2,combat:5} as Record<string,number>)[d.mode];
  if(maxSelection!==undefined&&d.selection>maxSelection)throw new Error('Invalid selection');
  controller.resetEffects();controller.game.m.set(d.memory);controller.mode=d.mode;controller.selectedRobot=d.robot;controller.selection=d.selection;controller.directReturn=d.directReturn;controller.distance=d.distance;controller.distanceTouched=d.distanceTouched??d.distance!==0;controller.distanceOrder=d.distanceOrder;controller.game.outcome=d.outcome;controller.paused=false;controller.endFrames=d.mode==='end'?100:0;controller.lastInput=0;controller.draw();
}
export function snapshot(c:Controller){
  if(c.exploding)throw new Error('Wait for the explosion to finish');
  if(c.mode==='title'||c.mode==='redefine'||c.mode==='construction')throw new Error('Finish construction before saving');
  return JSON.stringify({version:1,memory:Array.from(c.game.m),mode:c.mode,robot:c.selectedRobot,selection:c.selection,directReturn:c.directReturn,distance:c.distance,distanceTouched:c.distanceTouched,distanceOrder:c.distanceOrder,outcome:c.game.outcome});
}
