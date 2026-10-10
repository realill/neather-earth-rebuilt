import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderBeeper} from '../scripts/beeper-pcm';
const clock=3500000;
function tone(hz:number){const edges:[number,number][]=[];for(let i=0;i<0.25*hz*2;i++)edges.push([i*clock/(hz*2),(i+1)%2]);return renderBeeper(edges,clock*0.25,clock);}
function rms(samples:Float32Array){let sum=0;const skip=2400;for(let i=skip;i<samples.length;i++)sum+=samples[i]**2;return Math.sqrt(sum/(samples.length-skip));}
test('beeper resampling preserves an audible tone and rejects ultrasonic aliasing',()=>{
  const audible=tone(1000),ultrasonic=tone(30000);
  assert(rms(audible)>0.4);assert(rms(ultrasonic)<0.002,'30 kHz carrier must not alias to 18 kHz');
  let crossings=0;for(let i=2401;i<audible.length;i++)if(audible[i-1]<=0&&audible[i]>0)crossings++;
  assert(Math.abs(crossings-200)<=1,'1 kHz pitch preserved over 0.2 seconds');
});
test('title WAV is filtered PCM with headroom, no DC offset and quiet loop boundaries',()=>{
  const wav=readFileSync('public/assets/title.wav');assert.equal(wav.readUInt32LE(24),48000);assert.equal(wav.readUInt16LE(34),16);
  const count=(wav.length-44)/2;let sum=0,peak=0,energy=0;
  for(let i=0;i<count;i++){const v=wav.readInt16LE(44+i*2)/32768;sum+=v;peak=Math.max(peak,Math.abs(v));energy+=v*v;}
  assert(Math.abs(sum/count)<0.0001);assert(peak>0.5&&peak<0.71);assert(Math.sqrt(energy/count)>0.05);
  assert.equal(wav.readInt16LE(44),0);assert.equal(wav.readInt16LE(wav.length-2),0);
  assert(Math.abs(count/48000-102.23616)<0.001);
});
