const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.join(__dirname,'..'),source=fs.readFileSync(path.join(root,'dist','app.js'),'utf8');
const marker=source.indexOf('let products='),start=marker+'let products='.length,end=source.indexOf('];',start)+1;
if(marker<0||end<0)throw new Error('Product catalog was not found');
const products=vm.runInNewContext('('+source.slice(start,end).trim().replace(/;$/,'')+')');
const stock=[32,18,15,17,42,16,19,24,61,36,12,13,27,14,18,21,46,16,19,25,14,31,15,11,12,38,44,17,23,10,29,33,15,48,13,22,17,20];
const now=new Date().toISOString();
function value(v){if(v===null)return {nullValue:null};if(Array.isArray(v))return {arrayValue:{values:v.map(value)}};switch(typeof v){case'string':return {stringValue:v};case'number':return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};case'boolean':return {booleanValue:v};case'object':return {mapValue:{fields:Object.fromEntries(Object.entries(v).map(([k,x])=>[k,value(x)]))}};default:return {stringValue:String(v)}}}
const projectId=process.env.FIREBASE_PROJECT_ID||'moodnote-shop';
const writes=products.map((p,index)=>{const data={id:p.id,name:p.name,maker:p.maker,price:Number(p.price),originalPrice:Number(p.original||0),category:p.category,image:p.image,badge:p.badge||'',description:p.description||'',detail:p.detail||'',options:p.options||[p.option||'기본 옵션'],spec:p.spec||{},stock:stock[index%stock.length],saleStatus:'판매 중',searchVisible:true,featured:index<6,reviewEnabled:true,qnaEnabled:true,mood:p.mood||'natural',rating:Number(p.rating||0),reviews:Number(p.reviews||0),featuredRank:index,createdAt:now,updatedAt:now};const fields=Object.fromEntries(Object.entries(data).map(([k,v])=>[k,k.endsWith('At')?{timestampValue:v}:value(v)]));return {update:{name:`projects/${projectId}/databases/(default)/documents/products/${p.id}`,fields}}});
fs.mkdirSync(path.join(root,'.codex'),{recursive:true});fs.writeFileSync(path.join(root,'.codex','products-batch.json'),JSON.stringify({writes}));console.log(`Prepared ${writes.length} products`);
