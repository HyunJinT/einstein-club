# 2026 은행고 R&E 제출 앱 — Firebase + 비공개 Google Drive

학생용 및 교사용 공통 URL: https://hyunjint.github.io/einstein-club/rne-submission/

**새 Firebase 프로젝트: eunhaeng** — 기존 효모 가상실험 yeast-lab과 분리되어 있습니다.

## 구성
- **Firebase Authentication (익명/Google)**: 최초 6자리 PIN, PIN 재로그인, 교사 Google 계정 인증
- **Firebase Realtime Database (Spark 무료 요금제)**: 학생 정보, PIN 인증 세션, 제출 현황, 마감 및 PIN 초기화
- **Google Apps Script (소유자 권한으로 실행)**: 학생 인증 확인 후 Drive 파일 업로드 및 Firebase 제출 기록 반영
- **소유자 Google Drive 비공개 폴더**: PDF, HWPX, HWP, DOCX 보고서와 PPTX, PPT, PDF 발표자료 (파일당 최대 15MB)
- **사용하지 않음**: Firebase Storage 및 Blaze 요금제

교사용 페이지에는 제출물 열람, 제출 마감/해제, 학생 PIN 초기화만 있습니다. PIN 초기화는 기존 제출물/파일을 변경하지 않습니다.

## 1. Firebase Realtime Database Rules 게시
1. https://console.firebase.google.com/project/eunhaeng/database 에 접속하여 Realtime Database → Rules 선택
2. 이 폴더의 [firebase-database.rules.json](./firebase-database.rules.json) 전체 내용을 복사
3. **전용 eunhaeng 프로젝트**의 Rules 편집기 내용을 전체 교체하고 **게시(Publish)**
4. 교사 Google UID m6QiCUlxlZWuhzxVNt8SuYboIBk2가 반영된 최신 규칙입니다. 이전의 yeast-lab Rules는 편집하지 마세요.
5. 기존 R&E Rules를 게시했다면 **최신 파일로 다시 게시**해야 합니다. Google Apps Script가 인증된 학생 PIN 세션을 조회하기 위한 sessions/$id/$uid/.read 규칙이 추가되어 있습니다.

## 2. Google Apps Script 웹 앱 만들기
1. 선생님 계정으로 https://script.google.com/home/projects/create 열기
2. 새 프로젝트 이름을 '2026 R&E Drive 제출 서버'로 변경
3. 기본 Code.gs 내용 전체 삭제
4. [R&E Code.gs 원본 파일](./Code.gs) 열기 → **Copy raw file** 클릭 → 편집기에 전체 붙여넣기
5. 저장(Ctrl+S)
6. 오른쪽 상단 **배포 → 새 배포 → 유형 선택(톱니바퀴) → 웹 앱**
7. **다음 사용자 인증 정보로 실행: 나(Me)**, **액세스 권한이 있는 사용자: 모든 사용자(Anyone)**로 설정
8. **배포** 클릭 후 Google Drive, 외부 요청(UrlFetchApp) 등 권한 승인
9. **웹 앱 URL**로 표시되는 https://script.google.com/macros/s/.../exec 주소 전체 복사
10. **완료:** R&E 앱의 DRIVE_UPLOAD_WEBAPP_URL에 배포된 Apps Script URL을 연결했습니다. 웹앱을 재배포하여 URL이 바뀌는 경우에만 다시 수정하세요.

**주의:** 웹 앱을 "나로 실행"하는 이유는 학생들이 선생님 Drive에 직접 권한을 갖는 것이 아니라, 서버가 인증된 학생의 제출 요청만 검증하고 대신 저장하기 위함입니다. 모든 사용자 접근이어도 PIN 세션 확인에 실패하면 파일을 저장하지 않습니다. **교사용 Firebase Google 로그인 계정과 Apps Script를 배포한 계정은 같은 계정**이어야 비공개 Drive 파일을 교사용 화면에서 정상 열 수 있습니다.

웹 앱 URL이 바뀌면 GitHub Pages 링크에 반영해야 합니다. Code.gs를 수정 후에는 **배포 → 배포 관리 → 편집 → 새 버전**으로 갱신해야 합니다.

