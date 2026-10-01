/* =====================================================================
   WELLBI Archive - Storage Layer
   ---------------------------------------------------------------------
   공개 사이트(app.js)와 관리자(admin.js)가 공통으로 사용하는 데이터 계층.

   두 가지 구현을 같은 인터페이스로 제공하고, config.js 값에 따라 선택합니다.
     - LocalStore : 브라우저 IndexedDB (프로토타입 — 같은 PC/브라우저 안에서만 유지)
     - DriveStore : Google Drive (회사 Google Workspace, 모든 구성원 공유)  ← CONFIG.DRIVE_ENABLED

   인터페이스
     Store.mode                         → "local" | "drive"
     Store.init()                       → Promise<void>
     Store.getProjects()                → Promise<Project[]>
     Store.saveProject(project)         → Promise<Project>
     Store.deleteProject(id)            → Promise<void>
     Store.uploadFile(file, opts)       → Promise<{ src, thumb, type, size }>
     Store.resolveUrl(key)              → Promise<string>   (저장 키 → 표시용 URL)
     Store.removeFileIfLocal(key)       → Promise<void>
     Store.storageUsage()               → Promise<{count, bytes}>
     Store.auth.login(...)              → Promise<User>     (local: email,pw / drive: 인자 없음, Google 팝업)
     Store.auth.logout()
     Store.auth.current()               → User | null
     Store.auth.listUsers() / addUser / updateUser / removeUser
     Store.exportJSON() / importJSON()  → 백업·이관용
     Store.slugify / Store.fmtBytes

   Drive 폴더 구조
     <ROOT>/
       index.json                         ← 전체 프로젝트 메타 (공개 사이트는 이 파일 하나만 읽음)
       members.json                       ← 관리자 콘솔 접근 허용 목록
       <연도>/<분야>/<프로젝트명>/
          project.json                    ← 프로젝트 메타 원본
          제안서/ 정량서류/ 기록사진/ 영상/ 기념품/ 공연/ 디자인·시안/ 기타/ _thumb/

   자료 키 형식
     drive:img:<fileId>   이미지 (lh3 CDN 으로 표시, 공개 공유 필요)
     drive:file:<fileId>  PDF·영상·기타 (Drive 미리보기 iframe)
     local:<key>          IndexedDB Blob (프로토타입)
     그 외                 외부 URL 그대로
   ===================================================================== */

