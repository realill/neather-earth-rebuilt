import {AudioSystem} from './audio';
import {memoryFromAssets} from './memory';
import {Game} from './game';
import {Controller} from './controller';
import {Input,actions,spectrumKey} from './input';
import {snapshot,restore} from './save';
const canvas=document.querySelector<HTMLCanvasElement>('#screen')!;
const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false;
const response=await fetch(`${import.meta.env.BASE_URL}assets/game-data.json`);
if(!response.ok)throw new Error('Could not load game assets');
const game=new Game(memoryFromAssets(await response.json()));
const controller=new Controller(game),input=new Input(game.m),audio=new AudioSystem();
await audio.ready;controller.configureExplosion(audio.data!);
controller.onExplosionAudio=effect=>audio.explosion(effect);
const keys=new Set<string>();
let pendingInput=0,last=performance.now(),accumulator=0,simulationTicks=0;
game.onSound=(state,noise)=>audio.frame(state,noise);
controller.onEnd=()=>audio.beep(250);
controller.onBeep=(...pitches)=>{for(const pitch of pitches)audio.beep(pitch);};
function paint(){
  ctx.putImageData(new ImageData(controller.screen.rgba(),256,192),0,0);
  document.querySelector('#mode')!.textContent=controller.paused?'PAUSED':controller.mode.toUpperCase();
  document.querySelector('#pause')!.textContent=controller.paused?'Resume':'Pause';
  if(controller.message)document.querySelector('#message')!.textContent=controller.message;
}
function clearInput(){keys.clear();pendingInput=0;controller.lastInput=0;}
function start(){audio.stopExplosion();void audio.pause(false);audio.stopMusic();clearInput();controller.start();controller.message='Land on the H at Kerberus to construct a robot.';canvas.focus();paint();}
function title(){audio.stopExplosion();void audio.pause(false);clearInput();controller.title();void audio.playMusic();paint();}
function pause(){
  if(['title','redefine','end'].includes(controller.mode))return;
  controller.paused=!controller.paused;void audio.pause(controller.paused);clearInput();paint();
}
function save(){
  if(controller.exploding){controller.message='Wait for the explosion to finish before saving.';paint();return;}
  try{localStorage.setItem('nether-earth-save',snapshot(controller));controller.message='Game saved in this browser.';}
  catch{controller.message=['title','redefine','construction'].includes(controller.mode)?'Start a game and finish construction before saving.':'Browser storage is unavailable. Game could not be saved.';}
  paint();
}
function load(){
  try{
    const raw=localStorage.getItem('nether-earth-save');
    if(!raw){controller.message='No saved game in this browser.';paint();return;}
    restore(controller,raw);audio.stopExplosion();void audio.pause(false);clearInput();audio.stopMusic();controller.message='Saved game restored.';canvas.focus();
  }catch{controller.message='Saved game could not be read. Current game has been kept.';}
  paint();
}
document.querySelector('#start')!.addEventListener('click',start);
document.querySelector('#pause')!.addEventListener('click',pause);
document.querySelector('#save')!.addEventListener('click',save);
document.querySelector('#load')!.addEventListener('click',load);
const saveFile=document.querySelector<HTMLInputElement>('#save-file')!;
document.querySelector('#export-save')!.addEventListener('click',()=>{
  try{
    const url=URL.createObjectURL(new Blob([snapshot(controller)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='neather-earth-save.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);controller.message='Save file exported.';
  }catch{controller.message='Start a game and finish construction or the explosion before exporting.';}
  paint();
});
document.querySelector('#import-save')!.addEventListener('click',()=>saveFile.click());
saveFile.addEventListener('change',async()=>{
  const file=saveFile.files?.[0];if(!file)return;
  try{
    if(file.size>1024*1024)throw new Error('Save too large');
    const raw=await file.text();restore(controller,raw);
    audio.stopExplosion();void audio.pause(false);clearInput();audio.stopMusic();
    controller.message='Save file imported.';canvas.focus();
  }catch{controller.message='Invalid save file. Current game has been kept.';}
  saveFile.value='';paint();
});
function activateAudio(title:boolean){
  if(!audio.enabled||controller.paused)return;
  void audio.unlock(title).catch(error=>{
    if(error?.name==='AbortError')return; // Starting a game intentionally stops title music.
    controller.message='Audio could not start. Use the Sound button to retry.';paint();
  });
}
document.addEventListener('pointerdown',event=>{
  if((event.target as Element).closest('#sound'))return;
  activateAudio(controller.mode==='title'&&!(event.target as Element).closest('#start, #load'));
});
document.querySelector('#sound')!.addEventListener('click',async()=>{
  try{const enabled=await audio.toggle(controller.mode==='title');document.querySelector('#sound')!.textContent=enabled?'Sound on':'Sound off';}
  catch{controller.message='Audio could not start. Try the Sound button again.';paint();}
});
document.querySelector('#fullscreen')!.addEventListener('click',()=>{void canvas.requestFullscreen().catch(()=>{controller.message='Full screen is unavailable in this browser.';paint();});});
window.addEventListener('keydown',event=>{
  activateAudio(controller.mode==='title'&&!['Digit0','Digit5'].includes(event.code));
  if(controller.mode==='redefine'){
    event.preventDefault();if(event.repeat)return;
    const index=controller.redefined.length;
    if(input.define(actions[index],event.code,actions.slice(0,index))){
      controller.redefined.push(spectrumKey(event.code)!.label);audio.beep(20);
      if(controller.redefined.length===8){controller.title();controller.message='Keys redefined. Press 0 to start.';}
      else controller.draw();
    }else controller.message='Choose an unused Spectrum key: a letter, number, Shift, Enter, or Space.';
    paint();return;
  }
  if(controller.mode==='title'){
    if(event.repeat)return;
    if(event.code==='Digit0')start();
    else if(['Digit1','Digit2','Digit3'].includes(event.code)){
      game.m[0xd3e4]=Number(event.code.at(-1));controller.draw();
      controller.message=game.m[0xd3e4]===1?'Keyboard selected. Q A O P and Symbol Shift; arrows and Space also work.':'Joystick selected. Use a connected gamepad; keyboard controls also work.';
      paint();
    }else if(event.code==='Digit4'){
      clearInput();controller.mode='redefine';controller.redefined=[];controller.message='Press a different key for each action.';controller.draw();paint();
    }else if(event.code==='Digit5')load();
    return;
  }
  if(controller.mode==='end'){if(!event.repeat&&!controller.endFrames&&(input.key(event.code)||event.code==='Digit0'))title();return;}
  const value=input.key(event.code);
  if(value){event.preventDefault();keys.add(event.code);pendingInput|=value&31;}
  if(event.repeat)return;
  if(value&128||event.code==='Escape')pause();
  else if(value&64)title();
  else if(value&32)save();
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',clearInput);
function frame(now:number){
  accumulator+=Math.min(250,now-last);last=now;
  while(accumulator>=20){
    const exploding=controller.exploding;controller.interrupt();simulationTicks=exploding?0:simulationTicks+1;
    if(simulationTicks===10){
      let state=pendingInput|input.gamepad(navigator.getGamepads?.()??[]);pendingInput=0;
      for(const key of keys)state|=input.key(key)&31;
      controller.step(state);simulationTicks=0;
    }
    accumulator-=20;
  }
  paint();requestAnimationFrame(frame);
}
// Readable state for differential tests and browser diagnostics.
Object.assign(window,{netherEarth:{game,controller,audio}});
paint();requestAnimationFrame(frame);
