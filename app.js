/* =====================================================================
   WELLBI Archive - App (해시 라우팅 기반 SPA)
   ---------------------------------------------------------------------
   드릴다운 구조: 년도 → 분야 → 프로젝트 → 상세

   #/                                → 1단계: 년도 보드 (연도 + 프로젝트 수)
   #/year/<year>                     → 2단계: 분야 보드 (분야명 + 프로젝트 수)
   #/year/<year>/field/<field>       → 3단계: 프로젝트 썸네일 그리드
   #/search                          → 검색 결과 (프로젝트 / 카테고리 자료)
   #/project/<id>                    → 프로젝트 상세
   ===================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const app = $("#app");
const searchInput = $("#searchInput");

const fieldLabel = (id) => (FIELDS.find((f) => f.id === id) || {}).label || id;
const catById = (id) => CATEGORIES.find((c) => c.id === id) || { id, label: id, icon: "📁" };
const esc = (s = "") => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

// Store(IndexedDB → 추후 Google Drive)에서 로드한 공개 프로젝트 목록. 로드 전에는 data.js 샘플 사용
let DATA = typeof PROJECTS !== "undefined" ? PROJECTS : [];
async function loadData() {
  try {
    await Store.init();
    DATA = (await Store.getProjects()).filter((p) => !p.hidden);
  } catch (e) {
    console.warn("Store 로드 실패, data.js 샘플 사용", e);
  }
}

// 정렬: 최신 연도 → 제목순
const sortedProjects = () => [...DATA].sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, "ko"));

// 썸네일/파일 키(local:...)를 실제 URL로 해석 — 렌더 후 호출
async function hydrateImgs(root = app) {
  for (const img of root.querySelectorAll("img[data-src]")) {
    img.src = (await Store.resolveUrl(img.dataset.src)) || "";
    img.removeAttribute("data-src");
  }
}

/* ---------- 검색 ---------- */
let query = "";
const matches = (p) => {
  if (!query) return true;
  const q = query.toLowerCase();
  const hay = [p.title, p.client, p.venue, p.summary, fieldLabel(p.field), String(p.year), ...(p.tags || []), ...(p.scope || [])]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
};
// 검색어가 카테고리명(기념품, 영상, 제안서...)과 일치하면 해당 카테고리 반환
const matchCategory = (q) => {
  const s = q.replace(/\s/g, "").toLowerCase();
  if (!s) return null;
  return (
    CATEGORIES.find((c) => {
      const label = c.label.replace(/\s/g, "").toLowerCase();
      // "기념품" === "기념품", "사진" ⊂ "기록사진", "디자인" ⊂ "디자인·시안", 영문 id도 허용
      return label === s || label.includes(s) || c.id === s || label.split(/[·/]/).some((part) => part === s);
    }) || null
  );
};

searchInput.addEventListener("input", (e) => {
  query = e.target.value.trim();
  if (query) {
    if (location.hash !== "#/search") location.hash = "#/search";
    else render();
  } else if (location.hash === "#/search") {
    location.hash = "#/";
  }
});

/* ---------- 컴포넌트 ---------- */
function projectCard(p) {
  const counts = {};
  p.assets.forEach((a) => (counts[a.section] = (counts[a.section] || 0) + 1));
  const chips = ["photo", "video", "proposal"]
    .filter((k) => counts[k])
    .map((k) => `<span class="mini">${catById(k).icon} <b>${counts[k]}</b></span>`)
    .join("");
  const stat = p.stats && p.stats[0] ? `<span class="mini">${esc(p.stats[0].label)} <b>${esc(p.stats[0].value)}</b></span>` : "";
  return `
    <a class="pcard" href="#/project/${p.id}">
      <div class="pcard-thumb">
        <img data-src="${p.thumbnail}" alt="${esc(p.title)}" loading="lazy">
        <span class="pcard-year">${p.year}</span>
        <span class="pcard-field">${esc(fieldLabel(p.field))}</span>
      </div>
      <div class="pcard-body">
        <h3 class="pcard-title">${esc(p.title)}</h3>
        <div class="pcard-client">${esc(p.client)} · ${esc(p.period)}</div>
        <div class="pcard-meta">${stat}${chips}</div>
      </div>
    </a>`;
}

