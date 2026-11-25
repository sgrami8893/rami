// 가이드 글 RSS 2.0 (네이버 서치어드바이저 'RSS 제출'용, 구글도 피드로 인식).
// 사이트맵과 같은 정식 주소(SITE_URL)로 링크를 만든다. 본문 전체가 아니라 요약만 싣는다.
import type { APIRoute } from 'astro';
import { SITE_URL, SITE_NAME } from '../config.ts';
import { GUIDES } from '../lib/guides.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// 날짜만 있는 값은 한국 시간 오전 9시로 본다(RFC 822 형식 필요)
const rfc822 = (d: string) => new Date(`${d}T09:00:00+09:00`).toUTCString();

export const GET: APIRoute = () => {
  const items = [...GUIDES].sort((a, b) => b.modified.localeCompare(a.modified) || a.slug.localeCompare(b.slug));
  const latest = items[0]?.modified ?? '2026-11-25';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(`${SITE_NAME} 무인민원발급기 가이드`)}</title>
<link>${SITE_URL}/muin/guide/</link>
<description>무인민원발급기 이용 방법, 발급 시간, 수수료, 서류별 안내</description>
<language>ko</language>
<lastBuildDate>${rfc822(latest)}</lastBuildDate>
<atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items.map((g) => `<item>
<title>${esc(g.title)}</title>
<link>${SITE_URL}/muin/guide/${g.slug}/</link>
<guid isPermaLink="true">${SITE_URL}/muin/guide/${g.slug}/</guid>
<description>${esc(g.description)}</description>
<pubDate>${rfc822(g.published)}</pubDate>
</item>`).join('\n')}
</channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
