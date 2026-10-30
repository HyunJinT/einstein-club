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
5. Firebase **Authentication → Users(사용자)** 화면에서 교사용 Google 계정이 등록되었는지 확인합니다.
6. GitHub `firebase-database.rules.json` 파일 내용을 **통째로 복사**하여 Firebase **Realtime Database → Rules**에 붙여넣습니다. **교사 UID는 이미 반영되어 있으므로 수정할 필요가 없습니다.**
7. 기존 Realtime Database 경로가 `classes`와 `controls` 외에도 있다면 그 경로의 규칙도 적절히 보존해야 합니다. **현재 루트 규칙의 `auth != null` 읽기/쓰기 허용은 반드시 제거해야 새 신청서를 보호할 수 있습니다.**
8. Firebase 규칙 시뮬레이터로 익명 사용자 신청서 **읽기 거부** / **신규 쓰기 허용** / 기존 기록 수정 거부, 교사 Google 사용자 읽기·변경 허용 확인 후 **Publish**.
9. 마지막으로 학생용 테스트 신청(`20000 테스트`)과 교사 조회 및 승인 변경을 확인하고 학생에게 링크를 공유합니다.

## 보안 규칙 파일
https://github.com/HyunJinT/einstein-club/blob/main/experiment-booking/firebase-database.rules.json

**해당 파일에는 지정된 교사 UID가 이미 반영되어 있습니다.** 게시 전 규칙 플레이그라운드에서 접근 권한을 점검하세요.
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

## 학생 자동저장 및 여러 날짜 신청

- 학생의 입력 내용은 같은 기기·브라우저의 **localStorage에 대표학생 + 실험 날짜별로 자동저장**됩니다. 필드 수정, 행 추가·삭제, 단계 이동 시 저장됩니다.
- 브라우저를 닫았다 다시 열면 직전에 작성하던 대표학생과 날짜의 신청서를 자동 복원합니다. 다른 날짜를 선택하면 해당 날짜의 별도 임시저장을 불러옵니다.
- **다른 기기나 시크릿 모드, 브라우저 데이터 삭제 후에는 복원되지 않습니다.** 학교 공용 PC에서는 개인 정보를 남기지 않도록 **이 기기의 임시저장 기록 삭제**를 이용하세요.
- 최종 제출 성공 시 해당 날짜의 로컬 초안만 삭제되며, 이미 제출한 서버 신청서는 삭제되지 않습니다.
- 제출 완료 화면의 **+ 다른 날짜도 신청하기** 버튼을 누르면 대표학생을 다시 입력하지 않고 다른 날짜 신청이 가능합니다.

## 교사의 신청 결과 안내·개별 삭제 (2026-10-30)

- 교사용 관리에서 신청서 하나를 선택해 **실험 가능**, **이날 실험 불가능**, **실험 불가**, **보완 필요**, **교사 확인 전** 상태를 선택하고 코멘트를 입력한 뒤 **결과·코멘트 저장 및 학생에게 공개**를 누릅니다.
- 결과는 대표학생과 **신청서의 참석 명단에 포함된 모든 학생**을 대상으로 별도 `einsteinBooking2026/results` 경로에 저장됩니다. 공개되는 내용은 해당 실험 날짜, 실험 주제, 결과 상태, 교사 코멘트, 확인 시각뿐입니다. 신청서 원본·구매내역·참석명단은 읽을 수 없습니다.
- 학생은 같은 링크의 **신청 결과 보기**에서 학번·이름으로 조회합니다. 하나의 학생이 여러 신청서에 포함되면 여러 날짜의 결과가 표시됩니다.
- **학번과 이름만으로는 본인 확인이 되지 않습니다.** 아는 사람의 학번과 이름으로 결과를 조회할 가능성이 있으므로 교사 코멘트에 민감한 개인정보를 적지 마세요. 더 강한 개인정보 보호가 필요하다면 학생 전용 비밀 조회코드가 필요합니다.
- 교사는 신청서 상세의 **신청서 삭제**로 모둠 신청서를 한 건씩 삭제할 수 있습니다. 삭제 확인을 두 번 거치며 해당 신청서와 참가자 결과가 함께 삭제됩니다. **기존 효모 실험 데이터에는 영향이 없습니다.**
- Firebase Realtime Database 규칙도 반드시 최신 `firebase-database.rules.json` **전체로 교체하고 게시**해야 합니다. GitHub 파일 수정만으로는 결과 열람이나 삭제가 허용되지 않습니다.
- 기존에 제출한 신청서는 교사가 해당 신청서를 열고 한 번 **결과·코멘트 저장 및 학생에게 공개**를 눌러야 학생 조회 목록에 나타납니다.
