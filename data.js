/* =====================================================================
   MICE 프로젝트 아카이브 데이터
   ---------------------------------------------------------------------
   새 프로젝트를 추가하려면 PROJECTS 배열에 객체 하나를 추가하면 됩니다.
   썸네일/파일은 assets/<프로젝트id>/ 폴더에 넣고 경로를 적어주세요.

   자료(asset) 타입:
     image  - 사진, 시안, 기념품 사진 등  (src: 이미지 경로)
     video  - 영상 (src: mp4 경로 또는 YouTube URL)
     pdf    - 제안서, 정량서류 등 문서 (src: pdf 경로)
     link   - 외부 링크 (src: URL)
     note   - 현황기록 (section: "log", 파일 없음)
              { type:"note", section:"log", title, body, author:{name, dept, position, email}, createdAt }

   섹션(section) 키 → CATEGORIES 에 정의된 것만 사용
   ===================================================================== */

const FIELDS = [
  { id: "conference", label: "국제회의·컨퍼런스" },
  { id: "exhibition", label: "전시·박람회" },
  { id: "festival",   label: "축제·문화행사" },
  { id: "corporate",  label: "기업행사·시상식" },
  { id: "incentive",  label: "인센티브·투어" },
  { id: "public",     label: "공공·기념식" },
  { id: "marketing",  label: "마케팅·홍보" },
  { id: "brand",      label: "브랜드·디자인" },
];

const CATEGORIES = [
  { id: "proposal",    label: "제안서",     icon: "📄" },
  { id: "quantity",    label: "정량서류",   icon: "📊" },
  { id: "report",      label: "결과보고서", icon: "📑" },
  { id: "photo",       label: "대표사진",   icon: "📷" },
  { id: "video",       label: "영상",       icon: "🎬" },
  { id: "souvenir",    label: "기념품",     icon: "🎁" },
  { id: "performance", label: "공연",       icon: "🎭" },
  { id: "design",      label: "디자인·시안", icon: "🎨" },
  { id: "etc",         label: "기타",       icon: "📁" },
  // 파일이 아닌 텍스트 기록. 진행 중 느낀 상황·이슈·교훈을 이름/소속/직책과 함께 남김
  { id: "log",         label: "현황기록",   icon: "📝", kind: "note" },
];

// 진행률 계산에 포함되는 "필수" 카테고리 (현황기록·기타는 선택이라 제외)
const REQUIRED_CATEGORIES = ["proposal", "quantity", "report", "photo", "video", "souvenir", "performance", "design"];

// 썸네일이 아직 없을 때 사용하는 플레이스홀더 생성기 (실제 운영 시 실제 이미지 경로로 교체)
const ph = (text, bg = "1e293b", fg = "e2e8f0", w = 800, h = 500) =>
  `https://placehold.co/${w}x${h}/${bg}/${fg}?text=${encodeURIComponent(text)}`;

