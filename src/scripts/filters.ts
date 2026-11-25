// Region page filters: chips (AND), 구/동 selects, URL query sync, empty state.
// 위치정보(Geolocation)는 1차 MVP에서 쓰지 않는다(법적 리스크 제거 결정, 2026-11-25).
import { refreshOpenState } from './open-now.ts';

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s);
const cards = () => [...document.querySelectorAll<HTMLElement>('#kiosk-list .kiosk')];

const state = { chips: new Set<string>(), subgu: '', dong: '', q: '' };
const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

// 보안: URL 쿼리는 화이트리스트만 통과시킨다. 칩은 고정 목록, 구·동은 페이지 select에 실제로 있는 값만.
// 이 파일은 DOM에 값을 쓸 때 textContent·setAttribute만 쓰고 innerHTML을 쓰지 않는다.
const CHIPS = new Set(['open', '24h', 'weekend', 'registry', 'family']);
const optionValues = (sel: string) => new Set([...document.querySelectorAll<HTMLOptionElement>(`${sel} option`)].map((o) => o.value));

function readQuery() {
  const q = new URLSearchParams(location.search);
  (q.get('f') ?? '').split(',').filter((c) => CHIPS.has(c)).forEach((c) => state.chips.add(c));
  const gu = q.get('gu') ?? '', dong = q.get('dong') ?? '';
  state.subgu = optionValues('#f-subgu').has(gu) ? gu : '';
  state.dong = optionValues('#f-dong').has(dong) ? dong : '';
  state.q = (q.get('q') ?? '').slice(0, 40); // 검색어는 비교와 input.value에만 쓴다(HTML로 넣지 않음)
}

function writeQuery() {
  const q = new URLSearchParams();
  if (state.chips.size) q.set('f', [...state.chips].join(','));
  if (state.subgu) q.set('gu', state.subgu);
  if (state.dong) q.set('dong', state.dong);
  if (state.q.trim()) q.set('q', state.q.trim());
  const s = q.toString();
  history.replaceState(null, '', s ? `?${s}` : location.pathname); // canonical stays the clean URL
}

function matches(el: HTMLElement): boolean {
  const d = el.dataset;
  for (const c of state.chips) {
    if (c === 'open' ? d.open !== 'open' : !d[`f${c}`]) return false;
  }
  if (state.subgu && d.subgu !== state.subgu) return false;
  if (state.dong && d.dong !== state.dong) return false;
  const nq = norm(state.q);
  if (nq && !(d.search ?? '').includes(nq)) return false;
  return true;
}

function apply(kstLabel: string) {
  let shown = 0, unknownHidden = 0;
  for (const el of cards()) {
    const ok = matches(el);
    el.hidden = !ok;
    if (ok) shown++;
    else if (state.chips.has('open') && el.dataset.open === 'unknown') unknownHidden++;
  }
  // Group headings hide when their group is empty.
  document.querySelectorAll<HTMLElement>('#kiosk-list [data-group]').forEach((g) => {
    const visible = [...g.querySelectorAll<HTMLElement>('.kiosk')].filter((c) => !c.hidden).length;
    g.hidden = visible === 0;
    const gc = g.querySelector('.g-count');
    if (gc) gc.textContent = `${visible}곳`;
  });

  const filtered = state.chips.size > 0 || !!state.subgu || !!state.dong || !!norm(state.q);
  document.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach((b) => b.setAttribute('aria-pressed', String(state.chips.has(b.dataset.chip!))));
  // 통계 타일도 같은 상태를 보여 준다('전체'는 아무 필터도 없을 때 눌린 상태)
  document.querySelectorAll<HTMLButtonElement>('[data-stat-chip]').forEach((b) => {
    const c = b.dataset.statChip!;
    b.setAttribute('aria-pressed', String(c ? state.chips.has(c) : !filtered));
  });
  const total = cards().length;
  const parts = [`${kstLabel} 기준`, filtered ? `${total}곳 중 ${shown}곳` : `전체 ${total}곳`];
  if (unknownHidden) parts.push(`운영시간 미확인 ${unknownHidden}곳 제외`);
  $('#f-count')!.textContent = parts.join(' · ');
  const note = $('#f-note');
  if (note) note.hidden = !(state.chips.has('registry') || state.chips.has('family'));
  $('#empty-state')!.hidden = shown > 0;
  writeQuery();
}

function kstText(m: number) {
  return `지금 ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function initFilters() {
  readQuery();
  const subSel = $<HTMLSelectElement>('#f-subgu');
  const dongSel = $<HTMLSelectElement>('#f-dong');
  if (subSel) subSel.value = state.subgu;
  if (dongSel) dongSel.value = state.dong;
  const qInput = $<HTMLInputElement>('#f-q');
  const qClear = $<HTMLButtonElement>('#f-q-clear');
  if (qInput) qInput.value = state.q;
  if (qClear) qClear.hidden = !state.q;

  const run = () => apply(kstText(refreshOpenState().minutes));
  document.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach((b) => b.addEventListener('click', () => {
    const c = b.dataset.chip!;
    state.chips.has(c) ? state.chips.delete(c) : state.chips.add(c);
    run();
  }));
  const reset = () => {
    state.chips.clear(); state.subgu = ''; state.dong = ''; state.q = '';
    if (qInput) qInput.value = '';
    if (qClear) qClear.hidden = true;
    if (subSel) subSel.value = '';
    if (dongSel) dongSel.value = '';
    run();
  };
  // 통계 타일: 해당 칩을 켜고 끈다(칩과 양방향 동기화). '전체'는 필터 초기화.
  document.querySelectorAll<HTMLButtonElement>('[data-stat-chip]').forEach((b) => b.addEventListener('click', () => {
    const c = b.dataset.statChip!;
    if (!c) return reset();
    state.chips.has(c) ? state.chips.delete(c) : state.chips.add(c);
    run();
  }));
  document.getElementById('reset-filters')?.addEventListener('click', reset);
  qInput?.addEventListener('input', () => { state.q = qInput.value.slice(0, 40); if (qClear) qClear.hidden = !state.q; run(); });
  qClear?.addEventListener('click', () => { state.q = ''; qInput!.value = ''; qClear.hidden = true; qInput!.focus(); run(); });
  subSel?.addEventListener('change', () => { state.subgu = subSel.value; run(); });
  dongSel?.addEventListener('change', () => { state.dong = dongSel.value; run(); });
  run();
  setInterval(run, 60_000);
}
