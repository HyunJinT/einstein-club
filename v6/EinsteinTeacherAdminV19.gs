/**
 * Einstein teacher administration V19 - install as an ADDITIONAL .gs file.
 * Do not rerun setupEinstein() or delete existing scripts.
 * All mutations require assertTeacher_() against the existing teacher session.
 */
const EIN_V19_ACT_KEY_ = 'EIN_V19_CLOSED_ACTIVITY';
const EIN_V19_POS_KEY_ = 'EIN_V19_CLOSED_POSTER';

function einsV19FlagKey_(kind) {
  if (kind === 'activity') return EIN_V19_ACT_KEY_;
  if (kind === 'poster') return EIN_V19_POS_KEY_;
  throw Error('제출 종류 오류');
}
function einsV19IsManualClosed_(kind) {
  return props_().getProperty(einsV19FlagKey_(kind)) === 'true';
}
function einsV19AssertOpen_(kind) {
  if (Date.now() >= EINSTEIN_DEADLINE_V10_) {
    throw Error('기존 최종기한(12월 6일 23:59)이 지났습니다.');
  }
  if (einsV19IsManualClosed_(kind)) {
    throw Error((kind === 'poster' ? '공동 포스터' : '활동 기록·보고서') + ' 제출이 교사에 의해 마감되었습니다.');
  }
}
function getEinsteinTeacherCloseStateV19(adminKey) {
  assertTeacher_(adminKey);
  return {
    activity: einsV19IsManualClosed_('activity'),
    poster: einsV19IsManualClosed_('poster'),
    deadlinePassed: Date.now() >= EINSTEIN_DEADLINE_V10_
  };
}
function setEinsteinTeacherCloseStateV19(adminKey, kind, closed) {
  assertTeacher_(adminKey);
  var key = einsV19FlagKey_(kind);
  if (typeof closed !== 'boolean') throw Error('마감 값 오류');
  if (Date.now() >= EINSTEIN_DEADLINE_V10_) throw Error('최종기한 이후에는 마감 해제가 적용되지 않습니다.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { props_().setProperty(key, String(closed)); }
  finally { lock.releaseLock(); }
  return getEinsteinTeacherCloseStateV19(adminKey);
}
function einsV19IdFromUrl_(url) {
  var match = String(url || '').match(/\/(?:file\/d|folders)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : '';
}
function einsV19ReadFiles_(row) {
  try {
    var files = JSON.parse(String(row[9] || '[]'));
    return Array.isArray(files) ? files : [];
  } catch (err) { throw Error('파일 목록 JSON 오류'); }
}
function einsV19ParentsContain_(file, folderIds) {
  var parents = file.getParents();
  while (parents.hasNext()) {
    if (folderIds.has(parents.next().getId())) return true;
  }
  return false;
}

/** Delete exactly one attachment from one student's current and historic file lists. */
function deleteEinsteinTeacherAttachmentV19(adminKey, studentId, fileUrl) {
  assertTeacher_(adminKey);
  var id = String(studentId || '').trim();
  var url = String(fileUrl || '');
  if (!/^\d{5}$/.test(id) || !/^https:\/\/drive\.google\.com\//.test(url)) throw Error('학번·파일 주소 형식 오류');
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    var sheet = sheet_('제출현황');
    var rows = sheet.getDataRange().getValues();
    var current = null;
    for (var i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][1]) === id && String(rows[i][3]) === '완료') {
        current = rows[i]; break;
      }
    }
    if (!current) throw Error('최신 완료 제출 기록이 없습니다.');
    var target = einsV19ReadFiles_(current).find(function(f) { return String(f.url) === url; });
    if (!target) throw Error('최신 첨부목록에 없는 파일입니다.');
    if (target.sharedPosterId || target.source === 'sharedPosterV18') {
      throw Error('공동 포스터는 아래 모둠 포스터 목록에서 삭제하세요.');
    }
    var driveId = String(target.fileId || einsV19IdFromUrl_(url));
    if (!/^[A-Za-z0-9_-]{15,}$/.test(driveId)) throw Error('Drive 파일 식별자 오류');
    for (var j = 1; j < rows.length; j++) {
      if (String(rows[j][1]) !== id && einsV19ReadFiles_(rows[j]).some(function(f) {
        return String(f.fileId || einsV19IdFromUrl_(f.url)) === driveId;
      })) throw Error('다른 학생에게도 연결된 파일입니다. 공동 포스터 목록에서 관리하세요.');
    }
    var ownedFolders = new Set(rows.slice(1).filter(function(r) {
      return String(r[1]) === id;
    }).map(function(r) { return String(r[6] || ''); }));
    var file = DriveApp.getFileById(driveId);
    if (!einsV19ParentsContain_(file, ownedFolders)) throw Error('해당 학생의 제출 폴더에 저장된 파일이 아닙니다.');
    var changes = [];
    for (var k = 1; k < rows.length; k++) {
      if (String(rows[k][1]) !== id) continue;
      var existing = einsV19ReadFiles_(rows[k]);
      var filtered = existing.filter(function(f) {
        return String(f.fileId || einsV19IdFromUrl_(f.url)) !== driveId;
      });
      if (filtered.length !== existing.length) changes.push({row:k+1,value:JSON.stringify(filtered)});
    }
    file.setTrashed(true);
    try { changes.forEach(function(c) { sheet.getRange(c.row, 10).setValue(c.value); }); }
    catch(err) { try { file.setTrashed(false); } catch (_) {} throw err; }
    return {ok:true, removedReferences:changes.length};
  } finally { lock.releaseLock(); }
}

