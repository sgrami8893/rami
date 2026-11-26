// 전월세 지도의 건물 핀(2026-11-26 v2): 아주 가까이(줌 15+) 볼 때 최근 3년 3건 이상 거래된 건물만 '12건' 알약으로.
// 누르면 그 동 상세의 '건물별 거래' 탭에서 이력을 연다(같은 동이면 바로, 아니면 그 동 페이지로 이동 #bld=…).
import type * as Leaflet from 'leaflet';
import { loadBld, type Bld } from './rent-bld.ts';
import { navigate } from './soft-nav.ts';

export const BUILD_ZOOM = 15;
export function createPins(o: { L: typeof Leaflet; map: Leaflet.Map; src: string; files: () => string[]; dongHref: (file: string, dong: string) => string | null }) {
  const { L, map } = o;
  let cluster: Leaflet.MarkerClusterGroup | null = null;
  const markers = new Map<string, Leaflet.Marker>();
  let active: string | null = null;
  let shown = false;
  const paint = () => markers.forEach((m, id) => m.getElement()?.classList.toggle('is-active', id === active));
  const icon = (b: Bld) => L.divIcon({ className: 'map-hit map-hit-tag', iconSize: [0, 0], iconAnchor: [0, 0], html: `<span class="map-tag map-tag-info">${b.n.toLocaleString('ko-KR')}건</span>` });
  const openB = (b: Bld) => {
    const tab = document.getElementById('rent-bld');
    if (tab && tab.dataset.file === b.file && tab.dataset.dong === b.dong) {
      const pane = document.getElementById('map-pane');
      if (pane?.hasAttribute('data-open')) pane.querySelector<HTMLElement>('[data-map-close]')?.click();
      document.dispatchEvent(new CustomEvent('rent:bld-open', { detail: b.id }));
      return;
    }
    const href = o.dongHref(b.file, b.dong);
    if (href) void navigate(new URL(`${href}#bld=${encodeURIComponent(b.id)}`, location.href));
  };
  const markerOf = (b: Bld) => {
    let m = markers.get(b.id);
    if (m) return m;
    m = L.marker([b.lat!, b.lng!], { icon: icon(b), keyboard: true, title: '' });
    m.on('click', (e) => { L.DomEvent.stopPropagation(e); openB(b); });
    m.on('add', () => {
      const el = m!.getElement(); if (!el) return;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${b.name || '이름 없는 건물'} ${b.jibun}, 최근 3년 실거래 ${b.n}건, 이력 보기`);
      el.classList.toggle('is-active', b.id === active);
    });
    markers.set(b.id, m);
    return m;
  };
  async function refresh() {
    if (map.getZoom() < BUILD_ZOOM) { if (cluster && map.hasLayer(cluster)) map.removeLayer(cluster); shown = false; return; }
    if (!cluster) {
      await import('leaflet.markercluster');
      cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 50, spiderfyDistanceMultiplier: 1.6, disableClusteringAtZoom: 18, chunkedLoading: true,
        iconCreateFunction: (c) => { const n = c.getChildCount(); const sz = n < 10 ? 's' : n < 100 ? 'm' : 'l'; const hit = sz === 'l' ? 52 : 44;
          return L.divIcon({ className: 'map-hit', html: `<span class="map-cluster map-cluster-${sz}" aria-hidden="true"><b>${n.toLocaleString('ko-KR')}</b>곳</span><span class="sr-only">건물 ${n}곳 묶음, 눌러서 확대</span>`, iconSize: [hit, hit] }); } });
    }
    const files = o.files();
    const data = await Promise.all(files.map((f) => loadBld(o.src, f)));
    if (map.getZoom() < BUILD_ZOOM) return;
    const view = map.getBounds().pad(0.3);
    const want: Leaflet.Marker[] = [];
    for (const d of data) for (const b of d?.list ?? []) if (b.lat !== null && b.lng !== null && view.contains([b.lat, b.lng])) want.push(markerOf(b));
    cluster.clearLayers(); cluster.addLayers(want);
    if (!map.hasLayer(cluster)) cluster.addTo(map);
    shown = want.length > 0;
  }
  document.addEventListener('rent:bld-focus', (e) => {
    if (!document.contains(map.getContainer())) return;
    const d = (e as CustomEvent<{ id: string; lat: number | null; lng: number | null } | null>).detail;
    active = d?.id ?? null;
    if (d && d.lat !== null && d.lng !== null) map.setView([d.lat, d.lng], Math.max(map.getZoom(), BUILD_ZOOM + 1), { animate: !matchMedia('(prefers-reduced-motion: reduce)').matches });
    paint();
  });
  return { refresh, get pinsShown() { return shown; } };
}
