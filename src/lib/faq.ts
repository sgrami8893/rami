// 시/군/구 FAQ (Gemini 템플릿 5개 + 일반구별 질문). 화면 FAQ와 FAQPage JSON-LD가 같은 결과를 쓴다.
// 사실관계 수정(2026-11-25): 결제수단·신분증·등기부 발급 조건 문구는 확인된 범위로 고침.
import { kiosksIn, nearestOutside, statsFor, subGuOf, type Kiosk, type SidoSlug } from './data.ts';
import { km } from './format.ts';

export interface Faq { q: string; a: string }

const top3 = (ks: Kiosk[]) => ks.slice(0, 3).map((k) => k.name).join(', ');

export function regionFaq(sido: SidoSlug, sigungu: string): Faq[] {
  const st = statsFor(sido, sigungu);
  const ks = kiosksIn(sido, sigungu);
  const R = st.sigunguName;
  const alt = (pred: (k: Kiosk) => boolean) => {
    const a = nearestOutside(sido, sigungu, pred, 1)[0];
    if (!a) return '';
    return a.m !== undefined
      ? ` 가장 가까운 곳은 ${a.k.sigunguName}의 ${a.k.name}(약 ${km(a.m)})입니다.`
      : ` 인근 ${a.k.sigunguName}의 ${a.k.name} 등을 이용할 수 있습니다.`;
  };
  const h24 = ks.filter((k) => k.is24h);
  const sun = ks.filter((k) => k.openSun);
  const hol = ks.filter((k) => k.openHoliday);
  const weekend = ks.filter((k) => k.openSun || k.openHoliday);
  const reg = ks.filter((k) => k.docs.includes('registry'));
  const fam = ks.filter((k) => k.docs.includes('family'));

  const out: Faq[] = [
    {
      q: `${R}에서 24시간 이용 가능한 무인민원발급기는 어디인가요?`,
      a: h24.length
        ? `${R} 내 24시간 운영 기기는 총 ${h24.length}곳으로, 대표적으로 ${top3(h24)} 등이 있습니다. 상단 필터에서 '24시간'을 선택하면 전체 목록을 볼 수 있습니다.`
        : `현재 ${R}에는 24시간 운영되는 무인민원발급기가 없습니다.${alt((k) => k.is24h)} 늦은 시간에는 상단 필터의 '지금 운영시간 내'로 운영시간인 곳을 확인해 주세요.`,
    },
    {
      q: `${R}에서 일요일이나 공휴일에 운영하는 곳은 몇 곳인가요?`,
      a: weekend.length
        ? `${R}에는 일요일 운영 ${sun.length}곳, 공휴일 운영 ${hol.length}곳의 무인민원발급기가 있습니다. ${top3(weekend)} 등에서 일요일·공휴일에도 발급할 수 있으며, 기기 점검이나 시설 휴관에 따라 달라질 수 있습니다.`
        : `${R}에는 일요일·공휴일에 운영하는 무인민원발급기가 없습니다.${alt((k) => k.openSun || k.openHoliday)}`,
    },
    {
      q: `${R}에서 부동산 등기부등본(등기사항증명서) 발급이 되는 곳은 어디인가요?`,
      a: (reg.length
        ? `등기부등본은 기기마다 발급 가능 여부가 다릅니다. ${R}에서는 총 ${reg.length}곳(${top3(reg)} 등)에서 발급할 수 있습니다.`
        : `${R}에는 등기부등본을 발급하는 무인민원발급기가 없습니다.${alt((k) => k.docs.includes('registry'))}`) +
        ' 등기부등본·가족관계증명서 같은 법원 발급 서류는 24시간 기기라도 평일 낮에만 발급되는 곳이 있으니 방문 전 확인하세요.',
    },
    {
      q: '가족관계증명서도 무인민원발급기에서 뽑을 수 있나요?',
      a: fam.length
        ? `네, ${R} 내 ${fam.length}곳의 기기에서 가족관계증명서 등 가족관계등록부 증명서를 발급할 수 있습니다.`
        : `${R}에는 가족관계증명서를 발급하는 무인민원발급기가 없습니다.${alt((k) => k.docs.includes('family'))}`,
    },
    {
      q: '무인민원발급기 이용 시 신분증이 필요한가요?',
      a: '주민등록 등·초본이나 가족관계증명서처럼 본인 확인이 필요한 서류는 주민등록증을 만들 때 등록한 지문으로 본인을 확인합니다(신분증은 따로 넣지 않음). 등기부등본처럼 본인 확인이 필요 없는 서류도 있습니다. 수수료 결제는 현금만 받는 기기가 있으니 현금을 준비하면 안전합니다.',
    },
  ];

  // 일반구별 질문 ("분당구 무인민원발급기" 검색 대응)
  for (const gu of subGuOf(sido, sigungu)) {
    const inGu = ks.filter((k) => k.subGu === gu);
    out.push({
      q: `${gu} 무인민원발급기는 어디에 있나요?`,
      a: inGu.length
        ? `${R} ${gu}에는 ${inGu.length}곳이 있습니다. ${top3(inGu)} 등이 있으며 이 페이지의 ${gu} 목록에서 운영시간을 확인할 수 있습니다.`
        : `${R} ${gu}에는 등록된 무인민원발급기가 없습니다. 같은 시의 다른 구 목록을 확인해 주세요.`,
    });
  }
  return out;
}
