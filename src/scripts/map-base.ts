// 지도 공통 바탕(주차장 핀 지도·전월세 단계구분도가 함께 쓴다).
// - Leaflet(BSD-2)을 우리 번들에서 늦게 불러온다. 배경지도 타일은 브라우저가 제공처에서 직접 받는다(저장·캐시·프록시 없음, VWorld 약관 19조 6항).
// - 남용 완화: 수도권 밖으로 끌고 가거나 아주 멀리 축소하지 못하게 해서 사용자 한 명이 만드는 타일 요청 수를 줄인다.
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';

export type Cfg = { url: string; attribution: string; maxZoom: number };
export const AREA: [[number, number], [number, number]] = [[36.8, 124.5], [38.4, 128.0]];

export async function baseMap(canvas: HTMLElement) {
  const cfg = JSON.parse(canvas.dataset.cfg || '{}') as Cfg;
  const { default: L } = await import('leaflet');
  (window as unknown as { L: typeof L }).L = L; // markercluster 1.x는 전역 L에 붙는다
  canvas.querySelector('.map-loading')?.remove();
  const area = L.latLngBounds(AREA);
  const map = L.map(canvas, { zoomControl: false, attributionControl: true, scrollWheelZoom: true, // PC: 지도 위에서 휠로 바로 확대·축소(사용자 요청 2026-11-26)
    maxBounds: area, maxBoundsViscosity: 1, minZoom: 9, zoomSnap: 0.5, wheelPxPerZoomLevel: 90 });
  map.attributionControl.setPrefix('Leaflet');
  L.control.zoom({ position: 'topright', zoomInTitle: '지도 확대', zoomOutTitle: '지도 축소' }).addTo(map); // 기본 영어 라벨 대신 한국어
  L.control.scale({ position: 'bottomright', imperial: false, maxWidth: 90 }).addTo(map); // 거리 축척(m·km)
  // 배경지도는 모든 지도에서 VWorld 기본(Base) 지도(2026-11-26 사용자 '일반 지도면 된다'). VWorld에는 gray 레이어가 없어 오류가 났다
  // (허용 값: Base, midnight, Hybrid, Satellite, white).
  const url = cfg.url;
  // 단계구분도 아래 배경지도는 옅게(투명도만 낮춤, 타일 내용은 그대로) 해서 색칠이 배경 글자·도로에 묻히지 않게 한다
  // 배경지도 캐시(2026-11-26 사용자 '최대한 캐시'): VWorld 약관 19조 6항(데이터 저장 금지) 때문에 서비스워커·프록시·자체 저장은 쓰지 않는다.
  // 대신 ① 타일 주소에 캐시를 깨는 값을 붙이지 않아 브라우저 HTTP 캐시가 그대로 작동하고 ② 화면 밖 타일을 4칸까지 지우지 않고 남겨(keepBuffer)
  // 지도를 되돌려 끌 때 다시 받지 않으며 ③ 확대·축소 중에는 새 타일을 요청하지 않는다(updateWhenZooming false, 모바일은 멈춘 뒤에만 요청).
  // 지도 화면 안 이동(soft-nav)은 지도를 새로 만들지 않으므로 이미 받은 타일을 그대로 쓴다.
  const tiles = L.tileLayer(url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom, minZoom: 9, bounds: area, keepBuffer: 4,
    updateWhenZooming: false, updateWhenIdle: L.Browser.mobile, opacity: 1 }).addTo(map);
  // 타일이 계속 실패하면(키 한도 초과·차단 등) 빈 지도 대신 안내 문구를 띄운다.
  let failed = 0;
  tiles.on('tileerror', () => {
    if (++failed !== 12) return;
    const note = document.createElement('p');
    note.className = 'map-float absolute inset-x-3 bottom-14 z-[1000] px-3 py-2 text-cap text-ink-2';
    note.textContent = '배경지도를 불러오지 못하고 있어요. 지도 위 정보와 목록은 그대로 볼 수 있어요.';
    canvas.parentElement?.appendChild(note);
  });
  // 패널 크기가 바뀌면(모바일 전체 화면 열기, 창 크기 변경) 지도 크기를 다시 잰다
  new ResizeObserver(() => map.invalidateSize()).observe(canvas);
  return { L, map };
}
export type { Leaflet };
