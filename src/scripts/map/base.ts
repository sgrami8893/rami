// 새 지도 v2 바탕(2026-11-26 사용자 '지도도 예전 것 고려 없이 가장 편하게').
// - Leaflet(BSD-2)을 우리 번들에서 늦게 불러온다. 배경지도 타일은 브라우저가 브이월드에서 직접 받는다(저장·캐시·프록시 없음, 약관 19조 6항).
// - PC 휠로 바로 확대(클릭·Ctrl 없이). 확대·축소 버튼은 오른쪽 아래 하나. 축척·단계 막대 없음.
// - 수도권 밖으로 멀리 끌려가지 않게 범위를 묶는다(타일 요청 수도 줄어듦).
import 'leaflet/dist/leaflet.css';
import type * as Leaflet from 'leaflet';

export type Cfg = { url: string; attribution: string; maxZoom: number };
export const AREA: [[number, number], [number, number]] = [[36.8, 124.5], [38.4, 128.0]];
export type { Leaflet };

export async function createMap(canvas: HTMLElement) {
  const cfg = JSON.parse(canvas.dataset.cfg || '{}') as Cfg;
  const { default: L } = await import('leaflet');
  (window as unknown as { L: typeof L }).L = L; // markercluster 1.x는 전역 L에 붙는다
  canvas.querySelector('.map-loading')?.remove();
  const area = L.latLngBounds(AREA);
  const map = L.map(canvas, { zoomControl: false, attributionControl: true, scrollWheelZoom: true, maxBounds: area, maxBoundsViscosity: 1,
    minZoom: 9, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 100 });
  map.attributionControl.setPrefix('Leaflet');
  L.control.zoom({ position: 'bottomright', zoomInTitle: '지도 확대', zoomOutTitle: '지도 축소' }).addTo(map);
  const tiles = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom, minZoom: 9, bounds: area, keepBuffer: 4, updateWhenZooming: false, updateWhenIdle: L.Browser.mobile }).addTo(map);
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
