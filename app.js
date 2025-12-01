import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// Your Supabase data (plugged in)
const SUPABASE_URL = "https://pgcririgwmezvulabvuh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnY3Jpcmlnd21lenZ1bGFidnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MDg4ODIsImV4cCI6MjA4MDE4NDg4Mn0.z0JTFGLTQBeUr4dzPl-310me-zLU3kGFZLofcKUWT6s";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elements
const actionsCard = document.getElementById("actionsCard");
const checkCard   = document.getElementById("checkCard");
const reportCard  = document.getElementById("reportCard");

const checkBtn = document.getElementById("checkBtn");
const reportBtn = document.getElementById("reportBtn");

const checkQuery = document.getElementById("checkQuery");
const doCheckBtn = document.getElementById("doCheckBtn");
const checkResult = document.getElementById("checkResult");
const reportsBlock = document.getElementById("reportsBlock");
const backFromCheck = document.getElementById("backFromCheck");

const reportTarget = document.getElementById("reportTarget");
const reportMessage = document.getElementById("reportMessage");
const doReportBtn = document.getElementById("doReportBtn");
const reportMsg = document.getElementById("reportMsg");
const backFromReport = document.getElementById("backFromReport");

// Helpers
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }
function setMsg(el, text, ok=true) {
  el.classList.remove("ok","err");
  el.classList.add(ok ? "ok" : "err");
  el.textContent = text;
}
function setLoading(btn, isLoading, label="") {
  btn.disabled = isLoading;
  btn.innerHTML = isLoading
    ? `<span class="spinner"></span>${label || btn.dataset.label || "Loading..."}`
    : (btn.dataset.label || btn.textContent);
}

// Textarea auto-grow
function autoGrow(t) {
  t.style.height = "auto";
  t.style.height = t.scrollHeight + "px";
}
reportMessage.addEventListener("input", () => autoGrow(reportMessage));
window.addEventListener("load", () => autoGrow(reportMessage));

// Navigation
checkBtn.onclick = () => { hide(actionsCard); show(checkCard); };
reportBtn.onclick = () => { hide(actionsCard); show(reportCard); };

backFromCheck.onclick = () => {
  hide(checkCard);
  show(actionsCard);
  setMsg(checkResult, "");
  reportsBlock.innerHTML = "";
  hide(reportsBlock);
  checkQuery.value = "";
};

backFromReport.onclick = () => {
  hide(reportCard);
  show(actionsCard);
  setMsg(reportMsg, "");
  reportTarget.value = "";
  reportMessage.value = "";
  autoGrow(reportMessage);
};

// CHECK USER
doCheckBtn.dataset.label = "Find";
doCheckBtn.onclick = async () => {
  const q = checkQuery.value.trim();
  if (!q) {
    setMsg(checkResult, "Enter UID or nickname.", false);
    hide(reportsBlock);
    return;
  }

  setLoading(doCheckBtn, true, "Searching");
  setMsg(checkResult, "");
  reportsBlock.innerHTML = "";
  hide(reportsBlock);

  // 1) find user by UID
  let { data: users, error } = await db
    .from("users")
    .select("uid, nickname")
    .eq("uid", q)
    .limit(1);

  // 2) if not found, try nickname
  if (!error && (!users || users.length === 0)) {
    ({ data: users, error } = await db
      .from("users")
      .select("uid, nickname")
      .ilike("nickname", q)
      .limit(1));
  }

  if (error) {
    setLoading(doCheckBtn, false);
    setMsg(checkResult, error.message, false);
    return;
  }

  if (!users || users.length === 0) {
    setLoading(doCheckBtn, false);
    setMsg(checkResult, "Player not found.", false);
    return;
  }

  const user = users[0];
  setMsg(checkResult, `Player found: nickname=${user.nickname}, UID=${user.uid}`, true);

  // 3) fetch reports for this user (by uid or nickname)
  const { data: reports, error: repErr } = await db
    .from("reports")
    .select("message, created_at, reported_uid, reported_nickname")
    .or(`reported_uid.eq.${user.uid},reported_nickname.ilike.${user.nickname}`)
    .order("created_at", { ascending: false });

  setLoading(doCheckBtn, false);

  if (repErr) {
    setMsg(checkResult, `Player found, but couldn't load reports: ${repErr.message}`, false);
    return;
  }

  if (!reports || reports.length === 0) {
    reportsBlock.innerHTML = `<div class="report-item">No reports for this user.</div>`;
    show(reportsBlock);
    return;
  }

  reportsBlock.innerHTML = reports.map(r => {
    const date = new Date(r.created_at).toLocaleString();
    return `
      <div class="report-item">
        ${escapeHtml(r.message)}
        <div class="report-meta">Reported at: ${date}</div>
      </div>
    `;
  }).join("");

  show(reportsBlock);
};

// REPORT USER
doReportBtn.dataset.label = "Submit report";
doReportBtn.onclick = async () => {
  const target = reportTarget.value.trim();
  const message = reportMessage.value.trim();

  if (!target) {
    setMsg(reportMsg, "UID or nickname is required.", false);
    return;
  }
  if (!message) {
    setMsg(reportMsg, "Report message is required.", false);
    return;
  }

  setLoading(doReportBtn, true, "Submitting");
  setMsg(reportMsg, "");

  // Decide if target is UID-like or nickname-like
  // Simple heuristic: if it has digits only (or mostly), treat as UID
  const isUid = /^[0-9A-Za-z_-]{3,}$/.test(target) && /\d/.test(target);

  const payload = isUid
    ? { reported_uid: target, reported_nickname: null, message }
    : { reported_uid: null, reported_nickname: target, message };

  const { error } = await db.from("reports").insert([payload]);

  setLoading(doReportBtn, false);

  if (error) {
    setMsg(reportMsg, error.message, false);
  } else {
    setMsg(reportMsg, "Report saved. Thanks!", true);
    reportTarget.value = "";
    reportMessage.value = "";
    autoGrow(reportMessage);
  }
};

// tiny XSS-safe helper for report text
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",
    "\"":"&quot;","'":"&#039;"
  }[m]));
}