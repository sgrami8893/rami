// Page titles, descriptions and summary paragraphs (templates from Gemini, 2026-11-25).
import { subGuOf, type RegionStats, type SidoSlug } from './data.ts';
import { SIDO } from '../../scripts/lib/regions.ts';
import type { Kiosk } from '../../scripts/lib/normalize.ts';
import type { HubCond } from './hubs.ts';

const sidoFull = (s: SidoSlug) => SIDO[s].name;

const n = (x: number) => x.toLocaleString('ko-KR');
/** 묶음 단위: 일반구가 있는 시는 구별, 군은 읍·면별, 나머지는 동별 */
const groupUnit = (st: RegionStats) => (subGuOf(st.sido, st.sigungu).length ? '구별로' : st.sigunguName.endsWith('군') ? '읍·면별로' : '동별로');

// ① 메인 (/muin/) — '실시간'은 쓰지 않는다: 기기 상태가 아니라 공개된 운영시간으로 계산한 값이다.
export const homeTitle = (total: number) => `수도권 무인민원발급기 ${n(total)}곳 위치·운영시간 | 지금 운영시간인 곳 찾기`;
export const homeDescription = (total: number) =>
  `서울·경기·인천 무인민원발급기 ${n(total)}곳의 운영시간 기준 지금 운영 여부, 24시간·주말 운영, 등기부등본·가족관계증명서 발급 가능 기기를 한눈에 확인하세요.`;

// ② 시/도
export interface SidoTotals { total: number; is24h: number; openWeekend: number; registry: number }
export const sidoTitle = (s: SidoSlug, t: SidoTotals) => `${SIDO_SHORT[s]} 무인민원발급기 ${n(t.total)}곳 | 24시간·주말 운영 위치`;
export const sidoDescription = (s: SidoSlug, t: SidoTotals) =>
  `${sidoFull(s)} 무인민원발급기 ${n(t.total)}곳의 위치와 운영시간을 시·군·구별로 정리했어요. 24시간 ${n(t.is24h)}곳, 주말·공휴일 운영 ${n(t.openWeekend)}곳, 등기부등본 발급 기기를 바로 찾아보세요.`;

// ③ 시/군/구
export function regionPageTitle(st: RegionStats): string {
  const gu = subGuOf(st.sido, st.sigungu);
  if (gu.length) return `${st.sigunguName}(${gu.join('·')}) 무인민원발급기 위치·24시간·주말 운영`;
  return st.is24h > 0
    ? `${st.sigunguName} 무인민원발급기 위치·운영시간 (24시간 ${st.is24h}곳·주말 ${st.openWeekend}곳)`
    : `${st.sigunguName} 무인민원발급기 위치·운영시간 (총 ${st.total}곳·주말 ${st.openWeekend}곳)`;
}

export const regionDescription = (st: RegionStats) =>
  `${sidoFull(st.sido)} ${st.sigunguName} 무인민원발급기 ${st.total}곳의 운영시간과 발급 가능 서류 안내. 24시간 ${st.is24h}곳, 주말·공휴일 ${st.openWeekend}곳, 등기부등본 ${st.docs.registry ?? 0}곳을 ${groupUnit(st)} 확인하세요.`;

export function regionSummary(st: RegionStats): string {
  const gu = subGuOf(st.sido, st.sigungu);
  const s = [`${sidoFull(st.sido)} ${st.sigunguName}에는 무인민원발급기가 ${st.total}곳 있어요.`];
  if (gu.length) s.push(`구별로는 ${gu.map((g) => `${g} ${st.bySubGu[g] ?? 0}곳`).join(', ')}이에요.`);
  s.push(
    (st.is24h > 0 ? `24시간 이용할 수 있는 곳은 ${st.is24h}곳이며, ` : '24시간 운영 기기는 없으며, ') +
      `주말·공휴일에 운영하는 곳은 ${st.openWeekend}곳, 밤 10시 이후에도 이용할 수 있는 곳은 ${st.openAfter22}곳이에요.`,
  );
  s.push(`법원 발급 서류(등기부등본·가족관계증명서) 중 등기부등본을 뗄 수 있는 기기는 ${st.docs.registry ?? 0}곳이에요.`);
  if (st.latestBaseDate) s.push(`(데이터 기준일: ${st.latestBaseDate})`);
  return s.join(' ');
}

