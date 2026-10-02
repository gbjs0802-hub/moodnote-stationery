function inquiryListMarkup(){
 const inquiries=window.moodnoteUser?(window.moodnoteInquiries||[]):[];
 if(!inquiries.length)return '<div class="account-empty"><h3>등록한 1:1 문의가 없어요</h3><p>배송, 주문, 상품에 대해 궁금한 점을 남겨주세요.<br>답변이 등록되면 이곳에서 확인할 수 있어요.</p></div>';
 return inquiries.map(item=>`<details class="account-inquiry"><summary><div><span class="inquiry-status ${item.answer?'answered':''}">${item.answer?'답변 완료':'답변 대기'}</span><strong>${esc(item.title)}</strong><time>${esc(item.createdAt?.seconds?new Date(item.createdAt.seconds*1000).toLocaleDateString('ko-KR'):'접수 중')}</time></div><span aria-hidden="true">⌄</span></summary><div class="inquiry-content"><p>${esc(item.content)}</p>${item.answer?`<div class="inquiry-answer"><strong>무드노트의 답변</strong><p>${esc(item.answer)}</p></div>`:'<p class="delivery-note">문의 내용을 확인하고 있습니다. 조금만 기다려주세요.</p>'}</div></details>`).join('');
}
function renderInquiryPanel(){
 const panel=document.getElementById('account-panels'),user=window.moodnoteUser;
 panel.insertAdjacentHTML('beforeend',`<section class="account-section" id="my-inquiries" hidden><div class="account-section-head"><h2>1:1 문의</h2><a href="support.html#faq" class="inquiry-faq-link">자주 묻는 질문 →</a></div><p class="delivery-note">내 문의와 답변은 로그인한 계정에서만 볼 수 있어요.</p>${user?`<details class="inquiry-compose"><summary>새 문의 작성하기 <span aria-hidden="true">＋</span></summary><form id="account-inquiry-form" class="account-profile-form"><div class="form-grid"><label>문의 유형<select name="category" required><option>상품 문의</option><option>주문·결제</option><option>배송</option><option>교환·반품</option><option>기타</option></select></label><label>이름<input name="customer" required maxlength="40" value="${esc(accountProfile().displayName||user.displayName||'')}"/></label><label class="wide">이메일<input type="email" name="email" required readonly value="${esc(user.email||'')}"/></label><label class="wide">제목<input name="title" required maxlength="100" placeholder="무엇이 궁금하세요?"/></label><label class="wide">문의 내용<textarea name="content" required minlength="5" maxlength="2000" rows="6" placeholder="주문 문의라면 주문번호도 함께 적어주세요."></textarea></label></div><p class="delivery-note">이름과 이메일은 문의 확인 및 답변에 사용됩니다.</p><button type="submit" class="solid-button">문의 등록하기</button><p id="inquiry-status" role="status" aria-live="polite"></p></form></details><div id="account-inquiry-list">${inquiryListMarkup()}</div>`:'<div class="account-empty"><h3>로그인하고 문의를 남겨주세요</h3><p>내 계정에 문의와 답변을 보관할 수 있어요.</p><button class="outline-button" data-account-action="login">Google 로그인</button></div>'}</section>`);
}
document.addEventListener('submit',async event=>{
 if(event.target.id!=='account-inquiry-form')return;event.preventDefault();
 const form=event.target,button=form.querySelector('[type="submit"]'),status=form.querySelector('[role="status"]');
 if(!form.reportValidity())return;
 button.disabled=true;button.textContent='등록 중…';status.textContent='';
 try{
  if(!window.moodnoteData)throw new Error('로그인 연결을 확인한 뒤 다시 시도해주세요.');
  const result=await window.moodnoteData.createSupportInquiry(Object.fromEntries(new FormData(form)));
  form.elements.title.value='';form.elements.content.value='';status.textContent=`문의가 등록됐어요. 접수번호 ${result.inquiryId}`;toast('1:1 문의가 등록됐습니다.');
 }catch(error){status.textContent=error.message||'문의를 등록하지 못했습니다. 다시 시도해주세요.';}
 finally{button.disabled=false;button.textContent='문의 등록하기';}
});
window.addEventListener('moodnote-inquiries',event=>{
 const list=document.getElementById('account-inquiry-list');if(list)list.innerHTML=event.detail?.error?'<p role="status">문의를 불러오지 못했습니다. 잠시 후 새로고침해주세요.</p>':inquiryListMarkup();
});
