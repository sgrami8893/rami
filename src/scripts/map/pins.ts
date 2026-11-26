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
  // 핀 v3: 요금 구분 색(무료 초록 · 유료 잉크 · 혼합 청록 · 확인 필요 회색) + 핵심 글자. 고른 핀은 이름이 위에 붙는다
  const pinOf = (p: Pt) => L.divIcon({ className: 'map-hit map-hit-tag', iconSize: [0, 0], iconAnchor: [0, 0],
    html: `<span class="map-tag map-tag-${esc(p.tone ?? 'info')}"><span class="nm">${esc(p.name)}</span>${esc(p.tag ?? '●')}</span>` });
  const cluster = (L as unknown as { markerClusterGroup: (o: object) => Leaflet.FeatureGroup & { addLayers(l: Leaflet.Layer[]): void; clearLayers(): void; getVisibleParent(m: Leaflet.Marker): Leaflet.Marker | null; zoomToShowLayer(m: Leaflet.Marker, cb: () => void): void } }).markerClusterGroup({
    showCoverageOnHover: false, maxClusterRadius: 60, spiderfyDistanceMultiplier: 1.6, chunkedLoading: true,
    // 묶음 v3(2026-11-26 '지도 더 편하게'): 'N곳' + 그 안 무료 개수(초록 점). 무료를 찾는 사람이 확대 전에 어디로 갈지 알 수 있게
    iconCreateFunction: (c: { getChildCount(): number; getAllChildMarkers(): Leaflet.Marker[] }) => {
      const n = c.getChildCount(); const sz = n < 10 ? 's' : n < 100 ? 'm' : 'l'; const hit = sz === 'l' ? 52 : 44;
      const free = c.getAllChildMarkers().filter((m) => (m.options as { tone?: string }).tone === 'free').length;
      return L.divIcon({ className: 'map-hit', html: `<span class="map-cluster map-cluster-${sz}" aria-hidden="true"><b>${n.toLocaleString('ko-KR')}</b>곳${free ? `<em>무료 ${free}</em>` : ''}</span><span class="sr-only">${n}곳 묶음${free ? `, 무료 ${free}곳` : ''}, 눌러서 확대</span>`, iconSize: [hit, hit] }); },
  });
  const byId = new Map(points.map((p) => [p.id, p]));
  const markers = new Map<string, Leaflet.Marker>();
  let shown = new Set(points.map((p) => p.id));
  let active: string | null = canvas.dataset.focusId ?? null;
  let hoverEl: HTMLElement | null = null;
  const paint = (id: string) => markers.get(id)?.getElement()?.classList.toggle('is-active', id === active);

  for (const p of points) {
    const m = L.marker([p.lat, p.lng], { icon: pinOf(p), title: p.name, keyboard: true, alt: p.name, tone: p.tone } as Leaflet.MarkerOptions);
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
    if (points.length === 1) map.setView(b.getCenter(), 16); else map.fitBounds(b, { paddingTopLeft: [32, 72], paddingBottomRight: [56, 32], maxZoom: 16 });
  };
  fit();
  if (active) { const m = markers.get(active); if (m) cluster.zoomToShowLayer(m, () => paint(active!)); }

  let meMarker: Leaflet.CircleMarker | null = null;
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
    me(pt, near) {
      meMarker?.remove();
      // 이 화면 지역 밖의 가까운 주차장도 핀으로 더한다(내 주변은 지역 경계를 모름)
      const add: Leaflet.Marker[] = [];
      for (const l of near ?? []) {
        const id = `near:${l.href}`;
        if ([...byId.values()].some((p) => p.href === l.href) || markers.has(id)) continue;
        const p: Pt = { id, name: l.name, lat: l.lat, lng: l.lng, href: l.href, tag: l.tag, tone: l.tone };
        byId.set(id, p);
        const m = L.marker([p.lat, p.lng], { icon: pinOf(p), title: p.name, keyboard: true, alt: p.name, tone: p.tone } as Leaflet.MarkerOptions);
        m.on('click', (e) => { L.DomEvent.stopPropagation(e); ctx.pick({ key: id, title: p.name, value: p.tag, href: p.href }, (e as Leaflet.LeafletMouseEvent).originalEvent instanceof KeyboardEvent); });
        markers.set(id, m); shown.add(id); add.push(m);
      }
      if (add.length) cluster.addLayers(add);
      meMarker = L.circleMarker([pt.lat, pt.lng], { radius: 9, color: '#FFFFFF', weight: 3, fillColor: '#191F28', fillOpacity: 1, interactive: false, className: 'rm-glow' }).bindTooltip('내 위치', { direction: 'top', offset: [0, -10], className: 'rm-tip' }).addTo(map);
      const pts: [number, number][] = [[pt.lat, pt.lng], ...(near ?? []).slice(0, 5).map((l) => [l.lat, l.lng] as [number, number])];
      if (pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding: [48, 48], maxZoom: 16 }); else map.setView([pt.lat, pt.lng], 15);
    },
    resize() { map.invalidateSize(); },
    destroy() { map.remove(); },
  };
}
