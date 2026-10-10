/** Render staged saves through the production engine, with synchronized beeper audio. */
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {scenes,makeController,exportScenarios} from './montage-scenarios';
import {restore} from '../src/save';
import {A} from '../src/memory';
import {renderBeeper} from './beeper-pcm';
import type {Edge} from '../src/explosion';
const out=resolve(process.argv[2]||'captures/action-montage');mkdirSync(out,{recursive:true});exportScenarios(join(out,'saves'));
const data=JSON.parse(readFileSync('public/assets/audio.json','utf8'));
const fps=25,rate=48000,summary=[];
function command(args:string[]){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{stdio:'inherit'});if(r.status!==0)throw new Error('FFmpeg failed');}
for(const scene of scenes){
 const c=makeController();restore(c,readFileSync(join(out,'saves',scene.id+'.json'),'utf8'));
 const audio=new Float32Array(rate*scene.seconds);let time=0,shots=0,explosions=0;
 function sound(edges:Edge[],seconds:number,gain:number){
  const pcm=renderBeeper(edges,seconds*data.clock,data.clock,rate),offset=Math.round(time*rate);
  for(let i=0;i<pcm.length&&i+offset<audio.length;i++)audio[offset+i]+=pcm[i]*gain;
 }
 c.game.onSound=(state,noise)=>{const edges=state&128?data.noiseTimes.map((t:number,i:number)=>[t,noise[i]]):data.tones[state];if(edges)sound(edges,data.frame/data.clock,0.7);};
 c.onBeep=pitch=>{if(data.beeps[pitch])sound(data.beeps[pitch],data.beepDurations[pitch]/data.clock,0.4);};
 c.onExplosionAudio=e=>{explosions++;sound(e.edges,e.duration,1.2);};
 const fire=c.game.fire.bind(c.game);c.game.fire=(...args:Parameters<typeof fire>)=>{const ok=fire(...args);if(ok)shots++;return ok;};
 writeFileSync(join(out,scene.id+'-title.txt'),scene.title);
 writeFileSync(join(out,scene.id+'-subtitle.txt'),scene.subtitle);
 const filter=[
  'scale=1024:768:flags=neighbor','pad=1280:960:128:80:color=0x0c1019',
  "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf:text='NEATHER EARTH REBUILT':x=128:y=26:fontsize=29:fontcolor=0xa5f3d1",
  `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='SECTOR ${String(scene.x).padStart(3,'0')}   /   ${scene.speed}x':x=865:y=36:fontsize=17:fontcolor=0x8ea7b4`,
  `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf:textfile='${join(out,scene.id+'-title.txt')}':x=128:y=868:fontsize=28:fontcolor=white`,
  `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:textfile='${join(out,scene.id+'-subtitle.txt')}':x=128:y=907:fontsize=18:fontcolor=0xa8bccb`,
  "drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='STAGED SAVES / LIVE SIMULATION':x=801:y=916:fontsize=14:fontcolor=0x738795",
 ];
 const proc=spawn('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','rawvideo','-pixel_format','rgba','-video_size','256x192','-framerate',String(fps),'-i','pipe:0','-vf',filter.join(','),'-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p',join(out,scene.id+'-silent.mp4')],{stdio:['pipe','ignore','inherit']});
 const complete=once(proc,'close');let ticks=0;
 for(let f=0;f<fps*scene.seconds;f++){
  const target=Math.round((f+1)*50*scene.speed/fps);
  while(ticks<target){
   time=ticks/50/scene.speed;c.interrupt();ticks++;
   if(ticks%10===0)c.step(scene.nuke!==undefined?(ticks===scene.nuke*50?16:0):16);
  }
  if(!proc.stdin.write(c.screen.rgba()))await once(proc.stdin,'drain');
 }
 proc.stdin.end();const [status]=await complete;if(status!==0)throw new Error('Video encoding failed');
 const samples=Buffer.alloc(audio.length*4);for(let i=0;i<audio.length;i++)samples.writeFloatLE(Math.max(-0.98,Math.min(0.98,audio[i])),i*4);
 writeFileSync(join(out,scene.id+'.f32'),samples);
 command(['-i',join(out,scene.id+'-silent.mp4'),'-f','f32le','-ar',String(rate),'-ac','1','-i',join(out,scene.id+'.f32'),'-c:v','copy','-c:a','aac','-b:a','192k','-shortest',join(out,scene.id+'.mp4')]);
 const survivors=scene.units.map((u,i)=>{const slot=scene.units.slice(0,i).filter(v=>v.owner===u.owner).length;const p=A.robots+384*u.owner+slot*16;return c.game.m[p+1]?1:0;}).reduce((a,b)=>a+b,0);
 const result={id:scene.id,shots,explosions,destroyed:scene.units.length-survivors,seconds:scene.seconds};summary.push(result);console.log(result);
}
// Open with immediate crossfire, then move west to east before the nuclear finale.
command(['-ss','2','-i',join(out,'warbase-siege.mp4'),'-t','2','-c:v','libx264','-preset','fast','-crf','17','-c:a','aac',join(out,'hook.mp4')]);
writeFileSync(join(out,'playlist.txt'),['hook',...scenes.map(s=>s.id)].map(s=>`file '${join(out,s+'.mp4')}'`).join('\n'));
command(['-f','concat','-safe','0','-i',join(out,'playlist.txt'),'-c','copy',join(out,'battles.mp4')]);
const duration=2+scenes.reduce((n,s)=>n+s.seconds,0);
command(['-i',join(out,'battles.mp4'),'-i','public/assets/title.wav','-filter_complex',`[1:a]volume=0.20,afade=t=in:d=0.3,afade=t=out:st=${duration-2}:d=2[music];[0:a]volume=1.15[sfx];[sfx][music]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.93[a]`,'-map','0:v','-map','[a]','-vf',`drawbox=x=0:y=855:w=1280:h=105:color=0x0c1019:t=fill:enable='gte(t,${duration-2})',drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf:text='YOUR TURN.':x=128:y=868:fontsize=28:fontcolor=0xa5f3d1:enable='gte(t,${duration-2})',drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf:text='realill.github.io/neather-earth-rebuilt':x=128:y=909:fontsize=22:fontcolor=white:enable='gte(t,${duration-2})'`,'-c:v','libx264','-preset','fast','-crf','18','-c:a','aac','-b:a','192k','-t',String(duration),'-movflags','+faststart',join(out,'neather-earth-rebuilt-battle-montage.mp4')]);
writeFileSync(join(out,'report.json'),JSON.stringify({duration,fps,scenes:summary},null,2)+'\n');
console.log(`Montage complete: ${duration}s. ${join(out,'neather-earth-rebuilt-battle-montage.mp4')}`);
