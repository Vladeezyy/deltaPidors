import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://pgcririgwmezvulabvuh.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnY3Jpcmlnd21lenZ1bGFidnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MDg4ODIsImV4cCI6MjA4MDE4NDg4Mn0.z0JTFGLTQBeUr4dzPl-310me-zLU3kGFZLofcKUWT6s";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cards
const actionsCard = document.getElementById("actionsCard");
const checkCard   = document.getElementById("checkCard");
const reportCard  = document.getElementById("reportCard");
const listCard    = document.getElementById("listCard");

// Nav
const checkBtn  = document.getElementById("checkBtn");
const reportBtn = document.getElementById("reportBtn");
const listBtn   = document.getElementById("listBtn");

// Check
const checkQuery   = document.getElementById("checkQuery");
const doCheckBtn   = document.getElementById("doCheckBtn");
const checkResult  = document.getElementById("checkResult");
const reportsBlock = document.getElementById("reportsBlock");
const backFromCheck= document.getElementById("backFromCheck");

// Report fields
const reportUid     = document.getElementById("reportUid");
const reportNick    = document.getElementById("reportNick");
const reportMap     = document.getElementById("reportMap");
const reportChar    = document.getElementById("reportChar");
const reportReason  = document.getElementById("reportReason");
const reportNotes   = document.getElementById("reportNotes");
const doReportBtn   = document.getElementById("doReportBtn");
const reportMsg     = document.getElementById("reportMsg");
const backFromReport= document.getElementById("backFromReport");

// OCR UID
const uidShot = document.getElementById("uidShot");
const readUidBtn = document.getElementById("readUidBtn");
const uidOcrBox = document.getElementById("uidOcrBox");
const uidPreview = document.getElementById("uidPreview");
const uidExtracted = document.getElementById("uidExtracted");
const uidRawText = document.getElementById("uidRawText");
const useUidBtn = document.getElementById("useUidBtn");

// OCR Nick
const nickShot = document.getElementById("nickShot");
const readNickBtn = document.getElementById("readNickBtn");
const nickOcrBox = document.getElementById("nickOcrBox");
const nickPreview = document.getElementById("nickPreview");
const nickExtracted = document.getElementById("nickExtracted");
const nickRawText = document.getElementById("nickRawText");
const useNickBtn = document.getElementById("useNickBtn");

// List
const sortSelect   = document.getElementById("sortSelect");
const listViewBtn  = document.getElementById("listViewBtn");
const tableViewBtn = document.getElementById("tableViewBtn");
const listView     = document.getElementById("listView");
const tableView    = document.getElementById("tableView");
const tableBody    = document.getElementById("tableBody");
const listMsg      = document.getElementById("listMsg");
const listCount    = document.getElementById("listCount");
const backFromList = document.getElementById("backFromList");

// Helpers
function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }
function setMsg(el, text, ok=true){
  el.classList.remove("ok","err");
  el.classList.add(ok ? "ok" : "err");
  el.textContent = text;
}
function setLoading(btn, on, label=""){
  btn.disabled = on;
  btn.innerHTML = on
    ? `<span class="spinner"></span>${label || "Loading..."}`
    : (btn.dataset.label || btn.textContent);
}
function escapeHtml(str){
  return String(str ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",
    "\"":"&quot;","'":"&#039;"
  }[m]));
}
function autoGrow(t){
  t.style.height = "auto";
  t.style.height = t.scrollHeight + "px";
}
reportNotes.addEventListener("input", () => autoGrow(reportNotes));
window.addEventListener("load", () => autoGrow(reportNotes));
async function preprocessImage(file, soft = false){
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await new Promise(res => img.onload = res);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = img.width;
  canvas.height = img.height;

  // draw + grayscale + boost contrast
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0,0,canvas.width, canvas.height);

  for (let i=0;i<data.length;i+=4){
    const r=data[i], g=data[i+1], b=data[i+2];
    let v = (r*0.299 + g*0.587 + b*0.114);

    if (!soft) {
      // Strong binarization for UID (best for digits)
      v = v > 140 ? 255 : v < 100 ? 0 : v;
    } else {
      // Soft contrast for nicknames (keeps Chinese/emoji strokes)
      v = v * 1.15;
      if (v > 255) v = 255;
    }

    data[i]=data[i+1]=data[i+2]=v;
  }
  ctx.putImageData(new ImageData(data, canvas.width, canvas.height),0,0);

  return canvas;
}
// Navigation
checkBtn.onclick  = () => { hide(actionsCard); show(checkCard); };
reportBtn.onclick = () => { hide(actionsCard); show(reportCard); };
listBtn.onclick   = () => {
  hide(actionsCard);
  show(listCard);
  // force default view so list and table are not shown together
  show(listView);
  hide(tableView);
  loadAllEntries();
};

