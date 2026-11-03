/**
 * 2026 은행고 R&E 제출 파일 저장 API
 * Google Apps Script 웹 앱으로 배포:
 * 실행 사용자: 나 / 액세스 권한: 모든 사용자(Anyone)
 *
 * Firebase ID 토큰과 현재 PIN 세션을 Realtime Database 보안 규칙으로 검증한 후
 * 소유자의 비공개 Google Drive 폴더에 파일을 저장합니다.
 * 학생에게 Drive 파일의 공유 권한을 부여하지 않습니다.
 */
const SETTINGS = Object.freeze({
  databaseUrl: 'https://eunhaeng-default-rtdb.asia-southeast1.firebasedatabase.app',
  root: 'rneSubmission2026',
  maxBytes: 15 * 1024 * 1024,
  rootFolderName: '2026_은행고_RNE_최종결과물'
});

function doGet() {
  return ContentService.createTextOutput('2026 R&E Google Drive 제출 API · 설정 완료 후 학생용 웹앱에서 이용하세요.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    if (!e || !e.postData || typeof e.postData.contents !== 'string') {
      throw new Error('요청 본문이 없습니다.');
    }
    if (e.postData.contents.length > 23000000) {
      throw new Error('전송 크기가 너무 큽니다. 파일을 15MB 이하로 줄여 주세요.');
    }
    const body = JSON.parse(e.postData.contents);
    const result = processSubmission_(body);
    return jsonResult_({ok: true, requestId: result.requestId});
  } catch (err) {
    console.error('R&E upload failure:', String(err && err.message || err));
    // 호출 웹페이지는 no-cors 요청이므로 응답을 직접 읽지 않습니다.
    // 정상 완료 여부는 Firebase에 기록된 requestId로 다시 확인합니다.
    return jsonResult_({ok: false, error: String(err && err.message || err).slice(0, 240)});
  }
}

function processSubmission_(data) {
  if (!data || typeof data !== 'object') throw new Error('요청 형식 오류');
  const id = String(data.studentId || '');
  const name = String(data.studentName || '').trim();
  const type = String(data.type || '');
  const token = String(data.idToken || '');
  const requestId = String(data.requestId || '');
  if (!/^[0-9]{5}$/.test(id) || !name || name.length > 40) throw new Error('학생 정보 오류');
  if (!/^(report|presentation)$/.test(type)) throw new Error('제출 종류 오류');
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(requestId)) throw new Error('요청 식별자 오류');
  if (!token || token.length > 5000) throw new Error('Firebase 로그인 정보 오류');

  // Firebase가 토큰의 서명을 검증하고 현재 학생의 PIN 세션과 일치하는지
  // Realtime Database Rules로 검증합니다. 본인 세션 외에는 조회가 거부됩니다.
  const sessionUid = String(data.authUid || '');
  if (!/^[a-zA-Z0-9_-]{12,130}$/.test(sessionUid)) throw new Error('Firebase UID 오류');
  const session = firebaseRead_('sessions/' + id + '/' + sessionUid, token);
  if (!session || session.name !== name) throw new Error('PIN 인증 세션이 만료되었습니다. 다시 로그인하세요.');
  if (firebaseRead_('settings/closed', null) === true) throw new Error('교사가 제출을 마감했습니다.');

  const recordsType = type === 'report' ? 'reports' : 'presentations';
  const old = firebaseRead_(recordsType + '/' + id, token);
  if (old && old.requestId === requestId && old.file && old.file.driveId) {
    return {requestId: requestId};
  }

  const newData = {
    studentId: id,
    studentName: name,
    createdAt: old && old.createdAt || formatKst_(),
    updatedAt: formatKst_(),
    requestId: requestId
  };
  if (type === 'report') {
    const career = String(data.career || '').trim();
    if (!career || career.length > 150) throw new Error('희망 진로를 입력하세요.');
    newData.career = career;
  } else {
    const teamTitle = String(data.teamTitle || '').trim();
    if (!teamTitle || teamTitle.length > 150) throw new Error('연구주제 또는 모둠명을 입력하세요.');
    newData.teamTitle = teamTitle;
    const members = data.members;
    if (!Array.isArray(members) || members.length < 1 || members.length > 35) throw new Error('모둠원 명단을 확인하세요.');
    const ids = {};
    newData.members = members.map(function(person) {
      const memberId = String(person.id || '').trim();
      const memberName = String(person.name || '').trim();
      if (!/^[0-9]{5}$/.test(memberId) || !memberName || memberName.length > 40 || ids[memberId]) {
        throw new Error('모둠원 학번·이름 중복 또는 형식 오류');
      }
      ids[memberId] = true;
      return {id: memberId, name: memberName};
    });
    if (newData.members[0].id !== id || newData.members[0].name !== name) {
      throw new Error('첫 번째 모둠원은 대표학생이어야 합니다.');
    }
  }

  const fileName = String(data.fileName || '').replace(/[\\\/\r\n\t]/g, '_').trim().slice(0, 180);
  const fileBase64 = String(data.fileBase64 || '');
  const extensions = type === 'report' ? ['pdf','hwpx','hwp','docx'] : ['pptx','ppt','pdf'];
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (!extensions.includes(ext)) throw new Error('허용되지 않은 파일 형식입니다.');
  if (!fileBase64 || fileBase64.length > Math.ceil(SETTINGS.maxBytes * 4 / 3) + 16 || !/^[A-Za-z0-9+/]*={0,2}$/.test(fileBase64)) {
    throw new Error('파일 크기 또는 인코딩 오류');
  }
  const bytes = Utilities.base64Decode(fileBase64);
  if (!bytes.length || bytes.length > SETTINGS.maxBytes) throw new Error('파일은 15MB 이하여야 합니다.');
  const contentTypes = {
    pdf:'application/pdf',
    hwp:'application/x-hwp',
    hwpx:'application/zip',
    docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt:'application/vnd.ms-powerpoint',
    pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  };
  const folder = getSubmissionFolder_(type);
  const serverFilename = 'RNE_' + type + '_' + id + '_' + requestId + '_' + fileName;
  const blob = Utilities.newBlob(bytes, contentTypes[ext], serverFilename);
  const driveFile = folder.createFile(blob);
  // 드라이브 파일은 공유하지 않습니다. 소유자만 볼 수 있습니다.
  newData.file = {
    driveId: driveFile.getId(),
    path: 'drive://' + driveFile.getId(),
    name: fileName,
    size: bytes.length,
    url: 'https://drive.google.com/file/d/' + driveFile.getId() + '/view'
  };

  // 비공개 파일을 저장한 뒤 학생 권한으로 Firebase 기록을 갱신합니다.
  // 마감·PIN 권한이 서버 Rules에서 다시 확인됩니다.
  try {
    firebaseWrite_(recordsType + '/' + id, token, newData);
  } catch (err) {
    driveFile.setTrashed(true);
    throw err;
  }

  // 학생이 기존 파일을 바꾼 경우에만, 같은 모둠/학생의 이전 업로드를 정리합니다.
  if (old && old.file && old.file.driveId && old.file.driveId !== driveFile.getId()) {
    try {
      const previous = DriveApp.getFileById(old.file.driveId);
      const parents = previous.getParents();
      let inFolder = false;
      while (parents.hasNext()) {
        if (parents.next().getId() === folder.getId()) inFolder = true;
      }
      if (inFolder && previous.getName().startsWith('RNE_' + type + '_' + id + '_')) {
        previous.setTrashed(true);
      }
    } catch (ignored) {
      console.warn('이전 파일 정리에 실패했습니다. 새 제출물은 정상 저장되었습니다.');
    }
  }
  return {requestId: requestId};
}

