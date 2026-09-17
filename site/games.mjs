export function rng(seed) { let value=seed>>>0; return ()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;}; }
export function toggle(board,index) {
  const next=board.slice(),x=index%5,y=Math.floor(index/5);
  for(const [dx,dy]of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]){const xx=x+dx,yy=y+dy;if(xx>=0&&xx<5&&yy>=0&&yy<5)next[yy*5+xx]^=1;}
  return next;
}
export function puzzle(seed=Date.now()) {
  const random=rng(seed);let board=Array(25).fill(0);
  for(let i=0;i<14;i++)board=toggle(board,Math.floor(random()*25));
  if(board.every(n=>n===0))board=toggle(board,12);
  return board;
}
export function solve(board) {
  const rows=Array.from({length:25},(_,i)=>{
    let bits=board[i]?1n<<25n:0n;
    for(let j=0;j<25;j++)if(toggle(Array(25).fill(0),j)[i])bits|=1n<<BigInt(j);
    return bits;
  });
  const pivots=[];let rank=0;
  for(let column=0;column<25;column++){
    const found=rows.findIndex((row,i)=>i>=rank&&(row&(1n<<BigInt(column))));
    if(found<0)continue;[rows[rank],rows[found]]=[rows[found],rows[rank]];
    for(let i=0;i<25;i++)if(i!==rank&&(rows[i]&(1n<<BigInt(column))))rows[i]^=rows[rank];
    pivots.push(column);rank++;
  }
  if(rows.slice(rank).some(row=>(row&((1n<<25n)-1n))===0n&&(row&(1n<<25n))))return null;
  const free=Array.from({length:25},(_,i)=>i).filter(i=>!pivots.includes(i));
  let best=null;
  for(let mask=0;mask<2**free.length;mask++){
    const solution=Array(25).fill(0);free.forEach((column,i)=>solution[column]=(mask>>i)&1);
    for(let r=rank-1;r>=0;r--){let result=Number((rows[r]>>25n)&1n);for(const column of free)if(rows[r]&(1n<<BigInt(column)))result^=solution[column];solution[pivots[r]]=result;}
    const moves=solution.map((n,i)=>n?i:-1).filter(n=>n>=0);if(!best||moves.length<best.length)best=moves;
  }
  return best;
}
export function memoryDeck(seed=Date.now()) {
  const random=rng(seed),deck=[0,1,2,3,4,5,0,1,2,3,4,5];
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}return deck;
}
export function judgeRhythm(distance) { return distance<=35?'perfect':distance<=80?'good':'miss'; }