// ④ 기기 상세
/** 도로명주소 괄호 안에 상세위치가 이미 있으면 다시 붙이지 않는다. */
const detailOf = (k: Kiosk) => (k.locationDetail && !k.roadAddress.includes(k.locationDetail) ? k.locationDetail : '');
export const kioskTitle = (k: Kiosk) => {
  const loc = k.locationDetail && k.locationDetail.length <= 16 ? `(${k.locationDetail})` : '';
  const area = k.name.includes(k.sigunguName.replace(/[시군구]$/, '')) ? '' : ` - ${k.sigunguName}`;
  return `${k.name} 무인민원발급기${loc} 운영시간·발급 서류${area}`;
};
export const kioskDescription = (k: Kiosk) => {
  const d = detailOf(k);
  return `${k.sigunguName} ${k.name} 무인민원발급기 안내. ${k.roadAddress}${d ? ` ${d}` : ''}. 요일별 운영시간, 등기부등본·가족관계증명서 발급 여부와 같은 동네의 다른 기기를 확인하세요.`;
};

export const SIDO_URL_NAME: Record<SidoSlug, string> = { seoul: '서울', gyeonggi: '경기', incheon: '인천' };
const SIDO_SHORT = SIDO_URL_NAME;

// ⑤ 시·군·구 '이용 요약' (콘텐츠 보강, 2026-11-25): 이 지역 데이터에 실제로 있는 값만 문장으로 만든다.
// 조건이 없으면 문장을 뺀다(모든 페이지에 같은 문장이 반복되지 않게). 동의어 바꿔 끼우기 같은 가짜 다양화는 하지 않는다.
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export function regionUsageSummary(st: RegionStats, ks: Kiosk[], all: RegionStats[]): string[] {
  const out: string[] = [];
  const short = SIDO_SHORT[st.sido];
  const peers = all.filter((r) => r.sido === st.sido);
  const rank = peers.filter((r) => r.total > st.total).length + 1;
  const gu = subGuOf(st.sido, st.sigungu);
  out.push(`${sidoFull(st.sido)} ${st.sigunguName}에는 무인민원발급기가 ${st.total}곳 있어요. ${short} ${peers.length}개 시·군·구 가운데 ${rank}번째로 많아요.` +
    (gu.length ? ` 구별로는 ${gu.map((g) => `${g} ${st.bySubGu[g] ?? 0}곳`).join(', ')}이에요.` : ''));

  const sidoTotal = peers.reduce((a, r) => a + r.total, 0);
  const avg = pct(peers.reduce((a, r) => a + r.is24h, 0), sidoTotal);
  const p = pct(st.is24h, st.total);
  const cmp = Math.abs(p - avg) <= 5 ? `${short} 평균(${avg}%)과 비슷해요` : p > avg ? `${short} 평균(${avg}%)보다 높아요` : `${short} 평균(${avg}%)보다 낮아요`;
  out.push(st.is24h > 0 ? `24시간 운영 기기는 ${st.is24h}곳으로 전체의 ${p}%이며, ${cmp}.` : `24시간 운영 기기는 없어요(${short} 평균 ${avg}%).`);

  out.push(`일요일에 운영하는 곳은 ${st.openSun}곳, 공휴일에 운영하는 곳은 ${st.openHoliday}곳이고, 밤 10시 이후에도 이용할 수 있는 곳은 ${st.openAfter22}곳이에요.`);

  const reg = st.docs.registry ?? 0, fam = st.docs.family ?? 0;
  out.push(reg || fam
    ? `등기부등본은 ${reg}곳, 가족관계증명서는 ${fam}곳에서 발급할 수 있어요.`
    : '등기부등본·가족관계증명서를 발급하는 기기는 없어요.');

  const groups = Object.entries(gu.length ? st.bySubGu : st.byDong).sort((a, b) => b[1] - a[1]);
  if (groups.length > 1 && groups[0][1] > groups[1][1] && groups[0][1] >= 3) {
    out.push(`기기가 가장 많은 ${gu.length ? '구는' : '동은'} ${groups[0][0]}(${groups[0][1]}곳)이에요.`);
  }

  const place: Record<string, number> = {};
  for (const k of ks) if (k.placeType) place[k.placeType] = (place[k.placeType] ?? 0) + 1;
  const top = Object.entries(place).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length > 1) out.push(`설치 장소 유형은 ${top.map(([t, c]) => `${t} ${c}곳`).join(', ')} 순이에요.`);

  const wheel = ks.filter((k) => k.a11y?.includes('휠체어 사용자 조작')).length;
  const tactile = ks.filter((k) => k.a11y?.includes('촉각 모니터')).length;
  out.push(`휠체어 사용자 조작 기능이 있는 기기는 ${wheel}곳, 촉각 모니터가 있는 기기는 ${tactile}곳이에요.`);

  const partial = ks.filter((k) => k.hoursConfidence === 'partial').length;
  if (partial) out.push(`주말·공휴일 운영 정보가 원천 데이터에 없는 기기가 ${partial}곳 있어, 이 기기들은 주말·공휴일을 휴무로 표시했어요.`);
  if (st.hoursUnknown) out.push(`운영시간 정보가 아예 없는 기기가 ${st.hoursUnknown}곳 있어요.`);
  return out;
}

