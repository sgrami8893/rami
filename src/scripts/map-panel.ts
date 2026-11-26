// MapPanel 클라이언트: 패널이 화면 근처에 오면 Leaflet을 동적으로 불러와 핀·클러스터·요약 카드를 그린다.
// 보안: 핀 데이터는 빌드 때 만든 JSON이고, 카드에는 textContent·setAttribute만 쓴다(innerHTML 없음).
// CSS는 정적 import(지도가 있는 페이지에만 실림). 동적 import로 두면 빌드에서 CSS 파일이 빠지는 문제가 있었다.
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
type Pt = { id: string; name: string; lat: number; lng: number; href: string; meta?: string; badge?: string };
type Cfg = { url: string; attribution: string; maxZoom: number };

async function mount(panel: HTMLElement) {
  const canvas = panel.querySelector<HTMLElement>('.map-canvas')!;
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
  L.control.zoom({ zoomInTitle: '지도 확대', zoomOutTitle: '지도 축소' }).addTo(map); // 기본 영어 라벨(Zoom in/out) 대신 한국어
  const tiles = L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom, minZoom: 9, bounds: area, keepBuffer: 1 }).addTo(map);
  // 타일이 계속 실패하면(키 한도 초과·차단 등) 빈 지도 대신 안내 문구를 띄운다.
  let failed = 0;
  tiles.on('tileerror', () => {
    if (++failed !== 12) return;
    const note = document.createElement('p');
    note.className = 'absolute inset-x-3 top-3 z-[1000] rounded-xl bg-card px-3 py-2 text-cap text-ink-2 shadow';
    note.textContent = '배경지도를 불러오지 못하고 있어요. 핀 위치와 아래 목록은 그대로 볼 수 있어요.';
    canvas.parentElement?.appendChild(note);
  });

  // 핀·클러스터 모양은 우리 CSS(global.css .map-pin/.map-cluster)로 그린다(타사 아이콘 이미지 없음).
  // 보이는 핀은 22px, 누를 수 있는 영역은 44px(투명 래퍼)
  const pin = L.divIcon({ className: 'map-hit', html: '<span class="map-pin"></span>', iconSize: [44, 44], iconAnchor: [22, 22] });
  const cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50, // 44px 터치 영역보다 크게: 화면에서 50px 안에 붙은 핀은 묶어 터치 영역이 겹치지 않게
    iconCreateFunction: (c) => L.divIcon({ className: 'map-hit', html: `<span class="map-cluster" aria-hidden="true">${c.getChildCount()}</span><span class="sr-only">${c.getChildCount()}곳 묶음, 눌러서 확대</span>`, iconSize: [44, 44] }),
  });

  const card = panel.querySelector<HTMLElement>('.map-card')!;
  const set = (sel: string, t = '') => { const el = card.querySelector<HTMLElement>(sel)!; el.textContent = t; el.hidden = !t; };
  const open = (p: Pt) => {
    set('.map-card-badge', p.badge); set('.map-card-name', p.name); set('.map-card-meta', p.meta);
    card.querySelector('.map-card-link')!.setAttribute('href', p.href);
    card.hidden = false;
  };
  card.querySelector('.map-card-close')!.addEventListener('click', () => { card.hidden = true; });
  map.on('click', () => { card.hidden = true; });

  for (const p of points) {
    const m = L.marker([p.lat, p.lng], { icon: pin, title: p.name, keyboard: true, alt: p.name });
    m.on('add', () => m.getElement()?.setAttribute('aria-label', p.name)); // 화면 낭독기용 이름(title만으로는 읽지 않는 경우가 있음)
    m.on('click', (e) => { L.DomEvent.stopPropagation(e); open(p); });
    cluster.addLayer(m);
  }
  map.addLayer(cluster);
  const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number]));
  points.length === 1 ? map.setView(bounds.getCenter(), 16) : map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });

  const toggle = panel.querySelector<HTMLButtonElement>('.map-toggle')!;
  toggle.addEventListener('click', () => {
    const big = !canvas.hasAttribute('data-big');
    canvas.toggleAttribute('data-big', big);
    toggle.setAttribute('aria-pressed', String(big));
    toggle.textContent = big ? '지도 작게 보기' : '지도 크게 보기';
    setTimeout(() => map.invalidateSize(), 220);
  });
}

export function initMapPanels() {
  const panels = [...document.querySelectorAll<HTMLElement>('.map-panel')];
  if (!panels.length) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      mount(e.target as HTMLElement).catch((err) => {
        console.error('[map]', err);
        const l = e.target.querySelector('.map-loading');
        if (l) l.textContent = '지도를 불러오지 못했어요. 아래 목록을 이용해 주세요.';
      });
    }
  }, { rootMargin: '200px' });
  panels.forEach((p) => io.observe(p));
}