/** Delete one shared poster and unlink it from all students' record histories. */
function deleteEinsteinTeacherPosterV19(adminKey, posterId) {
  assertTeacher_(adminKey);
  var id = String(posterId || '').trim();
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(id)) throw Error('포스터 ID 오류');
  var lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    var posters = sheet_('공동연구포스터');
    if (!posters) throw Error('공동 포스터 시트가 없습니다.');
    var data = posters.getDataRange().getValues();
    var found = -1;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][0]) === id) { found = i; break; }
    }
    if (found < 0) throw Error('이미 삭제되었거나 찾을 수 없는 포스터입니다.');
    var driveId = String(data[found][2] || '');
    var file = DriveApp.getFileById(driveId);
    // The old helper einsPosterFolderV15_ may not exist in the live project.
    // Verify the existing Drive file's actual parent folder instead of creating
    // a new folder or assuming an uninstalled V15 function.
    var parentFolders = file.getParents(), verifiedPosterFolder = false;
    while (parentFolders.hasNext()) {
      if (parentFolders.next().getName() === '아인슈타인_공동연구포스터_비공개') {
        verifiedPosterFolder = true;
        break;
      }
    }
    if (!verifiedPosterFolder) throw Error('공동 포스터 전용 보관 폴더의 파일이 아닙니다.');
    var sheet = sheet_('제출현황'), rows = sheet.getDataRange().getValues(), changes = [];
    for (var j = 1; j < rows.length; j++) {
      var files = einsV19ReadFiles_(rows[j]);
      var filtered = files.filter(function(f) {
        return String(f.sharedPosterId || '') !== id &&
          String(f.fileId || einsV19IdFromUrl_(f.url)) !== driveId;
      });
      if (filtered.length !== files.length) changes.push({row:j+1,value:JSON.stringify(filtered)});
    }
    file.setTrashed(true);
    try {
      changes.forEach(function(c) { sheet.getRange(c.row, 10).setValue(c.value); });
      posters.deleteRow(found + 1);
    } catch(err) { try { file.setTrashed(false); } catch (_) {} throw err; }
    return {ok:true, unlinkedSubmissions:changes.length};
  } finally { lock.releaseLock(); }
}
function checkEinsteinTeacherAdminV19() {
  props_();
  return {ok:true,version:19,activityClosed:einsV19IsManualClosed_('activity'),
    posterClosed:einsV19IsManualClosed_('poster')};
}