function grid(list) {
  if (!list.length) return `<div class="empty">조건에 맞는 프로젝트가 없습니다.</div>`;
  return `<div class="grid">${list.map(projectCard).join("")}</div>`;
}

function pageHead(title, sub, chipsHtml = "") {
  return `
    <div class="page-head">
      <div><h1 class="page-title">${title}</h1><p class="page-sub">${sub}</p></div>
      ${chipsHtml ? `<div class="chips">${chipsHtml}</div>` : ""}
    </div>`;
}

// 브레드크럼: [{label, href}] 마지막 항목은 현재 위치
function crumbs(items) {
  return `<nav class="crumbs">${items
    .map((c, i) => (i === items.length - 1 || !c.href ? `<span class="cur">${c.label}</span>` : `<a href="${c.href}">${c.label}</a>`))
    .join(`<span class="sep">›</span>`)}</nav>`;
}

// 텍스트 보드 타일 (년도 / 분야 공용): 큰 워딩 + 프로젝트 수
function boardTile(href, label, count, sub = "") {
  return `
    <a class="tile" href="${href}">
      <div class="tile-label">${esc(label)}</div>
      <div class="tile-count"><b>${count}</b><span>projects</span></div>
      ${sub ? `<div class="tile-sub">${sub}</div>` : ""}
    </a>`;
}

/* ---------- 1단계: 년도 보드 ---------- */
function viewYears() {
  const all = sortedProjects();
  const years = [...new Set(all.map((p) => p.year))];

  const tiles = years
    .map((y) => {
      const items = all.filter((p) => p.year === y);
      return boardTile(`#/year/${y}`, String(y), items.length);
    })
    .join("");

  app.innerHTML =
    pageHead("WELLBI Archive", `연도를 선택하세요 · 총 ${all.length}개 프로젝트`) +
    `<div class="board">${tiles}</div>`;
}

/* ---------- 2단계: 분야 보드 (연도 내) ---------- */
function viewFields(year) {
  const y = Number(year);
  const items = sortedProjects().filter((p) => p.year === y);
  if (!items.length) {
    app.innerHTML = crumbs([{ label: "HOME", href: "#/" }, { label: year }]) + `<div class="empty">${esc(year)}년 프로젝트가 없습니다.</div>`;
    return;
  }
  const groups = FIELDS.map((f) => ({ f, items: items.filter((p) => p.field === f.id) })).filter((g) => g.items.length);

  const tiles = groups.map(({ f, items }) => boardTile(`#/year/${y}/field/${f.id}`, f.label, items.length)).join("");

  app.innerHTML =
    crumbs([{ label: "HOME", href: "#/" }, { label: `${y}` }]) +
    pageHead(`${y}`, `분야를 선택하세요 · ${items.length}개 프로젝트 · ${groups.length}개 분야`) +
    `<div class="board board-field">${tiles}</div>`;
}

/* ---------- 3단계: 프로젝트 썸네일 (연도 + 분야) ---------- */
function viewProjectsIn(year, field) {
  const y = Number(year);
  const items = sortedProjects().filter((p) => p.year === y && p.field === field);
  // 같은 연도의 다른 분야로 바로 이동할 수 있는 칩
  const siblings = FIELDS.filter((f) => DATA.some((p) => p.year === y && p.field === f.id));
  const chips = siblings
    .map((f) => `<a class="chip ${f.id === field ? "active" : ""}" href="#/year/${y}/field/${f.id}">${esc(f.label)}</a>`)
    .join("");

  app.innerHTML =
    crumbs([{ label: "HOME", href: "#/" }, { label: `${y}`, href: `#/year/${y}` }, { label: fieldLabel(field) }]) +
    pageHead(`${y} · ${esc(fieldLabel(field))}`, `${items.length}개 프로젝트 · 썸네일을 클릭하면 과업 세부내용을 볼 수 있습니다`, chips) +
    grid(items);
}

