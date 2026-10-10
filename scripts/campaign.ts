/** Acceptance player: only Controller.step inputs change the game; never grants
 * resources, teleports units, changes ownership, or disables enemy production. */
import {readFileSync,writeFileSync} from 'node:fs';
import {Game} from '../src/game';
import {Controller} from '../src/controller';
import {A,memoryFromAssets,read16} from '../src/memory';
const game=new Game(memoryFromAssets(JSON.parse(readFileSync('public/assets/game-data.json','utf8'))));
const c=new Controller(game);c.configureExplosion(JSON.parse(readFileSync('public/assets/audio.json','utf8')));c.start();
const inputs:number[]=[],events:unknown[]=[];let deployed=0;
const strategy=process.argv[2]??'assault';
// The initial construction sequence buys bipods, then replaces them with antigravity.
// This also exercises the original refund path; deployed designs remain legal.
const selectedPieces=Number(process.argv[3]??189);
function status(){return {ticks:inputs.length,day:read16(game.m,0xfd37),outcome:game.outcome,bases:[game.m[A.counts[0]],game.m[A.counts[1]]],resources:Array.from(game.m.slice(A.resources[0],A.resources[0]+7)),robots:game.m[0xfd41]};}
function tick(input=0){
  if(inputs.length>=100000)throw new Error('Campaign time limit');
  if(game.outcome!=='playing')throw new Error('Terminal outcome');
  while(c.exploding)for(let i=0;i<10;i++)c.interrupt();
  for(let irq=0;irq<10;irq++)c.interrupt();c.step(input);inputs.push(input);
}
function press(input:number){tick(input);tick(0);}
function expect(mode:string){if(c.mode!==mode)throw new Error(`Expected ${mode}, got ${c.mode}`);}
function fly(x:number,y:number,land=true){
  expect('flight');
  for(let i=0;game.m[A.altitude]<48&&i<60;i++)tick(16);
  for(let i=0;read16(game.m,A.playerX)!==x&&i<600;i++)tick(16|(read16(game.m,A.playerX)<x?1:2));
  for(let i=0;game.m[A.playerY]!==y&&i<30;i++)tick(16|(game.m[A.playerY]<y?4:8));
  if(read16(game.m,A.playerX)!==x||game.m[A.playerY]!==y)throw new Error('Flight failed');
  if(land)for(let i=0;c.mode==='flight'&&i<65;i++)tick(0);
}
function choose(index:number){while(c.selection!==index)press(c.selection<index?4:8);press(16);}
try{
  while(game.outcome==='playing'){
    const assault=strategy==='assault'&&deployed>=Number(process.env.ASSAULT_AFTER??42);
    const pieces=assault?244:selectedPieces;
    while(!game.quote(pieces).affordable)tick(16);
    const bases=[0,1,2,3].filter(i=>game.m[A.buildings+i*5+3]===64&&game.baseClear(i));
    if(!bases.length||game.m[0xfd41]>=24){
      const robots=Array.from({length:24},(_,i)=>A.robots+i*16).filter(r=>game.m[r+1]&&game.m[r+12]>0&&game.m[r+12]<128);
      const bomb=robots.filter(r=>(game.m[r+7]&64)&&read16(game.m,r+2)>300).sort((a,b)=>read16(game.m,b+2)-read16(game.m,a+2))[0];
      const target=bomb??robots.filter(r=>game.m[r+11]===0).sort((a,b)=>read16(game.m,b+2)-read16(game.m,a+2))[0];
      if(!target){tick(16);continue;}
      fly(read16(game.m,target+2),game.m[target+4]);
      if(c.mode!=='robot'){continue;}tick();
      if(bomb&&c.selectedRobot===bomb){choose(2);expect('combat');choose(0);expect('flight');}
      else{choose(1);expect('orders');choose(3);expect('destroy');choose(0);expect('robot');choose(3);expect('flight');}
      continue;
    }
    const base=bases.at(-1)!,bp=A.buildings+base*5;
    fly(read16(game.m,bp),game.m[bp+2]-4);expect('construction');
    const before=new Set(Array.from({length:24},(_,i)=>A.robots+i*16).filter(p=>game.m[p+1]));
    for(let piece=0;piece<8;piece++)if(pieces&(1<<piece)){
      while(c.selection!==piece)press(c.selection<piece?8:4);press(16);
    }
    press(2);press(16);expect('flight');
    const p=Array.from({length:24},(_,i)=>A.robots+i*16).find(p=>game.m[p+1]&&!before.has(p));
    if(p===undefined)throw new Error('No launched robot');
    for(let i=0;i<60;i++)tick(16);
    fly(read16(game.m,p+2),game.m[p+4]);expect('robot');tick();
    if(c.selectedRobot!==p)throw new Error('Landed on different robot');
    choose(1);expect('orders');
    let order=assault?5:strategy==='bases'?8:strategy==='factories'?6:deployed%3===2?8:6;
    if(game.nearest(p,order)===255)order=order===6?7:6;
    if(game.nearest(p,order)===255)order=8;
    choose(order<6?3:4);expect(order<6?'destroy':'capture');choose(order<6?order-3:order-6);expect('robot');choose(3);expect('flight');
    deployed++;const event={...status(),deployed,base,pieces,order};events.push(event);if(!process.env.CAMPAIGN_QUIET)console.log(JSON.stringify(event));
  }
}catch(error){if(game.outcome==='playing')console.error(JSON.stringify({...status(),stop:String(error)}));}
console.log(JSON.stringify({...status(),deployed,strategy,pieces:selectedPieces}));
process.exitCode=game.outcome==='won'?0:2;
writeFileSync(`/tmp/nether-campaign-memory-${strategy}-${selectedPieces}.bin`,game.m);
writeFileSync(`/tmp/nether-campaign-${strategy}-${selectedPieces}.json`,JSON.stringify({strategy,inputs,events,result:status()}));
