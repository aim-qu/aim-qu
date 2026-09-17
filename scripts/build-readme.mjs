import fs from 'node:fs';
const base='https://aim-qu.github.io/aim-qu/';
const picture=(name,alt)=>`<picture>\n  <source media="(prefers-reduced-motion: reduce)" srcset="./assets/${name}.png">\n  <img src="./assets/${name}.gif" width="100%" alt="${alt}">\n</picture>`;
const scenes=[
  ['rain','RAIN WINDOW / 雨窓','雨量を変える。流れを止める。音を聴く。','雨窓をひらく'],
  ['terminal','TERMINAL / カラーコマンド','色の一覧、時刻、公開プロフィール。コマンドで場面を移動。','コマンドを試す'],
  ['lights','LIGHTS OUT / ライトパズル','ひとつ押すと、上下左右も切り替わる。すべて消したらクリア。ゲーム区のタブからカラーメモリーにも切り替えられます。','パズルで遊ぶ'],
  ['rhythm','RAIN BEAT / 雨滴リズム','D · F · J · K。光が線に重なる瞬間に押す、30 秒のゲーム。','リズムゲームで遊ぶ'],
  ['observatory','PUBLIC DATA / 公開プロフィール','GitHub の公開情報を表示。画面から最新の情報を取得できます。','公開データを見る'],
  ['ink','TRACE / 線と色','3 色の線も、ひと筆だけでも。戻す・消す・SVG 保存。','キャンバスに描く'],
  ['memory','COLOR MEMORY / 色と形','12 枚のカードから、同じ色と形のペアを探す。ライトパズルと同じ場所で切り替え。途中の状態はそのまま。','カードをめくる'],
  ['synth','SPECTRUM / 音と波形','A · S · D · F · G · H · J · K。8 音と 3 種類の波形。','音を鳴らす'],
  ['news','MODEL BRIEFING / AI ニュース','OpenAI と Google AI の公式ニュース。発表元へのリンクを添えて。','ニュースを読む'],
];
let out=`<a href="${base}#rain">\n<picture>\n  <source media="(prefers-reduced-motion: reduce)" srcset="./assets/rain-still.png">\n  <img src="./assets/rain.gif" width="100%" alt="アバターから続く雨景">\n</picture>\n</a>\n\n<p align="center"><a href="${base}"><strong>OPEN PLAYGROUND / ひらく</strong></a></p>\n\nこのページでは、各場面の動きと操作例を紹介しています。画像を押すと、実際に遊べる画面が開きます。\n\n`;
for(const[id,title,caption,action]of scenes){
  out+=`## ${title}\n\n<a href="${base}#${id}">\n${picture('showcase-'+id,title+' の動作デモ')}\n</a>\n\n${caption}\n\n[${action}](${base}#${id})\n\n`;
}
const news=JSON.parse(fs.readFileSync('assets/news.json','utf8'));
const date=value=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',dateStyle:'short'}).format(new Date(value));
out+=`### HEADLINES\n\n${date(news.fetchedAt)} JST 取得。以下は保存時点の見出しです。\n\n`;
const headlines=['OpenAI','Google AI'].flatMap(source=>news.articles.filter(a=>a.source===source).slice(0,3));
const escape=text=>text.replace(/[\[\]\\]/g,'\\$&');
for(const a of headlines)out+=`- **${a.source}** · ${date(a.publishedAt||news.fetchedAt)} JST — [${escape(a.title)}](${a.url})\n`;
out+=`\n## MODEL WATCH / Artificial Analysis\n\n<a href="https://artificialanalysis.ai/#artificial-analysis-intelligence-index">\n  <img src="./assets/aa-intelligence.png" width="100%" alt="Artificial Analysis Intelligence Index v4.3。2026年9月17日取得。">\n</a>\n\n2026-09-17 10:52 JST 取得 · Intelligence Index v4.3 · 公式の初期表示（26 モデル）\n\n[原寸で見る](./assets/aa-intelligence.png) · [最新の公式チャート](https://artificialanalysis.ai/#artificial-analysis-intelligence-index)\n\n保存時点の画像です。AA の自動取得は設定していません。\n\n<details>\n<summary><strong>操作 / CONTROLS</strong></summary>\n\n- 各画像から、その場面を直接ひらけます。\n- 交互の画面では、下のメニューか ← → で移動できます。\n- Rain Beat：D / F / J / K。Spectrum：A / S / D / F / G / H / J / K。\n- 音は操作するまで鳴りません。GIF は無音の操作例です。\n- ゲーム記録と描画は、そのブラウザー内だけで扱います。\n- 動きを減らす設定では、各 GIF の代わりに静止画を表示します。\n\n</details>\n\n<details>\n<summary><strong>データと素材 / SOURCES</strong></summary>\n\n- プロフィール：[GitHub の公開 API](https://api.github.com/users/aim-qu)。非公開リポジトリは取得しません。\n- ニュース：[OpenAI 公式 RSS](https://openai.com/news/rss.xml)と[Google AI 公式 RSS](https://blog.google/technology/ai/rss/)。この README の見出しは上記取得日時の保存内容です。\n- モデル評価：Artificial Analysis の公式ダウンロード画像。[引用ガイドライン](https://artificialanalysis.ai/brand-kit)に沿って、図の署名・指数バージョン・モデルの条件を残しています。\n- 雨景：既存アバターの色調を参考に生成した背景と、独立した雨滴のシミュレーション。\n- 動作デモ：このリポジトリの画面を実際に操作して録画。フォント：IBM Plex Mono / SIL Open Font License。\n\n</details>\n`;
out=out.replace('交互の画面では','遊べる画面では');
fs.writeFileSync('README.md',out);
console.log('README: nine full-width scene demonstrations, six official headlines and AA chart.');
