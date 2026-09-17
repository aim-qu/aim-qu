import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd(),out=path.join(root,'output','rain-qa');fs.mkdirSync(out,{recursive:true});
const {port}=JSON.parse(fs.readFileSync('output/site-server.json','utf8'));
const browser=await chromium.launch({channel:'chrome'});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/?capture=1#rain`,{waitUntil:'networkidle'});await page.waitForSelector('#rainCanvas[data-ready=true]');
  assert.equal(await page.locator('#rainCanvas').getAttribute('data-model'),'persistent-droplets');
  await page.addStyleTag({content:'.topbar,.scene-dock,.rain-composition,.scene-caption{visibility:hidden!important}.scene{animation:none!important}'});
  const states=[];
  for(const time of [0,.5,1,2,4,6,9]){
    states.push(await page.evaluate(time=>document.querySelector('#rainCanvas').renderRainFrame(time),time));
    await page.screenshot({path:path.join(out,`at-${time}.png`)});
  }
  assert(states.at(-1).merges>0);assert(states.at(-1).pauses>0);assert(states.at(-1).pinned>states.at(-1).drops.length*.5);
  const tracks=new Map();for(const state of states)for(const drop of state.drops){if(!tracks.has(drop.id))tracks.set(drop.id,[]);tracks.get(drop.id).push(drop);}
  assert([...tracks.values()].some(track=>Math.max(...track.map(d=>d.x))-Math.min(...track.map(d=>d.x))>1));
  assert(!fs.readFileSync(path.join(out,'at-0.png')).equals(fs.readFileSync(path.join(out,'at-4.png'))));
  await page.goto(`http://127.0.0.1:${port}/#rain`,{waitUntil:'networkidle'});await page.waitForSelector('#rainCanvas[data-ready=true]');
  await page.waitForTimeout(2300);const metrics=await page.locator('#rainCanvas').evaluate(c=>({...c.dataset}));
  await page.screenshot({path:path.join(out,'rain-live.png')});
  await page.locator('#rainPause').click();await page.waitForTimeout(150);const first=await page.screenshot({clip:{x:850,y:290,width:300,height:210}});await page.waitForTimeout(450);const second=await page.screenshot({clip:{x:850,y:290,width:300,height:210}});assert(first.equals(second));
  const pausedClock=await page.locator('#rainCanvas').evaluate(c=>c.rainSimulationTime);
  await page.locator('#calm').click();await page.locator('#calm').click();
  await page.waitForTimeout(300);assert.equal(await page.locator('#rainCanvas').evaluate(c=>c.rainSimulationTime),pausedClock,'Global motion toggle must not resume separately paused rain');
  await page.setViewportSize({width:390,height:844});await page.locator('#rainPause').click();await page.waitForTimeout(1200);await page.screenshot({path:path.join(out,'rain-mobile.png')});
  assert.equal(await page.locator('#rain').evaluate(e=>e.scrollWidth>e.clientWidth),false);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'simulation.json'),JSON.stringify({states,metrics,checks:['persistent drops','majority pinned','lateral drift','merges','re-pinning','deterministic rendering','pause and calm interaction','mobile'],errors},null,2));
  console.log(JSON.stringify({metrics,atNineSeconds:{merges:states.at(-1).merges,pauses:states.at(-1).pauses,pinned:states.at(-1).pinned,drops:states.at(-1).drops.length},errors},null,2));
}finally{await browser.close();}
