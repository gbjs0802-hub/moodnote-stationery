// Local-only UI harness. It never signs in to Firebase or sends customer data.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../dist');
const fixture=`
window.addEventListener('DOMContentLoaded',()=>{
 const records={},inquiries={};
 window.moodnoteData={shopping:{load:async uid=>records[uid]||{},apply:async(uid,patch)=>(records[uid]=MoodnoteShopping.apply(records[uid]||{},patch))},createSupportInquiry:async data=>{const uid=window.moodnoteUser.uid;inquiries[uid]=[{...data,id:'QA-ONLY',answer:'',productId:'support',createdAt:{seconds:Date.now()/1000}}];window.moodnoteInquiries=inquiries[uid];window.dispatchEvent(new CustomEvent('moodnote-inquiries'));return {inquiryId:'QA-ONLY'}}};
 function switchUser(uid){window.moodnoteUser=uid?{uid,displayName:'검수 계정 '+uid,email:uid+'@example.test'}:null;window.moodnoteOrders=[];window.moodnoteProfile=null;window.moodnoteInquiries=inquiries[uid]||[];window.moodnoteAuthReady=true;window.dispatchEvent(new Event('moodnote-auth-change'));}
 const controls=document.createElement('div');controls.style='position:fixed;top:0;left:0;z-index:99999;background:#fff;padding:5px;border:2px solid #222';controls.innerHTML='<b>LOCAL TEST</b> <button id="qa-a">계정 A</button> <button id="qa-b">계정 B</button> <button id="qa-out">로그아웃 검수</button>';document.body.append(controls);
 document.getElementById('qa-a').onclick=()=>switchUser('account-a');document.getElementById('qa-b').onclick=()=>switchUser('account-b');document.getElementById('qa-out').onclick=async()=>{await window.moodnoteShopping.flush();switchUser(null)};
 window.dispatchEvent(new CustomEvent('moodnote-data-ready'));switchUser(null);
 if(location.search.includes('popup=1'))window.dispatchEvent(new CustomEvent('moodnote-popup',{detail:{popup:{enabled:true,adminName:'autumn-preview',title:'가을 문구 꺼낼 시간',message:'단풍 스티커 한 장, 책 속 문장 한 줄. 가을빛 문구로 오늘의 페이지를 채워보세요.',buttonLabel:'가을 컬렉션 구경하기',buttonLink:'#autumn',theme:'autumn'}}}));
});`;
http.createServer((req,res)=>{
 let pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/qa-fixture.js'){res.writeHead(200,{'Content-Type':'text/javascript'}).end(fixture);return;}
 const file=path.resolve(root,'.'+decodeURIComponent(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(file,(error,bytes)=>{if(error){res.writeHead(404).end();return;}const ext=path.extname(file);if(ext==='.html'){bytes=Buffer.from(bytes.toString().replace(/<script type="module"[^>]*><\/script>/g,'').replace(/<script src="pwa.js[^>]*><\/script>/,'').replace('</head>','<script src="/qa-fixture.js" defer></script></head>'));}res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[ext]||'application/octet-stream'}).end(bytes);});
}).listen(4174,'127.0.0.1',()=>console.log('Local account UI harness http://127.0.0.1:4174'));
