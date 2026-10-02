// Add only the new summer catalog documents; never reseed or overwrite the shop's existing products.
const fs=require('node:fs'),path=require('node:path');
const products=require('./summer-products.json');
const project='moodnote-shop',email='gogogen98@gmail.com';
const cli=path.resolve(__dirname,'../../.firebase-cli/node_modules/firebase-tools');
const {getAccessToken}=require(path.join(cli,'lib/auth.js'));
const config=JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE,'.config/configstore/firebase-tools.json'),'utf8'));
const accounts=[{user:config.user,tokens:config.tokens},...(config.additionalAccounts||[])];
const account=accounts.find(a=>a.user?.email===email);if(!account)throw Error('Requested Firebase account is not connected');
const encode=v=>v===null?{nullValue:null}:Array.isArray(v)?{arrayValue:{values:v.map(encode)}}:typeof v==='object'?{mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,encode(x)]))}}:typeof v==='number'?{integerValue:String(v)}:typeof v==='boolean'?{booleanValue:v}:{stringValue:v};
(async()=>{
 const {access_token}=await getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
 const base=`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
 for(const [i,p] of products.entries()){
  const check=await fetch(`${base}/products/${p.id}`,{headers:{Authorization:`Bearer ${access_token}`}});
  if(check.ok){console.log(`${p.id}: already exists; kept unchanged`);continue;}if(check.status!==404)throw Error(`Catalog check failed (${check.status})`);
  const data={id:p.id,name:p.name,maker:p.maker,price:p.price,originalPrice:0,category:p.category,image:p.image,badge:p.badge,description:p.description,detail:p.detail,options:p.options,spec:p.spec,stock:0,saleStatus:'판매 중',searchVisible:true,featured:false,reviewEnabled:true,qnaEnabled:true,mood:'summer',featuredRank:38+i};
  const fields=Object.fromEntries(Object.entries(data).map(([k,v])=>[k,encode(v)])),now=new Date().toISOString();fields.createdAt={timestampValue:now};fields.updatedAt={timestampValue:now};
  const response=await fetch(`${base}/products?documentId=${p.id}`,{method:'POST',headers:{Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'},body:JSON.stringify({fields})});
  if(!response.ok)throw Error(`Catalog creation failed (${response.status}): ${await response.text()}`);console.log(`${p.id}: created (${p.price} KRW, inventory pending)`);
 }
})().catch(error=>{console.error(error.message);process.exitCode=1});
