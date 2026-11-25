import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { SITE_URL, TOOLS } from './src/config.ts';
import { hubNoindexPaths } from './src/lib/hubs.ts';

// 무인발급기: 대체 기기가 없는 상세 페이지는 noindex -> sitemap에서도 제외
const kiosks = JSON.parse(readFileSync(new URL('./src/data/kiosks.json', import.meta.url), 'utf8'));
const noindex = new Set(kiosks.filter((k) => !k.nearby?.length).map((k) => `/muin/${k.sido}/${k.sigungu}/k/${k.id}/`));
// 조건 허브(24h·weekend·registry·family) 중 색인 기준 미달 페이지도 제외 (src/lib/hubs.ts HUB_RULE)
hubNoindexPaths(kiosks, ['seoul', 'gyeonggi', 'incheon']).forEach((p) => noindex.add(p));

// 도구별 독립 사이트맵: sitemap-muin-0.xml, sitemap-waste-0.xml … + 허브 공통 페이지는 sitemap-0.xml
const chunks = Object.fromEntries(
  TOOLS.filter((t) => t.status === 'live').map((t) => [t.slug, (item) => (new URL(item.url).pathname.startsWith(t.path) ? item : undefined)]),
);

export default defineConfig({
  site: SITE_URL, // robots.txt 도 이 값으로 생성(src/pages/robots.txt.ts)
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap({ filter: (page) => !noindex.has(new URL(page).pathname), chunks })],
  vite: { plugins: [tailwindcss()] },
});
