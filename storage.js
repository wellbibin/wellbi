/* =====================================================================
   WELLBI Archive - Storage Layer
   ---------------------------------------------------------------------
   공개 사이트(app.js)와 관리자(admin.js)가 공통으로 사용하는 데이터 계층.

   현재: 브라우저 IndexedDB (프로토타입 — 같은 PC/브라우저 안에서만 유지)
   추후: 아래 인터페이스를 그대로 유지하면서 내부 구현만 Google Drive로 교체
         - 로그인: Google 계정 (OAuth)  → auth.*
         - 파일:   공유 드라이브 폴더    → uploadFile / resolveUrl
         - 메타:   프로젝트 폴더 안 project.json → getProjects / saveProject

   인터페이스
     Store.init()                       → Promise<void>
     Store.getProjects()                → Promise<Project[]>
     Store.saveProject(project)         → Promise<Project>
     Store.deleteProject(id)            → Promise<void>
     Store.uploadFile(file, opts)       → Promise<{ src, thumb }>   (이미지 축소 + 썸네일 생성)
     Store.auth.login(email, pw)        → Promise<User>
     Store.auth.logout()
     Store.auth.current()               → User | null
     Store.auth.listUsers() / addUser / removeUser
     Store.exportJSON() / importJSON()  → 백업·이관용
   ===================================================================== */

const Store = (() => {
  const DB_NAME = "wellbi-archive";
  const DB_VER = 1;
  let db;

  /* ---------- IndexedDB 기본 ---------- */
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
      const s = t.objectStore(store);
      const r = fn(s);
      t.oncomplete = () => res(r && r.result !== undefined ? r.result : undefined);
      t.onerror = () => rej(t.error);
    });
  const getAll = (store) => tx(store, "readonly", (s) => s.getAll());
  const put = (store, v) => tx(store, "readwrite", (s) => s.put(v));
  const del = (store, k) => tx(store, "readwrite", (s) => s.delete(k));
  const get = (store, k) => tx(store, "readonly", (s) => s.get(k));

  /* ---------- 초기화: 최초 1회 data.js 샘플을 DB로 시딩 ---------- */
  async function init() {
    if (db) return;
    db = await open();
    const seeded = await get("meta", "seeded");
    if (!seeded) {
      if (typeof PROJECTS !== "undefined") for (const p of PROJECTS) await put("projects", p);
      // 기본 관리자 계정 (프로토타입용 — 실제 운영 시 Supabase Auth로 교체)
      await put("users", { email: "admin@wellbi.co.kr", pw: "admin1234", name: "관리자", role: "admin", createdAt: Date.now() });
      await put("meta", { key: "seeded", value: true });
    }
  }

  /* ---------- 프로젝트 ---------- */
  async function getProjects() {
    const list = await getAll("projects");
    return list.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title, "ko"));
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

  /* ---------- 파일 (프로토타입: Blob을 IndexedDB에 저장, 재생 시 object URL) ---------- */
  // R2 전환 시: uploadFile 내부에서 fetch(PUT presigned URL)로 바꾸고 public URL 반환
  const urlCache = new Map();

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
  async function putFile(blob, name) {
    const key = `local:${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name.replace(/[^\w.-]/g, "_")}`;
    await put("files", { key, blob, type: blob.type, size: blob.size, name, createdAt: Date.now() });
    return key;
  }
  async function resolveUrl(key) {
    if (!key || !key.startsWith("local:")) return key; // 외부 URL은 그대로
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

  /**
   * 파일 업로드
   * - 이미지: 표시용(최대 2000px) + 썸네일(최대 640px) 자동 생성 → 원본은 올리지 않음
   * - PDF/영상/기타: 원본 그대로 저장, 썸네일은 opts.thumbFile 또는 없음
   */
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
    if (opts.thumbFile) {
      const t = await resizeImage(opts.thumbFile, 640, 0.8);
      thumb = await putFile(t, "thumb-" + file.name);
    }
    onProgress(1);
    const type = file.type === "application/pdf" ? "pdf" : file.type.startsWith("video/") ? "video" : "link";
    return { src, thumb, type, size: file.size };
  }

  async function storageUsage() {
    const files = await getAll("files");
    return { count: files.length, bytes: files.reduce((n, f) => n + (f.size || 0), 0) };
  }

  /* ---------- 인증 (프로토타입: 로컬 계정, 세션은 sessionStorage) ---------- */
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

  /* ---------- 백업 / 이관 ---------- */
  async function exportJSON() {
    const projects = await getProjects();
    return JSON.stringify({ exportedAt: new Date().toISOString(), projects }, null, 2);
  }
  async function importJSON(text) {
    const data = JSON.parse(text);
    const list = Array.isArray(data) ? data : data.projects;
    for (const p of list) await put("projects", p);
    return list.length;
  }

  /* ---------- 유틸 ---------- */
  const slugify = (s) =>
    s
      .toLowerCase()
      .replace(/[^\w가-힣\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "project";
  const fmtBytes = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : b < 1073741824 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1073741824).toFixed(2)} GB`);

  return { init, getProjects, saveProject, deleteProject, uploadFile, resolveUrl, removeFileIfLocal, storageUsage, auth, exportJSON, importJSON, slugify, fmtBytes };
})();
