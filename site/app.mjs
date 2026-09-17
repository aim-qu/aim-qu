import {puzzle,toggle,solve,memoryDeck,judgeRhythm,rng} from './games.mjs';
import {createRain} from './rain.mjs';
import {initNews} from './news.mjs';
import {initArcade} from './arcade.mjs';
const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
const scenes=[['rain','RAIN WINDOW','雨窓','#c7ddec'],['terminal','COLOR TERMINAL','ターミナル','#f1c6e5'],['arcade','PLAY LOUNGE','2 つのパズル','#cdeccf'],['rhythm','RAIN BEAT','リズムゲーム','#e4bde9'],['observatory','PUBLIC DATA','公開データ','#cbdcf0'],['ink','TRACE','自由に描く','#e9ddc7'],['synth','SPECTRUM','シンセ','#edc6e4'],['news','MODEL BRIEFING','AIニュース','#e6dfda']];
let active='rain',calm=matchMedia('(prefers-reduced-motion: reduce)').matches,sound=false,toastTimer;
function toast(value){$('#toast').textContent=value;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,3300);}
function save(key,value){try{localStorage.setItem('profile-playground:'+key,JSON.stringify(value));}catch{}}
function load(key,fallback){try{return JSON.parse(localStorage.getItem('profile-playground:'+key))??fallback;}catch{return fallback;}}
let rain;try{rain=createRain($('#rainCanvas'),{calm});}catch(error){$('#rainCanvas').hidden=true;console.warn(error.message);rain={setActive(){},setAmount(){},setCalm(){}};}
function activateScene(id){
  const index=scenes.findIndex(s=>s[0]===id);if(index<0)return;
  if(active===id&&document.body.dataset.initialized)return;
  if(active==='rhythm'&&id!=='rhythm')stopRhythm(false);
  stopNotes();
  active=id;document.body.dataset.scene=id;
  document.body.dataset.initialized='true';
  all('.scene').forEach(scene=>scene.classList.toggle('active',scene.id===id));
  all('.scene-dock button').forEach(button=>{if(button.dataset.goto===id)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  $('#sceneIndex').textContent=String(index+1).padStart(2,'0')+' / '+String(scenes.length).padStart(2,'0');$('#sceneName').textContent=scenes[index][1];
  history.replaceState(null,'','#'+id);rain.setActive(id==='rain');
  ambient();
  if(id==='observatory'){if(profileData)renderData();else getData();}
}
function setScene(id){
  if(id==='lights'||id==='memory'){arcade.select(id);id='arcade';}
  if(!scenes.some(s=>s[0]===id))return;
  $('#'+id).scrollIntoView({behavior:calm||new URL(location.href).searchParams.has('capture')?'instant':'smooth',block:'start'});
}
const arcade=initArcade(id=>{if(active==='arcade')history.replaceState(null,'','#'+id);});
let scrollFrame=0;
function trackScene(){
  scrollFrame=0;const point=innerHeight*.4;
  const scene=all('.scene').find(section=>{const r=section.getBoundingClientRect();return r.top<=point&&r.bottom>point;});
  if(scene)activateScene(scene.id);
}
addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(trackScene);},{passive:true});
all('[data-goto]').forEach(button=>button.addEventListener('click',()=>setScene(button.dataset.goto)));
scenes.forEach(([id,name,label,color],i)=>{const button=document.createElement('button');button.style.setProperty('--preview-color',color+'80');button.innerHTML='<span></span><strong></strong><small></small>';button.querySelector('span').textContent=String(i+1).padStart(2,'0');button.querySelector('strong').textContent=name;button.querySelector('small').textContent=label;button.addEventListener('click',()=>{$('#scenePicker').close();setScene(id);});$('.picker-grid').append(button);});
$('#overview').onclick=()=>$('#scenePicker').showModal();$('#closePicker').onclick=()=>$('#scenePicker').close();
$('#calm').setAttribute('aria-pressed',String(calm));$('#calm').textContent=calm?'動き OFF':'動き ON';
$('#calm').onclick=()=>{calm=!calm;$('#calm').setAttribute('aria-pressed',String(calm));$('#calm').textContent=calm?'動き OFF':'動き ON';document.body.classList.toggle('calm',calm);rain.setCalm(calm||rainStopped);};
$('#rainAmount').oninput=event=>{const amount=Number(event.target.value);$('#rainValue').textContent=amount+'%';rain.setAmount(amount/100);};
let rainStopped=false;$('#rainPause').onclick=()=>{rainStopped=!rainStopped;rain.setCalm(calm||rainStopped);$('#rainPause').textContent=rainStopped?'雨を動かす':'雨を止める';};
function clock(){$('#clock').textContent=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date())+' JST';}clock();setInterval(clock,1000);

