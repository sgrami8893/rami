// 무인민원발급기 가이드 글 (2026-11-25 작성).
// 원칙: 공식 자료로 확인한 사실만 쓰고, 지자체마다 다른 내용은 "예시"로 출처와 함께 적는다.
// 통계 문장은 빌드 시 실데이터(kiosks.json)에서 계산한다.
import { kiosks, stats, regionPath, sidoShort, type RegionStats } from './data.ts';

export interface Source { name: string; url: string; note?: string }
export interface Block { h2: string; p?: string[]; ul?: string[] }
export interface RelatedLink { label: string; href: string; meta?: string }
export interface Guide {
  slug: string; title: string; description: string; summary: string;
  published: string; modified: string;
  blocks: () => Block[]; related: () => { title: string; links: RelatedLink[] }[]; sources: Source[];
}

const n = (x: number) => x.toLocaleString('ko-KR');
const total = kiosks.length;
const count = (f: (k: (typeof kiosks)[number]) => boolean) => kiosks.filter(f).length;
const pct = (x: number) => `${Math.round((x / total) * 100)}%`;
const label = (r: RegionStats) => `${sidoShort(r.sido)} ${r.sigunguName}`;
/** 지표 상위 지역 링크. filter 를 주면 시·군·구 페이지의 필터가 켜진 상태로 연다. */
function topRegions(metric: (r: RegionStats) => number, unit: string, filter?: string, limit = 6): RelatedLink[] {
  return [...stats].sort((a, b) => metric(b) - metric(a) || a.sigunguName.localeCompare(b.sigunguName, 'ko'))
    .filter((r) => metric(r) > 0).slice(0, limit)
    .map((r) => ({ label: label(r), href: `${regionPath(r.sido, r.sigungu)}${filter ? `?f=${filter}` : ''}`, meta: `${unit} ${n(metric(r))}곳` }));
}
const a11yIn = (r: RegionStats, feature: string) => kiosks.filter((k) => k.sido === r.sido && k.sigungu === r.sigungu && k.a11y?.includes(feature)).length;

