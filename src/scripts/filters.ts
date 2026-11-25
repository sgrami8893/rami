// Region page filters: chips (AND), 구/동 selects, URL query sync, empty state.
// 위치정보(Geolocation)는 1차 MVP에서 쓰지 않는다(법적 리스크 제거 결정, 2026-11-25).
import { refreshOpenState } from './open-now.ts';

const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector<T>(s);
const cards = () => [...document.querySelectorAll<HTMLElement>('#kiosk-list .kiosk')];

const state = { chips: new Set<string>(), subgu: '', dong: '' };

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
}

function writeQuery() {
  const q = new URLSearchParams();
  if (state.chips.size) q.set('f', [...state.chips].join(','));
  if (state.subgu) q.set('gu', state.subgu);
  if (state.dong) q.set('dong', state.dong);
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
    const any = [...g.querySelectorAll<HTMLElement>('.kiosk')].some((c) => !c.hidden);
    g.hidden = !any;
  });

  document.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach((b) => b.setAttribute('aria-pressed', String(state.chips.has(b.dataset.chip!))));
  const total = cards().length;
  const parts = [`${kstLabel} 기준`, state.chips.size || state.subgu || state.dong ? `${total}곳 중 ${shown}곳` : `전체 ${total}곳`];
  if (unknownHidden) parts.push(`운영시간 미확인 ${unknownHidden}곳 제외`);
  if (state.chips.has('registry') || state.chips.has('family')) parts.push('등기부·가족관계 서류는 기기 운영시간과 달리 평일 낮에만 발급되는 곳이 있습니다');
  $('#f-count')!.textContent = parts.join(' · ');
  $('#empty-state')!.hidden = shown > 0;
  writeQuery();
}

function kstText(m: number) {
  return `현재 ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')} (KST)`;
}

export function initFilters() {
  readQuery();
  const subSel = $<HTMLSelectElement>('#f-subgu');
  const dongSel = $<HTMLSelectElement>('#f-dong');
  if (subSel) subSel.value = state.subgu;
  if (dongSel) dongSel.value = state.dong;

  const run = () => apply(kstText(refreshOpenState().minutes));
  document.querySelectorAll<HTMLButtonElement>('[data-chip]').forEach((b) => b.addEventListener('click', () => {
    const c = b.dataset.chip!;
    state.chips.has(c) ? state.chips.delete(c) : state.chips.add(c);
    run();
  }));
  document.querySelectorAll<HTMLButtonElement>('[data-stat-chip]').forEach((b) => b.addEventListener('click', () => {
    const c = b.dataset.statChip!;
    state.chips.clear();
    if (c) state.chips.add(c);
    run();
    $('#filters')?.scrollIntoView({ behavior: 'smooth' });
  }));
  subSel?.addEventListener('change', () => { state.subgu = subSel.value; run(); });
  dongSel?.addEventListener('change', () => { state.dong = dongSel.value; run(); });
  run();
  setInterval(run, 60_000);
}