backFromCheck.onclick = () => {
  hide(checkCard); show(actionsCard);
  setMsg(checkResult, ""); reportsBlock.innerHTML=""; hide(reportsBlock);
  checkQuery.value="";
};

backFromReport.onclick = () => {
  hide(reportCard); show(actionsCard);
  setMsg(reportMsg, "");
  reportUid.value=""; reportNick.value="";
  reportMap.value=""; reportChar.value="";
  reportReason.value=""; reportNotes.value="";
  autoGrow(reportNotes);
  hide(uidOcrBox); hide(nickOcrBox);
};

backFromList.onclick = () => {
  hide(listCard); show(actionsCard);
  listView.innerHTML=""; tableBody.innerHTML="";
  setMsg(listMsg, "");
};

// -------- OCR logic (client-side AI) --------
async function runOcr(file, previewEl, boxEl, extractedEl, rawEl, kind){
  if (!file) return "";

  let text = "";

  try {
    const url = URL.createObjectURL(file);
    previewEl.src = url;
    show(boxEl);
    extractedEl.textContent = "Reading...";
    rawEl.textContent = "";

    // Preprocess the image into a canvas (grayscale + contrast boost)
    const canvas = await preprocessImage(file, kind === "nick");

    // For nicknames, enable multiple CJK languages + English to handle mixed scripts/symbols.
    const lang = kind === "nick" ? "chi_sim+chi_tra+jpn+kor+eng" : "eng";

    const result = await Tesseract.recognize(
      canvas,
      lang,
      {
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
        // IMPORTANT: whitelist ONLY for UID. For nicknames we allow ANY symbols/emojis.
        ...(kind === "uid"
          ? {
              tessedit_char_whitelist:
                "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_-",
              psm: 7 // single line text
            }
          : {
              psm: 6 // block / mixed characters (Chinese, emojis, symbols)
            })
      }
    );

    text = result?.data?.text || "";
    rawEl.textContent = text;

  } catch (err) {
    console.error("OCR error:", err);
    extractedEl.textContent = "Error reading image";
    rawEl.textContent = err?.message || String(err);
    return "";
  }

  if (kind === "uid") {
    // Heuristic: pick longest alphanumeric chunk containing digits
    const candidates = text
      .replace(/\s+/g, " ")
      .match(/[A-Za-z0-9_-]{4,}/g) || [];
    const best = candidates
      .filter(c => /\d/.test(c))
      .sort((a,b)=>b.length-a.length)[0];
    extractedEl.textContent = best || "Not found";
    return best || "";
  }

  if (kind === "nick") {
    // Heuristic: take the first non-empty line as nickname.
    // We allow ANY characters: Chinese, emojis, cute symbols, punctuation, etc.
    const lines = text
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const best = lines[0] || "";
    extractedEl.textContent = best || "Not found";
    return best || "";
  }

  return "";
}

let lastUidOcr = "";
let lastNickOcr = "";

readUidBtn.onclick = async () => {
  const file = uidShot.files?.[0];
  lastUidOcr = await runOcr(file, uidPreview, uidOcrBox, uidExtracted, uidRawText, "uid");
};
useUidBtn.onclick = () => {
  if (lastUidOcr) reportUid.value = lastUidOcr;
};

readNickBtn.onclick = async () => {
  const file = nickShot.files?.[0];
  lastNickOcr = await runOcr(file, nickPreview, nickOcrBox, nickExtracted, nickRawText, "nick");
};
useNickBtn.onclick = () => {
  if (lastNickOcr) reportNick.value = lastNickOcr;
};

