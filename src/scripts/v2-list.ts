// 목록 정렬·더 보기(2026-11-26 v2). <div data-vlist data-limit="10"> 안의 [data-row] 줄을 다룬다.
// - 정렬: 같은 목록 머리의 <select data-vsort>. n(거래·개수 많은 순) · lo/hi(지금 보는 값 낮은/높은 순, data-v-{rt}{rk} 또는 data-v) · nm(이름순) · as(원래 순서)
// - 더 보기: limit개씩. 값이 없는 줄(data-v... 비어 있음)은 lo/hi 정렬에서 맨 뒤.
import { rentMode } from './v2-rent-mode.ts';
const ko = (a: string, b: string) => a.localeCompare(b, 'ko');
function valOf(r: HTMLElement) {
  const m = rentMode();
  const raw = r.dataset[`v${m.t}${m.k}`] ?? r.dataset.v;
  return raw === undefined || raw === '' ? null : Number(raw);
}
function setup(box: HTMLElement) {
  if (box.dataset.ready) return;
  box.dataset.ready = '1';
  const limit = Number(box.dataset.limit || 10);
  const list = box.querySelector<HTMLElement>('[data-rows]') ?? box;
  const rows = () => [...list.querySelectorAll<HTMLElement>(':scope > [data-row]')];
  const order = new Map(rows().map((r, i) => [r, i]));
  // 정렬: 한 줄 칩(눌린 것 하나). 옛 select도 받는다
  const sel = box.querySelector<HTMLSelectElement>('select[data-vsort]');
  const chips = [...box.querySelectorAll<HTMLButtonElement>('[data-vsort-v]')];
  box.querySelector<HTMLElement>('.v-sortchips')?.removeAttribute('hidden');
  const key = () => chips.find((c) => c.getAttribute('aria-pressed') === 'true')?.dataset.vsortV ?? sel?.value ?? 'as';
  const more = box.querySelector<HTMLButtonElement>('[data-vmore]');
  let shown = limit;
  const clip = () => {
    const rs = rows().filter((r) => !r.hidden);
    rs.forEach((r, i) => { if (i < shown) delete r.dataset.clip; else r.dataset.clip = ''; });
    if (more) { const left = rs.length - shown; more.hidden = left <= 0; more.textContent = `${Math.min(left, limit)}곳 더 보기 (남은 ${left}곳)`; }
  };
  const sort = () => {
    const k = key();
    const rs = rows();
    rs.sort((a, b) => {
      if (k === 'n') return Number(b.dataset.n) - Number(a.dataset.n);
      if (k === 'nm') return ko(a.dataset.nm ?? '', b.dataset.nm ?? '');
      if (k === 'lo' || k === 'hi') {
        const x = valOf(a), y = valOf(b);
        if (x === null || y === null) return x === null ? (y === null ? 0 : 1) : -1;
        return k === 'lo' ? x - y : y - x;
      }
      return (order.get(a) ?? 0) - (order.get(b) ?? 0);
    });
    list.append(...rs);
    clip();
  };
  sel?.addEventListener('change', () => { shown = limit; sort(); });
  chips.forEach((c) => c.addEventListener('click', () => { chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c))); shown = limit; sort(); }));
  more?.addEventListener('click', () => { const first = rows().find((r) => r.dataset.clip !== undefined); shown += limit; clip(); first?.querySelector<HTMLElement>('a')?.focus(); });
  document.addEventListener('rent:mode', () => { if (document.contains(box) && (key() === 'lo' || key() === 'hi')) sort(); });
  sort();
}
export function initLists() { document.querySelectorAll<HTMLElement>('[data-vlist]').forEach(setup); }
