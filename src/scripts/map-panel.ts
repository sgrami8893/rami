// MapPanel 클라이언트 v2 (2026-11-26 PC 지도 2단).
// - PC(1024px+): 지도가 오른쪽에 늘 보이므로 바로 그린다. 목록 행에 마우스·포커스를 두면 핀이 강조되고,
//   행의 빈 곳이나 '지도' 버튼을 누르면 그 핀으로 이동해 요약 카드를 연다. 핀을 누르면 목록의 그 행이 강조된다.
// - 모바일: '지도로 보기'를 누르면 전체 화면 대화상자로 열고, 그때 처음 그린다. 뒤로 가기·Esc·'목록으로'로 닫는다.
// - 목록 필터(무료만·지금 운영 중·24시간 등)를 바꾸면 'list:filtered' 이벤트를 받아 지도 핀도 같은 조건으로 거른다.
// 보안: 핀 데이터는 빌드 때 만든 JSON이고, 카드에는 textContent·setAttribute만 쓴다(innerHTML 없음).
// CSS는 정적 import(지도가 있는 페이지에만 실림). 동적 import로 두면 빌드에서 CSS 파일이 빠지는 문제가 있었다.
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { announce, copyText } from './copy.ts';
import type * as Leaflet from 'leaflet';

type Pt = { id: string; name: string; lat: number; lng: number; href: string; meta?: string; badge?: string; addr?: string };
type Cfg = { url: string; attribution: string; maxZoom: number };
interface MapApi { focus(id: string): void; hover(id: string | null): void; filter(ids: Set<string> | null): void; resize(): void }

const LG = window.matchMedia('(min-width: 1024px)');
const enc = encodeURIComponent;
const kakaoMap = (p: Pt) => `https://map.kakao.com/link/map/${enc(p.name)},${p.lat},${p.lng}`;
const naverSearch = (p: Pt) => `https://map.naver.com/p/search/${enc(p.addr ? `${p.addr} ${p.name}` : p.name)}`;