## 3. 제출 시험
1. https://hyunjint.github.io/einstein-club/rne-submission/ 에 접속
2. 학생 테스트 학번 20000으로 최초 PIN 설정 후 보고서(15MB 이내) 업로드
3. 로그아웃 후 같은 학번·이름·PIN으로 재로그인해 파일 교체
4. 다른 학번이 테스트 학생의 제출물에 접근할 수 없는지 확인
5. 교사용 Google 로그인 → 개인 보고서/모둠 발표자료 목록 및 파일 열기 확인
6. PIN 초기화 후 **기존 제출 기록 유지** 확인
7. 제출 마감 → 학생 신규 제출 및 수정 차단 → 마감 해제

Drive 안에 '2026_은행고_RNE_최종결과물' 폴더가 자동 생성됩니다. 하위에 '01_개별최종보고서'와 '02_모둠발표자료' 폴더가 생성됩니다. 파일은 **비공개**이며, 학생 화면에는 파일 이름만 보이고 Drive 공유 링크는 공개하지 않습니다.


## 제출 파일 열람·삭제 기능 업데이트 (2026-11-03)
1. R&E 학생 화면에서 **기존 제출 파일명**을 누르면 학생의 PIN 세션을 재확인한 후 비공개 Drive 파일을 새 창에서 보여줍니다. PDF는 브라우저 미리보기 및 다운로드, HWPX/HWP/DOCX/PPTX/PPT는 다운로드 방식으로 열 수 있습니다.
2. 파일명 오른쪽의 **× 버튼**은 학생이 제출한 **파일 및 해당 제출 기록을 모두 삭제**합니다. 교사 마감 후에는 삭제할 수 없습니다. 교사용 페이지에는 삭제 버튼이 없고, PIN 초기화는 제출물을 지우지 않습니다.
3. 기존 제출물에 새 파일을 선택하고 저장하면, 이전 파일이 대체 및 삭제됨을 알리는 확인 창이 나타납니다.
4. 제출 종류 전환 버튼은 현재 화면에 따라 **모둠별 발표자료 제출** 또는 **개인 최종 보고서 제출**로 표시됩니다.
5. 발표자료의 입력란은 모둠명이 아닌 **연구주제**입니다. 내부 데이터 필드 이름 teamTitle은 기존 제출물 호환을 위해 그대로 유지합니다.
6. **필수 재배포:** GitHub에서 업데이트된 [Code.gs](./Code.gs) 전체를 복사해 기존 Apps Script 프로젝트의 Code.gs를 교체한 후, **배포 → 배포 관리 → 편집 → 버전: 새 버전 → 배포**를 진행하세요. 기존 배포를 편집하면 /exec URL이 유지됩니다. GitHub 웹앱은 이미 수정했습니다.
7. 재배포 후 테스트 학번 20000으로 **기존 PDF 열람 → 새 파일로 교체 → × 삭제 → 다시 제출 → 교사용 마감 후 삭제 차단**을 차례로 확인하세요. 팝업 차단 시 파일 미리보기 창을 허용해야 합니다.

## 보안 및 운영상 주의
- 앱이 학적부와 연동되어 있지 않아 학생이 처음 학번과 이름을 선점하는 위험은 남아 있습니다.
- 6자리 PIN은 학교 계정 기반 인증보다 보안성이 낮으므로 민감한 개인정보가 포함된 문서는 따로 보호 조치하세요.
- Apps Script는 사용량 및 실행 시간 제한이 있고 파일당 15MB로 제한했습니다. 이미지가 많은 PPT는 압축 후 제출하세요.
- 실제 Drive/Apps Script 배포를 진행하지 않은 상태에서 **학생들에게 제출 링크를 배포하지 마세요**.
- 서버는 Firebase ID 토큰과 현재 PIN 세션을 검증하고, 파일을 저장한 뒤 Database Rules가 허용하는 경우에만 제출 기록을 갱신합니다.
- 앱 코드와 서버 스크립트는 제작했지만 Apps Script 웹 앱 배포 및 실제 업로드 시험은 관리자가 수행해야 합니다.

## 파일 구성
- 'index.html': GitHub Pages 웹앱
- 'Code.gs': Google Apps Script 서버에 복사할 전체 코드
- 'firebase-database.rules.json': 전용 Firebase 프로젝트에 복사할 DB 규칙
