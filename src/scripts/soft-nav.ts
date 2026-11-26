// 지도 화면 안에서 페이지 이동(2026-11-26 사용자 '상세 보고 지도로 돌아오기 어렵다', '도구 누르면 바로 지도 전환').
// 지도(#map-pane)가 있는 페이지끼리는 전체를 다시 불러오지 않고 바꾼다.
// - 같은 전월세 지도끼리: 본문(#main)만 바꾸고 지도는 그대로(확대·위치·선택 유지). 'dnkk:swap'으로 지도 초점만 옮긴다.
// - 그 밖(전월세↔주차장, 주차장 지역끼리): 본문과 지도 칸을 함께 바꾸고 지도를 새로 그린다. 도구 전환(data-keep-view)이면 지금 지도 위치를 그대로 쓴다.
//   배경지도 조각은 브라우저가 이미 받아 둔 것을 다시 쓴다(저장·프록시 없음).
// - 주소는 history.pushState로 실제 정적 페이지 주소가 되므로 새로고침·공유·검색엔진은 정적 페이지를 그대로 본다.
// - 새 본문에 처음 보는 스크립트(<script type=module src>)가 있으면 한 번 불러오고, 이미 불러온 스크립트는 onPage()로 등록된 초기화를 다시 돌린다.
// - 받아 온 HTML은 같은 출처의 우리 정적 페이지뿐이다. 인라인 스크립트는 실행하지 않는다.
import { announce } from './copy.ts';

export type SwapDetail = { focus: Record<string, string | undefined> | null; url: string; remount: boolean };
const cache = new Map<string, string>();
const keyOf = (u: URL) => u.pathname + u.search;
let current = '';
let depth = 0; // 이 탭에서 바꿔 이동한 횟수(되돌아가기 버튼 표시용)
let started = false;
const loadedSrc = new Set<string>();
/** 도구 전환 때 넘겨줄 지도 위치(map-panel·rent-map이 새 지도를 그릴 때 한 번 쓴다) */
let keepView: { lat: number; lng: number; zoom: number } | null = null;
export const takeView = () => { const v = keepView; keepView = null; return v; };
export const setView = (v: { lat: number; lng: number; zoom: number } | null) => { keepView = v; };

const kindOf = (doc: Document) => (doc.querySelector('#map-pane .map-canvas') as HTMLElement | null)?.dataset.kind || (doc.querySelector('#map-pane') ? 'pins' : '');
const PATHS = /^\/($|rent\/|parking\/|muin\/)/;

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


/** 옮겨 온 노드 안의 모듈 스크립트: 처음 보는 것만 새 요소로 만들어 실행(같은 주소는 브라우저가 한 번만 실행) */
function runScripts(root: ParentNode) {
  root.querySelectorAll<HTMLScriptElement>('script[type="module"][src]').forEach((s) => {
    const src = new URL(s.getAttribute('src')!, location.href).href;
    if (loadedSrc.has(src)) return;
    loadedSrc.add(src);
    const n = document.createElement('script'); n.type = 'module'; n.src = src;
    document.body.append(n);
  });
}

