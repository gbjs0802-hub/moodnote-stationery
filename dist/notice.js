(()=>{
 const defaults=[
  {id:'N2601001',type:'배송',title:'개천절 연휴 배송 일정 안내',content:'연휴 기간 택배사 휴무로 10월 5일부터 순차 출고됩니다. 주문 시 배송 일정을 확인해 주세요.',date:'2026. 10. 1.',views:128,published:true,pinned:true},
  {id:'N2600930',type:'이벤트',title:'무드노트 오픈 기념 첫 구매 혜택',content:'첫 주문 고객에게 상품 금액의 10% 할인 혜택을 드립니다.',date:'2026. 9. 30.',views:364,published:true,pinned:true},
  {id:'N2600929',type:'안내',title:'커스텀 스티커 주문 전 사진 확인사항',content:'얼굴과 전신이 선명하게 나온 고화질 사진을 권장합니다.',date:'2026. 9. 29.',views:215,published:true,pinned:false}
 ];
 const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
 let filter='all';
 function load(){try{return JSON.parse(localStorage.getItem('moodnote-notices-v1')||'null')||defaults}catch{return defaults}}
 function render(){const items=load().filter(item=>item.published&&(filter==='all'||item.type===filter)).sort((a,b)=>Number(b.pinned)-Number(a.pinned));document.querySelector('#public-notice-list').innerHTML=items.map(item=>`<details class="notice-card ${item.pinned?'pinned':''}"><summary><span class="notice-type">${escape(item.type)}</span><h2>${item.pinned?'<span class="pin">고정</span>':''}${escape(item.title)}</h2><time class="notice-date">${escape(item.date)}</time></summary><p class="notice-content">${escape(item.content)}</p></details>`).join('')||'<p class="notice-empty">등록된 공지사항이 없습니다.</p>'}
 document.addEventListener('click',event=>{const tab=event.target.closest('[data-type]');if(!tab)return;filter=tab.dataset.type;document.querySelectorAll('[data-type]').forEach(button=>button.classList.toggle('active',button===tab));render()});
 document.addEventListener('DOMContentLoaded',render);
})();
