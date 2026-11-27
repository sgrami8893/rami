// 생활 정보 가이드(2026-11-27 제미나이 합의 4번). 전월세 3편 + 주차 1편. 무인발급기 서류는 기존 /muin/guide/ 글로 잇는다.
// 원칙: 법령 원문(국가법령정보센터)과 정부 안내에 있는 사실만, 해요체. 판정·추천·법률 자문 표현 없음. 다른 사이트 문장 복사 없음.
// 조문 번호는 2026-11-27 기준. 법이 바뀌면 modified 날짜와 함께 고친다.
import type { Guide, Source } from './guides.ts';
import { BASE_RATE, BASE_RATE_CHECKED, conversionRate, depositToMonthlyWon } from '../../scripts/lib/rent-calc.ts';

export type LifeGuide = Guide & { tool: 'rent' | 'parking' };
const S: Record<string, Source> = {
  lease: { name: '국가법령정보센터, 주택임대차보호법', url: 'https://www.law.go.kr/법령/주택임대차보호법' },
  leaseDecree: { name: '국가법령정보센터, 주택임대차보호법 시행령', url: 'https://www.law.go.kr/법령/주택임대차보호법시행령' },
  dealReport: { name: '국가법령정보센터, 부동산 거래신고 등에 관한 법률', url: 'https://www.law.go.kr/법령/부동산거래신고등에관한법률' },
  easylaw: { name: '법제처 찾기쉬운 생활법령정보(주택임대차)', url: 'https://www.easylaw.go.kr' },
  gov24: { name: '정부24(전입신고·건축물대장 발급)', url: 'https://www.gov.kr' },
  iros: { name: '대법원 인터넷등기소(등기사항증명서·확정일자)', url: 'https://www.iros.go.kr' },
  rtms: { name: '부동산거래관리시스템(주택 임대차 신고)', url: 'https://rtms.molit.go.kr' },
  bok: { name: '한국은행 기준금리', url: 'https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643' },
  elis: { name: '자치법규정보시스템(지자체 주차장 조례 찾기)', url: 'https://www.elis.go.kr' },
  parkingData: { name: '공공데이터포털 전국주차장정보표준데이터', url: 'https://www.data.go.kr/data/15012896/standard.do' },
};
const won = (x: number) => `${Math.round(x / 1000) * 1000 > 0 ? (Math.round(x / 1000) * 1000).toLocaleString('ko-KR') : x.toLocaleString('ko-KR')}원`;

