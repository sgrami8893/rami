// 모바일 지도 기반 화면(2026-11-27 사용자 '모바일 화면도 지도 기반이면', 제미나이 12:40 합의).
// 전월세·주차장 찾는 화면(폭 1023px 이하)에서: 지도가 화면 전체, 본문(#main)은 아래에서 끌어 올리는 시트.
// - 3단: 접힘(한 줄 답) · 반(답 카드까지) · 펼침(머리줄 아래 전체). 처음: 목록 단계는 접힘, 동·상세는 반.
// - 손잡이: 끌기 + 버튼(누르면 접힘→반→펼침→접힘, Enter/Space). 본문을 끌면 접힘·반에선 시트가 움직이고,
//   펼침에선 내용이 맨 위일 때 아래로 끄는 것만 시트(그 밖엔 내용 스크롤).
// - 본문 HTML·순서는 그대로(검색엔진·화면 읽기 프로그램은 지금과 같게 읽는다). 겉모습과 높이만 바뀐다.
// - 지도는 시트 위로 보이는 칸에 맞춘다(--shm). 시트가 멈출 때마다 지도 크기를 다시 재고, 고른 동·핀이 보이게 옮긴다.
import { LG, reduced } from './base.ts';

export type SheetState = 'peek' | 'half' | 'full' | 'card';
const ORDER: SheetState[] = ['peek', 'half', 'full'];
const HEAD = 52; // 모바일 머리줄 높이(global.css .v-hd)

export const sheetOn = () => document.documentElement.classList.contains('msheet');
export const sheetWanted = () => !LG.matches && ['rent', 'parking'].includes(document.documentElement.dataset.tool ?? '');

type Opts = { signal: AbortSignal; settle: (s: SheetState) => void; initial: () => SheetState };

