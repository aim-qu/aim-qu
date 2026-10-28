// 手元で見るための仮のページ。READMEをmarkedでHTMLにし、GitHubの体裁（明・暗）で並べる。
// GitHub本体の描き方とは細部が違うので、最後は実際のGitHubで確かめる

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { marked } from 'marked';

const src = process.argv[2] ?? 'README.md';
const md = readFileSync(src, 'utf8').replaceAll('./live/', '../live/').replaceAll('./assets/', '../assets/');
const body = marked.parse(md);
mkdirSync('preview', { recursive: true });
for (const theme of ['dark', 'light']) {
  const bg = theme === 'dark' ? '#0d1117' : '#ffffff';
  const line = theme === 'dark' ? '#30363d' : '#d0d7de';
  writeFileSync(`preview/readme-${theme}.html`, `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="../node_modules/github-markdown-css/github-markdown-${theme}.css">
<style>body{background:${bg};margin:0}.wrap{max-width:900px;margin:24px auto;border:1px solid ${line};border-radius:6px;padding:24px 32px}
@media(max-width:600px){.wrap{margin:8px;padding:12px}}</style></head>
<body><div class="wrap"><article class="markdown-body">${body}</article></div></body></html>`);
}
console.log('preview/readme-dark.html, preview/readme-light.html');
