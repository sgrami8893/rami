// Issuable-document keyword dictionary -> standard codes used by filters and FAQ.

export type DocCode =
  | 'resident' | 'family' | 'registry' | 'land' | 'tax' | 'nationalTax' | 'health' | 'pension' | 'employment'
  | 'vehicle' | 'passport' | 'education' | 'military' | 'veterans' | 'welfare' | 'farm' | 'traffic' | 'removedRecord'
  | 'fishery' | 'other';

export const DOC_LABELS: Record<DocCode, string> = {
  resident: '주민등록 등·초본',
  family: '가족관계증명서',
  registry: '등기부등본',
  land: '토지·건축물대장',
  tax: '지방세 증명',
  nationalTax: '국세 증명',
  health: '건강보험',
  pension: '국민연금',
  employment: '고용·산재보험',
  vehicle: '자동차 등록원부',
  passport: '여권 관련',
  education: '졸업·성적 증명',
  military: '병적증명서',
  veterans: '보훈 증명',
  welfare: '보건복지',
  farm: '농지·농업경영체',
  traffic: '운전경력(경찰청)',
  removedRecord: '제적 등·초본',
  fishery: '수산',
  other: '기타',
};

/** localdata 발급제증명 파일의 초기메뉴명 -> 코드 */
export const MENU_TO_DOC: Record<string, DocCode> = {
  '주민등록': 'resident', '주민등록등(초)본': 'resident', '가족관계등록부': 'family', '부동산': 'registry',
  '지적, 토지, 건축': 'land', '지방세': 'tax', '국세증명': 'nationalTax', '건강보험': 'health', '국민연금': 'pension',
  '고용, 산재보험(근로복지공단)': 'employment', '차량': 'vehicle', '여권': 'passport', '교육제증명 대학교(원) 제외': 'education',
  '병무': 'military', '보훈증명': 'veterans', '보건복지': 'welfare', '농지대장, 농업경영체': 'farm', '교통(경찰청)': 'traffic',
  '제적부': 'removedRecord', '수산': 'fishery',
};

const KEYWORDS: [DocCode, RegExp][] = [
  ['resident', /주민등록|등\s*[·ㆍ,]?\s*초본|등본(?!.*등기)|초본|공통서류/],
  ['family', /가족관계|기본증명|혼인관계|입양관계|친양자|제적/],
  ['registry', /등기/],
  ['land', /토지|임야|건축물|대장|공시지가|이용계획/],
  ['tax', /지방세|납세|세목별|과세/],
];

/** Split a free-text list and map each item; unknown items are returned for the build report. */
export function parseDocs(raw: string): { docs: DocCode[]; unknownItems: string[] } {
  const items = (raw ?? '').split(/[,、\/;\n|]+|\s{2,}|ㆍ(?=[가-힣]{3,})/).map((s) => s.trim()).filter(Boolean);
  const found = new Set<DocCode>();
  const unknownItems: string[] = [];
  for (const item of items) {
    let hits = KEYWORDS.filter(([, re]) => re.test(item)).map(([c]) => c);
    // "등기부등본" contains "등본" but is not a 주민등록 document.
    if (hits.includes('registry') && !/주민등록|초본/.test(item)) hits = hits.filter((h) => h !== 'resident');
    if (hits.length) hits.forEach((h) => found.add(h));
    else { found.add('other'); unknownItems.push(item); }
  }
  return { docs: [...found], unknownItems };
}

/** 안산 style per-document Y/N columns. */
export function docsFromFlags(flags: Partial<Record<'resident' | 'family' | 'registry', string>>): DocCode[] {
  const yes = (v?: string) => !!v && /^(y|o|가능|있음|1|true|●|○)$/i.test(v.trim());
  return (Object.keys(flags) as ('resident' | 'family' | 'registry')[]).filter((k) => yes(flags[k]));
}