async function mount(pane: HTMLElement): Promise<MapApi> {
  const canvas = pane.querySelector<HTMLElement>('.map-canvas')!;
  const points = JSON.parse(canvas.dataset.points || '[]') as Pt[];
  const cfg = JSON.parse(canvas.dataset.cfg || '{}') as Cfg;
  const { default: L } = await import('leaflet');
  (window as unknown as { L: typeof L }).L = L; // markercluster 1.x는 전역 L에 붙는다
  await import('leaflet.markercluster');
  canvas.querySelector('.map-loading')?.remove();

  // 남용 완화: 수도권 밖으로 끌고 가거나 아주 멀리 축소하지 못하게 해서 사용자 한 명이 만드는 타일 요청 수를 줄인다.
  const area = L.latLngBounds([36.8, 124.5], [38.4, 128.0]);
  const map = L.map(canvas, { zoomControl: false, attributionControl: true, scrollWheelZoom: true, // PC: 지도 위에서 휠로 바로 확대·축소(사용자 요청 2026-11-26)
    maxBounds: area, maxBoundsViscosity: 1, minZoom: 9 });
  map.attributionControl.setPrefix('Leaflet');
  L.control.zoom({ position: 'topright', zoomInTitle: '지도 확대', zoomOutTitle: '지도 축소' }).addTo(map); // 기본 영어 라벨 대신 한국어
  const tiles = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom, minZoom: 9, bounds: area, keepBuffer: 1 }).addTo(map);
  // 타일이 계속 실패하면(키 한도 초과·차단 등) 빈 지도 대신 안내 문구를 띄운다.
  let failed = 0;
  tiles.on('tileerror', () => {
    if (++failed !== 12) return;
    const note = document.createElement('p');
    note.className = 'absolute inset-x-3 top-14 z-[1000] rounded-xl bg-card px-3 py-2 text-cap text-ink-2 shadow';
    note.textContent = '배경지도를 불러오지 못하고 있어요. 핀 위치와 목록은 그대로 볼 수 있어요.';
    canvas.parentElement?.appendChild(note);
  });

  // 핀·클러스터 모양은 우리 CSS(global.css .map-pin/.map-cluster)로 그린다(타사 아이콘 이미지 없음).
  // 누르는 영역: 핀 32px(보이는 점 22px), 클러스터 44px. WCAG 2.5.8(24px 이상)을 넘기고,
  // 묶음 반경 60px·펼침 간격 40px로 누르는 영역끼리 겹치지 않게 한다(axe target-size 겹침 해소, 2026-11-26).
  const pin = L.divIcon({ className: 'map-hit map-hit-pin', html: '<span class="map-pin"></span>', iconSize: [32, 32], iconAnchor: [16, 16] });
  const cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 60,
    spiderfyDistanceMultiplier: 1.6,
    chunkedLoading: true,
    iconCreateFunction: (c) => L.divIcon({ className: 'map-hit', html: `<span class="map-cluster" aria-hidden="true">${c.getChildCount()}</span><span class="sr-only">${c.getChildCount()}곳 묶음, 눌러서 확대</span>`, iconSize: [44, 44] }),
  });

  const card = pane.querySelector<HTMLElement>('.map-card')!;
  card.tabIndex = -1;
  const set = (sel: string, t = '') => { const el = card.querySelector<HTMLElement>(sel)!; el.textContent = t; el.hidden = !t; };
  const byId = new Map(points.map((p) => [p.id, p]));
  const markers = new Map<string, Leaflet.Marker>();
  let active: string | null = null;
  let hoverEl: HTMLElement | null = null;
  let shown = new Set(points.map((p) => p.id));

  const paint = (id: string) => {
    const el = markers.get(id)?.getElement();
    el?.classList.toggle('is-active', id === active);
  };
  const select = (id: string | null, fromKeyboard = false) => {
    const prev = active;
    active = id;
    if (prev) { paint(prev); markers.get(prev)?.setZIndexOffset(0); }
    if (!id) { card.hidden = true; document.dispatchEvent(new CustomEvent('map:select', { detail: { id: null } })); return; }
    const p = byId.get(id)!;
    paint(id); markers.get(id)?.setZIndexOffset(1000);
    set('.map-card-badge', p.badge); set('.map-card-name', p.name); set('.map-card-meta', p.meta); set('.map-card-addr', p.addr);
    card.querySelector('.map-card-link')!.setAttribute('href', p.href);
    card.querySelector('.map-card-link')!.setAttribute('aria-label', `${p.name} 상세 보기`);
    card.querySelector('.map-card-kakao')!.setAttribute('href', kakaoMap(p));
    card.querySelector('.map-card-naver')!.setAttribute('href', naverSearch(p));
    card.querySelector<HTMLElement>('.map-card-copy')!.hidden = !p.addr;
    card.hidden = false;
    if (fromKeyboard) card.focus();
    document.dispatchEvent(new CustomEvent('map:select', { detail: { id } }));
  };
  const closeCard = () => {
    const back = active ? markers.get(active)?.getElement() : null;
    const hadFocus = card.contains(document.activeElement);
    select(null);
    if (hadFocus && back && document.contains(back)) back.focus();
  };
  card.querySelector('.map-card-close')!.addEventListener('click', closeCard);
  card.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeCard(); } });
  card.querySelector<HTMLElement>('.map-card-copy')!.addEventListener('click', (e) => {
    const p = active ? byId.get(active) : null;
    if (p?.addr) copyText(p.addr, e.currentTarget as HTMLElement);
  });
  map.on('click', () => { if (active) select(null); });

  for (const p of points) {
    const m = L.marker([p.lat, p.lng], { icon: pin, title: p.name, keyboard: true, alt: p.name });
    m.on('add', () => { m.getElement()?.setAttribute('aria-label', p.name); paint(p.id); }); // 다시 그려질 때 강조 유지
    m.on('click', (e) => { L.DomEvent.stopPropagation(e); select(p.id, (e as Leaflet.LeafletMouseEvent).originalEvent instanceof KeyboardEvent); });
    markers.set(p.id, m);
  }
  cluster.addLayers([...markers.values()]);
  map.addLayer(cluster);
  const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
  const fit = () => (points.length === 1 ? map.setView(bounds.getCenter(), 16) : map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 }));
  fit();
  // 패널 크기가 바뀌면(모바일 전체 화면 열기, 창 크기 변경) 지도 크기를 다시 잰다
  new ResizeObserver(() => map.invalidateSize()).observe(canvas);

  const count = pane.querySelector('.map-count');
  const note = pane.querySelector<HTMLElement>('.map-filter-note');
  return {
    focus(id) {
      const m = markers.get(id);
      if (!m || !shown.has(id)) return;
      cluster.zoomToShowLayer(m, () => { map.panTo(m.getLatLng()); select(id); });
      announce(`${byId.get(id)?.name ?? ''} 위치를 지도에 표시했어요.`);
    },
    hover(id) {
      hoverEl?.classList.remove('is-hover'); hoverEl = null;
      const m = id ? markers.get(id) : null;
      if (!m || !shown.has(id!)) return;
      const vis = cluster.getVisibleParent(m) as Leaflet.Marker | null; // 묶여 있으면 그 묶음을 강조
      hoverEl = (vis?.getElement() as HTMLElement | undefined) ?? null;
      hoverEl?.classList.add('is-hover');
    },
    filter(ids) {
      const next = ids ?? new Set(points.map((p) => p.id));
      if (next.size === shown.size && [...next].every((x) => shown.has(x))) return;
      shown = new Set([...next].filter((x) => markers.has(x)));
      cluster.clearLayers();
      cluster.addLayers([...shown].map((x) => markers.get(x)!));
      if (active && !shown.has(active)) select(null);
      const filtered = shown.size < points.length;
      if (count) count.textContent = filtered ? `조건에 맞는 ${shown.size}곳 표시` : `${points.length}곳 표시`;
      if (note) { note.hidden = !filtered; note.textContent = `조건에 맞는 ${shown.size}곳만 보고 있어요`; }
    },
    resize() { map.invalidateSize(); },
  };
}

