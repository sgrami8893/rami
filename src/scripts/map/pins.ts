// 장소 핀 지도 v2(주차장 등). 핀 = 핵심 사실 한 가지를 적은 작은 알약(무료·300원/5분·24시간), 가까운 핀은 개수 묶음.
// 지도에서 핀을 누르는 것 = 목록 줄을 누르는 것(PC는 상세로 이동, 모바일은 카드). 목록 필터(list:filtered)와 같은 핀만 보인다.
// 상세 화면(data-focus-id)은 그 핀을 크게 표시하고 그 자리로 맞춘다.
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type * as Leaflet from 'leaflet';
import { createMap, esc, LG } from './base.ts';
import type { Ctx, Layer } from './shell.ts';

type Pt = { id: string; name: string; lat: number; lng: number; href: string; meta?: string; badge?: string; addr?: string; tag?: string; tone?: string };

export async function mount(ctx: Ctx): Promise<Layer> {
  const { canvas } = ctx;
  const points = JSON.parse(canvas.dataset.points || '[]') as Pt[];
  const { L, map } = await createMap(canvas);
  await import('leaflet.markercluster');
  const pinOf = (p: Pt) => L.divIcon({ className: 'map-hit map-hit-tag', iconSize: [0, 0], iconAnchor: [0, 0],
    html: `<span class="map-tag map-tag-${esc(p.tone ?? 'info')}">${esc(p.tag ?? '●')}</span>` });
  const cluster = (L as unknown as { markerClusterGroup: (o: object) => Leaflet.FeatureGroup & { addLayers(l: Leaflet.Layer[]): void; clearLayers(): void; getVisibleParent(m: Leaflet.Marker): Leaflet.Marker | null; zoomToShowLayer(m: Leaflet.Marker, cb: () => void): void } }).markerClusterGroup({
    showCoverageOnHover: false, maxClusterRadius: 60, spiderfyDistanceMultiplier: 1.6, chunkedLoading: true,
    iconCreateFunction: (c: { getChildCount(): number }) => { const n = c.getChildCount(); const sz = n < 10 ? 's' : n < 100 ? 'm' : 'l'; const hit = sz === 'l' ? 52 : 44;
      return L.divIcon({ className: 'map-hit', html: `<span class="map-cluster map-cluster-${sz}" aria-hidden="true"><b>${n.toLocaleString('ko-KR')}</b>곳</span><span class="sr-only">${n}곳 묶음, 눌러서 확대</span>`, iconSize: [hit, hit] }); },
  });
  const byId = new Map(points.map((p) => [p.id, p]));
  const markers = new Map<string, Leaflet.Marker>();
  let shown = new Set(points.map((p) => p.id));
  let active: string | null = canvas.dataset.focusId ?? null;
  let hoverEl: HTMLElement | null = null;
  const paint = (id: string) => markers.get(id)?.getElement()?.classList.toggle('is-active', id === active);

  for (const p of points) {
    const m = L.marker([p.lat, p.lng], { icon: pinOf(p), title: p.name, keyboard: true, alt: p.name });
    m.on('add', () => { m.getElement()?.setAttribute('aria-label', p.name); paint(p.id); });
    m.on('mouseover', () => { if (LG.matches) ctx.hovered(p.id); });
    m.on('mouseout', () => ctx.hovered(null));
    m.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      const prev = active; active = p.id; if (prev) paint(prev); paint(p.id);
      ctx.pick({ key: p.id, title: p.name, sub: p.addr, value: p.meta, note: p.badge, href: p.href }, (e as Leaflet.LeafletMouseEvent).originalEvent instanceof KeyboardEvent);
    });
    markers.set(p.id, m);
  }
  cluster.addLayers([...markers.values()]);
  map.addLayer(cluster);
  const clearHover = () => { hoverEl?.classList.remove('is-hover'); hoverEl = null; };
  map.on('zoomstart movestart', clearHover);

  const fit = () => {
    const f = active ? byId.get(active) : null;
    if (f) { map.setView([f.lat, f.lng], 16); return; }
    if (!points.length) return;
    const b = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
    if (points.length === 1) map.setView(b.getCenter(), 16); else map.fitBounds(b, { padding: [32, 32], maxZoom: 16 });
  };
  fit();
  if (active) { const m = markers.get(active); if (m) cluster.zoomToShowLayer(m, () => paint(active!)); }

  return {
    focus() { /* 핀 화면은 페이지마다 새로 그린다 */ },
    hover(id) {
      clearHover();
      const m = id ? markers.get(id) : null;
      if (!m || !shown.has(id!)) return;
      const vis = cluster.getVisibleParent(m);
      hoverEl = (vis?.getElement() as HTMLElement | undefined) ?? null;
      hoverEl?.classList.add('is-hover');
    },
    filter(ids) {
      const next = ids ?? new Set(points.map((p) => p.id));
      clearHover();
      shown = new Set([...next].filter((x) => markers.has(x)));
      cluster.clearLayers();
      cluster.addLayers([...shown].map((x) => markers.get(x)!));
    },
    resize() { map.invalidateSize(); },
    destroy() { map.remove(); },
  };
}
