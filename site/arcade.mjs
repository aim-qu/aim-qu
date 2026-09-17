export function initArcade(onChange){
  const root=document.querySelector('#arcade'),panes=[...root.querySelectorAll('.arcade-pane')],tabs=[...root.querySelectorAll('[data-arcade]')];
  let selected='lights',animation;
  function select(id){
    if(!['lights','memory'].includes(id))return;
    const previous=selected;selected=id;root.dataset.mode=id;
    tabs.forEach(tab=>{const current=tab.dataset.arcade===id;tab.setAttribute('aria-selected',String(current));tab.tabIndex=current?0:-1;});
    panes.forEach(pane=>{pane.hidden=pane.id!==id;pane.inert=pane.id!==id;});
    animation?.cancel();
    if(previous!==id&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!document.body.classList.contains('calm')){
      animation=document.getElementById(id).animate([{opacity:0,transform:`translateX(${id==='memory'?24:-24}px) scale(.985)`,filter:'blur(5px)'},{opacity:1,transform:'translateX(0) scale(1)',filter:'blur(0)'}],{duration:620,easing:'cubic-bezier(.16,1,.3,1)'});
    }
    if(previous!==id)onChange(id);
  }
  tabs.forEach(tab=>{
    tab.onclick=()=>select(tab.dataset.arcade);
    tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();const id=event.key==='Home'?'lights':event.key==='End'?'memory':selected==='lights'?'memory':'lights';select(id);tabs.find(t=>t.dataset.arcade===id).focus();};
  });
  select('lights');return {select,get selected(){return selected;}};
}
