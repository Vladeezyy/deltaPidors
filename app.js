import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// TODO: paste your values here
const SUPABASE_URL = "https://pgcririgwmezvulabvuh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnY3Jpcmlnd21lenZ1bGFidnVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2MDg4ODIsImV4cCI6MjA4MDE4NDg4Mn0.z0JTFGLTQBeUr4dzPl-310me-zLU3kGFZLofcKUWT6s";

const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Elements
const registerCard = document.getElementById("registerCard");
const actionsCard  = document.getElementById("actionsCard");
const checkCard    = document.getElementById("checkCard");
const reportCard   = document.getElementById("reportCard");

const uidInput  = document.getElementById("uidInput");
const nickInput = document.getElementById("nickInput");
const registerBtn = document.getElementById("registerBtn");
const registerMsg = document.getElementById("registerMsg");

const checkBtn = document.getElementById("checkBtn");
const reportBtn = document.getElementById("reportBtn");

const checkQuery = document.getElementById("checkQuery");
const doCheckBtn = document.getElementById("doCheckBtn");
const checkResult = document.getElementById("checkResult");
const backFromCheck = document.getElementById("backFromCheck");

const reportedUid = document.getElementById("reportedUid");
const reason = document.getElementById("reason");
const doReportBtn = document.getElementById("doReportBtn");
const reportMsg = document.getElementById("reportMsg");
const backFromReport = document.getElementById("backFromReport");

const currentUserBadge = document.getElementById("currentUserBadge");

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
function autoGrowTextarea(t) {
  t.style.height = "auto";
  t.style.height = t.scrollHeight + "px";
}
reason.addEventListener("input", () => autoGrowTextarea(reason));
window.addEventListener("load", () => autoGrowTextarea(reason));

// Save current user badge
function refreshBadge() {
  const existingUid = localStorage.getItem("current_uid");
  const existingNick = localStorage.getItem("current_nick");
  currentUserBadge.textContent = existingUid
    ? `You: ${existingNick} (${existingUid})`
    : `Not registered`;
}
refreshBadge();

// Register flow
registerBtn.dataset.label = "Save";
registerBtn.onclick = async () => {
  const uid = uidInput.value.trim();
  const nickname = nickInput.value.trim();

  if (!uid || !nickname) {
    setMsg(registerMsg, "UID and nickname are required.", false);
    return;
  }

  setLoading(registerBtn, true, "Saving");
  setMsg(registerMsg, "");

  const { error } = await db.from("users").insert([{ uid, nickname }]);

  setLoading(registerBtn, false);

  if (error) {
    setMsg(registerMsg, error.message, false);
    return;
  }

  localStorage.setItem("current_uid", uid);
  localStorage.setItem("current_nick", nickname);

  setMsg(registerMsg, "Saved! You can now check/report users.");
  hide(registerCard);
  show(actionsCard);
  refreshBadge();
};

// If already registered in this browser, skip register UI
if (localStorage.getItem("current_uid")) {
  hide(registerCard);
  show(actionsCard);
}

// Navigation
checkBtn.onclick = () => { hide(actionsCard); show(checkCard); };
reportBtn.onclick = () => { hide(actionsCard); show(reportCard); };

backFromCheck.onclick = () => { hide(checkCard); show(actionsCard); };
backFromReport.onclick = () => { hide(reportCard); show(actionsCard); };

// Check user
doCheckBtn.dataset.label = "Find";
doCheckBtn.onclick = async () => {
  const q = checkQuery.value.trim();
  if (!q) {
    setMsg(checkResult, "Enter UID or nickname.", false);
    return;
  }

  setLoading(doCheckBtn, true, "Searching");
  setMsg(checkResult, "");

  let { data, error } = await db
    .from("users")
    .select("uid, nickname")
    .eq("uid", q)
    .limit(1);

  if (!error && (!data || data.length === 0)) {
    ({ data, error } = await db
      .from("users")
      .select("uid, nickname")
      .ilike("nickname", q)
      .limit(1));
  }

  setLoading(doCheckBtn, false);

  if (error) return setMsg(checkResult, error.message, false);

  if (!data || data.length === 0) {
    setMsg(checkResult, "Player not found.", false);
  } else {
    const u = data[0];
    setMsg(checkResult, `Player found: nickname=${u.nickname}, UID=${u.uid}`);
  }
};

// Report user
doReportBtn.dataset.label = "Submit report";
doReportBtn.onclick = async () => {
  const ruid = reportedUid.value.trim();
  if (!ruid) {
    setMsg(reportMsg, "Reported UID is required.", false);
    return;
  }

  setLoading(doReportBtn, true, "Submitting");
  setMsg(reportMsg, "");

  const reporter_uid = localStorage.getItem("current_uid") || null;
  const { error } = await db
    .from("reports")
    .insert([{ reported_uid: ruid, reporter_uid, reason: reason.value.trim() }]);

  setLoading(doReportBtn, false);

  if (error) {
    setMsg(reportMsg, error.message, false);
  } else {
    setMsg(reportMsg, "Report saved. Thanks!");
    reportedUid.value = "";
    reason.value = "";
    autoGrowTextarea(reason);
  }
};
