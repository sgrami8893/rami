// Raw CSV record -> Kiosk. Pure functions; the build script handles IO.
import { createHash } from 'node:crypto';
import { pick, type CanonicalKey } from './aliases.ts';
import { parseColumns, parseText, type Hours, type Confidence } from './hours.ts';
import { parseDocs, docsFromFlags, type DocCode } from './docs.ts';
import { resolveRegion, type SidoSlug } from './regions.ts';

export interface Kiosk {
  id: string; name: string; locationDetail: string;
  sido: SidoSlug; sigungu: string; sigunguName: string; subGu: string | null; dong: string | null;
  roadAddress: string; jibunAddress: string | null; lat: number | null; lng: number | null;
  hoursRaw: string; hours: Hours; hoursConfidence: Confidence;
  is24h: boolean; openSat: boolean; openSun: boolean; openHoliday: boolean;
  docsRaw: string; docs: DocCode[];
  agency: string; phone: string | null; baseDate: string | null;
  /** m = metres when coordinates exist; absent when the alternative is "same 동/구" without coordinates. */
  nearby?: { id: string; m?: number }[];
  // localdata extras (optional so the older file formats still fit)
  sourceKey?: string; placeType?: string; infoUrl?: string | null; hoursNote?: string; a11y?: string[]; docCount?: number;
}

export type Skip = { reason: string; row: number; name?: string };

// 수도권 bounding box (sanity check for coordinates).
const BBOX = { latMin: 36.9, latMax: 38.3, lngMin: 125.9, lngMax: 127.9 };

const squash = (s: string) => s.replace(/[\s\p{P}\p{S}]/gu, '');

/** Stable 8-hex id from roadAddress + name + locationDetail (distinguishes 1층/지하1층 kiosks in one building). */
export function kioskId(roadAddress: string, name: string, locationDetail: string): string {
  return createHash('sha1').update(`${squash(roadAddress)}|${squash(name)}|${squash(locationDetail)}`).digest('hex').slice(0, 8);
}

function num(v: string): number | null {
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function phone(v: string): string | null {
  const d = v.replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('02')) return d.replace(/^(02)(\d{3,4})(\d{4})$/, '$1-$2-$3');
  return d.replace(/^(\d{3,4})(\d{3,4})(\d{4})$/, '$1-$2-$3');
}

