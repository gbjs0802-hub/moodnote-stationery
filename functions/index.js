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

const {makeCommerce,ValidationError}=require('./commerce');
const commerce=makeCommerce({db,FV:FieldValue,ErrorType:HttpsError,secret:()=>TOSS_SECRET_KEY.value()});
const guarded=handler=>async request=>{try{return await handler(request)}catch(error){if(error instanceof HttpsError)throw error;if(error instanceof ValidationError)throw new HttpsError('invalid-argument',error.message);console.error('Commerce operation failed',error);throw new HttpsError('internal','요청 결과를 확인하지 못했습니다. 잠시 후 다시 확인해주세요.');}};
exports.prepareTossOrder=onCall({region,invoker:'public'},guarded(async request=>{
 if(request.data?.action==='askMoodnote')return handleAskMoodnote(request);
 if(request.data?.action==='createSupportInquiry')return handleSupportInquiry(request);
 if(request.data?.action==='submitReview')return commerce.review(request);
 return commerce.prepare(request);
}));
exports.confirmTossPayment=onCall({region,invoker:'public',timeoutSeconds:90,secrets:[TOSS_SECRET_KEY]},guarded(commerce.confirm));
exports.adminOperations=onCall({region,invoker:'public',timeoutSeconds:90,secrets:[TOSS_SECRET_KEY]},guarded(commerce.admin));

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
  const shopSettings=await commerce.policy();
  const systemInstruction=`당신은 한국 문구 쇼핑몰 '무드노트'의 친절하고 간결한 AI 상담원입니다. 한국어 존댓말로 답하고 5문장 이내로 설명하세요. 아래 쇼핑몰 정보와 상품 목록만 사실로 사용하세요. 재고, 배송일, 할인, 주문 상태를 추측하지 마세요. 개인정보나 결제정보를 요구하지 마세요. 상품 추천·비교·탐색 질문에는 판매 상품 중 가장 관련 있는 상품 ID를 productIds에 1~3개 넣으세요. 배송, 결제, 운영시간처럼 상품 추천이 필요 없는 질문에는 productIds를 빈 배열로 두세요. productIds에는 목록에 표시된 ID만 정확히 사용하세요. 주문내역은 로그인 고객만 마이페이지에서 볼 수 있고, 비회원은 결제 완료 화면의 주문번호와 영수증을 보관해야 한다고 안내하세요. 결제는 현재 토스페이먼츠 테스트 결제이며 실제 청구되지 않습니다. 배송비는 상품 합계 ${shopSettings.freeShippingThreshold}원 이상 무료, 미만 ${shopSettings.shippingFee}원입니다. 운영시간은 ${shopSettings.hours}입니다. 출고 안내: ${shopSettings.dispatchDays}.\n\n판매 상품:\n${catalog.text||'현재 판매 상품 정보를 불러오지 못했습니다.'}`;
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
