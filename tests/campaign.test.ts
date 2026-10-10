import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Game} from '../src/game';
import {Controller} from '../src/controller';
import {A,memoryFromAssets,read16} from '../src/memory';

test('recorded normal-game campaign wins using only controls and earned resources',()=>{
  const recording=JSON.parse(readFileSync('tests/fixtures/victory.json','utf8'));
  const binary=JSON.parse(readFileSync('public/assets/game-data.json','utf8'));
  assert.equal(createHash('sha256').update(readFileSync('public/assets/game-data.json')).digest('hex'),recording.assetSha256);
  const game=new Game(memoryFromAssets(binary)),c=new Controller(game);
  c.configureExplosion(JSON.parse(readFileSync('public/assets/audio.json','utf8')));c.start();
  let ticks=0;
  for(const [input,count]of recording.runs)for(let n=0;n<count;n++){
    assert.equal(game.outcome,'playing',`premature ending at ${ticks}`);
    while(c.exploding)for(let i=0;i<10;i++)c.interrupt();
    for(let i=0;i<10;i++)c.interrupt();c.step(input);ticks++;
  }
  assert.equal(ticks,recording.inputs);assert.equal(game.outcome,'won');assert.equal(c.mode,'end');
  assert.equal(read16(game.m,0xfd37),recording.expected.day);
  assert.deepEqual([game.m[A.counts[0]],game.m[A.counts[1]]],recording.expected.bases);
  assert.deepEqual(Array.from(game.m.slice(A.resources[0],A.resources[0]+7)),recording.expected.resources);
  assert.equal(game.m[0xfd41],recording.expected.robots);
});
