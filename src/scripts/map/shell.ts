// 새 지도 v2 껍데기(2026-11-26 사용자 '지도도 예전 것 고려 없이 가장 편하게').
// 원칙
// 1) 지도는 목록이 보여 주는 것만 보여 준다. 지금 화면의 하위 지역만 색·숫자, 이웃은 흐리게.
// 2) 지도를 누르는 것 = 목록 줄을 누르는 것. PC는 그 페이지로 이동(지도는 그대로), 모바일은 요약 카드 1장 + '자세히 보기'.
// 3) 목록 줄에 마우스를 올리면 지도 칸이 강조되고, 지도 칸에 올리면 목록 줄이 강조된다([data-key]).
// 4) 지도 위 조작은 확대·축소와 작은 범례뿐. 단계 막대·선택 상자 없음, 확대해도 범위가 저절로 바뀌지 않는다.
// 모바일: '지도' 알약(data-map-open) → 전체 화면 대화상자, '목록'·뒤로 가기·Esc로 닫는다.
import { initSoftNav, type SwapDetail } from '../soft-nav.ts';
import { LG, reduced } from './base.ts';

export type Focus = Record<string, string | undefined>;
export type Pick = { key: string; title: string; sub?: string; value?: string; note?: string; href?: string | null };
export interface Layer {
  /** 본문이 바뀌어 초점(지역)이 옮겨졌다 */
  focus(f: Focus): void;
  hover(key: string | null): void;
  /** 목록 필터와 같은 조건으로 거르기(null = 모두) */
  filter?(keys: Set<string> | null): void;
  resize(): void;
  destroy(): void;
}
export type Ctx = {
  pane: HTMLElement; canvas: HTMLElement;
  /** 지도에서 무엇을 골랐다: PC면 이동, 모바일이면 카드 */
  pick(p: Pick, viaKeyboard?: boolean): void;
  /** 지도 칸에 마우스가 올라갔다(목록 줄 강조) */
  hovered(key: string | null): void;
};

let inited = false;
let teardown: (() => void) | null = null;
export function initMapView() {
  if (!inited) {
    inited = true;
    document.addEventListener('dnkk:unmount', () => { teardown?.(); teardown = null; });
    document.addEventListener('dnkk:swap', (e) => { if ((e as CustomEvent<SwapDetail>).detail.remount) setup(); });
  }
  setup();
  initSoftNav();
}

const rowsOf = () => [...document.querySelectorAll<HTMLElement>('#main [data-key], #main [data-map-id]')];
const keyOf = (r: HTMLElement) => r.dataset.key ?? r.dataset.mapId ?? '';