export const LIFE_GUIDES: LifeGuide[] = [
  {
    tool: 'rent',
    slug: 'move-in-and-fixed-date',
    title: '전입신고와 확정일자, 무엇이 다르고 언제 하나요',
    description: '전월세 계약 뒤 하는 전입신고와 확정일자가 법에서 각각 어떤 효력과 연결되는지, 어디서 신청하는지 주택임대차보호법 조문을 바탕으로 정리했어요.',
    summary: '전입신고(와 입주)는 대항력, 여기에 확정일자까지 갖추면 우선변제권과 이어져요.',
    published: '2026-11-27', modified: '2026-11-27',
    blocks: () => [
      { h2: '먼저 알아 두세요', p: ['이 글은 법 조문과 정부 안내에 적힌 내용을 정리한 일반 정보예요. 내 계약에 어떻게 적용되는지는 계약 내용에 따라 달라질 수 있으니, 필요하면 법률구조공단이나 주택임대차분쟁조정위원회 같은 공식 상담 창구에 물어보세요.'] },
      { h2: '전입신고: 대항력과 이어져요', p: [
        '주택임대차보호법 제3조 제1항은 임차인이 <strong>주택을 넘겨받고(입주) 주민등록(전입신고)을 마치면, 그 다음 날부터</strong> 제3자에게도 임대차를 주장할 수 있다고 정해요. 이것을 흔히 대항력이라고 불러요.',
        '효력이 신고한 날이 아니라 <strong>다음 날</strong>부터 생긴다는 점이 조문에 적혀 있어요.',
      ] },
      { h2: '확정일자: 우선변제권과 이어져요', p: [
        '같은 법 제3조의2 제2항은 위 대항 요건을 갖추고 <strong>임대차계약서에 확정일자</strong>까지 받은 임차인이, 집이 경매나 공매로 넘어갈 때 뒤 순위 권리자보다 먼저 보증금을 돌려받을 수 있다고 정해요. 흔히 우선변제권이라고 해요.',
        '확정일자는 계약서에 그 날짜에 계약서가 있었다는 것을 공적으로 찍어 주는 거예요.',
      ] },
      { h2: '어디서 하나요', ul: [
        '<strong>전입신고</strong>: 새 주소지 주민센터에서 하거나 정부24에서 온라인으로 할 수 있어요.',
        '<strong>확정일자</strong>: 주민센터, 등기소에서 받을 수 있고, 대법원 인터넷등기소에서 온라인으로도 신청할 수 있어요.',
        '<strong>주택 임대차 신고</strong>: 부동산 거래신고 등에 관한 법률은 일정 금액을 넘는 주택 임대차 계약을 계약일부터 30일 안에 신고하도록 정하고, 신고하면 확정일자를 받은 것으로 봐요. 대상 금액과 지역은 법령과 부동산거래관리시스템 안내를 확인하세요.',
      ] },
      { h2: '함께 보면 좋은 화면', p: ['동네별 전월세 실거래 중위값은 <a href="/rent/">전월세 시세</a>에서, 계약에 쓰는 서류를 무인민원발급기로 떼는 방법은 <a href="/muin/guide/real-estate-contract-documents/">부동산 계약 서류 가이드</a>에서 볼 수 있어요.'] },
    ],
    related: () => [],
    sources: [S.lease, S.dealReport, S.easylaw, S.gov24, S.iros, S.rtms],
  },
  {
    tool: 'rent',
    slug: 'jeonse-to-wolse-conversion',
    title: '보증금을 월세로 바꿀 때 전환율 상한 계산하기',
    description: `계약 중 보증금 일부를 월세로 바꿀 때 법이 정한 전환율 상한(연 10%와 기준금리+2% 중 낮은 쪽)과 계산 예시를 정리했어요. ${BASE_RATE_CHECKED} 기준금리 ${BASE_RATE}%로 계산했어요.`,
    summary: `상한은 '연 10%'와 '기준금리 + 연 2%' 중 낮은 값이에요. 지금은 연 ${conversionRate()}%예요.`,
    published: '2026-11-27', modified: '2026-11-27',
    blocks: () => {
      const r = conversionRate();
      const ex = depositToMonthlyWon(5000, r);
      return [
        { h2: '법이 정한 상한', p: [
          '주택임대차보호법 제7조의2는 보증금의 전부나 일부를 월 단위 차임(월세)으로 바꿀 때, 바꾼 금액에 곱하는 비율이 넘지 못하는 선을 정해요. 시행령 제9조가 그 숫자를 정해요.',
          `상한은 <strong>연 10%</strong>와 <strong>한국은행 기준금리 + 연 2%</strong> 중 <strong>낮은 쪽</strong>이에요. 기준금리가 ${BASE_RATE}%(${BASE_RATE_CHECKED} 확인)이면 상한은 연 ${r}%예요.`,
        ] },
        { h2: '계산해 보면', p: [
          `월세 상한 = 월세로 바꾸는 보증금 × 연 ${r}% ÷ 12`,
          `예를 들어 보증금 중 5,000만 원을 월세로 바꾸면 5,000만 원 × ${r}% ÷ 12 = 월 약 ${won(ex)}이 상한이에요.`,
          '동네 화면의 <strong>계산</strong> 탭에서 금액을 넣어 바로 계산할 수 있어요.',
        ] },
        { h2: '알아 둘 점', ul: [
          '조문은 계약 중 보증금을 월세로 <strong>바꾸는 경우</strong>를 대상으로 해요. 새로 계약하면서 정하는 월세에도 적용되는지는 상황에 따라 해석이 다를 수 있으니 공식 상담 창구에 확인하세요.',
          '기준금리는 한국은행 금융통화위원회가 바꿀 수 있어요. 바뀌면 상한도 함께 바뀌어요.',
          '실거래 통계의 보증금·월세 조합은 실제 계약 결과라서, 이 상한으로 계산한 값과 다를 수 있어요.',
        ] },
      ];
    },
    related: () => [],
    sources: [S.lease, S.leaseDecree, S.bok, S.easylaw],
  },
  {
    tool: 'rent',
    slug: 'documents-before-lease',
    title: '전월세 계약 전에 보는 서류와 떼는 곳',
    description: '등기사항증명서, 건축물대장, 임대인 납세증명서가 각각 무엇을 보여 주는 서류인지와 어디서 발급·열람하는지 정리했어요.',
    summary: '등기사항증명서는 인터넷등기소, 건축물대장은 정부24, 무인민원발급기에서도 뗄 수 있어요.',
    published: '2026-11-27', modified: '2026-11-27',
    blocks: () => [
      { h2: '먼저 알아 두세요', p: ['서류를 어떻게 읽고 판단할지는 거래마다 달라요. 이 글은 서류가 무엇을 담고 있는지와 떼는 곳만 정리해요. 판단이 필요하면 공인중개사나 공식 상담 창구의 안내를 받으세요.'] },
      { h2: '서류별로 담긴 내용', ul: [
        '<strong>등기사항증명서(등기부등본)</strong>: 집의 소유자와, 근저당 같은 권리가 등기돼 있는지 나와요. 발급한 시점의 내용이라 날짜가 지나면 바뀌었을 수 있어요.',
        '<strong>건축물대장</strong>: 건물의 용도, 면적, 층수 같은 건축 정보가 나와요.',
        '<strong>임대인의 납세증명서</strong>: 주택임대차보호법 제3조의7은 계약할 때 임차인이 임대인에게 국세·지방세 납세증명서를 보여 달라고 요구할 수 있다고 정해요.',
      ] },
      { h2: '어디서 떼나요', ul: [
        '등기사항증명서: 대법원 인터넷등기소, 등기소, 일부 무인민원발급기',
        '건축물대장: 정부24, 주민센터, 무인민원발급기',
        '납세증명서: 본인(임대인)이 정부24·홈택스·위택스나 무인민원발급기에서 떼요.',
      ] },
      { h2: '무인민원발급기로 뗄 때', p: ['발급 시간 제한, 본인 확인, 수수료는 <a href="/muin/guide/real-estate-contract-documents/">부동산 계약 서류 가이드</a>에 정리해 두었어요. 가까운 기기는 <a href="/muin/">무인민원발급기 찾기</a>에서 볼 수 있어요.'] },
    ],
    related: () => [],
    sources: [S.lease, S.iros, S.gov24, S.easylaw],
  },
  {
    tool: 'parking',
    slug: 'public-parking-discounts',
    title: '공영주차장 요금 감면, 내가 대상인지 확인하는 방법',
    description: '공영주차장 요금 감면은 지자체 조례로 정해서 지역마다 달라요. 감면 항목을 찾는 곳과 현장에서 준비할 것을 정리했어요.',
    summary: '감면 대상과 비율은 시·군·구 조례마다 달라서, 그 지역 조례와 주차장 안내를 확인해야 해요.',
    published: '2026-11-27', modified: '2026-11-27',
    blocks: () => [
      { h2: '감면은 지역마다 달라요', p: [
        '공영주차장 요금과 감면은 각 시·군·구의 <strong>주차장 설치 및 관리 조례</strong>로 정해요. 그래서 같은 차라도 지역에 따라 감면 여부와 비율이 다를 수 있어요.',
        '조례에 자주 나오는 감면 항목으로는 장애인 차량, 국가유공자 차량, 경차, 저공해 자동차, 다자녀 가구 등이 있어요. 실제 항목과 비율은 지역 조례로 확인하세요.',
      ] },
      { h2: '확인하는 방법', ul: [
        '자치법규정보시스템에서 "○○구 주차장 설치 및 관리 조례"를 찾아 감면 조항을 봐요.',
        '주차장 입구나 정산기 주변 안내문, 관리기관 홈페이지의 요금 안내를 봐요.',
        '이 사이트 주차장 상세 화면에 관리기관 연락처가 있으면 직접 물어볼 수 있어요.',
      ] },
      { h2: '현장에서 준비할 것', ul: [
        '감면은 증빙을 확인한 뒤 적용하는 곳이 많아요. 장애인 등록증, 국가유공자증, 다자녀 확인 서류 등 해당 증빙을 챙기세요.',
        '무인 정산기에서는 감면이 자동으로 안 되는 곳도 있어요. 정산 전에 안내 번호로 문의하세요.',
      ] },
      { h2: '이 사이트의 요금 표시', p: ['<a href="/parking/">공영주차장 찾기</a>의 예상 요금은 공공데이터에 적힌 <strong>기본 요금</strong>으로 계산해요. 감면은 반영하지 않아요.'] },
    ],
    related: () => [],
    sources: [S.elis, S.parkingData],
  },
];
export const LIFE_BASE = '/guide/';
export const lifePath = (g: LifeGuide) => `${LIFE_BASE}${g.slug}/`;
