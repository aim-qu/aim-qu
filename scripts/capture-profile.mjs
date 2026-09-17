import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {PNG} from 'pngjs';
import gifenc from 'gifenc';
const {GIFEncoder,quantize,applyPalette}=gifenc;
const root=process.cwd(),assets=path.join(root,'assets');
const {port}=JSON.parse(fs.readFileSync('output/site-server.json','utf8'));
const browser=await chromium.launch({channel:'chrome'});
try{
  const page=await browser.newPage({viewport:{width:900,height:300}});
  await page.goto(`http://127.0.0.1:${port}/?capture=1#rain`,{waitUntil:'networkidle'});await page.waitForSelector('#rainCanvas[data-ready=true]');
  await page.locator('#rainPause').click();
  await page.addStyleTag({content:'.topbar,.scene-dock,.rain-composition,.scene-caption,#toast{display:none!important}.scene{padding:0!important;height:100vh!important;min-height:0!important;animation:none!important}'});
  await page.evaluate(()=>dispatchEvent(new Event('resize')));
  const encoder=GIFEncoder();let palette,previous;
  for(let i=0;i<60;i++){
    await page.evaluate(time=>document.querySelector('#rainCanvas').renderRainFrame(time),i*.1);
    const png=await page.screenshot();if(i===0)fs.writeFileSync(path.join(assets,'rain-still.png'),png);
    const frame=PNG.sync.read(png);if(!palette)palette=quantize(frame.data,255);const indexed=applyPalette(frame.data,palette);const difference=previous?indexed.map((value,index)=>value===previous[index]?255:value):indexed;encoder.writeFrame(difference,frame.width,frame.height,{palette:i===0?[...palette,[0,0,0]]:null,delay:100,repeat:0,transparent:i>0,transparentIndex:255,dispose:1});previous=indexed;
    if(i%20===0)console.log('Rain GIF '+i+'/60');
  }
  encoder.finish();fs.writeFileSync(path.join(assets,'rain.gif'),encoder.bytes());
  await page.setViewportSize({width:1100,height:900});await page.goto(`http://127.0.0.1:${port}`,{waitUntil:'networkidle'});
  const scenes=process.argv.includes('--rain-only')?['rain']:['rain','terminal','lights','rhythm','observatory','ink','memory','synth','news'];
  for(const id of scenes){const parent=['lights','memory'].includes(id)?'arcade':id;await page.locator(`.scene-dock [data-goto="${parent}"]`).click();await page.waitForTimeout(1000);if(parent==='arcade'){await page.locator(`[data-arcade="${id}"]`).click();await page.waitForTimeout(650);}if(id==='terminal'){await page.locator('#command').fill('palette');await page.locator('#command').press('Enter');}if(id==='ink'){await page.mouse.move(280,310);await page.mouse.down();await page.mouse.move(470,260,{steps:15});await page.mouse.move(660,390,{steps:15});await page.mouse.move(850,280,{steps:15});await page.mouse.up();}if(id==='rhythm'){await page.locator('#startRhythm').click();await page.waitForTimeout(1500);}if(id==='synth'){await page.keyboard.down('a');await page.keyboard.down('g');await page.waitForTimeout(180);}await page.screenshot({path:path.join(assets,`scene-${id}.png`)});if(id==='synth'){await page.keyboard.up('a');await page.keyboard.up('g');}}
  console.log(`Captured ${scenes.length} scene previews and rain GIF.`);
}finally{await browser.close();}
