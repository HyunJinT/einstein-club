# 2026 아인슈타인 동아리 방과후 실험 신청 (GitHub Pages + Firebase)

**Google Apps Script / Cloudflare 사용 안 함.** 기존 `yeast-lab` Firebase 프로젝트의 Realtime Database를 재사용합니다.

## 접속 주소
https://hyunjint.github.io/einstein-club/experiment-booking/

GitHub Pages 배포 원본: `experiment-booking/index.html`.

- 학생: 링크 접속 → 대표 학번·이름 → 날짜 선택 → 참석 학생(행 추가) → 계획(예상 소요시간 포함) → 구입 준비물(G마켓, 행 추가) → 과학실 준비물(행 추가) → 최종 제출
- 교사: 동일 링크의 **교사용** 버튼 → 교사 Google 로그인 → 신청서 조회·승인·준비물 구매상태 변경·CSV
- 날짜별 대표 학번당 1개만 제출할 수 있습니다. 학생 신원 인증은 없으므로 타인 학번 도용은 완벽히 방지할 수 없습니다.

## 설치 순서 (중요: 먼저 읽기)

1. 기존 효모 앱은 Firebase Realtime Database `classes`, `controls` 경로를 사용합니다. **데이터(Data) 탭**에서 다른 최상위 경로도 있는지 확인하세요. 다른 경로가 있으면 규칙에 보존해야 합니다.
2. **Authentication → Sign-in method → Google** 사용 설정. 기존 효모 앱의 **익명(Anonymous)** 인증도 계속 사용 설정해 둡니다.
3. **Authentication → Settings → Authorized domains**에 `hyunjint.github.io` 추가(이미 있다면 생략).
4. 위 접속 주소의 **교사용 → Google 계정으로 교사용 로그인**을 클릭합니다. 보안 규칙 설정 전에는 Firebase의 기존 로그인 사용자 명단에 본인 Google 계정의 UID가 등록되는지 확인하는 용도입니다. **이때 학생들에게 링크를 보내지 마세요.**
5. Firebase **Authentication → Users(사용자)** 화면에서 방금 교사 Google 로그인 계정의 **UID**를 복사합니다.
6. GitHub `firebase-database.rules.json` 파일 내용을 복사하여 Firebase **Realtime Database → Rules**에 붙여넣습니다. `PUT_TEACHER_UID_HERE` 부분을 실제 교사 UID로 치환합니다.
7. 기존 Realtime Database 경로가 `classes`와 `controls` 외에도 있다면 그 경로의 규칙도 적절히 보존해야 합니다. **현재 루트 규칙의 `auth != null` 읽기/쓰기 허용은 반드시 제거해야 새 신청서를 보호할 수 있습니다.**
8. Firebase 규칙 시뮬레이터로 익명 사용자 신청서 **읽기 거부** / **신규 쓰기 허용** / 기존 기록 수정 거부, 교사 Google 사용자 읽기·변경 허용 확인 후 **Publish**.
9. 마지막으로 학생용 테스트 신청(`20000 테스트`)과 교사 조회 및 승인 변경을 확인하고 학생에게 링크를 공유합니다.

## 보안 규칙 파일
https://github.com/HyunJinT/einstein-club/blob/main/experiment-booking/firebase-database.rules.json

**해당 파일을 교사 UID 확인 없이 그대로 게시하지 마세요.**
규칙은 기존 효모 실험실의 `classes`, `controls` 권한을 유지하면서 새로운 `einsteinBooking2026/applications` 신청서는 교사 Google UID만 읽도록 제한합니다.

- 학생은 익명 Firebase 로그인으로 기존에 없는 신청서만 만들 수 있고, 이미 제출된 신청서를 수정하거나 읽을 수 없습니다.
- 실험일 당일 00시(한국 시간)부터 Firebase 서버 `now`로 신규 제출을 차단합니다.
- 교사만 일정 허용 및 상태·메모·구매상태를 변경할 수 있습니다.
- 새 가입 비밀번호나 교사용 비밀번호 `1028`을 공개 HTML에 넣지 않습니다. 순수 HTML+Firebase 환경에서 숫자 PIN만으로 교사 권한을 안전하게 관리하는 것은 권장하지 않습니다.
- 학생 기록은 학교에서 정한 기준에 맞춰 필요 기간만 보존하고 추후 삭제하세요.

## 파일 목록
- `index.html` — 현재 GitHub Pages + Firebase 버전
- `firebase-database.rules.json` — Firebase에 게시할 권한 규칙 초안 (교사 UID 교체 필수)
- `Index.html`, `Code.gs` — 이전 Apps Script 버전 (사용 안 함)
- `cloudflare-worker.js` — 이전 Cloudflare 대안 코드 (사용 안 함)

## Troubleshooting
- **신청 서버 규칙이 전체 공개 상태**: 현재 DB 루트에 `auth != null` 읽기가 설정됨. 안전한 규칙으로 전환하기 전까지 제출 차단.
- **교사용 권한 등록 필요**: Rules의 교사 UID가 실제 Google 로그인 UID와 일치하는지 확인.
- **auth/operation-not-allowed**: Firebase Authentication에서 Google/익명 로그인 중 해당 방식 활성화 필요.
- **auth/unauthorized-domain**: `hyunjint.github.io` 도메인 승인 필요.
- **PERMISSION_DENIED**: 루트 규칙/신청 전용 규칙/교사 UID를 점검.