let audio,master,analyser,noiseSource,noiseGain;const voices=new Map();
function initAudio(){if(!audio){audio=new AudioContext();master=audio.createGain();master.gain.value=.22;analyser=audio.createAnalyser();analyser.fftSize=512;master.connect(analyser);analyser.connect(audio.destination);}if(audio.state==='suspended')audio.resume();return audio;}
function setSound(value){sound=value;$('#sound').setAttribute('aria-pressed',String(sound));$('#sound').textContent=sound?'音 ON':'音 OFF';if(sound)initAudio();else stopNotes();ambient();}
$('#sound').onclick=()=>setSound(!sound);
function note(frequency,duration=.13,type='sine',volume=.23){if(!sound)return;const ctx=initAudio(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=type;osc.frequency.value=frequency;gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(volume,ctx.currentTime+.012);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);osc.connect(gain);gain.connect(master);osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start();osc.stop(ctx.currentTime+duration+.05);}
function stopNotes(){for(const voice of voices.values()){try{voice.osc.stop();}catch{}voice.gain.disconnect();}voices.clear();all('.synth-pad').forEach(p=>p.classList.remove('pressed'));}
function ambient(){if(noiseSource){try{noiseSource.stop();}catch{}noiseSource=null;}if(!audio||!sound||active!=='rain'||document.hidden)return;const length=audio.sampleRate*2,buffer=audio.createBuffer(1,length,audio.sampleRate),data=buffer.getChannelData(0);let last=0;for(let i=0;i<length;i++){last=(last+Math.random()*.2-.1)/1.02;data[i]=last*.8;}noiseSource=audio.createBufferSource();noiseSource.buffer=buffer;noiseSource.loop=true;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=3200;noiseGain=audio.createGain();noiseGain.gain.value=.13;noiseSource.connect(filter);filter.connect(noiseGain);noiseGain.connect(master);noiseSource.start();}
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopRhythm(false);stopNotes();}ambient();});

const output=$('#terminalOutput');
function terminalLine(value,kind=''){const line=document.createElement('div');line.className='terminal-line '+kind;line.textContent=value;output.append(line);while(output.children.length>90)output.firstElementChild.remove();output.scrollTop=output.scrollHeight;}
terminalLine('ク / playground','accent');terminalLine('help でコマンドを表示。ここから各場面へ移動できます。');
const commands={
  help:()=>terminalLine('help      コマンド一覧\npalette   配色を見る\ndate      日本時間\nstats     公開GitHubデータ\nrain      雨窓へ\nplay      ライトパズルへ\nclear     表示を消す\nwhoami    ク'),
  palette:()=>{const row=document.createElement('div');row.className='terminal-line palette';for(const [name,color]of [['CYAN','#028caf'],['PINK','#c42a81'],['AMBER','#bd6b26'],['MINT','#148664']]){const span=document.createElement('span');span.textContent=name+' '+color;span.style.color=color;row.append(span);}output.append(row);},
  date:()=>terminalLine(new Intl.DateTimeFormat('ja-JP',{dateStyle:'full',timeStyle:'long',timeZone:'Asia/Tokyo'}).format(new Date()),'accent'),
  stats:async()=>{await getData();terminalLine(profileData?JSON.stringify(profileData,null,2):'データを取得できませんでした。');},
  rain:()=>setScene('rain'),play:()=>setScene('lights'),clear:()=>output.replaceChildren(),whoami:()=>terminalLine('ク','accent')
};
function runCommand(raw){const value=raw.trim().toLowerCase();if(!value)return;terminalLine('> '+raw,'command');if(commands[value])Promise.resolve(commands[value]()).catch(()=>terminalLine('実行できませんでした。','error'));else terminalLine('未登録のコマンドです。help を入力してください。','error');}
$('#terminalForm').onsubmit=event=>{event.preventDefault();runCommand($('#command').value);$('#command').value='';};all('[data-command]').forEach(button=>button.onclick=()=>runCommand(button.dataset.command));

