import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {marked} from 'marked';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'preview');fs.mkdirSync(output,{recursive:true});
const markdown=fs.readFileSync(path.join(root,'README.md'),'utf8');
let body,mode='local Markdown approximation';
try{
  const response=await fetch('https://api.github.com/markdown',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/vnd.github+json'},body:JSON.stringify({text:markdown,mode:'gfm',context:'aim-qu/aim-qu'}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  body=await response.text();mode='GitHub Markdown API';
}catch(error){body=await marked.parse(markdown);console.log(`GitHub rendering unavailable (${error.message}); using local Markdown preview.`);}
fs.writeFileSync(path.join(output,'github-rendered.html'),body);
fs.writeFileSync(path.join(output,'render-source.json'),JSON.stringify({renderer:mode,generatedAt:new Date().toISOString()},null,2));
try{const {port}=JSON.parse(fs.readFileSync(path.join(root,'output','site-server.json'),'utf8'));body=body.replaceAll('https://aim-qu.github.io/aim-qu/',`http://127.0.0.1:${port}/`);}catch{}
body=body.replaceAll(/https:\/\/github\.com\/aim-qu\/aim-qu\/(?:raw|blob)\/(?:refs\/heads\/)?main\/assets\//g,'/assets/').replaceAll(/https:\/\/raw\.githubusercontent\.com\/aim-qu\/aim-qu\/(?:refs\/heads\/)?main\/assets\//g,'/assets/').replaceAll('./assets/','/assets/');
body=body.replace(/<img\b[^>]*>/g,tag=>{
  const canonical=tag.match(/data-canonical-src="([^"]+)"/);
  if(canonical&&canonical[1].includes('/assets/')){const file=canonical[1].split('/assets/')[1];return tag.replace(/src="[^"]*"/,`src="/assets/${file}"`);}
  return tag;
});
const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Profile · Glass preview</title><link rel="stylesheet" href="/markdown.css"><style>
*{box-sizing:border-box}body{margin:0;background:#fff;color:#1f2328;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI","Meiryo",sans-serif}.preview-bar{height:56px;padding:0 30px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #d8dee4;background:#f6f8fa;font-size:13px}.preview-bar strong{font-weight:600}.page{max-width:1280px;margin:36px auto;padding:0 30px;display:grid;grid-template-columns:240px minmax(0,1fr);gap:30px}.identity img{width:220px;height:220px;border-radius:50%;border:1px solid #d1d9e0;object-fit:cover}.identity h1{font-size:25px;line-height:1.3;margin:18px 0 0}.identity .handle{font-size:20px;color:#59636e;margin:0}.identity p{color:#66727f;font-size:14px;line-height:1.8}.identity a{color:#0969da;text-decoration:none}.readme-frame{border:1px solid #d1d9e0;border-radius:6px;padding:24px 31px;min-width:0}.readme-label{font:13px ui-monospace,Consolas,monospace;color:#59636e;margin:0 0 21px}.markdown-body{font-size:16px;line-height:1.55;background:#fff;color:#1f2328;min-width:0}.markdown-body h3{font-size:20px}.markdown-body img{max-width:100%}.markdown-body details{padding:7px 0}.markdown-body summary{cursor:pointer;font-size:14px}.markdown-body pre{font-size:14px}.markdown-body .highlight pre{background:#f6f8fa}.footer{text-align:center;color:#6e7781;font-size:13px;padding:22px 0 30px}.markdown-body details img{margin-top:18px}@media(max-width:850px){.page{display:block;padding:0 16px;margin-top:20px}.identity{display:flex;align-items:center;gap:15px;margin-bottom:20px}.identity img{width:65px;height:65px}.identity h1{margin:0;font-size:23px}.identity .handle{font-size:17px}.identity p{display:none}.readme-frame{padding:18px 16px}.preview-bar{padding:0 16px}.preview-bar span{display:none}.markdown-body{font-size:15px}}@media(prefers-color-scheme:dark){body{color-scheme:light}}
</style></head><body><header class="preview-bar"><strong>aim-qu / aim-qu</strong><span>本地预览 · ${mode} · 尚未发布</span></header><div class="page"><aside class="identity"><img src="https://avatars.githubusercontent.com/u/243293935?v=4" alt="aim-qu 的现有公开头像"><div><h1>ク</h1><div class="handle">aim-qu</div><p>个人主页 README 预览<br>Public profile artwork</p><p><a href="https://github.com/aim-qu">github.com/aim-qu</a></p></div></aside><main class="readme-frame"><div class="readme-label">aim-qu / README.md</div><article class="markdown-body">${body}</article></main></div><footer class="footer">本地预览。GitHub 外框为近似布局，README 内容由 ${mode} 生成。</footer></body></html>`;
fs.writeFileSync(path.join(output,'index.html'),html);
const types={'.png':'image/png','.gif':'image/gif','.svg':'image/svg+xml','.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8'};
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');let file;
  if(url.pathname==='/')file=path.join(output,'index.html');
  else if(url.pathname==='/markdown.css')file=path.join(root,'node_modules','github-markdown-css','github-markdown-light.css');
  else if(url.pathname.startsWith('/assets/')){const name=decodeURIComponent(url.pathname.slice(8));if(name!==path.basename(name)){res.writeHead(400);res.end();return;}file=path.join(root,'assets',name);}
  else{res.writeHead(404);res.end();return;}
  try{const data=fs.readFileSync(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}
});
server.listen(0,'127.0.0.1',()=>{const port=server.address().port;fs.writeFileSync(path.join(output,'server.json'),JSON.stringify({port,pid:process.pid,renderer:mode}));console.log(`Preview: http://127.0.0.1:${port}`);});
