// 지역 '틀'(2026-11-26 사용자 '한 단계 들어갈 때마다 바깥 테두리: 시·군·구면 시·도 경계, 읍면동이면 그 시·군·구 경계').
// 모든 지도(전월세·주차장·무인민원발급기)가 같은 모양을 쓴다:
// - 틀 = 지금 보는 지역의 바깥 경계. 중간 회청색 2.25px(80%) + 흰 테(halo). 검은 선은 쓰지 않는다(2026-11-26 사용자 '꼭 시커매야 하나').
// - 고른 동·마우스 올린 동은 흰 3px + 어두운 부드러운 그림자(CSS .rm-glow)로 어떤 배경 위에서도 보이게.
// - 틀 바깥은 덮지 않는다(2026-11-26 사용자 '주변을 굳이 회색으로 칠해야 하나' → 바깥 막 제거). 바깥은 색칠·라벨만 숨긴다.
// - 핀 지도(주차장 등)는 틀 안에 한 단계 아래 경계(시·군·구 또는 동)를 가는 선으로, 이 페이지의 동은 흰 굵은 선으로 강조.
// 경계 데이터는 /geo/area/*.json(통계 없음, src/lib/area-geo.ts). 지도 조작을 막지 않게 모두 interactive:false(동 이름 풍선만 예외).
import type * as Leaflet from 'leaflet';

export const AREA_SRC = '/geo/area/';
export const SLATE = '#475569';
export const PICK = '#FFFFFF';
type Geom = GeoJSON.Polygon | GeoJSON.MultiPolygon;
type FC = { type: 'FeatureCollection'; features: { type: 'Feature'; properties: Record<string, string>; geometry: Geom }[] };

const cache = new Map<string, Promise<FC | null>>();
export const getGeo = (url: string) => {
  let p = cache.get(url);
  if (!p) { p = fetch(url).then((r) => (r.ok ? (r.json() as Promise<FC>) : null)).catch(() => null); cache.set(url, p); }
  return p;
};

/** 틀 레이어: set(경계)로 바꾸고 set(null)로 지운다 */
export function createFrame(L: typeof Leaflet, map: Leaflet.Map) {
  const pane = (name: string, z: number) => { const p = map.getPane(name) ?? map.createPane(name); p.style.zIndex = String(z); p.style.pointerEvents = 'none'; return name; };
  const framePane = pane('dnkk-frame', 450); // 색칠 위, 핀·라벨(600) 아래
  let layers: Leaflet.Layer[] = [];
  let cur: Geom | null = null;
  return {
    set(g: Geom | null) {
      if (g === cur) return;
      cur = g;
      layers.forEach((l) => map.removeLayer(l)); layers = [];
      if (!g) return;
      const halo = L.geoJSON(g, { pane: framePane, interactive: false, style: { color: '#FFFFFF', weight: 5, opacity: 0.5, fill: false, lineJoin: 'round', lineCap: 'round' } });
      const line = L.geoJSON(g, { pane: framePane, interactive: false, style: { color: SLATE, weight: 2, opacity: 0.55, fill: false, lineJoin: 'round', lineCap: 'round', className: 'map-frame-line' } });
      layers = [halo, line];
      layers.forEach((l) => l.addTo(map));
    },
  };
}

export type Area = { sido: string; sgg?: string; dong?: string };
/** 핀 지도용: 페이지 지역의 틀 + 한 단계 아래 경계(가는 선) + 이 페이지의 동 강조. 경계가 없으면 아무것도 그리지 않는다 */
export async function areaFrame(L: typeof Leaflet, map: Leaflet.Map, a: Area) {
  const frame = createFrame(L, map);
  const framePane = 'dnkk-frame';
  let ghost: Leaflet.GeoJSON | null = null;
  const unghost = () => { if (ghost) { map.removeLayer(ghost); ghost = null; } };
  map.on('mouseout', unghost);
  if (a.sgg) {
    const [sg, emd] = await Promise.all([getGeo(`${AREA_SRC}sgg.json`), getGeo(`${AREA_SRC}emd/${a.sgg}.json`)]);
    const me = sg?.features.find((f) => f.properties.f === a.sgg);
    if (!me || !document.contains(map.getContainer())) return; // 그사이 지도가 바뀌었으면 그만
    if (emd) {
      const isMe = (k: string) => Boolean(a.dong) && (k === a.dong || k.endsWith(` ${a.dong}`));
      const kids = L.geoJSON(emd as unknown as GeoJSON.FeatureCollection, {
        style: (f) => (isMe(f!.properties.k)
          ? { color: PICK, weight: 3, opacity: 1, fillColor: '#FFFFFF', fillOpacity: 0.15, lineJoin: 'round', className: 'rm-glow' }
          : { color: '#64748B', weight: 1, opacity: 0.55, fillColor: '#FFFFFF', fillOpacity: 0, lineJoin: 'round' }),
        onEachFeature: (f, l) => {
          // 마우스를 올리면 동 이름(사용자 요청: 지도 위에서 지금 어디인지). 키보드 사용자는 목록·이동 경로로 같은 정보를 본다
          l.bindTooltip(String(f.properties.k), { sticky: true, direction: 'top', offset: [0, -12], className: 'rm-tip map-area-tip', opacity: 1 });
          if (!isMe(f.properties.k)) {
            // 테두리는 별도 유령 선으로(도형을 맨 앞으로 옮기면 mouseout을 놓쳐 강조가 남는다)
            l.on('mouseover', () => { unghost(); ghost = L.geoJSON(f.geometry, { pane: framePane, interactive: false, style: { color: PICK, weight: 3, opacity: 1, fill: false, lineJoin: 'round', className: 'rm-glow' } }).addTo(map); (l as Leaflet.Path).setStyle({ fillColor: '#FFFFFF', fillOpacity: 0.15 }); });
            l.on('mouseout', () => { unghost(); kids.resetStyle(l); });
          }
        },
      }).addTo(map);
      kids.eachLayer((l) => { if (isMe(((l as Leaflet.Polygon).feature!.properties as Record<string, string>).k)) (l as Leaflet.Path).bringToFront(); });
    }
    frame.set(me.geometry);
  } else {
    const [sd, sg] = await Promise.all([getGeo(`${AREA_SRC}sido.json`), getGeo(`${AREA_SRC}sgg.json`)]);
    const me = sd?.features.find((f) => f.properties.sido === a.sido);
    if (!me || !document.contains(map.getContainer())) return;
    if (sg) {
      L.geoJSON({ type: 'FeatureCollection', features: sg.features.filter((f) => f.properties.f.startsWith(`${a.sido}__`)) } as unknown as GeoJSON.FeatureCollection, {
        interactive: false, style: { color: '#64748B', weight: 1.25, opacity: 0.55, fill: false, lineJoin: 'round' },
      }).addTo(map);
    }
    frame.set(me.geometry);
  }
}
