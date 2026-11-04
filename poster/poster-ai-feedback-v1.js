/* Poster AI feedback: annotation-only; never alters students' writing. */
(function () {
  'use strict';
  const button = document.getElementById('posterAiFeedback');
  const status = document.getElementById('posterAiFeedbackStatus');
  if (!button || !status) return;

  const labels = {
    title:'연구제목', abstract:'초록·연구 개요', background:'연구 배경 및 필요성',
    question:'연구질문', hypothesis:'가설 및 근거', variables:'변인 설정과 통제',
    materials:'실험 재료·기기', method:'실험 절차', results:'연구 결과 요약',
    graphTitle:'그래프 제목', graphXLabel:'X축 이름', graphXUnit:'X축 단위',
    graphYLabel:'Y축 이름', graphUnit:'Y축 단위', graphData:'그래프 측정값',
    discussion:'결과 분석·논의', limitations:'연구의 한계·개선',
    conclusion:'핵심 결론', followup:'후속 탐구', references:'참고문헌',
    contributions:'연구자별 실제 역할'
  };
  // Do not send identifying researcher lists, student IDs, group names, or photos to AI.
  const aiKeys = Object.keys(labels).filter(k => k !== 'contributions');
  const allKeys = Object.keys(labels);
  const boxes = {};
  const endpoint = String(window.EINSTEIN_POSTER_AI_ENDPOINT || '').trim();
  let pending = false;

  function collect() {
    const out = {};
    for (const k of allKeys) {
      out[k] = document.querySelector('[data-key="' + k + '"]')?.value?.trim() || '';
    }
    return out;
  }
  function forAI(fields) {
    const out = {};
    for (const k of aiKeys) if (fields[k]) {
      out[k] = fields[k].slice(0, 2000)
        .replace(/\b\d{5}\b/g, '[학번]')
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[이메일]')
        .replace(/010[- .]?\d{4}[- .]?\d{4}/g, '[전화번호]');
    }
    return out;
  }
  function clearFeedback() {
    for (const el of Object.values(boxes)) {
      el.textContent = '';
      el.hidden = true;
    }
    status.hidden = true;
    status.textContent = '';
  }
  function createFeedbackBoxes() {
    for (const key of allKeys) {
      const input = document.querySelector('[data-key="' + key + '"]');
      if (!input) continue;
      const note = document.createElement('div');
      note.className = 'poster-ai-field-feedback';
      note.hidden = true;
      note.setAttribute('role', 'note');
      note.dataset.aiFeedbackFor = key;
      const counter = input.nextElementSibling?.classList?.contains('poster-character-status') ? input.nextElementSibling : null;
      (counter || input).insertAdjacentElement('afterend', note);
      boxes[key] = note;
    }
    document.getElementById('editor')?.addEventListener('input', e => {
      if (e.target?.matches('[data-key]')) {
        clearFeedback();
      }
    });
  }
  function displayFeedback(review, label) {
    clearFeedback();
    const source = review && typeof review === 'object' ? review : {};
    let count = 0;
    for (const key of allKeys) {
      const note = boxes[key];
      const raw = source[key];
      const comments = (Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [])
        .filter(v => typeof v === 'string' && v.trim()).slice(0, 3);
      if (!note || !comments.length) continue;
      // Graph rows are entered through a separate table; place its feedback below that table.
      if (key === 'graphData') {
        const graphTable = document.querySelector('.poster-graph-table');
        if (graphTable) graphTable.insertAdjacentElement('afterend', note);
      }
      note.textContent = '';
      comments.forEach(msg => {
        const line = document.createElement('p');
        line.textContent = '✦ ' + msg.trim().slice(0, 300);
        note.appendChild(line);
      });
      note.hidden = false;
      note.closest('details.section')?.setAttribute('open', '');
      count += comments.length;
    }
    status.hidden = false;
    status.textContent = label + (count ? ' · 수정·보완 의견 ' + count + '건을 입력칸 아래에 표시했습니다.' : ' · 지적할 만한 사항이 확인되지 않았습니다.');
  }
  function localCheck(fields) {
    const feedback = {};
    function add(key, message) {
      (feedback[key] || (feedback[key] = [])).push(message);
    }
    if (!fields.question) add('question', '핵심 연구질문을 관찰하거나 측정할 수 있는 형태로 작성하세요.');
    if (!fields.hypothesis) add('hypothesis', '연구질문에 대응하는 검증 가능한 예측과 과학적 근거를 작성하세요.');
    if (!fields.variables && (fields.method || fields.results)) add('variables', '조작변인·종속변인과 통제할 조건을 구분하여 제시하세요.');
    if (fields.method && !/(반복|회\s*(측정|실험)|[2-9]\s*회|대조|비교)/.test(fields.method)) {
      add('method', '반복 측정 횟수나 비교 조건이 있다면 실험 절차에 구체적으로 명시하세요.');
    }
    if (fields.graphData && !fields.graphXLabel) add('graphXLabel', '그래프의 가로축이 나타내는 조작변인을 명확히 쓰세요.');
    if (fields.graphData && !fields.graphYLabel) add('graphYLabel', '그래프의 세로축이 나타내는 종속변인을 명확히 쓰세요.');
    if (fields.graphData && !fields.graphUnit) add('graphUnit', '측정값에 단위가 있다면 Y축 단위를 입력하세요.');
    if (fields.results && fields.discussion && /(?:고효율|최적|우수성|완벽하게|입증했다|증명했다)/.test(fields.discussion + fields.conclusion)) {
      add('conclusion', '비교 실험이나 추가 성능 측정 없이 성능의 우수성·최적성을 단정하지 않았는지 검토하세요.');
    }
    if (fields.researchers && fields.researchers.split(/[,，\n]+/).filter(Boolean).length > 1 && !fields.contributions) {
      add('contributions', '연구자가 여러 명이라면 각 연구자의 실제 수행 역할을 구분해 작성하세요.');
    }
    if (fields.references && /^https?:\/\/\S+$/i.test(fields.references.replace(/\s+/g, ''))) {
      add('references', 'URL만 적었다면 문헌 제목·저자(또는 기관)·발행연도도 가능한 범위에서 기재하세요.');
    }
    const voltages = {};
    for (const key of ['abstract', 'results', 'discussion', 'conclusion']) {
      const values = [...fields[key].matchAll(/(\d+(?:\.\d+)?)\s*(?:m?V|볼트)(?=\s|[.,;)\]]|$)/gi)].map(m => m[0].replace(/\s/g, '').toLowerCase());
      if (values.length) voltages[key] = values;
    }
    const distinct = [...new Set(Object.values(voltages).flat())];
    if (Object.keys(voltages).length >= 2 && distinct.length > 1) {
      add('results', '서로 다른 전압값이 서술되어 있습니다. 각 값의 측정 조건·시점이 다른지 확인하고 본문 전반에 일관되게 표시하세요.');
    }
    const repeat = [...['method', 'results', 'discussion', 'conclusion'].flatMap(k =>
      [...fields[k].matchAll(/(\d+)\s*회\s*(?:반복|측정|실험)/g)].map(m => m[1])
    )];
    if (new Set(repeat).size > 1) add('method', '반복 측정 횟수가 부분별로 달라 보입니다. 실제 반복 횟수를 확인하세요.');
    return feedback;
  }
  function trustedMessageOrigin(origin) {
    if (origin === 'null') return true;
    try {
      const u = new URL(origin);
      const host = u.hostname.toLowerCase();
      return u.protocol === 'https:' && (
        host === 'script.google.com' ||
        host === 'script.googleusercontent.com' ||
        /^[a-z0-9-]+-script\.googleusercontent\.com$/.test(host)
      );
    } catch (_) { return false; }
  }
  function reviewOnServer(fields) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(endpoint)) {
      return Promise.reject(Error('AI 서버 주소가 설정되지 않았습니다.'));
    }
    return new Promise((resolve, reject) => {
      const nonce = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
      const frame = document.createElement('iframe');
      frame.name = 'posterAiFeedback_' + nonce.replace(/[^a-z0-9]/gi, '');
      frame.style.display = 'none';
      frame.title = 'AI 피드백 응답';
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = endpoint;
      form.target = frame.name;
      form.style.display = 'none';
      form.acceptCharset = 'UTF-8';
      const payload = { action:'reviewPosterAIv1', nonce, fields:JSON.stringify(fields) };
      Object.keys(payload).forEach(key => {
        const input = document.createElement('input');
        input.name = key;
        input.type = 'hidden';
        input.value = payload[key];
        form.appendChild(input);
      });
      let settled = false;
      function cleanup() {
        window.removeEventListener('message', onMessage);
        clearTimeout(timeout);
        form.remove();
        frame.remove();
      }
      function onMessage(event) {
        const data = event.data;
        if (!data || data.kind !== 'einsteinPosterAIv1' || data.nonce !== nonce || !trustedMessageOrigin(event.origin)) return;
        if (settled) return;
        settled = true;
        cleanup();
        if (data.ok && data.feedback && typeof data.feedback === 'object') resolve(data.feedback);
        else reject(Error(data.error || 'AI 피드백 서버에서 결과를 받지 못했습니다.'));
      }
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(Error('AI 서버 응답이 지연됩니다. 서버 배포 상태와 API 사용 한도를 확인하세요.'));
      }, 90000);
      window.addEventListener('message', onMessage);
      document.body.append(frame, form);
      form.submit();
    });
  }
  function merge(local, ai) {
    const out = {};
    for (const key of allKeys) {
      const items = [];
      for (const source of [ai, local]) {
        const raw = source?.[key];
        for (const msg of (Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [])) {
          if (typeof msg === 'string' && msg.trim() && !items.some(v => v === msg.trim())) items.push(msg.trim());
        }
      }
      if (items.length) out[key] = items.slice(0, 3);
    }
    return out;
  }
  createFeedbackBoxes();
  button.addEventListener('click', async () => {
    if (pending) return;
    const fields = collect();
    const source = forAI(fields);
    if (!Object.keys(source).length) {
      status.hidden = false;
      status.textContent = '포스터 연구 내용을 먼저 입력하세요.';
      return;
    }
    const basic = localCheck(fields);
    if (!endpoint) {
      displayFeedback(basic, '기본 자동 점검 결과 (생성형 AI 서버 미연결)');
      return;
    }
    if (!sessionStorage.getItem('posterAiPrivacyAccepted')) {
      if (!window.confirm('AI 검토를 위해 작성한 연구 내용이 외부 AI 서비스로 전송됩니다.\n연구자 학번·이름, 모둠명, 연구자별 역할, 사진은 전송하지 않습니다.\n계속하시겠습니까?')) return;
      sessionStorage.setItem('posterAiPrivacyAccepted', 'yes');
    }
    pending = true;
    button.disabled = true;
    const original = button.textContent;
    button.textContent = '✦ AI 검토 중…';
    status.hidden = false;
    status.textContent = '작성한 내용을 바탕으로 과학적 오류와 수정·보완할 사항을 검토하고 있습니다.';
    const snapshot = JSON.stringify(fields);
    try {
      const fromAI = await reviewOnServer(source);
      if (JSON.stringify(collect()) !== snapshot) {
        clearFeedback();
        status.hidden = false;
        status.textContent = '검토 중 내용이 수정되었습니다. 변경된 내용으로 다시 검토해 주세요.';
        return;
      }
      displayFeedback(merge(basic, fromAI), 'AI 피드백');
    } catch (error) {
      displayFeedback(basic, '기본 자동 점검 결과 (AI 연결 실패)');
      status.textContent += ' · AI 검토 오류: ' + (error?.message || String(error));
    } finally {
      pending = false;
      button.disabled = false;
      button.textContent = original;
    }
  });
})();