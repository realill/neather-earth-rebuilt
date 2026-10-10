import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scenes,loadScene,scenarioSave,makeController} from '../scripts/montage-scenarios';
import {A} from '../src/memory';
import {restore,snapshot} from '../src/save';

test('staged saves round-trip and autonomous battles cause real casualties',()=>{
 for(const scene of scenes.filter(s=>s.nuke===undefined)){
  const c=loadScene(scene),saved=snapshot(c),copy=makeController();restore(copy,saved);
  assert.equal(snapshot(copy),saved);
  let shots=0;const fire=c.game.fire.bind(c.game);
  c.game.fire=(...args:Parameters<typeof fire>)=>{const ok=fire(...args);if(ok)shots++;return ok;};
  for(let i=0;i<60;i++){
   for(let j=0;j<10;j++){c.interrupt();copy.interrupt();}c.step(16);copy.step(16);
  }
  assert(shots>=4,scene.id+' has exchanges of fire');
  assert(c.game.m[A.counts[0]+7]+c.game.m[A.counts[1]+7]<scene.units.length,scene.id+' has casualties');
  assert.deepEqual(c.game.m,copy.game.m,'restored encounter stays deterministic');
 }
});
test('nuclear scenario destroys the nearby warbase through the combat control',()=>{
 const c=loadScene(scenes.find(s=>s.nuke!==undefined)!);let explosions=0;c.onExplosionAudio=()=>explosions++;
 assert.equal(c.game.m[A.buildings+5+3],32);c.step(16);
 assert.equal(explosions,1);assert(c.exploding);assert.equal(c.game.m[A.buildings+5+3],128);
 for(let i=0;i<300;i++)c.interrupt();assert(!c.exploding);assert.equal(c.mode,'flight');
});
test('invalid imported scenario leaves the current save untouched',()=>{
 const c=loadScene(scenes[0]),before=snapshot(c),bad=JSON.parse(scenarioSave(scenes[1]));bad.memory[12]=256;
 assert.throws(()=>restore(c,JSON.stringify(bad)),/Invalid save/);assert.equal(snapshot(c),before);
});