/* ---------- 검색 결과 ---------- */
// 카테고리 검색: 모든 프로젝트의 해당 카테고리 자료를 모아서 나열 (프로젝트별 그룹)
function viewCategorySearch(cat) {
  const list = sortedProjects().filter((p) => p.assets.some((a) => a.section === cat.id));

  // 현황기록은 타임라인으로 (최신순, 프로젝트 링크 포함)
  if (cat.kind === "note") {
    const logs = list
      .flatMap((p) => p.assets.filter((a) => a.section === cat.id).map((a) => ({ a, p })))
      .sort((x, y) => (y.a.createdAt || 0) - (x.a.createdAt || 0));
    app.innerHTML =
      crumbs([{ label: "HOME", href: "#/" }, { label: "검색" }]) +
      pageHead(`${cat.icon} ${esc(cat.label)}`, `전체 프로젝트 · ${logs.length}건 기록`) +
      (logs.length ? `<div class="log-list">${logs.map(({ a, p }) => logCard(a, p)).join("")}</div>` : `<div class="empty">아직 현황기록이 없습니다.</div>`);
    return;
  }
  currentAssets = list.flatMap((p) => p.assets.filter((a) => a.section === cat.id).map((a) => ({ ...a, _project: p })));

  let idx = 0;
  const sections = list
    .map((p) => {
      const items = currentAssets.filter((a) => a._project === p);
      const cards = items.map((a) => assetCard(a, idx++)).join("");
      return `
        <section class="section">
          <div class="section-head">
            <h3><a href="#/project/${p.id}" class="section-link">${esc(p.title)}</a></h3>
            <span>${p.year} · ${esc(fieldLabel(p.field))} · ${items.length}건</span>
          </div>
          <div class="agrid">${cards}</div>
        </section>`;
    })
    .join("");

  app.innerHTML =
    crumbs([{ label: "HOME", href: "#/" }, { label: "검색" }]) +
    pageHead(`${cat.icon} ${esc(cat.label)}`, `카테고리 검색 · ${list.length}개 프로젝트 · ${currentAssets.length}건 자료`) +
    (sections || `<div class="empty">해당 카테고리 자료가 없습니다.</div>`);

  app.querySelectorAll(".acard").forEach((b) => b.addEventListener("click", () => openLightbox(Number(b.dataset.idx))));
}

function viewSearch() {
  if (!query) {
    location.hash = "#/";
    return;
  }
  const cat = matchCategory(query);
  if (cat) return viewCategorySearch(cat);

  const list = sortedProjects().filter(matches);
  app.innerHTML =
    crumbs([{ label: "HOME", href: "#/" }, { label: "검색" }]) +
    pageHead("검색 결과", `"${esc(query)}" · ${list.length}개 프로젝트`) +
    grid(list);
}

/* ---------- 뷰: 프로젝트 상세 ---------- */
let currentAssets = []; // 라이트박스 순회용

function assetCard(a, idx) {
  const isVideo = a.type === "video";
  return `
    <button class="acard" data-idx="${idx}">
      <div class="acard-thumb">
        <img data-src="${a.thumb}" alt="${esc(a.title)}" loading="lazy">
        ${isVideo ? `<span class="acard-play"></span>` : ""}
        <span class="acard-type">${a.type}</span>
      </div>
      <div class="acard-body">
        <p class="acard-title">${esc(a.title)}</p>
        ${a.desc ? `<p class="acard-desc">${esc(a.desc)}</p>` : ""}
      </div>
    </button>`;
}