function setup() {
  const pane = document.getElementById('map-pane');
  if (!pane || pane.dataset.bound) return;
  pane.dataset.bound = '1';
  const canvas = pane.querySelector<HTMLElement>('.map-canvas')!;
  const card = pane.querySelector<HTMLElement>('.mv-card');
  const ac = new AbortController();
  const sig = { signal: ac.signal };
  document.documentElement.classList.add('has-map');
  const showPills = () => document.querySelectorAll<HTMLElement>('[data-map-open]').forEach((b) => { b.hidden = false; });
  showPills();

  let layer: Layer | null = null;
  let loading: Promise<Layer> | null = null;
  let pendingFilter: Set<string> | null | undefined;
  let hoverRow: HTMLElement | null = null;

  // ---- 카드(모바일 전용. PC는 바로 이동) ----
  let cardKey: string | null = null;
  const closeCard = () => { if (card) card.hidden = true; cardKey = null; };
  const fillCard = (p: Pick, kb = false) => {
    if (!card) return;
    const set = (sel: string, t?: string | null) => { const el = card.querySelector<HTMLElement>(sel); if (el) { el.textContent = t ?? ''; el.hidden = !t; } };
    set('.mv-card-title', p.title); set('.mv-card-sub', p.sub); set('.mv-card-value', p.value); set('.mv-card-note', p.note);
    const a = card.querySelector<HTMLAnchorElement>('.mv-card-link');
    if (a) { a.hidden = !p.href; if (p.href) a.href = p.href; a.setAttribute('aria-label', `${p.title} 자세히 보기`); }
    card.hidden = false; cardKey = p.key;
    if (kb) card.focus();
  };
  card?.querySelector('.mv-card-close')?.addEventListener('click', closeCard);
  card?.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeCard(); } });
  card?.querySelector('.mv-card-link')?.addEventListener('click', () => { closeSheet(true); });

  const ctx: Ctx = {
    pane, canvas,
    pick(p, kb) {
      if (LG.matches && p.href) { void import('../soft-nav.ts').then((m) => m.navigate(new URL(p.href!, location.href))); return; }
      if (cardKey === p.key && !card?.hidden) { closeCard(); return; }
      fillCard(p, kb);
    },
    hovered(key) {
      hoverRow?.classList.remove('is-hover'); hoverRow = null;
      if (!key || !LG.matches) return;
      hoverRow = rowsOf().find((r) => keyOf(r) === key) ?? null;
      if (!hoverRow || hoverRow.offsetParent === null) { hoverRow = null; return; }
      hoverRow.classList.add('is-hover');
      hoverRow.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    },
  };

  const ensure = () => (loading ??= (async () => {
    const kind = canvas.dataset.kind;
    const mod = kind === 'rent' ? await import('./rent.ts') : await import('./pins.ts');
    const l = await mod.mount(ctx);
    layer = l;
    if (pendingFilter !== undefined) l.filter?.(pendingFilter);
    return l;
  })().catch((err) => {
    console.error('[map]', err);
    const el = canvas.querySelector('.map-loading');
    if (el) el.textContent = '지도를 불러오지 못했어요. 목록을 이용해 주세요.';
    throw err;
  }));
  teardown = () => { ac.abort(); layer?.destroy(); document.documentElement.classList.remove('map-sheet-open', 'has-map'); };

  // ---- 모바일 전체 화면 ----
  let opener: HTMLElement | null = null;
  const isOpen = () => pane.hasAttribute('data-open');
  const openSheet = (from: HTMLElement | null) => {
    opener = from;
    pane.setAttribute('data-open', ''); pane.setAttribute('role', 'dialog'); pane.setAttribute('aria-modal', 'true');
    document.documentElement.classList.add('map-sheet-open');
    history.pushState({ ...(history.state ?? {}), dnkkMap: 1 }, '');
    pane.querySelector<HTMLElement>('.map-bar [data-map-close]')?.focus();
    ensure().then((l) => l.resize()).catch(() => {});
  };
  function closeSheet(silent = false) {
    if (!isOpen()) return;
    const p = pane!;
    p.removeAttribute('data-open'); p.removeAttribute('role'); p.removeAttribute('aria-modal');
    document.documentElement.classList.remove('map-sheet-open');
    closeCard();
    if (!silent && history.state?.dnkkMap) history.back();
    if (!silent) opener?.focus();
    opener = null;
  }
  document.addEventListener('click', (e) => {
    const b = (e.target as Element).closest?.('[data-map-open]') as HTMLElement | null;
    if (b) openSheet(b);
  }, sig);
  pane.querySelectorAll('[data-map-close]').forEach((b) => b.addEventListener('click', () => closeSheet()));
  addEventListener('popstate', () => { if (isOpen() && !history.state?.dnkkMap) closeSheet(true); }, sig);
  pane.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { closeSheet(); return; }
    if (e.key !== 'Tab') return;
    const f = [...pane.querySelectorAll<HTMLElement>('a[href], button, [tabindex="0"]')].filter((x) => !x.hidden && x.offsetParent !== null && x.getAttribute('aria-hidden') !== 'true');
    if (!f.length) return;
    const [first, last] = [f[0], f[f.length - 1]];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  LG.addEventListener('change', () => { if (LG.matches) { closeSheet(true); closeCard(); ensure().catch(() => {}); } layer?.resize(); }, sig);
  if (LG.matches) {
    const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 50));
    idle(() => ensure().catch(() => {}));
  }

  // ---- 목록 ↔ 지도 ----
  const main = document.getElementById('main')!;
  main.addEventListener('mouseover', (e) => {
    if (!LG.matches) return;
    const r = (e.target as Element).closest?.('[data-key], [data-map-id]') as HTMLElement | null;
    layer?.hover(r ? keyOf(r) : null);
  }, sig);
  main.addEventListener('mouseleave', () => layer?.hover(null), sig);
  main.addEventListener('focusin', (e) => {
    if (!LG.matches) return;
    const r = (e.target as Element).closest?.('[data-key], [data-map-id]') as HTMLElement | null;
    layer?.hover(r ? keyOf(r) : null);
  }, sig);
  const syncFilter = () => {
    const rows = rowsOf().filter((r) => r.hasAttribute('data-map-id'));
    if (!rows.length) return;
    const ids = new Set(rows.filter((r) => !r.hidden).map(keyOf));
    const all = ids.size === rows.length ? null : ids;
    if (layer?.filter) layer.filter(all); else pendingFilter = all;
  };
  document.addEventListener('list:filtered', syncFilter, sig);
  syncFilter();

  // 본문만 바뀐 이동(같은 지도 종류): 지도는 그대로 두고 초점만 옮긴다
  document.addEventListener('dnkk:swap', (ev) => {
    const d = (ev as CustomEvent<SwapDetail>).detail;
    if (d.remount) return;
    closeSheet(true); closeCard(); showPills();
    hoverRow = null;
    if (d.focus) { if (layer) layer.focus(d.focus); else canvas.dataset.focus = JSON.stringify(d.focus); }
    syncFilter();
  }, sig);
}
