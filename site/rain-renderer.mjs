import {RainSimulation} from './rain-simulation.mjs';

export function createRain(canvas,options={}) {
  const gl=canvas.getContext('webgl2',{alpha:false,depth:false,antialias:false,powerPreference:'low-power'});
  const fallback={setActive(){},setAmount(){},setCalm(){},ready:Promise.resolve(false)};
  if(!gl){canvas.hidden=true;return fallback;}
  const captureMode=new URL(location.href).searchParams.has('capture');
  let active=true,calm=Boolean(options.calm)||captureMode,amount=.68,ready=false,frame=0,previous=0;
  let simulation=new RainSimulation({width:800*innerWidth/innerHeight,height:800,amount});
  const common=`precision highp float;uniform sampler2D photo;uniform vec2 resolution;uniform vec2 imageSize;uniform vec2 worldSize;
    vec2 cover(vec2 uv){float a=resolution.x/resolution.y,b=imageSize.x/imageSize.y;if(a<b)uv.x=(uv.x-.5)*a/b+.5;else uv.y=(uv.y-.5)*b/a+.5;return uv;}`;
  const baseVertex=`#version 300 es
    layout(location=0) in vec2 position;void main(){gl_Position=vec4(position,0.,1.);}`;
  const baseFragment=`#version 300 es
    ${common} out vec4 color;void main(){color=vec4(texture(photo,cover(gl_FragCoord.xy/resolution)).rgb,1.);}`;
  const dropVertex=`#version 300 es
    precision highp float;
    layout(location=0) in vec2 position;
    layout(location=1) in vec4 drop;
    layout(location=2) in vec4 motion;
    uniform vec2 worldSize;
    out vec2 local;flat out vec4 properties;flat out vec2 dimensions;
    void main(){
      float c=cos(motion.x),s=sin(motion.x);vec2 offset=position*drop.zw;
      offset=mat2(c,s,-s,c)*offset;vec2 point=drop.xy+offset;
      gl_Position=vec4(point.x/worldSize.x*2.-1.,1.-point.y/worldSize.y*2.,0.,1.);
      local=position;properties=motion;dimensions=drop.zw;
    }`;
  const dropFragment=`#version 300 es
    ${common}
    in vec2 local;flat in vec4 properties;flat in vec2 dimensions;out vec4 color;
    void main(){
      vec2 uv=gl_FragCoord.xy/resolution;
      if(properties.y<0.){
        float a=pow(max(0.,1.-abs(local.x)),2.)*(1.-smoothstep(.65,1.,abs(local.y)))*properties.z;
        color=vec4(mix(texture(photo,cover(uv)).rgb,vec3(.86,.94,1.),.065),a);return;
      }
      float slip=properties.y;
      float taper=mix(1.,.70+.30*smoothstep(-1.,.55,local.y),slip);
      float shape=local.x*local.x/(taper*taper)+local.y*local.y;
      float edge=max(fwidth(shape)*.8,.012);
      float alpha=(1.-smoothstep(1.-edge,1.,shape))*properties.z;
      if(alpha<=.001)discard;
      vec3 normal=normalize(vec3(local.x*.70/(taper*taper),-local.y*.65,max(.18,sqrt(max(0.,1.-shape)))));
      float c=cos(properties.x),s=sin(properties.x);
      vec2 offset=mat2(c,-s,s,c)*normal.xy*properties.w*.31;
      vec3 behind=texture(photo,cover(uv+offset/worldSize)).rgb;
      float shine=exp(-dot(local-vec2(-.30,-.37),local-vec2(-.30,-.37))*65.)*.20;
      float reflection=pow(max(0.,dot(normal,normalize(vec3(-.45,.65,.7)))),22.)*.07;
      float rim=smoothstep(.68,.98,shape)*max(0.,dot(local,vec2(.6,.6)))*.07;
      color=vec4(behind*(1.-rim)+vec3(shine+reflection),alpha);
    }`;
  function compile(type,source){const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;}
  function program(vertex,fragment){const result=gl.createProgram();gl.attachShader(result,compile(gl.VERTEX_SHADER,vertex));gl.attachShader(result,compile(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(result);if(!gl.getProgramParameter(result,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(result));return result;}
  const baseProgram=program(baseVertex,baseFragment),dropProgram=program(dropVertex,dropFragment);
  const locations=new Map([baseProgram,dropProgram].map(p=>[p,Object.fromEntries(['resolution','imageSize','worldSize'].map(name=>[name,gl.getUniformLocation(p,name)]))]));
  const vertices=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  function vao(){const result=gl.createVertexArray();gl.bindVertexArray(result);gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);return result;}
  const baseVao=vao(),dropVao=vao(),instances=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,instances);
  for(let location=1;location<=2;location++){gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,4,gl.FLOAT,false,32,(location-1)*16);gl.vertexAttribDivisor(location,1);}
  const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  let imageWidth=1,imageHeight=1;
  const instanceData=new Float32Array((simulation.maxDrops+simulation.maxTrails)*8);
  function use(p){gl.useProgram(p);const loc=locations.get(p);gl.uniform2f(loc.resolution,canvas.width,canvas.height);gl.uniform2f(loc.imageSize,imageWidth,imageHeight);gl.uniform2f(loc.worldSize,simulation.width,simulation.height);}
  function draw(){
    if(!ready)return;
    gl.disable(gl.BLEND);use(baseProgram);gl.bindVertexArray(baseVao);gl.drawArrays(gl.TRIANGLES,0,6);
    let count=0;
    const add=(...data)=>{instanceData.set(data,count*8);count++;};
    for(const trail of simulation.trails){const dx=trail.x2-trail.x1,dy=trail.y2-trail.y1;const length=Math.hypot(dx,dy);const fade=Math.max(0,1-(simulation.clock-trail.born)/trail.life);add((trail.x1+trail.x2)/2,(trail.y1+trail.y2)/2,Math.max(.4,trail.width),length/2+.6,-Math.atan2(dx,dy),-1,fade*.16,trail.width);}
    for(const d of simulation.drops){
      const slip=d.phase==='sliding'?Math.min(.85,d.vy/115):.03;
      const radius=d.radius*(1+d.pulse*.22);
      add(d.x,d.y,radius*(1-slip*.05),radius*(.93+slip*.34),-Math.max(-.22,Math.min(.22,Math.atan2(d.vx,d.vy+18))),slip,Math.min(1,d.age/.3)*.88,radius);
    }
    if(count){use(dropProgram);gl.bindVertexArray(dropVao);gl.bindBuffer(gl.ARRAY_BUFFER,instances);gl.bufferData(gl.ARRAY_BUFFER,instanceData.subarray(0,count*8),gl.DYNAMIC_DRAW);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArraysInstanced(gl.TRIANGLES,0,6,count);gl.disable(gl.BLEND);}
    gl.bindVertexArray(null);
  }
  function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;const ratio=Math.min(devicePixelRatio,1440/w);canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);gl.viewport(0,0,canvas.width,canvas.height);simulation.resize(800*w/h,800);draw();}
  let samples=0,elapsed=0;
  function loop(now){
    frame=0;if(!active||calm||document.hidden||!ready)return;
    const raw=(now-previous)/1000||1/60,dt=Math.min(raw,.05);previous=now;simulation.advance(dt);draw();samples++;elapsed+=raw;
    if(elapsed>=1){canvas.dataset.fps=(samples/elapsed).toFixed(1);canvas.dataset.drops=simulation.drops.length;canvas.dataset.merges=simulation.metrics.merges;canvas.dataset.pinned=simulation.drops.filter(d=>d.phase==='pinned').length;canvas.dataset.pauses=simulation.metrics.pauses;samples=0;elapsed=0;}
    frame=requestAnimationFrame(loop);
  }
  function resume(){if(!frame&&active&&!calm&&!document.hidden&&ready){previous=performance.now();frame=requestAnimationFrame(loop);}}
  const image=new Image();
  const readyPromise=new Promise(resolve=>{
    image.onload=()=>{gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);imageWidth=image.width;imageHeight=image.height;ready=true;canvas.dataset.ready='true';canvas.dataset.model='persistent-droplets';resize();draw();resume();resolve(true);};
    image.onerror=()=>{canvas.hidden=true;resolve(false);};
  });
  image.src=new URL('assets/rain-scene.png',document.baseURI).href;
  Object.defineProperty(canvas,'rainSimulationTime',{get:()=>simulation.clock});
  window.addEventListener('resize',resize);
  document.addEventListener('pointerdown',event=>{
    if(!active||calm||event.target.closest('button,a,input,select,nav,header'))return;
    const bounds=canvas.getBoundingClientRect();
    if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)return;
    simulation.addDrop({x:(event.clientX-bounds.left)/bounds.width*simulation.width,y:(event.clientY-bounds.top)/bounds.height*simulation.height,radius:3.4});draw();
  });
  document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);frame=0;resume();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelAnimationFrame(frame);frame=0;canvas.hidden=true;});
  if(captureMode){
    canvas.renderRainFrame=seconds=>{
      calm=true;cancelAnimationFrame(frame);frame=0;
      if(seconds<simulation.clock)simulation=new RainSimulation({width:simulation.width,height:simulation.height,amount});
      simulation.advance(Math.max(0,seconds-simulation.clock));draw();gl.finish();
      return {clock:simulation.clock,...simulation.metrics,pinned:simulation.drops.filter(d=>d.phase==='pinned').length,drops:simulation.drops.map(({id,x,y,radius,phase,vx,vy})=>({id,x,y,radius,phase,vx,vy}))};
    };
  }
  return {ready:readyPromise,setActive(value){active=value;cancelAnimationFrame(frame);frame=0;resume();},setAmount(value){amount=Math.max(0,Math.min(1,value));simulation.setAmount(amount);draw();},setCalm(value){calm=value;cancelAnimationFrame(frame);frame=0;draw();resume();}};
}
