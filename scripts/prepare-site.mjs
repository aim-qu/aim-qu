import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=path.join(root,'output','site');
fs.mkdirSync(destination,{recursive:true});
for(const name of fs.readdirSync(path.join(root,'site'))){if(/\.(?:html|css|mjs)$/.test(name))fs.copyFileSync(path.join(root,'site',name),path.join(destination,name));}
fs.mkdirSync(path.join(destination,'assets'),{recursive:true});
for(const name of ['rain-scene.png','avatar.png','profile-data.json','news.json','aa-intelligence.png'])fs.copyFileSync(path.join(root,'assets',name),path.join(destination,'assets',name));
fs.mkdirSync(path.join(destination,'fonts'),{recursive:true});
for(const name of ['IBMPlexMono-Regular.ttf','OFL.txt'])fs.copyFileSync(path.join(root,'resources','fonts',name),path.join(destination,'fonts',name));
fs.writeFileSync(path.join(destination,'.nojekyll'),'');
console.log('Prepared static site: '+destination);
