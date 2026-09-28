import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyC6lDHybaJOsRl6ObOzr6y5jeWZzKDYv7U',
  authDomain: 'moodnote-stationery.firebaseapp.com',
  projectId: 'moodnote-stationery',
  storageBucket: 'moodnote-stationery.firebasestorage.app',
  messagingSenderId: '742047211938',
  appId: '1:742047211938:web:7dd10b04862d3bce7ad2fb'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

const area = document.getElementById('auth-area');
const button = document.getElementById('auth-button');
const avatar = document.getElementById('auth-avatar');
const label = document.getElementById('auth-label');
const popover = document.getElementById('auth-popover');
const photo = document.getElementById('auth-photo');
const name = document.getElementById('auth-name');
const email = document.getElementById('auth-email');
const logout = document.getElementById('auth-logout');

let currentUser = null;

function notify(message) {
  if (typeof window.toast === 'function') {
    window.toast(message);
    return;
  }
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function setBusy(busy) {
  button.disabled = busy;
  button.classList.toggle('loading', busy);
  if (busy) label.textContent = '로그인 중…';
}

function closePopover() {
  popover.hidden = true;
  button.setAttribute('aria-expanded', 'false');
}

function renderUser(user) {
  currentUser = user;
  button.disabled = false;
  button.classList.remove('loading');

  if (!user) {
    area.classList.remove('signed-in');
    avatar.textContent = 'G';
    avatar.style.backgroundImage = '';
    label.textContent = 'Google 로그인';
    closePopover();
    return;
  }

  area.classList.add('signed-in');
  label.textContent = user.displayName || '내 계정';
  avatar.textContent = user.photoURL ? '' : (user.displayName || user.email || 'M').slice(0, 1).toUpperCase();
  avatar.style.backgroundImage = user.photoURL ? `url("${user.photoURL.replaceAll('"', '%22')}")` : '';
  name.textContent = user.displayName || '무드노트 회원';
  email.textContent = user.email || '';
  photo.hidden = !user.photoURL;
  if (user.photoURL) photo.src = user.photoURL;
}

button.addEventListener('click', async () => {
  if (currentUser) {
    const willOpen = popover.hidden;
    popover.hidden = !willOpen;
    button.setAttribute('aria-expanded', String(willOpen));
    return;
  }

  setBusy(true);
  try {
    await signInWithPopup(auth, provider);
    notify('Google 로그인이 완료되었습니다.');
  } catch (error) {
    if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
      console.error('Google sign-in failed', error);
      notify(error.code === 'auth/popup-blocked' ? '팝업을 허용한 뒤 다시 로그인해주세요.' : '로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
    renderUser(auth.currentUser);
  }
});

logout.addEventListener('click', async () => {
  try {
    await signOut(auth);
    notify('로그아웃되었습니다.');
  } catch (error) {
    console.error('Sign-out failed', error);
    notify('로그아웃에 실패했습니다. 다시 시도해주세요.');
  }
});

document.addEventListener('click', event => {
  if (!area.contains(event.target)) closePopover();
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closePopover();
});

onAuthStateChanged(auth, renderUser);
