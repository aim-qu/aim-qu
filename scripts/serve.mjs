import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.gif':'image/gif','.svg':'image/svg+xml','.ttf':'font/ttf'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1'),decoded=decodeURIComponent(url.pathname);let base,relative;
  if(decoded.startsWith('/assets/')){base=path.join(root,'assets');relative=decoded.slice(8);}
  else if(decoded.startsWith('/fonts/')){base=path.join(root,'resources','fonts');relative=decoded.slice(7);}
  else{base=path.join(root,'site');relative=decoded==='/'?'index.html':decoded.slice(1);}
  const file=path.resolve(base,relative);if(!file.startsWith(path.resolve(base)+path.sep)){res.writeHead(400);res.end();return;}
  try{const buffer=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(buffer);}catch{res.writeHead(404);res.end('Not found');}
});
server.listen(0,'127.0.0.1',()=>{fs.mkdirSync(path.join(root,'output'),{recursive:true});const info={port:server.address().port,pid:process.pid};fs.writeFileSync(path.join(root,'output','site-server.json'),JSON.stringify(info));console.log(`Playground: http://127.0.0.1:${info.port}`);});