let lightInitial=puzzle(),lightBoard=lightInitial.slice(),lightMoves=0;
function renderLights(){const grid=$('#lightGrid');if(!grid.children.length)for(let i=0;i<25;i++){const button=document.createElement('button');button.className='light-cell';button.dataset.index=i;button.addEventListener('click',()=>{lightBoard=toggle(lightBoard,i);lightMoves++;renderLights();note(260+(i%5)*60);});grid.append(button);}
  [...grid.children].forEach((button,i)=>{button.classList.toggle('on',Boolean(lightBoard[i]));button.classList.remove('hint');button.setAttribute('aria-pressed',String(Boolean(lightBoard[i])));button.setAttribute('aria-label',`${Math.floor(i/5)+1}行 ${i%5+1}列 ${lightBoard[i]?'点灯':'消灯'}`);});
  $('#lightMoves').textContent=lightMoves+' 手';const won=lightBoard.every(n=>n===0);$('#lightStatus').textContent=won?'CLEAR · '+lightMoves+' 手':lightBoard.filter(Boolean).length+' 個点灯';if(won){save('lightsCleared',load('lightsCleared',0)+1);toast('CLEAR');note(660,.4);}
}
$('#newLights').onclick=()=>{lightInitial=puzzle();lightBoard=lightInitial.slice();lightMoves=0;renderLights();};$('#resetLights').onclick=()=>{lightBoard=lightInitial.slice();lightMoves=0;renderLights();};$('#hintLights').onclick=()=>{const answer=solve(lightBoard);if(answer?.length){$('#lightGrid').children[answer[0]].classList.add('hint');$('#lightStatus').textContent='色枠のライトを押してください。';}};renderLights();

let deck=memoryDeck(),flipped=[],matched=new Set(),memoryMoves=0,memoryEpoch=0;
const symbols=['◇','△','○','□','＋','≋'],cardColors=['#cd769b','#68a8c0','#b19255','#68aa91','#9d8bbe','#d59061'];
function renderMemory(){const grid=$('#memoryGrid');grid.replaceChildren();deck.forEach((value,i)=>{const button=document.createElement('button');button.className='memory-card';button.style.setProperty('--card-color',cardColors[value]);button.classList.toggle('flipped',flipped.includes(i));button.classList.toggle('matched',matched.has(i));button.disabled=matched.has(i);button.setAttribute('aria-label',`${i+1}枚目${flipped.includes(i)||matched.has(i)?' '+symbols[value]:''}`);const span=document.createElement('span');span.className='symbol';span.textContent=symbols[value];button.append(span);button.onclick=()=>flipCard(i);grid.append(button);});$('#memoryMoves').textContent=memoryMoves+' 回';$('#memoryPairs').textContent=matched.size/2+' / 6 ペア';$('#memoryStatus').textContent=matched.size===12?'CLEAR · '+memoryMoves+' 回':'';}
function flipCard(i){if(flipped.length>=2||flipped.includes(i)||matched.has(i))return;flipped.push(i);note(250+deck[i]*50);if(flipped.length===2){memoryMoves++;const [a,b]=flipped;if(deck[a]===deck[b]){matched.add(a);matched.add(b);flipped=[];if(matched.size===12){save('memoryCleared',load('memoryCleared',0)+1);toast('CLEAR');}}else{const epoch=memoryEpoch;setTimeout(()=>{if(epoch===memoryEpoch){flipped=[];renderMemory();}},720);}}renderMemory();}
$('#newMemory').onclick=()=>{memoryEpoch++;deck=memoryDeck();flipped=[];matched.clear();memoryMoves=0;renderMemory();};renderMemory();

