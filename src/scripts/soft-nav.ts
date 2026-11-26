// 지도 화면 안에서 페이지 이동(2026-11-26 사용자 '상세 보고 지도로 돌아오기 어렵다').
// 같은 지도(data-kind)를 쓰는 페이지끼리는 전체를 다시 불러오지 않고 본문(#main)만 바꾼다.
// - 지도(#map-pane)는 그대로 남아 확대·위치·선택이 유지된다. 주소는 history.pushState로 실제 정적 페이지 주소가 되므로
//   새로고침·공유·검색엔진은 기존 정적 페이지를 그대로 본다.
// - 뒤로 가기는 이전 본문을 되살린다(받아 둔 HTML). 본문 맨 위에 '이전 화면으로' 버튼도 둔다.
// - 바뀐 본문의 스크립트는 onPage()로 등록된 초기화 함수를 'dnkk:swap' 이벤트로 다시 돌린다.
// - 받아 온 HTML은 같은 출처의 우리 정적 페이지뿐이고, 본문 노드를 그대로 옮긴다(인라인 스크립트는 실행되지 않음).
import { announce } from './copy.ts';

export type SwapDetail = { focus: Record<string, string | undefined> | null; url: string };
const cache = new Map<string, string>();
const keyOf = (u: URL) => u.pathname + u.search;
let current = '';
let depth = 0; // 이 탭에서 본문만 바꿔 이동한 횟수(되돌아가기 버튼 표시용)

function sameMap(doc: Document, kind: string) {
  return doc.querySelector(`#map-pane .map-canvas[data-kind="${kind}"]`);
}

async function load(url: URL): Promise<Document | null> {
  const k = keyOf(url);
  let html = cache.get(k);
  if (!html) {
    const r = await fetch(url.href, { headers: { Accept: 'text/html' } });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('text/html')) return null;
    html = await r.text();
    cache.set(k, html);
  }
  return new DOMParser().parseFromString(html, 'text/html');
}

function backButton() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'soft-back';
  b.textContent = '이전 화면으로';
  b.addEventListener('click', () => history.back());
  return b;
}

function swap(doc: Document, kind: string, url: URL, push: boolean) {
  const main = document.getElementById('main');
  const next = doc.getElementById('main');
  if (!main || !next) return false;
  main.replaceChildren(...[...next.childNodes].map((n) => document.importNode(n, true)));
  if (depth > 0) main.prepend(backButton());
  document.title = doc.title;
  for (const sel of ['meta[name="description"]', 'link[rel="canonical"]', 'meta[name="robots"]']) {
    const a = document.head.querySelector(sel), b = doc.head.querySelector(sel);
    if (a && b) a.replaceWith(document.importNode(b, true)); else if (a) a.remove(); else if (b) document.head.append(document.importNode(b, true));
  }
  if (push) history.pushState({ soft: kind, depth }, '', url.href);
  current = keyOf(url);
  // 패널 맨 위로, 포커스는 본문 시작(화면 읽기 프로그램에 새 제목을 알린다)
  main.scrollTop = 0;
  if (!matchMedia('(min-width: 1024px)').matches) scrollTo({ top: 0 });
  main.focus({ preventScroll: true });
  announce(`${doc.querySelector('h1')?.textContent?.trim() ?? doc.title} 화면이에요.`);
  // 광고 칸이 있으면 새로 채운다(AdSense 켜진 뒤)
  const w = window as unknown as { adsbygoogle?: unknown[] };
  if (w.adsbygoogle) main.querySelectorAll('ins.adsbygoogle:not([data-adsbygoogle-status])').forEach(() => w.adsbygoogle!.push({}));
  const canvas = sameMap(doc, kind) as HTMLElement | null;
  const focus = canvas?.dataset.focus ? JSON.parse(canvas.dataset.focus) : null;
  document.dispatchEvent(new CustomEvent<SwapDetail>('dnkk:swap', { detail: { focus, url: url.href } }));
  return true;
}

/** kind: 지도 종류(rent). 같은 종류 지도가 있는 페이지 사이에서만 본문을 바꾼다 */
export function initSoftNav(kind: string) {
  if (!document.querySelector(`#map-pane .map-canvas[data-kind="${kind}"]`) || !('pushState' in history)) return;
  current = keyOf(new URL(location.href));
  cache.set(current, document.documentElement.outerHTML);
  history.replaceState({ ...(history.state ?? {}), soft: kind, depth: 0 }, '');

  const go = async (url: URL, push: boolean) => {
    document.documentElement.classList.add('soft-loading');
    try {
      const doc = await load(url);
      if (doc && sameMap(doc, kind) && swap(doc, kind, url, push)) return;
      location.href = url.href; // 지도 종류가 다르거나 실패하면 보통 이동
    } catch { location.href = url.href; }
    finally { document.documentElement.classList.remove('soft-loading'); }
  };

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.target || a.hasAttribute('download') || a.closest('header, footer, nav[aria-label="주요 메뉴"]')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || url.hash && keyOf(url) === current) return;
    // 같은 도구(전월세) 안의 페이지와 홈만
    if (!(url.pathname.startsWith(`/${kind}/`) || url.pathname === '/')) return;
    if (keyOf(url) === current) { e.preventDefault(); return; }
    e.preventDefault();
    depth++;
    void go(url, true);
  });
  addEventListener('popstate', (e) => {
    const url = new URL(location.href);
    if (keyOf(url) === current) return; // 지도 전체 화면 닫기 등 주소가 같은 뒤로 가기
    if (!cache.has(keyOf(url)) && (!e.state || e.state.soft !== kind)) { location.reload(); return; }
    depth = Number(e.state.depth) || 0;
    void go(url, false);
  });
}

/** 본문이 바뀔 때마다 다시 돌려야 하는 초기화(탭·더 보기·계산기 등) */
export function onPage(fn: () => void) {
  fn();
  document.addEventListener('dnkk:swap', fn);
}
