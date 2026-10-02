const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync('dist/popup.js','utf8');
const settings={enabled:true,adminName:'test',title:'가을',theme:'autumn',startDate:'2026-10-01',endDate:'2026-11-30'};
const storage=new Map();let date='2026-10-02T12:00:00Z';
function page(uid=null,ready=true){
 const events={},window={moodnoteAuthReady:ready,moodnoteUser:uid?{uid}:null,addEventListener:(name,cb)=>events[name]=cb};
 let shown=null;
 const document={activeElement:{focus(){}},body:{style:{overflow:''},append(el){shown=el}},createElement(){const e={dataset:{},events:{},daily:{checked:false,disabled:false,parentElement:{append(){}}},setAttribute(){},querySelector(){return this.daily},showModal(){},close(){},remove(){shown=null},addEventListener(name,cb){this.events[name]=cb}};return e}};
 class Clock extends Date{static now(){return new Date(date).getTime()}}
 vm.runInNewContext(code,{window,document,Date:Clock,URL,location:{hash:'#home',href:'http://localhost/'},localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)}});
 return {get dialog(){return shown},popup(){events['moodnote-popup']({detail:{popup:settings}})},close(checked=false){shown.daily.checked=checked;shown.events.click({target:{closest:()=>true}})},auth(uid){window.moodnoteAuthReady=true;window.moodnoteUser=uid?{uid}:null;events['moodnote-auth-change']()}};
}
let p=page();p.popup();assert.ok(p.dialog);assert.equal(p.dialog.daily.disabled,true);p.close(true);assert.equal(storage.size,0);p.popup();assert.equal(p.dialog,null);
p=page();p.popup();assert.ok(p.dialog);p.close();
p=page('member-a');p.popup();assert.ok(p.dialog);assert.equal(p.dialog.daily.disabled,false);p.close();
p=page('member-a');p.popup();assert.ok(p.dialog);p.close(true);assert.equal(storage.size,1);
p=page('member-a');p.popup();assert.equal(p.dialog,null);p.auth(null);assert.ok(p.dialog);p.close();
p=page('member-b');p.popup();assert.ok(p.dialog);
p=page('member-a',false);p.popup();assert.equal(p.dialog,null);p.auth('member-a');assert.equal(p.dialog,null);
date='2026-10-03T12:00:00Z';p=page('member-a');p.popup();assert.ok(p.dialog);
console.log('PASS: guest refresh; unchecked member refresh; account-scoped daily hide; logout; account switch; auth loading; next-day expiry');
