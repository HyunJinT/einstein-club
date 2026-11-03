# 2026 R&E 최종 결과물 제출 앱

학생용 / 교사용 주소: https://hyunjint.github.io/einstein-club/rne-submission/

## 주요 기능
- 첫 화면: **최종 보고서 제출(개별)** / **발표자료 제출(모둠)** 선택
- 최초 접속: 학번 5자리 + 이름 + 숫자 PIN 6자리 설정
- 재접속: 같은 학번·이름과 PIN으로 로그인하여 기존 제출 정보 및 파일 교체
- 개인 보고서: 학번·이름(로그인에서 자동 적용), 진로·관심 분야, 최종 보고서 1개(PDF/HWP/HWPX/DOCX)
- 발표자료: 대표학생, 연구주제·모둠명, 모둠원 전체 학번·이름(행 추가), PPTX/PPT/PDF 1개
- 교사용: Google 계정으로 인증, 보고서·발표자료 열람 및 다운로드, 제출 마감/해제, 학생 PIN **초기화만** 가능
- PIN을 초기화해도 보고서 및 발표자료는 삭제되지 않습니다. 기존 학생 인증 세션도 무효화됩니다.
- 업로드 1개당 25MB 제한. 제출 파일 자체는 Firebase Cloud Storage, 제출 메타데이터와 PIN 확인 데이터는 Firebase Realtime Database에 보관합니다.
- 앱 내 마감일 **11월 22일(일) 23:59**은 안내용이며, 실제 제출 차단은 교사의 **제출 마감** 버튼을 기준으로 실행됩니다.

## 필수 초기 설정 — 아직 완료되지 않으면 파일 제출이 작동하지 않습니다

### 1) Firebase Realtime Database 규칙 게시
1. https://console.firebase.google.com/project/yeast-lab/overview 로 접속합니다.
2. Build → Realtime Database → Rules를 엽니다.
3. 이 폴더의 [firebase-database.rules.json](./firebase-database.rules.json)을 열고 전체 복사하여 **기존 전체 Rules와 비교**한 다음 게시합니다.
4. 이 파일은 기존 `classes`, `controls`, `einsteinBooking2026` 규칙과 새로운 `rneSubmission2026` 규칙을 합친 버전입니다. Firebase 콘솔 규칙이 GitHub 원본보다 새로 변경된 상태라면 **신규 `rneSubmission2026` 블록만 수동 병합**하여 기존 앱 설정을 유지하세요.
5. 등록된 교사용 Google Auth UID가 규칙에 반영되어 있습니다.

### 2) Firebase Storage 활성화 및 규칙 게시
1. Firebase Console → Build → Storage에서 저장소가 아직 없으면 생성합니다. **2026년 기준 Firebase Cloud Storage 사용에는 Blaze(종량제) 요금제가 필수**입니다. 무료 사용량이 포함될 수 있으나 과금 가능성이 있으므로 결제 계정과 예산 알림을 먼저 설정하세요.
2. Storage → Rules에서 [firebase-storage.rules](./firebase-storage.rules)의 `match /rneSubmission2026/{uid}/{kind}/{filename}` 블록을 **기존 다른 Storage 규칙과 병합**해서 게시합니다.
3. 기존 Storage 규칙 전체를 덮어쓰면 다른 웹앱 업로드 기능이 중단될 수 있습니다. 기존 규칙은 삭제하지 마세요.
4. 저장소 주소가 `yeast-lab.firebasestorage.app`인지 확인하세요. 다른 경우 HTML의 `storageBucket` 값을 맞춰야 합니다.

### 3) Firebase Authentication
- Sign-in method에서 **Anonymous(익명)**와 **Google** 로그인 활성화
- Authorized domains에 `hyunjint.github.io` 추가
- PIN은 Firebase Auth 자체의 계정 비밀번호가 아니며, Realtime Database 보안 규칙으로 검사하는 6자리 PIN입니다.

### 4) 기능 시험
1. 학생 페이지에서 `20000`과 테스트 이름으로 최초 PIN 설정 및 보고서 파일 제출
2. 로그아웃 → 동일 학번·이름·PIN으로 재접속 → 파일 교체
3. 교사용 Google 로그인 → 개인 보고서 및 모둠 PPT 열람
4. 교사용 PIN 초기화 → 학생 재접속 시 **새 PIN 설정** 확인 → 기존 보고서 보존 확인
5. 교사용 제출 마감 → 학생 수정/신규 제출 거부 확인 → 마감 해제 후 수정 확인

**주의:** 학번·이름만으로 새 계정을 먼저 만드는 것을 방지하기 위한 학교 학적 데이터 검증은 포함되지 않았습니다. 최초 계정 등록 시 타인 사칭 가능성이 있으므로 학생들에게 본인 정보만 입력하도록 안내하고, 보안 요구 수준이 높은 환경에는 학교 계정 기반 인증을 고려하세요. PIN은 암호화 통신으로 전송되고 DB에는 일방향 해시로 보관되지만, 6자리 PIN 특성상 유출·추측 위험을 완전히 제거하지는 못합니다.

## 배포 구조
- `index.html`: GitHub Pages 정적 프론트엔드
- `firebase-database.rules.json`: **수동 게시 필요** 전체 RTDB 보안 규칙
- `firebase-storage.rules`: **수동 병합·게시 필요** Storage 보안 규칙
