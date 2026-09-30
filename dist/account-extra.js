function accountProfileKey(){return 'moodnote-profile-v1-'+(window.moodnoteUser?.uid||'guest')}
function accountProfile(){return load(accountProfileKey(),{})}
function renderAccountExtras(){
 const profile=accountProfile(),user=window.moodnoteUser;
 const stats=document.querySelector('.account-stats');
 stats.insertAdjacentHTML('afterbegin','<a href="#my-coupons" data-account-scroll="my-coupons"><strong>1</strong><span>쿠폰함</span></a>');
 document.querySelector('.account-note').insertAdjacentHTML('beforebegin',`<nav class="account-nav" aria-label="마이페이지 메뉴"><a href="#my-orders" data-account-scroll="my-orders">주문내역</a><a href="#my-coupons" data-account-scroll="my-coupons">쿠폰함</a><a href="#my-address" data-account-scroll="my-address">배송지 관리</a><a href="#my-profile" data-account-scroll="my-profile">회원정보 수정</a><a href="#my-favorites" data-account-scroll="my-favorites">찜한 상품</a></nav>`);
 if(profile.nickname)document.querySelector('.account-profile h2').textContent=profile.nickname+'님, 반가워요.';
 document.getElementById('my-orders').insertAdjacentHTML('beforebegin',`<section class="account-section" id="my-coupons"><div class="account-section-head"><h2>쿠폰함</h2><span>데모 혜택 1개</span></div><article class="account-coupon"><div><strong>10%</strong><h3>첫 구매 웰컴 할인</h3><p>최소 구매 금액 없이 상품 금액의 10% 할인<br/>배송비 제외 · 다른 할인과 중복 불가</p></div><div><span class="account-demo">데모 주문서 자동 적용</span><a href="#catalog" data-home class="outline-button">상품 구경하기</a></div></article><p class="delivery-note">현재 데모 주문에서는 주문마다 10% 할인이 자동 적용됩니다. 실제 발급·사용 이력·만료 처리는 제공하지 않습니다.</p></section>`);
 document.getElementById('my-favorites').insertAdjacentHTML('beforebegin',`<section class="account-section" id="my-profile"><div class="account-section-head"><h2>회원정보 수정</h2><span>${user?'Google 로그인':'비회원 설정'}</span></div><form id="account-profile-form" class="account-profile-form"><div class="form-grid"><label>닉네임<input name="nickname" maxlength="30" required value="${esc(profile.nickname||user?.displayName||'')}" placeholder="무드노트에서 사용할 이름"/></label><label>연락처<input name="profilePhone" type="tel" inputmode="tel" maxlength="20" pattern="(?:[0-9]{9,11}|[0-9]{2,3}-[0-9]{3,4}-[0-9]{4})" value="${esc(profile.phone||'')}" placeholder="010-0000-0000 (선택)"/></label><label class="wide">로그인 이메일<input type="email" value="${esc(user?.email||'')}" readonly placeholder="Google 로그인 후 표시됩니다"/></label></div><label class="profile-check"><input name="news" type="checkbox" ${profile.news?'checked':''}/> 새 상품·혜택 소식 받기 (선택 · 데모 설정)</label><p class="delivery-note">닉네임·연락처·수신 설정은 현재 계정별로 이 브라우저에만 저장됩니다. Google 계정 정보는 변경하지 않으며, 실제 알림을 발송하지 않습니다.</p><button type="submit" class="solid-button">정보 저장</button><span id="profile-save-status" role="status"></span></form></section>`);
 document.querySelector('#my-orders .account-section-head').insertAdjacentHTML('afterend','<label class="order-period">조회 기간<select id="order-period"><option value="all">전체 주문</option><option value="30">최근 1개월</option><option value="90">최근 3개월</option><option value="365">최근 1년</option></select></label><p id="order-filter-status" role="status" class="delivery-note"></p>');
 const orders=load(orderStorageKey(),[]);
 document.querySelectorAll('.account-order').forEach((el,index)=>{el.dataset.orderDate=orders[index].date;el.querySelector('footer').insertAdjacentHTML('beforebegin',`<details class="order-details"><summary>주문 상세정보</summary><p>상품 수량 ${orders[index].items.reduce((n,item)=>n+item.quantity,0)}개 · 주문번호 ${esc(orders[index].id)}</p><p>데모 주문 완료 상태입니다. 실제 결제, 배송 조회, 취소·환불은 제공하지 않습니다.</p></details>`)});
}
document.addEventListener('submit',event=>{
 if(event.target.id!=='account-profile-form')return;
 event.preventDefault();const form=event.target,nickname=form.elements.nickname.value.trim();
 form.elements.nickname.setCustomValidity(nickname?'':'닉네임을 입력해주세요.');if(!form.reportValidity())return;
 try{localStorage.setItem(accountProfileKey(),JSON.stringify({nickname,phone:form.elements.profilePhone.value.trim(),news:form.elements.news.checked}));document.querySelector('.account-profile h2').textContent=nickname+'님, 반가워요.';document.getElementById('profile-save-status').textContent='정보를 저장했어요.';toast('회원정보를 저장했습니다.')}catch{toast('저장하지 못했어요. 브라우저 저장 설정을 확인해주세요.')}
});
document.addEventListener('input',event=>{if(event.target.closest('#account-profile-form'))event.target.setCustomValidity?.('')});
document.addEventListener('change',event=>{
 if(event.target.id!=='order-period')return;
 const days=event.target.value;let count=0;
 document.querySelectorAll('.account-order').forEach(el=>{el.hidden=days!=='all'&&Date.now()-new Date(el.dataset.orderDate).getTime()>Number(days)*86400000;if(!el.hidden)count++});
 document.getElementById('order-filter-status').textContent=count?`${count}건의 주문을 확인할 수 있어요.`:'선택한 기간에 주문 내역이 없어요.';
});
