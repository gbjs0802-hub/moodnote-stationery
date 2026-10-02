import {getApp,getApps,initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';

const config={apiKey:'AIzaSyAs5ccEVy3TDJFSrVhLXPRQThrazTvQ1r4',authDomain:'moodnote-shop.firebaseapp.com',projectId:'moodnote-shop',storageBucket:'moodnote-shop.firebasestorage.app',messagingSenderId:'1053244872680',appId:'1:1053244872680:web:fbe52ffd5d9d1f4717f65d'};
const app=getApps().length?getApp():initializeApp(config);
const askMoodnote=httpsCallable(getFunctions(app,'asia-northeast3'),'prepareTossOrder',{timeout:30000});
const launcher=document.getElementById('ai-chat-launcher'),panel=document.getElementById('ai-chat-panel'),close=document.getElementById('ai-chat-close'),form=document.getElementById('ai-chat-form'),input=document.getElementById('ai-chat-input'),messages=document.getElementById('ai-chat-messages'),quick=document.getElementById('ai-chat-quick');
let busy=false,history=[];

function setOpen(open){panel.hidden=!open;launcher.setAttribute('aria-expanded',String(open));if(open)setTimeout(()=>input.focus(),30)}
function addMessage(role,text,loading=false){const row=document.createElement('div');row.className=`ai-message ${role}${loading?' loading':''}`;const bubble=document.createElement('p');if(loading)bubble.innerHTML='<i></i><i></i><i></i>';else bubble.textContent=text;row.appendChild(bubble);messages.appendChild(row);messages.scrollTop=messages.scrollHeight;return row}
function friendlyError(error){const code=String(error?.code||'');if(code.includes('resource-exhausted'))return '상담 요청이 많아요. 잠시 뒤 다시 물어봐 주세요.';if(code.includes('unavailable')||code.includes('deadline'))return '상담 연결이 잠시 느려졌어요. 조금 뒤 다시 시도해주세요.';return '지금은 답변을 불러오지 못했어요. 잠시 후 다시 시도해주세요.'}
async function send(text){const question=text.trim();if(!question||busy)return;busy=true;form.querySelector('button').disabled=true;addMessage('user',question);input.value='';const loader=addMessage('assistant','',true);try{const context=history.slice(-6);const response=await askMoodnote({action:'askMoodnote',message:question,history:context});const answer=response.data?.answer||'답변을 준비하지 못했어요.';loader.remove();addMessage('assistant',answer);history.push({role:'user',text:question},{role:'model',text:answer})}catch(error){console.error('AI 상담 오류',error);loader.remove();addMessage('assistant',friendlyError(error))}finally{busy=false;form.querySelector('button').disabled=false;input.focus()}}

launcher?.addEventListener('click',()=>setOpen(panel.hidden));close?.addEventListener('click',()=>setOpen(false));form?.addEventListener('submit',event=>{event.preventDefault();send(input.value)});input?.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();form.requestSubmit()}});quick?.addEventListener('click',event=>{const button=event.target.closest('button');if(button)send(button.textContent)});
