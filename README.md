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
| `storage.js` | 저장 계층. 현재 IndexedDB 프로토타입 → **Google Drive 구현으로 교체 예정** |
| `data.js` | 분야/카테고리 정의 + 샘플 프로젝트 (최초 1회 DB 시딩용) |

## 탐색 구조

```
HOME (년도 타일) → 분야 타일 → 프로젝트 썸네일 → 상세
                                                  ├ 제안서 / 정량서류 / 기록사진 / 영상
                                                  └ 기념품 / 공연 / 디자인·시안 / 기타
```

검색창에 카테고리명(예: `기념품`)을 입력하면 전 프로젝트의 해당 카테고리 자료가 나열됩니다.

## 관리자

`admin.html` → 프로토타입 계정 `admin@wellbi.co.kr / admin1234`

현재는 브라우저 내부(IndexedDB)에만 저장되어 다른 PC와 공유되지 않습니다.

## 다음 단계: Google Drive 전환

회사 Google Workspace를 사용. `storage.js`의 인터페이스를 유지하면서 내부만 교체:

1. Google Cloud Console → 프로젝트 생성 → **Google Drive API** 사용 설정
2. OAuth 동의 화면 (내부용) 구성
3. OAuth 클라이언트 ID (웹 애플리케이션) 발급 → 승인된 JavaScript 원본에 사이트 주소 등록
4. 공유 드라이브에 `WELLBI Archive` 폴더 생성, 구성원 편집 권한
5. 호스팅: GitHub Pages (이 저장소 Settings → Pages → main 브랜치)

Drive 폴더 구조(예정):

```
WELLBI Archive/
└ 2025/
   └ 국제회의·컨퍼런스/
      └ 2025 글로벌 바이오 헬스 포럼/
         ├ project.json      ← 발주처·성과·과업범위 메타
         ├ 제안서/  정량서류/  기록사진/  영상/
         └ 기념품/  공연/  디자인·시안/  기타/
```

## 결정 사항

- 저장소: Google Drive (비용 0, 회사 계정 로그인, 원본·사이트용 이원화 불필요)
- 영상: YouTube 비공개(unlisted) 링크 권장
- 이미지: 업로드 시 브라우저에서 표시용 2000px + 썸네일 640px 자동 생성
