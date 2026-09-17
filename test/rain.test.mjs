import {test} from 'node:test';
import assert from 'node:assert/strict';
let RainSimulation;
try { ({RainSimulation}=await import('../site/rain-simulation.mjs')); } catch {}
const create=()=>{assert(RainSimulation,'The renderer needs independent persistent droplets, not a translated grid');return new RainSimulation({width:1200,height:800,seed:27,initial:0,precipitation:false,condensation:0});};
test('a pinned droplet stays put and accelerates after release',()=>{
  const sim=create(),drop=sim.addDrop({x:400,y:100,radius:7,phase:'pinned',hold:.7,runLength:10000});
  sim.advance(.5);assert.equal(drop.y,100);assert.equal(drop.vy,0);
  sim.advance(.3);const first=drop.vy;sim.advance(.3);assert(first>0);assert(drop.vy>first);assert(drop.y>100);
});
test('a sliding droplet bends and pauses again along the glass',()=>{
  const sim=create(),drop=sim.addDrop({x:400,y:100,radius:7,phase:'sliding',runLength:14});
  const points=[];for(let i=0;i<420;i++){sim.advance(1/60);points.push({x:drop.x,y:drop.y,vy:drop.vy,phase:drop.phase});}
  assert(points.some(p=>p.vy>8));assert(points.some(p=>p.phase==='pinned'&&p.y>101));
  assert(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))>1);
  const steps=points.slice(1).map((p,i)=>p.y-points[i].y);assert(Math.max(...steps)-Math.min(...steps)>.1);
  assert(drop.y>125);
});
test('contact merges volume and momentum instead of bouncing',()=>{
  const sim=create();sim.addDrop({x:300,y:200,radius:6,phase:'sliding',vy:30});sim.addDrop({x:305,y:200,radius:4,phase:'pinned'});
  const volume=sim.drops.reduce((sum,d)=>sum+d.volume,0);sim.advance(1/120);
  assert.equal(sim.drops.length,1);assert(Math.abs(sim.drops[0].volume-volume)<1e-7);assert(sim.drops[0].radius>6);assert(sim.drops[0].vy>=0);assert.equal(sim.metrics.merges,1);
});
test('distant drops do not merge and high-speed drops do not tunnel through neighbors',()=>{
  const sim=create();sim.addDrop({x:100,y:100,radius:6,phase:'sliding',vy:140,runLength:10000});sim.addDrop({x:100,y:114,radius:3,phase:'pinned'});sim.addDrop({x:600,y:110,radius:3,phase:'pinned'});
  sim.advance(.15);assert.equal(sim.drops.length,2);assert.equal(sim.metrics.merges,1);
});
test('fixed-step motion is repeatable across frame schedules and bounded in size',()=>{
  assert(RainSimulation);const a=new RainSimulation({seed:91}),b=new RainSimulation({seed:91});
  for(let i=0;i<240;i++)a.advance(1/60);for(let i=0;i<120;i++)b.advance(1/30);
  assert.equal(a.drops.length,b.drops.length);assert(Math.abs(a.drops[0].x-b.drops[0].x)<1e-7);assert(Math.abs(a.drops[0].y-b.drops[0].y)<1e-7);
  for(let i=0;i<1200;i++)a.advance(1/30);assert(a.drops.length<=a.maxDrops);assert(a.trails.length<=a.maxTrails);assert(a.metrics.merges>0);
});