function swap(doc: Document, url: URL, push: boolean) {
  const main = document.getElementById('main');
  const next = doc.getElementById('main');
  if (!main || !next) return false;
  const remount = kindOf(doc) !== 'rent' || kindOf(document) !== 'rent';
  main.replaceChildren(...[...next.childNodes].map((n) => document.importNode(n, true)));
  if (remount) {
    const pane = document.getElementById('map-pane'), np = doc.getElementById('map-pane');
    if (pane && np) { document.dispatchEvent(new CustomEvent('dnkk:unmount')); pane.replaceWith(document.importNode(np, true)); }
  }
  // 머리말 도구 메뉴의 '지금 도구' 표시와 문서 정보
  const tool = url.pathname.split('/')[1] || 'rent';
  document.querySelectorAll<HTMLAnchorElement>('.v-tools a').forEach((a) => {
    const on = new URL(a.href).pathname.split('/')[1] === tool;
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.documentElement.dataset.tool = doc.documentElement.dataset.tool ?? '';
  document.title = doc.title;
  for (const sel of ['meta[name="description"]', 'link[rel="canonical"]', 'meta[name="robots"]']) {
    const a = document.head.querySelector(sel), b = doc.head.querySelector(sel);
    if (a && b) a.replaceWith(document.importNode(b, true)); else if (a) a.remove(); else if (b) document.head.append(document.importNode(b, true));
  }
  if (push) history.pushState({ soft: 1, depth }, '', url.href);
  current = keyOf(url);
  main.scrollTop = 0;
  if (!matchMedia('(min-width: 1024px)').matches) scrollTo({ top: 0 });
  main.focus({ preventScroll: true });
  announce(`${doc.querySelector('h1')?.textContent?.trim() ?? doc.title} 화면이에요.`);
  const w = window as unknown as { adsbygoogle?: unknown[] };
  if (w.adsbygoogle) main.querySelectorAll('ins.adsbygoogle:not([data-adsbygoogle-status])').forEach(() => w.adsbygoogle!.push({}));
  const canvas = doc.querySelector('#map-pane .map-canvas') as HTMLElement | null;
  const focus = canvas?.dataset.focus ? JSON.parse(canvas.dataset.focus) : null;
  document.dispatchEvent(new CustomEvent<SwapDetail>('dnkk:swap', { detail: { focus, url: url.href, remount } }));
  runScripts(main);
  if (remount) runScripts(document.getElementById('map-pane') ?? document);
  return true;
}

/** 지도 화면 안 이동. 지도 없는 페이지로 가면 보통 이동 */
export async function navigate(url: URL, push = true) {
  if (!started) { location.href = url.href; return; }
  document.documentElement.classList.add('soft-loading');
  try {
    const doc = await load(url);
    if (doc && kindOf(doc) && swap(doc, url, push)) return;
    location.href = url.href;
  } catch { location.href = url.href; }
  finally { document.documentElement.classList.remove('soft-loading'); }
}

export function initSoftNav() {
  if (started || !document.getElementById('map-pane') || !('pushState' in history)) return;
  started = true;
  document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]').forEach((s) => loadedSrc.add(new URL(s.getAttribute('src')!, location.href).href));
  current = keyOf(new URL(location.href));
  history.replaceState({ ...(history.state ?? {}), soft: 1, depth: 0 }, '');

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.target || a.hasAttribute('download') || a.closest('header, footer')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || (url.hash && keyOf(url) === current)) return;
    if (!PATHS.test(url.pathname)) return;
    e.preventDefault();
    if (keyOf(url) === current) return;
    depth++;
    // 지도 위 도구 전환은 지금 보던 지도 위치를 그대로 이어 간다
    if (a.hasAttribute('data-keep-view')) document.dispatchEvent(new CustomEvent('dnkk:keep-view'));
    void navigate(url);
  });
  addEventListener('popstate', (e) => {
    const url = new URL(location.href);
    if (keyOf(url) === current) return; // 지도 전체 화면 닫기 등 주소가 같은 뒤로 가기
    if (!cache.has(keyOf(url)) && (!e.state || !e.state.soft)) { location.reload(); return; }
    depth = Number(e.state?.depth) || 0;
    void navigate(url, false);
  });
}

/** 페이지가 history.replaceState로 주소(쿼리)를 바꾼 뒤 알려 준다(같은 주소 링크 판정이 어긋나지 않게) */
export const noteUrl = () => { if (started) current = keyOf(new URL(location.href)); };

/** 본문이 바뀔 때마다 다시 돌려야 하는 초기화(탭·더 보기·계산기 등). 자기 요소가 없으면 아무것도 하지 않게 짠다 */
export function onPage(fn: () => void) {
  fn();
  document.addEventListener('dnkk:swap', fn);
}
