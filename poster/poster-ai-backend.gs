/**
 * Einstein Poster AI backend. Create a standalone Google Apps Script project,
 * paste this code, and set GEMINI_API_KEY in Script Properties.
 * Deploy as a Web App, execute as Me, access Anyone.
 * Never put the API key in a public GitHub repository or frontend JS.
 * Daily request cap protects casual overuse, not determined abuse.
 */
const POSTER_AI_MODEL = 'gemini-3.6-flash';
const POSTER_AI_MAX_DAILY = 80;
const POSTER_AI_FIELDS = [
  'title','abstract','background','question','hypothesis','variables','materials',
  'method','results','graphTitle','graphXLabel','graphXUnit','graphYLabel',
  'graphUnit','graphData','discussion','limitations','conclusion','followup','references'
];

function doGet() {
  return HtmlService.createHtmlOutput('포스터 AI 피드백 서버가 준비되어 있습니다.');
}
function doPost(e) {
  const nonce = String((e && e.parameter && e.parameter.nonce) || '').slice(0, 100);
  const reply = {kind:'einsteinPosterAIv1',nonce:nonce,ok:false};
  try {
    if (!e || !e.parameter || e.parameter.action !== 'reviewPosterAIv1') {
      throw Error('지원하지 않는 요청입니다.');
    }
    if (!/^[a-zA-Z0-9_-]{8,100}$/.test(nonce)) throw Error('요청 식별값이 유효하지 않습니다.');
    const input = String(e.parameter.fields || '');
    if (!input || input.length > 16000) throw Error('전송한 연구 내용의 길이가 너무 깁니다.');
    const data = JSON.parse(input);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('연구 내용 형식이 잘못되었습니다.');
    const fields = {};
    for (const key of POSTER_AI_FIELDS) {
      if (typeof data[key] === 'string' && data[key].trim()) {
        fields[key] = data[key].trim().slice(0, 2000);
      }
    }
    if (!Object.keys(fields).length) throw Error('분석할 연구 내용을 먼저 입력하세요.');
    const secret = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
    if (!secret) throw Error('교사용 AI API 키가 아직 설정되지 않았습니다.');
    checkPosterAiDailyLimit_();
    reply.feedback = analyzePosterWithGemini_(fields, secret);
    reply.ok = true;
  } catch (err) {
    reply.error = String(err && err.message || err).slice(0, 280);
  }
  return posterAiHtmlResponse_(reply);
}
function checkPosterAiDailyLimit_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const date = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
    const oldDate = props.getProperty('POSTER_AI_USAGE_DAY');
    const count = oldDate === date ? Number(props.getProperty('POSTER_AI_USAGE_COUNT') || 0) : 0;
    if (count >= POSTER_AI_MAX_DAILY) throw Error('오늘의 AI 검토 사용 횟수를 초과했습니다. 교사에게 문의하세요.');
    props.setProperties({POSTER_AI_USAGE_DAY:date,POSTER_AI_USAGE_COUNT:String(count + 1)});
  } finally {
    lock.releaseLock();
  }
}
function analyzePosterWithGemini_(fields, key) {
  const instruction = [
    '너는 한국 고등학교 과학 탐구활동의 엄격하고 공정한 연구포스터 피드백 교사다.',
    '입력되는 내용은 학생이 작성한 연구포스터 각 항목이다. 학생의 실제 실험 사실을 추측하거나 데이터를 만들어내지 마라.',
    '각 항목에서 실제로 수정·보완할 점만 짧은 한국어 문장으로 제시하라. 칭찬, 총평, 인사, 모호한 일반론, 완성 문장의 대필은 금지한다.',
    '선택 입력 항목은 비워도 된다. 입력되지 않은 항목을 새로 작성하라고 요구하지 마라. 입력 객체에 존재하는 항목의 실제 내용만 검토하라.',
    '필수 항목의 누락 검사도 여기서는 하지 않는다. 업로드 단계에서 별도 확인한다. 피드백은 적힌 내용의 수정·보완에만 집중한다.',
    '우선순위: (1) 과학 개념·인과관계 오류, (2) 결과 수치/단위/반복 횟수의 항목 간 불일치,',
    '연구 배경→가설→변인→방법→결과→논의→결론을 하나의 연구로 읽고 항목 간 모순을 구체적으로 비교하라.',
    '예: 연구 과정 1.05V와 결과 0.8V가 다르면 각 수치를 정확히 인용하여 측정 조건 또는 전사 오류 확인을 요청하라.',
    '과학적으로 틀린 주장이나 근거 부족, 설계와 가설의 불일치를 찾되 추정에 불과한 오류를 확정적으로 말하지 마라.',
    '(3) 가설과 실험 설계의 불일치, 대조군·변인 통제 부족, (4) 근거보다 강한 결론·일반화,',
    '(5) 그래프 축 단위 누락 및 자료 출처 부정확. 글을 잘 쓴 항목에는 아무것도 출력하지 마라.',
    '서로 다른 수치가 있어도 다른 조건에서 측정한 값일 수 있으므로 단정하지 말고 조건 확인을 요청하라.',
    '웹 검색 기능은 없다. 참고문헌 URL의 실제 내용은 검증할 수 없다. 링크 내용이나 출처가 맞다고 단정하지 마라.',
    '기존 데이터로 확인할 수 없는 것은 추가 측정을 제안하되, 이미 하지 않은 실험을 했다고 쓰도록 강요하지 마라.',
    '응답은 JSON 객체 {"feedback":{"fieldKey":["보완 의견1","보완 의견2"]}} 형식만 사용하라.',
    'fieldKey는 입력 객체의 키만 사용하고, 각 항목당 최대 2개, 의견당 120자 이내로 작성하라.',
    '지적할 사항이 없다면 {"feedback":{}} 를 반환하라.'
  ].join('\n');
  const body = {
    systemInstruction:{parts:[{text:instruction}]},
    contents:[{role:'user',parts:[{text:'학생의 포스터 내용(JSON):\n' + JSON.stringify(fields)}]}],
    generationConfig:{temperature:0.15,responseMimeType:'application/json',maxOutputTokens:2700}
  };
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    POSTER_AI_MODEL + ':generateContent';
  const response = UrlFetchApp.fetch(endpoint, {
    method:'post',
    contentType:'application/json',
    headers:{'x-goog-api-key':key},
    payload:JSON.stringify(body),
    muteHttpExceptions:true
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    if (status === 429) throw Error('AI 서비스의 요청 한도를 초과했습니다. 잠시 후 다시 시도하세요.');
    if (status === 401 || status === 403) throw Error('AI 서버의 API 키 또는 권한을 확인해 주세요.');
    throw Error('AI 서비스 호출에 실패했습니다 (상태 ' + status + ').');
  }
  const raw = JSON.parse(response.getContentText());
  const textParts = ((raw.candidates || [])[0]?.content?.parts || [])
    .map(part => part && part.text || '').filter(Boolean);
  if (!textParts.length) throw Error('AI가 피드백 내용을 반환하지 않았습니다.');
  const decoded = JSON.parse(textParts.join('').trim());
  const feedback = decoded && decoded.feedback;
  if (!feedback || typeof feedback !== 'object' || Array.isArray(feedback)) {
    throw Error('AI 응답의 피드백 형식을 확인할 수 없습니다.');
  }
  const filtered = {};
  for (const field of POSTER_AI_FIELDS) {
    const rawItems = feedback[field];
    const list = (Array.isArray(rawItems) ? rawItems : typeof rawItems === 'string' ? [rawItems] : [])
      .filter(item => typeof item === 'string' && item.trim())
      .slice(0, 2).map(item => item.trim().slice(0, 180));
    if (list.length) filtered[field] = list;
  }
  return filtered;
}
function posterAiHtmlResponse_(payload) {
  const serial = JSON.stringify(payload).replace(/</g,'\\u003c')
    .replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const html = '<!doctype html><html><head><meta charset="utf-8"></head><body>' +
    '<script>window.top.postMessage(' + serial + ', "*");</script></body></html>';
  return HtmlService.createHtmlOutput(html).setTitle('포스터 AI 피드백');
}