const PROJECTS = [
  {
    id: "2025-global-bio-forum",
    title: "2025 글로벌 바이오 헬스 포럼",
    year: 2025,
    field: "conference",
    client: "보건복지부 · 한국보건산업진흥원",
    period: "2025.09.10 ~ 09.12",
    venue: "코엑스 오디토리움 & 컨퍼런스룸 (서울)",
    thumbnail: ph("2025 Global Bio Health Forum", "0f4c81", "ffffff"),
    summary: "국내외 바이오헬스 산업 리더 1,200명이 참가한 3일간의 국제포럼. 기조연설·트랙세션·비즈니스 매칭·네트워킹 갈라 디너를 통합 운영.",
    stats: [
      { label: "참가자", value: "1,200명" },
      { label: "참가국", value: "23개국" },
      { label: "세션", value: "38개" },
      { label: "예산", value: "9.8억" },
    ],
    scope: ["기획·총괄 운영", "연사 초청·의전", "전시부스 42개", "동시통역 4개국어", "갈라디너 · 공연", "온라인 하이브리드 송출"],
    tags: ["하이브리드", "국제포럼", "동시통역", "갈라디너"],
    assets: [
      { section: "proposal", type: "pdf", title: "기술제안서 (본문)", desc: "총 86p · 운영·연출·홍보 종합 제안", thumb: ph("Proposal PDF", "334155"), src: "assets/2025-global-bio-forum/proposal.pdf" },
      { section: "proposal", type: "pdf", title: "제안 발표자료 (PPT)", desc: "PT 심사용 요약본 32p", thumb: ph("Presentation", "334155"), src: "assets/2025-global-bio-forum/proposal-pt.pdf" },
      { section: "quantity", type: "pdf", title: "산출내역서", desc: "항목별 원가 · 인력 · 장비 산출", thumb: ph("Cost Sheet", "3f6212"), src: "assets/2025-global-bio-forum/quantity.pdf" },
      { section: "report", type: "pdf", title: "결과보고서", desc: "참가 통계 · 만족도 조사 · 언론보도 집계", thumb: ph("Final Report", "3f6212"), src: "assets/2025-global-bio-forum/report.pdf" },
      { section: "photo", type: "image", title: "개막식 무대", desc: "메인 오디토리움 개막 세레모니", thumb: ph("Opening Ceremony", "1e3a5f"), src: ph("Opening Ceremony", "1e3a5f", "ffffff", 1600, 1000) },
      { section: "photo", type: "image", title: "기조연설", desc: "노벨생리의학상 수상자 기조강연", thumb: ph("Keynote", "1e3a5f"), src: ph("Keynote", "1e3a5f", "ffffff", 1600, 1000) },
      { section: "photo", type: "image", title: "전시부스 전경", desc: "42개 기업 참여 전시홀", thumb: ph("Exhibition Hall", "1e3a5f"), src: ph("Exhibition Hall", "1e3a5f", "ffffff", 1600, 1000) },
      { section: "photo", type: "image", title: "네트워킹 리셉션", desc: "그랜드볼룸 웰컴 리셉션", thumb: ph("Reception", "1e3a5f"), src: ph("Reception", "1e3a5f", "ffffff", 1600, 1000) },
      { section: "photo", type: "image", title: "비즈니스 매칭", desc: "1:1 상담 총 316건 진행", thumb: ph("B2B Matching", "1e3a5f"), src: ph("B2B Matching", "1e3a5f", "ffffff", 1600, 1000) },
      { section: "photo", type: "image", title: "폐막 단체사진", desc: "조직위 · 연사 · 스태프", thumb: ph("Closing", "1e3a5f"), src: ph("Closing", "1e3a5f", "ffffff", 1600, 1000) },
      { section: "video", type: "video", title: "하이라이트 영상", desc: "3분 스케치 영상", thumb: ph("Highlight Video", "7c2d12"), src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      { section: "video", type: "video", title: "오프닝 타이틀 영상", desc: "개막 카운트다운 · 미디어아트", thumb: ph("Opening Title", "7c2d12"), src: "assets/2025-global-bio-forum/opening.mp4" },
      { section: "souvenir", type: "image", title: "웰컴키트", desc: "친환경 텀블러 · 노트 · 랜야드 세트", thumb: ph("Welcome Kit", "5b21b6"), src: ph("Welcome Kit", "5b21b6", "ffffff", 1600, 1000) },
      { section: "souvenir", type: "image", title: "VIP 기념패", desc: "크리스탈 감사패 (연사용 30개)", thumb: ph("VIP Plaque", "5b21b6"), src: ph("VIP Plaque", "5b21b6", "ffffff", 1600, 1000) },
      { section: "performance", type: "image", title: "개막 퍼포먼스", desc: "국악 X 미디어아트 융합공연 (12분)", thumb: ph("Opening Performance", "9f1239"), src: ph("Opening Performance", "9f1239", "ffffff", 1600, 1000) },
      { section: "performance", type: "video", title: "갈라디너 공연", desc: "재즈 트리오 · 성악 앙상블", thumb: ph("Gala Performance", "9f1239"), src: "assets/2025-global-bio-forum/gala.mp4" },
      { section: "design", type: "image", title: "메인 키비주얼", desc: "포스터 · 배너 · 웹 공통 적용", thumb: ph("Key Visual", "0f4c81"), src: ph("Key Visual", "0f4c81", "ffffff", 1600, 1000) },
      { section: "design", type: "image", title: "무대 디자인 3D", desc: "LED 폭 24m 메인 스테이지 렌더링", thumb: ph("Stage 3D", "0f4c81"), src: ph("Stage 3D", "0f4c81", "ffffff", 1600, 1000) },
      { section: "etc", type: "link", title: "행사 공식 홈페이지", desc: "사전등록 · 프로그램 안내 사이트", thumb: ph("Website", "475569"), src: "https://example.com" },
      { section: "etc", type: "pdf", title: "언론보도 스크랩", desc: "주요 매체 보도 27건", thumb: ph("Press", "475569"), src: "assets/2025-global-bio-forum/press.pdf" },
      { section: "log", type: "note", title: "동시통역 부스 전력 이슈", body: "D-1 리허설 중 통역부스 4개 중 2개 전원이 불안정. 현장 전기팀과 협의해 별도 분전반에서 전용 라인 추가. 다음 행사부터는 통역부스 전원은 사전 체크리스트에 '전용 회로 확보' 항목을 넣기로 함.", author: { name: "김민수", dept: "운영1팀", position: "과장", email: "" }, createdAt: Date.parse("2025-09-09T18:40:00") },
      { section: "log", type: "note", title: "발주처 피드백", body: "갈라디너 공연 구성(국악 X 미디어아트)에 대해 발주처 담당관이 매우 만족. 내년 포럼에서도 유사 콘셉트 제안 요청 받음. 영업 자료로 활용 가능.", author: { name: "이서연", dept: "기획2팀", position: "대리", email: "" }, createdAt: Date.parse("2025-09-12T21:10:00") },
    ],
  },

  {
    id: "2025-smart-mobility-expo",
    title: "2025 스마트 모빌리티 엑스포",
    year: 2025,
    field: "exhibition",
    client: "OO광역시 · 한국자동차산업협회",
    period: "2025.05.22 ~ 05.25",
    venue: "킨텍스 제1전시장 3~5홀",
    thumbnail: ph("Smart Mobility Expo 2025", "155e75", "ffffff"),
    summary: "미래 모빌리티 기술 전시회. 완성차·부품·자율주행·UAM 분야 210개사 참가, 야외 시승 체험존과 컨퍼런스를 병행 운영.",
    stats: [
      { label: "참가기업", value: "210개사" },
      { label: "관람객", value: "48,000명" },
      { label: "전시면적", value: "27,000㎡" },
      { label: "예산", value: "14.2억" },
    ],
    scope: ["전시 기획·부스 설계", "참가기업 유치", "야외 시승 체험존", "개막식 · 컨퍼런스", "관람객 모집 홍보"],
    tags: ["전시", "체험존", "B2B", "야외행사"],
    assets: [
      { section: "proposal", type: "pdf", title: "전시 운영 제안서", desc: "112p 종합 제안", thumb: ph("Proposal", "334155"), src: "#" },
      { section: "quantity", type: "pdf", title: "부스 배치도·산출서", desc: "홀별 부스 배치 및 시설 산출", thumb: ph("Floor Plan", "3f6212"), src: "#" },
      { section: "photo", type: "image", title: "전시장 전경", desc: "3홀 메인 게이트", thumb: ph("Expo Hall", "164e63"), src: ph("Expo Hall", "164e63", "ffffff", 1600, 1000) },
      { section: "photo", type: "image", title: "시승 체험존", desc: "야외 자율주행 시승 트랙", thumb: ph("Test Drive", "164e63"), src: ph("Test Drive", "164e63", "ffffff", 1600, 1000) },
      { section: "photo", type: "image", title: "UAM 전시", desc: "도심항공모빌리티 실물 전시", thumb: ph("UAM", "164e63"), src: ph("UAM", "164e63", "ffffff", 1600, 1000) },
      { section: "video", type: "video", title: "스케치 영상", desc: "4일간 하이라이트", thumb: ph("Sketch", "7c2d12"), src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      { section: "souvenir", type: "image", title: "관람객 굿즈", desc: "에코백 · 스티커 · 미니카", thumb: ph("Goods", "5b21b6"), src: ph("Goods", "5b21b6", "ffffff", 1600, 1000) },
      { section: "performance", type: "image", title: "개막 드론쇼", desc: "드론 300대 야외 개막쇼", thumb: ph("Drone Show", "9f1239"), src: ph("Drone Show", "9f1239", "ffffff", 1600, 1000) },
      { section: "design", type: "image", title: "메인 시안", desc: "키비주얼 · 사이니지 시스템", thumb: ph("Key Visual", "155e75"), src: ph("Key Visual", "155e75", "ffffff", 1600, 1000) },
    ],
  },

  {
    id: "2024-river-light-festival",
    title: "2024 강변 빛 축제",
    year: 2024,
    field: "festival",
    client: "OO시 문화관광재단",
    period: "2024.10.18 ~ 10.27",
    venue: "OO강 수변공원 일대",
    thumbnail: ph("River Light Festival 2024", "4a1d96", "ffffff"),
    summary: "10일간 진행된 도심 야간 빛 축제. 미디어파사드·빛 조형물 32점·수상 공연·푸드존을 운영해 누적 방문객 62만 명 달성.",
    stats: [
      { label: "방문객", value: "620,000명" },
      { label: "설치작품", value: "32점" },
      { label: "공연", value: "24회" },
      { label: "기간", value: "10일" },
    ],
    scope: ["축제 총괄 기획", "빛 조형물 제작·설치", "미디어파사드 콘텐츠", "수상 무대 공연", "안전관리 · 교통통제"],
    tags: ["야간축제", "미디어아트", "공연", "대규모"],
    assets: [
      { section: "proposal", type: "pdf", title: "축제 기획 제안서", desc: "94p", thumb: ph("Proposal", "334155"), src: "#" },
      { section: "report", type: "pdf", title: "결과보고서", desc: "방문객 · 경제효과 분석", thumb: ph("Report", "3f6212"), src: "#" },
      { section: "photo", type: "image", title: "메인 조형물", desc: "높이 18m 빛의 나무", thumb: ph("Light Tree", "3b0764"), src: ph("Light Tree", "3b0764", "ffffff", 1600, 1000) },
      { section: "photo", type: "image", title: "미디어파사드", desc: "교량 하부 미디어파사드", thumb: ph("Media Facade", "3b0764"), src: ph("Media Facade", "3b0764", "ffffff", 1600, 1000) },
      { section: "photo", type: "image", title: "수상 무대", desc: "플로팅 스테이지 공연", thumb: ph("Floating Stage", "3b0764"), src: ph("Floating Stage", "3b0764", "ffffff", 1600, 1000) },
      { section: "video", type: "video", title: "공식 홍보영상", desc: "60초 TVC", thumb: ph("Promo", "7c2d12"), src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      { section: "souvenir", type: "image", title: "LED 응원봉", desc: "관람객 참여형 연동 응원봉", thumb: ph("LED Stick", "5b21b6"), src: ph("LED Stick", "5b21b6", "ffffff", 1600, 1000) },
      { section: "performance", type: "video", title: "개막 불꽃·레이저쇼", desc: "12분 뮤직 시퀀스", thumb: ph("Fireworks", "9f1239"), src: "#" },
      { section: "design", type: "image", title: "메인 포스터", desc: "", thumb: ph("Poster", "4a1d96"), src: ph("Poster", "4a1d96", "ffffff", 1200, 1600) },
    ],
  },

  {
    id: "2024-ceo-summit-awards",
    title: "2024 그룹 CEO 서밋 & 시상식",
    year: 2024,
    field: "corporate",
    client: "OO그룹 홀딩스",
    period: "2024.12.05",
    venue: "그랜드 하얏트 서울 그랜드볼룸",
    thumbnail: ph("CEO Summit & Awards 2024", "78350f", "ffffff"),
    summary: "그룹 계열사 임원 600명 대상 연말 서밋. 비전 선포식·우수사원 시상·갈라디너를 원데이로 구성. 풀 LED 무대와 XR 연출 적용.",
    stats: [
      { label: "참석", value: "600명" },
      { label: "시상", value: "42팀" },
      { label: "LED", value: "36m" },
      { label: "예산", value: "4.5억" },
    ],
    scope: ["행사 기획·연출", "XR 무대 · 영상", "시상 트로피 제작", "만찬 · 공연", "사전 리허설 운영"],
    tags: ["기업행사", "시상식", "XR", "갈라디너"],
    assets: [
      { section: "proposal", type: "pdf", title: "연출 제안서", desc: "48p", thumb: ph("Proposal", "334155"), src: "#" },
      { section: "quantity", type: "pdf", title: "견적서", desc: "항목별 상세 견적", thumb: ph("Estimate", "3f6212"), src: "#" },
      { section: "photo", type: "image", title: "메인 무대", desc: "커브드 LED 36m", thumb: ph("Main Stage", "451a03"), src: ph("Main Stage", "451a03", "ffffff", 1600, 1000) },
      { section: "photo", type: "image", title: "시상 순간", desc: "대상 수상팀", thumb: ph("Awards", "451a03"), src: ph("Awards", "451a03", "ffffff", 1600, 1000) },
      { section: "video", type: "video", title: "비전 선포 영상", desc: "XR 연출 3D 오프닝", thumb: ph("Vision Film", "7c2d12"), src: "#" },
      { section: "souvenir", type: "image", title: "트로피 · 기념패", desc: "맞춤 제작 크리스탈 트로피", thumb: ph("Trophy", "5b21b6"), src: ph("Trophy", "5b21b6", "ffffff", 1600, 1000) },
      { section: "performance", type: "image", title: "갈라 공연", desc: "오케스트라 X 팝 콜라보", thumb: ph("Gala", "9f1239"), src: ph("Gala", "9f1239", "ffffff", 1600, 1000) },
      { section: "design", type: "image", title: "무대 시안", desc: "", thumb: ph("Stage Design", "78350f"), src: ph("Stage Design", "78350f", "ffffff", 1600, 1000) },
    ],
  },

  {
    id: "2023-asia-tourism-conference",
    title: "2023 아시아 관광 협력 컨퍼런스",
    year: 2023,
    field: "conference",
    client: "문화체육관광부 · 한국관광공사",
    period: "2023.11.08 ~ 11.10",
    venue: "부산 벡스코 컨벤션홀",
    thumbnail: ph("Asia Tourism Conference 2023", "065f46", "ffffff"),
    summary: "아시아 18개국 관광 정책담당자·업계가 참여한 국제 컨퍼런스. 장관급 라운드테이블과 테크니컬 투어 운영.",
    stats: [
      { label: "참가자", value: "850명" },
      { label: "참가국", value: "18개국" },
      { label: "세션", value: "22개" },
      { label: "예산", value: "6.3억" },
    ],
    scope: ["컨퍼런스 운영", "장관급 의전", "테크니컬 투어", "만찬 · 전통공연"],
    tags: ["국제회의", "의전", "투어"],
    assets: [
      { section: "proposal", type: "pdf", title: "운영 제안서", desc: "", thumb: ph("Proposal", "334155"), src: "#" },
      { section: "report", type: "pdf", title: "결과보고서", desc: "", thumb: ph("Report", "3f6212"), src: "#" },
      { section: "photo", type: "image", title: "라운드테이블", desc: "장관급 원탁회의", thumb: ph("Round Table", "064e3b"), src: ph("Round Table", "064e3b", "ffffff", 1600, 1000) },
      { section: "photo", type: "image", title: "테크니컬 투어", desc: "부산 관광지 현장 방문", thumb: ph("Tech Tour", "064e3b"), src: ph("Tech Tour", "064e3b", "ffffff", 1600, 1000) },
      { section: "video", type: "video", title: "스케치 영상", desc: "", thumb: ph("Sketch", "7c2d12"), src: "#" },
      { section: "souvenir", type: "image", title: "전통 공예 기념품", desc: "나전칠기 명함케이스", thumb: ph("Souvenir", "5b21b6"), src: ph("Souvenir", "5b21b6", "ffffff", 1600, 1000) },
      { section: "performance", type: "image", title: "만찬 전통공연", desc: "부채춤 · 사물놀이", thumb: ph("Traditional", "9f1239"), src: ph("Traditional", "9f1239", "ffffff", 1600, 1000) },
    ],
  },

  {
    id: "2023-startup-incentive-tour",
    title: "2023 글로벌 파트너 인센티브 투어",
    year: 2023,
    field: "incentive",
    client: "OO전자 글로벌마케팅본부",
    period: "2023.04.17 ~ 04.21",
    venue: "제주 · 서울 (4박 5일)",
    thumbnail: ph("Global Partner Incentive 2023", "9a3412", "ffffff"),
    summary: "해외 우수 파트너사 180명 초청 인센티브 투어. 제주 리조트 팀빌딩·서울 시티투어·어워즈 디너까지 5일 일정 총괄.",
    stats: [
      { label: "초청", value: "180명" },
      { label: "국가", value: "14개국" },
      { label: "일정", value: "4박 5일" },
      { label: "예산", value: "5.1억" },
    ],
    scope: ["항공 · 숙박 수배", "팀빌딩 프로그램", "시티투어 · 문화체험", "어워즈 디너"],
    tags: ["인센티브", "투어", "팀빌딩"],
    assets: [
      { section: "proposal", type: "pdf", title: "투어 기획 제안서", desc: "", thumb: ph("Proposal", "334155"), src: "#" },
      { section: "photo", type: "image", title: "팀빌딩", desc: "제주 해변 팀빌딩", thumb: ph("Team Building", "7c2d12"), src: ph("Team Building", "7c2d12", "ffffff", 1600, 1000) },
      { section: "photo", type: "image", title: "어워즈 디너", desc: "", thumb: ph("Awards Dinner", "7c2d12"), src: ph("Awards Dinner", "7c2d12", "ffffff", 1600, 1000) },
      { section: "video", type: "video", title: "투어 영상", desc: "", thumb: ph("Tour Film", "7c2d12"), src: "#" },
      { section: "souvenir", type: "image", title: "웰컴 기프트", desc: "한국 전통 다기 세트", thumb: ph("Gift", "5b21b6"), src: ph("Gift", "5b21b6", "ffffff", 1600, 1000) },
    ],
  },

  {
    id: "2022-city-anniversary",
    title: "OO시 승격 30주년 기념식",
    year: 2022,
    field: "public",
    client: "OO시청",
    period: "2022.07.01",
    venue: "OO시민광장 야외무대",
    thumbnail: ph("City 30th Anniversary 2022", "1e3a8a", "ffffff"),
    summary: "시 승격 30주년 기념식 및 시민 축하공연. 야외 무대 · 시민 참여 퍼포먼스 · 기념 조형물 제막식 운영.",
    stats: [
      { label: "참석", value: "5,000명" },
      { label: "공연", value: "8팀" },
      { label: "예산", value: "2.8억" },
    ],
    scope: ["기념식 기획·운영", "야외 무대 · 음향", "시민 참여 퍼포먼스", "기념 조형물 제막"],
    tags: ["공공행사", "기념식", "야외"],
    assets: [
      { section: "proposal", type: "pdf", title: "기념식 제안서", desc: "", thumb: ph("Proposal", "334155"), src: "#" },
      { section: "photo", type: "image", title: "기념식 무대", desc: "", thumb: ph("Ceremony", "172554"), src: ph("Ceremony", "172554", "ffffff", 1600, 1000) },
      { section: "photo", type: "image", title: "제막식", desc: "기념 조형물 제막", thumb: ph("Unveiling", "172554"), src: ph("Unveiling", "172554", "ffffff", 1600, 1000) },
      { section: "performance", type: "image", title: "시민 합창", desc: "300명 시민 합창단", thumb: ph("Choir", "9f1239"), src: ph("Choir", "9f1239", "ffffff", 1600, 1000) },
      { section: "souvenir", type: "image", title: "기념 메달", desc: "30주년 기념 메달", thumb: ph("Medal", "5b21b6"), src: ph("Medal", "5b21b6", "ffffff", 1600, 1000) },
    ],
  },
];