export function mountSheet(o: Opts) {
  const html = document.documentElement;
  const sig = { signal: o.signal };
  let state: SheetState = 'peek';
  let before: SheetState = 'peek'; // 카드를 닫으면 돌아갈 단
  const main = () => document.getElementById('main')!;
  const bb = () => (document.querySelector<HTMLElement>('#v-bottom [data-bottom-bar]')?.offsetHeight ?? 0);

  const heights = () => {
    const vh = innerHeight, b = bb();
    const peekEl = main().querySelector<HTMLElement>('.sh-peek');
    const peek = Math.min(Math.round(vh * 0.32), 44 + (peekEl?.offsetHeight ?? 76));
    const full = vh - HEAD - 8 - b;
    return { peek, half: Math.min(full, Math.max(peek + 120, Math.round(vh * 0.5) - b)), full, card: 0 } as Record<SheetState, number>;
  };

  // 손잡이·한 줄 답을 본문 맨 앞에 넣는다(화면 이동으로 본문이 바뀌면 다시)
  const decorate = () => {
    const m = main();
    if (!m.querySelector(':scope > .sh-handle')) {
      const h = document.createElement('button');
      h.type = 'button'; h.className = 'sh-handle'; h.setAttribute('aria-controls', 'main');
      h.innerHTML = '<i aria-hidden="true"></i>';
      m.prepend(h);
      const p = document.createElement('div');
      p.className = 'sh-peek'; p.setAttribute('aria-hidden', 'true');
      h.after(p);
    }
    fillPeek();
  };
  const fillPeek = () => {
    const p = main().querySelector<HTMLElement>('.sh-peek');
    if (!p) return;
    const h1 = main().querySelector('h1')?.textContent?.trim() ?? '';
    // 지금 보이는 답 칸 첫 값(전월세는 고른 종류의 전세 중위, 주차장은 전체 곳 수)
    const cell = [...main().querySelectorAll<HTMLElement>('.v-ans .k')].find((k) => k.getClientRects().length > 0);
    const k = cell?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    const v = cell?.nextElementSibling?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    p.innerHTML = '';
    const a = document.createElement('p'); a.className = 'sh-peek-t'; a.textContent = h1; p.append(a);
    if (k && v && v !== '-') { const b = document.createElement('p'); b.className = 'sh-peek-v'; b.innerHTML = '<span></span> <b></b>'; b.querySelector('span')!.textContent = k; b.querySelector('b')!.textContent = v; p.append(b); }
    const u = document.createElement('p'); u.className = 'sh-peek-u'; u.textContent = '위로 올리면 자세히 볼 수 있어요'; p.append(u);
  };

  const label = () => {
    const h = main().querySelector<HTMLButtonElement>('.sh-handle');
    if (!h) return;
    h.setAttribute('aria-expanded', String(state === 'full'));
    h.setAttribute('aria-label', state === 'full' ? '목록 접기' : state === 'half' ? '목록 더 펼치기' : '목록 펼치기');
  };

  let settleT = 0;
  const set = (s: SheetState, animate = true) => {
    if (s !== 'card' && state !== 'card') before = s;
    state = s;
    html.dataset.sheet = s; // 높이 재기 전에(접힘 한 줄 답은 이 값이 있어야 보인다)
    const H = heights();
    html.style.setProperty('--sh', `${H[s]}px`);
    html.style.setProperty('--bb', `${bb()}px`);
    // 지도 칸: 펼침·카드에선 그대로(지도는 시트 뒤에 있거나 카드가 덮는다)
    if (s !== 'full' && s !== 'card') html.style.setProperty('--shm', `${H[s] + bb()}px`);
    label();
    clearTimeout(settleT);
    settleT = window.setTimeout(() => o.settle(s), animate && !reduced() ? 240 : 0);
  };

  const on = () => {
    html.classList.add('msheet');
    decorate();
    set(o.initial(), false);
  };
  const off = () => {
    html.classList.remove('msheet', 'sh-drag');
    delete html.dataset.sheet;
    main().querySelectorAll(':scope > .sh-handle, :scope > .sh-peek').forEach((e) => e.remove());
  };
  if (sheetWanted()) on();
  LG.addEventListener('change', () => { if (sheetWanted()) on(); else off(); }, sig);
  addEventListener('resize', () => { if (sheetOn()) set(state, false); }, { passive: true, ...sig });

  // ---- 손잡이 버튼 ----
  document.addEventListener('click', (e) => {
    if (!sheetOn() || !(e.target as Element).closest?.('#main > .sh-handle')) return;
    if (dragged) return;
    const i = ORDER.indexOf(state === 'card' ? before : state);
    set(ORDER[(i + 1) % ORDER.length]);
  }, sig);
  // 키보드(Tab)로 본문 안(위치 줄·손잡이 밖)에 들어가면 펼쳐서 보이게. 터치·스크립트가 옮긴 초점은 그대로
  let kb = false;
  document.addEventListener('keydown', (e) => { if (e.key === 'Tab') kb = true; }, sig);
  document.addEventListener('pointerdown', () => { kb = false; }, sig);
  document.addEventListener('focusin', (e) => {
    if (!sheetOn() || state === 'full' || !kb) return;
    const t = e.target as Element;
    if (!t.closest?.('#main') || t.closest('.sh-handle, .v-place')) return;
    set('full');
  }, sig);

  // ---- 끌기 ----
  let from: SheetState = 'peek';
  let y0 = 0, x0 = 0, h0 = 0, t0 = 0, mode: '' | 'wait' | 'drag' | 'scroll' = '', dragged = false, lastY = 0, lastT = 0, v = 0;
  const start = (e: TouchEvent) => {
    if (!sheetOn() || state === 'card' || e.touches.length !== 1) return;
    const t = e.target as Element;
    if (!t.closest?.('#main') || t.closest('.v-place')) return;
    y0 = lastY = e.touches[0].clientY; x0 = e.touches[0].clientX; t0 = lastT = performance.now();
    h0 = main().getBoundingClientRect().height; from = state; mode = 'wait'; dragged = false; v = 0;
  };
  const move = (e: TouchEvent) => {
    if (!mode || mode === 'scroll') return;
    const y = e.touches[0].clientY, dy = y - y0, dx = e.touches[0].clientX - x0;
    if (mode === 'wait') {
      if (Math.abs(dy) < 6 && Math.abs(dx) < 6) return;
      const onHandle = !!(e.target as Element).closest?.('.sh-handle, .sh-peek');
      const vertical = Math.abs(dy) > Math.abs(dx);
      const atTop = main().scrollTop <= 0;
      if (!vertical) { mode = 'scroll'; return; }
      if (onHandle || state !== 'full' || (atTop && dy > 0)) { mode = 'drag'; html.classList.add('sh-drag'); }
      else { mode = 'scroll'; return; }
    }
    e.preventDefault();
    dragged = true;
    const now = performance.now();
    v = (y - lastY) / Math.max(1, now - lastT); lastY = y; lastT = now;
    const H = heights();
    const h = Math.max(H.peek - 30, Math.min(H.full, h0 - dy));
    html.style.setProperty('--sh', `${h}px`);
  };
  const end = () => {
    if (mode !== 'drag') { mode = ''; return; }
    mode = '';
    html.classList.remove('sh-drag');
    const H = heights();
    const h = main().getBoundingClientRect().height;
    let next: SheetState;
    if (Math.abs(v) > 0.5) {
      // 빠르게 튕기면 그 방향 다음 단
      // 빠르게 튕기면 끌기 시작한 단의 바로 다음 단(접힘에서 위로 튕기면 반)
      const i = ORDER.indexOf(from);
      next = ORDER[Math.max(0, Math.min(2, i + (v < 0 ? 1 : -1)))];
    } else {
      next = ORDER.reduce((a, b) => (Math.abs(H[b] - h) < Math.abs(H[a] - h) ? b : a));
    }
    set(next);
    setTimeout(() => { dragged = false; }, 50);
  };
  document.addEventListener('touchstart', start, { passive: true, ...sig });
  document.addEventListener('touchmove', move, { passive: false, ...sig });
  document.addEventListener('touchend', end, sig);
  document.addEventListener('touchcancel', end, sig);

  return {
    get state() { return state; },
    set,
    /** 지도 핀 카드가 열리고 닫힐 때 */
    card(open: boolean) { if (!sheetOn()) return; if (open) set('card'); else if (state === 'card') set(before); },
    /** 본문이 바뀌었다(화면 이동) */
    swapped() { if (!sheetWanted()) { off(); return; } html.classList.add('msheet'); decorate(); set(o.initial(), false); },
    refreshPeek: fillPeek,
    destroy: off,
  };
}