function firebaseRead_(path, token) {
  return firebaseRequest_('get', path, token, undefined);
}

function firebaseWrite_(path, token, data) {
  return firebaseRequest_('put', path, token, data);
}

function firebaseRequest_(method, path, token, data) {
  const base = SETTINGS.databaseUrl + '/' + SETTINGS.root + '/' + path + '.json';
  const url = base + (token ? '?auth=' + encodeURIComponent(token) : '');
  const args = {method: method, muteHttpExceptions: true, followRedirects: true};
  if (data !== undefined) {
    args.contentType = 'application/json';
    args.payload = JSON.stringify(data);
  }
  const response = UrlFetchApp.fetch(url, args);
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('Firebase에서 '+ path +' 요청을 거부했습니다 ('+ status +'). 인증·마감·Rules를 확인하세요.');
  }
  const output = response.getContentText();
  return output && output !== 'null' ? JSON.parse(output) : null;
}

function getSubmissionFolder_(type) {
  const store = PropertiesService.getScriptProperties();
  const rootId = getOrMakeFolder_('RNE_ROOT_FOLDER_ID', function() {
    return DriveApp.createFolder(SETTINGS.rootFolderName);
  }).getId();
  const key = type === 'report' ? 'RNE_REPORT_FOLDER_ID' : 'RNE_PRESENTATION_FOLDER_ID';
  return getOrMakeFolder_(key, function() {
    return DriveApp.getFolderById(rootId).createFolder(type === 'report' ? '01_개별최종보고서' : '02_모둠발표자료');
  });
}

function getOrMakeFolder_(key, factory) {
  const props = PropertiesService.getScriptProperties();
  const saved = props.getProperty(key);
  if (saved) {
    try {return DriveApp.getFolderById(saved);} catch (ignored) {}
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const secondCheck = props.getProperty(key);
    if (secondCheck) {
      try {return DriveApp.getFolderById(secondCheck);} catch (ignored) {}
    }
    const folder = factory();
    props.setProperty(key, folder.getId());
    return folder;
  } finally {
    lock.releaseLock();
  }
}

function formatKst_() {
  return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd HH:mm:ss');
}

function jsonResult_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
