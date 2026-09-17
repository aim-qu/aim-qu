export function initNews(){
  const list=document.querySelector('#newsList');let payload;
  const date=value=>value?new Date(value).toLocaleDateString('ja-JP',{timeZone:'Asia/Tokyo'}):'日付なし';
  function render(source='all'){
    list.replaceChildren();const articles=(payload?.articles||[]).filter(item=>source==='all'||item.source===source);
    for(const item of articles){const a=document.createElement('a');a.className='news-item';a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';const meta=document.createElement('div');meta.className='news-meta';const from=document.createElement('span');from.textContent=item.source;const time=document.createElement('time');time.textContent=date(item.publishedAt);meta.append(from,time);const title=document.createElement('h2');title.textContent=item.title;const arrow=document.createElement('span');arrow.className='news-arrow';arrow.textContent='↗';a.append(meta,title,arrow);if(item.excerpt){const excerpt=document.createElement('p');excerpt.textContent=item.excerpt;a.append(excerpt);}list.append(a);}
    if(!articles.length){const p=document.createElement('p');p.textContent='保存されたニュースはありません。公式ページから確認できます。';list.append(p);}
  }
  fetch('assets/news.json').then(r=>{if(!r.ok)throw Error(r.status);return r.json();}).then(data=>{payload=data;document.querySelector('#newsTimestamp').textContent='取得 '+new Date(data.fetchedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo'})+' JST';render();}).catch(()=>render());
  document.querySelectorAll('[data-news-source]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-news-source]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render(button.dataset.newsSource);});
}
