// robots.txt: 정식 도메인이면 전체 허용 + 사이트맵, 임시 주소(*.pages.dev 등)면 전체 차단.
import type { APIRoute } from 'astro';
import { SITE_URL, NOINDEX_ALL } from '../config.ts';

const PREVIEW_BOTS = ['kakaotalk-scrap', 'facebookexternalhit', 'Facebot', 'Twitterbot', 'Slackbot-LinkExpanding', 'Slackbot', 'Discordbot', 'TelegramBot', 'LinkedInBot', 'WhatsApp'];

export const GET: APIRoute = () =>
  new Response(
    NOINDEX_ALL
      // 임시 주소: 검색엔진은 막되, 메신저·SNS 링크 미리보기 봇은 허용(막으면 공유 카드 이미지가 빈 칸이 된다)
      ? `${PREVIEW_BOTS.map((b) => `User-agent: ${b}`).join('\n')}\nAllow: /\n\nUser-agent: *\nAllow: /og.png\nAllow: /og-\nAllow: /og/\nAllow: /apple-touch-icon.png\nAllow: /favicon.svg\nDisallow: /\n`
      : `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap-index.xml\n`,
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
