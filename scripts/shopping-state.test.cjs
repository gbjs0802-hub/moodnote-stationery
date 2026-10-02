const test=require('node:test'),assert=require('node:assert/strict');
const {create,apply}=require('../dist/shopping-state.js');
const empty=()=>({cart:{},selections:{},favorites:[]});
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
const state=(id,n=1)=>({cart:{[id]:n},selections:{[id]:'블루'},favorites:[id]});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return {promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('logout hides both lists, same account restores, other accounts remain isolated',async()=>{
 const storage=memory(),client=create({storage});client.switchUser('alice');client.save(state('pen',2));client.switchUser(null);assert.deepEqual(client.state,empty());
 client.switchUser('bob');assert.deepEqual(client.state,empty());client.save(state('memo'));client.switchUser('alice');assert.deepEqual(client.state,state('pen',2));
 client.switchUser(null);const reload=create({storage});reload.switchUser(null);assert.deepEqual(reload.state,empty());
});
test('guest cart survives guest refresh but does not enter a member account',()=>{
 const storage=memory(),client=create({storage});client.switchUser(null);client.save(state('guest'));
 const reload=create({storage});reload.switchUser(null);assert.deepEqual(reload.state.cart,{guest:1});assert.deepEqual(reload.state.favorites,[]);
 reload.switchUser('alice');assert.deepEqual(reload.state,empty());reload.switchUser(null);assert.deepEqual(reload.state,empty());
});
test('late account load cannot repopulate logged-out screen',async()=>{
 const wait=deferred(),client=create({storage:memory()});client.connect({load:()=>wait.promise,apply:()=>{throw Error('unexpected write')}});client.switchUser('alice');client.switchUser(null);wait.resolve(state('secret'));await tick();assert.deepEqual(client.state,empty());
});
test('edits made while cloud loads merge without deleting existing cloud items',async()=>{
 const wait=deferred(),remote=state('existing'),client=create({storage:memory()});let stored=remote;
 client.connect({load:()=>wait.promise,apply:async(_,patch)=>(stored=apply(stored,patch))});client.switchUser('alice');client.save(state('new'));wait.resolve(remote);await client.flush();
 assert.deepEqual(stored.cart,{existing:1,new:1});assert.deepEqual(client.state.cart,stored.cart);
});
test('newer edits while saving are flushed last, including removals',async()=>{
 const wait=deferred(),client=create({storage:memory()});let stored=empty(),writes=0;
 client.connect({load:async()=>stored,apply:async(_,patch)=>{writes++;if(writes===1)await wait.promise;stored=apply(stored,patch);return stored;}});client.switchUser('alice');await client.flush();client.save(state('pen',2));await tick();client.save(empty());wait.resolve();await client.flush();assert.deepEqual(stored,empty());assert.equal(writes,2);
});
test('offline changes remain in account cache and retry on next login',async()=>{
 const storage=memory(),client=create({storage});client.connect({load:async()=>{throw Error('offline')}});client.switchUser('alice');client.save(state('pen'));await assert.rejects(client.flush());client.switchUser(null);
 let stored=empty();const reload=create({storage});reload.connect({load:async()=>stored,apply:async(_,patch)=>(stored=apply(stored,patch))});reload.switchUser('alice');await reload.flush();assert.deepEqual(stored,state('pen'));
});
test('cloud restoration works on a different device and repeated auth is harmless',async()=>{
 const client=create({storage:memory()});client.connect({load:async()=>state('diary'),apply:async()=>{throw Error('unexpected write')}});client.switchUser('alice');await client.flush();assert.deepEqual(client.state,state('diary'));assert.equal(client.switchUser('alice'),false);assert.deepEqual(client.state,state('diary'));
});
test('migration never shows the legacy member lists while logged out',()=>{
 const storage=memory();storage.setItem('moodnote-cart-v2',JSON.stringify({legacy:1}));storage.setItem('moodnote-favorites-v2',JSON.stringify(['legacy']));const client=create({storage});client.switchUser(null);assert.deepEqual(client.state,empty());client.switchUser('new-user');assert.deepEqual(client.state,empty());
 const memberStorage=memory();memberStorage.setItem('moodnote-cart-v2',JSON.stringify({legacy:1}));const member=create({storage:memberStorage});member.switchUser('existing-user');assert.deepEqual(member.state.cart,{legacy:1});
});
