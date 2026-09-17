// features/upload.js — 짤 올리기.
// 어디에 저장되는지는 core/api.js 의 store.addUpload 가 결정합니다
// (브라우저 저장 또는 POST /api/me/uploads).
import { $, esc, toast } from '../core/dom.js';
import { state } from '../core/state.js';
import { store } from '../core/api.js';
import { requireAuth } from './auth.js';
import { navigate } from './feed.js';

const TYPES = ['image/jpeg', 'image/png', 'image/gif'];
const MAX_BYTES = 10 * 1024 * 1024;

function validate() {
  $('submit').disabled = !(state.draft && $('desc').value.trim() && $('rights').checked);
}

export function cancelDraft() {
  state.draft = null;
  $('file').value = '';
  $('draft').hidden = true;
  $('drop').hidden = false;
  validate();
}

function readFile(f) {
  if (!TYPES.includes(f.type)) { toast('JPG, PNG, GIF 파일을 선택해주세요'); return; }
  if (f.size > MAX_BYTES) { toast('10MB 이하의 이미지를 선택해주세요'); return; }

  const r = new FileReader();
  r.onload = () => {
    const im = new Image();
    im.onload = () => {
      state.draft = { src: r.result, filename: f.name };
      $('preview').src = r.result;
      $('draft').hidden = false;
      $('drop').hidden = true;
      validate();
    };
    im.onerror = () => toast('이미지를 읽을 수 없어요. 다른 파일을 선택해주세요');
    im.src = r.result;
  };
  r.onerror = () => toast('파일을 읽지 못했어요');
  r.readAsDataURL(f);
}

async function submit(e) {
  e.preventDefault();
  if (!state.draft || !$('desc').value.trim() || !$('rights').checked) return;
  if (!requireAuth('짤을 올리려면 로그인이 필요해요.')) return;

  const name = $('desc').value.trim();
  const draft = {
    ...state.draft,
    id: Date.now(),
    name,
    cat: '직접 올림',
    tags: ['직접 올림'],
    kw: name.split(/\s+/),
    why: esc(name),
    art: `<img src="${state.draft.src}" alt="${esc(name)}">`,
  };

  const saved = await store.addUpload(draft);
  if (!saved) {
    toast('브라우저 저장 공간이 부족해요. 더 작은 이미지를 선택해주세요.');
    return;
  }
  state.mine.push(saved);

  cancelDraft();
  $('uploadform').reset();
  navigate('saved');
  // 올린 짤은 '내가 올린 짤'에 자동으로 모입니다. 저장함에 담을지는
  // 나중에 책갈피로 고르면 되므로 여기서 창을 띄우지 않습니다.
  toast('내 짤에 추가했어요');
}

export function initUpload() {
  $('file').onchange = e => { if (e.target.files[0]) readFile(e.target.files[0]); };
  $('desc').oninput = validate;
  $('rights').onchange = validate;
  ['dragover', 'drop'].forEach(type => $('drop').addEventListener(type, e => {
    e.preventDefault();
    if (type === 'drop' && e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);
  }));
  $('uploadform').onsubmit = submit;
}
