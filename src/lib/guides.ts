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
};
const DATA_NOTE = `집계는 이 사이트가 공공데이터로 정리한 서울·경기·인천 무인민원발급기 ${n(total)}곳 기준입니다.`;

export const GUIDES: Guide[] = [
  {
    slug: 'court-documents-hours',
    title: '등기부등본·가족관계증명서, 무인민원발급기에서 언제 뽑을 수 있나',
    description: '24시간 무인민원발급기라도 등기부등본·가족관계증명서 같은 대법원 서류는 평일 낮에만 발급되는 곳이 있습니다. 발급 시간 제한과 대안을 정리했습니다.',
    summary: '24시간 기기라도 대법원 서류는 평일 09~18시만 되는 곳이 있습니다.',
    published: '2026-11-25', modified: '2026-11-25',
    blocks: () => {
      const reg = count((k) => k.docs.includes('registry'));
      const fam = count((k) => k.docs.includes('family'));
      return [
        { h2: '기기 운영시간과 서류 발급 시간은 다를 수 있습니다', p: [
          '무인민원발급기가 24시간 켜져 있어도 모든 서류를 24시간 발급하는 것은 아닙니다. 예를 들어 인천광역시청 무인민원발급기 안내는 기기를 평일·주말 24시간 운영한다고 하면서도, <strong>대법원 민원서류(부동산등기부등본, 가족관계등록부, 제적부 등·초본)는 평일 09:00~18:00에만 발급</strong>한다고 적고 있습니다.',
          '정부24도 무인민원발급기의 발급 시간과 수수료는 자치단체 사정(조례)에 따라 달라질 수 있다고 안내합니다. 따라서 등기부등본이나 가족관계증명서가 필요하다면 <strong>평일 낮 시간에 방문</strong>하는 것이 가장 안전합니다.',
        ] },
        { h2: '모든 기기가 이 서류를 발급하지는 않습니다', p: [
          `기기마다 발급 가능한 서류도 다릅니다. ${DATA_NOTE} 이 중 부동산 등기부등본을 발급하는 기기는 ${n(reg)}곳(${pct(reg)}), 가족관계등록부 증명서를 발급하는 기기는 ${n(fam)}곳(${pct(fam)})입니다.`,
          '지역 페이지에서 <strong>등기부등본</strong> 또는 <strong>가족관계증명서</strong> 필터를 켜면 해당 서류를 발급하는 기기만 볼 수 있습니다.',
        ] },
        { h2: '이 사이트의 운영시간 표시에 대해', p: [
          '이 사이트가 보여 주는 운영시간은 원천 데이터에 등록된 <strong>기기 운영시간</strong>입니다. 원천 데이터에는 서류별 발급 시간이 따로 없어서, "지금 운영 중"으로 표시된 기기라도 대법원 서류는 발급되지 않을 수 있습니다. 중요한 서류는 방문 전에 관리기관에 확인하세요.',
        ] },
        { h2: '평일 낮에 가기 어렵다면', ul: [
          '부동산 등기사항증명서는 대법원 인터넷등기소(iros.go.kr)에서도 열람·발급할 수 있습니다.',
          '가족관계등록부 증명서는 대법원 전자가족관계등록시스템(efamily.scourt.go.kr)에서도 발급할 수 있습니다.',
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
    description: '무인민원발급기에서 지문 인식이 계속 실패할 때 원인과 지문 재등록 방법, 지문 없이 서류를 받는 방법을 정리했습니다.',
    summary: '지문이 닳아 인식이 안 되면 주민센터에서 지문을 다시 등록할 수 있습니다.',
    published: '2026-11-25', modified: '2026-11-25',
    blocks: () => [
      { h2: '왜 본인 서류에 지문이 필요한가요', p: [
        '주민등록 등·초본, 가족관계등록부 증명서처럼 본인 확인이 필요한 서류는 무인민원발급기에서 지문으로 본인을 확인합니다. 반대로 부동산 등기사항증명서나 토지·건축물 관련 서류처럼 본인 확인이 필요 없는 서류도 있습니다(인천광역시 무인민원발급기 안내의 서류별 본인확인 표 기준).',
      ] },
      { h2: '인식이 안 되는 흔한 이유', p: [
        '정책브리핑 기사는 나이가 들거나 손을 많이 쓰면서 <strong>지문이 마모·변형</strong>되면 무인민원발급기에서 인식이 잘 되지 않는다고 설명합니다. 이 경우 손가락을 바꾸거나 다시 시도해도 계속 실패할 수 있습니다.',
      ] },
      { h2: '지문 재등록 방법', p: [
        '같은 기사(2022년 12월 게시)에 따르면 지문 재등록은 다음과 같이 합니다. 제도가 바뀌었을 수 있으니 방문 전에 주민센터나 정부24에서 최신 안내를 확인하세요.',
      ], ul: [
        '거주지와 관계없이 가까운 주민센터에 <strong>본인이 직접</strong> 방문합니다(대리 신청 불가).',
        '최근 6개월 이내 사진 1장(3.5×4.5cm)을 준비하고, 주민등록증 재발급 신청서에 사유를 "지문 재등록"으로 적습니다.',
        '기사 기준으로 지문 마모·변형에 따른 재등록은 재발급 수수료 면제 대상이며, 기존 주민등록증을 반납해야 합니다.',
        '정부24에서 "주민등록증 재발급"을 신청할 수도 있지만, 지문 등록을 위해 수령할 때 직접 방문해야 합니다.',
      ] },
      { h2: '지금 당장 서류가 필요하다면', ul: [
        '운영 중인 주민센터 창구에서 신분증으로 본인 확인을 받고 발급받을 수 있습니다.',
        '등기부등본처럼 본인 확인이 필요 없는 서류는 지문 없이 무인민원발급기에서 발급할 수 있습니다.',
        '정부24 등 온라인 발급을 이용할 수도 있습니다(본인 인증 수단 필요).',
      ] },
    ],
    related: () => [
      { title: '지금 운영 중인 기기가 많은 지역 (주말·공휴일 운영 기준)', links: topRegions((r) => r.openWeekend, '주말·공휴일', 'weekend') },
    ],
    sources: [S.fingerprint, S.incheon],
  },
  {
    slug: 'fees-and-payment',
    title: '무인민원발급기 수수료와 결제 수단, 무엇을 준비해야 할까',
    description: '무인민원발급기 서류별 수수료 예시와 결제 수단, 수수료 면제 사례를 공식 안내 기준으로 정리했습니다.',
    summary: '수수료는 지자체 조례마다 다르고, 현금이 필요한 서류가 있습니다.',
    published: '2026-11-25', modified: '2026-11-25',
    blocks: () => [
      { h2: '수수료는 지역마다 다를 수 있습니다', p: [
        '정부24는 무인민원발급기의 발급 수수료가 자치단체 사정(조례)에 따라 달라질 수 있다고 안내합니다. 아래 금액은 <strong>인천광역시 안내(2026-10-02 업데이트)에 나온 예시</strong>이며, 다른 지역은 해당 지자체 안내를 확인해야 합니다.',
      ], ul: [
        '주민등록 등·초본: 200원',
        '가족관계등록부 증명서(일반·폐쇄): 500원, 제적 등본 500원·제적 초본 300원',
        '부동산 등기사항증명서(건물·토지·집합건물): 1,000원, "현금"으로 표시',
        '지방세 세목별 과세증명서: 600원',
        '지방세 납세증명서, 병적증명서, 국세 증명, 건강보험 확인서 등은 수수료 없음으로 표시',
      ] },
      { h2: '창구보다 저렴한 편입니다', p: [
        '2026년 4월 보도에 따르면 주민등록 등·초본 수수료는 주민센터 창구에서 1통 400원, 무인민원발급기에서 200원이고 온라인 발급은 무료입니다.',
      ] },
      { h2: '수수료 면제 사례', p: [
        '정부나 지자체가 수수료를 한시적으로 면제하기도 합니다. 예를 들어 2026년 4~7월 고유가 피해지원금 신청 기간에는 정부가 무인민원발급기의 주민등록 등·초본 수수료를 한시 면제했습니다(1차 4월 27일~5월 8일, 2차 5월 18일~7월 3일). 이 기간은 이미 끝났으며, 현재 면제 여부는 지역마다 다르므로 해당 지자체 안내를 확인하세요.',
      ] },
      { h2: '결제 수단 준비 팁', p: [
        '결제 수단은 기기마다 다릅니다. 인천광역시 안내에도 등기사항증명서 수수료가 "현금"으로 표시돼 있듯, <strong>현금만 받는 기기나 서류가 있으므로 소액 현금(지폐·동전)을 준비</strong>하는 것이 안전합니다.',
      ] },
    ],
    related: () => [
      { title: '등기부등본 발급 기기가 많은 지역', links: topRegions((r) => r.docs.registry ?? 0, '등기부등본', 'registry', 4) },
      { title: '24시간 기기가 많은 지역', links: topRegions((r) => r.is24h, '24시간', '24h', 4) },
    ],
    sources: [S.gov24, S.incheon, S.feeWaiver],
  },
  {
    slug: '24h-weekend',
    title: '수도권 24시간·주말 무인민원발급기 찾는 법 (지역별 통계)',
    description: '서울·경기·인천 무인민원발급기 중 24시간, 일요일·공휴일에 운영하는 곳이 몇 곳이고 어느 지역에 많은지 실데이터로 정리했습니다.',
    summary: '수도권 24시간 기기와 주말 운영 기기를 지역별로 찾는 방법입니다.',
    published: '2026-11-25', modified: '2026-11-25',
    blocks: () => {
      const h24 = count((k) => k.is24h), sun = count((k) => k.openSun), hol = count((k) => k.openHoliday);
      const bySido = (['seoul', 'gyeonggi', 'incheon'] as const).map((s) => {
        const ks = kiosks.filter((k) => k.sido === s);
        return `${sidoShort(s)}: 전체 ${n(ks.length)}곳 중 24시간 ${n(ks.filter((k) => k.is24h).length)}곳, 일요일 운영 ${n(ks.filter((k) => k.openSun).length)}곳`;
      });
      return [
        { h2: '수도권 현황', p: [
          `${DATA_NOTE} 이 중 <strong>24시간 운영 기기는 ${n(h24)}곳(${pct(h24)})</strong>, 일요일에 운영하는 기기는 ${n(sun)}곳, 공휴일에 운영하는 기기는 ${n(hol)}곳입니다.`,
        ], ul: bySido },
        { h2: '이 사이트에서 찾는 방법', ul: [
          '시·군·구 페이지에서 <strong>24시간</strong> 또는 <strong>주말·공휴일</strong> 필터를 켜면 해당 기기만 남습니다.',
          '<strong>지금 운영 중</strong> 필터는 한국 시간(KST) 기준으로 지금 열려 있는 기기만 보여 줍니다(공휴일 반영).',
          '각 기기 상세 페이지에서 평일·토·일·공휴일 운영시간을 따로 볼 수 있습니다.',
        ] },
        { h2: '확인해 둘 점', ul: [
          '24시간 기기라도 등기부등본·가족관계증명서 같은 대법원 서류는 평일 낮에만 발급되는 곳이 있습니다.',
          '24시간 기기도 점검 시간이 있을 수 있습니다. 예를 들어 인천광역시청 기기는 매일 03:00~04:00 업데이트로 이용할 수 없다고 안내합니다.',
          '원천 데이터에는 토요일 운영시간이 따로 없어, 이 사이트는 공휴일 운영시간을 토·일요일에도 적용합니다. 공휴일 칸이 비어 있는 기기는 휴무로 보고 "일부 추정"이라고 표시합니다.',
        ] },
      ];
    },
    related: () => [
      { title: '24시간 기기가 많은 지역', links: topRegions((r) => r.is24h, '24시간', '24h', 8) },
      { title: '주말·공휴일 운영 기기가 많은 지역', links: topRegions((r) => r.openWeekend, '주말·공휴일', 'weekend', 8) },
    ],
    sources: [S.data, S.incheon],
  },
  {
    slug: 'accessibility',
    title: '음성 안내·점자·휠체어, 무인민원발급기 장애인 편의 기능 안내',
    description: '수도권 무인민원발급기의 음성 안내, 점자 라벨, 휠체어 사용자 조작 등 장애인 편의 기능 현황과 이용 시 확인할 점을 정리했습니다.',
    summary: '수도권 기기의 장애인 편의 기능 현황과 기기별 확인 방법입니다.',
    published: '2026-11-25', modified: '2026-11-25',
    blocks: () => {
      const F = ['음성 안내', '점자 라벨', '시각장애인용 키패드', '이어폰 소켓', '화면 확대', '청각장애인용 화면 안내', '휠체어 사용자 조작', '촉각 모니터'];
      return [
        { h2: '무인정보단말기 접근성은 법적 의무입니다', p: [
          '보건복지부는 2026년 1월 28일부터 장애인차별금지법과 같은 법 시행령에 따라, 공공과 민간의 재화·용역 제공자가 무인정보단말기(키오스크)를 설치·운영할 때 장애인이 이용할 수 있도록 접근성을 갖추는 의무가 전면 시행된다고 밝혔습니다. 정당한 편의에는 단말기 위치를 음성으로 안내하는 장치 등이 포함됩니다.',
        ] },
        { h2: '수도권 기기의 편의 기능 현황', p: [
          `${DATA_NOTE} 원천 데이터에 각 기능이 "제공"으로 기재된 기기 수는 다음과 같습니다.`,
        ], ul: F.map((f) => { const c = count((k) => !!k.a11y?.includes(f)); return `${f}: ${n(c)}곳(${pct(c)})`; }) },
        { h2: '기기별로 확인하는 방법', ul: [
          '각 기기 상세 페이지의 <strong>장애인 편의</strong> 항목에 원천 데이터에 기재된 기능이 표시됩니다.',
          '정부24 무인민원발급안내에서도 기기별 편의 기능(음성안내, 점자라벨, 이어폰소켓, 촉각모니터, 화면확대, 휠체어 사용자 조작)을 확인할 수 있습니다.',
          '데이터에는 기기까지 가는 길(계단, 경사로, 엘리베이터 등) 정보가 없습니다. 이동이 불편하다면 방문 전에 관리기관에 문의하세요.',
          '데이터 기재 내용과 현장이 다를 수 있습니다. 다른 점을 발견하면 상세 페이지의 정보 오류 제보로 알려 주세요.',
        ] },
      ];
    },
    related: () => [
      { title: '촉각 모니터 기기가 많은 지역', links: topRegions((r) => a11yIn(r, '촉각 모니터'), '촉각 모니터') },
      { title: '휠체어 사용자 조작 기기가 많은 지역', links: topRegions((r) => a11yIn(r, '휠체어 사용자 조작'), '휠체어 조작') },
    ],
    sources: [S.kiosk, S.gov24, S.data],
  },
];

export const GUIDE_BASE = '/muin/guide/';
export const guidePath = (g: Pick<Guide, 'slug'>) => `${GUIDE_BASE}${g.slug}/`;
