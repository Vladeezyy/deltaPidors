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

// Helpers
function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }
function msg(el, text, ok=true) {
  el.className = ok ? "ok" : "err";
  el.textContent = text;
}

// Step 1: register user
registerBtn.onclick = async () => {
  const uid = uidInput.value.trim();
  const nickname = nickInput.value.trim();
  if (!uid || !nickname) {
    msg(registerMsg, "UID and nickname are required.", false);
    return;
  }

  const { error } = await db.from("users").insert([{ uid, nickname }]);
  if (error) {
    msg(registerMsg, error.message, false);
    return;
  }

  msg(registerMsg, "Saved! You can now check/report users.");
  hide(registerCard);
  show(actionsCard);

  // store current user for report purposes
  localStorage.setItem("current_uid", uid);
  localStorage.setItem("current_nick", nickname);
};

// If already registered in this browser, skip register UI
const existingUid = localStorage.getItem("current_uid");
if (existingUid) {
  hide(registerCard);
  show(actionsCard);
}

// Actions navigation
checkBtn.onclick = () => { hide(actionsCard); show(checkCard); };
reportBtn.onclick = () => { hide(actionsCard); show(reportCard); };

backFromCheck.onclick = () => { hide(checkCard); show(actionsCard); };
backFromReport.onclick = () => { hide(reportCard); show(actionsCard); };

// Check user by UID or nickname
doCheckBtn.onclick = async () => {
  const q = checkQuery.value.trim();
  if (!q) {
    msg(checkResult, "Enter UID or nickname.", false);
    return;
  }

  // Try UID match first, then nickname
  let { data, error } = await db
    .from("users")
    .select("uid, nickname")
    .eq("uid", q)
    .limit(1);

  if (error) return msg(checkResult, error.message, false);

  if (!data || data.length === 0) {
    ({ data, error } = await db
      .from("users")
      .select("uid, nickname")
      .ilike("nickname", q)
      .limit(1));
  }

  if (error) return msg(checkResult, error.message, false);

  if (!data || data.length === 0) {
    msg(checkResult, "Player not found.", false);
  } else {
    const u = data[0];
    msg(checkResult, `Player found: nickname=${u.nickname}, UID=${u.uid}`);
  }
};

// Report user
doReportBtn.onclick = async () => {
  const ruid = reportedUid.value.trim();
  if (!ruid) {
    msg(reportMsg, "Reported UID is required.", false);
    return;
  }

  const reporter_uid = localStorage.getItem("current_uid") || null;
  const { error } = await db
    .from("reports")
    .insert([{ reported_uid: ruid, reporter_uid, reason: reason.value.trim() }]);

  if (error) {
    msg(reportMsg, error.message, false);
  } else {
    msg(reportMsg, "Report saved. Thanks!");
    reportedUid.value = "";
    reason.value = "";
  }
};