function date(v: string): string | null {
  const m = v.match(/(\d{4})[-.\/]?(\d{1,2})[-.\/]?(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
}

export function normalizeRecord(
  rec: Record<string, string>, mapping: Partial<Record<CanonicalKey, string>>, row: number,
  report: { skips: Skip[]; hoursFailures: string[]; unknownDocs: Map<string, number> },
): Kiosk | null {
  const get = (k: CanonicalKey) => pick(rec, mapping, k);
  const name = get('name');
  const roadAddress = get('roadAddress') || get('jibunAddress');
  if (!name || !roadAddress) { report.skips.push({ reason: 'missing name/address', row, name }); return null; }

  const inUse = get('inUse');
  if (inUse && /^(n|아니오|미사용|폐지|중지)$/i.test(inUse)) { report.skips.push({ reason: 'not in use', row, name }); return null; }

  const region = resolveRegion(roadAddress, get('jibunAddress'), get('sido'), get('sigungu'));
  if (!region) { report.skips.push({ reason: 'outside 수도권 or unknown 시군구', row, name }); return null; }

  // Hours: prefer split columns when present, else free text.
  const hasCols = !!(mapping.weekdayOpen || mapping.satOpen || mapping.holidayOpen);
  const parsed = hasCols
    ? parseColumns({
        weekdayOpen: get('weekdayOpen'), weekdayClose: get('weekdayClose'),
        satOpen: get('satOpen'), satClose: get('satClose'),
        holidayOpen: get('holidayOpen'), holidayClose: get('holidayClose'),
      })
    : parseText(get('hoursText'));
  const hoursRaw = hasCols
    ? [['평일', 'weekdayOpen', 'weekdayClose'], ['토요일', 'satOpen', 'satClose'], ['공휴일', 'holidayOpen', 'holidayClose']]
        .map(([l, a, b]) => `${l} ${get(a as CanonicalKey)}~${get(b as CanonicalKey)}`).join(', ')
    : get('hoursText');
  if (parsed.confidence === 'unknown') report.hoursFailures.push(hoursRaw);

  // Documents: free-text column or per-document flag columns.
  const docsRaw = get('docsText');
  let docs: DocCode[];
  if (docsRaw) {
    const r = parseDocs(docsRaw);
    docs = r.docs;
    r.unknownItems.forEach((u) => report.unknownDocs.set(u, (report.unknownDocs.get(u) ?? 0) + 1));
  } else {
    docs = docsFromFlags({ resident: get('docResident'), family: get('docFamily'), registry: get('docRegistry') });
  }

  let lat = num(get('lat'));
  let lng = num(get('lng'));
  if (lat !== null && lng !== null && lat > 100 && lng < 100) [lat, lng] = [lng, lat]; // swapped columns
  if (lat === null || lng === null || lat < BBOX.latMin || lat > BBOX.latMax || lng < BBOX.lngMin || lng > BBOX.lngMax) {
    lat = null; lng = null; // TODO: geocode at build time (Kakao/VWorld) — 상세 페이지는 좌표 없으면 미생성
  }

  const locationDetail = get('locationDetail');
  const h = parsed.hours;
  return {
    id: kioskId(roadAddress, name, locationDetail),
    name, locationDetail,
    ...region,
    roadAddress, jibunAddress: get('jibunAddress') || null, lat, lng,
    hoursRaw, hours: h, hoursConfidence: parsed.confidence,
    is24h: parsed.is24h, openSat: !!h.sat, openSun: !!h.sun, openHoliday: !!h.holiday,
    docsRaw: docsRaw || docs.join(','), docs,
    agency: get('agency'), phone: phone(get('phone')), baseDate: date(get('baseDate')),
  };
}

/** Resolve id collisions (fully duplicated rows) with -2, -3 suffixes, in input order. */
export function dedupeIds(list: Kiosk[]): number {
  const seen = new Map<string, number>();
  let collisions = 0;
  for (const k of list) {
    const n = (seen.get(k.id) ?? 0) + 1;
    seen.set(k.id, n);
    if (n > 1) { k.id = `${k.id}-${n}`; collisions++; }
  }
  return collisions;
}

/** Haversine distance in metres. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}

/** Attach up to `max` kiosks within `radius` metres, nearest first, using a ~1km grid. */
export function attachNearby(list: Kiosk[], radius = 2000, max = 10): void {
  const cell = 0.01; // ≈1.1km lat, ≈0.9km lng in 수도권
  const key = (lat: number, lng: number) => `${Math.floor(lat / cell)}:${Math.floor(lng / cell)}`;
  const grid = new Map<string, Kiosk[]>();
  for (const k of list) if (k.lat !== null && k.lng !== null) {
    const g = key(k.lat, k.lng);
    (grid.get(g) ?? grid.set(g, []).get(g)!).push(k);
  }
  const span = Math.ceil(radius / 900);
  for (const k of list) {
    if (k.lat === null || k.lng === null) continue;
    const gy = Math.floor(k.lat / cell), gx = Math.floor(k.lng / cell);
    const cands: { id: string; m: number }[] = [];
    for (let dy = -span; dy <= span; dy++) for (let dx = -span; dx <= span; dx++) {
      for (const o of grid.get(`${gy + dy}:${gx + dx}`) ?? []) {
        if (o === k) continue;
        const m = distanceM(k as { lat: number; lng: number }, o as { lat: number; lng: number });
        if (m <= radius) cands.push({ id: o.id, m });
      }
    }
    k.nearby = cands.sort((a, b) => a.m - b.m).slice(0, max);
  }
  // No coordinates: fall back to kiosks in the same 동 (then same 일반구) of the same 시군구.
  const bySgg = Map.groupBy(list, (k) => `${k.sido}/${k.sigungu}`);
  for (const k of list) {
    if (k.lat !== null && k.lng !== null) continue;
    const peers = (bySgg.get(`${k.sido}/${k.sigungu}`) ?? []).filter((o) => o !== k);
    const sameDong = k.dong ? peers.filter((o) => o.dong === k.dong) : [];
    const sameGu = k.subGu ? peers.filter((o) => o.subGu === k.subGu && !sameDong.includes(o)) : [];
    k.nearby = [...sameDong, ...sameGu].slice(0, 5).map((o) => ({ id: o.id }));
  }
}

/**
 * 일반구가 있는 시에서 주소에 구 이름이 빠진 기기(개편 전 주소 등)는
 * 같은 동/읍/면의 다른 기기가 모두 같은 구일 때만 그 구로 채운다. 채운 수를 돌려준다.
 */
export function inferSubGu(list: Kiosk[]): number {
  let n = 0;
  for (const [, ks] of Map.groupBy(list, (k) => `${k.sido}/${k.sigungu}`)) {
    const known = new Map<string, Set<string>>();
    for (const k of ks) if (k.subGu && k.dong) (known.get(k.dong) ?? known.set(k.dong, new Set()).get(k.dong)!).add(k.subGu);
    for (const k of ks) {
      if (k.subGu || !k.dong) continue;
      const g = known.get(k.dong);
      if (g?.size === 1) { k.subGu = [...g][0]; n++; }
    }
  }
  return n;
}
