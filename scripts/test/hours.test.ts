import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normTime, parseText, parseColumns, isOpenAt, kstNow } from '../lib/hours.ts';

// NOTE: the strings below are plausible formats written by hand, NOT rows from the real dataset.
// Replace/extend with real 운영시간 values once the CSV is available.

test('normTime formats', () => {
  assert.equal(normTime('7'), '07:00');
  assert.equal(normTime('0700'), '07:00');
  assert.equal(normTime('7:5'), '07:05');
  assert.equal(normTime('7시30분'), '07:30');
  assert.equal(normTime('오후 10시'), '22:00');
  assert.equal(normTime('24:00'), '24:00');
  assert.equal(normTime('25:00'), null);
});

const cases: [string, object, string][] = [
  ['평일 07:00~22:00, 토·일·공휴일 09:00~18:00',
    { weekday: ['07:00', '22:00'], sat: ['09:00', '18:00'], sun: ['09:00', '18:00'], holiday: ['09:00', '18:00'] }, 'ok'],
  ['24시간', { weekday: ['00:00', '24:00'], sat: ['00:00', '24:00'], sun: ['00:00', '24:00'], holiday: ['00:00', '24:00'] }, 'ok'],
  ['연중무휴 06:00~23:00', { weekday: ['06:00', '23:00'], sat: ['06:00', '23:00'], sun: ['06:00', '23:00'], holiday: ['06:00', '23:00'] }, 'ok'],
  ['평일 09:00-18:00 (주말 및 공휴일 휴무)', { weekday: ['09:00', '18:00'], sat: null, sun: null, holiday: null }, 'ok'],
  ['월~금 07:00~22:00 / 토요일 09:00~13:00 / 일요일 휴무',
    { weekday: ['07:00', '22:00'], sat: ['09:00', '13:00'], sun: null, holiday: null }, 'ok'],
  ['평일 09:00~18:00', { weekday: ['09:00', '18:00'], sat: null, sun: null, holiday: null }, 'partial'],
  ['07:00~22:00', { weekday: ['07:00', '22:00'] }, 'partial'],
  ['청사 운영시간과 동일', { weekday: ['09:00', '18:00'], sat: null, sun: null, holiday: null }, 'partial'],
  ['평일 7시~22시, 주말 9시~18시', { weekday: ['07:00', '22:00'], sat: ['09:00', '18:00'], sun: ['09:00', '18:00'], holiday: ['09:00', '18:00'] }, 'ok'],
  ['', {}, 'unknown'],
  ['문의', {}, 'unknown'],
];

for (const [input, hours, conf] of cases) {
  test(`parseText: ${input || '(empty)'}`, () => {
    const r = parseText(input);
    assert.deepEqual(r.hours, hours);
    assert.equal(r.confidence, conf);
  });
}

test('24h flag', () => {
  assert.equal(parseText('24시간').is24h, true);
  assert.equal(parseText('평일 24시간, 주말 휴무').is24h, false);
});

test('parseColumns: 00:00~00:00 means closed, 00:00~23:59 means 24h', () => {
  const r = parseColumns({ weekdayOpen: '07:00', weekdayClose: '22:00', satOpen: '00:00', satClose: '00:00', holidayOpen: '00:00', holidayClose: '23:59' });
  assert.deepEqual(r.hours, { weekday: ['07:00', '22:00'], sat: null, holiday: ['00:00', '24:00'], sun: ['00:00', '24:00'] });
  assert.equal(r.confidence, 'ok');
});

test('kstNow is independent of host time zone', () => {
  // 2026-11-25T14:30:00Z = 2026-11-25 23:30 KST (Wednesday)
  const n = kstNow(new Date('2026-11-25T14:30:00Z'));
  assert.deepEqual(n, { ymd: '2026-11-25', dow: 3, minutes: 23 * 60 + 30 });
});

test('isOpenAt: weekday, weekend, holiday, overnight, unknown', () => {
  const h = parseText('평일 07:00~22:00, 토·일·공휴일 09:00~18:00').hours;
  const none = new Set<string>();
  assert.equal(isOpenAt(h, { ymd: '2026-11-25', dow: 3, minutes: 8 * 60 }, none), true);
  assert.equal(isOpenAt(h, { ymd: '2026-11-25', dow: 3, minutes: 22 * 60 }, none), false);
  assert.equal(isOpenAt(h, { ymd: '2026-11-28', dow: 6, minutes: 8 * 60 }, none), false);
  // 2026-12-25 (Fri) is a holiday -> holiday hours
  assert.equal(isOpenAt(h, { ymd: '2026-12-25', dow: 5, minutes: 8 * 60 }, new Set(['2026-12-25'])), false);
  const night = { weekday: ['20:00', '02:00'] as [string, string], sat: null, sun: null, holiday: null };
  assert.equal(isOpenAt(night, { ymd: '2026-11-26', dow: 4, minutes: 60 }, none), true); // Thu 01:00, spill from Wed
  assert.equal(isOpenAt(night, { ymd: '2026-11-28', dow: 6, minutes: 60 }, none), true); // Sat 01:00, spill from Fri
  assert.equal(isOpenAt(night, { ymd: '2026-11-29', dow: 0, minutes: 60 }, none), false);
  assert.equal(isOpenAt({ weekday: ['07:00', '22:00'] }, { ymd: '2026-11-28', dow: 6, minutes: 600 }, none), null);
});
