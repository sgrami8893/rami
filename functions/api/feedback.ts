// 의견 보내기 받는 곳(Cloudflare Pages Function, POST /api/feedback). 2026-11-27.
// 1) 입력 검사 → 2) Turnstile 토큰 확인(봇 차단) → 3) 운영자 구글 시트(Apps Script 웹 앱)로 전달.
// 저장소가 없는 정적 사이트라 이 함수는 아무것도 저장하지 않고, IP·기기 정보도 넘기지 않는다(개인정보 최소 수집).
// 환경변수(Cloudflare Pages > 설정 > 변수 및 비밀, 암호화): TURNSTILE_SECRET_KEY, FEEDBACK_WEBHOOK_URL, FEEDBACK_SECRET

interface Env { TURNSTILE_VERIFY_URL?: string; TURNSTILE_SECRET_KEY?: string; FEEDBACK_WEBHOOK_URL?: string; FEEDBACK_SECRET?: string }
type Ctx = { request: Request; env: Env };

const KINDS = new Set(['wrong', 'hard', 'wish', 'etc']);
const MAX_LEN = 2000; // src/config.ts FEEDBACK.maxLen 과 같게
const EMAIL_RE = /^[^\s@<>()",;:]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}$/;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/** 제어 문자 제거·공백 정리·길이 자르기 */
const clean = (v: unknown, max: number) =>
  String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g, '').replace(/\r\n?/g, '\n').trim().slice(0, max);

/** 우리 사이트 안 경로만(다른 주소·스크립트 주소를 시트에 남기지 않음) */
const pagePath = (v: unknown) => {
  const s = clean(v, 300);
  return /^\/[\w\-./%~가-힣]*$/.test(s) ? s : '';
};

export const onRequestPost = async ({ request, env }: Ctx): Promise<Response> => {
  if (!env.TURNSTILE_SECRET_KEY || !env.FEEDBACK_WEBHOOK_URL || !env.FEEDBACK_SECRET) return json(503, { ok: false, error: 'not_configured' });

  // 같은 사이트에서 보낸 것만(다른 사이트가 이 주소로 대신 보내는 것 차단)
  const origin = request.headers.get('origin');
  if (origin && new URL(origin).host !== new URL(request.url).host) return json(403, { ok: false, error: 'origin' });

  let data: Record<string, unknown>;
  try {
    const ct = request.headers.get('content-type') ?? '';
    if (ct.includes('application/json')) data = await request.json();
    else data = Object.fromEntries((await request.formData()).entries());
  } catch { return json(400, { ok: false, error: 'bad_request' }); }

  // 사람 눈에 안 보이는 칸에 무언가 들어 있으면 봇: 성공처럼 답하고 버린다
  if (clean(data.website, 50)) return json(200, { ok: true });

  const kind = KINDS.has(String(data.kind)) ? String(data.kind) : 'etc';
  const message = clean(data.message, MAX_LEN);
  const email = clean(data.email, 254);
  const agreed = data.agree === true || data.agree === 'on' || data.agree === '1';
  if (message.length < 2) return json(400, { ok: false, error: 'message' });
  if (email && !EMAIL_RE.test(email)) return json(400, { ok: false, error: 'email' });
  if (email && !agreed) return json(400, { ok: false, error: 'agree' });

  const token = clean(data['cf-turnstile-response'], 2048);
  if (!token) return json(400, { ok: false, error: 'captcha' });
  const vr = await fetch(env.TURNSTILE_VERIFY_URL || 'https://challenges.cloudflare.com/turnstile/v0/siteverify', { // 바꾸는 값은 로컬 시험용(배포 환경에는 넣지 않음)
    method: 'POST',
    body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token }), // remoteip는 보내지 않는다(최소 처리)
  }).then((r) => r.json() as Promise<{ success?: boolean; hostname?: string }>).catch(() => ({ success: false }));
  if (!vr.success) return json(400, { ok: false, error: 'captcha' });

  const row = {
    secret: env.FEEDBACK_SECRET,
    kind,
    message,
    email,
    page: pagePath(data.page),
    title: clean(data.title, 120),
  };
  try {
    const r = await fetch(env.FEEDBACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(row),
      redirect: 'follow', // Apps Script 웹 앱은 결과를 다른 주소로 넘겨 준다
    });
    const out = (await r.json().catch(() => ({}))) as { ok?: boolean };
    if (!r.ok || !out.ok) return json(502, { ok: false, error: 'deliver' });
  } catch { return json(502, { ok: false, error: 'deliver' }); }
  return json(200, { ok: true });
};

export const onRequest = async ({ request }: Ctx): Promise<Response> =>
  request.method === 'POST' ? json(500, { ok: false }) : new Response(null, { status: 405, headers: { allow: 'POST' } });
