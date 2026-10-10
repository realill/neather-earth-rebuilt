import {chromium} from '@playwright/test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1280,height:1080}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install();await page.goto(process.env.GAME_URL||'http://localhost:5183');await page.waitForFunction(()=>!!window.netherEarth);await page.clock.pauseAt(new Date(Date.now()+1000));
 const chooser=page.waitForEvent('filechooser');await page.locator('#import-save').click();
 await (await chooser).setFiles('captures/action-montage/saves/factory-crossfire.json');
 await page.waitForFunction(()=>document.querySelector('#message').textContent==='Save file imported.');
 assert.equal(await page.evaluate(()=>window.netherEarth.controller.mode),'flight');
 const before=await page.evaluate(()=>Array.from(window.netherEarth.game.m));
 const download=page.waitForEvent('download');await page.locator('#export-save').click();const file=await download;
 const saved=JSON.parse(readFileSync(await file.path(),'utf8'));assert.deepEqual(saved.memory,before);
 await page.locator('#save-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"version":1}')});
 await page.waitForFunction(()=>document.querySelector('#message').textContent.startsWith('Invalid save file'));
 assert.deepEqual(await page.evaluate(()=>Array.from(window.netherEarth.game.m)),before);
 await page.locator('#save-file').setInputFiles('captures/action-montage/saves/nuclear-finale.json');
 await page.waitForFunction(()=>window.netherEarth.controller.mode==='combat');
 await page.keyboard.down('Space');await page.clock.runFor(200);await page.keyboard.up('Space');
 assert(await page.evaluate(()=>window.netherEarth.controller.exploding));
 await page.clock.runFor(6000);assert.equal(await page.evaluate(()=>window.netherEarth.game.m[0xfd78]),128);
 await page.screenshot({path:'captures/action-montage/import-save-browser.png'});
 assert.deepEqual(errors,[]);console.log('Browser scenario checks passed: file chooser, exact exported save, invalid-file preservation, playable nuclear import.');
}finally{await browser.close();}
