(function(root){
  'use strict';
  const empty=()=>({cart:{},selections:{},favorites:[]});
  const blankPatch=()=>({cart:{},selections:{},favorites:{}});
  const clone=value=>JSON.parse(JSON.stringify(value));
  const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);
  function clean(value={}){
    const state=empty();
    for(const [id,n] of Object.entries(value.cart||{}).slice(0,200))if(validId(id)&&Number(n)>0)state.cart[id]=Math.min(99,Math.floor(Number(n)));
    for(const [id,option] of Object.entries(value.selections||{}).slice(0,200))if(validId(id)&&typeof option==='string')state.selections[id]=option.slice(0,160);
    state.favorites=[...new Set((Array.isArray(value.favorites)?value.favorites:[]).filter(validId))].slice(0,200);
    return state;
  }
  function combine(a,b){return {cart:{...a.cart,...b.cart},selections:{...a.selections,...b.selections},favorites:{...a.favorites,...b.favorites}}}
  function apply(value,patch){
    const state=clean(value);
    for(const field of ['cart','selections'])for(const [id,v] of Object.entries(patch[field]||{}))if(validId(id)){if(v===null)delete state[field][id];else state[field][id]=v;}
    const favorites=new Set(state.favorites);
    for(const [id,selected] of Object.entries(patch.favorites||{}))if(validId(id)){if(selected)favorites.add(id);else favorites.delete(id);}
    state.favorites=[...favorites];return clean(state);
  }
  function diff(before,after){
    const patch=blankPatch();
    for(const field of ['cart','selections'])for(const id of new Set([...Object.keys(before[field]),...Object.keys(after[field])]))if(before[field][id]!==after[field][id])patch[field][id]=after[field][id]??null;
    for(const id of new Set([...before.favorites,...after.favorites]))if(before.favorites.includes(id)!==after.favorites.includes(id))patch.favorites[id]=after.favorites.includes(id);
    return patch;
  }
  const hasChanges=p=>Object.values(p).some(field=>Object.keys(field).length);
  function create({storage,onChange=()=>{},onError=()=>{}}){
    const key=uid=>'moodnote-shopping-v1:'+encodeURIComponent(uid||'guest');
    const read=k=>{try{return JSON.parse(storage.getItem(k))}catch{return null}};
    const write=(k,v)=>{try{storage.setItem(k,JSON.stringify(v))}catch(error){onError(error)}};
    let session=null,adapter=null;
    const persist=s=>write(key(s.uid),{state:s.state,pending:combine(s.inflight||blankPatch(),s.pending)});
    const publish=s=>{if(session===s)onChange(clone(s.state))};
    async function sync(s){
      if(!s.uid||!adapter||session!==s)return;
      if(s.work)return s.work;
      s.work=(async()=>{
        try{
          if(!s.loaded){const remote=await adapter.load(s.uid);if(session!==s)return;s.state=apply(remote||empty(),s.pending);s.loaded=true;persist(s);publish(s);}
          while(session===s&&hasChanges(s.pending)){
            const batch=s.pending;s.inflight=batch;s.pending=blankPatch();persist(s);
            try{const remote=await adapter.apply(s.uid,batch);if(session!==s)return;s.inflight=null;s.state=apply(remote,s.pending);persist(s);publish(s);}
            catch(error){s.pending=combine(batch,s.pending);s.inflight=null;if(session===s)persist(s);throw error;}
          }
        }catch(error){onError(error);throw error;}
        finally{s.work=null;}
      })();return s.work;
    }
    const background=s=>{if(s)sync(s).catch(()=>{})};
    return {
      get state(){return clone(session?.state||empty())},
      switchUser(uid){
        uid=uid||null;if(session?.uid===uid)return false;
        const previous=session;if(previous)persist(previous);
        let cache=read(key(uid));
        // A member's old browser-wide data is migrated only while that member is authenticated.
        if(!previous&&uid&&!cache&&!read('moodnote-shopping-legacy-migrated')){
          const legacy=clean({cart:read('moodnote-cart-v2')||{},selections:read('moodnote-options-v1')||{},favorites:read('moodnote-favorites-v2')||[]});
          cache={state:legacy,pending:diff(empty(),legacy)};write('moodnote-shopping-legacy-migrated',true);
        }
        if(!previous&&!uid)write('moodnote-shopping-legacy-migrated',true);
        // Signing out always starts a fresh guest basket; account caches remain intact.
        if(previous?.uid&&!uid)cache=null;
        session={uid,state:clean(cache?.state||{}),pending:cache?.pending||blankPatch(),inflight:null,loaded:false,work:null};
        if(!uid){session.state.favorites=[];session.pending=blankPatch();}
        persist(session);publish(session);background(session);return true;
      },
      save(value){
        if(!session)this.switchUser(null);
        const next=clean(value);if(!session.uid)next.favorites=[];
        session.pending=combine(session.pending,diff(session.state,next));session.state=next;persist(session);background(session);
      },
      connect(remote){adapter=remote;background(session)},
      async flush(){if(session)await sync(session)},
      retry(){background(session)}
    };
  }
  const api={create,clean,apply,diff};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MoodnoteShopping=api;
})(typeof window!=='undefined'?window:globalThis);
