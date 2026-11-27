/**
 * 동네콕콕 의견함 — 구글 시트에 붙이는 Apps Script (2026-11-27)
 *
 * 하는 일
 *  - 사이트(/api/feedback)가 보낸 의견을 이 시트의 '의견' 탭에 한 줄씩 넣고, 시트 주인 메일로 알림을 보내요.
 *  - 받은 지 365일이 지난 줄은 매일 새벽 자동으로 지워요(개인정보처리방침의 보관 기간과 같음).
 *
 * 처음 한 번
 *  1) 이 코드를 붙여 넣고 저장 → 위쪽 함수 목록에서 setup 을 골라 ▶실행 → 권한 허용
 *  2) 실행 로그에 나온 FEEDBACK_SECRET 값을 Cloudflare 환경변수에 넣어요
 *  3) 배포 → 새 배포 → 유형 '웹 앱' · 실행: 나 · 액세스 권한: 모든 사용자 → 웹 앱 URL을 FEEDBACK_WEBHOOK_URL 로
 */
var SHEET_NAME = '의견';
var KEEP_DAYS = 365;
var KIND_LABEL = { wrong: '정보가 틀려요', hard: '쓰기 불편해요', wish: '이런 게 있으면 좋겠어요', etc: '기타' };
var SITE = 'https://dongnekokkok.pages.dev';

function setup() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty('FEEDBACK_SECRET');
  if (!secret) {
    secret = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    props.setProperty('FEEDBACK_SECRET', secret);
  }
  sheet_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'cleanup') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('cleanup').timeBased().everyDays(1).atHour(4).create();
  MailApp.getRemainingDailyQuota(); // 메일 권한을 미리 받아 둔다
  Logger.log('FEEDBACK_SECRET = ' + secret);
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['받은 시각', '종류', '의견', '답장 이메일', '보낸 페이지', '페이지 제목', '처리']);
    sh.setFrozenRows(1);
    sh.setColumnWidth(3, 420);
  }
  return sh;
}

/** 시트에서 수식으로 읽히지 않게(=, +, -, @ 로 시작하는 글) */
function safe_(v) {
  v = String(v || '');
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function doPost(e) {
  var out = function (o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); };
  try {
    var d = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('FEEDBACK_SECRET');
    if (!secret || d.secret !== secret) return out({ ok: false });
    var kind = KIND_LABEL[d.kind] || '기타';
    var msg = String(d.message || '').slice(0, 2000);
    var email = String(d.email || '').slice(0, 254);
    var page = String(d.page || '').slice(0, 300);
    var title = String(d.title || '').slice(0, 120);
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try { sheet_().appendRow([new Date(), kind, safe_(msg), safe_(email), safe_(page), safe_(title), '']); }
    finally { lock.releaseLock(); }

    var me = Session.getEffectiveUser().getEmail();
    if (me && MailApp.getRemainingDailyQuota() > 0) {
      var body = '종류: ' + kind + '\n페이지: ' + title + '\n' + (page ? SITE + page : '') + '\n\n' + msg +
        (email ? '\n\n답장 받을 이메일: ' + email : '\n\n(답장 이메일 없음)') +
        '\n\n시트에서 보기: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl();
      MailApp.sendEmail({ to: me, subject: '[동네콕콕 의견] ' + kind + ' · ' + (title || page).slice(0, 40), body: body, replyTo: email || me, name: '동네콕콕 의견함' });
    }
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false });
  }
}

/** 보관 기간이 지난 줄 지우기(매일 새벽 4시 자동 실행) */
function cleanup() {
  var sh = sheet_();
  var last = sh.getLastRow();
  if (last < 2) return;
  var limit = new Date(Date.now() - KEEP_DAYS * 24 * 3600 * 1000);
  var dates = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = dates.length - 1; i >= 0; i--) {
    var t = dates[i][0];
    if (t instanceof Date && t < limit) sh.deleteRow(i + 2);
  }
}
