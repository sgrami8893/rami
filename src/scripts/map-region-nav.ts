// 페이지로 이동하는 지도(주차장)의 지역 칩: RegionChips의 data-nav 표로 칩 글자·목록을 채우고, 고르면 그 지역 페이지로 지도 화면 안 이동.
import { picker } from './map-picker.ts';
import { navigate } from './soft-nav.ts';
type Item = { value: string; label: string; meta?: string; href: string };
type Nav = { cur: { sido: string; sgg: string | null; dong: string | null }; label: { sido: string; sgg: string | null; dong: string | null }; sidos: Item[]; sggs: Item[]; dongs: Item[] };

export function initRegionNav(pane: HTMLElement) {
  const root = pane.querySelector<HTMLElement>('nav[data-nav]');
  if (!root) return;
  const d = JSON.parse(root.dataset.nav!) as Nav;
  const go = (list: Item[]) => (v: string) => { const it = list.find((x) => x.value === v); if (it) void navigate(new URL(it.href, location.href)); };
  const pk = (k: string) => root.querySelector<HTMLElement>(`.rm-pick-${k}`);
  const pS = picker(pk('sido')!, { items: () => d.sidos, current: () => d.cur.sido, onPick: go(d.sidos) });
  pS.set(d.label.sido);
  const pG = picker(pk('sgg')!, { search: 'on', items: () => d.sggs, current: () => d.cur.sgg ?? '', onPick: go(d.sggs) });
  pG.show(true); pG.set(d.label.sgg ?? '시·군·구', !d.label.sgg);
  if (d.dongs.length) {
    const pD = picker(pk('dong')!, { search: 'on', items: () => d.dongs, current: () => d.cur.dong ?? '', onPick: go(d.dongs) });
    pD.show(true); pD.set(d.label.dong ?? '동네', !d.label.dong);
  }
}

/** 지도 위 필터 토글: 목록의 같은 조건 버튼([data-filter])을 대신 누르고, 목록 쪽 상태를 따라간다 */
export function initMapFilters(pane: HTMLElement, signal: AbortSignal) {
  const btns = [...pane.querySelectorAll<HTMLButtonElement>('.map-filt[data-proxy]')];
  if (!btns.length) return;
  const src = (b: HTMLButtonElement) => document.querySelector<HTMLButtonElement>(`#main [data-filter="${b.dataset.proxy}"]`);
  const sync = () => btns.forEach((b) => { const s = src(b); b.hidden = !s; if (s) b.setAttribute('aria-pressed', s.getAttribute('aria-pressed') ?? 'false'); });
  btns.forEach((b) => b.addEventListener('click', () => { src(b)?.click(); sync(); }));
  document.addEventListener('list:filtered', sync, { signal });
  sync();
  const box = pane.querySelector<HTMLElement>('.map-filts');
  if (box) box.hidden = btns.every((b) => b.hidden);
}
