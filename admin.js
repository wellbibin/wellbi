/* =====================================================================
   WELLBI Archive - Admin Console
   ---------------------------------------------------------------------
   #/dashboard       진행 현황 대시보드 (admin 전용) — 프로젝트별 카테고리 업로드 진행률
   #/projects        프로젝트 목록
   #/new             새 프로젝트
   #/edit/<id>       프로젝트 편집 (정보 + 자료 업로드 + 현황기록)
   #/users           구성원 관리 (admin 전용) — 가입 신청 승인/거절
   #/settings        설정 · 백업
   ===================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s = "") => String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const fieldLabel = (id) => (FIELDS.find((f) => f.id === id) || {}).label || id;
const catById = (id) => CATEGORIES.find((c) => c.id === id) || { id, label: id, icon: "📁" };

const content = $("#content");
let me = null;

/* ---------- 토스트 ---------- */
let toastTimer;
function toast(msg, kind = "ok") {
  const t = $("#toast");
  t.textContent = msg;
  t.className = `toast ${kind}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

/* ---------- 썸네일 URL 해석 (local: 키 → object URL) ---------- */
async function hydrateImgs(root = content) {
  for (const img of $$("img[data-src]", root)) {
    img.src = (await Store.resolveUrl(img.dataset.src)) || "";
    img.removeAttribute("data-src");
  }
}

/* =====================================================================
   로그인
   ===================================================================== */
const DRIVE = Store.mode === "drive";

function showLogin() {
  $("#loginView").hidden = false;
  $("#adminView").hidden = true;
  $("#loginForm").hidden = false;
  $("#registerForm").hidden = true;
  $("#loginLocal").hidden = DRIVE;
  $("#loginDrive").hidden = !DRIVE;
  if (DRIVE) $("#allowedDomain").textContent = CONFIG.ALLOWED_DOMAIN ? "@" + CONFIG.ALLOWED_DOMAIN : "등록된 이메일";
}
function afterLogin() {
  showAdmin();
  const home = me.role === "admin" ? "#/dashboard" : "#/projects";
  if (!location.hash || location.hash === "#/") location.hash = home;
  else route();
}
function showAdmin() {
  $("#loginView").hidden = true;
  $("#adminView").hidden = false;
  $("#meName").textContent = me.name;
  const who = [me.dept, me.position].filter(Boolean).join(" · ");
  $("#meRole").textContent = (me.role === "admin" ? "관리자" : "구성원") + (who ? " · " + who : "") + " · " + me.email;
  $$("[data-admin-only]").forEach((el) => (el.hidden = me.role !== "admin"));
  refreshBadges();
}

// 사이드바 배지: 승인 대기 구성원 수, 진행률 50% 미만 프로젝트 수
async function refreshBadges() {
  if (me?.role !== "admin") return;
  try {
    const pending = (await Store.auth.listUsers()).filter((u) => u.status === "pending").length;
    const ub = $("#usersBadge");
    ub.textContent = pending;
    ub.hidden = !pending;
    const low = (await Store.getProjects()).filter((p) => progressOf(p).pct < 50).length;
    const db = $("#dashBadge");
    db.textContent = low;
    db.hidden = !low;
  } catch {}
}

/* ---------- 진행률 계산 (대시보드 · 목록 공용) ---------- */
function progressOf(p) {
  const assets = p.assets || [];
  const per = {};
  CATEGORIES.forEach((c) => (per[c.id] = assets.filter((a) => a.section === c.id).length));
  const done = REQUIRED_CATEGORIES.filter((k) => per[k] > 0).length;
  const pct = Math.round((done / REQUIRED_CATEGORIES.length) * 100);
  const missing = REQUIRED_CATEGORIES.filter((k) => !per[k]);
  const logs = assets.filter((a) => a.section === "log");
  const lastUpload = assets.reduce((m, a) => Math.max(m, a.uploadedAt || a.createdAt || 0), 0);
  return { per, done, total: REQUIRED_CATEGORIES.length, pct, missing, logs, lastUpload, hasThumb: !!p.thumbnail };
}
const pctClass = (pct) => (pct >= 100 ? "full" : pct >= 50 ? "mid" : "low");

$("#showRegister")?.addEventListener("click", () => {
  $("#loginForm").hidden = true;
  $("#registerForm").hidden = false;
  $("#registerErr").textContent = "";
});
$("#showLogin")?.addEventListener("click", () => {
  $("#registerForm").hidden = true;
  $("#loginForm").hidden = false;
});
$("#registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await Store.auth.register({ name: fd.get("name"), dept: fd.get("dept"), position: fd.get("position"), email: fd.get("email"), pw: fd.get("pw") });
    e.target.reset();
    $("#registerForm").hidden = true;
    $("#loginForm").hidden = false;
    $("#loginErr").style.color = "#4ade80";
    $("#loginErr").textContent = "가입 신청이 접수되었습니다. 관리자 승인 후 로그인할 수 있습니다.";
    setTimeout(() => ($("#loginErr").style.color = ""), 6000);
  } catch (err) {
    $("#registerErr").textContent = err.message;
  }
});

$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (DRIVE) return;
  const fd = new FormData(e.target);
  try {
    me = await Store.auth.login(fd.get("email"), fd.get("pw"));
    afterLogin();
  } catch (err) {
    $("#loginErr").textContent = err.message;
  }
});
$("#googleLoginBtn").addEventListener("click", async () => {
  const btn = $("#googleLoginBtn");
  btn.disabled = true;
  $("#loginErrDrive").textContent = "";
  try {
    me = await Store.auth.login();
    afterLogin();
  } catch (err) {
    $("#loginErrDrive").textContent = err.message;
  } finally {
    btn.disabled = false;
  }
});
$("#logoutBtn").addEventListener("click", () => {
  Store.auth.logout();
  me = null;
  showLogin();
});

/* =====================================================================
   진행 현황 대시보드 (관리감독)
   ===================================================================== */
async function viewDashboard() {
  if (me.role !== "admin") {
    content.innerHTML = `<div class="empty-sm">관리자만 접근할 수 있습니다.</div>`;
    return;
  }
  const list = await Store.getProjects();
  const users = await Store.auth.listUsers();
  const pending = users.filter((u) => u.status === "pending");
  const rows = list.map((p) => ({ p, pr: progressOf(p) }));
  const years = [...new Set(list.map((p) => p.year))].sort((a, b) => b - a);

  const avg = rows.length ? Math.round(rows.reduce((n, r) => n + r.pr.pct, 0) / rows.length) : 0;
  const complete = rows.filter((r) => r.pr.pct >= 100).length;
  const low = rows.filter((r) => r.pr.pct < 50).length;
  const noThumb = rows.filter((r) => !r.pr.hasThumb).length;

  // 카테고리별 전체 충족률
  const catCov = CATEGORIES.filter((c) => c.kind !== "note").map((c) => ({ c, n: rows.filter((r) => r.pr.per[c.id] > 0).length }));

  // 최근 현황기록 (전체 프로젝트)
  const recentLogs = list
    .flatMap((p) => (p.assets || []).filter((a) => a.section === "log").map((a) => ({ ...a, _p: p })))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 6);

  content.innerHTML = `
    <div class="content-head">
      <div><h1>진행 현황</h1><p>프로젝트별 자료 업로드 진행률을 한눈에 점검합니다 · 필수 카테고리 ${REQUIRED_CATEGORIES.length}개 기준</p></div>
      <div class="head-actions"><a class="btn" href="#/users">구성원 관리${pending.length ? ` <span class="pill off" style="margin-left:4px">승인 대기 ${pending.length}</span>` : ""}</a></div>
    </div>

    ${pending.length ? `<div class="alert"><b>승인 대기 중인 가입 신청 ${pending.length}건</b> — ${pending.map((u) => esc(u.name) + (u.dept ? `(${esc(u.dept)})` : "")).join(", ")} <a href="#/users">승인하러 가기 →</a></div>` : ""}

    <div class="stats-mini" style="grid-template-columns:repeat(5,1fr)">
      <div class="st"><b>${list.length}</b><span>전체 프로젝트</span></div>
      <div class="st"><b class="${pctClass(avg)}-c">${avg}%</b><span>평균 진행률</span></div>
      <div class="st"><b class="full-c">${complete}</b><span>완료 (100%)</span></div>
      <div class="st"><b class="low-c">${low}</b><span>미흡 (50% 미만)</span></div>
      <div class="st"><b class="${noThumb ? "mid-c" : ""}">${noThumb}</b><span>메인 썸네일 없음</span></div>
    </div>

    <div class="card">
      <h2>카테고리별 충족률 <small>해당 카테고리에 자료가 1건 이상 있는 프로젝트 비율</small></h2>
      <div class="cov-grid">
        ${catCov
          .map(({ c, n }) => {
            const pct = list.length ? Math.round((n / list.length) * 100) : 0;
            return `<div class="cov"><div class="cov-h"><span>${c.icon} ${esc(c.label)}</span><b>${n}/${list.length}</b></div><div class="bar"><i class="${pctClass(pct)}" style="width:${pct}%"></i></div></div>`;
          })
          .join("")}
      </div>
    </div>

    <div class="card" style="padding:0">
      <div class="matrix-toolbar">
        <h2 style="margin:0;padding:0">프로젝트 × 카테고리 매트릭스</h2>
        <div style="display:flex;gap:8px">
          <select id="dy"><option value="">전체 연도</option>${years.map((y) => `<option>${y}</option>`).join("")}</select>
          <select id="ds"><option value="pct">진행률 낮은 순</option><option value="pct-desc">진행률 높은 순</option><option value="recent">최근 업로드 순</option><option value="year">연도 순</option></select>
          <label class="f inline" style="font-size:13px;color:var(--muted)"><input type="checkbox" id="dlow"> 미흡만</label>
        </div>
      </div>
      <div class="matrix-wrap"><table class="matrix" id="matrix"></table></div>
      <p class="legend">● 자료 있음 (숫자 = 건수) · <span class="miss">○</span> 미등록 · 현황기록·기타는 진행률에 포함되지 않음</p>
    </div>

    <div class="card">
      <h2>최근 현황기록 <small>구성원들이 남긴 진행 상황 메모</small></h2>
      ${
        recentLogs.length
          ? `<div class="log-list compact">${recentLogs
              .map(
                (l) => `<div class="log">
              <div class="log-h"><b>${esc(l.author?.name || "")}</b><span>${[l.author?.dept, l.author?.position].filter(Boolean).map(esc).join(" · ")}</span><time>${new Date(l.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}</time></div>
              <div class="log-p"><a href="#/edit/${l._p.id}">${esc(l._p.title)}</a></div>
              ${l.title ? `<div class="log-t">${esc(l.title)}</div>` : ""}
              <div class="log-b">${esc(l.body || "")}</div>
            </div>`
              )
              .join("")}</div>`
          : `<div class="empty-sm">아직 현황기록이 없습니다.</div>`
      }
    </div>`;

  const cats = CATEGORIES.filter((c) => c.kind !== "note");
  const drawMatrix = () => {
    const fy = $("#dy").value;
    const sort = $("#ds").value;
    const onlyLow = $("#dlow").checked;
    let rs = rows.filter((r) => (!fy || String(r.p.year) === fy) && (!onlyLow || r.pr.pct < 50));
    rs.sort((a, b) => {
      if (sort === "pct") return a.pr.pct - b.pr.pct || b.p.year - a.p.year;
      if (sort === "pct-desc") return b.pr.pct - a.pr.pct || b.p.year - a.p.year;
      if (sort === "recent") return b.pr.lastUpload - a.pr.lastUpload;
      return b.p.year - a.p.year || a.p.title.localeCompare(b.p.title, "ko");
    });
    $("#matrix").innerHTML = `
      <thead><tr>
        <th class="sticky">프로젝트</th><th>진행률</th>
        ${cats.map((c) => `<th title="${esc(c.label)}">${c.icon}<br><small>${esc(c.label)}</small></th>`).join("")}
        <th>📝<br><small>현황기록</small></th><th>최근 업로드</th><th></th>
      </tr></thead>
      <tbody>${
        rs.length
          ? rs
              .map(
                ({ p, pr }) => `<tr>
          <td class="sticky"><div class="t">${esc(p.title)}</div><div class="s">${p.year} · ${esc(fieldLabel(p.field))}${p.hidden ? " · <span class='pill off'>비공개</span>" : ""}</div></td>
          <td><div class="pct ${pctClass(pr.pct)}"><div class="bar"><i class="${pctClass(pr.pct)}" style="width:${pr.pct}%"></i></div><b>${pr.pct}%</b><small>${pr.done}/${pr.total}</small></div></td>
          ${cats
            .map((c) => {
              const n = pr.per[c.id];
              const req = REQUIRED_CATEGORIES.includes(c.id);
              return `<td class="cell ${n ? "ok" : req ? "miss" : "opt"}">${n ? `<span class="dot">●</span><small>${n}</small>` : `<span class="dot">○</span>`}</td>`;
            })
            .join("")}
          <td class="cell ${pr.logs.length ? "ok" : "opt"}">${pr.logs.length ? `<span class="dot">●</span><small>${pr.logs.length}</small>` : `<span class="dot">○</span>`}</td>
          <td class="s">${pr.lastUpload ? new Date(pr.lastUpload).toLocaleDateString("ko-KR") : "-"}</td>
          <td><a class="btn sm" href="#/edit/${p.id}">편집</a></td>
        </tr>`
              )
              .join("")
          : `<tr><td colspan="${cats.length + 5}" class="empty-sm">조건에 맞는 프로젝트가 없습니다.</td></tr>`
      }</tbody>`;
  };
  ["#dy", "#ds", "#dlow"].forEach((s) => $(s).addEventListener("change", drawMatrix));
  drawMatrix();
}

/* =====================================================================
   프로젝트 목록
   ===================================================================== */
async function viewProjects() {
  const list = await Store.getProjects();
  const years = [...new Set(list.map((p) => p.year))].sort((a, b) => b - a);
  const assets = list.reduce((n, p) => n + (p.assets || []).length, 0);
  const usage = await Store.storageUsage();

  content.innerHTML = `
    <div class="content-head">
      <div><h1>프로젝트 관리</h1><p>등록된 프로젝트와 자료를 관리합니다</p></div>
      <div class="head-actions"><a class="btn primary" href="#/new">＋ 새 프로젝트</a></div>
    </div>
    <div class="stats-mini">
      <div class="st"><b>${list.length}</b><span>프로젝트</span></div>
      <div class="st"><b>${assets}</b><span>자료</span></div>
      <div class="st"><b>${years.length}</b><span>연도</span></div>
      <div class="st"><b>${Store.fmtBytes(usage.bytes)}</b><span>업로드 파일 (${usage.count}개)</span></div>
    </div>
    <div class="toolbar">
      <input id="q" placeholder="프로젝트명 · 발주처 검색">
      <select id="fy"><option value="">전체 연도</option>${years.map((y) => `<option>${y}</option>`).join("")}</select>
      <select id="ff"><option value="">전체 분야</option>${FIELDS.map((f) => `<option value="${f.id}">${esc(f.label)}</option>`).join("")}</select>
    </div>
    <div class="card" style="padding:0 6px"><table class="table">
      <thead><tr><th></th><th>프로젝트</th><th>연도</th><th>분야</th><th>계약금액</th><th>자료</th><th>진행률</th><th>상태</th><th></th></tr></thead>
      <tbody id="rows"></tbody>
    </table></div>`;

  const draw = () => {
    const q = $("#q").value.trim().toLowerCase();
    const fy = $("#fy").value;
    const ff = $("#ff").value;
    const rows = list.filter((p) => (!q || `${p.title} ${p.client}`.toLowerCase().includes(q)) && (!fy || String(p.year) === fy) && (!ff || p.field === ff));
    $("#rows").innerHTML = rows.length
      ? rows
          .map((p) => {
            const pr = progressOf(p);
            return `
          <tr>
            <td><img class="thumb" data-src="${p.thumbnail || ""}" alt=""></td>
            <td><div class="t">${esc(p.title)}</div><div class="s">${esc(p.client || "")} · ${esc(p.period || "")}</div></td>
            <td>${p.year}</td>
            <td><span class="pill">${esc(fieldLabel(p.field))}</span></td>
            <td class="s">${p.internal?.amount != null ? p.internal.amount.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) + "억" : "-"}</td>
            <td>${(p.assets || []).filter((a) => a.section !== "log").length}건${pr.logs.length ? `<div class="s">기록 ${pr.logs.length}</div>` : ""}</td>
            <td><div class="pct ${pctClass(pr.pct)}" title="미등록: ${pr.missing.map((k) => catById(k).label).join(", ") || "없음"}"><div class="bar"><i class="${pctClass(pr.pct)}" style="width:${pr.pct}%"></i></div><b>${pr.pct}%</b></div></td>
            <td><span class="pill ${p.hidden ? "off" : "on"}">${p.hidden ? "비공개" : "공개"}</span></td>
            <td><div class="acts">
              <a class="btn sm" href="index.html#/project/${p.id}" target="_blank">보기</a>
              <a class="btn sm primary" href="#/edit/${p.id}">편집</a>
              <button class="btn sm danger" data-del="${p.id}">삭제</button>
            </div></td>
          </tr>`;
          })
          .join("")
      : `<tr><td colspan="9" class="empty-sm">조건에 맞는 프로젝트가 없습니다.</td></tr>`;
    hydrateImgs($("#rows"));
    $$("[data-del]").forEach((b) =>
      b.addEventListener("click", async () => {
        const p = list.find((x) => x.id === b.dataset.del);
        if (!confirm(`"${p.title}" 프로젝트와 자료 ${p.assets.length}건을 삭제할까요?\n이 작업은 되돌릴 수 없습니다.`)) return;
        await Store.deleteProject(p.id);
        toast("삭제되었습니다");
        viewProjects();
      })
    );
  };
  ["#q", "#fy", "#ff"].forEach((s) => $(s).addEventListener("input", draw));
  draw();
}

/* =====================================================================
   프로젝트 편집
   ===================================================================== */
const blank = () => ({
  id: "",
  title: "",
  year: new Date().getFullYear(),
  field: FIELDS[0].id,
  client: "",
  period: "",
  venue: "",
  thumbnail: "",
  summary: "",
  stats: [{ label: "", value: "" }],
  scope: [""],
  tags: [],
  hidden: false,
  assets: [],
});

async function viewEdit(id) {
  let p;
  if (id) {
    p = (await Store.getProjects()).find((x) => x.id === id);
    if (!p) {
      content.innerHTML = `<div class="empty-sm">프로젝트를 찾을 수 없습니다.</div>`;
      return;
    }
    p = JSON.parse(JSON.stringify(p));
    p.stats = p.stats?.length ? p.stats : [{ label: "", value: "" }];
    p.scope = p.scope?.length ? p.scope : [""];
  } else p = blank();

  const isNew = !id;
  let dirty = false;
  let activeCat = CATEGORIES[0].id;
  const setDirty = (v = true) => {
    dirty = v;
    const m = $("#saveMsg");
    if (m) {
      m.textContent = v ? "저장되지 않은 변경사항이 있습니다" : "모든 변경사항이 저장되었습니다";
      m.className = "msg" + (v ? " dirty" : "");
    }
  };

  content.innerHTML = `
    <div class="content-head">
      <div><h1>${isNew ? "새 프로젝트" : "프로젝트 편집"}</h1><p>${isNew ? "기본 정보를 입력하고 저장한 뒤 자료를 업로드하세요" : esc(p.title)}</p></div>
      <div class="head-actions">
        ${!isNew ? `<a class="btn" href="index.html#/project/${p.id}" target="_blank">사이트에서 보기 ↗</a>` : ""}
        <a class="btn ghost" href="#/projects">← 목록</a>
      </div>
    </div>

    <div class="edit-layout">
      <div>
        <div class="card">
          <h2>기본 정보</h2>
          <div class="row c2" style="margin-bottom:14px">
            <label class="f" style="grid-column:1/-1"><span>프로젝트명 *</span><input id="f-title" value="${esc(p.title)}" placeholder="예) 2025 글로벌 바이오 헬스 포럼"></label>
            <label class="f"><span>연도 *</span><input id="f-year" type="number" min="2000" max="2100" value="${p.year}"></label>
            <label class="f"><span>분야 *</span><select id="f-field">${FIELDS.map((f) => `<option value="${f.id}" ${f.id === p.field ? "selected" : ""}>${esc(f.label)}</option>`).join("")}</select></label>
            <label class="f"><span>발주처</span><input id="f-client" value="${esc(p.client)}" placeholder="예) 보건복지부 · 한국보건산업진흥원"></label>
            <label class="f"><span>기간</span><input id="f-period" value="${esc(p.period)}" placeholder="예) 2025.09.10 ~ 09.12"></label>
            <label class="f" style="grid-column:1/-1"><span>장소</span><input id="f-venue" value="${esc(p.venue)}" placeholder="예) 코엑스 오디토리움 (서울)"></label>
            <label class="f" style="grid-column:1/-1"><span>프로젝트 개요 <span class="hint">(영업용 요약 2~3문장)</span></span><textarea id="f-summary">${esc(p.summary)}</textarea></label>
            <label class="f" style="grid-column:1/-1"><span>태그 <span class="hint">(쉼표로 구분)</span></span><input id="f-tags" value="${esc((p.tags || []).join(", "))}" placeholder="하이브리드, 국제포럼, 갈라디너"></label>
          </div>
        </div>

        <div class="card">
          <h2>내부 정보 <small>관리자 콘솔에서만 보이며 공개 사이트에는 표시되지 않습니다</small></h2>
          <div class="row c3">
            <label class="f"><span>계약금액 <span class="hint">(억원, VAT포함)</span></span><input id="f-amount" type="number" step="0.0001" min="0" value="${p.internal?.amount ?? ""}" placeholder="예) 1.362"></label>
            <label class="f"><span>담당부서</span><input id="f-dept" value="${esc(p.internal?.dept || "")}" placeholder="예) 기획본부 (기획2팀)"></label>
            <label class="f"><span>유형 <span class="hint">(실적리스트 기준)</span></span><input id="f-ptype" value="${esc(p.internal?.type || "")}" placeholder="예) 행사 / 마케팅·홍보"></label>
            <label class="f" style="grid-column:1/-1"><span>비고</span><input id="f-note" value="${esc(p.internal?.note || "")}" placeholder="예) 나라장터 발급가능 / 피엔비 수행"></label>
          </div>
        </div>

        <div class="card">
          <h2>핵심 성과 수치 <small>상세 화면 상단에 최대 4개 표시</small></h2>
          <div class="list-edit" id="stats"></div>
          <button class="btn sm" id="addStat" style="margin-top:10px">＋ 항목 추가</button>
        </div>

        <div class="card">
          <h2>과업 범위 <small>수행한 업무를 태그 형태로 표시</small></h2>
          <div class="list-edit" id="scope"></div>
          <button class="btn sm" id="addScope" style="margin-top:10px">＋ 항목 추가</button>
        </div>

        <div class="card" id="assetsCard">
          <h2>자료 관리 <small>카테고리를 선택하고 파일을 끌어다 놓으세요</small></h2>
          ${isNew ? `<div class="empty-sm">먼저 기본 정보를 저장하면 자료를 업로드할 수 있습니다.</div>` : `
          <div class="cat-tabs" id="catTabs"></div>

          <!-- 현황기록 작성 (카테고리가 '현황기록'일 때만 표시) -->
          <div id="logPane" hidden>
            <div class="log-form">
              <div class="row c3">
                <label class="f"><span>이름</span><input id="lg-name" value="${esc(me.name)}"></label>
                <label class="f"><span>소속</span><input id="lg-dept" value="${esc(me.dept || "")}" placeholder="예) 기획1팀"></label>
                <label class="f"><span>직책</span><input id="lg-pos" value="${esc(me.position || "")}" placeholder="예) 대리"></label>
              </div>
              <label class="f"><span>제목 <span class="hint">(선택)</span></span><input id="lg-title" placeholder="예) 현장 전력 이슈 / 발주처 피드백 / 잘된 점"></label>
              <label class="f"><span>상황 설명 *</span><textarea id="lg-body" rows="5" placeholder="진행하면서 겪은 상황, 이슈와 해결 과정, 다음에 반영할 교훈 등을 자유롭게 남겨주세요."></textarea></label>
              <div style="display:flex;justify-content:flex-end"><button class="btn primary" id="lg-add">기록 남기기</button></div>
            </div>
            <div class="log-list" id="logList"></div>
          </div>

          <div class="drop-row" id="dropRow">
            <div class="drop" id="drop">
              <b>파일을 여기에 끌어다 놓거나 클릭해서 선택</b>
              <small>이미지(JPG/PNG) · PDF · MP4 — 이미지는 자동으로 2000px / 썸네일 640px로 축소되어 저장됩니다</small>
              <div class="progress" id="prog" hidden><i style="width:0"></i></div>
              <input type="file" id="fileInput" multiple hidden accept="image/*,application/pdf,video/*">
            </div>
            <div class="yt-box">
              <input id="ytUrl" placeholder="YouTube 링크 붙여넣기">
              <button class="btn sm primary" id="ytAdd">영상 링크 추가</button>
              <small>영상은 YouTube 비공개(unlisted) 업로드 후 링크로 등록하는 것을 권장</small>
            </div>
          </div>
          <div class="asset-list" id="assetList"></div>`}
        </div>
      </div>

      <div class="sticky-side">
        <div class="card">
          <h2>메인 썸네일 <small>목록에 표시</small></h2>
          <div class="thumb-drop" id="thumbDrop">
            ${p.thumbnail ? `<img data-src="${p.thumbnail}" alt="">` : ""}
            <span class="ov">${p.thumbnail ? "클릭/드롭하여 교체" : "메인 시안 이미지를<br>끌어다 놓거나 클릭"}</span>
            <input type="file" id="thumbInput" accept="image/*" hidden>
          </div>
          ${!isNew ? `<button class="btn sm" id="useFirstPhoto" style="margin-top:10px;width:100%">첫 번째 시안/사진을 썸네일로</button>` : ""}
        </div>
        <div class="card">
          <h2>공개 설정</h2>
          <label class="f inline"><input type="checkbox" id="f-hidden" ${p.hidden ? "checked" : ""}> <span>비공개 (사이트에 표시하지 않음)</span></label>
          ${!isNew ? `<p class="f hint" style="margin:10px 0 0;font-size:12px;color:var(--muted)">ID: ${esc(p.id)}<br>마지막 저장: ${p.updatedAt ? new Date(p.updatedAt).toLocaleString("ko-KR") : "-"}</p>` : ""}
        </div>
      </div>
    </div>

    <div class="savebar">
      <span class="msg" id="saveMsg">${isNew ? "기본 정보를 입력한 뒤 저장하세요" : "모든 변경사항이 저장되었습니다"}</span>
      <div style="display:flex;gap:8px">
        ${!isNew ? `<button class="btn danger" id="delBtn">삭제</button>` : ""}
        <button class="btn primary" id="saveBtn">${isNew ? "저장하고 자료 업로드 시작" : "저장"}</button>
      </div>
    </div>`;

  hydrateImgs();

  /* --- 입력 변경 감지 --- */
  $$("input, select, textarea", content).forEach((el) => el.addEventListener("input", () => setDirty()));

  /* --- 성과 수치 / 과업 범위 리스트 --- */
  const drawStats = () => {
    $("#stats").innerHTML = p.stats
      .map(
        (s, i) => `<div class="li"><input data-si="${i}" data-k="label" value="${esc(s.label)}" placeholder="항목 (예: 참가자)"><input data-si="${i}" data-k="value" value="${esc(s.value)}" placeholder="값 (예: 1,200명)"><button class="icon-btn" data-srm="${i}">×</button></div>`
      )
      .join("");
    $$("[data-si]").forEach((inp) => inp.addEventListener("input", () => ((p.stats[inp.dataset.si][inp.dataset.k] = inp.value), setDirty())));
    $$("[data-srm]").forEach((b) => b.addEventListener("click", () => (p.stats.splice(b.dataset.srm, 1), drawStats(), setDirty())));
  };
  const drawScope = () => {
    $("#scope").innerHTML = p.scope
      .map((s, i) => `<div class="li one"><input data-sc="${i}" value="${esc(s)}" placeholder="예) 기획·총괄 운영"><button class="icon-btn" data-scrm="${i}">×</button></div>`)
      .join("");
    $$("[data-sc]").forEach((inp) => inp.addEventListener("input", () => ((p.scope[inp.dataset.sc] = inp.value), setDirty())));
    $$("[data-scrm]").forEach((b) => b.addEventListener("click", () => (p.scope.splice(b.dataset.scrm, 1), drawScope(), setDirty())));
  };
  drawStats();
  drawScope();
  $("#addStat").addEventListener("click", () => (p.stats.push({ label: "", value: "" }), drawStats(), setDirty()));
  $("#addScope").addEventListener("click", () => (p.scope.push(""), drawScope(), setDirty()));

  /* --- 메인 썸네일 --- */
  const thumbDrop = $("#thumbDrop");
  const thumbInput = $("#thumbInput");
  const setThumb = async (file) => {
    if (!file || !file.type.startsWith("image/")) return toast("이미지 파일만 가능합니다", "err");
    if (DRIVE && !p.id) return toast("먼저 기본 정보를 저장한 뒤 썸네일을 올려주세요", "err");
    const r = await Store.uploadFile(file, { projectId: p.id, section: "_thumb" });
    await Store.removeFileIfLocal(p.thumbnail);
    p.thumbnail = r.src;
    thumbDrop.innerHTML = `<img src="${await Store.resolveUrl(r.src)}" alt=""><span class="ov">클릭/드롭하여 교체</span><input type="file" id="thumbInput" accept="image/*" hidden>`;
    $("#thumbInput").addEventListener("change", (e) => setThumb(e.target.files[0]));
    setDirty();
  };
  thumbDrop.addEventListener("click", () => $("#thumbInput").click());
  thumbInput.addEventListener("change", (e) => setThumb(e.target.files[0]));
  bindDrop(thumbDrop, (files) => setThumb(files[0]));
  $("#useFirstPhoto")?.addEventListener("click", () => {
    const a = p.assets.find((x) => x.type === "image" && (x.section === "design" || x.section === "photo")) || p.assets.find((x) => x.type === "image");
    if (!a) return toast("이미지 자료가 없습니다", "err");
    p.thumbnail = a.src;
    hydrate(thumbDrop, a.src);
    setDirty();
  });
  async function hydrate(el, key) {
    el.innerHTML = `<img src="${await Store.resolveUrl(key)}" alt=""><span class="ov">클릭/드롭하여 교체</span><input type="file" id="thumbInput" accept="image/*" hidden>`;
    $("#thumbInput").addEventListener("change", (e) => setThumb(e.target.files[0]));
  }

  /* --- 저장 --- */
  const collect = () => {
    p.title = $("#f-title").value.trim();
    p.year = Number($("#f-year").value);
    p.field = $("#f-field").value;
    p.client = $("#f-client").value.trim();
    p.period = $("#f-period").value.trim();
    p.venue = $("#f-venue").value.trim();
    p.summary = $("#f-summary").value.trim();
    p.tags = $("#f-tags").value.split(",").map((s) => s.trim()).filter(Boolean);
    // 내부 정보 (공개 사이트 비노출) — 값이 하나라도 있으면 저장, 전부 비면 제거
    const amountRaw = $("#f-amount").value.trim();
    const internal = {
      amount: amountRaw === "" ? null : Number(amountRaw),
      dept: $("#f-dept").value.trim(),
      type: $("#f-ptype").value.trim(),
      note: $("#f-note").value.trim(),
    };
    if (internal.amount !== null || internal.dept || internal.type || internal.note) p.internal = internal;
    else delete p.internal;
    p.hidden = $("#f-hidden").checked;
    p.stats = p.stats.filter((s) => s.label || s.value);
    p.scope = p.scope.map((s) => s.trim()).filter(Boolean);
    if (!p.id) p.id = `${p.year}-${Store.slugify(p.title)}-${Math.random().toString(36).slice(2, 6)}`;
  };
  $("#saveBtn").addEventListener("click", async () => {
    collect();
    if (!p.title) return toast("프로젝트명을 입력하세요", "err"), $("#f-title").focus();
    if (!p.year) return toast("연도를 입력하세요", "err");
    await Store.saveProject(p);
    toast("저장되었습니다");
    setDirty(false);
    if (isNew) location.hash = `#/edit/${p.id}`;
    else $(".content-head p").textContent = p.title;
  });
  $("#delBtn")?.addEventListener("click", async () => {
    if (!confirm(`"${p.title}" 프로젝트를 삭제할까요?`)) return;
    await Store.deleteProject(p.id);
    toast("삭제되었습니다");
    location.hash = "#/projects";
  });

  if (isNew) return;

  /* =====================================================================
     자료 관리 (기존 프로젝트만)
     ===================================================================== */
  const drawTabs = () => {
    $("#catTabs").innerHTML = CATEGORIES.map((c) => {
      const n = p.assets.filter((a) => a.section === c.id).length;
      return `<button class="cat-tab ${c.id === activeCat ? "active" : ""}" data-cat="${c.id}">${c.icon} ${esc(c.label)}<span class="n">${n}</span></button>`;
    }).join("");
    $$("[data-cat]").forEach((b) =>
      b.addEventListener("click", () => {
        activeCat = b.dataset.cat;
        drawTabs();
        drawAssets();
      })
    );
  };

  /* --- 현황기록 --- */
  const drawLogs = () => {
    const logs = p.assets.map((a, i) => ({ a, i })).filter(({ a }) => a.section === "log").sort((x, y) => (y.a.createdAt || 0) - (x.a.createdAt || 0));
    $("#logList").innerHTML = logs.length
      ? logs
          .map(
            ({ a, i }) => `<div class="log">
          <div class="log-h">
            <b>${esc(a.author?.name || "")}</b>
            <span>${[a.author?.dept, a.author?.position].filter(Boolean).map(esc).join(" · ")}</span>
            <time>${new Date(a.createdAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" })}</time>
            ${me.role === "admin" || a.author?.email === me.email ? `<button class="icon-btn" data-lgrm="${i}" title="삭제">×</button>` : ""}
          </div>
          ${a.title ? `<div class="log-t">${esc(a.title)}</div>` : ""}
          <div class="log-b">${esc(a.body || "")}</div>
        </div>`
          )
          .join("")
      : `<div class="empty-sm">아직 기록이 없습니다. 위에서 첫 기록을 남겨보세요.</div>`;
    $$("[data-lgrm]").forEach((b) =>
      b.addEventListener("click", async () => {
        if (!confirm("이 기록을 삭제할까요?")) return;
        p.assets.splice(b.dataset.lgrm, 1);
        await Store.saveProject(p);
        toast("기록이 삭제되었습니다");
        drawTabs();
        drawLogs();
      })
    );
  };
  $("#lg-add").addEventListener("click", async () => {
    const body = $("#lg-body").value.trim();
    const name = $("#lg-name").value.trim();
    if (!name) return toast("이름을 입력하세요", "err"), $("#lg-name").focus();
    if (!body) return toast("상황 설명을 입력하세요", "err"), $("#lg-body").focus();
    p.assets.push({
      section: "log",
      type: "note",
      title: $("#lg-title").value.trim(),
      body,
      author: { name, dept: $("#lg-dept").value.trim(), position: $("#lg-pos").value.trim(), email: me.email },
      createdAt: Date.now(),
      uploadedAt: Date.now(),
    });
    await Store.saveProject(p);
    $("#lg-title").value = "";
    $("#lg-body").value = "";
    toast("현황기록이 저장되었습니다");
    drawTabs();
    drawLogs();
  });

  const drawAssets = () => {
    const isLog = catById(activeCat).kind === "note";
    $("#logPane").hidden = !isLog;
    $("#dropRow").hidden = isLog;
    $("#assetList").hidden = isLog;
    if (isLog) return drawLogs();

    const items = p.assets.map((a, i) => ({ a, i })).filter(({ a }) => a.section === activeCat);
    $("#assetList").innerHTML = items.length
      ? items
          .map(
            ({ a, i }) => `
          <div class="asset-edit" draggable="true" data-i="${i}">
            <div class="th">
              ${a.thumb || a.src?.startsWith("drive:file:") ? `<img data-src="${a.thumb || "drive:thumb:" + a.src.slice(11)}" alt="" onerror="this.outerHTML='<div class=noimg>${a.type === "pdf" ? "📄" : a.type === "video" ? "🎬" : "🔗"}</div>'">` : `<div class="noimg">${a.type === "pdf" ? "📄" : a.type === "video" ? "🎬" : "🔗"}</div>`}
              <span class="handle" title="드래그하여 순서 변경">⠿</span>
              <span class="tp">${a.type}</span>
              <button class="rm" data-rm="${i}" title="삭제">×</button>
            </div>
            <div class="bd">
              <input data-ai="${i}" data-k="title" value="${esc(a.title)}" placeholder="제목">
              <input data-ai="${i}" data-k="desc" value="${esc(a.desc || "")}" placeholder="설명 (선택)">
              <select data-ai="${i}" data-k="section" title="카테고리 이동">${CATEGORIES.filter((c) => c.kind !== "note").map((c) => `<option value="${c.id}" ${c.id === a.section ? "selected" : ""}>${c.icon} ${esc(c.label)}</option>`).join("")}</select>
            </div>
          </div>`
          )
          .join("")
      : `<div class="empty-sm" style="grid-column:1/-1">아직 ${esc(catById(activeCat).label)} 자료가 없습니다. 위에 파일을 끌어다 놓으세요.</div>`;
    hydrateImgs($("#assetList"));

    $$("[data-ai]").forEach((el) =>
      el.addEventListener("input", () => {
        p.assets[el.dataset.ai][el.dataset.k] = el.value;
        setDirty();
        if (el.dataset.k === "section") (drawTabs(), drawAssets());
      })
    );
    $$("[data-rm]").forEach((b) =>
      b.addEventListener("click", async () => {
        const a = p.assets[b.dataset.rm];
        if (!confirm(`"${a.title}" 자료를 삭제할까요?`)) return;
        await Store.removeFileIfLocal(a.src);
        await Store.removeFileIfLocal(a.thumb);
        p.assets.splice(b.dataset.rm, 1);
        drawTabs();
        drawAssets();
        setDirty();
      })
    );

    // 순서 변경 (드래그)
    let dragFrom = null;
    $$(".asset-edit").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        dragFrom = Number(card.dataset.i);
        card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
      card.addEventListener("dragover", (e) => e.preventDefault());
      card.addEventListener("drop", (e) => {
        e.preventDefault();
        const to = Number(card.dataset.i);
        if (dragFrom === null || dragFrom === to) return;
        const [moved] = p.assets.splice(dragFrom, 1);
        p.assets.splice(to, 0, moved);
        dragFrom = null;
        drawAssets();
        setDirty();
      });
    });
  };

  /* --- 파일 업로드 --- */
  const drop = $("#drop");
  const fileInput = $("#fileInput");
  const prog = $("#prog");
  const addFiles = async (files) => {
    files = [...files].filter((f) => f.type.startsWith("image/") || f.type === "application/pdf" || f.type.startsWith("video/"));
    if (!files.length) return toast("지원하지 않는 파일 형식입니다", "err");
    prog.hidden = false;
    let done = 0;
    try {
      for (const f of files) {
        const r = await Store.uploadFile(f, { projectId: p.id, section: activeCat, onProgress: (v) => (prog.firstElementChild.style.width = `${((done + v) / files.length) * 100}%`) });
        p.assets.push({ section: activeCat, type: r.type, title: f.name.replace(/\.[^.]+$/, ""), desc: "", thumb: r.thumb, src: r.src, size: r.size, uploadedBy: me.email, uploadedAt: Date.now() });
        done++;
      }
      await Store.saveProject(p); // 업로드는 즉시 저장
      toast(`${done}개 파일이 ${catById(activeCat).label}에 추가되었습니다`);
    } catch (err) {
      console.error(err);
      if (done) await Store.saveProject(p).catch(() => {});
      toast(`업로드 실패 (${done}/${files.length} 완료): ${err.message}`, "err");
    } finally {
      prog.hidden = true;
      prog.firstElementChild.style.width = "0";
    }
    drawTabs();
    drawAssets();
  };
  drop.addEventListener("click", (e) => e.target.tagName !== "INPUT" && fileInput.click());
  fileInput.addEventListener("change", (e) => (addFiles(e.target.files), (e.target.value = "")));
  bindDrop(drop, addFiles);

  // YouTube 링크
  $("#ytAdd").addEventListener("click", async () => {
    const url = $("#ytUrl").value.trim();
    const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
    if (!m) return toast("올바른 YouTube 링크가 아닙니다", "err");
    p.assets.push({ section: activeCat === "video" || activeCat === "performance" ? activeCat : "video", type: "video", title: "영상", desc: "", thumb: `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`, src: url, uploadedBy: me.email, uploadedAt: Date.now() });
    $("#ytUrl").value = "";
    await Store.saveProject(p);
    toast("영상 링크가 추가되었습니다");
    if (activeCat !== "video" && activeCat !== "performance") activeCat = "video";
    drawTabs();
    drawAssets();
  });

  drawTabs();
  drawAssets();

  // 떠나기 전 경고
  window.onbeforeunload = () => (dirty ? true : undefined);
}

