import { getApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';

const TOSS_CLIENT_KEY='test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm';
const auth=getAuth(getApp()),functions=getFunctions(getApp(),'asia-northeast3');
const prepareOrder=httpsCallable(functions,'prepareTossOrder'),confirmPayment=httpsCallable(functions,'confirmTossPayment');
const notify=message=>typeof window.toast==='function'?window.toast(message):alert(message);

async function signedInUser(){if(auth.currentUser)return auth.currentUser;const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});return (await signInWithPopup(auth,provider)).user}
function formAddress(form){return {recipient:form.elements.recipient.value.trim(),recipientPhone:form.elements.recipientPhone.value.trim(),zip:form.elements.zip.value.trim(),address:form.elements.address.value.trim(),address2:form.elements.address2.value.trim(),memo:form.elements.memo.value}}
function lineItems(){return window.moodnoteCheckoutLines?.()||[]}

async function start(form){
 const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='토스 결제창 준비 중…';
 try{
  const user=await signedInUser(),address=formAddress(form);
  if(form.elements.saveDelivery?.checked&&window.moodnoteData)await window.moodnoteData.saveAddress(address);
  const customInput=document.querySelector('[data-pet-photo]'),customUploads=customInput?.files?.length?await window.moodnoteData.uploadCustomFiles(customInput.files):[];
  const customText=document.querySelector('[data-pet-name]')?.value.trim()||'';
  const result=(await prepareOrder({items:lineItems(),customer:form.elements.name.value.trim(),phone:form.elements.phone.value.trim(),address,customUploads,customText})).data;
  const tossPayments=TossPayments(TOSS_CLIENT_KEY),payment=tossPayments.payment({customerKey:user.uid});
  const base=`${location.origin}${location.pathname}`;
  await payment.requestPayment({method:'CARD',amount:{currency:'KRW',value:result.amount},orderId:result.orderId,orderName:result.orderName,successUrl:`${base}?payment=success`,failUrl:`${base}?payment=fail`,customerEmail:result.customerEmail,customerName:result.customerName});
 }catch(error){console.error(error);if(error.code!=='auth/popup-closed-by-user')notify(error.message?.replace('FirebaseError: ','')||'결제를 시작하지 못했습니다.');button.disabled=false;button.textContent=button.dataset.label||'토스로 결제하기'}
}

window.moodnotePayments={start};
const params=new URLSearchParams(location.search);
if(params.get('payment')==='success'){
 const paymentKey=params.get('paymentKey'),orderId=params.get('orderId'),amount=Number(params.get('amount'));
 try{await signedInUser();const result=(await confirmPayment({paymentKey,orderId,amount})).data;history.replaceState({},'',`${location.pathname}#checkout`);window.finishPaidOrder?.(result)}catch(error){console.error(error);history.replaceState({},'',`${location.pathname}#checkout`);window.showPaymentFailure?.(error.message?.replace('FirebaseError: ','')||'결제 승인에 실패했습니다.')}
}else if(params.get('payment')==='fail'){
 const message=params.get('message')||'결제가 취소되었습니다.';history.replaceState({},'',`${location.pathname}#checkout`);window.showPaymentFailure?.(message)
}