const rhythmCanvas=$('#rhythmCanvas'),rhythmCtx=rhythmCanvas.getContext('2d');
let rhythmPlaying=false,rhythmStart=0,rhythmLast=0,rhythmSpawn=0,rhythmNotes=[],rhythmScore=0,rhythmCombo=0,rhythmHits=0,rhythmMisses=0,rhythmFrame=0,judgement='',judgeUntil=0;
const laneColors=['#db82bd','#9c9eda','#7fc9d9','#e7ad92'];
function drawRhythm(now=performance.now()){
  const w=rhythmCanvas.clientWidth,h=rhythmCanvas.clientHeight;rhythmCtx.clearRect(0,0,w,h);
  for(let i=0;i<4;i++){rhythmCtx.fillStyle=i%2?'#ffffff10':'#ffffff22';rhythmCtx.fillRect(i*w/4,0,w/4,h);rhythmCtx.strokeStyle='#ffffff85';rhythmCtx.beginPath();rhythmCtx.moveTo(i*w/4,0);rhythmCtx.lineTo(i*w/4,h);rhythmCtx.stroke();}
  const hit=h-47;rhythmCtx.strokeStyle='#cf8bbd';rhythmCtx.lineWidth=2;rhythmCtx.beginPath();rhythmCtx.moveTo(0,hit);rhythmCtx.lineTo(w,hit);rhythmCtx.stroke();
  for(const item of rhythmNotes){const y=(now-item.born)/1800*hit;item.y=y;rhythmCtx.shadowBlur=16;rhythmCtx.shadowColor=laneColors[item.lane];rhythmCtx.fillStyle=laneColors[item.lane];rhythmCtx.fillRect(item.lane*w/4+11,y,w/4-22,12);rhythmCtx.shadowBlur=0;}
  if(now<judgeUntil){rhythmCtx.font='17px Consolas';rhythmCtx.textAlign='center';rhythmCtx.fillStyle=judgement==='MISS'?'#ba738e':'#9b63a0';rhythmCtx.fillText(judgement,w/2,h*.38);}
}
function rhythmLoop(now){if(!rhythmPlaying)return;const elapsed=(now-rhythmStart)/1000;if(elapsed>=30){stopRhythm(true);return;}if(now-rhythmSpawn>520){rhythmNotes.push({lane:Math.floor(Math.random()*4),born:now,y:0});rhythmSpawn=now;}
  const cutoff=rhythmCanvas.clientHeight+20;rhythmNotes=rhythmNotes.filter(item=>{if(item.y>cutoff){rhythmMisses++;rhythmCombo=0;return false;}return true;});drawRhythm(now);$('#rhythmTime').textContent=(30-elapsed).toFixed(1)+' s';rhythmFrame=requestAnimationFrame(rhythmLoop);}
function stopRhythm(finished){if(!rhythmPlaying)return;rhythmPlaying=false;cancelAnimationFrame(rhythmFrame);$('#startRhythm').textContent='もう一度プレイ';$('#startRhythm').disabled=false;if(finished){const best=Math.max(load('rhythmBest',0),rhythmScore);save('rhythmBest',best);$('#rhythmResult').textContent=`${rhythmScore} pts · BEST ${best} · HIT ${rhythmHits}`;$('#rhythmTime').textContent='0.0 s';}else $('#rhythmResult').textContent='中断しました。もう一度開始できます。';rhythmNotes=[];drawRhythm();}
$('#startRhythm').onclick=()=>{rhythmPlaying=true;rhythmStart=performance.now();rhythmSpawn=rhythmStart-400;rhythmNotes=[];rhythmScore=rhythmCombo=rhythmHits=rhythmMisses=0;$('#rhythmScore').textContent='0000';$('#rhythmCombo').textContent='COMBO 0';$('#rhythmResult').textContent='D · F · J · K';$('#startRhythm').disabled=true;rhythmFrame=requestAnimationFrame(rhythmLoop);};
function hitLane(lane){const button=$(`[data-lane="${lane}"]`);button.classList.add('pressed');setTimeout(()=>button.classList.remove('pressed'),120);if(!rhythmPlaying)return;const now=performance.now(),hit=rhythmCanvas.clientHeight-47;const candidates=rhythmNotes.filter(n=>n.lane===lane).map(n=>({n,d:Math.abs((now-n.born)/1800*hit-hit)})).sort((a,b)=>a.d-b.d);const chosen=candidates[0],result=chosen?judgeRhythm(chosen.d):'miss';judgement=result.toUpperCase();judgeUntil=now+420;if(result!=='miss'){rhythmNotes.splice(rhythmNotes.indexOf(chosen.n),1);rhythmCombo++;rhythmHits++;rhythmScore+=(result==='perfect'?100:60)+Math.min(rhythmCombo*2,40);note([261.63,329.63,392,523.25][lane]);}else{rhythmCombo=0;rhythmMisses++;}$('#rhythmScore').textContent=String(rhythmScore).padStart(4,'0');$('#rhythmCombo').textContent='COMBO '+rhythmCombo;}
all('[data-lane]').forEach(button=>button.onpointerdown=event=>{event.preventDefault();hitLane(Number(button.dataset.lane));});

