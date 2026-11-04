# 아인슈타인 포스터 AI 피드백 연결 안내

## 현재 구성

- 포스터 상단의 **✦ AI에게 포스터 피드백받기** 보라색 버튼
- 각 입력란 바로 아래에 **수정·보완 의견만** 보라색으로 표시
- 연구자별 학번·이름, 모둠명, 사진은 외부 AI로 보내지 않음
- AI 연결 전에는 **기본 자동 점검**만 작동하고, 실제 AI가 분석한 결과가 아님을 화면에서 알림
- 학생이 입력한 글을 자동으로 수정하거나 서버에 업로드하지 않음
- 입력 내용이 바뀌면 예전 피드백은 사라져 최신 내용으로 다시 검토할 수 있음

## 생성형 AI 활성화 (교사 설정)

GitHub Pages는 정적 웹사이트이므로 AI API 키를 HTML/JS에 직접 넣으면 **모든 방문자에게 노출**됩니다. 따라서 다음 방법으로 별도 Google Apps Script 서버에서 Gemini API를 호출합니다.

1. [Google AI Studio](https://aistudio.google.com/apikey)에서 본인이 사용하는 프로젝트에 Gemini API 키를 발급합니다. 학교 정책·미성년자 데이터 처리 정책·요금·사용량 제한을 미리 확인하세요.
2. [Google Apps Script](https://script.google.com/home/projects/create)에서 **새 프로젝트**를 만들고 [poster-ai-backend.gs](./poster-ai-backend.gs)의 전체 코드를 붙여 넣습니다. 기존 동아리 제출 앱의 `doPost`를 덮어쓰지 마세요. AI 전용 별도 프로젝트를 권장합니다.
3. Apps Script 프로젝트 설정 > 스크립트 속성에 **GEMINI_API_KEY**를 이름으로 설정하고, 값에는 발급받은 API 키를 등록합니다. API 키는 GitHub 저장소에 입력하지 마세요.
4. 배포 > 새 배포 > 유형: **웹 앱** > 실행 사용자: **나** > 액세스: **모든 사용자**로 배포합니다. 생성된 **/exec** URL을 복사합니다.
5. GitHub의 [poster-ai-config.js](./poster-ai-config.js)에서 `window.EINSTEIN_POSTER_AI_ENDPOINT = '';`의 빈 따옴표 안에 **/exec URL만** 넣고 저장합니다.
6. [포스터 제작 사이트](https://hyunjint.github.io/einstein-club/poster/)에서 **Ctrl + F5** 새로고침을 한 후, 실험 자료를 입력하고 버튼으로 검토합니다. 입력란 바로 아래 보라색 의견이 표시되는지 확인합니다.

## 운영 및 개인정보 유의

- AI 검토에는 학생이 작성한 **연구 내용**이 외부 AI 서비스로 전송됩니다. 연구자 목록, 학번·이름, 모둠명, 연구자별 역할, 사진을 전송하지 않으며, 일반 연구 본문에서 확인한 학번·이메일·전화번호도 일부 마스킹합니다. 그 밖의 개인정보를 학생이 본문에 적지 않도록 지도해 주세요.
- 화면은 처음 AI 요청 시 학생에게 전송 여부를 확인합니다.
- 이 샘플 서버는 하루 총 **80회**의 호출 제한을 설정했지만, 공개된 웹 앱이므로 악의적인 호출에 대한 완전한 보안 수단은 아닙니다. API 제공자에서 **프로젝트별 요금 한도·할당량**을 제한하고, 사용 기간 후 배포를 중지하세요.
- AI는 실제로 하지 않은 측정값을 만들어낼 수 없으며, 외부 URL을 직접 열어 확인하지 않습니다. 따라서 의견은 최종 정답이 아니라 수정 검토 참고용입니다.
- AI 서버가 미연결 또는 실패했다면 기존 간단한 규칙 검사만 표시하며, 상태 문구에 명시합니다.
- 키가 노출되었다면 Google AI Studio에서 즉시 폐기·교체하세요.

## 구현 파일

- [poster-ai-feedback-v1.js](./poster-ai-feedback-v1.js): 버튼 이벤트, 현장 피드백 주입, 기본 자동 점검, AI 서버 통신
- [poster-ai-backend.gs](./poster-ai-backend.gs): Gemini 호출, 연구 항목별 JSON 피드백, 응답 전달, 일일 제한
- [poster-ai-config.js](./poster-ai-config.js): 배포된 Apps Script 주소 (비밀키 저장 금지)
