// 가짜 전월세 거래(구조 테스트 전용). 실제 거래가 아니며 RENT_PREVIEW=1 빌드에서만 페이지가 생긴다.
// 실제 데이터 흐름과 같게 Deal → aggregate() 를 거쳐 통계만 저장한다.
import { writeFileSync } from 'node:fs';
import { aggregate, type Deal, type HouseType } from './lib/rent.ts';

let s = 7; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
// [지역코드, 동, 빌라 거래 수, 오피스텔 거래 수, 전세 보증금 기준(만원)]
const AREAS: [string, string, number, number, number][] = [
  ['11680', '역삼동', 70, 90, 26000], ['11680', '논현동', 55, 40, 24000], ['11680', '삼성동', 8, 25, 30000], ['11680', '개포동', 4, 0, 22000],
  ['11440', '망원동', 60, 10, 21000], ['11440', '합정동', 20, 35, 23000], ['11440', '성산동', 12, 3, 20000],
  ['11620', '신림동', 120, 60, 15000], ['11620', '봉천동', 80, 25, 16000],
  ['41135', '정자동', 6, 70, 25000], ['41135', '서현동', 9, 12, 22000],
  ['28237', '부평동', 45, 20, 11000], ['28237', '십정동', 15, 2, 9000],
];
const deals: Deal[] = [];
const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(Date.UTC(2025, 10 + i, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; });
for (const [code, dong, nv, no, base] of AREAS) {
  for (const [type, n] of [['villa', nv], ['officetel', no]] as [HouseType, number][]) {
    for (let i = 0; i < n; i++) {
      const area = type === 'officetel' ? 17 + r() * 40 : 25 + r() * 60;
      const scale = area / 45;
      const jeonse = r() < (type === 'villa' ? 0.45 : 0.25);
      const deposit = jeonse ? Math.round((base * scale * (0.8 + r() * 0.4)) / 500) * 500 : Math.round((500 + r() * 4500) / 100) * 100;
      const monthly = jeonse ? 0 : Math.round((40 + scale * 50 * (0.8 + r() * 0.4)));
      deals.push({ type, code, dong, ym: months[Math.floor(r() * 12)], deposit, monthly, area: Math.round(area * 100) / 100, buildYear: 1990 + Math.floor(r() * 34), renewal: r() < 0.7 ? 'new' : 'renew', usedRight: r() < 0.15 });
    }
  }
}
const { stats } = aggregate(deals, { isMock: true });
writeFileSync('src/data/rent-stats.mock.json', JSON.stringify(stats));
console.log(`가짜 거래 ${deals.length}건 → 지역 ${stats.areas.length}개 (${stats.from}~${stats.to})`);
