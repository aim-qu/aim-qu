import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {solve} from '../site/games.mjs';
const root=process.cwd(),out=path.join(root,'output','playground');fs.mkdirSync(out,{recursive:true});
const port=JSON.parse(fs.readFileSync('output/site-server.json','utf8')).port;
const browser=await chromium.launch({channel:'chrome'});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}`,{waitUntil:'networkidle'});
  await page.waitForSelector('#rainCanvas[data-ready=true]');
  const ids=['rain','terminal','lights','rhythm','observatory','ink','memory','synth','news'];
  const navigate=async id=>{const parent=['lights','memory'].includes(id)?'arcade':id;await page.locator(`.scene-dock [data-goto="${parent}"]`).click();await page.waitForFunction(id=>document.body.dataset.scene===id,parent);await page.waitForTimeout(900);if(parent==='arcade'){await page.locator(`[data-arcade="${id}"]`).click();await page.waitForTimeout(650);}};
  assert.equal(await page.locator('.scene:not([hidden])').count(),8);
  const positions=await page.locator('.scene').evaluateAll(nodes=>nodes.map(n=>n.offsetTop));
  assert(positions.every((top,i)=>i===0||top>positions[i-1]),'Sections must follow each other vertically');
  await page.mouse.wheel(0,900);await page.waitForFunction(()=>document.body.dataset.scene==='terminal');
  await navigate('rain');
  const clip={x:900,y:250,width:250,height:200};
  const frameA=await page.screenshot({clip});await page.waitForTimeout(600);const frameB=await page.screenshot({clip});assert(!frameA.equals(frameB),'Rain does not move');
  await page.locator('#rainPause').click();await page.waitForTimeout(250);const stillA=await page.screenshot({clip});await page.waitForTimeout(500);const stillB=await page.screenshot({clip});assert(stillA.equals(stillB),'Paused rain still moves');
  await page.locator('#rainPause').click();
  for(const id of ids){await navigate(id);await page.screenshot({path:path.join(out,id+'.png')});}
  await navigate('terminal');await page.locator('#command').fill('palette');await page.locator('#command').press('Enter');assert.match(await page.locator('#terminalOutput').innerText(),/CYAN/);await page.locator('#command').fill('<script>alert(1)</script>');await page.locator('#command').press('Enter');assert.equal(await page.locator('#terminalOutput script').count(),0);
  await navigate('lights');const board=await page.locator('.light-cell').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-pressed')==='true'?1:0));for(const i of solve(board))await page.locator(`.light-cell[data-index="${i}"]`).click();assert.match(await page.locator('#lightStatus').innerText(),/CLEAR/);await page.locator('#newLights').click();await page.locator('#hintLights').click();assert.equal(await page.locator('.light-cell.hint').count(),1);
  await navigate('memory');const values=await page.locator('.memory-card .symbol').allTextContents();const pairs=new Map();values.forEach((value,i)=>pairs.set(value,[...(pairs.get(value)||[]),i]));for(const pair of pairs.values())for(const i of pair)await page.locator('.memory-card').nth(i).click();assert.match(await page.locator('#memoryStatus').innerText(),/CLEAR/);
  await page.locator('[data-arcade="lights"]').click();assert.equal(await page.locator('#memory').getAttribute('inert'),'');await page.locator('[data-arcade="memory"]').click();assert.match(await page.locator('#memoryStatus').innerText(),/CLEAR/);
  await navigate('rhythm');await page.locator('#startRhythm').click();await page.waitForTimeout(1400);for(let i=0;i<14;i++){for(const key of ['d','f','j','k'])await page.keyboard.press(key);await page.waitForTimeout(75);}assert(Number(await page.locator('#rhythmScore').innerText())>0);
  await navigate('ink');await page.mouse.move(450,360);await page.mouse.down();await page.mouse.move(800,520,{steps:20});await page.mouse.up();const downloadPromise=page.waitForEvent('download');await page.locator('#saveInk').click();const download=await downloadPromise;await download.saveAs(path.join(out,'drawing.svg'));assert.match(fs.readFileSync(path.join(out,'drawing.svg'),'utf8'),/<polyline/);
  await navigate('synth');await page.keyboard.down('a');await page.waitForTimeout(250);assert.equal(await page.locator('.synth-pad.pressed').count(),1);assert.equal(await page.locator('#synthNote').innerText(),'C4');await page.keyboard.up('a');assert.equal(await page.locator('.synth-pad.pressed').count(),0);
  await navigate('news');await page.waitForSelector('.news-item');assert((await page.locator('.news-item').count())>0);await page.locator('[data-news-source="OpenAI"]').click();assert((await page.locator('.news-meta').allTextContents()).every(t=>t.includes('OpenAI')));
  const mobile=[];await page.setViewportSize({width:390,height:844});for(const id of ids){await navigate(id);const dimensions=await page.locator('#'+id).evaluate(e=>({id:e.id,width:e.clientWidth,scrollWidth:e.scrollWidth}));assert(dimensions.scrollWidth<=dimensions.width+1,JSON.stringify(dimensions));mobile.push(dimensions);await page.screenshot({path:path.join(out,'mobile-'+id+'.png')});}
  assert.deepEqual(errors,[]);
  const result={passed:true,scenes:ids,mobile,checks:['rain animation changes pixels','rain pause freezes pixels','nine scenes render','safe terminal commands','lights solved by actual clicks','lights hint','memory pairs complete','rhythm scores real hits','drawing exports SVG','synth keyboard responds','news filter','mobile no scene overflow'],errors};fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
