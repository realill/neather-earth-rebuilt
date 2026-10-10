import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const recording=JSON.parse(readFileSync('tests/fixtures/victory.json','utf8'));
const inputs=recording.runs.flatMap(([input,count])=>Array(count).fill(input));
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
  const page=await browser.newPage({viewport:{width:1100,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install();await page.goto(process.env.GAME_URL||'http://localhost:5174');await page.waitForFunction(()=>!!window.netherEarth);
  await page.clock.pauseAt(new Date(Date.now()+1000));
  await page.locator('#sound').click();await page.locator('#start').click();
  // Replay into the production controller. All game state changes come from
  // the same input and interrupt entry points used by the browser's frame loop.
  for(let start=0;start<inputs.length;start+=500)await page.evaluate(batch=>{
    const c=window.netherEarth.controller;
    for(const input of batch){while(c.exploding)for(let i=0;i<10;i++)c.interrupt();for(let i=0;i<10;i++)c.interrupt();c.step(input);}
  },inputs.slice(start,start+500));
  assert.equal(await page.evaluate(()=>window.netherEarth.game.outcome),'won');
  await page.clock.runFor(20);await page.screenshot({path:'/tmp/nether-victory.png'});
  await page.keyboard.press('0');assert.equal(await page.evaluate(()=>window.netherEarth.controller.mode),'end','early key cannot dismiss victory');
  await page.clock.runFor(2100);await page.keyboard.press('0');
  assert.equal(await page.evaluate(()=>window.netherEarth.controller.mode),'title');
  await page.keyboard.press('0');assert.equal(await page.evaluate(()=>window.netherEarth.controller.mode),'flight');
  assert.deepEqual(errors,[]);console.log(`Production victory replay passed: ${inputs.length} inputs, normal start to victory, ending delay, return to title and restart.`);
}finally{await browser.close();}
