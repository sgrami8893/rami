// ads.txt: 애드센스 client(pub-…)가 config에 들어갔을 때만 만든다.
// 기록 없는 빈 ads.txt는 '승인된 판매자 없음'으로 읽혀 광고가 막힐 수 있으므로, 설정 전에는 파일 자체를 만들지 않는다.
import { ADSENSE } from '../config.ts';
export function getStaticPaths() { return ADSENSE.client ? [{ params: { ads: 'ads' } }] : []; }
export function GET() {
  const pub = ADSENSE.client.replace(/^ca-/, '');
  return new Response(`google.com, ${pub}, DIRECT, f08c47fec0942fa0\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
