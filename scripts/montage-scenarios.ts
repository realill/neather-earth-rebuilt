/** Reproducible scenario saves for filming; all subsequent combat uses Game/Controller. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {Game} from '../src/game';
import {Controller} from '../src/controller';
import {A,mapPtr,read16,write16,memoryFromAssets} from '../src/memory';
import {snapshot,restore} from '../src/save';
export type Unit={owner:0|1;x:number;y:number;pieces:number;hp?:number};
export type Scene={id:string;title:string;subtitle:string;x:number;seconds:number;speed:number;units:Unit[];nuke?:number};
const unit=(owner:0|1,x:number,y:number,pieces:number,hp=100):Unit=>({owner,x,y,pieces,hp});
export const scenes:Scene[]=[
 {id:'factory-crossfire',title:'FACTORY CROSSFIRE',subtitle:'Two fronts. No retreat.',x:58,seconds:8,speed:1.5,units:[unit(0,52,6,138),unit(1,60,6,146),unit(0,52,13,164),unit(1,60,13,138)]},
 {id:'ridge-ambush',title:'RIDGE AMBUSH',subtitle:'Hovercraft take the high ground.',x:180,seconds:8,speed:1.5,units:[unit(0,174,9,164),unit(1,182,9,156),unit(0,174,13,148),unit(1,182,13,164)]},
 {id:'warbase-siege',title:'WARBASE SIEGE',subtitle:'Heavy robots at the gates.',x:369,seconds:8,speed:1.5,units:[unit(0,362,10,186),unit(1,370,10,186),unit(0,362,14,146),unit(1,370,14,170)]},
 {id:'eastern-front',title:'EASTERN FRONT',subtitle:'Missiles across the industrial belt.',x:442,seconds:8,speed:1.5,units:[unit(0,436,8,146),unit(1,444,8,138),unit(0,436,12,164),unit(1,444,12,146)]},
 {id:'nuclear-finale',title:'THE NUCLEAR OPTION',subtitle:'One robot. One warbase.',x:261,seconds:10,speed:1,nuke:2,units:[unit(0,261,8,196),unit(1,265,11,138),unit(1,257,11,146)]},
];
export function makeController(){
 const game=new Game(memoryFromAssets(JSON.parse(readFileSync('public/assets/game-data.json','utf8'))));
 const c=new Controller(game);c.configureExplosion(JSON.parse(readFileSync('public/assets/audio.json','utf8')));c.start();return c;
}
export function scenarioSave(scene:Scene){
 const c=makeController(),g=c.game,m=g.m;
 m[mapPtr(read16(m,A.playerX),m[A.playerY])]&=~128;
 // Center the real viewport and radar on this sector. Keep the ship above the fight.
 const camera=Math.max(0,Math.min(480,scene.x-17));write16(m,0xfd0a,camera);write16(m,0xfd06,A.map+camera);
 write16(m,A.playerX,scene.x);m[A.playerY]=15;m[A.altitude]=48;m[0xfd30]=0;m[mapPtr(scene.x,15)]|=128;
 const radar=Math.max(0,Math.min(48,Math.floor((scene.x-64)/64)*8));m[0xfd1b]=radar;write16(m,0xfd1c,radar*8);
 // Initial resources are part of the authored save; avoid unrelated offscreen production.
 m.fill(0,A.resources[1],A.resources[1]+7);write16(m,0xfd37,12);
 const slots=[0,0];
 for(const u of scene.units){
  if(!g.legal(u.pieces))throw new Error(`Illegal robot in ${scene.id}`);
  const p=A.robots+u.owner*384+slots[u.owner]++*16;
  m[p+7]=u.pieces;m[p+8]=u.owner?2:1;m[p+10]=u.owner*128;m[p+9]=g.height(u.pieces);
  m[p+12]=u.hp??100;m[p+13]=g.altitude(u.x,u.y);m[p+15]=1;m[p+6]=0;m[p+14]=255;
  g.setRobotPosition(p,u.x,u.y);
 }
 g.countRobots();for(let p=A.robots;p<A.robots+768;p+=16)if(m[p+1])g.order(p,3);
 if(scene.nuke!==undefined){
  c.selectedRobot=A.robots;c.mode='combat';c.selection=0;m[A.robots+10]=1;
  m[mapPtr(scene.x,15)]&=~128;write16(m,A.playerX,scene.x);m[A.playerY]=8;m[A.altitude]=m[A.robots+9];m[mapPtr(scene.x,8)]|=128;
 }
 m[0xfd52]=1;g.updateRadar();c.draw();return snapshot(c);
}
export function loadScene(scene:Scene){const c=makeController();restore(c,scenarioSave(scene));return c;}
export function exportScenarios(directory='captures/action-montage/saves'){
 mkdirSync(directory,{recursive:true});for(const scene of scenes)writeFileSync(`${directory}/${scene.id}.json`,scenarioSave(scene));
 writeFileSync(`${directory}/scenes.json`,JSON.stringify(scenes,null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){exportScenarios(process.argv[2]);console.log('Exported five staged scenario saves.');}
