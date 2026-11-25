// 가짜 주차장 데이터(구조 테스트 전용). 실제 주차장이 아니며 배포 빌드에는 쓰이지 않는다(PARKING_PREVIEW=1일 때만 페이지 생성).
import { writeFileSync } from 'node:fs';
import { FIELD, normalizeParking } from './lib/parking.ts';

const areas = [
  ['서울특별시 강남구 테헤란로', 37.50, 127.04], ['서울특별시 마포구 월드컵로', 37.56, 126.91], ['서울특별시 노원구 동일로', 37.65, 127.06],
  ['경기도 수원시 팔달구 효원로', 37.27, 127.03], ['경기도 성남시 분당구 황새울로', 37.38, 127.12], ['경기도 고양시 일산동구 중앙로', 37.66, 126.77],
  ['인천광역시 남동구 인하로', 37.45, 126.70], ['인천광역시 연수구 컨벤시아대로', 37.39, 126.64],
] as const;
// 동 구조 테스트용 법정동(앞 지역은 한 동에 5곳 이상이 생기게)
const DONGS = [['역삼동', '역삼동', '삼성동'], ['망원동', '합정동'], ['상계동', '상계동', '중계동'], ['매산로1가'], ['정자동', '정자동', '서현동'], ['장항동'], ['구월동', '간석동'], ['송도동']];
let s = 11; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
const rows: Record<string, string>[] = [];
areas.forEach(([addr, lat, lng], ai) => {
  const n = ai === 7 ? 2 : 6 + Math.floor(r() * 8); // 연수구는 2곳만 → 얇은 페이지(noindex) 테스트
  for (let i = 0; i < n; i++) {
    const t = r(); const free = t < 0.45, mixed = t > 0.9;
    rows.push({
      [FIELD.id]: `MOCK-${ai}-${i}`, [FIELD.name]: `테스트 공영주차장 ${ai + 1}-${i + 1}`,
      [FIELD.kind]: '공영', [FIELD.lotType]: ['노상', '노외', '부설'][i % 3],
      [FIELD.road]: `${addr} ${10 + i}`, [FIELD.jibun]: `${addr.split(' ').slice(0, -1).join(' ')} ${DONGS[ai][i % DONGS[ai].length]} ${100 + i}`, [FIELD.spaces]: String(20 + Math.floor(r() * 200)),
      [FIELD.wdOpen]: i % 4 === 0 ? '00:00' : '09:00', [FIELD.wdClose]: i % 4 === 0 ? '24:00' : '18:00',
      [FIELD.satOpen]: '09:00', [FIELD.satClose]: '13:00', [FIELD.holOpen]: '', [FIELD.holClose]: '',
      [FIELD.feeInfo]: free ? '무료' : mixed ? '혼합' : '유료',
      [FIELD.baseMin]: free ? '' : ['30', '5', '60'][i % 3], [FIELD.baseFee]: free ? (i === 5 ? '500' : '0') : ['600', '300', '1000', '500'][(i + ai) % 4], // i===5 무료+요금 충돌 케이스
      [FIELD.unitMin]: free ? '' : ['10', '5', '30'][i % 3], [FIELD.unitFee]: free ? '' : ['200', '100', '500', '300'][(i * 3 + ai) % 4], [FIELD.dayPass]: free || i % 3 ? '' : '8000', [FIELD.monthly]: '',
      [FIELD.payment]: '카드, 현금', [FIELD.note]: '', [FIELD.agency]: '테스트 관리기관', [FIELD.phone]: '',
      [FIELD.lat]: i === 3 ? '' : String(lat + (r() - 0.5) * 0.03), [FIELD.lng]: i === 3 ? '' : String(lng + (r() - 0.5) * 0.03),
      [FIELD.baseDate]: '2026-11-01',
      [FIELD.days]: '평일+토요일', [FIELD.grade]: String(1 + (i % 3)), [FIELD.oddEven]: '미시행', [FIELD.dayPassHours]: '', [FIELD.disabled]: i % 2 ? 'Y' : 'N',
      [FIELD.providerCode]: `MOCK${ai}`, [FIELD.providerName]: '테스트 제공기관',
    });
  }
});
const lots = rows.map(normalizeParking).filter((x) => x);
writeFileSync(new URL('../src/data/parking.mock.json', import.meta.url), JSON.stringify(lots, null, 0));
console.log(`mock parking lots: ${lots.length} (rows ${rows.length})`);
