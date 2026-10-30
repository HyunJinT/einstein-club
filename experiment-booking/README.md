# 2026 아인슈타인 동아리 방과후 실험 신청 — GitHub Pages + Cloudflare

**Google Apps Script가 필요 없습니다.** Apps Script 상단 알림 배너도 없습니다.
학생/교사 모두 동일한 반응형 웹 주소를 사용합니다.

예상 GitHub Pages 주소: https://hyunjint.github.io/einstein-club/experiment-booking/
(GitHub Pages가 기존 `main / (root)`에서 배포 중이어야 합니다. 실제 게시 여부는 방문해 확인하세요.)

## 파일

- **index.html**: GitHub Pages용 학생/교사 통합 화면. Google Apps Script 사용 안 함.
- **cloudflare-worker.js**: Cloudflare Worker용 서버 API. 신청 저장, 날짜·마감 검사, 관리자 PIN 로그인, 교사용 조회·관리 기능.
- **Index.html** + **Code.gs**: 이전 Apps Script 버전의 소스(사용할 필요 없음).

## 최초 설치: 1회

### 1) Cloudflare 가입 및 Worker 생성
1. https://dash.cloudflare.com/ 에 로그인합니다.
2. **Workers & Pages → Create application → Worker**를 생성합니다. 이름은 예를 들어 `einstein-booking-api`로 지정합니다.
3. **Edit code**를 열고 `cloudflare-worker.js` 파일 내용을 통째로 붙여넣어 **Deploy**합니다.
4. 화면에 표시된 Worker 주소(예: `https://einstein-booking-api.<계정>.workers.dev`)를 복사해 둡니다.

### 2) Cloudflare D1 저장소 생성 및 연결
1. Cloudflare 대시보드 **D1 SQL Database → Create database**에서 `einstein-booking`이라는 DB를 만듭니다.
2. 생성한 **Worker → Bindings → Add binding → D1 database**를 선택합니다.
3. **Variable name을 반드시 `DB`**로 입력하고, 방금 만든 `einstein-booking`을 선택해 연결합니다.
4. DB의 테이블은 **첫 API 요청 시 자동 생성**됩니다. SQL을 직접 입력할 필요 없습니다.

### 3) 교사 비밀번호를 Cloudflare 비밀값으로 설정
1. Worker → **Settings → Variables and Secrets → Add**.
2. **Type: Secret**을 선택합니다.
3. 이름을 `ADMIN_PIN`으로 입력하고, 값에는 원하는 4자리 PIN을 입력합니다.
4. **Deploy**를 눌러 반영합니다.

**주의:** PIN을 GitHub HTML/JS/README에 직접 적지 마세요.
학생이 소스 보기를 해도 PIN을 볼 수 없게 Cloudflare 서버 비밀값으로 보관합니다.
4자리 PIN은 보안 강도가 낮으므로 5회 실패 시 20분 제한이 있지만 안전을 완전히 보장하지는 않습니다.

### 4) GitHub와 Worker 연결
1. GitHub `experiment-booking/index.html`을 엽니다:
   https://github.com/HyunJinT/einstein-club/blob/main/experiment-booking/index.html
2. 편집(연필) 버튼을 눌러 `const API_URL = 'https://YOUR-WORKER.workers.dev';`를 검색합니다.
3. 이 부분의 URL만 **실제 Worker URL**로 교체하고 저장(commit)합니다.
   - 또는 Worker URL을 ChatGPT에 전달하면 연결 코드를 GitHub에 업데이트하도록 요청할 수 있습니다.
4. GitHub Pages가 공개되어 있다면 동일한 주소에서 학생용과 교사용이 함께 열립니다.

### 5) 테스트
1. 학생용: 학번 `20000`, 이름 `테스트`로 날짜 하나를 선택해 제출합니다.
2. 교사용: 같은 페이지 상단 교사용 버튼 → PIN 입력 → 신청 내역 확인.
3. 구매 준비물, G마켓 링크, 과학실 준비물 목록, CSV, 승인 변경을 확인합니다.
4. 테스트 신청서는 데이터베이스에 남습니다. 필요하면 운영 전 DB에서 삭제하세요.

## 날짜와 마감
- 2026-11-02(월): 11-01 23:59까지
- 2026-11-04(수): 11-03 23:59까지
- 2026-11-05(목): 11-04 23:59까지
- 2026-11-06(금): 11-05 23:59까지
- 2026-11-09(월): 11-08 23:59까지
- 2026-11-10(화): 11-09 23:59까지

마감은 **서버에서도** 검사합니다. 학생 화면의 날짜 버튼만 숨기는 방식이 아닙니다.

## 운영·보안 메모
- 학생은 학번·이름만 입력하므로 **본인 확인 기능은 없습니다.** 같은 대표학번으로 날짜별 1회만 등록할 수 있고, 학생의 기존 신청서 조회/수정은 제공하지 않습니다.
- 교사용 API는 Cloudflare 서버에서 PIN 또는 만료되는 관리자 세션을 검사합니다. HTML만 수정해도 교사용 자료를 가져올 수는 없습니다.
- 등록 신청서는 D1에 저장되며 교사에게만 조회됩니다. 학생 정보를 공개 GitHub 저장소에 올리지 마세요.
- 학생 수와 학교 규정에 맞게 개인정보 처리·보유 기간 및 삭제 절차를 정하세요.
- 학교 계정/네트워크 정책상 Cloudflare 접속이 제한될 수 있습니다.
- **Worker와 D1 바인딩 및 Secret 설정은 GitHub 코드 업로드만으로 자동 완료되지 않습니다.**
