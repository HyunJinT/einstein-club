# 2026 R&E 최종 결과물 제출 (전용 Firebase 프로젝트)

학생·교사 공통 주소: https://hyunjint.github.io/einstein-club/rne-submission/

**중요:** 이전 `yeast-lab` 프로젝트와 완전히 분리합니다. 이 폴더의 앱은 새 Firebase의 웹앱 설정값이 반영되기 전까지 제출 기능이 비활성화됩니다. 기존 효모·방과후 앱 Firebase 규칙은 **절대 수정하지 마세요.**

## 사용자 기능
- 개인별 최종 보고서: 학번 5자리, 이름, 희망 진로, 보고서 1개(PDF/HWP/HWPX/DOCX)
- 모둠별 발표자료: 대표학생, 연구주제·모둠명, 전체 모둠원 학번/이름, PPTX/PPT/PDF 1개
- 최초 로그인: 숫자 6자리 PIN 생성, 재로그인 후 제출 수정과 파일 교체 가능
- 교사용: Google 로그인 후 제출 현황·파일 확인, 제출 마감/해제, PIN 초기화(제출물 유지)
- 파일 한 개 최대 25MB
- 11월 22일(일) 23:59 일정은 안내용이며 실제 차단은 교사의 마감 버튼을 기준으로 합니다.

## 전용 Firebase 프로젝트 설치 순서
1. [Firebase Console](https://console.firebase.google.com/) → **프로젝트 추가** → 새 R&E 전용 프로젝트 생성 (기존 yeast-lab 프로젝트 선택 금지).
2. 프로젝트 개요 옆 **웹앱 </> 추가** → 'R&E 제출 앱'으로 등록하고 `firebaseConfig` 전체 복사. *Firebase Hosting은 필요 없음* (GitHub Pages로 이미 호스팅).
3. 새 프로젝트의 **Realtime Database** 생성 → 발급된 `databaseURL` 확인.
4. 새 프로젝트의 **Authentication**에서 **Anonymous** 및 **Google** 로그인 활성화, **Authorized domains**에 `hyunjint.github.io` 추가.
5. 새 프로젝트의 **Realtime Database → Rules**에 이 폴더의 `firebase-database.rules.json` **전체 붙여넣기**. 이 파일은 전용 프로젝트용 독립 규칙이며 기존 효모·방과후 데이터 규칙은 없습니다.
6. 새 프로젝트의 **Storage** 활성화 (Blaze 종량제 요금제와 결제 계정이 필요), **Storage → Rules**에 이 폴더의 `firebase-storage.rules` **전체 붙여넣기**.
7. 새 프로젝트의 웹앱 `firebaseConfig` (public key values)와 RTDB URL을 앱 코드 `index.html`의 `FIREBASE_CONFIG`에 반영.
8. 교사용 Google 로그인 테스트 후, 새 프로젝트 Authentication 사용자 목록에서 교사 Google 계정의 UID를 확인. **예전에 사용하던 교사 UID와 새 Firebase 프로젝트의 UID가 같다고 가정하지 마세요.** 이 폴더의 Realtime Database 규칙과 Storage 규칙에 임시로 들어 있는 기존 UID를 **새 프로젝트에서 확인한 UID로 변경**해야 합니다.
9. 학생용/교사용 파일 제출·PIN 초기화·마감 테스트 후 학생들에게 링크 배포.

## 파일
- `index.html`: GitHub Pages 정적 프런트엔드
- `firebase-database.rules.json`: R&E 전용 Realtime Database 규칙 전체 (교사 UID 적용 필요)
- `firebase-storage.rules`: R&E 전용 Storage 규칙 전체 (교사 UID 적용 필요)

### 필수 보안 점검
- 신규 계정에 대한 학적부 인증은 없으므로 최초 등록자에 의한 학번 선점 가능성이 있습니다.
- 6자리 PIN은 개인정보 보호에 한계가 있으므로 파일과 PIN에 민감한 개인정보나 인증 비밀을 넣지 마세요.
- 앱 테스트 전에 학생 파일 접수를 공지하지 마세요.
- 결제형 Storage이므로 예산 알림을 설정하세요.
