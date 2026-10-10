import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.GAME_URL||'http://localhost:5174');await page.waitForFunction(()=>!!window.netherEarth);
  assert.equal(await page.locator('#sound').textContent(),'Sound on');
  await page.locator('#screen').click();
  await page.waitForFunction(()=>{const a=window.netherEarth.audio;return a.context?.state==='running'&&!a.music.paused&&a.music.currentTime>0;});
  const music=await page.evaluate(async()=>{
    const a=window.netherEarth.audio,analyser=a.context.createAnalyser();analyser.fftSize=2048;
    const source=a.context.createMediaElementSource(a.music);source.connect(analyser);analyser.connect(a.context.destination);
    const samples=new Float32Array(analyser.fftSize);let peak=0;
    for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,25));analyser.getFloatTimeDomainData(samples);for(const s of samples)peak=Math.max(peak,Math.abs(s));}
    return peak;
  });
  assert(music>0.01,`title audio signal: ${music}`);
  await page.locator('#sound').click();
  await page.waitForFunction(()=>window.netherEarth.audio.context.state==='suspended');
  assert.equal(await page.locator('#sound').textContent(),'Sound off');
  await page.keyboard.press('0');assert.equal(await page.evaluate(()=>window.netherEarth.audio.enabled),false,'starting respects mute');
  await page.locator('#sound').click();await page.waitForFunction(()=>window.netherEarth.audio.context.state==='running');
  const effects=await page.evaluate(async()=>{
    const {audio:a,controller:c}=window.netherEarth,analyser=a.context.createAnalyser();analyser.fftSize=2048;a.output.connect(analyser);
    const samples=new Float32Array(analyser.fftSize);let peak=0;c.onBeep(100,120,200);
    for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,10));analyser.getFloatTimeDomainData(samples);for(const s of samples)peak=Math.max(peak,Math.abs(s));}
    a.output.disconnect(analyser);return peak;
  });
  assert(effects>0.01,`game audio signal: ${effects}`);
  await page.locator('#pause').click();await page.waitForFunction(()=>window.netherEarth.audio.context.state==='suspended');
  await page.locator('#pause').click();await page.waitForFunction(()=>window.netherEarth.audio.context.state==='running');
  await page.reload();await page.waitForFunction(()=>!!window.netherEarth);await page.keyboard.press('0');
  await page.waitForFunction(()=>window.netherEarth.audio.context?.state==='running');
  assert.equal(await page.evaluate(()=>window.netherEarth.audio.music.paused),true);
  assert.deepEqual(errors,[]);console.log(`Audio passed with normal autoplay policy: title peak ${music.toFixed(3)}, effects peak ${effects.toFixed(3)}, mute, resume, keyboard start.`);
}finally{await browser.close();}
