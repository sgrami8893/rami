// 보안 회귀 테스트: JSON-LD 이스케이프, 외부 링크 URL 인코딩
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeJsonLd } from '../../src/lib/jsonld.ts';

test('JSON-LD cannot break out of its script tag', () => {
  const evil = { name: '</script><script>alert(1)</script><!--', note: 'a&b\u2028' };
  const s = safeJsonLd(evil);
  assert.ok(!/[<>&\u2028]/.test(s));
  assert.deepEqual(JSON.parse(s), evil); // 의미는 그대로
});
