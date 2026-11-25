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

  const map = L.map(canvas, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
  map.attributionControl.setPrefix('Leaflet');
  L.tileLayer(cfg.url, { attribution: cfg.attribution, maxZoom: cfg.maxZoom, crossOrigin: false }).addTo(map);

  // 핀·클러스터 모양은 우리 CSS(global.css .map-pin/.map-cluster)로 그린다(타사 아이콘 이미지 없음).
  const pin = L.divIcon({ className: 'map-pin', iconSize: [22, 22], iconAnchor: [11, 11] });
  const cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 50,
    iconCreateFunction: (c) => L.divIcon({ className: 'map-cluster', html: `<span>${c.getChildCount()}</span>`, iconSize: [40, 40] }),
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