export function initMapPanels() {
  const pane = document.getElementById('map-pane');
  if (!pane) return;
  const rows = [...document.querySelectorAll<HTMLElement>('[data-map-id]')];
  document.documentElement.classList.add('has-map');
  document.querySelectorAll<HTMLElement>('[data-map-open], [data-map-locate]').forEach((b) => { b.hidden = false; });

  let api: MapApi | null = null;
  let loading: Promise<MapApi> | null = null;
  let pendingFilter: Set<string> | null | undefined;
  const ensure = () => (loading ??= mount(pane).then((a) => {
    api = a;
    if (pendingFilter !== undefined) a.filter(pendingFilter);
    return a;
  }).catch((err) => {
    console.error('[map]', err);
    const l = pane.querySelector('.map-loading');
    if (l) l.textContent = '지도를 불러오지 못했어요. 목록을 이용해 주세요.';
    throw err;
  }));

  // ---- 모바일 전체 화면 ----
  let opener: HTMLElement | null = null;
  const isOpen = () => pane.hasAttribute('data-open');
  const openSheet = (from: HTMLElement | null) => {
    opener = from;
    pane.setAttribute('data-open', '');
    pane.setAttribute('role', 'dialog');
    pane.setAttribute('aria-modal', 'true');
    document.documentElement.classList.add('map-sheet-open');
    history.pushState({ dnkkMap: 1 }, '');
    pane.querySelector<HTMLElement>('[data-map-close]')?.focus();
  };
  const closeSheet = (fromPop = false) => {
    if (!isOpen()) return;
    pane.removeAttribute('data-open');
    pane.removeAttribute('role');
    pane.removeAttribute('aria-modal');
    document.documentElement.classList.remove('map-sheet-open');
    if (!fromPop && history.state?.dnkkMap) history.back();
    opener?.focus();
    opener = null;
  };
  const show = (id: string | null, from: HTMLElement | null) => {
    if (!LG.matches && !isOpen()) openSheet(from);
    ensure().then((a) => { a.resize(); if (id) a.focus(id); }).catch(() => {});
  };
  document.querySelectorAll<HTMLElement>('[data-map-open]').forEach((b) => b.addEventListener('click', () => show(null, b)));
  pane.querySelector('[data-map-close]')?.addEventListener('click', () => closeSheet());
  addEventListener('popstate', () => closeSheet(true));
  pane.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { closeSheet(); return; }
    if (e.key !== 'Tab') return; // 대화상자 안에서만 Tab이 돌게 한다
    const f = [...pane.querySelectorAll<HTMLElement>('a[href], button, [tabindex="0"]')].filter((x) => !x.hidden && x.offsetParent !== null);
    if (!f.length) return;
    const [first, last] = [f[0], f[f.length - 1]];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  const onBreakpoint = () => {
    if (LG.matches) { if (isOpen()) closeSheet(); ensure().catch(() => {}); }
    api?.resize();
  };
  LG.addEventListener('change', onBreakpoint);
  if (LG.matches) {
    // PC는 첫 화면부터 지도가 보인다. 본문 그리기를 막지 않도록 잠깐 미룬다.
    const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 50));
    idle(() => ensure().catch(() => {}));
  }

  // ---- 목록 ↔ 지도 연결 ----
  for (const r of rows) {
    const id = r.dataset.mapId!;
    r.addEventListener('mouseenter', () => { if (LG.matches) api?.hover(id); });
    r.addEventListener('mouseleave', () => { if (LG.matches) api?.hover(null); });
    // PC에서는 행의 빈 곳을 누르면 지도에서 그곳을 보여 준다(이름 링크는 그대로 상세 페이지). 키보드는 행의 '지도' 버튼으로 같은 동작.
    r.addEventListener('click', (e) => {
      if (!LG.matches || (e.target as Element).closest('a, button')) return;
      show(id, null);
    });
  }
  document.querySelectorAll<HTMLElement>('[data-map-locate]').forEach((b) => b.addEventListener('click', () => show(b.dataset.mapLocate!, b)));
  document.addEventListener('map:select', (e) => {
    const id = (e as CustomEvent<{ id: string | null }>).detail.id;
    for (const r of rows) r.toggleAttribute('data-active', r.dataset.mapId === id);
    const row = id ? rows.find((r) => r.dataset.mapId === id) : null;
    if (row && LG.matches && row.offsetParent !== null) row.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  // 목록 필터와 같은 조건으로 핀을 거른다(행이 hidden이면 지도에서도 뺀다. '더 보기'로 접힌 행은 조건에 맞으므로 그대로 둔다)
  const syncFilter = () => {
    const ids = new Set(rows.filter((r) => !r.hidden).map((r) => r.dataset.mapId!));
    const all = ids.size === rows.length ? null : ids;
    if (api) api.filter(all); else pendingFilter = all;
  };
  document.addEventListener('list:filtered', syncFilter);
  if (rows.length) syncFilter(); // 목록 스크립트가 먼저 돌아 이미 걸러 둔 경우(주소의 ?filter= 등)
}
