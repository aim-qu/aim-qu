const STEP = 1 / 120;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const hash=(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);};
function surfaceNoise(x,y){const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const a=hash(ix,iy)*(1-fx)+hash(ix+1,iy)*fx,b=hash(ix,iy+1)*(1-fx)+hash(ix+1,iy+1)*fx;return (a*(1-fy)+b*fy)*2-1;}

export class RainSimulation {
  constructor({width=1200,height=800,seed=1847,amount=.68,initial,precipitation=true,condensation=.09}={}) {
    this.width=width;this.height=height;this.seed=seed>>>0;this.amount=amount;
    this.precipitation=precipitation;this.condensation=condensation;
    this.maxDrops=220;this.maxTrails=640;this.drops=[];this.trails=[];
    this.clock=0;this.accumulator=0;this.spawnBudget=0;this.nextId=1;
    this.metrics={merges:0,releases:0,pauses:0,spawned:0};
    const count=initial??Math.round(width*height/10500*(.6+amount*.55));
    for(let i=0;i<count;i++)this.addDrop({x:this.random()*width,y:this.random()*height,radius:1.4+this.random()**1.6*4.1,age:10});
    if(initial===undefined)for(let i=0;i<Math.max(3,Math.round(width/220));i++){
      const x=this.random()*width,y=this.random()*height*.65;
      this.addDrop({x,y,radius:6.4+this.random()*2.7,phase:'sliding',age:10});
      this.addDrop({x:x+(this.random()-.5)*6,y:y+38+this.random()*48,radius:2.4+this.random()*1.7,age:10});
    }
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  addDrop({x,y,radius=3,phase='pinned',hold=Infinity,vx=0,vy=0,runLength,age=0}={}) {
    if(this.drops.length>=this.maxDrops)return null;
    const volume=radius**3;
    const drop={id:this.nextId++,x,y,previousX:x,previousY:y,radius,volume,phase,hold,vx,vy,age,
      releaseVolume:Math.max(5.6**3,volume*(1.12+this.random()*.75)),
      runLength:runLength??this.slipDistance(),travel:0,burst:phase==='sliding'?1:0,
      wander:0,wanderTarget:(this.random()-.5)*2,wanderTimer:.2+this.random()*.7,
      phaseSeed:this.random()*Math.PI*2,pulse:0,trailX:x,trailY:y,dead:false};
    this.drops.push(drop);this.metrics.spawned++;return drop;
  }
  resize(width,height){const sx=width/this.width,sy=height/this.height;for(const d of this.drops){d.x*=sx;d.y*=sy;d.previousX*=sx;d.previousY*=sy;d.trailX*=sx;d.trailY*=sy;}this.trails=[];this.width=width;this.height=height;}
  setAmount(value){this.amount=clamp(value,0,1);}
  advance(seconds){if(!Number.isFinite(seconds)||seconds<=0)return;this.accumulator+=Math.min(seconds,60);while(this.accumulator+1e-12>=STEP){this.step(STEP);this.accumulator-=STEP;}}
  slipDistance(){return this.random()<.74?10+this.random()*38:65+this.random()*135;}
  release(drop){drop.phase='sliding';drop.hold=0;drop.travel=0;drop.burst=1;this.metrics.releases++;}
  pin(drop){drop.phase='pinned';drop.hold=.2+this.random()*1.45;drop.vx=0;drop.vy=0;drop.travel=0;drop.runLength=this.slipDistance();drop.releaseVolume=drop.volume*(1.15+this.random()*.45);this.metrics.pauses++;}
  step(dt){
    this.clock+=dt;
    for(const drop of this.drops){
      drop.previousX=drop.x;drop.previousY=drop.y;drop.age+=dt;drop.pulse*=Math.exp(-dt*8);
      drop.volume+=this.condensation*this.amount*drop.radius**2*dt;
      drop.radius=Math.cbrt(drop.volume);
      if(drop.phase==='pinned'){
        drop.hold-=dt;
        if(drop.hold<=0||drop.volume>=drop.releaseVolume)this.release(drop);
        else continue;
      }
      drop.wanderTimer-=dt;
      if(drop.wanderTimer<=0){drop.wanderTarget=(this.random()-.5)*2;drop.wanderTimer=.28+this.random()*.7;}
      drop.wander+=(drop.wanderTarget-drop.wander)*Math.min(dt*2.5,1);
      const surface=.85+.28*surfaceNoise(drop.x*.035,drop.y*.045);
      drop.burst*=Math.exp(-dt*5);
      let targetSpeed=clamp(Math.max(.1,drop.radius-3.3)**1.35*13,8,190)*surface*(1+drop.burst*.38);
      const remaining=drop.runLength-drop.travel;
      const brakeDistance=Math.max(3,drop.radius*.6);
      if(drop.radius<10.8&&remaining<brakeDistance)targetSpeed*=Math.max(.035,remaining/brakeDistance);
      drop.vy+=(targetSpeed-drop.vy)*(1-Math.exp(-dt*(targetSpeed<drop.vy?18:4.4)));
      const sideways=(surfaceNoise(drop.x*.032,drop.y*.068)*.8+drop.wander*.6)*clamp(drop.vy*.22,2,17);
      drop.vx+=(sideways*Math.min(drop.vy/12,1)-drop.vx)*(1-Math.exp(-dt*3.5));
      drop.x+=drop.vx*dt;drop.y+=drop.vy*dt;drop.travel+=Math.hypot(drop.vx,drop.vy)*dt;
      if(drop.radius<10.8&&(remaining<1.1||(remaining<brakeDistance&&drop.vy<2)))this.pin(drop);
      const distance=Math.hypot(drop.x-drop.trailX,drop.y-drop.trailY);
      if(distance>Math.max(2,drop.radius*.43)){
        this.trails.push({x1:drop.trailX,y1:drop.trailY,x2:drop.x,y2:drop.y,width:Math.min(.7,drop.radius*.055),born:this.clock,life:3.2+this.random()*2});
        drop.trailX=drop.x;drop.trailY=drop.y;
      }
      if(drop.y-drop.radius>this.height+20||drop.x<-30||drop.x>this.width+30)drop.dead=true;
    }
    this.coalesce();
    this.drops=this.drops.filter(drop=>!drop.dead);
    this.trails=this.trails.filter(trail=>this.clock-trail.born<trail.life).slice(-this.maxTrails);
    if(this.precipitation&&this.amount>0){
      this.spawnBudget+=dt*(1+this.amount*5)*this.width*this.height/960000;
      while(this.spawnBudget>=1){this.spawnBudget--;const r=1.5+this.random()**2*4.8;this.addDrop({x:this.random()*this.width,y:this.random()*this.height*.92,radius:r,phase:r>5.3?'sliding':'pinned'});}
    }
  }
  coalesce(){
    const grid=new Map(),size=32;
    let maxRadius=0;
    for(const drop of this.drops){if(drop.dead)continue;maxRadius=Math.max(maxRadius,drop.radius);const key=`${Math.floor(drop.x/size)},${Math.floor(drop.y/size)}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(drop);}
    for(const a of this.drops){
      if(a.dead)continue;
      const cx=Math.floor(a.x/size),cy=Math.floor(a.y/size),reach=Math.ceil((a.radius+maxRadius)/size);
      for(let x=cx-reach;x<=cx+reach;x++)for(let y=cy-reach;y<=cy+reach;y++)for(const b of grid.get(`${x},${y}`)||[]){
        if(a.dead||b.dead||a.id>=b.id)continue;
        if(Math.hypot(a.x-b.x,a.y-b.y)>(a.radius+b.radius)*.87)continue;
        // Radius cubed represents volume; coalescence conserves it and blends momentum.
        const total=a.volume+b.volume,weight=b.volume/total;
        a.x+=(b.x-a.x)*weight;a.y+=(b.y-a.y)*weight;
        a.vx=(a.vx*a.volume+b.vx*b.volume)/total;a.vy=(a.vy*a.volume+b.vy*b.volume)/total;
        a.volume=total;a.radius=Math.cbrt(total);a.pulse=.12;a.trailX=a.x;a.trailY=a.y;b.dead=true;
        if(a.phase==='sliding'||b.phase==='sliding'||total>=a.releaseVolume){a.phase='sliding';a.hold=0;}
        this.metrics.merges++;
      }
    }
  }
}
