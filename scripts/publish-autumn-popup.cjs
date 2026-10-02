const fs=require('node:fs'),path=require('node:path');
const cli=path.resolve(__dirname,'../../.firebase-cli/node_modules/firebase-tools');
const {getAccessToken}=require(path.join(cli,'lib/auth.js'));
const config=JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE,'.config/configstore/firebase-tools.json'),'utf8'));
const account=[{user:config.user,tokens:config.tokens},...(config.additionalAccounts||[])].find(a=>a.user?.email==='gogogen98@gmail.com');
if(!account)throw Error('Shop owner account is not connected');
(async()=>{
 const {access_token}=await getAccessToken(account.tokens.refresh_token,['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/firebase']);
 const url='https://firestore.googleapis.com/v1/projects/moodnote-shop/databases/(default)/documents/storefront/popup';
 const headers={Authorization:`Bearer ${access_token}`,'Content-Type':'application/json'};
 const before=await fetch(url,{headers});if(before.ok){fs.mkdirSync(path.resolve(__dirname,'../.codex'),{recursive:true});fs.writeFileSync(path.resolve(__dirname,'../.codex/popup-before-autumn.json'),JSON.stringify(await before.json(),null,2));}else if(before.status!==404)throw Error(`Popup lookup failed: ${before.status}`);
 const settings={adminName:'2026 가을 시즌 컬렉션',title:'가을 문구 꺼낼 시간',message:'단풍 스티커 한 장, 책 속 문장 한 줄.\n가을빛 문구로 오늘의 페이지를 채워보세요.',buttonLabel:'가을 컬렉션 구경하기',buttonLink:'#autumn',startDate:'2026-10-02',endDate:'2026-11-30',theme:'autumn',position:'center',enabled:true};
 const fields=Object.fromEntries(Object.entries(settings).map(([key,value])=>[key,typeof value==='boolean'?{booleanValue:value}:{stringValue:value}]));fields.updatedAt={timestampValue:new Date().toISOString()};
 const result=await fetch(url,{method:'PATCH',headers,body:JSON.stringify({fields})});if(!result.ok)throw Error(`Popup publish failed: ${result.status}`);
 console.log('Autumn campaign enabled: 2026-10-02 through 2026-11-30');
})().catch(error=>{console.error(error.message);process.exitCode=1});
