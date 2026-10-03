/* =====================================================================
   WELLBI Archive - 설정
   ---------------------------------------------------------------------
   Google Drive 모드로 전환하려면 아래 세 값을 채우세요.
   비어 있으면 자동으로 프로토타입(브라우저 IndexedDB) 모드로 동작합니다.

   발급 절차는 README.md "Google Drive 전환" 참고.
   ===================================================================== */

const CONFIG = {
  /* Google Cloud Console → API 및 서비스 → 사용자 인증 정보
     OAuth 2.0 클라이언트 ID (웹 애플리케이션)
     - 승인된 JavaScript 원본: http://localhost:8080, https://<계정>.github.io */
  GOOGLE_CLIENT_ID: "332562311654-8l3cfvl47bg5qgupiaagceps78sjdlcc.apps.googleusercontent.com",

  /* 같은 화면 → API 키 (공개 사이트가 로그인 없이 index.json 을 읽을 때 사용)
     - 애플리케이션 제한: HTTP 리퍼러 (위 원본과 동일)
     - API 제한: Google Drive API 만 허용 */
  GOOGLE_API_KEY: "AIzaSyCQjQBGAT0hqY-m9Pgj1-0LmNJBr766vFY",

  /* 공유 드라이브(또는 내 드라이브)에 만든 "WELLBI Archive" 루트 폴더 ID
     - 폴더 URL https://drive.google.com/drive/folders/<이 부분> 
     - 공유 설정: "링크가 있는 모든 사용자 - 뷰어" (공개 사이트가 파일을 표시하기 위해 필요) */
  DRIVE_ROOT_FOLDER_ID: "1KjpRydzwT-PmaYzv9kzGvgxZWopY4mG7",

  /* 관리자 콘솔에 로그인할 수 있는 이메일 도메인 (비우면 members.json 목록만 허용)
     - 회사 메일은 Outlook 이라 Google 로그인 불가 → 공용 Google 계정 1개로 운영, 도메인 허용 없음 */
  ALLOWED_DOMAIN: "",

  /* 최초 관리자 — members.json 이 아직 없을 때 이 이메일로 로그인하면 자동 생성
     - 회사 공용 Google 계정 (Drive 폴더 · Cloud 프로젝트 소유 계정과 동일) */
  BOOTSTRAP_ADMIN: "wellbi.company@gmail.com",
};

CONFIG.DRIVE_ENABLED = !!(CONFIG.GOOGLE_CLIENT_ID && CONFIG.GOOGLE_API_KEY && CONFIG.DRIVE_ROOT_FOLDER_ID);
