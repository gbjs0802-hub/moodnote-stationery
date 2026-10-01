const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {defineSecret}=require('firebase-functions/params');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');

initializeApp();
const db=getFirestore();
const TOSS_SECRET_KEY=defineSecret('TOSS_SECRET_KEY');
const region='asia-northeast3';

function text(value,max){return String(value||'').trim().slice(0,max)}
function assertAuth(request){if(!request.auth)throw new HttpsError('unauthenticated','Google 로그인이 필요합니다.');return request.auth}

exports.prepareTossOrder=onCall({region,invoker:'public'},async request=>{
  const auth=assertAuth(request),payload=request.data||{},requested=Array.isArray(payload.items)?payload.items:[];
  if(!requested.length||requested.length>50)throw new HttpsError('invalid-argument','주문 상품을 확인해주세요.');
  const items=[];
  for(const line of requested){
    const id=text(line.id,60),quantity=Math.max(1,Math.min(99,Math.floor(Number(line.quantity)||0))),snap=await db.collection('products').doc(id).get();
    if(!snap.exists)throw new HttpsError('not-found',`판매 중인 상품을 찾을 수 없습니다: ${id}`);
    const product=snap.data();
    if(product.saleStatus!=='판매 중'||product.searchVisible===false)throw new HttpsError('failed-precondition',`${product.name}은 현재 구매할 수 없습니다.`);
    if(Number(product.stock)<quantity)throw new HttpsError('failed-precondition',`${product.name}의 재고가 부족합니다.`);
    items.push({id,name:product.name,image:product.image,price:Number(product.price),quantity,option:text(line.option||'기본 옵션',100)});
  }
  const subtotal=items.reduce((sum,item)=>sum+item.price*item.quantity,0),shipping=subtotal>=30000?0:3000,total=subtotal+shipping;
  const orderId=`MN${new Date().toISOString().slice(2,10).replaceAll('-','')}-${crypto.randomUUID().replaceAll('-','').slice(0,12)}`;
  const customer=text(payload.customer,50),phone=text(payload.phone,30),email=text(auth.token.email,160),address=payload.address||{};
  if(!customer||!phone||!text(address.zip,10)||!text(address.address,200))throw new HttpsError('invalid-argument','주문자와 배송지 정보를 확인해주세요.');
  const customUploads=Array.isArray(payload.customUploads)?payload.customUploads.slice(0,5).map(file=>({name:text(file.name,120),url:text(file.url,1000),contentType:text(file.contentType,80),size:Number(file.size||0)})):[];
  const customText=text(payload.customText,100);
  const order={id:orderId,userId:auth.uid,userEmail:email,customer,phone,items,subtotal,shipping,discount:0,total,payment:'toss',status:'결제 요청',address:{zip:text(address.zip,10),address:text(address.address,200),address2:text(address.address2,200),recipient:text(address.recipient||customer,50),recipientPhone:text(address.recipientPhone||phone,30),memo:text(address.memo,300)},customUploads,customText,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()};
  await db.collection('orders').doc(orderId).create(order);
  return {orderId,amount:total,orderName:items.length>1?`${items[0].name} 외 ${items.length-1}건`:items[0].name,customerName:customer,customerEmail:email};
});

exports.confirmTossPayment=onCall({region,invoker:'public',secrets:[TOSS_SECRET_KEY]},async request=>{
  const auth=assertAuth(request),paymentKey=text(request.data?.paymentKey,200),orderId=text(request.data?.orderId,64),amount=Number(request.data?.amount);
  if(!paymentKey||!orderId||!Number.isInteger(amount))throw new HttpsError('invalid-argument','결제 승인 정보가 올바르지 않습니다.');
  const ref=db.collection('orders').doc(orderId),snap=await ref.get();
  if(!snap.exists)throw new HttpsError('not-found','주문을 찾을 수 없습니다.');
  const order=snap.data();
  if(order.userId!==auth.uid)throw new HttpsError('permission-denied','이 주문을 승인할 권한이 없습니다.');
  if(Number(order.total)!==amount)throw new HttpsError('failed-precondition','결제 금액이 주문 금액과 다릅니다.');
  if(order.status==='결제 완료')return {orderId,status:order.status,method:order.paymentMethod||'토스페이먼츠'};
  const authorization='Basic '+Buffer.from(`${TOSS_SECRET_KEY.value()}:`).toString('base64');
  const response=await fetch('https://api.tosspayments.com/v1/payments/confirm',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({paymentKey,orderId,amount})});
  const payment=await response.json();
  if(!response.ok){await ref.update({status:'결제 실패',paymentError:{code:text(payment.code,80),message:text(payment.message,300)},updatedAt:FieldValue.serverTimestamp()});throw new HttpsError('failed-precondition',payment.message||'결제 승인에 실패했습니다.');}
  await ref.update({status:'결제 완료',paymentKey:payment.paymentKey,paymentMethod:payment.method||'토스페이먼츠',approvedAt:payment.approvedAt||null,receiptUrl:payment.receipt?.url||null,updatedAt:FieldValue.serverTimestamp()});
  return {orderId,status:'결제 완료',method:payment.method||'토스페이먼츠',receiptUrl:payment.receipt?.url||null};
});
