import {getApp,getApps,initializeApp} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';

const firebaseConfig={apiKey:'AIzaSyAs5ccEVy3TDJFSrVhLXPRQThrazTvQ1r4',authDomain:'moodnote-shop.firebaseapp.com',projectId:'moodnote-shop',storageBucket:'moodnote-shop.firebasestorage.app',messagingSenderId:'1053244872680',appId:'1:1053244872680:web:fbe52ffd5d9d1f4717f65d'};
const TOSS_CLIENT_KEY='test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
const app=getApps().length?getApp():initializeApp(firebaseConfig),auth=getAuth(app),functions=getFunctions(app,'asia-northeast3');
const prepareOrder=httpsCallable(functions,'prepareTossOrder',{timeout:30000}),confirmPayment=httpsCallable(functions,'confirmTossPayment',{timeout:30000});
const notify=message=>typeof window.toast==='function'?window.toast(message):alert(message);

function formAddress(form){return {recipient:form.elements.recipient.value.trim(),recipientPhone:form.elements.recipientPhone.value.trim(),zip:form.elements.zip.value.trim(),address:form.elements.address.value.trim(),address2:form.elements.address2.value.trim(),memo:form.elements.memo.value}}
function lineItems(){return window.moodnoteCheckoutLines?.()||[]}
function pendingKey(orderId){return `moodnote-guest-payment-${orderId}`}
function saveGuestAccess(orderId,token){localStorage.setItem(pendingKey(orderId),JSON.stringify({token,createdAt:Date.now()}))}
function readGuestAccess(orderId){try{const data=JSON.parse(localStorage.getItem(pendingKey(orderId)));if(!data?.token||Date.now()-data.createdAt>24*60*60*1000)return '';return data.token}catch{return ''}}
function clearGuestAccess(orderId){localStorage.removeItem(pendingKey(orderId))}
function errorMessage(error,fallback){const message=String(error?.message||'').replace('FirebaseError: ','').replace(/^\[[^\]]+\]\s*/,'');const code=String(error?.code||'');if(code.includes('deadline'))return '결제 서버 응답이 늦어지고 있어요. 잠시 후 다시 시도해주세요.';if(code.includes('unavailable'))return '결제 서버에 연결하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해주세요.';return message||fallback}
async function login(){if(auth.currentUser)return auth.currentUser;const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});return (await signInWithPopup(auth,provider)).user}
function chooseGuestPayment(){const dialog=document.getElementById('guest-payment-dialog');if(!dialog)return Promise.resolve('guest');return new Promise(resolve=>{let settled=false;const finish=choice=>{if(settled)return;settled=true;dialog.removeEventListener('click',click);dialog.removeEventListener('close',closed);if(dialog.open)dialog.close();resolve(choice)};const click=event=>{const button=event.target.closest('[data-guest-payment]');if(button)finish(button.dataset.guestPayment)};const closed=()=>finish('cancel');dialog.addEventListener('click',click);dialog.addEventListener('close',closed,{once:true});dialog.showModal()})}

async function start(form){
 const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='결제 준비 중…';
 try{
  let user=auth.currentUser,guest=false;
  if(!user){const choice=await chooseGuestPayment();if(choice==='cancel')return;if(choice==='login')user=await login();else guest=true}
  const address=formAddress(form);
  if(form.elements.saveDelivery?.checked&&user&&window.moodnoteData)await window.moodnoteData.saveAddress(address);
  const customInput=document.querySelector('[data-pet-photo]');
  if(guest&&customInput?.files?.length)throw new Error('사진을 올리는 커스텀 상품은 파일 보호를 위해 로그인 후 결제해주세요.');
  const customUploads=customInput?.files?.length?await window.moodnoteData.uploadCustomFiles(customInput.files):[];
  const customText=document.querySelector('[data-pet-name]')?.value.trim()||'';
  const payload={items:lineItems(),customer:form.elements.name.value.trim(),phone:form.elements.phone.value.trim(),email:form.elements.email.value.trim(),address,customUploads,customText,couponCode:window.currentCoupon||''};
  const result=(await prepareOrder(payload)).data;
  if(result.guestAccessToken)saveGuestAccess(result.orderId,result.guestAccessToken);
  if(typeof window.TossPayments!=='function')throw new Error('토스 결제 모듈을 불러오지 못했습니다. 페이지를 새로고침해주세요.');
  const customerKey=user?.uid||(window.TossPayments.ANONYMOUS||'ANONYMOUS');
  const widgets=window.TossPayments(TOSS_CLIENT_KEY).widgets({customerKey});
  const base=`${location.origin}${location.pathname}`;
  await widgets.setAmount({currency:'KRW',value:result.amount});
  const paymentWindow=await widgets.renderPaymentWindow({orderName:result.orderName});button.textContent='결제창에서 결제 진행 중…';
  paymentWindow.on('paymentRequest',async()=>{try{await widgets.requestPayment({orderId:result.orderId,orderName:result.orderName,successUrl:`${base}?payment=success`,failUrl:`${base}?payment=fail`,customerEmail:result.customerEmail,customerName:result.customerName,customerMobilePhone:form.elements.phone.value.replace(/\D/g,'')})}catch(error){console.error('Payment request failed',error);notify(errorMessage(error,'결제 요청을 완료하지 못했습니다.'));button.disabled=false;button.textContent=button.dataset.label||'토스로 결제하기';await paymentWindow.destroy().catch(()=>{})}});
  paymentWindow.on('cancel',()=>{button.disabled=false;button.textContent=button.dataset.label||'토스로 결제하기'});
 }catch(error){console.error('Payment start failed',error);if(!['auth/popup-closed-by-user','auth/cancelled-popup-request','USER_CANCEL'].includes(error.code))notify(errorMessage(error,'결제를 시작하지 못했습니다.'));button.disabled=false;button.textContent=button.dataset.label||'토스로 결제하기'}
 finally{if(button.isConnected&&button.disabled&&button.textContent==='결제 준비 중…'){button.disabled=false;button.textContent=button.dataset.label||'토스로 결제하기'}}
}

window.moodnotePayments={start};
const params=new URLSearchParams(location.search);
if(params.get('payment')==='success'){
 const paymentKey=params.get('paymentKey'),orderId=params.get('orderId'),amount=Number(params.get('amount')),guestToken=readGuestAccess(orderId);
 try{const result=(await confirmPayment({paymentKey,orderId,amount,guestToken})).data;clearGuestAccess(orderId);history.replaceState({},'',`${location.pathname}#checkout`);window.finishPaidOrder?.(result)}catch(error){console.error('Payment confirmation failed',error);history.replaceState({},'',`${location.pathname}#checkout`);window.showPaymentFailure?.(errorMessage(error,'결제 승인에 실패했습니다.'))}
}else if(params.get('payment')==='fail'){
 const message=params.get('message')||'결제가 취소되었습니다.';history.replaceState({},'',`${location.pathname}#checkout`);window.showPaymentFailure?.(message)
}
