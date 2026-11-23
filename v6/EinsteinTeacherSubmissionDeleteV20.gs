/**
 * Einstein V20 – 교사용 학생별 제출내역 개별 제외/복구
 *
 * 설치: 기존 Apps Script 프로젝트에 추가 .gs 파일로 등록
 * 기존 Code.gs / PosterBridgeV17.gs / 기타 파일은 교체하지 않음
 * setupEinstein() 재실행 금지
 *
 * 안전: 학생의 완료된 접수 상태만 '교사삭제'로 바꿉니다.
 * Google Drive 원본, 자동저장, 계정, 비밀번호, 다른 학생은 삭제하지 않습니다.
 * 해당 학생을 기존 교사용 목록/Excel에서 제외하며 다시 복구할 수 있습니다.
 */

function deleteEinsteinTeacherStudentRecordsV20(adminKey, studentId) {
  assertTeacher_(adminKey);
  var id = String(studentId || '').trim();
  if (!/^\d{5}$/.test(id)) throw Error('학생 학번 5자리를 확인하세요.');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = sheet_('제출현황');
    var values = sheet.getDataRange().getValues();
    var positions = [];
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][1]) === id && String(values[i][3]) === '완료') {
        positions.push(i + 1);
      }
    }
    if (!positions.length) throw Error('삭제할 완료 제출 기록이 없습니다.');
    var changed = [];
    try {
      positions.forEach(function(row) {
        sheet.getRange(row, 4).setValue('교사삭제');
        changed.push(row);
      });
      SpreadsheetApp.flush();
    } catch (err) {
      changed.forEach(function(row) {
        try { sheet.getRange(row, 4).setValue('완료'); } catch (_) {}
      });
      throw err;
    }
    return {ok: true, studentId: id, removed: changed.length,
      message: '교사용 제출 현황에서 제외했습니다. 원본 파일은 보관되며 복구할 수 있습니다.'};
  } finally {
    lock.releaseLock();
  }
}

function restoreEinsteinTeacherStudentRecordsV20(adminKey, studentId) {
  assertTeacher_(adminKey);
  var id = String(studentId || '').trim();
  if (!/^\d{5}$/.test(id)) throw Error('학생 학번 5자리를 확인하세요.');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = sheet_('제출현황');
    var values = sheet.getDataRange().getValues();
    var positions = [];
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][1]) === id && String(values[i][3]) === '교사삭제') {
        positions.push(i + 1);
      }
    }
    if (!positions.length) throw Error('복구할 교사 삭제 기록이 없습니다.');
    positions.forEach(function(row) { sheet.getRange(row, 4).setValue('완료'); });
    SpreadsheetApp.flush();
    return {ok: true, studentId: id, restored: positions.length};
  } finally {
    lock.releaseLock();
  }
}