let profileData=null,dataBusy=false;
async function getData(refresh=false){if(dataBusy||profileData&&!refresh)return profileData;dataBusy=true;try{const response=await fetch(refresh?'https://api.github.com/users/aim-qu':'assets/profile-data.json',{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error(response.status);const data=await response.json();profileData=refresh?{login:data.login,createdAt:data.created_at,publicRepos:data.public_repos,followers:data.followers,following:data.following,fetchedAt:new Date().toISOString()}:data;}catch{if(!profileData)$('#dataTime').textContent='データを取得できません。再試行できます。';else toast('更新できませんでした。前回のデータを表示します。');}finally{dataBusy=false;}renderData();return profileData;}
function renderData(){if(!profileData)return;$('#dataTime').textContent='取得 '+new Date(profileData.fetchedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})+' JST';const values=[['PUBLIC REPOS',profileData.publicRepos,155,217],['FOLLOWERS',profileData.followers,460,80],['FOLLOWING',profileData.following,748,251],['SINCE',String(profileData.createdAt||'').slice(0,7),434,402]];const group=$('#orbitNodes');group.replaceChildren();for(const [label,value,x,y]of values){const ns='http://www.w3.org/2000/svg',g=document.createElementNS(ns,'g');g.classList.add('data-node');const circle=document.createElementNS(ns,'circle');circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r','48');g.append(circle);for(const [text,cls,dy]of [[value??'—','value',5],[label,'label',72]]){const t=document.createElementNS(ns,'text');t.setAttribute('x',x);t.setAttribute('y',y+dy);t.setAttribute('text-anchor','middle');t.classList.add(cls);t.textContent=text;g.append(t);}group.append(g);}}
$('#refreshData').onclick=()=>getData(true);getData();

const inkCanvas=$('#inkCanvas'),inkCtx=inkCanvas.getContext('2d');let strokes=[],stroke=null,brush='#253945',touchDrawing=false;
$('#drawInk').onclick=()=>{touchDrawing=!touchDrawing;$('#drawInk').setAttribute('aria-pressed',String(touchDrawing));inkCanvas.style.touchAction=touchDrawing?'none':'pan-y';};
all('.ink-color').forEach(button=>{button.style.setProperty('--paint',button.dataset.color);button.onclick=()=>{brush=button.dataset.color;all('.ink-color').forEach(b=>b.classList.toggle('selected',b===button));};});
function inkPoint(event){const r=inkCanvas.getBoundingClientRect();return [(event.clientX-r.left)/r.width,(event.clientY-r.top)/r.height];}
function drawInk(){const w=inkCanvas.clientWidth,h=inkCanvas.clientHeight;inkCtx.clearRect(0,0,w,h);for(const line of [...strokes,...(stroke?[stroke]:[])]){inkCtx.strokeStyle=line.color;inkCtx.lineWidth=line.width;inkCtx.lineCap='round';inkCtx.lineJoin='round';inkCtx.beginPath();line.points.forEach(([x,y],i)=>{if(i===0)inkCtx.moveTo(x*w,y*h);else inkCtx.lineTo(x*w,y*h);});inkCtx.stroke();}}
inkCanvas.onpointerdown=event=>{if(event.pointerType==='touch'&&!touchDrawing)return;inkCanvas.setPointerCapture(event.pointerId);stroke={color:brush,width:Number($('#brushSize').value),points:[inkPoint(event)]};};inkCanvas.onpointermove=event=>{if(stroke){stroke.points.push(inkPoint(event));drawInk();}};
function finishStroke(){if(stroke){if(stroke.points.length===1)stroke.points.push([stroke.points[0][0]+.0001,stroke.points[0][1]+.0001]);strokes.push(stroke);stroke=null;drawInk();}}
inkCanvas.onpointerup=finishStroke;inkCanvas.onpointercancel=finishStroke;$('#undoInk').onclick=()=>{strokes.pop();drawInk();};$('#clearInk').onclick=()=>{strokes=[];drawInk();};$('#saveInk').onclick=()=>{const body=strokes.map(line=>`<polyline points="${line.points.map(([x,y])=>`${(x*1400).toFixed(2)},${(y*900).toFixed(2)}`).join(' ')}" fill="none" stroke="${line.color}" stroke-width="${line.width}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');const blob=new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 900"><rect width="1400" height="900" fill="#f5f1e9"/>${body}</svg>`],{type:'image/svg+xml'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='trace.svg';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

const frequencies=[261.63,293.66,329.63,349.23,392,440,493.88,523.25],keys=['a','s','d','f','g','h','j','k'],noteNames=['C4','D4','E4','F4','G4','A4','B4','C5'],padColors=['#e9a0c5','#dbabdf','#c1b0e5','#abc3ec','#92d3de','#a6dcd0','#d2dca6','#edc396'];
function startPad(index){if(voices.has(index))return;if(!sound)setSound(true);const ctx=initAudio(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.type=$('#waveform').value;osc.frequency.value=frequencies[index];gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(.25,ctx.currentTime+.035);osc.connect(gain);gain.connect(master);osc.start();voices.set(index,{osc,gain});$(`[data-note="${index}"]`).classList.add('pressed');$('#synthNote').textContent=noteNames[index];}
function stopPad(index){const voice=voices.get(index);if(!voice)return;voices.delete(index);const t=audio.currentTime;voice.gain.gain.cancelScheduledValues(t);voice.gain.gain.setTargetAtTime(.0001,t,.07);voice.osc.onended=()=>{voice.osc.disconnect();voice.gain.disconnect();};voice.osc.stop(t+.4);$(`[data-note="${index}"]`).classList.remove('pressed');}
keys.forEach((key,i)=>{const button=document.createElement('button');button.className='synth-pad';button.dataset.note=i;button.style.setProperty('--pad-color',padColors[i]);button.innerHTML='<strong></strong><span></span>';button.querySelector('strong').textContent=noteNames[i];button.querySelector('span').textContent=key.toUpperCase();button.onpointerdown=event=>{event.preventDefault();button.setPointerCapture(event.pointerId);startPad(i);};button.onpointerup=()=>stopPad(i);button.onpointercancel=()=>stopPad(i);$('#synthPads').append(button);});
$('#volume').oninput=event=>{if(master)master.gain.setTargetAtTime(Number(event.target.value)/100,audio.currentTime,.03);};
const scope=$('#synthScope'),scopeCtx=scope.getContext('2d');
function drawScope(){requestAnimationFrame(drawScope);if(active!=='synth'||document.hidden)return;const w=scope.clientWidth,h=scope.clientHeight;scopeCtx.clearRect(0,0,w,h);scopeCtx.strokeStyle='#b191bc55';scopeCtx.lineWidth=1;scopeCtx.beginPath();scopeCtx.moveTo(0,h/2);scopeCtx.lineTo(w,h/2);scopeCtx.stroke();if(!analyser)return;const data=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(data);const gradient=scopeCtx.createLinearGradient(0,0,w,0);gradient.addColorStop(0,'#39adc2');gradient.addColorStop(.55,'#c177b5');gradient.addColorStop(1,'#e69e83');scopeCtx.strokeStyle=gradient;scopeCtx.lineWidth=2;scopeCtx.beginPath();data.forEach((v,i)=>{const x=i/(data.length-1)*w,y=(v-128)/128*h*.43+h/2;if(i===0)scopeCtx.moveTo(x,y);else scopeCtx.lineTo(x,y);});scopeCtx.stroke();}requestAnimationFrame(drawScope);

function resizeCanvases(){for(const canvas of [rhythmCanvas,inkCanvas,scope]){const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)continue;const ratio=Math.min(devicePixelRatio,1.5);canvas.width=Math.round(rect.width*ratio);canvas.height=Math.round(rect.height*ratio);canvas.getContext('2d').setTransform(ratio,0,0,ratio,0,0);}drawRhythm();drawInk();}
window.addEventListener('resize',resizeCanvases);
document.addEventListener('keydown',event=>{if(event.target.matches('input,textarea,select')||$('#scenePicker').open)return;const key=event.key.toLowerCase();if(active==='rhythm'&&['d','f','j','k'].includes(key)){event.preventDefault();if(!event.repeat)hitLane(['d','f','j','k'].indexOf(key));return;}if(active==='synth'&&keys.includes(key)){event.preventDefault();if(!event.repeat)startPad(keys.indexOf(key));return;}if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();const i=scenes.findIndex(s=>s[0]===active);setScene(scenes[(i+(event.key==='ArrowRight'?1:scenes.length-1))%scenes.length][0]);}});
document.addEventListener('keyup',event=>{const index=keys.indexOf(event.key.toLowerCase());if(index>=0)stopPad(index);});window.addEventListener('blur',stopNotes);
window.addEventListener('hashchange',()=>setScene(location.hash.slice(1)));
initNews();
requestAnimationFrame(()=>{
  const requested=location.hash.slice(1);
  if(requested==='lights'||requested==='memory')arcade.select(requested);
  const id=requested==='lights'||requested==='memory'?'arcade':scenes.some(s=>s[0]===requested)?requested:'rain';
  resizeCanvases();$('#'+id).scrollIntoView({behavior:'instant',block:'start'});trackScene();
});
