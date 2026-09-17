import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assets=path.join(root,'assets');
async function fetchText(url){const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`${url}: HTTP ${r.status}`);return r.text();}
const profile=JSON.parse(await fetchText('https://api.github.com/users/aim-qu'));
fs.writeFileSync(path.join(assets,'profile-data.json'),JSON.stringify({login:profile.login,createdAt:profile.created_at,publicRepos:profile.public_repos,followers:profile.followers,following:profile.following,fetchedAt:new Date().toISOString(),source:'https://api.github.com/users/aim-qu'},null,2));
const decode=text=>text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").trim();
const field=(item,name)=>decode(item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,'i'))?.[1]||'');
const articles=[],sources=[];
for(const [name,url,host]of [['OpenAI','https://openai.com/news/rss.xml','openai.com'],['Google AI','https://blog.google/technology/ai/rss/','blog.google']]){
  try{const xml=await fetchText(url),items=[...xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g)].slice(0,7);for(const [,item]of items){const title=field(item,'title'),link=field(item,'link'),date=field(item,'pubDate');if(!title||!link)continue;const parsed=new URL(link);if(parsed.protocol!=='https:'||!parsed.hostname.endsWith(host))continue;const words=field(item,'description').split(/\s+/),budget=Math.max(0,Math.min(12,24-title.split(/\s+/).length));const excerpt=words.slice(0,budget).join(' ')+(words.length>budget&&budget?'…':'');articles.push({title,excerpt,url:link,source:name,publishedAt:Number.isNaN(Date.parse(date))?null:new Date(date).toISOString()});}sources.push({name,url,status:'ok'});}catch(error){sources.push({name,url,status:'unavailable'});console.warn(error.message);}
}
if(articles.length){articles.sort((a,b)=>Date.parse(b.publishedAt||0)-Date.parse(a.publishedAt||0));fs.writeFileSync(path.join(assets,'news.json'),JSON.stringify({fetchedAt:new Date().toISOString(),kind:'official-feed-headlines',articles,sources},null,2));}
else if(!fs.existsSync(path.join(assets,'news.json')))throw Error('No news sources available');
console.log(`Public profile updated; ${articles.length} official feed headlines.`);
