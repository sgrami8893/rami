// 상황별 서류 체크리스트 (2026-11-25).
// 원칙: 서류별 '무인기 본인 확인·발급 시간' 같은 사실은 이미 출처를 확인한 가이드 내용만 쓴다(guides.ts S.* 출처).
// 상황 → 서류 묶음은 '자주 요청되는 예'일 뿐 공식 목록이 아니다. 화면에 "제출처 안내가 기준"이라고 항상 밝히고,
// 출처가 없는 서류 정보는 '기관에 확인'으로 둔다. 체크 상태는 브라우저 localStorage에만 저장(서버 전송 없음).
import { kiosks } from './data.ts';
import type { DocCode } from '../../scripts/lib/docs.ts';

export interface DocInfo { label: string; code: DocCode | null; idCheck: string; note?: string; guide?: { href: string; label: string } }

/** 서류별 무인기 정보. idCheck 문구는 도봉구·대구 동구 발급 안내표(guides.ts how-to-use)와 인천시 안내(court-documents-hours) 기준. */
export const DOCS: Record<string, DocInfo> = {
  registry: { label: '부동산 등기사항증명서(등기부등본)', code: 'registry', idCheck: '본인 확인 필요 없음', note: '24시간 기기라도 평일 09:00~18:00에만 발급하는 곳이 있어요(인천광역시 안내 예시).', guide: { href: '/muin/guide/court-documents-hours/', label: '발급 시간 안내' } },
  land: { label: '토지(임야)대장·건축물대장', code: 'land', idCheck: '본인 확인 필요 없음', guide: { href: '/muin/guide/land-building-register/', label: '토지·건축물대장 안내' } },
  residentCopy: { label: '주민등록등본', code: 'resident', idCheck: '지문으로 본인 확인', note: '포함할 항목(세대 구성, 주소 변동 등)은 제출처에 확인하세요.', guide: { href: '/muin/guide/resident-registration-copy/', label: '등·초본 발급 경로' } },
  residentAbstract: { label: '주민등록초본', code: 'resident', idCheck: '지문으로 본인 확인', note: '주소 변동 이력 포함 여부 등은 제출처에 확인하세요.', guide: { href: '/muin/guide/resident-registration-copy/', label: '등·초본 발급 경로' } },
  family: { label: '가족관계증명서', code: 'family', idCheck: '지문으로 본인 확인', note: '일반·상세 중 어떤 증명서가 필요한지 제출처에 확인하세요. 평일 낮에만 발급하는 기기가 있어요.', guide: { href: '/muin/guide/court-documents-hours/', label: '발급 시간 안내' } },
  localTax: { label: '지방세 납세증명서', code: 'tax', idCheck: '지문으로 본인 확인(본인 것만 발급)', guide: { href: '/muin/guide/tax-payment-certificate/', label: '납세증명서 안내' } },
  nationalTax: { label: '국세 납세증명서(국세 완납증명)', code: 'nationalTax', idCheck: '지문으로 본인 확인(본인 것만 발급)', note: '08~22시에만 발급하는 예시가 있어요(도봉구 안내표).', guide: { href: '/muin/guide/tax-payment-certificate/', label: '납세증명서 안내' } },
  health: { label: '건강보험 관련 증명', code: 'health', idCheck: '기관에 확인', note: '필요한 증명 종류와 무인기 발급 범위는 국민건강보험공단·제출처에 확인하세요.' },
  vehicle: { label: '자동차 등록원부', code: 'vehicle', idCheck: '기관에 확인', note: '갑·을 구분과 무인기 발급 범위는 관할 차량등록사업소·제출처에 확인하세요.' },
  incomeOther: { label: '소득 증빙(원천징수영수증 등)', code: null, idCheck: '무인기 발급 대상 아님(확인 필요)', note: '회사·국세청 홈택스 등에서 받는 서류일 수 있어요. 제출처에 확인하세요.' },
};

export interface Situation { id: string; title: string; intro: string; items: string[] }
export const SITUATIONS: Situation[] = [
  { id: 'realestate', title: '부동산 계약(매매·전월세)', intro: '계약 전 권리관계·건물 정보를 확인할 때 자주 떼는 서류예요.', items: ['registry', 'land', 'residentCopy', 'localTax', 'nationalTax'] },
  { id: 'jeonseloan', title: '전세자금대출 신청', intro: '은행·보증기관마다 요구 서류가 달라요. 받은 안내문과 대조해 쓰세요.', items: ['residentCopy', 'residentAbstract', 'family', 'registry', 'health', 'incomeOther'] },
  { id: 'yearend', title: '연말정산(부양가족 공제)', intro: '회사가 요청하는 경우에 떼는 서류 예예요. 회사 안내가 기준이에요.', items: ['family', 'residentCopy'] },
  { id: 'car', title: '자동차 등록·이전', intro: '차량 관련 업무 전에 확인용으로 찾는 서류 예예요.', items: ['vehicle', 'residentAbstract', 'localTax'] },
];

/** 서류를 발급하는 수도권 기기 수(데이터 기준) */
export const kioskCount = (code: DocCode | null) => (code ? kiosks.filter((k) => k.docs.includes(code)).length : 0);