// 현황기록(note) 타임라인 카드
function logCard(a, project) {
  const who = [a.author?.dept, a.author?.position].filter(Boolean).map(esc).join(" · ");
  return `
    <article class="log">
      <div class="log-h">
        <b>${esc(a.author?.name || "")}</b>${who ? `<span>${who}</span>` : ""}
        <time>${a.createdAt ? new Date(a.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : ""}</time>
      </div>
      ${project ? `<div class="log-p"><a href="#/project/${project.id}">${esc(project.title)}</a></div>` : ""}
      ${a.title ? `<div class="log-t">${esc(a.title)}</div>` : ""}
      <div class="log-b">${esc(a.body || "")}</div>
    </article>`;
}

// 성과 수치 값 — "[대전] 2,392명 / [전남광주] 2,015명" 처럼 "/" 로 병기된 값은 항목별로 줄바꿈
function statValue(v) {
  const parts = String(v || "").split(/\s*\/\s*/).filter(Boolean);
  if (parts.length < 2) return esc(v || "");
  return parts.map(esc).join('<span class="sep">/</span><br>');
}

function viewProject(id) {
  const p = DATA.find((x) => x.id === id);
  if (!p) {
    app.innerHTML = crumbs([{ label: "HOME", href: "#/" }, { label: "알 수 없음" }]) + `<div class="empty">프로젝트를 찾을 수 없습니다.</div>`;
    return;
  }

  // 섹션별 그룹핑 (CATEGORIES 순서 유지, 자료 있는 것만)
  const sections = CATEGORIES.map((c) => ({ c, items: p.assets.filter((a) => a.section === c.id) })).filter((s) => s.items.length);
  // 라이트박스 순회 대상은 파일 자료만 (현황기록 제외)
  currentAssets = sections.filter((s) => s.c.kind !== "note").flatMap((s) => s.items);

  let idx = 0;
  const sectionsHtml = sections
    .map(({ c, items }) => {
      if (c.kind === "note") {
        const logs = [...items].sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0));
        return `
        <section class="section" id="sec-${c.id}">
          <div class="section-head"><h3>${c.icon} ${esc(c.label)}</h3><span>${items.length}건 · 진행 중 남긴 상황 기록</span></div>
          <div class="log-list">${logs.map((a) => logCard(a)).join("")}</div>
        </section>`;
      }
      const cards = items.map((a) => assetCard(a, idx++)).join("");
      return `
        <section class="section" id="sec-${c.id}">
          <div class="section-head"><h3>${c.icon} ${esc(c.label)}</h3><span>${items.length}건</span></div>
          <div class="agrid">${cards}</div>
        </section>`;
    })
    .join("");

  const tabs =
    `<button class="tab active" data-target="top">전체<span class="cnt">${sections.reduce((n, s) => n + s.items.length, 0)}</span></button>` +
    sections.map(({ c, items }) => `<button class="tab" data-target="sec-${c.id}">${c.icon} ${esc(c.label)}<span class="cnt">${items.length}</span></button>`).join("");

  app.innerHTML = `
    ${crumbs([
      { label: "HOME", href: "#/" },
      { label: `${p.year}`, href: `#/year/${p.year}` },
      { label: fieldLabel(p.field), href: `#/year/${p.year}/field/${p.field}` },
      { label: p.title },
    ])}
    <div class="hero" id="top">
      <div class="hero-img"><img data-src="${p.thumbnail}" alt="${esc(p.title)}"></div>
      <div class="hero-body">
        <div class="hero-badges"><span class="badge">${p.year}</span><span class="badge accent">${esc(fieldLabel(p.field))}</span></div>
        <h1>${esc(p.title)}</h1>
        <p class="hero-summary">${esc(p.summary)}</p>
        <dl class="kv">
          <dt>발주처</dt><dd>${esc(p.client)}</dd>
          <dt>기간</dt><dd>${esc(p.period)}</dd>
          <dt>장소</dt><dd>${esc(p.venue)}</dd>
        </dl>
        ${p.stats?.length ? `<div class="stats">${p.stats.map((s) => `<div class="stat${String(s.value || "").length > 14 ? " long" : ""}"><div class="v">${statValue(s.value)}</div><div class="l">${esc(s.label)}</div></div>`).join("")}</div>` : ""}
        ${p.scope?.length ? `<div class="scope">${p.scope.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : ""}
      </div>
    </div>
    <div class="tabs">${tabs}</div>
    ${sectionsHtml || `<div class="empty">등록된 자료가 없습니다.</div>`}
  `;

  // 탭 → 스크롤
  app.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      app.querySelectorAll(".tab").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      const el = document.getElementById(t.dataset.target);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );

  // 자료 카드 → 라이트박스
  app.querySelectorAll(".acard").forEach((b) => b.addEventListener("click", () => openLightbox(Number(b.dataset.idx))));

  window.scrollTo(0, 0);
}