// -------- REPORT USER --------
doReportBtn.dataset.label = "Submit report";
doReportBtn.onclick = async () => {
  const uid = reportUid.value.trim() || null;
  const nickname = reportNick.value.trim() || null;
  const map = reportMap.value;
  const character = reportChar.value || null;
  const reason = reportReason.value;
  const notes = reportNotes.value.trim();

  if (!uid && !nickname) {
    setMsg(reportMsg, "Please enter at least UID or nickname.", false);
    return;
  }
  if (!map) {
    setMsg(reportMsg, "Map is required.", false);
    return;
  }
  if (!reason) {
    setMsg(reportMsg, "Reason type is required.", false);
    return;
  }
  if (!notes) {
    setMsg(reportMsg, "Notes are required.", false);
    return;
  }

  setLoading(doReportBtn, true, "Submitting");
  setMsg(reportMsg, "");

  const { error } = await db.from("reports").insert([{
    reported_uid: uid,
    reported_nickname: nickname,
    map,
    character,
    reason,
    notes
  }]);

  setLoading(doReportBtn, false);

  if (error) {
    setMsg(reportMsg, error.message, false);
  } else {
    setMsg(reportMsg, "Report saved. Thanks!", true);
    reportUid.value=""; reportNick.value="";
    reportMap.value=""; reportChar.value="";
    reportReason.value=""; reportNotes.value="";
    autoGrow(reportNotes);
    hide(uidOcrBox); hide(nickOcrBox);
  }
};

// -------- CHECK USER --------
doCheckBtn.dataset.label = "Find";
doCheckBtn.onclick = async () => {
  const q = checkQuery.value.trim();
  if (!q){
    setMsg(checkResult, "Enter UID or nickname.", false);
    hide(reportsBlock); return;
  }

  setLoading(doCheckBtn, true, "Searching");
  setMsg(checkResult, "");
  reportsBlock.innerHTML=""; hide(reportsBlock);

  const { data: reports, error } = await db
    .from("reports")
    .select("id, reported_uid, reported_nickname, map, character, reason, notes, banned, created_at")
    .or(`reported_uid.eq.${q},reported_nickname.ilike.${q}`)
    .order("created_at", { ascending: false });

  setLoading(doCheckBtn, false);

  if (error){
    setMsg(checkResult, error.message, false); return;
  }
  if (!reports || reports.length===0){
    setMsg(checkResult, "No reports found for this user.", false); return;
  }

  const top = reports[0];
  const displayUid  = top.reported_uid ?? "—";
  const displayNick = top.reported_nickname ?? "—";
  setMsg(checkResult, `Reports found for: nickname=${displayNick}, UID=${displayUid}`, true);

  reportsBlock.innerHTML = reports.map(r=>{
    const date = new Date(r.created_at).toLocaleString();
    return `
      <div class="report-item">
        <strong>${escapeHtml(r.reason)}</strong> — ${escapeHtml(r.notes)}
        <div class="report-meta">
          UID: ${escapeHtml(r.reported_uid ?? "—")} •
          Nickname: ${escapeHtml(r.reported_nickname ?? "—")} •
          Map: ${escapeHtml(r.map ?? "—")} •
          Character: ${escapeHtml(r.character ?? "—")} •
          ${date}
        </div>
      </div>`;
  }).join("");

  show(reportsBlock);
};

// -------- LIST PAGE --------
let allEntries = [];

async function loadAllEntries(){
  setMsg(listMsg, "Loading...", true);
  listView.innerHTML=""; tableBody.innerHTML=""; listCount.textContent="0 entries";

  const { data, error } = await db
    .from("reports")
    .select("id, reported_uid, reported_nickname, map, character, reason, notes, banned, created_at")
    .order("created_at", { ascending: false });

  if (error){
    setMsg(listMsg, error.message, false);
    return;
  }

  allEntries = data || [];
  setMsg(listMsg, "");
  renderEntries();
}

