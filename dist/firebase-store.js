import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { addDoc, collection, doc, getDoc, getFirestore, onSnapshot, query, serverTimestamp, setDoc, where } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js';

const config={apiKey:'AIzaSyAs5ccEVy3TDJFSrVhLXPRQThrazTvQ1r4',authDomain:'moodnote-shop.firebaseapp.com',projectId:'moodnote-shop',storageBucket:'moodnote-shop.firebasestorage.app',messagingSenderId:'1053244872680',appId:'1:1053244872680:web:fbe52ffd5d9d1f4717f65d'};
const app=getApps().length?getApp():initializeApp(config),auth=getAuth(app),db=getFirestore(app),storage=getStorage(app);
let userUnsubs=[];
window.moodnoteOrders=[];window.moodnoteProfile=null;
const emit=(name,detail)=>window.dispatchEvent(new CustomEvent(name,{detail}));
const clean=value=>Object.fromEntries(Object.entries(value).filter(([,item])=>item!==undefined));

onSnapshot(query(collection(db,'products'),where('saleStatus','==','판매 중'),where('searchVisible','==',true)),snapshot=>emit('moodnote-products',{products:snapshot.docs.map(row=>({id:row.id,...row.data()}))}),error=>console.error('Product sync failed',error));
onSnapshot(query(collection(db,'notices'),where('published','==',true)),snapshot=>emit('moodnote-notices',{notices:snapshot.docs.map(row=>({id:row.id,...row.data()}))}),error=>console.error('Notice sync failed',error));
onSnapshot(doc(db,'storefront','popup'),snapshot=>emit('moodnote-popup',{popup:snapshot.exists()?snapshot.data():null}),()=>emit('moodnote-popup',{popup:null}));

async function ensureProfile(user){const ref=doc(db,'users',user.uid),snapshot=await getDoc(ref),now=serverTimestamp();if(!snapshot.exists())await setDoc(ref,{uid:user.uid,displayName:user.displayName||'무드노트 회원',email:user.email||'',phone:'',news:false,createdAt:now,updatedAt:now});else await setDoc(ref,{displayName:user.displayName||snapshot.data().displayName,email:user.email||snapshot.data().email,updatedAt:now},{merge:true})}
onAuthStateChanged(auth,async user=>{userUnsubs.forEach(stop=>stop());userUnsubs=[];window.moodnoteOrders=[];window.moodnoteProfile=null;if(!user){emit('moodnote-orders',{orders:[]});emit('moodnote-profile',{profile:null});return}try{await ensureProfile(user);userUnsubs.push(onSnapshot(doc(db,'users',user.uid),snapshot=>{window.moodnoteProfile=snapshot.exists()?snapshot.data():null;emit('moodnote-profile',{profile:window.moodnoteProfile})}));userUnsubs.push(onSnapshot(query(collection(db,'orders'),where('userId','==',user.uid)),snapshot=>{window.moodnoteOrders=snapshot.docs.map(row=>({id:row.id,...row.data()})).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));emit('moodnote-orders',{orders:window.moodnoteOrders})}))}catch(error){console.error('Account sync failed',error)}});

window.moodnoteData={
 auth,db,
 async saveProfile(data){if(!auth.currentUser)throw new Error('login-required');await setDoc(doc(db,'users',auth.currentUser.uid),clean({...data,uid:auth.currentUser.uid,email:auth.currentUser.email,updatedAt:serverTimestamp()}),{merge:true})},
 async saveAddress(address){if(!auth.currentUser)throw new Error('login-required');await setDoc(doc(db,'users',auth.currentUser.uid),{address:clean(address),updatedAt:serverTimestamp()},{merge:true})},
 async removeAddress(){if(!auth.currentUser)throw new Error('login-required');await setDoc(doc(db,'users',auth.currentUser.uid),{address:{},updatedAt:serverTimestamp()},{merge:true})},
 async createQna(data){if(!auth.currentUser)throw new Error('login-required');const ref=doc(collection(db,'qna'));await setDoc(ref,{id:ref.id,userId:auth.currentUser.uid,productId:data.productId,product:data.product,title:data.title,content:data.content,secret:Boolean(data.secret),customer:auth.currentUser.displayName||'회원',status:'waiting',answer:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});return ref.id},
 async createReview(data){if(!auth.currentUser)throw new Error('login-required');const ref=doc(collection(db,'reviews'));await setDoc(ref,{id:ref.id,userId:auth.currentUser.uid,productId:data.productId,product:data.product,rating:Number(data.rating),text:data.text,customer:auth.currentUser.displayName||'회원',photo:false,image:'',reply:'',hidden:false,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});return ref.id}
 ,async uploadCustomFiles(files){if(!auth.currentUser)throw new Error('login-required');const batchId=crypto.randomUUID(),uploads=[];for(const file of [...files].slice(0,5)){if(file.size>10*1024*1024)throw new Error('이미지는 장당 10MB 이하만 업로드할 수 있습니다.');const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,'_'),target=ref(storage,`custom-orders/${auth.currentUser.uid}/${batchId}/${crypto.randomUUID()}-${safe}`);await uploadBytes(target,file,{contentType:file.type});uploads.push({name:file.name,url:await getDownloadURL(target),contentType:file.type,size:file.size})}return uploads}
};
emit('moodnote-data-ready',{auth,db});
