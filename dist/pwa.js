let installPrompt;
const installButton=document.createElement('button');
installButton.type='button';
installButton.className='pwa-install-button';
installButton.innerHTML='<img src="assets/pwa-192.png" alt=""/><span><b>무드노트 앱</b><small>홈 화면에 설치하기</small></span><em>설치</em>';
installButton.hidden=true;
document.body.append(installButton);

if('serviceWorker' in navigator){
  window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(error=>console.warn('Service worker registration failed',error)));
}

window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  installPrompt=event;
  installButton.hidden=false;
});

installButton.addEventListener('click',async()=>{
  if(!installPrompt)return;
  installButton.disabled=true;
  await installPrompt.prompt();
  const choice=await installPrompt.userChoice;
  installPrompt=null;
  installButton.hidden=true;
  if(choice.outcome==='accepted'&&typeof window.toast==='function')window.toast('무드노트 앱을 설치했어요.');
});

window.addEventListener('appinstalled',()=>{
  installPrompt=null;
  installButton.hidden=true;
});