const S = {
  incheon: { name: '인천광역시 무인민원발급기 안내', url: 'https://www.incheon.go.kr/IC030108', note: '최종 업데이트 2026-10-02' },
  gov24: { name: '정부24 무인민원발급안내', url: 'https://www.gov.kr/mw/AA090NoManMinwonView.do' },
  fingerprint: { name: '대한민국 정책브리핑, 「무인민원발급기에서 지문 인식이 안되신다구요?」', url: 'https://www.korea.kr/multi/visualNewsView.do?newsId=148909842', note: '2022-12-29 게시' },
  feeWaiver: { name: '머니투데이, 주민등록 등·초본 발급 수수료 한시 면제 보도', url: 'https://www.mt.co.kr/policy/2026/04/26/2026042419484898050', note: '2026-04-26' },
  kiosk: { name: '대한민국 정책브리핑, 「장애인 접근성 갖춘 무인정보단말기 설치 의무화 전면 시행」', url: 'https://www.korea.kr/news/policyNewsView.do?newsId=148958690', note: '2026-01-28' },
  data: { name: '행정안전부 무인민원발급기 정보(설치정보·발급제증명)', url: 'https://www.localdata.go.kr', note: '이 사이트의 집계 원천' },
  // ↓ 2026-11-25 추가. 내부 메모: 제미나이 확인 = 제미나이가 원문을 인용했고 이 환경에서는 직접 열어 대조하지 못한 출처.
  asan: { name: '아산시 무인민원발급기 이용 안내', url: 'https://www.asan.go.kr/main/cms/?no=99', note: '2026-11-25 확인' }, // 제미나이 확인
  dobong: { name: '도봉구 무인민원발급기 발급 가능 민원 안내', url: 'https://www.dobong.go.kr/Contents.asp?code=10010321', note: '2026-11-25 확인' }, // 제미나이 확인
  daeguDong: { name: '대구 동구 무인민원발급기 안내', url: 'https://dong.daegu.kr/portal/contents.do?mid=0101030300', note: '2026-11-25 확인' }, // 제미나이 확인
  gangnamLand: { name: '강남구, 제증명 발급(열람) 수수료 기준', url: 'https://www.gangnam.go.kr/board/register_land/6/view.do?mid=ID02_011202', note: '2016-11-21 게시, 2026-11-25 확인' }, // 직접 대조 완료(정부24 무료 문구는 확인 못 해 본문에서 뺌)
  localTaxCert: { name: '정부24, 지방세 납세증명 서비스 안내', url: 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13100000056', note: '2026-11-25 확인' }, // 제미나이 확인
  gangdongFee: { name: '강동구 민원서류 발급 수수료 안내', url: 'https://gangdong.go.kr/web/newportal/contents/gdp_001_001_004', note: '최종수정 2026-01-20' },
  suwonFree: { name: '수원시 보도자료, 관내 무인민원발급기 수수료 면제', url: 'https://www.suwon.go.kr/web/board/BD_board.view.do?bbsCd=1043&seq=20250513094051833', note: '2025-05-13' }, // 제미나이 확인
  pajuFree: { name: '헤럴드경제, 「파주시, 무인민원발급기 123종 발급 수수료 무료화」', url: 'https://www.heraldk.com/article/2026010115394300136', note: '2026-01-01' },
  hanamFree: { name: '오마이뉴스, 「하남시, 무인민원발급기 이용 시 12종 수수료 면제」', url: 'https://www.ohmynews.com/NWS_Web/View/at_pg.aspx?CNTN_CD=A0002949809', note: '2023-08-03' }, // 직접 대조 완료
};
const DATA_NOTE = `집계는 이 사이트가 공공데이터로 정리한 서울·경기·인천 무인민원발급기 ${n(total)}곳 기준이에요.`;

export const GUIDES: Guide[] = [
  {
    slug: 'court-documents-hours',
    title: '등기부등본·가족관계증명서, 무인민원발급기에서 언제 뽑을 수 있나',
    description: '24시간 무인민원발급기라도 등기부등본·가족관계증명서 같은 법원 발급 서류는 평일 낮에만 발급되는 곳이 있어요. 발급 시간 제한과 대안을 정리했어요.',
    summary: '24시간 기기라도 법원 발급 서류는 평일 09~18시만 되는 곳이 있어요.',
    published: '2026-11-25', modified: '2026-11-25',
    blocks: () => {
      const reg = count((k) => k.docs.includes('registry'));
      const fam = count((k) => k.docs.includes('family'));
      return [
        { h2: '기기 운영시간과 서류 발급 시간은 다를 수 있어요', p: [
          '무인민원발급기가 24시간 켜져 있어도 모든 서류를 24시간 발급하는 것은 아니에요. 예를 들어 인천광역시청 무인민원발급기 안내는 기기를 평일·주말 24시간 운영한다고 하면서도, <strong>대법원 민원서류(부동산등기부등본, 가족관계등록부, 제적부 등·초본)는 평일 09:00~18:00에만 발급</strong>한다고 적고 있어요.',
          '정부24도 무인민원발급기의 발급 시간과 수수료는 자치단체 사정(조례)에 따라 달라질 수 있다고 안내해요. 따라서 등기부등본이나 가족관계증명서가 필요하다면 <strong>평일 낮 시간에 방문</strong>하는 것이 가장 안전해요.',
        ] },
        { h2: '모든 기기가 이 서류를 발급하지는 않아요', p: [
          `기기마다 발급 가능한 서류도 달라요. ${DATA_NOTE} 이 중 부동산 등기부등본을 발급하는 기기는 ${n(reg)}곳(${pct(reg)}), 가족관계등록부 증명서를 발급하는 기기는 ${n(fam)}곳(${pct(fam)})예요.`,
          '지역 페이지에서 <strong>등기부등본</strong> 또는 <strong>가족관계증명서</strong> 필터를 켜면 해당 서류를 발급하는 기기만 볼 수 있어요.',
        ] },
        { h2: '이 사이트의 운영시간 표시에 대해', p: [
          '이 사이트가 보여 주는 운영시간은 원천 데이터에 등록된 <strong>기기 운영시간</strong>이에요. 원천 데이터에는 서류별 발급 시간이 따로 없어서, "운영시간 내"로 표시된 기기라도 법원 발급 서류는 발급되지 않을 수 있어요. 중요한 서류는 방문 전에 관리기관에 확인하세요.',
        ] },
        { h2: '평일 낮에 가기 어렵다면', ul: [
          '부동산 등기사항증명서는 대법원 인터넷등기소(iros.go.kr)에서도 열람·발급할 수 있어요.',
          '가족관계등록부 증명서는 대법원 전자가족관계등록시스템(efamily.scourt.go.kr)에서도 발급할 수 있어요.',
          '온라인 발급의 이용 시간, 수수료, 본인 인증 방법은 각 사이트 안내를 확인하세요.',
        ] },
      ];
    },
    related: () => [
      { title: '등기부등본 발급 기기가 많은 지역', links: topRegions((r) => r.docs.registry ?? 0, '등기부등본', 'registry') },
      { title: '가족관계증명서 발급 기기가 많은 지역', links: topRegions((r) => r.docs.family ?? 0, '가족관계', 'family') },
    ],
    sources: [S.incheon, S.gov24, S.data],
  },
  {
    slug: 'fingerprint-error',
    title: '무인민원발급기 지문 인식이 안 될 때 해결 방법',
    description: '무인민원발급기에서 지문 인식이 계속 실패할 때 원인과 지문 재등록 방법, 지문 없이 서류를 받는 방법을 정리했어요.',
    summary: '지문이 닳아 인식이 안 되면 주민센터에서 지문을 다시 등록할 수 있어요.',
    published: '2026-11-25', modified: '2026-11-25',
    blocks: () => [
      { h2: '왜 본인 서류에 지문이 필요한가요', p: [
        '주민등록 등·초본, 가족관계등록부 증명서처럼 본인 확인이 필요한 서류는 무인민원발급기에서 지문으로 본인을 확인해요. 반대로 부동산 등기사항증명서나 토지·건축물 관련 서류처럼 본인 확인이 필요 없는 서류도 있어요(인천광역시 무인민원발급기 안내의 서류별 본인확인 표 기준).',
      ] },
      { h2: '인식이 안 되는 흔한 이유', p: [
        '정책브리핑 기사는 나이가 들거나 손을 많이 쓰면서 <strong>지문이 마모·변형</strong>되면 무인민원발급기에서 인식이 잘 되지 않는다고 설명해요. 이 경우 손가락을 바꾸거나 다시 시도해도 계속 실패할 수 있어요.',
      ] },
      { h2: '지문 재등록 방법', p: [
        '같은 기사(2022년 12월 게시)에 따르면 지문 재등록은 다음과 같이 해요. 제도가 바뀌었을 수 있으니 방문 전에 주민센터나 정부24에서 최신 안내를 확인하세요.',
      ], ul: [
        '거주지와 관계없이 가까운 주민센터에 <strong>본인이 직접</strong> 방문해요(대리 신청 불가).',
        '최근 6개월 이내 사진 1장(3.5×4.5cm)을 준비하고, 주민등록증 재발급 신청서에 사유를 "지문 재등록"으로 적어요.',
        '기사 기준으로 지문 마모·변형에 따른 재등록은 재발급 수수료 면제 대상이며, 기존 주민등록증을 반납해야 해요.',
        '정부24에서 "주민등록증 재발급"을 신청할 수도 있지만, 지문 등록을 위해 수령할 때 직접 방문해야 해요.',
      ] },
      { h2: '지금 당장 서류가 필요하다면', ul: [
        '운영 중인 주민센터 창구에서 신분증으로 본인 확인을 받고 발급받을 수 있어요.',
        '등기부등본처럼 본인 확인이 필요 없는 서류는 지문 없이 무인민원발급기에서 발급할 수 있어요.',
        '정부24 등 온라인 발급을 이용할 수도 있어요(본인 인증 수단 필요).',
      ] },
    ],
    related: () => [
      { title: '주말·공휴일 운영 기기가 많은 지역', links: topRegions((r) => r.openWeekend, '주말·공휴일', 'weekend') },
    ],
    sources: [S.fingerprint, S.incheon],
  },
  {
    slug: 'fees-and-payment',
    title: '무인민원발급기 수수료와 결제 수단, 무엇을 준비해야 할까',
    description: '무인민원발급기 서류별 수수료 예시와 결제 수단, 수수료 면제 사례를 공식 안내 기준으로 정리했어요.',
    summary: '수수료는 지자체 조례마다 다르고, 현금이 필요한 서류가 있어요.',
    published: '2026-11-25', modified: '2026-11-25',
    blocks: () => [
      { h2: '수수료는 지역마다 다를 수 있어요', p: [
        '정부24는 무인민원발급기의 발급 수수료가 자치단체 사정(조례)에 따라 달라질 수 있다고 안내해요. 아래 금액은 <strong>인천광역시 안내(2026-10-02 업데이트)에 나온 예시</strong>이며, 다른 지역은 해당 지자체 안내를 확인해야 해요.',
      ], ul: [
        '주민등록 등·초본: 200원',
        '가족관계등록부 증명서(일반·폐쇄): 500원, 제적 등본 500원·제적 초본 300원',
        '부동산 등기사항증명서(건물·토지·집합건물): 1,000원, "현금"으로 표시',
        '지방세 세목별 과세증명서: 600원',
        '지방세 납세증명서, 병적증명서, 국세 증명, 건강보험 확인서 등은 수수료 없음으로 표시',
      ] },
      { h2: '창구보다 저렴한 편이에요', p: [
        '2026년 4월 보도에 따르면 주민등록 등·초본 수수료는 주민센터 창구에서 1통 400원, 무인민원발급기에서 200원이고 온라인 발급은 무료예요.',
      ] },
      { h2: '수수료 면제 사례', p: [
        '정부나 지자체가 수수료를 한시적으로 면제하기도 해요. 예를 들어 2026년 4~7월 고유가 피해지원금 신청 기간에는 정부가 무인민원발급기의 주민등록 등·초본 수수료를 한시 면제했어요(1차 4월 27일~5월 8일, 2차 5월 18일~7월 3일). 이 기간은 이미 끝났으며, 현재 면제 여부는 지역마다 다르므로 해당 지자체 안내를 확인하세요.',
      ] },
      { h2: '관내 무인민원발급기 수수료를 면제하는 지자체', p: [
        '일부 지자체는 조례로 <strong>관내 무인민원발급기 수수료를 상시 면제</strong>해요. 면제 범위는 지자체마다 다르고, 대법원 전산망으로 발급되는 부동산 등기부등본은 면제에서 빠지는 경우가 많아요. 아래는 공식 발표나 보도로 확인한 예시예요.',
      ], ul: [
        '수원시: 2025년 5월 16일부터 관내 무인민원발급기의 모든 민원서류 수수료 면제, 부동산등기부등본은 제외(수원시 보도자료, 2025-05-13)',
        '파주시: 관내 무인민원발급기 주민등록등본 등 123종 수수료 무료화, 부동산 등기부등본은 제외(2026-01-01 보도)',
        '하남시: 무인민원발급기로 주민등록 등·초본 등 12종을 발급하면 수수료 면제(2023년 8월 보도 기준, 현재 범위는 하남시 안내 확인)',
        '서울 도봉구: 발급 안내표에 주민등록 등·초본을 "도봉구 조례에 의한 수수료 면제"로 표시',
      ] },
      { h2: '면제 대상자라면', p: [
        '무인민원발급기 이용 순서를 안내하는 지자체 자료(아산시)에는 "수수료 면제 대상일 경우에는 해당 사항을 선택"하는 단계가 있어요. 다만 어떤 사람이 어떤 서류에서 면제되는지는 지자체 조례마다 다르므로, 해당 지자체 민원 안내를 확인하세요.',
      ] },
      { h2: '결제 수단 준비 팁', p: [
        '결제 수단은 기기마다 달라요. 인천광역시 안내에도 등기사항증명서 수수료가 "현금"으로 표시돼 있듯, <strong>현금만 받는 기기나 서류가 있으므로 소액 현금(지폐·동전)을 준비</strong>하는 것이 안전해요.',
      ] },
    ],
    related: () => [
      { title: '등기부등본 발급 기기가 많은 지역', links: topRegions((r) => r.docs.registry ?? 0, '등기부등본', 'registry', 4) },
      { title: '24시간 기기가 많은 지역', links: topRegions((r) => r.is24h, '24시간', '24h', 4) },
    ],
    sources: [S.gov24, S.incheon, S.feeWaiver, S.suwonFree, S.pajuFree, S.hanamFree, S.dobong, S.asan],
  },
  {
    slug: '24h-weekend',
    title: '수도권 24시간·주말 무인민원발급기 찾는 법 (지역별 통계)',
    description: '서울·경기·인천 무인민원발급기 중 24시간, 일요일·공휴일에 운영하는 곳이 몇 곳이고 어느 지역에 많은지 실데이터로 정리했어요.',
    summary: '수도권 24시간 기기와 주말 운영 기기를 지역별로 찾는 방법이에요.',
    published: '2026-11-25', modified: '2026-11-25',
    blocks: () => {
      const h24 = count((k) => k.is24h), sun = count((k) => k.openSun), hol = count((k) => k.openHoliday);
      const bySido = (['seoul', 'gyeonggi', 'incheon'] as const).map((s) => {
        const ks = kiosks.filter((k) => k.sido === s);
        return `${sidoShort(s)}: 전체 ${n(ks.length)}곳 중 24시간 ${n(ks.filter((k) => k.is24h).length)}곳, 일요일 운영 ${n(ks.filter((k) => k.openSun).length)}곳`;
      });
      return [
        { h2: '수도권 현황', p: [
          `${DATA_NOTE} 이 중 <strong>24시간 운영 기기는 ${n(h24)}곳(${pct(h24)})</strong>, 일요일에 운영하는 기기는 ${n(sun)}곳, 공휴일에 운영하는 기기는 ${n(hol)}곳이에요.`,
        ], ul: bySido },
        { h2: '이 사이트에서 찾는 방법', ul: [
          '시·군·구 페이지에서 <strong>24시간</strong> 또는 <strong>주말·공휴일</strong> 필터를 켜면 해당 기기만 남아요.',
          '<strong>지금 운영시간 내</strong> 필터는 한국 시간(KST)과 공휴일을 반영해, 공개된 운영시간 기준으로 지금 운영시간인 기기만 보여 줘요. 점검·고장 여부는 알 수 없어요.',
          '각 기기 상세 페이지에서 평일·토·일·공휴일 운영시간을 따로 볼 수 있어요.',
        ] },
        { h2: '확인해 둘 점', ul: [
          '24시간 기기라도 등기부등본·가족관계증명서 같은 법원 발급 서류는 평일 낮에만 발급되는 곳이 있어요.',
          '24시간 기기도 점검 시간이 있을 수 있어요. 예를 들어 인천광역시청 기기는 매일 03:00~04:00 업데이트로 이용할 수 없다고 안내해요.',
          '원천 데이터에는 토요일 운영시간이 따로 없어, 이 사이트는 공휴일 운영시간을 토·일요일에도 적용해요. 공휴일 칸이 비어 있는 기기는 휴무로 보고 "휴일 미확인"이라고 표시해요.',
        ] },
        { h2: '주말·심야에 급하게 서류가 필요할 때 찾는 순서', ul: [
          '1) 시·군·구 페이지에서 <strong>지금 운영시간 내</strong> 필터를 켜요. 기기 상세가 "운영시간 외"라면 같은 동에서 지금 운영시간인 기기로 가는 바로가기가 나와요.',
          '2) 필요한 서류가 정해져 있다면 <strong>등기부등본</strong>·<strong>가족관계증명서</strong> 필터를 함께 켜요. 발급 서류는 기기마다 달라요.',
          '3) 법원 발급 서류(등기부등본·가족관계증명서)는 24시간 기기라도 평일 낮에만 되는 곳이 있으니, 밤·주말에는 인터넷등기소나 전자가족관계등록시스템도 함께 고려하세요.',
          '4) 서류별 이용 시간 예외도 있어요. 예를 들어 도봉구 안내표에는 국세 납세증명서(국세완납증명) 이용시간이 08시~22시로, 대구 동구 안내에는 자동차등록원부가 일요일·공휴일 발급 불가로 적혀 있어요.',
        ] },
      ];
    },
    related: () => [
      { title: '24시간 기기가 많은 지역', links: topRegions((r) => r.is24h, '24시간', '24h', 8) },
      { title: '주말·공휴일 운영 기기가 많은 지역', links: topRegions((r) => r.openWeekend, '주말·공휴일', 'weekend', 8) },
    ],
    sources: [S.data, S.incheon, S.dobong, S.daeguDong],
  },
  {
    slug: 'accessibility',
    title: '음성 안내·점자·휠체어, 무인민원발급기 장애인 편의 기능 안내',
    description: '수도권 무인민원발급기의 음성 안내, 점자 라벨, 휠체어 사용자 조작 등 장애인 편의 기능 현황과 이용 시 확인할 점을 정리했어요.',
    summary: '수도권 기기의 장애인 편의 기능 현황과 기기별 확인 방법이에요.',
    published: '2026-11-25', modified: '2026-11-25',
    blocks: () => {
      const F = ['음성 안내', '점자 라벨', '시각장애인용 키패드', '이어폰 소켓', '화면 확대', '청각장애인용 화면 안내', '휠체어 사용자 조작', '촉각 모니터'];
      return [
        { h2: '무인정보단말기 접근성은 법적 의무예요', p: [
          '보건복지부는 2026년 1월 28일부터 장애인차별금지법과 같은 법 시행령에 따라, 공공과 민간의 재화·용역 제공자가 무인정보단말기(키오스크)를 설치·운영할 때 장애인이 이용할 수 있도록 접근성을 갖추는 의무가 전면 시행된다고 밝혔어요. 정당한 편의에는 단말기 위치를 음성으로 안내하는 장치 등이 포함돼요.',
        ] },
        { h2: '수도권 기기의 편의 기능 현황', p: [
          `${DATA_NOTE} 원천 데이터에 각 기능이 "제공"으로 기재된 기기 수는 다음과 같아요.`,
        ], ul: F.map((f) => { const c = count((k) => !!k.a11y?.includes(f)); return `${f}: ${n(c)}곳(${pct(c)})`; }) },
        { h2: '기기별로 확인하는 방법', ul: [
          '각 기기 상세 페이지의 <strong>장애인 편의</strong> 항목에 원천 데이터에 기재된 기능이 표시돼요.',
          '정부24 무인민원발급안내에서도 기기별 편의 기능(음성안내, 점자라벨, 이어폰소켓, 촉각모니터, 화면확대, 휠체어 사용자 조작)을 확인할 수 있어요.',
          '데이터에는 기기까지 가는 길(계단, 경사로, 엘리베이터 등) 정보가 없어요. 이동이 불편하다면 방문 전에 관리기관에 문의하세요.',
          '데이터 기재 내용과 현장이 다를 수 있어요. 다른 점을 발견하면 상세 페이지의 정보 오류 제보로 알려 주세요.',
        ] },
      ];
    },
    related: () => [
      { title: '촉각 모니터 기기가 많은 지역', links: topRegions((r) => a11yIn(r, '촉각 모니터'), '촉각 모니터') },
      { title: '휠체어 사용자 조작 기기가 많은 지역', links: topRegions((r) => a11yIn(r, '휠체어 사용자 조작'), '휠체어 조작') },
    ],
    sources: [S.kiosk, S.gov24, S.data],
  },
  // ===== 2026-11-25 추가 가이드 (출처: 지자체 안내 예시, 확인일 2026-11-25) =====
  {
    slug: 'how-to-use',
    title: '무인민원발급기 처음 쓰는 법: 이용 순서와 서류별 본인 확인',
    description: '무인민원발급기에서 서류를 뽑는 순서, 지문으로 본인 확인이 필요한 서류와 필요 없는 서류를 지자체 안내를 바탕으로 정리했어요.',
    summary: '주민등록·가족관계·납세증명은 지문 확인, 토지·건축물대장과 등기부등본은 본인 확인이 필요 없어요.',
    published: '2026-11-25', modified: '2026-11-25',
    blocks: () => [
      { h2: '이용 순서', p: [
        '화면 구성은 기기와 지자체마다 조금씩 다를 수 있어요. 아래는 아산시 안내에 나온 일반적인 순서예요.',
      ], ul: [
        '1) 발급받을 증명 종류를 골라요.',
        '2) 본인 확인이 필요한 증명이면 본인의 주민등록번호를 입력해요.',
        '3) 본인의 <strong>오른손 엄지손가락</strong>을 지문 인식창에 대어 본인 확인을 해요.',
        '4) 선택 사항이 있는 증명이면 증명서에 넣을 사항을 골라요.',
        '5) 수수료가 있으면 수수료를 넣고, 면제 대상이면 해당 사항을 선택해요.',
        '6) 증명서가 발급돼요.',
      ] },
      { h2: '본인 확인(지문)이 필요한 서류와 필요 없는 서류', p: [
        '서울 도봉구·대구 동구의 발급 안내표는 서류별 본인 확인 여부를 아래처럼 구분해요.',
      ], ul: [
        '지문 확인 필요: 주민등록 등·초본, 가족관계등록부 증명서, 납세증명(국세 완납증명), 지방세 납세증명',
        '본인 확인 불필요: 토지(임야)대장, 건축물대장, 부동산 등기부등본',
      ] },
      { h2: '지문 인식이 안 되면', p: [
        '지문이 닳았거나 인식이 잘 안 되는 경우의 해결 방법은 <a href="/muin/guide/fingerprint-error/">지문 인식이 안 될 때 해결 방법</a>에 정리했어요.',
      ] },
      { h2: '서류별 이용 시간 예외', ul: [
        '국세 납세증명서(국세 완납증명): 도봉구 안내표 기준 이용시간 08시~22시',
        '자동차등록원부: 대구 동구 안내 기준 일요일·공휴일 발급 불가',
        '등기부등본·가족관계증명서: 24시간 기기라도 평일 낮에만 되는 곳이 있어요. <a href="/muin/guide/court-documents-hours/">법원 발급 서류 시간 안내</a>',
      ] },
    ],
    related: () => [
      { title: '24시간 기기가 많은 지역', links: topRegions((r) => r.is24h, '24시간', '24h', 6) },
    ],
    sources: [S.asan, S.dobong, S.daeguDong],
  },
  {
    slug: 'resident-registration-copy',
    title: '주민등록 등·초본, 무인민원발급기·정부24·주민센터 중 어디서 뗄까',
    description: '주민등록 등·초본을 정부24 온라인, 무인민원발급기, 주민센터 창구에서 뗄 때 수수료와 본인 확인 방법이 어떻게 다른지 지자체 안내 예시로 정리했어요.',
    summary: '정부24 온라인은 무료, 무인기·창구 수수료는 지자체마다 다르고 무료인 곳도 있어요.',
    published: '2026-11-25', modified: '2026-11-25',
    blocks: () => {
      const res = count((k) => k.docs.includes('resident'));
      return [
        { h2: '수수료는 발급 경로와 지역에 따라 달라요', p: [
          '수수료는 전국 단일 금액이 아니라 <strong>지자체 조례에 따라 달라요</strong>. 아래는 공식 안내에서 확인한 예시예요.',
        ], ul: [
          '정부24 온라인: 무료(강동구 수수료 안내의 "정부24 무료" 표기)',
          '주민센터 창구: 1건 400원, 이해관계인 초본 500원(강동구 안내 예시)',
          '무인민원발급기: 200원(인천광역시 안내 예시)',
          '무인민원발급기 무료인 곳: 수원시·파주시처럼 관내 무인기 수수료를 면제하거나, 도봉구처럼 조례로 등·초본 수수료를 면제하는 곳이 있어요.',
        ] },
        { h2: '본인 확인 방법', p: [
          '무인민원발급기에서 주민등록 등·초본을 뗄 때는 주민등록번호를 입력하고 <strong>지문</strong>으로 본인을 확인해요(도봉구·대구 동구 안내표). 자세한 순서는 <a href="/muin/guide/how-to-use/">무인민원발급기 처음 쓰는 법</a>을 참고하세요.',
        ] },
        { h2: '어떤 경로가 맞을까', ul: [
          '집이나 회사에서 바로 출력·전자 제출할 수 있다면: 정부24 온라인(무료)',
          '종이 서류가 바로 필요하고 창구 시간이 아니라면: 무인민원발급기',
          '무인기에서 지문 인식이 계속 안 되거나 무인기로 처리할 수 없는 신청이라면: 주민센터 창구',
        ] },
        { h2: '수도권 발급 기기', p: [
          `${DATA_NOTE} 이 중 주민등록 등·초본을 발급하는 기기는 ${n(res)}곳(${pct(res)})예요.`,
        ] },
      ];
    },
    related: () => [
      { title: '24시간 기기가 많은 지역', links: topRegions((r) => r.is24h, '24시간', '24h', 6) },
    ],
    sources: [S.gangdongFee, S.incheon, S.suwonFree, S.pajuFree, S.dobong, S.daeguDong, S.data],
  },
  {
    slug: 'land-building-register',
    title: '토지대장·건축물대장, 무인민원발급기에서 떼는 법과 수수료',
    description: '토지(임야)대장과 건축물대장을 무인민원발급기에서 발급할 때 본인 확인 여부, 지자체별 수수료 예시, 정부24 온라인 열람·발급을 정리했어요.',
    summary: '본인 확인 없이 뗄 수 있고, 무인기 수수료는 지자체마다 400~500원 예시가 있어요.',
    published: '2026-11-25', modified: '2026-11-25',
    blocks: () => {
      const land = count((k) => k.docs.includes('land'));
      return [
        { h2: '본인 확인이 필요 없어요', p: [
          '토지(임야)대장과 건축물대장은 무인민원발급기에서 <strong>본인 확인(지문) 없이</strong> 발급할 수 있다고 도봉구·대구 동구 안내표에 나와 있어요.',
        ] },
        { h2: '무인기에서 발급되는 종류 (도봉구 안내표 예시)', ul: [
          '토지대장등본, 임야대장등본, 대지권등록부',
          '건축물대장: 일반건축물대장, 건축물대장 총괄표제부, 집합건축물대장(표제부·전유부분), 다가구주택의 호(가구)별 면적대장',
        ] },
        { h2: '수수료는 지자체마다 달라요', p: [
          '같은 서류라도 지자체 안내마다 금액이 달라요. 아래는 예시예요.',
        ], ul: [
          '도봉구: 토지·임야대장등본 500원(20장 이후 추가 장당 100원), 건축물대장 500원',
          '강남구(2016년 게시 수수료 기준표): 토지(임야)대장 창구 열람 300원·발급 500원, 무인 400원(1장 초과 시 장당 100원) / 건축물대장 열람 300원·발급 500원, 무인 400원, 도면 1면 100원',
          '건축물대장은 정부24에서도 인터넷으로 발급·열람할 수 있어요(강남구 기준표, 도면 제외).',
        ] },
        { h2: '수도권 발급 기기', p: [
          `${DATA_NOTE} 이 중 토지·건축물대장을 발급하는 기기는 ${n(land)}곳(${pct(land)})예요.`,
        ] },
      ];
    },
    related: () => [
      { title: '토지·건축물대장 발급 기기가 많은 지역', links: topRegions((r) => r.docs.land ?? 0, '토지·건축물대장', undefined, 6) },
    ],
    sources: [S.dobong, S.daeguDong, S.gangnamLand, S.data],
  },
  {
    slug: 'tax-payment-certificate',
    title: '국세·지방세 납세증명서, 무인민원발급기에서 떼는 법',
    description: '지방세 납세증명서와 국세 납세증명서(국세 완납증명)를 무인민원발급기에서 발급할 때 본인 확인, 수수료, 이용 시간을 공식 안내로 정리했어요.',
    summary: '지방세·국세 납세증명 모두 지문 확인이 필요하고, 국세 완납증명은 08~22시 예시가 있어요.',
    published: '2026-11-25', modified: '2026-11-25',
    blocks: () => {
      const tax = count((k) => k.docs.includes('tax'));
      const nat = count((k) => k.docs.includes('nationalTax'));
      return [
        { h2: '지방세 납세증명서', ul: [
          '정부24 서비스 안내 기준 신청 방법: 인터넷, 방문, FAX, 우편, <strong>무인발급기</strong>',
          '수수료: 없음(정부24 안내, 도봉구 안내표 모두 무료)',
          '무인기 본인 확인: 지문 필요(도봉구 안내표)',
          '방문 신청 시에는 유효기간 내 신분증(주민등록증, 운전면허증, 여권 등)을 제시해야 한다고 정부24 안내에 적혀 있어요.',
        ] },
        { h2: '국세 납세증명서(국세 완납증명)', ul: [
          '무인기 본인 확인: 지문 필요(도봉구 안내표)',
          '수수료: 무료(도봉구 안내표)',
          '이용 시간: 08시~22시(도봉구 안내표). 24시간 기기라도 이 시간 밖에는 발급되지 않을 수 있어요.',
        ] },
        { h2: '수도권 발급 기기', p: [
          `${DATA_NOTE} 이 중 지방세 증명을 발급하는 기기는 ${n(tax)}곳(${pct(tax)}), 국세 증명을 발급하는 기기는 ${n(nat)}곳(${pct(nat)})예요.`,
        ] },
      ];
    },
    related: () => [
      { title: '국세 증명 발급 기기가 많은 지역', links: topRegions((r) => r.docs.nationalTax ?? 0, '국세 증명', undefined, 6) },
    ],
    sources: [S.localTaxCert, S.dobong, S.data],
  },
  {
    slug: 'real-estate-contract-documents',
    title: '부동산 계약 전에 무인민원발급기로 뗄 수 있는 서류 정리',
    description: '등기부등본, 토지·건축물대장, 납세증명서, 주민등록 등·초본을 무인민원발급기에서 뗄 때 본인 확인·발급 시간·수수료를 공식 안내로 정리했어요. 한 기기에서 모두 뗄 수 있는 곳도 알려 드려요.',
    summary: '등기부는 평일 낮 제한이 있는 곳이 있고, 대장은 본인 확인 없이, 납세증명은 본인 지문으로 떼요.',
    published: '2026-11-25', modified: '2026-11-25',
    blocks: () => {
      const all4 = (k: (typeof kiosks)[number]) => k.docs.includes('registry') && k.docs.includes('land') && (k.docs.includes('tax') || k.docs.includes('nationalTax'));
      const both = count(all4);
      const h24 = count((k) => all4(k) && k.is24h);
      return [
        { h2: '먼저 알아 두세요', p: [
          '이 글은 무인민원발급기에서 서류를 <strong>떼는 방법</strong>만 정리해요. 계약에 어떤 서류가 필요한지, 서류 내용을 어떻게 판단할지는 거래 형태에 따라 다르니 공인중개사나 법률 전문가 안내를 따르세요.',
        ] },
        { h2: '서류별로 정리하면', ul: [
          '<strong>등기부등본(부동산 등기사항증명서)</strong>: 법원 발급 서류라 24시간 기기라도 평일 09:00~18:00에만 발급하는 곳이 있어요(인천광역시 안내 예시). 등기부에는 발급한 시점의 내용이 나오니, 계약 당일 상태가 궁금하면 그날 다시 떼면 돼요.',
          '<strong>토지(임야)대장·건축물대장</strong>: 본인 확인(지문) 없이 뗄 수 있어요(도봉구·대구 동구 안내표). 무인기 수수료는 지자체마다 400~500원 예시가 있어요.',
          '<strong>지방세·국세 납세증명서</strong>: 무인기에서는 지문으로 본인을 확인해요(도봉구 안내표). 그래서 무인기로는 <strong>본인 것</strong>만 뗄 수 있어요. 국세 완납증명은 08~22시에만 발급하는 예시가 있어요(도봉구 안내표).',
          '<strong>주민등록 등·초본</strong>: 지문으로 본인을 확인하고, 수수료는 지자체마다 달라요. 정부24 온라인 발급은 무료예요(강동구 안내 표기).',
        ] },
        { h2: '한 번에 떼려면 평일 낮이 안전해요', ul: [
          '등기부등본의 평일 낮 제한과 국세 완납증명의 08~22시 예시를 함께 고려하면, 서류를 한 번에 떼려면 <strong>평일 낮</strong>에 가는 것이 가장 안전해요.',
          '수수료를 현금만 받는 기기가 있으니 현금을 조금 준비하세요.',
          '등기부등본은 대법원 인터넷등기소(iros.go.kr), 건축물대장은 정부24에서도 발급·열람할 수 있어요. 이용 시간과 수수료는 각 사이트 안내를 확인하세요.',
        ] },
        { h2: '한 기기에서 모두 뗄 수 있는 곳', p: [
          `${DATA_NOTE} 이 중 등기부등본, 토지·건축물대장, 납세증명(지방세 또는 국세)을 한 기기에서 모두 발급하는 곳은 ${n(both)}곳이고, 그중 24시간 기기는 ${n(h24)}곳이에요. 다만 24시간 기기라도 등기부등본은 평일 낮에만 발급될 수 있어요.`,
          '서류별 자세한 내용은 <a href="/muin/guide/court-documents-hours/">등기부등본 발급 시간</a>, <a href="/muin/guide/land-building-register/">토지·건축물대장</a>, <a href="/muin/guide/tax-payment-certificate/">납세증명서</a> 가이드를 참고하세요.',
        ] },
      ];
    },
    related: () => [
      { title: '등기부·대장·납세증명을 한 기기에서 뗄 수 있는 곳이 많은 지역', links: topRegions((r) => kiosks.filter((k) => k.sido === r.sido && k.sigungu === r.sigungu && k.docs.includes('registry') && k.docs.includes('land') && (k.docs.includes('tax') || k.docs.includes('nationalTax'))).length, '세 가지 모두', 'registry', 6) },
    ],
    sources: [S.incheon, S.gov24, S.dobong, S.daeguDong, S.gangnamLand, S.gangdongFee, S.data],
  },
];

export const GUIDE_BASE = '/muin/guide/';
export const guidePath = (g: Pick<Guide, 'slug'>) => `${GUIDE_BASE}${g.slug}/`;