function getDisplayName(e){
  return (e.reported_nickname || e.reported_uid || "").toLowerCase();
}

function dedupeLatestPerUser(entries){
  const map = new Map();
  for (const e of entries) {
    const key = (e.reported_uid || e.reported_nickname || "unknown").toLowerCase();
    const prev = map.get(key);
    if (!prev || new Date(e.created_at) > new Date(prev.created_at)) {
      map.set(key, e);
    }
  }
  return [...map.values()];
}

function renderEntries(){
  // ✅ dedupe to 1 row per user (latest)
  const deduped = dedupeLatestPerUser(allEntries);

  const sorted = [...deduped];
  const mode = sortSelect.value;

  sorted.sort((a,b)=>{
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();

    if (mode === "date_asc") return dateA - dateB;
    if (mode === "date_desc") return dateB - dateA;

    if (mode === "type_cheater") {
      if (a.reason !== b.reason) return a.reason === "cheater" ? -1 : 1;
      return dateB - dateA;
    }
    if (mode === "type_huesos") {
      if (a.reason !== b.reason) return a.reason === "huesos" ? -1 : 1;
      return dateB - dateA;
    }

    return dateB - dateA;
  });

  listCount.textContent = `${sorted.length} entries`;

  // List cards
  listView.innerHTML = sorted.map(e=>{
    const date = new Date(e.created_at).toLocaleString();
    const name = e.reported_nickname || "Unknown";
    const uid  = e.reported_uid || "—";
    const bannedBadge = e.banned ? `<span class="badge-banned">BANNED</span>` : "";

    return `
      <div class="entry-card">
        <div class="entry-top">
          <div class="entry-name">
            ${escapeHtml(name)}
            <span class="tag">UID: ${escapeHtml(uid)}</span>
            <span class="tag">${escapeHtml(e.reason)}</span>
            ${bannedBadge}
          </div>
          <div class="entry-tags">
            <span class="tag">Map: ${escapeHtml(e.map || "—")}</span>
            <span class="tag">Character: ${escapeHtml(e.character || "—")}</span>
          </div>
        </div>
        <div class="entry-reason">${escapeHtml(e.notes || "")}</div>
        <div class="entry-date">${date}</div>
      </div>
    `;
  }).join("");

  // Table rows (with banned toggle)
  tableBody.innerHTML = sorted.map((e, idx)=>{
    const date = new Date(e.created_at).toLocaleString();
    const name = e.reported_nickname || "Unknown";
    const uid  = e.reported_uid || "—";
    const bannedBadge = e.banned ? `<div class="badge-banned">BANNED</div>` : "";
    const toggleText = e.banned ? "Remove banned" : "Mark banned";

    return `
      <tr data-id="${e.id}">
        <td>
          <strong>${escapeHtml(name)}</strong><br/>
          <span class="muted">UID: ${escapeHtml(uid)}</span><br/>
          ${bannedBadge}
        </td>
        <td>${escapeHtml(e.reason)}</td>
        <td>${escapeHtml(e.map || "—")}</td>
        <td>${escapeHtml(e.character || "—")}</td>
        <td>${escapeHtml(e.notes || "")}</td>
        <td>
          ${date}<br/>
          <button class="btn btn-danger btn-banned" data-toggle-banned="${e.id}">
            ${toggleText}
          </button>
        </td>
      </tr>`;
  }).join("");

  // attach click handlers for banned toggle
  document.querySelectorAll("[data-toggle-banned]").forEach(btn=>{
    btn.onclick = async () => {
      const id = btn.getAttribute("data-toggle-banned");
      const row = allEntries.find(x => String(x.id) === String(id));
      if (!row) return;

      const newVal = !row.banned;
      const { error } = await db
        .from("reports")
        .update({ banned: newVal })
        .eq("id", id);

      if (!error){
        row.banned = newVal; // update local cache
        renderEntries();     // rerender
      } else {
        alert(error.message);
      }
    };
  });
}

sortSelect.onchange = renderEntries;
listViewBtn.onclick = () => { show(listView); hide(tableView); };
tableViewBtn.onclick = () => { hide(listView); show(tableView); };