/* ---------- 라이트박스 ---------- */
const lb = $("#lightbox");
const lbStage = $("#lbStage");
let lbIndex = 0;

function youtubeId(url) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// 상대 경로 파일 존재 여부 (file:// 에서는 fetch 가 막히므로 존재하지 않는 것으로 간주)
const existsCache = new Map();
async function urlExists(url) {
  if (existsCache.has(url)) return existsCache.get(url);
  let ok = false;
  if (location.protocol !== "file:") {
    try {
      const r = await fetch(url, { method: "HEAD" });
      ok = r.ok;
    } catch {}
  }
  existsCache.set(url, ok);
  return ok;
}

async function renderLightbox() {
  const a = currentAssets[lbIndex];
  if (!a) return;
  const rawSrc = a.src || "";
  // 샘플 데이터의 assets/ 경로는 실제 파일이 없으므로 "미등록"으로 취급
  const isSamplePath = /^assets\//.test(rawSrc) && !(await urlExists(rawSrc));
  const missing = !rawSrc || rawSrc === "#" || isSamplePath;
  const src = missing ? "" : await Store.resolveUrl(rawSrc);
  const thumb = await Store.resolveUrl(a.thumb);
  const isDriveFile = rawSrc.startsWith("drive:file:"); // Drive 미리보기(iframe)로 표시되는 PDF/영상
  const dl = Store.downloadUrl ? Store.downloadUrl(rawSrc) : src;
  const isFileProtocol = location.protocol === "file:";
  let stage = "";

  if (missing) {
    stage = `<div class="lb-link">${thumb ? `<img src="${thumb}" alt="" style="max-height:60%;opacity:.5">` : ""}<span>원본 파일이 아직 등록되지 않았습니다.</span><small>관리자 → 프로젝트 편집에서 파일을 업로드하면 여기서 바로 볼 수 있습니다.</small></div>`;
  } else if (a.type === "image") {
    stage = `<img src="${src}" alt="${esc(a.title)}">`;
  } else if (a.type === "video") {
    const yt = youtubeId(src);
    stage = yt
      ? `<iframe src="https://www.youtube.com/embed/${yt}?autoplay=1&rel=0" allow="autoplay; fullscreen" allowfullscreen></iframe>`
      : isDriveFile
        ? `<iframe src="${src}" allow="autoplay; fullscreen" allowfullscreen title="${esc(a.title)}"></iframe>`
        : `<video src="${src}" controls autoplay playsinline></video>
           <div class="lb-fallback" hidden><span>영상을 재생할 수 없습니다.</span><small>브라우저가 지원하지 않는 코덱이거나 파일이 손상되었을 수 있습니다. 아래 "새 탭에서 열기"로 시도해 보세요.</small></div>`;
  } else if (a.type === "pdf") {
    // file:// 로 직접 열면 브라우저가 PDF iframe 을 차단함 → 안내 + 새 탭 열기
    if (isFileProtocol && !isDriveFile && !src.startsWith("blob:")) {
      stage = `<div class="lb-link"><span>PDF 미리보기는 로컬 서버 또는 호스팅 환경에서만 표시됩니다.</span><small>지금은 파일을 직접 열어(file://) PDF 뷰어가 차단되었습니다. "새 탭에서 열기"를 누르거나, 사이트를 GitHub Pages·로컬 서버로 여세요.</small><a href="${src}" target="_blank" rel="noopener">새 탭에서 PDF 열기 ↗</a></div>`;
    } else {
      stage = `<iframe src="${isDriveFile ? src : src + "#view=FitH"}" title="${esc(a.title)}"></iframe>`;
    }
  } else {
    stage = `<div class="lb-link"><span>외부 링크</span><a href="${src}" target="_blank" rel="noopener">${esc(src)} ↗</a></div>`;
  }

  lbStage.innerHTML = stage;
  // <video> 재생 실패 시 안내 표시
  const v = lbStage.querySelector("video");
  if (v) {
    v.addEventListener("error", () => {
      v.hidden = true;
      const fb = lbStage.querySelector(".lb-fallback");
      if (fb) fb.hidden = false;
    });
  }
  $("#lbTitle").textContent = a.title;
  $("#lbDesc").textContent = [catById(a.section).label, a.desc].filter(Boolean).join(" · ");
  $("#lbCounter").textContent = `${lbIndex + 1} / ${currentAssets.length}`;
  $("#lbActions").innerHTML = missing
    ? ""
    : `<a href="${src}" target="_blank" rel="noopener">새 탭에서 열기</a>` +
      (a.type !== "link" && !youtubeId(src) ? `<a href="${dl}" target="_blank" rel="noopener" download="${esc(a.title)}">다운로드</a>` : "");
}

