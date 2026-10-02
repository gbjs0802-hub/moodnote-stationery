const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {defineSecret}=require('firebase-functions/params');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {createHash,randomBytes}=require('crypto');
const {GoogleGenAI}=require('@google/genai');

initializeApp();
const db=getFirestore();
const TOSS_SECRET_KEY=defineSecret('TOSS_SECRET_KEY');
const region='asia-northeast3';

function text(value,max){return String(value||'').trim().slice(0,max)}
function digest(value){return createHash('sha256').update(String(value)).digest('hex')}
function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}

exports.prepareTossOrder=onCall({region,invoker:'public'},async request=>{
  const auth=request.auth||null,payload=request.data||{};
  if(payload.action==='askMoodnote')return handleAskMoodnote(request);
  if(payload.action==='createSupportInquiry')return handleSupportInquiry(request);
  const requested=Array.isArray(payload.items)?payload.items:[];
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
  const customer=text(payload.customer,50),phone=text(payload.phone,30),email=text(auth?.token?.email||payload.email,160),address=payload.address||{};
  if(!customer||!phone||!validEmail(email)||!text(address.zip,10)||!text(address.address,200))throw new HttpsError('invalid-argument','주문자, 이메일과 배송지 정보를 확인해주세요.');
  const customUploads=Array.isArray(payload.customUploads)?payload.customUploads.slice(0,5).map(file=>({name:text(file.name,120),url:text(file.url,1000),contentType:text(file.contentType,80),size:Number(file.size||0)})):[];
  const customText=text(payload.customText,100);
  const guestAccessToken=auth?'':randomBytes(24).toString('hex');
  const order={id:orderId,userId:auth?.uid||null,userEmail:email,guest:!auth,guestAccessHash:guestAccessToken?digest(guestAccessToken):null,customer,phone,items,subtotal,shipping,discount:0,total,payment:'toss',status:'결제 요청',address:{zip:text(address.zip,10),address:text(address.address,200),address2:text(address.address2,200),recipient:text(address.recipient||customer,50),recipientPhone:text(address.recipientPhone||phone,30),memo:text(address.memo,300)},customUploads,customText,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()};
  await db.collection('orders').doc(orderId).create(order);
  return {orderId,amount:total,orderName:items.length>1?`${items[0].name} 외 ${items.length-1}건`:items[0].name,customerName:customer,customerEmail:email,guestAccessToken};
});