function bindDrop(el, onFiles) {
  ["dragenter", "dragover"].forEach((ev) =>
    el.addEventListener(ev, (e) => {
      e.preventDefault();
      el.classList.add("over");
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    el.addEventListener(ev, (e) => {
      e.preventDefault();
      el.classList.remove("over");
    })
  );
  el.addEventListener("drop", (e) => e.dataTransfer.files.length && onFiles(e.dataTransfer.files));
}

/* =====================================================================
   구성원 관리
   ===================================================================== */
async function viewUsers() {
  if (me.role !== "admin") {
    content.innerHTML = `<div class="empty-sm">관리자만 접근할 수 있습니다.</div>`;
    return;
  }
  const users = await Store.auth.listUsers();
  const pending = users.filter((u) => u.status === "pending");
  const active = users.filter((u) => u.status !== "pending").sort((a, b) => (a.role === b.role ? 0 : a.role === "admin" ? -1 : 1));
  const who = (u) => [u.dept, u.position].filter(Boolean).map(esc).join(" · ") || `<span style="opacity:.5">-</span>`;

  content.innerHTML = `
    <div class="content-head">
      <div><h1>구성원 관리</h1><p>가입 신청을 승인하고 구성원 권한을 관리합니다</p></div>
    </div>

    <div class="card ${pending.length ? "card-attn" : ""}">
      <h2>가입 신청 승인 대기 <small>${pending.length}건</small></h2>
      ${
        pending.length
          ? `<table class="table">
          <thead><tr><th>이름</th><th>소속 · 직책</th><th>이메일</th><th>신청일</th><th></th></tr></thead>
          <tbody>${pending
            .map(
              (u) => `<tr>
            <td class="t">${esc(u.name)}</td><td>${who(u)}</td><td>${esc(u.email)}</td>
            <td class="s">${new Date(u.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}</td>
            <td><div class="acts">
              <button class="btn sm primary" data-approve="${u.email}">승인</button>
              <button class="btn sm danger" data-reject="${u.email}">거절</button>
            </div></td></tr>`
            )
            .join("")}</tbody></table>`
          : `<div class="empty-sm" style="padding:16px 0">대기 중인 신청이 없습니다.</div>`
      }
      <p style="font-size:12px;color:var(--muted);margin:12px 0 0">${
        DRIVE
          ? `회사 Google 계정(<b>@${esc(CONFIG.ALLOWED_DOMAIN || "-")}</b>)으로 로그인하면 자동으로 신청이 접수됩니다. 승인 전에는 로그인할 수 없습니다.`
          : `구성원이 로그인 화면의 "구성원 가입 신청"으로 회사 이메일·비밀번호를 등록하면 여기에 표시됩니다. 승인 전에는 로그인할 수 없습니다.`
      }</p>
    </div>

    <div class="card">
      <h2>구성원 직접 추가 <small>관리자가 바로 승인된 계정을 만듭니다</small></h2>
      <form id="addUser" class="row ${DRIVE ? "c4" : "c3"}" style="align-items:end">
        <label class="f"><span>이름 *</span><input name="name" required></label>
        <label class="f"><span>소속</span><input name="dept" placeholder="기획1팀"></label>
        <label class="f"><span>직책</span><input name="position" placeholder="대리"></label>
        <label class="f"><span>${DRIVE ? "Google 계정 이메일 *" : "회사 이메일 *"}</span><input name="email" type="email" required></label>
        ${DRIVE ? "" : `<label class="f"><span>초기 비밀번호 *</span><input name="pw" type="text" required minlength="6"></label>`}
        <label class="f"><span>권한</span><select name="role"><option value="editor">구성원 (업로드·편집)</option><option value="admin">관리자 (전체)</option></select></label>
        <button class="btn primary" style="grid-column:1/-1;justify-self:start">추가</button>
      </form>
    </div>

    <div class="card" style="padding:0 6px"><table class="table">
      <thead><tr><th>이름</th><th>소속 · 직책</th><th>이메일</th><th>권한</th><th>상태</th><th>등록일</th><th></th></tr></thead>
      <tbody>${active
        .map(
          (u) => `<tr>
          <td class="t">${esc(u.name)}${u.email === me.email ? ` <span class="pill" style="margin-left:4px">나</span>` : ""}</td>
          <td>${who(u)}</td>
          <td>${esc(u.email)}</td>
          <td><span class="pill ${u.role === "admin" ? "on" : ""}">${u.role === "admin" ? "관리자" : "구성원"}</span></td>
          <td><span class="pill ${u.status === "rejected" ? "off" : "on"}">${u.status === "rejected" ? "거절됨" : "승인"}</span></td>
          <td class="s">${new Date(u.createdAt).toLocaleDateString("ko-KR")}</td>
          <td><div class="acts">
            <button class="btn sm" data-profile="${u.email}">정보 수정</button>
            ${u.email !== me.email ? `<button class="btn sm" data-role="${u.email}" data-to="${u.role === "admin" ? "editor" : "admin"}">${u.role === "admin" ? "구성원으로" : "관리자로"}</button>` : ""}
            ${u.status === "rejected" ? `<button class="btn sm primary" data-approve="${u.email}">승인</button>` : ""}
            ${DRIVE ? "" : `<button class="btn sm" data-pw="${u.email}">비밀번호 재설정</button>`}
            ${u.email !== me.email ? `<button class="btn sm danger" data-urm="${u.email}">삭제</button>` : ""}
          </div></td></tr>`
        )
        .join("")}</tbody>
    </table></div>`;

  $("#addUser").addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await Store.auth.addUser({ name: fd.get("name"), dept: fd.get("dept"), position: fd.get("position"), email: fd.get("email"), pw: fd.get("pw"), role: fd.get("role") });
      toast("구성원이 추가되었습니다");
      viewUsers();
      refreshBadges();
    } catch (err) {
      toast(err.message, "err");
    }
  });
  $$("[data-approve]").forEach((b) =>
    b.addEventListener("click", async () => {
      await Store.auth.updateUser(b.dataset.approve, { status: "approved" });
      toast(`${b.dataset.approve} 승인되었습니다`);
      viewUsers();
      refreshBadges();
    })
  );
  $$("[data-reject]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm(`${b.dataset.reject} 의 가입 신청을 거절할까요?`)) return;
      await Store.auth.updateUser(b.dataset.reject, { status: "rejected" });
      viewUsers();
      refreshBadges();
    })
  );
  $$("[data-profile]").forEach((b) =>
    b.addEventListener("click", async () => {
      const u = users.find((x) => x.email === b.dataset.profile);
      const name = prompt("이름", u.name);
      if (name === null) return;
      const dept = prompt("소속", u.dept || "");
      if (dept === null) return;
      const position = prompt("직책", u.position || "");
      if (position === null) return;
      await Store.auth.updateUser(u.email, { name: name.trim() || u.name, dept: dept.trim(), position: position.trim() });
      if (u.email === me.email) {
        me = { ...me, name: name.trim() || u.name, dept: dept.trim(), position: position.trim() };
        sessionStorage.setItem(DRIVE ? "wellbi-drive-user" : "wellbi-admin-session", JSON.stringify(me));
        showAdmin();
      }
      toast("정보가 수정되었습니다");
      viewUsers();
    })
  );
  $$("[data-role]").forEach((b) =>
    b.addEventListener("click", async () => {
      await Store.auth.updateUser(b.dataset.role, { role: b.dataset.to });
      viewUsers();
    })
  );
  $$("[data-pw]").forEach((b) =>
    b.addEventListener("click", async () => {
      const pw = prompt(`${b.dataset.pw} 의 새 비밀번호 (6자 이상)`);
      if (!pw || pw.length < 6) return;
      await Store.auth.updateUser(b.dataset.pw, { pw });
      toast("비밀번호가 변경되었습니다");
    })
  );
  $$("[data-urm]").forEach((b) =>
    b.addEventListener("click", async () => {
      if (!confirm(`${b.dataset.urm} 계정을 삭제할까요?`)) return;
      await Store.auth.removeUser(b.dataset.urm);
      viewUsers();
    })
  );
}

