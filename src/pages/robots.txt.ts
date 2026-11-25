// robots.txt: 정식 도메인이면 전체 허용 + 사이트맵, 임시 주소(*.pages.dev 등)면 전체 차단.
import type { APIRoute } from 'astro';
import { SITE_URL, NOINDEX_ALL } from '../config.ts';

export const GET: APIRoute = () =>
  new Response(
    NOINDEX_ALL
      ? 'User-agent: *\nDisallow: /\n'
      : `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap-index.xml\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
