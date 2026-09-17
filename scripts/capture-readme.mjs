import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {PNG} from 'pngjs';
import gifenc from 'gifenc';
import {solve} from '../site/games.mjs';

const {GIFEncoder,quantize,applyPalette}=gifenc;
const assets=path.resolve('assets');
const {port}=JSON.parse(fs.readFileSync('output/site-server.json','utf8'));
const ids=process.argv.slice(2).length?process.argv.slice(2):['rain','terminal','lights','rhythm','observatory','ink','memory','synth','news'];
const browser=await chromium.launch({channel:'chrome'});
try{
  for(const id of ids){
    const page=await browser.newPage({viewport:{width:1000,height:900}});
    await page.goto(`http://127.0.0.1:${port}/?capture=1#${id}`,{waitUntil:'networkidle'});
    await page.waitForTimeout(600);
    await page.addStyleTag({content:'.scene{animation:none!important}#clock{visibility:hidden}'});
    let solution=[],pairs=[],held=null;
    if(id==='rain')await page.locator('#rainPause').click();
    if(id==='lights')solution=solve(await page.locator('.light-cell').evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-pressed')==='true'?1:0)));
    if(id==='memory'){
      const values=await page.locator('.memory-card .symbol').allTextContents();
      const map=new Map();values.forEach((v,i)=>map.set(v,[...(map.get(v)||[]),i]));pairs=[...map.values()].flat();
    }
    if(id==='rhythm')await page.locator('#startRhythm').click();
    if(id==='terminal'){await page.locator('#command').fill('clear');await page.locator('#command').press('Enter');}
    const frames=[];
    for(let i=0;i<48;i++){
      if(id==='rain')await page.evaluate(t=>document.querySelector('#rainCanvas').renderRainFrame(t),i/12);
      if(id==='terminal'){
        const command=i<22?'palette':'help',offset=i<22?i:i-24;
        if(offset>=0&&offset<command.length)await page.locator('#command').fill(command.slice(0,offset+1));
        if(offset===command.length+2)await page.locator('#command').press('Enter');
      }
      if(id==='lights'&&i%3===2&&solution.length)await page.locator(`.light-cell[data-index="${solution.shift()}"]`).click();
      if(id==='memory'&&i%3===2&&pairs.length)await page.locator('.memory-card').nth(pairs.shift()).click();
      if(id==='rhythm'&&i%3===0)for(const key of ['d','f','j','k'])await page.keyboard.press(key);
      if(id==='ink'){
        const part=Math.floor(i/16),t=(i%16)/15;
        if(i%16===0){await page.locator('.ink-color').nth(part+1).click();await page.mouse.move(230,290+part*48);await page.mouse.down();}
        await page.mouse.move(230+550*t,290+part*48+Math.sin(t*Math.PI*3)*55,{steps:3});
        if(i%16===15)await page.mouse.up();
      }
      if(id==='synth'&&i%6===0){if(held)await page.keyboard.up(held);held=['a','s','d','f','g','h','j','k'][i/6];await page.keyboard.down(held);}
      if(id==='news'&&(i===14||i===30))await page.locator(`[data-news-source="${i===14?'OpenAI':'Google AI'}"]`).click();
      await page.waitForTimeout(60);
      const png=await page.screenshot();
      if(i===24)fs.writeFileSync(path.join(assets,`showcase-${id}.png`),png);
      frames.push(PNG.sync.read(png));
    }
    if(held)await page.keyboard.up(held);
    const sample=new Uint8Array(frames.length*Math.ceil(frames[0].data.length/64)*4);let at=0;
    for(const frame of frames)for(let p=0;p<frame.data.length;p+=64){sample.set(frame.data.subarray(p,p+4),at);at+=4;}
    const palette=quantize(sample.subarray(0,at),255),encoder=GIFEncoder();let previous;
    for(let i=0;i<frames.length;i++){
      const f=frames[i],indexed=applyPalette(f.data,palette);
      const difference=previous?indexed.map((v,j)=>v===previous[j]?255:v):indexed;
      encoder.writeFrame(difference,f.width,f.height,{palette:i===0?[...palette,[0,0,0]]:null,delay:80,repeat:0,transparent:i>0,transparentIndex:255,dispose:1});
      previous=indexed;
    }
    encoder.finish();const data=encoder.bytes();fs.writeFileSync(path.join(assets,`showcase-${id}.gif`),data);
    console.log(`${id}: 48 frames, ${Math.round(data.length/1024)} KiB`);
    await page.close();
  }
}finally{await browser.close();}
