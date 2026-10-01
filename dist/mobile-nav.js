(()=>{
 const sheets={categories:document.querySelector('#mobile-category-sheet'),search:document.querySelector('#mobile-search-sheet')};
 const scrim=document.querySelector('#mobile-nav-scrim');
 const tabs=[...document.querySelectorAll('[data-mobile-tab]')];
 function setActive(name){tabs.forEach(tab=>tab.classList.toggle('active',tab.dataset.mobileTab===name))}
 function closeSheets(){Object.values(sheets).forEach(sheet=>{sheet.classList.remove('open');sheet.setAttribute('aria-hidden','true')});scrim.hidden=true;document.body.classList.remove('mobile-sheet-open');updateActive()}
 function openSheet(name){closeSheets();const sheet=sheets[name];if(!sheet)return;sheet.classList.add('open');sheet.setAttribute('aria-hidden','false');scrim.hidden=false;document.body.classList.add('mobile-sheet-open');setActive(name);if(name==='search')setTimeout(()=>document.querySelector('#mobile-search-input')?.focus(),180)}
 function updateActive(){const hash=location.hash||'#home';if(hash==='#mypage')return setActive('mypage');if(hash==='#catalog')return setActive('categories');setActive('home')}
 function runSearch(value){const query=String(value||'').trim();if(!query)return;const desktopInput=document.querySelector('#search-input');desktopInput.value=query;document.querySelector('#header-search').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));history.replaceState({},'', '#catalog');closeSheets();setActive('search')}
 document.addEventListener('click',event=>{
  const panelButton=event.target.closest('[data-mobile-panel]');if(panelButton){openSheet(panelButton.dataset.mobilePanel);return}
  if(event.target.closest('[data-mobile-close]')||event.target===scrim){closeSheets();return}
  const queryButton=event.target.closest('[data-mobile-query]');if(queryButton){runSearch(queryButton.dataset.mobileQuery);return}
  if(event.target.closest('.mobile-category-grid [data-filter]')){closeSheets();setActive('categories');return}
  const tab=event.target.closest('[data-mobile-tab]');if(tab&&!tab.dataset.mobilePanel)setTimeout(updateActive,0);
 });
 document.querySelector('#mobile-search-form')?.addEventListener('submit',event=>{event.preventDefault();runSearch(document.querySelector('#mobile-search-input').value)});
 window.addEventListener('popstate',updateActive);window.addEventListener('hashchange',updateActive);
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('mobile-sheet-open'))closeSheets()});
 updateActive();
})();
