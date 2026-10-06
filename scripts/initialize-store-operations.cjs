// Initialize only missing operating policy and the advertised welcome offer.
const fs=require('node:fs'),path=require('node:path');
const {defaults}=require('../functions/commerce');
const {getAccessToken}=require(path.resolve(__dirname,'../../.firebase-cli/node_modules/firebase-tools/lib/auth.js'));
const config=JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE,'.config/configstore/firebase-tools.json'),'utf8'));
const account=[{user:config.user,tokens:config.tokens},...(config.additionalAccounts||[])].find(a=>a.user?.email==='gogogen98@gmail.com');
if(!account)throw Error('Shop owner account is not connected');
function encode(value){if(typeof value==='boolean')return {booleanValue:value};if(typeof value==='number')return {integerValue:String(value)};return {stringValue:String(value)};}
(async()=>{const {access_token}=await getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);const headers={Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'},base='https://firestore.googleapis.com/v1/projects/moodnote-shop/databases/(default)/documents/';
 for(const [key,value] of [['storefront/public',defaults],['coupons/WELCOME10',{code:'WELCOME10',name:'첫 주문 10% 할인',type:'percent',value:10,minSpend:0,maxDiscount:0,firstOrder:true,enabled:true,startDate:'2026-10-06',endDate:'2027-12-31'}]]){const before=await fetch(base+key,{headers});if(before.ok){console.log(key+': existing data preserved');continue;}if(before.status!==404)throw Error('Cannot inspect '+key+': '+before.status);const fields=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,encode(v)]));fields.updatedAt={timestampValue:new Date().toISOString()};const result=await fetch(base+key+'?currentDocument.exists=false',{method:'PATCH',headers,body:JSON.stringify({fields})});if(!result.ok)throw Error('Cannot initialize '+key+': '+result.status);console.log(key+': initialized');}
})().catch(error=>{console.error(error.message);process.exitCode=1});
