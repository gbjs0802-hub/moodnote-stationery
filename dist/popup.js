(()=>{
 const today=()=>new Date(Date.now()+9*60*60*1000).toISOString().slice(0,10);
 const escapeHTML=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
 const read=(storage,key)=>{try{return storage.getItem(key)}catch{return null}};
 const write=(storage,key,value)=>{try{storage.setItem(key,value)}catch{}};
 const campaignKey=settings=>'moodnote-popup-v4:'+encodeURIComponent([settings.adminName||settings.title,settings.startDate,settings.endDate].join('|'));
 const accountKey=settings=>window.moodnoteUser?.uid?campaignKey(settings)+':'+encodeURIComponent(window.moodnoteUser.uid):null;
 const safeLink=value=>{try{const url=new URL(value||'#catalog',location.href);return ['http:','https:'].includes(url.protocol)?value||'#catalog':'#catalog'}catch{return '#catalog'}};
 let currentSettings=null,dialog=null,previousFocus=null,previousOverflow='',dismissedOnPage=null,lastUserId=window.moodnoteUser?.uid||null;
 function eligible(settings){
  if(!window.moodnoteAuthReady||!settings?.enabled||['#checkout','#mypage'].includes(location.hash))return false;
  const date=today(),key=accountKey(settings);
  return dismissedOnPage!==campaignKey(settings)&&(!settings.startDate||date>=settings.startDate)&&(!settings.endDate||date<=settings.endDate)&&(!key||read(localStorage,key)!==date);
 }
 function close(remember=true){
  if(!dialog)return;
  if(remember){dismissedOnPage=dialog.dataset.campaign;const key=accountKey(currentSettings);if(key&&dialog.querySelector('[data-popup-daily]').checked)write(localStorage,key,today());}
  dialog.close();dialog.remove();dialog=null;document.body.style.overflow=previousOverflow;previousFocus?.focus({preventScroll:true});
 }
 function show(settings){
  if(dialog||!eligible(settings))return;
  const theme=['cherry','butter','sage','autumn'].includes(settings.theme)?settings.theme:'cherry',link=safeLink(settings.buttonLink);
  previousFocus=document.activeElement;previousOverflow=document.body.style.overflow;
  dialog=document.createElement('dialog');dialog.className='season-popup-dialog';dialog.dataset.campaign=campaignKey(settings);dialog.setAttribute('aria-labelledby','store-popup-title');dialog.setAttribute('aria-describedby','store-popup-message');
  dialog.innerHTML=`<article class="shop-popup theme-${theme}"><button type="button" class="shop-popup-close-x" data-popup-close aria-label="팝업 닫기">×</button><div class="shop-popup-body"><small>${theme==='autumn'?'MOODNOTE · AUTUMN COLLECTION':'WELCOME TO MOODNOTE'}</small><h2 id="store-popup-title">${escapeHTML(settings.title)}</h2><p id="store-popup-message">${escapeHTML(settings.message)}</p>${theme==='autumn'?'<div class="popup-season-products"><figure><img src="assets/product-reading-journal.png" alt="밤색 독서 저널"/><figcaption>가을 독서 저널</figcaption></figure><figure><img src="assets/product-autumn-sticker.png" alt="단풍과 도토리 가을 스티커"/><figcaption>단풍 스티커</figcaption></figure><figure><img src="assets/product-autumn-tape.png" alt="가을 패턴 마스킹테이프"/><figcaption>가을 마스킹테이프</figcaption></figure></div>':''}<a class="shop-popup-cta" href="${escapeHTML(link)}" data-popup-link ${link.startsWith('#')?'data-home':''}>${escapeHTML(settings.buttonLabel||'자세히 보기')} <span aria-hidden="true">→</span></a></div><div class="shop-popup-footer"><label><input type="checkbox" data-popup-daily/> 오늘 하루 보지 않기</label><button type="button" data-popup-close>닫기</button></div></article>`;
  const daily=dialog.querySelector('[data-popup-daily]');
  daily.disabled=!window.moodnoteUser;
  if(daily.disabled){daily.parentElement.append(' (로그인 필요)');daily.parentElement.title='로그인한 회원만 오늘 안 보기를 설정할 수 있습니다.';}
  document.body.append(dialog);dialog.showModal();document.body.style.overflow='hidden';
  dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
  dialog.addEventListener('click',event=>{if(event.target===dialog||event.target.closest('[data-popup-close],[data-popup-link]'))close()});
 }
 window.addEventListener('moodnote-popup',event=>{
  currentSettings=event.detail?.popup;
  if(dialog&&(!currentSettings?.enabled||dialog.dataset.campaign!==campaignKey(currentSettings)))close(false);
  show(currentSettings);
 });
 window.addEventListener('hashchange',()=>{if(['#checkout','#mypage'].includes(location.hash))close(false);else show(currentSettings)});
 window.addEventListener('moodnote-auth-change',()=>{
  const uid=window.moodnoteUser?.uid||null;
  if(uid!==lastUserId){close(false);dismissedOnPage=null;lastUserId=uid;}
  show(currentSettings);
 });
})();