/* =====================================================================
   설정 · 백업
   ===================================================================== */
async function viewSettings() {
  const usage = await Store.storageUsage();
  content.innerHTML = `
    <div class="content-head"><div><h1>설정 · 백업</h1><p>데이터 내보내기 / 가져오기 및 저장소 정보</p></div></div>
    <div class="card">
      <h2>저장소</h2>
      ${
        DRIVE
          ? `<p style="margin:0 0 6px">현재 모드: <span class="pill on">Google Drive</span></p>
      <p style="font-size:13px;color:var(--muted);margin:0 0 14px;line-height:1.7">
        루트 폴더: <a href="https://drive.google.com/drive/folders/${esc(CONFIG.DRIVE_ROOT_FOLDER_ID)}" target="_blank" rel="noopener">Drive에서 열기 ↗</a><br>
        프로젝트 메타는 각 폴더의 <code>project.json</code>, 공개 사이트는 루트의 <code>index.json</code> 을 읽습니다.<br>
        Drive에서 직접 파일을 정리했거나 index.json 이 깨진 경우 아래 "색인 다시 만들기"를 실행하세요.
      </p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="btn" id="rebuild">색인(index.json) 다시 만들기</button>
        <span id="rebuildMsg" style="font-size:12px;color:var(--muted)"></span>
      </div>`
          : `<p style="margin:0 0 6px">현재 모드: <span class="pill off">프로토타입 (브라우저 내부 저장)</span></p>
      <p style="font-size:13px;color:var(--muted);margin:0 0 14px;line-height:1.7">
        지금은 이 브라우저의 IndexedDB에만 저장되어 다른 PC·구성원과 공유되지 않습니다.<br>
        <code>config.js</code> 에 Google 설정을 채우면 <b>Google Drive + Google 계정 로그인</b>으로 전환되어 모든 구성원이 같은 데이터를 보게 됩니다.
      </p>`
      }
      <p style="font-size:13px;color:var(--muted);margin:14px 0 0">업로드된 파일: ${usage.count}개 · ${Store.fmtBytes(usage.bytes)}</p>
    </div>
    <div class="card">
      <h2>백업 · 이관</h2>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn" id="exp">프로젝트 데이터 내보내기 (JSON)</button>
        <label class="btn">프로젝트 데이터 가져오기 (JSON)<input type="file" id="imp" accept="application/json" hidden></label>
      </div>
      <p style="font-size:12px;color:var(--muted);margin:12px 0 0">JSON에는 프로젝트 정보와 자료 목록(경로)이 포함됩니다. ${DRIVE ? "가져오기 시 각 프로젝트의 project.json 과 index.json 이 Drive에 다시 기록됩니다." : "프로토타입에서 올린 파일(local: 키)은 Drive로 자동 이관되지 않으므로 Drive 전환 후 다시 업로드하세요."}</p>
      ${
        DRIVE
          ? ""
          : `<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--line)">
        <button class="btn" id="reseed">샘플 프로젝트 다시 불러오기</button>
        <span style="font-size:12px;color:var(--muted);margin-left:10px">data.js 의 샘플 7건을 최신 내용으로 덮어씁니다 (직접 만든 프로젝트·업로드 파일·구성원은 유지)</span>
      </div>`
      }
    </div>
    ${
      DRIVE
        ? ""
        : `<div class="card">
      <h2>Google Drive 전환 준비 체크리스트</h2>
      <ol style="margin:0;padding-left:20px;font-size:14px;line-height:2;color:#c3cbd9">
        <li>Google Cloud Console → 새 프로젝트 → <b>Google Drive API</b> 사용 설정</li>
        <li>OAuth 동의 화면 (내부용 / Internal) 구성</li>
        <li>OAuth 클라이언트 ID (웹 애플리케이션) + API 키 발급 → 승인된 JavaScript 원본에 사이트 주소 등록</li>
        <li>공유 드라이브에 <code>WELLBI Archive</code> 폴더 생성 → "링크가 있는 모든 사용자 - 뷰어" 공유, 구성원 편집 권한 부여</li>
        <li><code>config.js</code> 의 GOOGLE_CLIENT_ID / GOOGLE_API_KEY / DRIVE_ROOT_FOLDER_ID 입력</li>
        <li>사이트 호스팅 (GitHub Pages, 무료)</li>
      </ol>
      <p style="font-size:12px;color:var(--muted);margin:12px 0 0">자세한 절차는 저장소 README.md 참고</p>
    </div>`
    }`;

  $("#rebuild")?.addEventListener("click", async () => {
    const b = $("#rebuild");
    b.disabled = true;
    $("#rebuildMsg").textContent = "Drive 폴더를 훑는 중…";
    try {
      const n = await Store.rebuildIndex();
      $("#rebuildMsg").textContent = `완료 · 프로젝트 ${n}건`;
      toast("색인을 다시 만들었습니다");
    } catch (err) {
      $("#rebuildMsg").textContent = "";
      toast("실패: " + err.message, "err");
    } finally {
      b.disabled = false;
    }
  });

  $("#reseed")?.addEventListener("click", async () => {
    if (!confirm("샘플 프로젝트 7건을 data.js 최신 내용으로 덮어쓸까요?\n샘플에 직접 올린 파일·기록은 사라집니다.")) return;
    const n = await Store.reseedSamples();
    toast(`샘플 ${n}건을 다시 불러왔습니다`);
    refreshBadges();
  });

  $("#exp").addEventListener("click", async () => {
    const blob = new Blob([await Store.exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `wellbi-archive-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  });
  $("#imp").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const label = e.target.closest("label");
    const orig = label.firstChild.textContent;
    label.classList.add("disabled");
    try {
      const n = await Store.importJSON(await f.text(), {
        onProgress: (done, total, title) => {
          label.firstChild.textContent = `가져오는 중… ${done}/${total}`;
        },
      });
      toast(`${n}개 프로젝트를 가져왔습니다`);
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      toast("가져오기 실패: " + err.message, "err");
    } finally {
      label.firstChild.textContent = orig;
      label.classList.remove("disabled");
      e.target.value = "";
    }
  });
}

/* =====================================================================
   라우터
   ===================================================================== */
function route() {
  if (!me) return showLogin();
  const seg = (location.hash || (me.role === "admin" ? "#/dashboard" : "#/projects")).replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const nav = seg[0] === "edit" ? "projects" : seg[0];
  $$("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === nav));
  window.onbeforeunload = null;
  content.scrollTop = 0;
  window.scrollTo(0, 0);

  if (seg[0] === "dashboard") viewDashboard();
  else if (seg[0] === "new") viewEdit(null);
  else if (seg[0] === "edit" && seg[1]) viewEdit(seg[1]);
  else if (seg[0] === "users") viewUsers();
  else if (seg[0] === "settings") viewSettings();
  else viewProjects();
  refreshBadges();
}

window.addEventListener("hashchange", route);

(async () => {
  try {
    await Store.init();
  } catch (err) {
    console.error(err);
    toast("저장소 초기화 실패: " + err.message, "err");
  }
  me = Store.auth.current();
  if (me) {
    showAdmin();
    route();
  } else showLogin();
})();
