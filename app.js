import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

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

const reportUid = document.getElementById("reportUid");
const reportNick = document.getElementById("reportNick");
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
  reportUid.value = "";
  reportNick.value = "";
  reportMessage.value = "";
  autoGrow(reportMessage);
};

// REPORT USER
doReportBtn.dataset.label = "Submit report";
doReportBtn.onclick = async () => {
  const uid = reportUid.value.trim() || null;
  const nickname = reportNick.value.trim() || null;
  const message = reportMessage.value.trim();

  if (!uid && !nickname) {
    setMsg(reportMsg, "Please enter at least UID or nickname.", false);
    return;
  }
  if (!message) {
    setMsg(reportMsg, "Report message is required.", false);
    return;
  }

  setLoading(doReportBtn, true, "Submitting");
  setMsg(reportMsg, "");

  const { error } = await db.from("reports").insert([{
    reported_uid: uid,
    reported_nickname: nickname,
    report_message: message
  }]);

  setLoading(doReportBtn, false);

  if (error) {
    setMsg(reportMsg, error.message, false);
  } else {
    setMsg(reportMsg, "Report saved. Thanks!", true);
    reportUid.value = "";
    reportNick.value = "";
    reportMessage.value = "";
    autoGrow(reportMessage);
  }
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

  const { data: reports, error } = await db
    .from("reports")
    .select("reported_uid, reported_nickname, report_message, created_at")
    .or(`reported_uid.eq.${q},reported_nickname.ilike.${q}`)
    .order("created_at", { ascending: false });

  setLoading(doCheckBtn, false);

  if (error) {
    setMsg(checkResult, error.message, false);
    return;
  }

  if (!reports || reports.length === 0) {
    setMsg(checkResult, "No reports found for this user.", false);
    return;
  }

  // show summary (top match)
  const top = reports[0];
  const displayUid = top.reported_uid ?? "—";
  const displayNick = top.reported_nickname ?? "—";
  setMsg(checkResult, `Reports found for: nickname=${displayNick}, UID=${displayUid}`, true);

  reportsBlock.innerHTML = reports.map(r => {
    const date = new Date(r.created_at).toLocaleString();
    return `
      <div class="report-item">
        ${escapeHtml(r.report_message)}
        <div class="report-meta">
          UID: ${escapeHtml(r.reported_uid ?? "—")} •
          Nickname: ${escapeHtml(r.reported_nickname ?? "—")} •
          ${date}
        </div>
      </div>
    `;
  }).join("");

  show(reportsBlock);
};

// tiny XSS-safe helper
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",
    "\"":"&quot;","'":"&#039;"
  }[m]));
}