exports.confirmTossPayment=onCall({region,invoker:'public',secrets:[TOSS_SECRET_KEY]},async request=>{
  const auth=request.auth||null,paymentKey=text(request.data?.paymentKey,200),orderId=text(request.data?.orderId,64),amount=Number(request.data?.amount),guestToken=text(request.data?.guestToken,100);
  if(!paymentKey||!orderId||!Number.isInteger(amount))throw new HttpsError('invalid-argument','결제 승인 정보가 올바르지 않습니다.');
  const ref=db.collection('orders').doc(orderId),snap=await ref.get();
  if(!snap.exists)throw new HttpsError('not-found','주문을 찾을 수 없습니다.');
  const order=snap.data();
  const ownerAllowed=order.userId?Boolean(auth&&order.userId===auth.uid):Boolean(guestToken&&order.guestAccessHash===digest(guestToken));
  if(!ownerAllowed)throw new HttpsError('permission-denied','이 주문을 승인할 권한이 없습니다.');
  if(Number(order.total)!==amount)throw new HttpsError('failed-precondition','결제 금액이 주문 금액과 다릅니다.');
  if(order.status==='결제 완료')return {orderId,status:order.status,method:order.paymentMethod||'토스페이먼츠',receiptUrl:order.receiptUrl||null,guest:Boolean(order.guest)};
  const authorization='Basic '+Buffer.from(`${TOSS_SECRET_KEY.value()}:`).toString('base64');
  const response=await fetch('https://api.tosspayments.com/v1/payments/confirm',{method:'POST',headers:{Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({paymentKey,orderId,amount})});
  const payment=await response.json();
  if(!response.ok){await ref.update({status:'결제 실패',paymentError:{code:text(payment.code,80),message:text(payment.message,300)},updatedAt:FieldValue.serverTimestamp()});throw new HttpsError('failed-precondition',payment.message||'결제 승인에 실패했습니다.');}
  await ref.update({status:'결제 완료',paymentKey:payment.paymentKey,paymentMethod:payment.method||'토스페이먼츠',approvedAt:payment.approvedAt||null,receiptUrl:payment.receipt?.url||null,updatedAt:FieldValue.serverTimestamp()});
  return {orderId,status:'결제 완료',method:payment.method||'토스페이먼츠',receiptUrl:payment.receipt?.url||null,guest:Boolean(order.guest)};
});

async function enforceAiRateLimit(request){
  const identity=request.auth?.uid||request.rawRequest?.ip||request.rawRequest?.headers?.['x-forwarded-for']||'anonymous';
  const ref=db.collection('_aiRateLimits').doc(digest(identity).slice(0,40)),now=Date.now(),minute=60*1000,day=24*60*60*1000;
  await db.runTransaction(async transaction=>{const snapshot=await transaction.get(ref),data=snapshot.exists?snapshot.data():{},minuteStart=Number(data.minuteStart||0),dayStart=Number(data.dayStart||0),minuteCount=now-minuteStart<minute?Number(data.minuteCount||0)+1:1,dayCount=now-dayStart<day?Number(data.dayCount||0)+1:1;if(minuteCount>12||dayCount>80)throw new HttpsError('resource-exhausted','상담 요청이 많습니다. 잠시 후 다시 시도해주세요.');transaction.set(ref,{minuteStart:now-minuteStart<minute?minuteStart:now,minuteCount,dayStart:now-dayStart<day?dayStart:now,dayCount,updatedAt:FieldValue.serverTimestamp()},{merge:true})});
}

let catalogCache={expires:0,text:'',products:[]};
async function catalogContext(){
  if(catalogCache.expires>Date.now())return catalogCache;
  const snapshot=await db.collection('products').where('saleStatus','==','판매 중').where('searchVisible','==',true).limit(60).get();
  const products=snapshot.docs.map(doc=>{const product=doc.data();return {id:text(product.id||doc.id,80),name:text(product.name,80),price:Number(product.price||0),image:text(product.image,500),category:text(product.category,30),options:(Array.isArray(product.options)?product.options:['기본 옵션']).slice(0,8).map(value=>text(value,40))}});
  const rows=products.map(product=>`- ID: ${product.id} | ${product.name} / ${product.price.toLocaleString('ko-KR')}원 / ${product.category} / 옵션: ${product.options.join(', ')}`);
  catalogCache={expires:Date.now()+5*60*1000,text:rows.join('\n'),products};return catalogCache;
}

async function handleAskMoodnote(request){
  await enforceAiRateLimit(request);
  const message=text(request.data?.message,500);if(!message)throw new HttpsError('invalid-argument','상담 내용을 입력해주세요.');
  const history=Array.isArray(request.data?.history)?request.data.history.slice(-6).map(item=>({role:item?.role==='model'?'model':'user',parts:[{text:text(item?.text,700)}]})).filter(item=>item.parts[0].text):[];
  const catalog=await catalogContext();
  const systemInstruction=`당신은 한국 문구 쇼핑몰 '무드노트'의 친절하고 간결한 AI 상담원입니다. 한국어 존댓말로 답하고 5문장 이내로 설명하세요. 아래 쇼핑몰 정보와 상품 목록만 사실로 사용하세요. 재고, 배송일, 할인, 주문 상태를 추측하지 마세요. 개인정보나 결제정보를 요구하지 마세요. 상품 추천·비교·탐색 질문에는 판매 상품 중 가장 관련 있는 상품 ID를 productIds에 1~3개 넣으세요. 배송, 결제, 운영시간처럼 상품 추천이 필요 없는 질문에는 productIds를 빈 배열로 두세요. productIds에는 목록에 표시된 ID만 정확히 사용하세요. 주문내역은 로그인 고객만 마이페이지에서 볼 수 있고, 비회원은 결제 완료 화면의 주문번호와 영수증을 보관해야 한다고 안내하세요. 결제는 현재 토스페이먼츠 테스트 결제이며 실제 청구되지 않습니다. 배송비는 상품 합계 30,000원 이상 무료, 미만 3,000원입니다. 운영시간은 평일 10:00~17:00, 주말·공휴일 휴무입니다.\n\n판매 상품:\n${catalog.text||'현재 판매 상품 정보를 불러오지 못했습니다.'}`;
  try{const ai=new GoogleGenAI({vertexai:true,project:process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT,location:'global'});const response=await ai.models.generateContent({model:'gemini-3.8-flash',contents:[...history,{role:'user',parts:[{text:message}]}],config:{systemInstruction,maxOutputTokens:2048,thinkingConfig:{thinkingLevel:'LOW'},responseMimeType:'application/json',responseJsonSchema:{type:'object',properties:{answer:{type:'string'},productIds:{type:'array',items:{type:'string'},maxItems:3}},required:['answer','productIds'],additionalProperties:false}}});const parsed=JSON.parse(response.text||'{}'),answer=text(parsed.answer,6000);if(!answer)throw new Error('empty-response');const ids=[...new Set(Array.isArray(parsed.productIds)?parsed.productIds.map(id=>text(id,80)):[])].slice(0,3),productMap=new Map(catalog.products.map(product=>[product.id,product]));const products=ids.map(id=>productMap.get(id)).filter(Boolean).map(({id,name,price,image})=>({id,name,price,image}));return {answer,products,model:'gemini-3.8-flash'}}catch(error){console.error('Gemini response failed',error);throw new HttpsError('unavailable','AI 상담 연결이 잠시 원활하지 않습니다. 잠시 후 다시 시도해주세요.')}
}
exports.askMoodnote=onCall({region,invoker:'public',timeoutSeconds:45,memory:'512MiB'},handleAskMoodnote);

async function handleSupportInquiry(request){
  const identity=request.auth?.uid||request.rawRequest?.ip||request.rawRequest?.headers?.['x-forwarded-for']||'anonymous',rateRef=db.collection('_supportRateLimits').doc(digest(identity).slice(0,40)),now=Date.now();
  await db.runTransaction(async transaction=>{const snapshot=await transaction.get(rateRef),data=snapshot.exists?snapshot.data():{},start=Number(data.start||0),count=now-start<60*60*1000?Number(data.count||0)+1:1;if(count>5)throw new HttpsError('resource-exhausted','문의 등록 횟수가 많습니다. 잠시 후 다시 시도해주세요.');transaction.set(rateRef,{start:now-start<60*60*1000?start:now,count,updatedAt:FieldValue.serverTimestamp()},{merge:true})});
  const payload=request.data||{},category=text(payload.category,30),customer=text(payload.customer,40),email=text(request.auth?.token?.email||payload.email,120),phone=text(payload.phone,30),title=text(payload.title,100),content=text(payload.content,2000);
  if(!['상품 문의','상품','주문·결제','배송','교환·반품','기타'].includes(category)||!customer||!validEmail(email)||!title||content.length<5)throw new HttpsError('invalid-argument','문의 내용을 다시 확인해주세요.');
  const ref=db.collection('qna').doc(),entry={id:ref.id,userId:request.auth?.uid||null,productId:'support',product:'고객센터 1:1 문의',title:`[${category}] ${title}`,content,secret:true,customer,email,phone,status:'waiting',answer:'',createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()};
  await ref.create(entry);return {inquiryId:ref.id.slice(0,8).toUpperCase()};
}
exports.createSupportInquiry=onCall({region,invoker:'public'},handleSupportInquiry);
