// 새 지도 v2 바탕(2026-11-26 사용자 '지도도 예전 것 고려 없이 가장 편하게').
// - Leaflet(BSD-2)을 우리 번들에서 늦게 불러온다. 배경지도 타일은 브라우저가 브이월드에서 직접 받는다(저장·캐시·프록시 없음, 약관 19조 6항).
// - PC 휠로 바로 확대(클릭·Ctrl 없이). 확대·축소 버튼은 오른쪽 아래 하나. 축척·단계 막대 없음.
// - 수도권 밖으로 멀리 끌려가지 않게 범위를 묶는다(타일 요청 수도 줄어듦).
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';

export type Cfg = { url: string; attribution: string; maxZoom: number };
// 동쪽을 넉넉히(129.6): 넓은 PC 화면에서 지도 범위 제한 때문에 수도권이 오른쪽으로 밀리던 문제(2026-11-27)
export const AREA: [[number, number], [number, number]] = [[36.6, 124.5], [38.5, 129.6]];
export type { Leaflet };

export async function createMap(canvas: HTMLElement) {
  const cfg = JSON.parse(canvas.dataset.cfg || '{}') as Cfg;
  const { default: L } = await import('leaflet');
  (window as unknown as { L: typeof L }).L = L; // markercluster 1.x는 전역 L에 붙는다
  const area = L.latLngBounds(AREA);
  const map = L.map(canvas, { zoomControl: false, attributionControl: true, scrollWheelZoom: true, maxBounds: area, maxBoundsViscosity: 1,
    minZoom: 8, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 100 });
  // 넓은 화면에서 최대로 줄이면 수도권 범위(AREA)보다 화면이 커져 타일 없는 빈 칸·회색 판이 보였다(2026-11-27 사용자)
  // → 범위가 화면을 늘 꽉 채우는 단계까지만 줄어들게 한다
  const fitMin = () => { const s = map.getSize(); if (!s.x || !s.y) return; map.setMinZoom(Math.max(8, Math.ceil(map.getBoundsZoom(area, true) * 4) / 4)); };
  fitMin(); map.on('resize', fitMin);
  map.attributionControl.setPrefix('Leaflet');
  L.control.zoom({ position: 'bottomright', zoomInTitle: '지도 확대', zoomOutTitle: '지도 축소' }).addTo(map);
  const tiles = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom, minZoom: 8, bounds: area.pad(0.05), keepBuffer: 4, updateWhenZooming: false, updateWhenIdle: L.Browser.mobile }).addTo(map);
  let failed = 0;
  tiles.on('tileerror', () => {
    if (++failed !== 12) return;
    const note = document.createElement('p');
    note.className = 'map-float absolute inset-x-3 top-3 z-[1000] px-3 py-2 text-cap text-ink-2';
    note.textContent = '배경지도를 불러오지 못하고 있어요. 색칠과 목록은 그대로 볼 수 있어요.';
    canvas.parentElement?.appendChild(note);
  });
  const ro = new ResizeObserver(() => map.invalidateSize());
  ro.observe(canvas);
  map.on('unload', () => ro.disconnect());
  // 색칠·선 칸: 도형(아래) < 강조선 < 라벨·핀(위)
  map.createPane('v2-fill').style.zIndex = '410';
  map.createPane('v2-line').style.zIndex = '420';
  return { L, map };
}

export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const LG = matchMedia('(min-width: 1024px)');
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** 라벨 겹침 피하기: 중요한 것부터 놓고, 이미 놓인 상자와 겹치면 숨긴다 */
export function placeLabels(items: { el: HTMLElement; x: number; y: number; w: number; h: number }[]) {
  const placed: { l: number; t: number; r: number; b: number }[] = [];
  for (const it of items) {
    const box = { l: it.x - it.w / 2 - 3, t: it.y - it.h / 2 - 3, r: it.x + it.w / 2 + 3, b: it.y + it.h / 2 + 3 };
    const hit = placed.some((p) => box.l < p.r && box.r > p.l && box.t < p.b && box.b > p.t);
    it.el.style.visibility = hit ? 'hidden' : '';
    if (!hit) placed.push(box);
  }
}

/** 내 위치 표시 = 로고 '콕 핀'(2026-11-27 브랜드 B). 처음 찍힐 때 한 번만 퍼지는 고리(600ms, 움직임 줄이기면 없음). 꼬리 끝이 좌표 */
export const ME_HTML = '<span class="me-pin" aria-hidden="true"><i class="kok-rip"></i><svg viewBox="0 0 24 24" width="34" height="34"><defs><linearGradient id="megr" x1="0" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#6B1F57"/><stop offset="1" stop-color="#B23A5B"/></linearGradient></defs><path d="M12 23.2 8.7 19.4H6.4A4.4 4.4 0 0 1 2 15V6.4A4.4 4.4 0 0 1 6.4 2h11.2A4.4 4.4 0 0 1 22 6.4V15a4.4 4.4 0 0 1-4.4 4.4h-2.3Z" fill="url(#megr)" stroke="#fff" stroke-width="1.4"/><circle cx="12" cy="10.7" r="4" fill="#fff"/><circle cx="12" cy="10.7" r="1.7" fill="#F59A4E"/></svg><span class="sr-only">내 위치</span></span>';
export const meIcon = (L: typeof import('leaflet')) => L.divIcon({ className: 'me-wrap', html: ME_HTML, iconSize: [34, 34], iconAnchor: [17, 33] });
