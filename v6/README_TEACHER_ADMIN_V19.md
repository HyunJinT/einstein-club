# 아인슈타인 교사용 V19 - 배포 안내

기존 제출 기록, Google Drive 파일, 학생 PIN, 제출코드 및 교사용 PIN은 유지합니다.
2026년 12월 6일 23:59(한국시간)의 기존 자동 마감일은 변경하지 않습니다.

## 새 파일 추가 (필수)
1. 기존 아인슈타인 최종제출 Google Apps Script 프로젝트를 엽니다 (R&E 프로젝트가 아님).
2. 왼쪽 파일 + > 스크립트 > 이름 EinsteinTeacherAdminV19 를 입력합니다.
3. 이 폴더의 EinsteinTeacherAdminV19.gs 소스를 전부 복사해서 새 파일에 붙여넣습니다.
4. 기존 Code.gs, PosterBridgeV17.gs, EinsteinSharedPosterLinkV18.gs, TeacherV18.gs는 삭제하지 않습니다.
5. setupEinstein()을 절대로 재실행하지 않습니다.

## 활동기록 / 개인보고서 수동 마감 연동 (필수)
기존 Code.gs에서 다음 네 함수의 시작부에 있는 einsOpenV10_() 또는 einsteinStudentOpen_() 호출 바로 다음 줄에 추가:

    einsV19AssertOpen_('activity');

적용 대상 함수:
- saveEinsteinDraftV10 (자동저장)
- beginEinsteinSubmissionV12 (제출 시작)
- uploadEinsteinFileV12 (파일 첨부)
- finalizeEinsteinSubmissionV12 (최종 접수)

공통 함수 einsteinStudentOpen_ 자체를 바꾸지 마세요. 해당 함수는 포스터 인증에도 사용됩니다.

## 공동 포스터 수동 마감 연동 (필수)
PosterBridgeV17.gs (또는 Code.gs에 통합된 동일 함수)의 einsPosterOpenV17_ 함수 안에서 기존 einsteinStudentOpen_() 다음 줄에 추가:

    einsV19AssertOpen_('poster');

기존 포스터 업로드 시작, 조각 업로드, 완료 기능이 모두 이 함수를 호출합니다.

## V18 공유 포스터 자동첨부 예외 (이 파일을 설치한 경우 필수)
EinsteinSharedPosterLinkV18.gs의 confirmAndAttachEinsteinPosterV18에서 다음 호출 바로 아래:

    confirmEinsteinSharedPosterV15(user.studentId,accessCode,posterId,confirmed);

다음을 삽입합니다.

    if (einsV19IsManualClosed_('activity')) {
      return {ok:true,confirmed:confirmed,attachedToSubmission:false,submittedFiles:null,
        message:'포스터 확인은 저장했습니다. 활동 기록은 마감되어 자동첨부하지 않았습니다.'};
    }

따라서 활동기록이 마감되어도 열린 포스터 접수에서 학생 확인은 가능하며, 개인 활동기록의 파일목록은 변경하지 않습니다.

## 배포
1. 저장
2. 배포 > 배포 관리 > 기존 배포의 편집(연필) > 새 버전 > 배포
3. 기존 배포를 수정하므로 학생과 교사의 /exec 주소는 유지
4. 교사용 접속 후 활동 기록 마감과 포스터 마감을 각각 테스트
5. 테스트 계정 파일 하나의 삭제 및 제출 현황 갱신을 확인

교사용 주소:
https://script.google.com/macros/s/AKfycbwcgV5NXm75aETWnzJpGCtLfihfb4i4mQGfB_0Ext5s4Zq2quWzHoRl8TqIv38LVGMWuA/exec?view=teacher

## 삭제 범위
- 개인 첨부파일 삭제: 학생의 최신 제출 파일 목록에서 한 파일을 선택하여 Drive 휴지통으로 이동하고, 같은 학생의 제출 이력의 파일 참조에서 제거. 활동 기록 원문과 다른 파일은 유지.
- 공동 포스터 삭제: 한 포스터 파일을 Drive 휴지통으로 이동, 공동연구포스터 시트의 해당 행 제거, 모든 모둠원 제출 이력의 관련 파일 참조 제거.
- 삭제 버튼 클릭 후 확인창 및 학번 재입력을 통해 오삭제를 방지.
- 학생 제출 데이터는 자동 삭제되지 않음. 교사가 실제로 삭제 버튼을 클릭한 대상만 변경.

운영 전 중요 파일을 별도로 백업하는 것을 권장합니다.