/* ---------- 공용 유틸 ---------- */
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^\w가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "project";
const fmtBytes = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : b < 1073741824 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1073741824).toFixed(2)} GB`);

function fitSize(w, h, max) {
  if (w <= max && h <= max) return [w, h];
  const r = Math.min(max / w, max / h);
  return [Math.round(w * r), Math.round(h * r)];
}
function loadImage(blob) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(blob);
  });
}
// 이미지 축소 → JPEG Blob (표시용 2000px / 썸네일 640px)
async function resizeImage(file, max, quality = 0.86) {
  const img = await loadImage(file);
  const [w, h] = fitSize(img.naturalWidth, img.naturalHeight, max);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d").drawImage(img, 0, 0, w, h);
  URL.revokeObjectURL(img.src);
  return new Promise((res) => c.toBlob(res, "image/jpeg", quality));
}
const sortProjects = (list) => list.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, "ko"));
const fileKind = (file) => (file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : file.type.startsWith("video/") ? "video" : "link");

/* =====================================================================
   1) LocalStore — IndexedDB 프로토타입
   ===================================================================== */
const LocalStore = (() => {
  const DB_NAME = "wellbi-archive";
  const DB_VER = 1;
  let db;

  function open() {
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("projects")) d.createObjectStore("projects", { keyPath: "id" });
        if (!d.objectStoreNames.contains("files")) d.createObjectStore("files", { keyPath: "key" });
        if (!d.objectStoreNames.contains("users")) d.createObjectStore("users", { keyPath: "email" });
        if (!d.objectStoreNames.contains("meta")) d.createObjectStore("meta", { keyPath: "key" });
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  const tx = (store, mode, fn) =>
    new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const r = fn(t.objectStore(store));
      t.oncomplete = () => res(r && r.result !== undefined ? r.result : undefined);
      t.onerror = () => rej(t.error);
    });
  const getAll = (store) => tx(store, "readonly", (s) => s.getAll());
  const put = (store, v) => tx(store, "readwrite", (s) => s.put(v));
  const del = (store, k) => tx(store, "readwrite", (s) => s.delete(k));
  const get = (store, k) => tx(store, "readonly", (s) => s.get(k));

  async function init() {
    if (db) return;
    db = await open();
    const seeded = await get("meta", "seeded");
    if (!seeded) {
      if (typeof PROJECTS !== "undefined") for (const p of PROJECTS) await put("projects", p);
      await put("users", { email: "admin@wellbi.co.kr", pw: "admin1234", name: "관리자", role: "admin", createdAt: Date.now() });
      await put("meta", { key: "seeded", value: true });
    }
  }

  async function getProjects() {
    return sortProjects(await getAll("projects"));
  }
  async function saveProject(p) {
    p.updatedAt = Date.now();
    if (!p.createdAt) p.createdAt = p.updatedAt;
    await put("projects", p);
    return p;
  }
  async function deleteProject(id) {
    const p = await get("projects", id);
    if (p) for (const a of p.assets || []) await removeFileIfLocal(a.src), await removeFileIfLocal(a.thumb);
    await del("projects", id);
  }

  const urlCache = new Map();
  async function putFile(blob, name) {
    const key = `local:${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name.replace(/[^\w.-]/g, "_")}`;
    await put("files", { key, blob, type: blob.type, size: blob.size, name, createdAt: Date.now() });
    return key;
  }
  async function resolveUrl(key) {
    if (!key || !key.startsWith("local:")) return key || "";
    if (urlCache.has(key)) return urlCache.get(key);
    const rec = await get("files", key);
    if (!rec) return "";
    const u = URL.createObjectURL(rec.blob);
    urlCache.set(key, u);
    return u;
  }
  async function removeFileIfLocal(key) {
    if (key && key.startsWith("local:")) await del("files", key);
  }
  async function uploadFile(file, opts = {}) {
    const onProgress = opts.onProgress || (() => {});
    if (file.type.startsWith("image/")) {
      onProgress(0.2);
      const display = await resizeImage(file, 2000, 0.86);
      onProgress(0.6);
      const thumb = await resizeImage(file, 640, 0.8);
      onProgress(0.8);
      const src = await putFile(display, file.name);
      const th = await putFile(thumb, "thumb-" + file.name);
      onProgress(1);
      return { src, thumb: th, type: "image", size: display.size };
    }
    onProgress(0.3);
    const src = await putFile(file, file.name);
    let thumb = "";
    if (opts.thumbFile) thumb = await putFile(await resizeImage(opts.thumbFile, 640, 0.8), "thumb-" + file.name);
    onProgress(1);
    return { src, thumb, type: fileKind(file), size: file.size };
  }
  async function storageUsage() {
    const files = await getAll("files");
    return { count: files.length, bytes: files.reduce((n, f) => n + (f.size || 0), 0) };
  }

  const SESSION_KEY = "wellbi-admin-session";
  const auth = {
    async login(email, pw) {
      const u = await get("users", email.trim().toLowerCase());
      if (!u || u.pw !== pw) throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
      const s = { email: u.email, name: u.name, role: u.role };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      return s;
    },
    logout() {
      sessionStorage.removeItem(SESSION_KEY);
    },
    current() {
      try {
        return JSON.parse(sessionStorage.getItem(SESSION_KEY));
      } catch {
        return null;
      }
    },
    async listUsers() {
      return (await getAll("users")).map(({ pw, ...u }) => u);
    },
    async addUser({ email, pw, name, role = "editor" }) {
      email = email.trim().toLowerCase();
      if (await get("users", email)) throw new Error("이미 등록된 이메일입니다.");
      await put("users", { email, pw, name, role, createdAt: Date.now() });
    },
    async updateUser(email, patch) {
      const u = await get("users", email);
      if (!u) throw new Error("사용자를 찾을 수 없습니다.");
      await put("users", { ...u, ...patch });
    },
    async removeUser(email) {
      await del("users", email);
    },
  };

  async function exportJSON() {
    return JSON.stringify({ exportedAt: new Date().toISOString(), projects: await getProjects() }, null, 2);
  }
  async function importJSON(text) {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data.projects;
    for (const p of list) await put("projects", p);
    return list.length;
  }

  return { mode: "local", init, getProjects, saveProject, deleteProject, uploadFile, resolveUrl, removeFileIfLocal, storageUsage, auth, exportJSON, importJSON, slugify, fmtBytes };
})();

/* =====================================================================
   2) DriveStore — Google Drive
   ---------------------------------------------------------------------
   - 공개 사이트: API 키로 <ROOT>/index.json 만 읽음 (로그인 불필요)
   - 관리자:      Google 로그인(GIS) → 액세스 토큰으로 Drive API 호출
   - 파일 표시:   폴더가 "링크가 있는 모든 사용자 - 뷰어" 로 공유되어 있어야 함
   ===================================================================== */
const DriveStore = (() => {
  const API = "https://www.googleapis.com/drive/v3";
  const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
  const SCOPES = "https://www.googleapis.com/auth/drive openid email profile";
  const TOKEN_KEY = "wellbi-drive-token";
  const USER_KEY = "wellbi-drive-user";
  const FOLDER = "application/vnd.google-apps.folder";
  const INDEX = "index.json";
  const MEMBERS = "members.json";
  const DRIVE_PARAMS = "supportsAllDrives=true";
  const LIST_PARAMS = "supportsAllDrives=true&includeItemsFromAllDrives=true";

  let tokenClient = null;
  let indexCache = null; // { projects: [...] }
  const folderCache = new Map(); // "parentId/name" → id

  const cfg = () => CONFIG;
  const q = (s) => encodeURIComponent(s.replace(/'/g, "\\'"));

  /* ---------- 토큰 ---------- */
  const getToken = () => {
    try {
      const t = JSON.parse(sessionStorage.getItem(TOKEN_KEY));
      return t && t.exp > Date.now() + 30_000 ? t.access_token : null;
    } catch {
      return null;
    }
  };
  const setToken = (resp) => sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ access_token: resp.access_token, exp: Date.now() + (resp.expires_in - 60) * 1000 }));

  function ensureGis() {
    return new Promise((res, rej) => {
      if (window.google?.accounts?.oauth2) return res();
      const s = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
      if (!s) return rej(new Error("Google Identity 스크립트가 로드되지 않았습니다. index.html / admin.html 에 gsi/client 스크립트를 추가하세요."));
      s.addEventListener("load", () => res());
      s.addEventListener("error", () => rej(new Error("Google Identity 스크립트 로드 실패")));
      setTimeout(() => (window.google?.accounts?.oauth2 ? res() : rej(new Error("Google Identity 로드 시간 초과"))), 8000);
    });
  }
  // prompt: "" → 이미 동의한 계정이면 팝업 없이 갱신, "consent" → 계정 선택 팝업
  async function requestToken(prompt = "") {
    await ensureGis();
    return new Promise((res, rej) => {
      if (!tokenClient) {
        tokenClient = google.accounts.oauth2.initTokenClient({ client_id: cfg().GOOGLE_CLIENT_ID, scope: SCOPES, callback: () => {} });
      }
      tokenClient.callback = (resp) => {
        if (resp.error) return rej(new Error(resp.error_description || resp.error));
        setToken(resp);
        res(resp.access_token);
      };
      tokenClient.error_callback = (e) => rej(new Error(e.message || e.type || "로그인이 취소되었습니다."));
      tokenClient.requestAccessToken({ prompt });
    });
  }
  async function token() {
    return getToken() || (await requestToken(""));
  }

  /* ---------- HTTP ---------- */
  async function api(path, { method = "GET", body, headers = {}, auth = true, raw = false } = {}) {
    const h = { ...headers };
    if (auth) h.Authorization = "Bearer " + (await token());
    const url = path.startsWith("http") ? path : API + path;
    const r = await fetch(url, { method, headers: h, body });
    if (!r.ok) {
      let msg = `${r.status} ${r.statusText}`;
      try {
        const j = await r.json();
        msg = j.error?.message || msg;
      } catch {}
      if (r.status === 401) sessionStorage.removeItem(TOKEN_KEY);
      throw new Error("Drive API: " + msg);
    }
    if (raw) return r;
    return r.status === 204 ? null : r.json();
  }
  const withKey = (path) => path + (path.includes("?") ? "&" : "?") + "key=" + cfg().GOOGLE_API_KEY;

  /* ---------- 폴더/파일 조회 ---------- */
  async function findChild(parentId, name, mimeType, { auth = true } = {}) {
    let qs = `'${parentId}' in parents and name='${name.replace(/'/g, "\\'")}' and trashed=false`;
    if (mimeType) qs += ` and mimeType='${mimeType}'`;
    let path = `/files?q=${encodeURIComponent(qs)}&fields=files(id,name,mimeType,size)&pageSize=5&${LIST_PARAMS}`;
    if (!auth) path = withKey(path);
    const j = await api(path, { auth });
    return j.files?.[0] || null;
  }
  async function ensureFolder(parentId, name) {
    const ck = parentId + "/" + name;
    if (folderCache.has(ck)) return folderCache.get(ck);
    let f = await findChild(parentId, name, FOLDER);
    if (!f) {
      f = await api(`/files?${DRIVE_PARAMS}&fields=id,name`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mimeType: FOLDER, parents: [parentId] }),
      });
    }
    folderCache.set(ck, f.id);
    return f.id;
  }
  async function listChildren(parentId, mimeType) {
    let qs = `'${parentId}' in parents and trashed=false`;
    if (mimeType) qs += ` and mimeType='${mimeType}'`;
    const out = [];
    let pageToken = "";
    do {
      const j = await api(`/files?q=${encodeURIComponent(qs)}&fields=nextPageToken,files(id,name,mimeType,size)&pageSize=200&${LIST_PARAMS}${pageToken ? "&pageToken=" + pageToken : ""}`);
      out.push(...(j.files || []));
      pageToken = j.nextPageToken || "";
    } while (pageToken);
    return out;
  }

  /* ---------- JSON 파일 읽기/쓰기 ---------- */
  async function readJson(fileId, { auth = true } = {}) {
    let path = `/files/${fileId}?alt=media&${DRIVE_PARAMS}`;
    if (!auth) path = withKey(path);
    const r = await api(path, { auth, raw: true });
    return r.json();
  }
  async function uploadBlob(blob, { name, parentId, fileId, mimeType, onProgress }) {
    const meta = { name, mimeType: mimeType || blob.type || "application/octet-stream" };
    if (!fileId) meta.parents = [parentId];
    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" }));
    form.append("file", blob);
    const url = (fileId ? `${UPLOAD}/${fileId}` : UPLOAD) + `?uploadType=multipart&${DRIVE_PARAMS}&fields=id,name,size,mimeType`;
    const tk = await token();
    return new Promise((res, rej) => {
      const x = new XMLHttpRequest();
      x.open(fileId ? "PATCH" : "POST", url);
      x.setRequestHeader("Authorization", "Bearer " + tk);
      if (onProgress) x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      x.onload = () => (x.status < 300 ? res(JSON.parse(x.responseText)) : rej(new Error("Drive 업로드 실패: " + x.status + " " + x.responseText.slice(0, 200))));
      x.onerror = () => rej(new Error("Drive 업로드 네트워크 오류"));
      x.send(form);
    });
  }
  async function writeJson(parentId, name, obj) {
    const existing = await findChild(parentId, name);
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    return uploadBlob(blob, { name, parentId, fileId: existing?.id, mimeType: "application/json" });
  }

  /* ---------- index.json ---------- */
  async function loadIndex({ force = false } = {}) {
    if (indexCache && !force) return indexCache;
    const root = cfg().DRIVE_ROOT_FOLDER_ID;
    const authed = !!getToken();
    let f = null;
    try {
      f = await findChild(root, INDEX, null, { auth: authed });
    } catch (e) {
      if (!authed) throw e;
      f = await findChild(root, INDEX, null, { auth: false }).catch(() => null);
    }
    indexCache = f ? await readJson(f.id, { auth: authed }) : { projects: [] };
    if (!Array.isArray(indexCache.projects)) indexCache.projects = [];
    return indexCache;
  }
  async function saveIndex(projects) {
    indexCache = { updatedAt: new Date().toISOString(), projects };
    await writeJson(cfg().DRIVE_ROOT_FOLDER_ID, INDEX, indexCache);
  }
  // 모든 project.json 을 다시 훑어 index.json 재생성 (복구용)
  async function rebuildIndex() {
    const root = cfg().DRIVE_ROOT_FOLDER_ID;
    const projects = [];
    for (const y of await listChildren(root, FOLDER)) {
      for (const f of await listChildren(y.id, FOLDER)) {
        for (const p of await listChildren(f.id, FOLDER)) {
          const pj = await findChild(p.id, "project.json");
          if (!pj) continue;
          try {
            const data = await readJson(pj.id);
            data.driveFolderId = p.id;
            projects.push(data);
          } catch (e) {
            console.warn("project.json 읽기 실패", p.name, e);
          }
        }
      }
    }
    await saveIndex(projects);
    return projects.length;
  }

  /* ---------- 공개 인터페이스 ---------- */
  async function init() {
    /* 지연 로드 — 첫 getProjects 에서 index 를 읽음 */
  }
  async function getProjects() {
    const idx = await loadIndex();
    return sortProjects(idx.projects.map((p) => JSON.parse(JSON.stringify(p))));
  }

  const fieldLabelOf = (id) => (typeof FIELDS !== "undefined" && FIELDS.find((f) => f.id === id)?.label) || id;
  const safeName = (s) => String(s).replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 100) || "untitled";

  // 프로젝트 폴더 확보: <ROOT>/<연도>/<분야>/<프로젝트명>
  async function ensureProjectFolder(p) {
    const root = cfg().DRIVE_ROOT_FOLDER_ID;
    const yId = await ensureFolder(root, String(p.year));
    const fId = await ensureFolder(yId, safeName(fieldLabelOf(p.field)));
    const want = safeName(p.title);
    if (p.driveFolderId) {
      // 이름/위치가 바뀌었으면 Drive 폴더도 따라감
      try {
        const cur = await api(`/files/${p.driveFolderId}?fields=id,name,parents&${DRIVE_PARAMS}`);
        const patch = {};
        let qs = "";
        if (cur.name !== want) patch.name = want;
        if (!cur.parents?.includes(fId)) qs = `&addParents=${fId}&removeParents=${(cur.parents || []).join(",")}`;
        if (patch.name || qs) {
          await api(`/files/${p.driveFolderId}?fields=id&${DRIVE_PARAMS}${qs}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
          folderCache.clear();
        }
        return p.driveFolderId;
      } catch (e) {
        console.warn("기존 프로젝트 폴더 확인 실패, 새로 생성", e);
      }
    }
    const id = await ensureFolder(fId, want);
    p.driveFolderId = id;
    return id;
  }

  async function saveProject(p) {
    p.updatedAt = Date.now();
    if (!p.createdAt) p.createdAt = p.updatedAt;
    const folderId = await ensureProjectFolder(p);
    await writeJson(folderId, "project.json", p);
    const idx = await loadIndex({ force: true });
    const i = idx.projects.findIndex((x) => x.id === p.id);
    if (i >= 0) idx.projects[i] = p;
    else idx.projects.push(p);
    await saveIndex(idx.projects);
    return p;
  }

  async function deleteProject(id) {
    const idx = await loadIndex({ force: true });
    const p = idx.projects.find((x) => x.id === id);
    if (p?.driveFolderId) {
      // 휴지통으로 이동 (30일 내 복구 가능)
      await api(`/files/${p.driveFolderId}?${DRIVE_PARAMS}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) }).catch((e) => console.warn(e));
    }
    await saveIndex(idx.projects.filter((x) => x.id !== id));
  }

  /* ---------- 파일 ---------- */
  // uploadFile(file, { projectId, section, onProgress, thumbFile })
  //   admin.js 가 projectId / section 을 넘기면 해당 프로젝트의 카테고리 폴더에 저장, 없으면 ROOT/_uploads
  async function targetFolder(opts) {
    const root = cfg().DRIVE_ROOT_FOLDER_ID;
    if (!opts.projectId) return ensureFolder(root, "_uploads");
    const idx = await loadIndex();
    const p = idx.projects.find((x) => x.id === opts.projectId);
    if (!p) return ensureFolder(root, "_uploads");
    const pf = await ensureProjectFolder(p);
    const cat = typeof CATEGORIES !== "undefined" && CATEGORIES.find((c) => c.id === opts.section);
    return ensureFolder(pf, opts.section === "_thumb" ? "_thumb" : safeName(cat?.label || opts.section || "기타"));
  }
  const stripExt = (n) => n.replace(/\.[^.]+$/, "");

  async function uploadFile(file, opts = {}) {
    const onProgress = opts.onProgress || (() => {});
    const parentId = await targetFolder(opts);
    if (file.type.startsWith("image/")) {
      onProgress(0.05);
      const display = await resizeImage(file, 2000, 0.86);
      const thumb = await resizeImage(file, 640, 0.8);
      onProgress(0.15);
      const a = await uploadBlob(display, { name: stripExt(file.name) + ".jpg", parentId, mimeType: "image/jpeg", onProgress: (v) => onProgress(0.15 + v * 0.6) });
      const thumbParent = await ensureFolder(parentId, "_thumb");
      const b = await uploadBlob(thumb, { name: stripExt(file.name) + "_thumb.jpg", parentId: thumbParent, mimeType: "image/jpeg", onProgress: (v) => onProgress(0.75 + v * 0.25) });
      return { src: `drive:img:${a.id}`, thumb: `drive:img:${b.id}`, type: "image", size: display.size };
    }
    const a = await uploadBlob(file, { name: file.name, parentId, onProgress: (v) => onProgress(v * 0.9) });
    let thumb = "";
    if (opts.thumbFile) {
      const t = await resizeImage(opts.thumbFile, 640, 0.8);
      const thumbParent = await ensureFolder(parentId, "_thumb");
      const b = await uploadBlob(t, { name: stripExt(file.name) + "_thumb.jpg", parentId: thumbParent, mimeType: "image/jpeg" });
      thumb = `drive:img:${b.id}`;
    }
    onProgress(1);
    return { src: `drive:file:${a.id}`, thumb, type: fileKind(file), size: Number(a.size) || file.size };
  }

  // 키 → 표시 URL. 공개 공유된 파일만 로그인 없이 표시됨.
  async function resolveUrl(key) {
    if (!key) return "";
    if (key.startsWith("drive:img:")) return `https://lh3.googleusercontent.com/d/${key.slice(10)}`;
    if (key.startsWith("drive:file:")) return `https://drive.google.com/file/d/${key.slice(11)}/preview`;
    if (key.startsWith("local:")) return LocalStore.resolveUrl(key); // 로컬 → Drive 이관 전 잔존 데이터
    return key;
  }
  // 다운로드용 직접 링크 (app.js 가 필요 시 사용)
  const downloadUrl = (key) => (key?.startsWith("drive:") ? `https://drive.google.com/uc?export=download&id=${key.split(":")[2]}` : key);

  async function removeFileIfLocal(key) {
    if (key?.startsWith("drive:")) {
      await api(`/files/${key.split(":")[2]}?${DRIVE_PARAMS}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) }).catch((e) => console.warn("파일 휴지통 이동 실패", e));
    } else if (key?.startsWith("local:")) await LocalStore.removeFileIfLocal(key);
  }

  async function storageUsage() {
    const idx = await loadIndex();
    let count = 0,
      bytes = 0;
    for (const p of idx.projects) for (const a of p.assets || []) if (a.src?.startsWith("drive:")) (count++, (bytes += a.size || 0));
    return { count, bytes };
  }

  /* ---------- 인증 / 구성원 ---------- */
  let membersCache = null;
  async function loadMembers({ force = false } = {}) {
    if (membersCache && !force) return membersCache;
    const f = await findChild(cfg().DRIVE_ROOT_FOLDER_ID, MEMBERS);
    membersCache = f ? await readJson(f.id) : [];
    return membersCache;
  }
  async function saveMembers(list) {
    membersCache = list;
    await writeJson(cfg().DRIVE_ROOT_FOLDER_ID, MEMBERS, list);
  }

  const auth = {
    // Google 팝업 → 이메일 확인 → 허용 목록/도메인 검사
    async login() {
      await requestToken("select_account");
      const info = await api("https://www.googleapis.com/oauth2/v3/userinfo");
      const email = (info.email || "").toLowerCase();
      let members = await loadMembers({ force: true });
      let me = members.find((m) => m.email === email);
      if (!me) {
        const domainOk = cfg().ALLOWED_DOMAIN && email.endsWith("@" + cfg().ALLOWED_DOMAIN);
        const isBootstrap = cfg().BOOTSTRAP_ADMIN && email === cfg().BOOTSTRAP_ADMIN.toLowerCase();
        if (!domainOk && !isBootstrap) {
          sessionStorage.removeItem(TOKEN_KEY);
          throw new Error(`${email} 은(는) 접근 권한이 없습니다. 관리자에게 구성원 등록을 요청하세요.`);
        }
        me = { email, name: info.name || email.split("@")[0], role: isBootstrap || members.length === 0 ? "admin" : "editor", createdAt: Date.now(), picture: info.picture || "" };
        members = [...members, me];
        await saveMembers(members);
      }
      const s = { email: me.email, name: me.name, role: me.role, picture: info.picture || me.picture || "" };
      sessionStorage.setItem(USER_KEY, JSON.stringify(s));
      return s;
    },
    logout() {
      const t = getToken();
      if (t && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(t, () => {});
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
      indexCache = null;
      membersCache = null;
    },
    current() {
      try {
        const u = JSON.parse(sessionStorage.getItem(USER_KEY));
        return u && getToken() ? u : null;
      } catch {
        return null;
      }
    },
    async listUsers() {
      return [...(await loadMembers({ force: true }))];
    },
    async addUser({ email, name, role = "editor" }) {
      email = email.trim().toLowerCase();
      const members = await loadMembers({ force: true });
      if (members.some((m) => m.email === email)) throw new Error("이미 등록된 이메일입니다.");
      await saveMembers([...members, { email, name: name || email.split("@")[0], role, createdAt: Date.now() }]);
    },
    async updateUser(email, patch) {
      const members = await loadMembers({ force: true });
      const i = members.findIndex((m) => m.email === email);
      if (i < 0) throw new Error("사용자를 찾을 수 없습니다.");
      const { pw, ...safe } = patch; // Drive 모드에는 비밀번호 없음
      members[i] = { ...members[i], ...safe };
      await saveMembers(members);
    },
    async removeUser(email) {
      await saveMembers((await loadMembers({ force: true })).filter((m) => m.email !== email));
    },
  };

  /* ---------- 백업 / 이관 ---------- */
  async function exportJSON() {
    return JSON.stringify({ exportedAt: new Date().toISOString(), mode: "drive", projects: await getProjects() }, null, 2);
  }
  async function importJSON(text) {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data.projects;
    for (const p of list) await saveProject(p);
    return list.length;
  }

  return { mode: "drive", init, getProjects, saveProject, deleteProject, uploadFile, resolveUrl, downloadUrl, removeFileIfLocal, storageUsage, auth, exportJSON, importJSON, rebuildIndex, slugify, fmtBytes };
})();

/* ---------- 선택 ---------- */
const Store = typeof CONFIG !== "undefined" && CONFIG.DRIVE_ENABLED ? DriveStore : LocalStore;