// ⑥ 상세 '방문 전 체크포인트' (최대 3줄, 우선순위 순). 원천 데이터 조건에서만 나오고, 추측 문장은 넣지 않는다.
export interface Checkpoint { text: string; href?: string; link?: string }
export function kioskCheckpoints(k: Kiosk, c: { regionHref: string; regCount: number; today: string }): Checkpoint[] {
  const out: Checkpoint[] = [];
  const h = k.hours;
  if (k.hoursConfidence === 'unknown') out.push({ text: '운영시간이 원천 데이터에 없어요. 방문 전에 관리기관 안내 페이지에서 확인하세요.' });
  if (k.hoursConfidence === 'partial') out.push({ text: '주말·공휴일 운영 정보가 없어 휴무로 표시했어요. 주말에 갈 계획이면 먼저 확인하세요.' });
  const court = k.docs.includes('registry') || k.docs.includes('family');
  if (court) out.push({
    text: k.is24h
      ? '기기는 24시간 운영하지만, 등기부등본·가족관계증명서 같은 법원 발급 서류는 평일 낮에만 발급되는 곳이 있어요.'
      : '등기부등본·가족관계증명서 같은 법원 발급 서류는 기기 운영시간과 달리 평일 낮에만 발급되는 곳이 있어요.',
    href: '/muin/guide/court-documents-hours/', link: '발급 시간 안내',
  });
  if (k.hoursConfidence === 'ok' && h.weekday && !h.sat && !h.sun && !h.holiday) {
    out.push({ text: `평일 ${h.weekday[0]}~${h.weekday[1]}에만 운영하고 주말·공휴일은 휴무예요.` });
  }
  if (!k.docs.includes('registry') && c.regCount > 0) {
    out.push({ text: `이 기기는 등기부등본을 발급하지 않아요.`, href: `${c.regionHref}?f=registry`, link: `${k.sigunguName}의 발급 기기 ${c.regCount}곳 보기` });
  }
  if (k.baseDate) {
    const d = new Date(`${c.today}T00:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() - 1);
    if (k.baseDate < d.toISOString().slice(0, 10)) out.push({ text: `이 기기 정보는 ${k.baseDate} 기준이에요. 그 뒤 바뀌었을 수 있어요.` });
  }
  return out.slice(0, 3);
}

// ⑦ 받침 여부로 조사 고르기 (예: josa('강남구', '이', '가') → '가')
export const hasBatchim = (w: string) => {
  const c = w.trim().charCodeAt(w.trim().length - 1);
  return c >= 0xac00 && c <= 0xd7a3 ? (c - 0xac00) % 28 !== 0 : false;
};
export const josa = (w: string, withB: string, withoutB: string) => w + (hasBatchim(w) ? withB : withoutB);

// ⑧ 시·도 허브 요약 (2026-11-25 SEO 보강): 시·군·구 비교에서 실제로 차이가 나는 값만 문장으로 만든다.
export function sidoSummary(s: SidoSlug, rs: RegionStats[]): string[] {
  const sum = (f: (r: RegionStats) => number) => rs.reduce((a, r) => a + f(r), 0);
  const total = sum((r) => r.total), h24 = sum((r) => r.is24h);
  const out = [
    `${sidoFull(s)}에는 무인민원발급기가 ${n(total)}곳 있어요. 24시간 운영 ${n(h24)}곳(${pct(h24, total)}%), 주말·공휴일 운영 ${n(sum((r) => r.openWeekend))}곳, 평일 밤 10시 이후 운영 ${n(sum((r) => r.openAfter22))}곳이에요.`,
  ];
  const byRatio = [...rs].sort((a, b) => b.is24h / b.total - a.is24h / a.total);
  const hi = byRatio[0], lo = byRatio[byRatio.length - 1];
  if (rs.length > 2 && hi.is24h > 0) {
    out.push(`24시간 기기 비율은 ${josa(hi.sigunguName, '이', '가')} ${pct(hi.is24h, hi.total)}%로 가장 높고, ` +
      (lo.is24h === 0
        ? `${rs.filter((r) => r.is24h === 0).map((r) => r.sigunguName).join('·')}에는 24시간 기기가 없어요.`
        : `${josa(lo.sigunguName, '이', '가')} ${pct(lo.is24h, lo.total)}%로 가장 낮아요.`));
  }
  const reg = [...rs].sort((a, b) => (b.docs.registry ?? 0) - (a.docs.registry ?? 0));
  if (reg[0] && (reg[0].docs.registry ?? 0) > 0) {
    out.push(`등기부등본을 뗄 수 있는 기기는 모두 ${n(sum((r) => r.docs.registry ?? 0))}곳이고, ${reg[0].sigunguName}에 가장 많아요(${reg[0].docs.registry}곳).`);
  }
  out.push(`가족관계증명서를 뗄 수 있는 기기는 ${n(sum((r) => r.docs.family ?? 0))}곳이에요.`);
  return out;
}

// ⑨ 조건 허브 (/muin/{sido}/{cond}/)
const HUB_PHRASE: Record<HubCond, string> = {
  '24h': '24시간 운영하는', weekend: '주말이나 공휴일에 운영하는', registry: '등기부등본을 발급하는', family: '가족관계증명서를 발급하는',
};
export const hubTitle = (s: SidoSlug, c: HubCond, count: number, h1: string) => `${SIDO_SHORT[s]} ${h1} ${n(count)}곳 | 시·군·구별 위치·운영시간`;
export const hubDescription = (s: SidoSlug, c: HubCond, count: number) =>
  `${sidoFull(s)}에서 ${HUB_PHRASE[c]} 무인민원발급기 ${n(count)}곳을 시·군·구별로 모았어요. 지금 운영시간인지, 어느 지역에 많은지 확인해 보세요.`;

export function hubSummary(s: SidoSlug, c: HubCond, hit: Kiosk[], total: number, rs: RegionStats[]): string[] {
  const out = [`${sidoFull(s)}에서 ${HUB_PHRASE[c]} 무인민원발급기는 ${n(hit.length)}곳으로, 전체 ${n(total)}곳의 ${pct(hit.length, total)}%예요.`];
  const by = new Map<string, number>();
  hit.forEach((k) => by.set(k.sigungu, (by.get(k.sigungu) ?? 0) + 1));
  const name = (sg: string) => rs.find((r) => r.sigungu === sg)?.sigunguName ?? sg;
  const top = [...by].sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length) out.push(`가장 많은 곳은 ${top.map(([sg, v]) => `${name(sg)}(${v}곳)`).join(', ')} 순이에요.`);
  const none = rs.filter((r) => !by.has(r.sigungu)).map((r) => r.sigunguName);
  out.push(none.length ? `${none.join('·')}에는 이 조건에 맞는 기기가 없어요.` : `${rs.length}개 시·군·구 모두에 1곳 이상 있어요.`);
  const reg = hit.filter((k) => k.docs.includes('registry')).length;
  const h24 = hit.filter((k) => k.is24h).length;
  if (c === '24h') out.push(`이 중 등기부등본까지 발급하는 기기는 ${n(reg)}곳이에요. 다만 법원 발급 서류는 24시간 기기라도 평일 낮에만 발급되는 곳이 있어요.`);
  if (c === 'weekend') {
    const sun = hit.filter((k) => k.openSun).length;
    out.push(`이 중 일요일에도 운영하는 곳은 ${n(sun)}곳, 24시간 운영하는 곳은 ${n(h24)}곳이에요.`);
    const partial = hit.filter((k) => k.hoursConfidence === 'partial').length;
    if (partial) out.push(`공휴일 운영 여부가 원천 데이터에 없는 기기 ${n(partial)}곳은 목록에 '휴일 미확인'으로 표시했어요.`);
  }
  if (c === 'registry' || c === 'family') {
    out.push(`이 중 24시간 운영하는 기기는 ${n(h24)}곳이에요. 법원 발급 서류는 기기 운영시간과 별도로 발급 시간이 정해진 곳이 있으니, 기기 상세의 운영시간 원문을 확인하세요.`);
  }
  return out;
}
