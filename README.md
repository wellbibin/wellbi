# WELLBI Archive

MICE 행사 종료 후 기록 보관 및 영업용 포트폴리오 사이트.

## 실행

빌드 없음. `index.html`을 브라우저에서 열면 바로 동작합니다.
PDF 인라인 열람·Google 로그인은 `file://`에서 제한되므로, 확인 시에는 간단한 로컬 서버를 권장합니다.

```bash
# Python이 있으면
python -m http.server 8080
# → http://localhost:8080
```

## 파일 구성

| 파일 | 역할 |
|---|---|
| `index.html` / `app.js` / `style.css` | 공개 사이트 (년도 → 분야 → 프로젝트 → 상세) |
| `admin.html` / `admin.js` / `admin.css` | 관리자 콘솔 (로그인, 프로젝트 편집, 드래그앤드롭 업로드, 구성원) |
| `config.js` | **Google 설정** (클라이언트 ID · API 키 · 루트 폴더 ID). 비어 있으면 프로토타입 모드 |
| `storage.js` | 저장 계층. `LocalStore`(IndexedDB 프로토타입) / `DriveStore`(Google Drive) — config 에 따라 자동 선택 |
| `data.js` | 분야/카테고리 정의 + 샘플 프로젝트 (프로토타입 모드 최초 1회 시딩용) |

## 탐색 구조

```
HOME (년도 타일) → 분야 타일 → 프로젝트 썸네일 → 상세
                                                  ├ 제안서 / 정량서류 / 기록사진 / 영상
                                                  └ 기념품 / 공연 / 디자인·시안 / 기타
```

검색창에 카테고리명(예: `기념품`)을 입력하면 전 프로젝트의 해당 카테고리 자료가 나열됩니다.

## 저장 모드

| 모드 | 조건 | 로그인 | 데이터 위치 |
|---|---|---|---|
| 프로토타입 | `config.js` 비어 있음 (기본) | `admin@wellbi.co.kr / admin1234` | 브라우저 IndexedDB — 다른 PC와 공유 안 됨 |
| **Google Drive** | `config.js` 세 값 입력 | 회사 Google 계정 | 공유 드라이브 폴더 — 전 구성원 공유 |

## Google Drive 전환 절차

### 1. Google Cloud Console (https://console.cloud.google.com)

1. 새 프로젝트 생성 (예: `wellbi-archive`)
2. **API 및 서비스 → 라이브러리** → `Google Drive API` 사용 설정
3. **OAuth 동의 화면** → 사용자 유형 **내부(Internal)** → 앱 이름 `WELLBI Archive`, 지원 이메일 입력 → 저장
   - 범위(Scopes)는 따로 추가하지 않아도 됨 (코드에서 요청)
4. **사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 유형: **웹 애플리케이션**
   - 승인된 JavaScript 원본: `http://localhost:8080`, `https://wellbibin.github.io`
   - 리디렉션 URI는 비워둠 → 생성 → **클라이언트 ID** 복사
5. **사용자 인증 정보 만들기 → API 키** → 생성 후 "키 제한":
   - 애플리케이션 제한: **HTTP 리퍼러** → 위 두 원본에 `/*` 붙여 등록
   - API 제한: **Google Drive API** 만 선택 → **API 키** 복사

### 2. Google Drive

1. 공유 드라이브(권장) 또는 내 드라이브에 `WELLBI Archive` 폴더 생성
2. 폴더 공유 → **"링크가 있는 모든 사용자 - 뷰어"** (공개 사이트가 로그인 없이 사진·PDF를 표시하기 위해 필요)
3. 업로드할 구성원들에게 폴더 **편집자** 권한 부여
4. 폴더 URL `https://drive.google.com/drive/folders/<ID>` 의 `<ID>` 복사

### 3. config.js

```js
GOOGLE_CLIENT_ID:     "xxxx.apps.googleusercontent.com",
GOOGLE_API_KEY:       "AIza...",
DRIVE_ROOT_FOLDER_ID: "1AbC...",
ALLOWED_DOMAIN:       "wellbi.kr",     // 이 도메인 계정은 첫 로그인 시 자동 구성원 등록
BOOTSTRAP_ADMIN:      "bin@wellbi.kr", // 최초 관리자
```

저장 후 `admin.html` 을 열면 Google 로그인 버튼이 나타납니다. 첫 로그인 시 `members.json` 이 자동 생성됩니다.

### 4. 호스팅

GitHub → 이 저장소 **Settings → Pages → Branch: main / (root)** → `https://wellbibin.github.io/wellbi/`
(1단계의 승인된 원본·리퍼러에 이 주소가 포함되어 있어야 함)

## Drive 폴더 구조 (자동 생성)

```
WELLBI Archive/
├ index.json                  ← 전체 프로젝트 메타 (공개 사이트는 이 파일만 읽음)
├ members.json                ← 관리자 콘솔 허용 목록
└ 2025/
   └ 국제회의·컨퍼런스/
      └ 2025 글로벌 바이오 헬스 포럼/
         ├ project.json       ← 발주처·성과·과업범위 메타 원본
         ├ 제안서/  정량서류/  기록사진/  영상/
         ├ 기념품/  공연/  디자인·시안/  기타/
         └ _thumb/            ← 자동 생성 썸네일(640px)
```

- 프로젝트 연도·분야·이름을 바꾸면 Drive 폴더도 함께 이동/이름 변경됨
- 삭제는 휴지통 이동 (Drive에서 30일 내 복구 가능)
- Drive에서 직접 파일을 옮긴 뒤에는 **관리자 → 설정 → 색인 다시 만들기**

## 프로토타입 → Drive 이관

프로토타입에서 입력한 프로젝트 정보는 **설정 → 내보내기(JSON)** 후 Drive 모드에서 **가져오기**로 옮길 수 있습니다.
단, 프로토타입에서 올린 파일(`local:` 키)은 브라우저 안에만 있으므로 Drive 모드에서 다시 업로드해야 합니다.

## 결정 사항

- 저장소: Google Drive (비용 0, 회사 계정 로그인, 원본·사이트용 이원화 불필요)
- 영상: YouTube 비공개(unlisted) 링크 권장 (Drive 업로드 영상도 미리보기 재생은 가능)
- 이미지: 업로드 시 브라우저에서 표시용 2000px + 썸네일 640px 자동 생성, 원본은 올리지 않음
- 공개 사이트는 API 키로 `index.json` 하나만 읽음 → 로그인 없이 빠르게 로드
- 권한 모델: 사이트 접근 = `members.json` 허용 목록, 실제 쓰기 권한 = Drive 폴더 공유 설정 (이중)
