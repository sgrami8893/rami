// 전월세 보기 상태(빌라/오피스텔 · 전세/월세) — RentMode.astro. 버튼은 본문이 바뀌어도(soft-nav) 문서 위임으로 동작한다.
import { announce } from './copy.ts';
const KEY = 'dnkk:rm:v1';
export type RentModeState = { t: 'v' | 'o'; k: 'j' | 'w' };
export const rentMode = (): RentModeState => {
  const d = document.documentElement.dataset;
  return { t: d.rt === 'o' ? 'o' : 'v', k: d.rk === 'w' ? 'w' : 'j' };
};
const paint = () => {
  const m = rentMode();
  document.querySelectorAll<HTMLElement>('.v-rentmode').forEach((el) => { el.hidden = false; });
  document.querySelectorAll<HTMLButtonElement>('[data-rm-t]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rmT === m.t)));
  document.querySelectorAll<HTMLButtonElement>('[data-rm-k]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.rmK === m.k)));
};
let started = false;
export function initRentMode() {
  paint();
  if (started) return;
  started = true;
  document.addEventListener('dnkk:swap', () => requestAnimationFrame(paint));
  document.addEventListener('click', (e) => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-rm-t], [data-rm-k]');
    if (!b) return;
    const d = document.documentElement.dataset;
    if (b.dataset.rmT) d.rt = b.dataset.rmT; else if (b.dataset.rmK) d.rk = b.dataset.rmK;
    const m = rentMode();
    try { if (m.t === 'v' && m.k === 'j') localStorage.removeItem(KEY); else localStorage.setItem(KEY, m.t + m.k); } catch { /* 이번 화면에만 */ }
    paint();
    document.dispatchEvent(new CustomEvent('rent:mode', { detail: m }));
    announce(`${m.t === 'v' ? '빌라' : '오피스텔'} ${m.k === 'j' ? '전세' : '월세'} 기준으로 바꿨어요.`);
  });
}