function openLightbox(i) {
  lbIndex = i;
  renderLightbox();
  lb.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeLightbox() {
  lb.hidden = true;
  lbStage.innerHTML = ""; // 영상 정지
  document.body.style.overflow = "";
}
function stepLightbox(d) {
  lbIndex = (lbIndex + d + currentAssets.length) % currentAssets.length;
  renderLightbox();
}

$("#lbClose").addEventListener("click", closeLightbox);
$(".lb-backdrop").addEventListener("click", closeLightbox);
$("#lbPrev").addEventListener("click", () => stepLightbox(-1));
$("#lbNext").addEventListener("click", () => stepLightbox(1));
document.addEventListener("keydown", (e) => {
  if (lb.hidden) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") stepLightbox(-1);
  if (e.key === "ArrowRight") stepLightbox(1);
});

/* ---------- 라우터 ---------- */
function render() {
  const hash = location.hash || "#/";
  const seg = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  // seg 예: [] | ["search"] | ["year","2025"] | ["year","2025","field","conference"] | ["project","id"]

  // 검색 뷰가 아닌 곳으로 이동하면 검색어 초기화 (드릴다운 탐색 시 검색 잔상 방지)
  if (seg[0] !== "search" && query) {
    query = "";
    searchInput.value = "";
  }

  if (seg[0] === "project" && seg[1]) viewProject(seg[1]);
  else if (seg[0] === "search") viewSearch();
  else if (seg[0] === "year" && seg[1] && seg[2] === "field" && seg[3]) viewProjectsIn(seg[1], seg[3]);
  else if (seg[0] === "year" && seg[1]) viewFields(seg[1]);
  else viewYears();

  if (seg[0] !== "project") window.scrollTo(0, 0);
  hydrateImgs();

  const totalAssets = DATA.reduce((n, p) => n + (p.assets || []).length, 0);
  const years = DATA.map((p) => p.year);
  $("#footerStats").textContent = DATA.length
    ? `프로젝트 ${DATA.length}건 · 자료 ${totalAssets}건 · ${Math.min(...years)}–${Math.max(...years)}`
    : "등록된 프로젝트가 없습니다";
}

window.addEventListener("hashchange", render);
(async () => {
  await loadData();
  render();
})();
