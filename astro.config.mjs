import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { SITE_URL, TOOLS, CHECKLIST_VERIFIED } from './src/config.ts';
import { hubNoindexPaths } from './src/lib/hubs.ts';

// 무인발급기: 대체 기기가 없는 상세 페이지는 noindex -> sitemap에서도 제외
const kiosks = JSON.parse(readFileSync(new URL('./src/data/kiosks.json', import.meta.url), 'utf8'));
const noindex = new Set(kiosks.filter((k) => !k.nearby?.length).map((k) => `/muin/${k.sido}/${k.sigungu}/k/${k.id}/`));
// 조건 허브(24h·weekend·registry·family) 중 색인 기준 미달 페이지도 제외 (src/lib/hubs.ts HUB_RULE)
hubNoindexPaths(kiosks, ['seoul', 'gyeonggi', 'incheon']).forEach((p) => noindex.add(p));
if (!CHECKLIST_VERIFIED) noindex.add('/muin/checklist/');
// 준비 중(status 'soon') 도구 경로는 미리보기 빌드에서 페이지가 생겨도 사이트맵에 넣지 않는다
const notLive = TOOLS.filter((t) => t.status !== 'live').map((t) => t.path);

// 도구별 독립 사이트맵: sitemap-muin-0.xml, sitemap-waste-0.xml … + 허브 공통 페이지는 sitemap-0.xml
const chunks = Object.fromEntries(
  TOOLS.filter((t) => t.status === 'live').map((t) => [t.slug, (item) => (new URL(item.url).pathname.startsWith(t.path) ? item : undefined)]),
);

export default defineConfig({
  site: SITE_URL, // robots.txt 도 이 값으로 생성(src/pages/robots.txt.ts)
  trailingSlash: 'always',
  // 첫 화면까지 왕복 1회를 줄이려고 CSS를 HTML에 넣는다(대부분 검색으로 한 페이지만 보고 나가는 방문이라 이득이 큼)
  build: { format: 'directory', inlineStylesheets: 'always' },
  // 링크에 손가락·마우스를 올리면 다음 페이지를 미리 받아 둔다(화면에 보이는 링크 전체를 받지는 않음: 데이터 절약)
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  integrations: [sitemap({ filter: (page) => { const p = new URL(page).pathname; return !noindex.has(p) && !notLive.some((t) => p.startsWith(t)); }, chunks })],
  vite: { plugins: [tailwindcss()] },
});
