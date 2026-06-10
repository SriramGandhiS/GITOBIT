// ============================================================
//  git-rip Dashboard v3 — Real-Time direct GitHub API Sync
//  No local server dependency. Fetches directly like cricket score!
// ============================================================

const LOCAL_API = "http://localhost:8000";

const REFRESH_MS = 15000; // Refresh every 15s for high live fidelity

// ── TOKENS & PROFILE SETUPS ──
const profiles = {
  sriram: {
    username: "SriramGandhiS",
    name: "SRIRAM GANDHI",
    avatar: "https://github.com/SriramGandhiS.png",
    token: "",
    coreRepo: "Study-and-Code",
    railflowRepo: "RailFlow",
    keepers: ["ROI-THE-LEGAL-APP", "Sriram-Portfolio", "Hiresense.ai", "Javino-AI-Authenticity", "SmartSlate"],
    rotation: {
      1: "Hiresense.ai",
      2: "Javino-AI-Authenticity",
      3: "SmartSlate",
      4: "Sriram-Portfolio",
      5: "Rest Day",
      6: "Rest Day",
      0: "Rest Day"
    },
    workflows: {
      railflow: { repo: "RailFlow", file: "railflow.yml", name: "RailFlow Orchestrator" },
      leetcode: { repo: "Study-and-Code", file: "leetcode.yml", name: "LeetCode Solver" },
      dsa: { repo: "Study-and-Code", file: "dsa.yml", name: "Daily DSA Pusher" },
      repo_updaters: { repo: "Study-and-Code", file: "repo-updaters.yml", name: "Multi-Repo Updaters" }
    }
  },
  suriya: {
    username: "Suriyakumar4036",
    name: "SURIYA KUMAR",
    avatar: "https://github.com/Suriyakumar4036.png",
    token: "",
    coreRepo: "Accerdian-dashboard-Front-end-project-",
    railflowRepo: null,
    keepers: ["smart-ai-resume-analyser", "Suriya-portfolio-", "Accerdian-dashboard-Front-end-project-", "unipay"],
    rotation: {
      1: "smart-ai-resume-analyser",
      2: "Suriya-portfolio-",
      3: "Accerdian-dashboard-Front-end-project-",
      4: "unipay",
      5: "Rest Day",
      6: "Rest Day",
      0: "Rest Day"
    },
    workflows: {}
  },
  rizz: {
    username: "rizz-architect",
    name: "RIZZ ARCHITECT",
    avatar: "https://github.com/rizz-architect.png",
    token: "",
    coreRepo: "SmartSlate",
    railflowRepo: null,
    keepers: ["ROI-THE-LEGAL-APP", "Study-and-Code", "RailFlow"],
    rotation: {
      1: "ROI-THE-LEGAL-APP",
      2: "Study-and-Code",
      3: "RailFlow",
      4: "Study-and-Code",
      5: "Rest Day",
      6: "Rest Day",
      0: "Rest Day"
    },
    workflows: {}
  }
};

let currentProfile = localStorage.getItem("git_rip_active_profile") || "sriram";
if (!profiles[currentProfile]) currentProfile = "sriram";

let schedulerTimes = {};
let masterPasscode = sessionStorage.getItem("git_rip_session_passcode") || "";

// ── DOM ELEMENTS ──
const $ = (id) => document.getElementById(id);

// ── TIME UTILITIES ──
// Formats standard ISO / Github UTC timestamps into Indian 12-Hour format (AM/PM)
function formatTime12h(dateStr) {
  if (!dateStr || dateStr === "--") return "--";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(d) + " IST";
  } catch (e) {
    return dateStr;
  }
}

// Format short version (hh:mm AM/PM)
function formatTime12hShort(dateStr) {
  if (!dateStr || dateStr === "--") return "--";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d) + " IST";
  } catch (e) {
    return dateStr;
  }
}

// Convert "12:04" string into 12-hour "12:04 PM"
function convert24hTo12h(timeStr) {
  if (!timeStr) return "--";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, '0')}:${mStr} ${ampm}`;
}

// ── GITHUB API CLIENT ──
async function ghCall(profile, path, method = "GET", body = null) {
  const url = `https://api.github.com${path}`;
  const headers = {
    "Authorization": `token ${profile.token}`,
    "Accept": "application/vnd.github.v3+json"
  };
  
  const options = { method, headers };
  if (body) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  
  const res = await fetch(url, options);
  if (res.status === 204) return { ok: true, status: 204 };
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API ${res.status}: ${errText}`);
  }
  return await res.json();
}

async function fetchFileContent(profile, repo, path) {
  try {
    const data = await ghCall(profile, `/repos/${profile.username}/${repo}/contents/${path}`);
    if (data && data.content) {
      return JSON.parse(atob(data.content.replace(/\n/g, "")));
    }
  } catch (e) {
    console.warn(`Could not fetch file ${repo}/${path}:`, e);
  }
  return null;
}

// ── SECURE TOKEN SHARING (AES-256-GCM encrypted) ──

// Derive a crypto key from a PIN using PBKDF2
async function deriveKey(pin, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(pin), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt token data with PIN → returns base64 string
async function encryptTokenData(tokenData, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(tokenData))
  );
  // Pack: salt(16) + iv(12) + ciphertext
  const packed = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  packed.set(salt, 0);
  packed.set(iv, salt.length);
  packed.set(new Uint8Array(ciphertext), salt.length + iv.length);
  return btoa(String.fromCharCode(...packed));
}

// Decrypt token data with PIN → returns parsed JSON or null
async function decryptTokenData(encoded, pin) {
  try {
    const packed = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const salt = packed.slice(0, 16);
    const iv = packed.slice(16, 28);
    const ciphertext = packed.slice(28);
    const key = await deriveKey(pin, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch (e) {
    return null; // wrong PIN or corrupted data
  }
}

// Check URL hash for encrypted tokens → prompt for PIN → import
async function importTokensFromHash() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith("#secure=")) return false;

  const encrypted = decodeURIComponent(hash.substring(8));

  // Immediately clean hash from URL bar
  history.replaceState(null, "", window.location.pathname + window.location.search);

  // Prompt for PIN
  const pin = prompt("Enter the PIN you set on desktop to unlock tokens:");
  if (!pin) return false;

  const decoded = await decryptTokenData(encrypted, pin);
  if (!decoded) {
    alert("Wrong PIN or corrupted link. Tokens not imported.");
    return false;
  }

  if (decoded.sriram) {
    profiles.sriram.token = decoded.sriram;
    localStorage.setItem("git_rip_token_sriram", decoded.sriram);
  }
  if (decoded.suriya) {
    profiles.suriya.token = decoded.suriya;
    localStorage.setItem("git_rip_token_suriya", decoded.suriya);
  }
  if (decoded.rizz) {
    profiles.rizz.token = decoded.rizz;
    localStorage.setItem("git_rip_token_rizz", decoded.rizz);
  }

  console.log("Tokens imported from encrypted share link!");
  alert("Tokens imported successfully! Dashboard will now load.");
  return true;
}

// Generate encrypted mobile link (prompts for PIN)
async function copyMobileLink() {
  const tokenData = {};
  if (profiles.sriram.token) tokenData.sriram = profiles.sriram.token;
  if (profiles.suriya.token) tokenData.suriya = profiles.suriya.token;
  if (profiles.rizz.token) tokenData.rizz = profiles.rizz.token;

  if (Object.keys(tokenData).length === 0) {
    alert("No tokens to share. Save your tokens first.");
    return;
  }

  const pin = prompt("Set a PIN to encrypt your tokens (you'll enter this on mobile):");
  if (!pin || pin.length < 4) {
    alert("PIN must be at least 4 characters.");
    return;
  }

  const confirmPin = prompt("Confirm your PIN:");
  if (confirmPin !== pin) {
    alert("PINs don't match. Try again.");
    return;
  }

  try {
    const encrypted = await encryptTokenData(tokenData, pin);
    const baseUrl = window.location.origin + window.location.pathname;
    const link = `${baseUrl}#secure=${encodeURIComponent(encrypted)}`;

    await navigator.clipboard.writeText(link);
    const btn = $("btnCopyMobileLink");
    if (btn) {
      btn.textContent = "Copied!";
      btn.style.background = "#10b981";
      btn.style.color = "#fff";
      setTimeout(() => { btn.textContent = "Copy Mobile Link"; btn.style.background = ""; btn.style.color = ""; }, 3000);
    }
    alert("Encrypted link copied! Send it to your phone and open it there.\nYou'll need to enter the same PIN on mobile.");
  } catch (e) {
    prompt("Copy this encrypted link manually:", `${window.location.origin}${window.location.pathname}#secure=${encodeURIComponent(await encryptTokenData(tokenData, pin))}`);
  }
}
window.copyMobileLink = copyMobileLink;

// ── MASTER PASSCODE CRYPTO HELPERS & SECURITY GATE ──

// Hash passcode using SHA-256
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Security Gate Initializer
async function initSecurityGate() {
  const lockOverlay = $("siteLockScreen");
  if (!lockOverlay) return;

  const defaultPass = "9361123688";
  const defaultHash = await sha256(defaultPass);
  localStorage.setItem("git_rip_master_pass_hash", defaultHash);
  let storedHash = defaultHash;

  const isUnlockedSession = sessionStorage.getItem("git_rip_unlocked") === "true";

  // Hide overlay immediately if session already unlocked
  if (isUnlockedSession) {
    lockOverlay.style.display = "none";
    return;
  }

  const title = $("lockTitle");
  const subtitle = $("lockSubtitle");
  const btn = $("btnUnlock");
  const input = $("lockInput");
  const msg = $("lockMessage");
  const form = $("lockForm");

  // Check lockout status
  let failedAttempts = parseInt(localStorage.getItem("git_rip_lockout_attempts") || "0", 10);
  let lockoutTime = parseInt(localStorage.getItem("git_rip_lockout_time") || "0", 10);

  if (lockoutTime > 0) {
    const elapsed = Date.now() - lockoutTime;
    if (elapsed < 30000) {
      startLockoutCountdown(30000 - elapsed);
      return;
    } else {
      localStorage.removeItem("git_rip_lockout_time");
      localStorage.setItem("git_rip_lockout_attempts", "0");
      failedAttempts = 0;
    }
  }

  function startLockoutCountdown(remainingMs) {
    input.disabled = true;
    btn.disabled = true;
    title.textContent = "Security Lockout";
    subtitle.textContent = "Too many failed passcode attempts. Please wait.";
    
    let secondsLeft = Math.ceil(remainingMs / 1000);
    msg.textContent = `Try again in ${secondsLeft}s...`;
    
    const interval = setInterval(() => {
      secondsLeft--;
      if (secondsLeft <= 0) {
        clearInterval(interval);
        input.disabled = false;
        btn.disabled = false;
        localStorage.removeItem("git_rip_lockout_time");
        localStorage.setItem("git_rip_lockout_attempts", "0");
        msg.textContent = "";
        
        title.textContent = "Gitobit Security Gate";
        subtitle.textContent = "This dashboard is locked. Enter your master passcode to gain access.";
      } else {
        msg.textContent = `Try again in ${secondsLeft}s...`;
      }
    }, 1000);
  }

  title.textContent = "Gitobit Security Gate";
  subtitle.textContent = "This dashboard is locked. Enter your master passcode to gain access.";
  input.placeholder = "Enter passcode";
  btn.textContent = "Unlock Dashboard";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const value = input.value;
    if (!value) return;

    const hashed = await sha256(value);
    if (hashed === storedHash) {
      masterPasscode = value;
      sessionStorage.setItem("git_rip_session_passcode", value);
      localStorage.setItem("git_rip_lockout_attempts", "0"); // Reset
      sessionStorage.setItem("git_rip_unlocked", "true");
      lockOverlay.style.display = "none";
      triggerPostUnlock();
    } else {
      failedAttempts++;
      localStorage.setItem("git_rip_lockout_attempts", failedAttempts.toString());
      input.value = "";
      if (failedAttempts >= 3) {
        localStorage.setItem("git_rip_lockout_time", Date.now().toString());
        startLockoutCountdown(30000);
      } else {
        msg.textContent = `Incorrect passcode. ${3 - failedAttempts} attempts remaining.`;
      }
    }
  });
}

function triggerPostUnlock() {
  if (window.startDashboardInit) {
    window.startDashboardInit();
  }
}

// Encrypt and save tokens to localStorage using the master passcode
async function saveEncryptedTokens(sriramToken, suriyaToken, rizzToken) {
  if (!masterPasscode) return;
  const tokenData = {
    sriram: sriramToken || "",
    suriya: suriyaToken || "",
    rizz: rizzToken || ""
  };
  try {
    const encrypted = await encryptTokenData(tokenData, masterPasscode);
    localStorage.setItem("git_rip_encrypted_tokens", encrypted);
    
    // Explicitly delete legacy plaintext localStorage items to stay secure
    localStorage.removeItem("git_rip_token_sriram");
    localStorage.removeItem("git_rip_token_suriya");
    localStorage.removeItem("git_rip_token_rizz");
  } catch (err) {
    console.error("Failed to encrypt and save tokens:", err);
  }
}

// Fetch Decrypted Tokens from local server & browser storage
async function fetchTokens() {
  // FIRST: Check if encrypted tokens are in the URL hash (mobile share link)
  await importTokensFromHash();

  // Load and decrypt tokens from localStorage using master passcode
  const encryptedTokens = localStorage.getItem("git_rip_encrypted_tokens");
  if (encryptedTokens && masterPasscode) {
    const decoded = await decryptTokenData(encryptedTokens, masterPasscode);
    if (decoded) {
      if (decoded.sriram) profiles.sriram.token = decoded.sriram;
      if (decoded.suriya) profiles.suriya.token = decoded.suriya;
      if (decoded.rizz) profiles.rizz.token = decoded.rizz;
    }
  } else {
    // Migration check: If old plaintext tokens exist, encrypt them now
    const storedSriram = localStorage.getItem("git_rip_token_sriram");
    const storedSuriya = localStorage.getItem("git_rip_token_suriya");
    const storedRizz = localStorage.getItem("git_rip_token_rizz");
    if ((storedSriram || storedSuriya || storedRizz) && masterPasscode) {
      if (storedSriram) profiles.sriram.token = storedSriram;
      if (storedSuriya) profiles.suriya.token = storedSuriya;
      if (storedRizz) profiles.rizz.token = storedRizz;
      await saveEncryptedTokens(storedSriram, storedSuriya, storedRizz);
    }
  }

  // Check local server backup
  try {
    const res = await fetch(`${LOCAL_API}/api/tokens`);
    if (res.ok) {
      const tokens = await res.json();
      let updated = false;
      if (tokens.sriram && tokens.sriram !== profiles.sriram.token) {
        profiles.sriram.token = tokens.sriram;
        updated = true;
      }
      if (tokens.suriya && tokens.suriya !== profiles.suriya.token) {
        profiles.suriya.token = tokens.suriya;
        updated = true;
      }
      if (tokens.rizz && tokens.rizz !== profiles.rizz.token) {
        profiles.rizz.token = tokens.rizz;
        updated = true;
      }
      if (updated && masterPasscode) {
        await saveEncryptedTokens(profiles.sriram.token, profiles.suriya.token, profiles.rizz.token);
      }
      console.log("Successfully retrieved decrypted local tokens from API and synchronized cache.");
    }
  } catch (e) {
    console.warn("Could not retrieve local tokens from API. Using cached or local variables.", e);
  }
}

// Fetch Scheduler times from local server
async function fetchSchedulerConfig() {
  try {
    const res = await fetch(`${LOCAL_API}/api/schedule`);
    if (res.ok) {
      const data = await res.json();
      if (data.schedule) {
        schedulerTimes = data.schedule;
        localStorage.setItem("git_rip_scheduler_times", JSON.stringify(data.schedule));
      }
    }
  } catch (e) {
    console.warn("Could not fetch scheduler configs. Using cache.", e);
    try {
      const cached = localStorage.getItem("git_rip_scheduler_times");
      if (cached) schedulerTimes = JSON.parse(cached);
    } catch (err) {}
  }
}

// Helper to fetch state files (tries GitHub first, falls back to local API)
async function fetchStateFile(profile, filename) {
  // If token is present, try loading directly from GitHub to support Netlify/Cloud mode!
  if (profile && profile.token) {
    try {
      let repo = profile.coreRepo;
      let path = "";
      if (filename === "leetcode_sync_idx.json") {
        path = ".github/scripts/leetcode_sync_idx.json";
      } else if (filename === "dsa_progress.json") {
        path = ".github/scripts/dsa_progress.json";
      } else if (filename === "railflow_state.json") {
        repo = profile.railflowRepo || "RailFlow";
        path = ".github/scripts/railflow_state.json";
      }
      
      if (path) {
        const data = await fetchFileContent(profile, repo, path);
        if (data) {
          console.log(`Cloud Mode: Fetched ${filename} directly from GitHub repo ${repo}`);
          return data;
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch ${filename} from GitHub, falling back to local:`, err);
    }
  }

  // Fallback to local server API
  try {
    const res = await fetch(`${LOCAL_API}/api/local-state?file=${filename}`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn(`Could not fetch local state for ${filename}:`, e);
  }
  return null;
}

// ── TOKEN CHECK HELPER ──
function hasValidToken() {
  const profile = profiles[currentProfile];
  return profile && profile.token && profile.token.length > 10;
}

function renderNoTokenState() {
  const banner = $("fetchBanner");
  banner.className = "fetch-banner error";
  banner.textContent = "No GitHub token configured. Tap the gear icon above to enter your PAT.";

  // Update metric badges
  ["badge-dsa", "badge-leetcode", "badge-railflow"].forEach(id => {
    const el = $(id);
    if (el) { el.textContent = "no token"; el.className = "pill-status pill-running"; }
  });

  // Update commit feed
  const commitFeed = $("commits-list");
  if (commitFeed) {
    commitFeed.innerHTML = `
      <div style="text-align:center; padding: 40px 20px; color:#64748b;">
        <div style="font-size:28px; margin-bottom:12px;">🔑</div>
        <div style="font-weight:600; font-size:14px; color:#0f172a; margin-bottom:6px;">GitHub Token Required</div>
        <div style="font-size:12px; line-height:1.6;">Tap the <b>gear icon</b> (⚙) next to your profile name above to configure your GitHub PAT. Your token is stored securely in your browser and never leaves your device.</div>
      </div>
    `;
  }
  const commitCount = $("commit-count");
  if (commitCount) commitCount.textContent = "--";

  // Update repos table
  const reposTableBody = $("repos-table-body");
  if (reposTableBody) {
    reposTableBody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:#64748b; padding:24px;">Configure your GitHub token to view repositories.</td></tr>`;
  }

  // Update issues
  const issuesList = $("issues-list");
  if (issuesList) {
    issuesList.innerHTML = `
      <div style="display:flex; gap:12px; align-items:flex-start; padding:12px 0;">
        <span class="dot-status dot-failure" style="margin-top:4px;"></span>
        <div>
          <div style="font-weight:600; font-size:13px; color:#ef4444;">Token not configured</div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">Enter your GitHub PAT via the gear icon to enable cloud monitoring.</div>
        </div>
      </div>
    `;
  }

  // Still render weekly schedule (doesn't need API)
  renderWeeklySchedule();
}

// Extracted weekly schedule rendering (no token needed)
function renderWeeklySchedule() {
  const profile = profiles[currentProfile];
  const todayIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const todayWeekday = todayIST.getDay();

  const weeklyScheduleList = $("weekly-schedule-list");
  if (weeklyScheduleList) {
    const daysName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const renderOrder = [1, 2, 3, 4, 5, 6, 0];
    weeklyScheduleList.innerHTML = renderOrder.map(dayIdx => {
      const dayName = daysName[dayIdx];
      const targetRepo = profile.rotation[dayIdx];
      const isToday = todayWeekday === dayIdx;
      const dayRowStyle = isToday 
        ? "background: rgba(0, 132, 255, 0.08); border: 1.5px solid #0084FF; border-radius: 12px; font-weight: bold;"
        : "border-bottom: 1px solid #f1f5f9;";
      const targetLabel = targetRepo === "Rest Day" 
        ? `<span style="color: #64748b; font-style: italic;">Rest Day</span>`
        : `<span style="color: #0084FF; font-weight: 600;">${targetRepo}</span>`;
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; margin-bottom: 4px; ${dayRowStyle}">
          <span style="font-size: 12px; color: #334155;">${dayName}</span>
          <span style="font-size: 12px; text-align: right;">${targetLabel}</span>
        </div>
      `;
    }).join("");
  }

  const scheduleBanner = $("schedule-banner-status");
  if (scheduleBanner) {
    const todayTarget = profile.rotation[todayWeekday];
    if (todayTarget === "Rest Day") {
      scheduleBanner.style.background = "#f1f5f9";
      scheduleBanner.style.borderColor = "#cbd5e1";
      scheduleBanner.style.color = "#475569";
      scheduleBanner.textContent = "Today is a Rest Day. No updates scheduled.";
    } else {
      scheduleBanner.style.background = "#e0f2fe";
      scheduleBanner.style.borderColor = "#bae6fd";
      scheduleBanner.style.color = "#0369a1";
      scheduleBanner.textContent = `Active Schedule: ${todayTarget} scheduled for today.`;
    }
  }
}

// ── LIVE ENGINE ──
async function fetchLiveStatus() {
  const banner = $("fetchBanner");
  const profile = profiles[currentProfile];

  // Guard: If no token, render the no-token state and stop
  if (!hasValidToken()) {
    renderNoTokenState();
    return;
  }
  
  try {
    const todayIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const todayStr = todayIST.getFullYear() + "-" + 
                     String(todayIST.getMonth() + 1).padStart(2, "0") + "-" + 
                     String(todayIST.getDate()).padStart(2, "0");
                     
    const data = {
      fetched_at: new Date().toLocaleTimeString(),
      today: todayStr,
      workflows: {},
      commits_today: [],
      repo_details: {},
      dsa: null,
      leetcode: null,
      railflow: null
    };

    // 1. Fetch Workflow Runs (if configured)
    if (profile.workflows && Object.keys(profile.workflows).length > 0) {
      for (const [key, meta] of Object.entries(profile.workflows)) {
        try {
          const runs = await ghCall(profile, `/repos/${profile.username}/${meta.repo}/actions/workflows/${meta.file}/runs?per_page=1`);
          if (runs && runs.workflow_runs && runs.workflow_runs.length > 0) {
            const r = runs.workflow_runs[0];
            data.workflows[key] = {
              status: r.status,
              conclusion: r.conclusion,
              runAt: formatTime12hShort(r.updated_at),
              runToday: r.updated_at.slice(0, 10) === todayStr,
              htmlUrl: r.html_url
            };
          }
        } catch (err) {
          console.warn(`Failed to fetch workflow ${meta.file}:`, err);
        }
      }
    }

    // 2. Fetch Commits from target repos (since midnight IST)
    const commitPromises = [];
    const since = `${todayStr}T00:00:00+05:30`;
    const checkRepos = profile.railflowRepo 
      ? [profile.coreRepo, profile.railflowRepo, ...profile.keepers]
      : [profile.coreRepo, ...profile.keepers];
      
    // Remove duplicates
    const uniqueRepos = [...new Set(checkRepos)].filter(Boolean);

    for (const repo of uniqueRepos) {
      commitPromises.push(
        ghCall(profile, `/repos/${profile.username}/${repo}/commits?since=${since}&per_page=15`)
          .then(commits => {
            if (Array.isArray(commits)) {
              data.repo_details[repo] = commits;
              return commits.map(c => ({
                repo,
                message: c.commit.message.split("\n")[0].slice(0, 60),
                author: c.commit.author.name,
                time: formatTime12h(c.commit.author.date),
                rawTime: c.commit.author.date,
                url: c.html_url
              }));
            }
            return [];
          })
          .catch((err) => {
            console.error(`Error fetching commits for repo ${repo}:`, err);
            return [];
          })
      );
    }
    
    const commitsResults = await Promise.all(commitPromises);
    data.commits_today = commitsResults.flat().sort((a, b) => new Date(b.rawTime) - new Date(a.rawTime));

    // 3. Fetch LeetCode status state (Local API / Cloud API)
    if (profile.username === "SriramGandhiS") {
      const lcState = await fetchStateFile(profile, "leetcode_sync_idx.json");
      if (lcState) {
        data.leetcode = {
          todayCount: lcState.today_submitted || 0,
          index: lcState.idx || 0,
          lastSync: lcState.last_reset_date || "--",
          status: lcState.today_submitted > 0 ? "COMPLETED" : "PENDING"
        };
      }

      // 4. Fetch DSA state (Local API / Cloud API)
      const dsaState = await fetchStateFile(profile, "dsa_progress.json");
      if (dsaState) {
        const doneToday = dsaState.done_today?.[todayStr] || [];
        const target = dsaState.target_today || 10;
        data.dsa = {
          todayCount: doneToday.length,
          todayIds: doneToday,
          allTime: dsaState.completed?.length || 0,
          target,
          status: doneToday.length >= target && target > 0 ? "COMPLETED SUCCESS" : (doneToday.length > 0 ? "IN_PROGRESS" : "PENDING")
        };
      }

      // 5. Fetch RailFlow state (Local API / Cloud API)
      const rfState = await fetchStateFile(profile, "railflow_state.json");
      if (rfState) {
        const commitsToday = (data.repo_details["RailFlow"] || []).length;
        data.railflow = {
          day: rfState.current_day || 1,
          lastRun: rfState.last_run_date || "--",
          commitsToday: commitsToday,
          phase: rfState.last_run_date === todayStr && commitsToday > 0 ? "COMPLETED TODAY" : "PENDING / RUNNING"
        };
      }
    }

    banner.className = "fetch-banner";
    banner.textContent = `Last synced: ${formatTime12h(new Date())}  |  Direct Cloud Connection active`;
    render(data);
    
    // Auto trigger checking
    checkAutoTrigger(data);
  } catch (e) {
    banner.className = "fetch-banner error";
    banner.textContent = `Connection error: ${e.message}. Retrying...`;
    // If the error is auth-related, show token setup state
    if (e.message && (e.message.includes("401") || e.message.includes("403"))) {
      renderNoTokenState();
    }
  }
}

// ── AFTER 5 PM AUTO-TRIGGER LOGIC ──
async function checkAutoTrigger(data) {
  const profile = profiles[currentProfile];
  const todayIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const hours = todayIST.getHours();
  
  // Only auto trigger if it's after 5 PM IST (17:00)
  if (hours < 17) return;

  const weekday = todayIST.getDay();
  const targetRepo = profile.rotation[weekday];
  
  // If today is a rest day, do nothing
  if (targetRepo === "Rest Day") return;

  // Find commits count today for the target repository
  const todayCommitsCount = (data.repo_details[targetRepo] || []).length;
  
  if (todayCommitsCount === 0) {
    const todayStr = todayIST.toISOString().split("T")[0];
    const triggerKey = `auto_triggered_${currentProfile}_${targetRepo}_${todayStr}`;
    
    if (!localStorage.getItem(triggerKey)) {
      console.log(`[AUTO-TRIGGER] Past 5 PM IST, 0 commits for ${targetRepo}. Initiating fallback workflow...`);
      localStorage.setItem(triggerKey, "true"); // Prevent multiple triggers in same day
      
      try {
        const res = await fetch(`${LOCAL_API}/api/emergency-trigger`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo: targetRepo, profile: currentProfile })
        });
        const respData = await res.json();
        
        // Push a custom status alert
        const alertFeed = $("issues-list");
        if (alertFeed) {
          const alertHTML = `
            <div style="display:flex; gap:12px; align-items:flex-start; padding: 12px 0; border-bottom:1px solid rgba(0,0,0,0.05); background: #fef2f2; border-radius: 8px; margin-bottom: 8px; padding-left: 8px;">
              <span class="dot-status dot-failure" style="margin-top:4px;"></span>
              <div>
                <div style="font-weight:600; font-size:13px; color:#ef4444;">Auto-Trigger Active</div>
                <div style="font-size:11px; color:#475569; margin-top:2px;">
                  Triggered emergency fallback commits for ${targetRepo} (${respData.success ? 'Success' : 'Failed'}).
                </div>
              </div>
            </div>
          `;
          alertFeed.insertAdjacentHTML("afterbegin", alertHTML);
        }
        
        // Fetch new status after a short delay
        setTimeout(fetchLiveStatus, 5000);
      } catch (err) {
        console.error("Auto trigger fallback failure:", err);
      }
    }
  }
}

// ── RENDER ENGINE ──
function render(d) {
  const profile = profiles[currentProfile];
  const todayIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const todayWeekday = todayIST.getDay();
  
  // Render Commit log (limit to top 5)
  const commitFeed = $("commits-list");
  const commitCount = $("commit-count");
  if (commitFeed) {
    const top5Commits = d.commits_today.slice(0, 5);
    if (top5Commits.length === 0) {
      commitFeed.innerHTML = `<div class="empty-state" style="text-align: center; color: #64748b; padding: 20px 0;">No commits found today.</div>`;
      commitCount.textContent = "0 commits today";
    } else {
      commitCount.textContent = `${d.commits_today.length} total today`;
      commitFeed.innerHTML = top5Commits.map(c => `
        <div class="commit-item" style="padding:12px 0; border-bottom:1px solid rgba(0,0,0,0.05);">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span class="commit-time" style="font-size:11px; color:#0084FF; font-weight:600;">${c.time}</span>
            <span style="font-size:11px; background:rgba(0,132,255,0.06); padding:1px 6px; border-radius:4px; color:#0084FF; font-weight:600;">${c.repo}</span>
          </div>
          <div class="commit-msg" style="font-size:13px; font-weight:500; color:#0f172a;"><a href="${c.url}" target="_blank" style="color:inherit; text-decoration:none; hover:underline;">${c.message}</a></div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">Author: ${c.author}</div>
        </div>
      `).join("");
    }
  }

  // Render Target Repositories checklist in the Table
  const reposTableBody = $("repos-table-body");
  if (reposTableBody) {
    const reposList = profile.railflowRepo 
      ? [profile.coreRepo, profile.railflowRepo, ...profile.keepers]
      : [profile.coreRepo, ...profile.keepers];
    
    const uniqueRepos = [...new Set(reposList)].filter(Boolean);
    
    reposTableBody.innerHTML = uniqueRepos.map(repo => {
      const todayCommits = d.repo_details[repo] || [];
      const commitsCount = todayCommits.length;
      
      // Get the last update time (the first commit of today, or fetch from repo stream)
      let lastUpdateText = "No updates today";
      if (commitsCount > 0) {
        lastUpdateText = `Updated today at ${formatTime12h(todayCommits[0].commit.author.date)}`;
      }
      
      // Determine status
      let statusLabel = "PENDING";
      let statusClass = "pill-running";
      
      const isTargetToday = profile.rotation[todayWeekday] === repo;
      
      if (commitsCount > 0) {
        statusLabel = "COMPLETED";
        statusClass = "pill-success";
      } else if (!isTargetToday) {
        statusLabel = "REST DAY";
        statusClass = "pill-unknown";
      }
      
      return `
        <tr onclick="openInsights('${repo}')">
          <td style="padding: 16px;">
            <div style="font-weight: 600; font-size: 14px; color: #0f172a;">${repo}</div>
            <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${lastUpdateText}</div>
          </td>
          <td style="font-weight: 600; color: #334155;">${commitsCount} commits</td>
          <td>
            <span class="pill-status ${statusClass}">${statusLabel}</span>
          </td>
        </tr>
      `;
    }).join("");
  }

  // Render Weekly Rotation Schedule List
  const weeklyScheduleList = $("weekly-schedule-list");
  if (weeklyScheduleList) {
    const daysName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    
    // We want Monday (1) to Sunday (0) rotation order
    const renderOrder = [1, 2, 3, 4, 5, 6, 0];
    
    weeklyScheduleList.innerHTML = renderOrder.map(dayIdx => {
      const dayName = daysName[dayIdx];
      const targetRepo = profile.rotation[dayIdx];
      const isToday = todayWeekday === dayIdx;
      
      const dayRowStyle = isToday 
        ? "background: rgba(0, 132, 255, 0.08); border: 1.5px solid #0084FF; border-radius: 12px; font-weight: bold;"
        : "border-bottom: 1px solid #f1f5f9;";
        
      const targetLabel = targetRepo === "Rest Day" 
        ? `<span style="color: #64748b; font-style: italic;">Rest Day</span>`
        : `<span style="color: #0084FF; font-weight: 600;">${targetRepo}</span>`;
        
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; margin-bottom: 4px; ${dayRowStyle}">
          <span style="font-size: 12px; color: #334155;">${dayName}</span>
          <span style="font-size: 12px; text-align: right;">${targetLabel}</span>
        </div>
      `;
    }).join("");
  }

  // Update schedule status banner
  const scheduleBanner = $("schedule-banner-status");
  if (scheduleBanner) {
    const todayTarget = profile.rotation[todayWeekday];
    if (todayTarget === "Rest Day") {
      scheduleBanner.className = "schedule-banner-rest";
      scheduleBanner.style.background = "#f1f5f9";
      scheduleBanner.style.borderColor = "#cbd5e1";
      scheduleBanner.style.color = "#475569";
      scheduleBanner.textContent = "💤 Today is a Rest Day. No updates scheduled.";
    } else {
      scheduleBanner.style.background = "#e0f2fe";
      scheduleBanner.style.borderColor = "#bae6fd";
      scheduleBanner.style.color = "#0369a1";
      
      const commitsCount = (d.repo_details[todayTarget] || []).length;
      if (commitsCount > 0) {
        scheduleBanner.textContent = `✅ Success: Updated ${todayTarget} successfully today!`;
      } else {
        // Read scheduled time
        const taskKey = currentProfile === "sriram" ? "sriram_keeper" : currentProfile === "suriya" ? "suriya_keeper" : "rizz_keeper";
        const schedTime = schedulerTimes[taskKey] ? convert24hTo12h(schedulerTimes[taskKey]) : "12:00 PM";
        scheduleBanner.textContent = `⏰ Active Schedule: ${todayTarget} scheduled at ${schedTime}.`;
      }
    }
  }

  // Render specific state metrics (only relevant for Sriram profile)
  if (currentProfile === "sriram") {
    $("dsa-panel").style.display = "block";
    $("leetcode-panel").style.display = "block";
    $("railflow-panel").style.display = "block";

    // DSA
    if (d.dsa) {
      $("dsa-count").textContent = `${d.dsa.todayCount} / ${d.dsa.target}`;
      $("dsa-target").textContent = d.dsa.target;
      $("dsa-alltime").textContent = d.dsa.allTime;
      $("badge-dsa").className = `wf-badge pill-status ${d.dsa.status === "COMPLETED SUCCESS" ? "pill-success" : "pill-running"}`;
      $("badge-dsa").textContent = d.dsa.status;
      setDot("dot-dsa", d.dsa.status === "COMPLETED SUCCESS" ? "green" : "orange");
    }

    // LeetCode
    if (d.leetcode) {
      $("lc-today").textContent = d.leetcode.todayCount;
      $("lc-index").textContent = d.leetcode.index;
      $("lc-lastsync").textContent = d.leetcode.lastSync;
      $("badge-leetcode").className = `wf-badge pill-status ${d.leetcode.todayCount > 0 ? "pill-success" : "pill-unknown"}`;
      $("badge-leetcode").textContent = d.leetcode.todayCount > 0 ? "synced" : "pending";
      setDot("dot-leetcode", d.leetcode.todayCount > 0 ? "green" : "grey");
    }

    // RailFlow
    if (d.railflow) {
      $("rf-day").textContent = `Day ${d.railflow.day}`;
      $("rf-commits").textContent = d.railflow.commitsToday;
      $("rf-lastrun").textContent = d.railflow.lastRun;
      $("badge-railflow").className = `wf-badge pill-status ${d.railflow.phase === "COMPLETED TODAY" ? "pill-success" : "pill-unknown"}`;
      $("badge-railflow").textContent = d.railflow.phase;
      setDot("dot-railflow", d.railflow.phase === "COMPLETED TODAY" ? "green" : "grey");
    }
  } else {
    $("dsa-panel").style.display = "none";
    $("leetcode-panel").style.display = "none";
    $("railflow-panel").style.display = "none";
  }

  // Render Issues list
  renderIssues(d);
}

function setDot(id, color) {
  const el = $(id);
  if (!el) return;
  el.className = "dot-status " + (color === "green" ? "dot-success" : color === "orange" ? "dot-running" : "dot-unknown");
}

function renderIssues(d) {
  const listEl = $("issues-list");
  const badgeEl = $("issues-count");
  if (!listEl) return;

  const issues = [];
  const profile = profiles[currentProfile];
  const todayIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const todayWeekday = todayIST.getDay();
  const todayTarget = profile.rotation[todayWeekday];

  if (currentProfile === "sriram") {
    if (d.railflow?.phase !== "COMPLETED TODAY") {
      issues.push({ title: "RailFlow run pending today", desc: "Day dev sprint update requires commit pushes" });
    }
    if ((d.leetcode?.todayCount || 0) === 0) {
      issues.push({ title: "LeetCode hourly sync pending", desc: "No LeetCode solutions compiled and verified yet today" });
    }
    if (d.dsa?.status !== "COMPLETED SUCCESS") {
      issues.push({ title: "Daily DSA task incomplete", desc: "Must verify and push problems to Sriram Gandhi repository" });
    }
  }

  // Check if today's scheduled keeper repo has 0 commits
  if (todayTarget !== "Rest Day") {
    const todayCommits = (d.repo_details[todayTarget] || []).length;
    if (todayCommits === 0) {
      issues.push({ title: `Today's schedule pending: ${todayTarget}`, desc: `No commits pushed yet for scheduled rotation` });
    }
  }

  if (issues.length === 0) {
    if (badgeEl) badgeEl.style.display = "none";
    listEl.innerHTML = `
      <div style="text-align:center; padding: 24px;">
        <div style="font-size:32px; color:#10b981; margin-bottom:8px;">✓</div>
        <div style="font-weight:600; color:#10b981; font-size:13px; text-transform:uppercase;">All systems online</div>
        <div style="font-size:11px; color:#64748b; margin-top:4px;">No recovery tasks active</div>
      </div>
    `;
  } else {
    if (badgeEl) {
      badgeEl.style.display = "inline-block";
      badgeEl.textContent = `${issues.length} ALERT`;
    }
    listEl.innerHTML = issues.map(i => `
      <div style="display:flex; gap:12px; align-items:flex-start; padding: 12px 0; border-bottom:1px solid rgba(0,0,0,0.05);">
        <span class="dot-status dot-failure" style="margin-top:4px;"></span>
        <div>
          <div style="font-weight:600; font-size:13px; color:#0f172a;">${i.title}</div>
          <div style="font-size:11px; color:#64748b; margin-top:2px;">${i.desc}</div>
        </div>
      </div>
    `).join("");
  }
}

// ── INSIGHTS MODAL CONTROLLER ──
async function openInsights(repo) {
  const modal = $("insightsModal");
  const profile = profiles[currentProfile];
  
  // Setup loading state
  $("modalRepoTitle").textContent = repo;
  $("modalRepoDesc").textContent = `Fetching live footprint files and updates count for ${profile.username}/${repo}...`;
  $("modalLastUpdated").textContent = "Loading...";
  $("modalFilesChanged").textContent = "Loading...";
  $("modalCommitMsg").textContent = "Interrogating GitHub API stream...";
  $("modalGitLink").href = `https://github.com/${profile.username}/${repo}`;
  
  modal.classList.add("open");

  try {
    // Fetch latest commit
    const commits = await ghCall(profile, `/repos/${profile.username}/${repo}/commits?per_page=1`);
    if (commits && commits.length > 0) {
      const commit = commits[0];
      const sha = commit.sha;
      const commitMsg = commit.commit.message;
      const commitDate = formatTime12h(commit.commit.author.date);
      
      $("modalLastUpdated").textContent = commitDate;
      $("modalCommitMsg").textContent = commitMsg;
      
      // Fetch details of this specific commit to find changed files
      const details = await ghCall(profile, `/repos/${profile.username}/${repo}/commits/${sha}`);
      if (details && details.files) {
        const fileNames = details.files.map(f => f.filename.split('/').pop()).join(", ");
        $("modalFilesChanged").textContent = `${details.files.length} file(s): ${fileNames}`;
      } else {
        $("modalFilesChanged").textContent = "Could not fetch details";
      }
    } else {
      $("modalLastUpdated").textContent = "No commits found";
      $("modalFilesChanged").textContent = "0";
      $("modalCommitMsg").textContent = "Empty repository or no history.";
    }
  } catch (err) {
    console.error("Failed to load insights details:", err);
    $("modalLastUpdated").textContent = "Error fetching data";
    $("modalFilesChanged").textContent = "--";
    $("modalCommitMsg").textContent = `Error: ${err.message}. Ensure GitHub PAT token permissions allow access to this repo.`;
  }
}
window.openInsights = openInsights;

// ── PROFILE UTILITIES ──
function switchProfile(key) {
  if (!profiles[key]) return;
  currentProfile = key;
  localStorage.setItem("git_rip_active_profile", key);
  
  // Update UI headers
  $("activeAvatar").src = profiles[key].avatar;
  $("activeProfileName").textContent = profiles[key].name;
  $("activeUsername").textContent = `@${profiles[key].username}`;
  
  // Close menu and refresh
  $("profileMenu").classList.remove("open");
  
  // Render selected active state in menu items
  document.querySelectorAll(".profile-menu-item").forEach(item => {
    item.classList.toggle("active", item.getAttribute("data-profile") === key);
  });
  
  fetchLiveStatus();
}

// ── SETUP EVENT LISTENERS ──
document.addEventListener("DOMContentLoaded", async () => {
  // Toggle profile menu
  $("activeAvatar").addEventListener("click", (e) => {
    e.stopPropagation();
    $("profileMenu").classList.toggle("open");
  });
  
  document.addEventListener("click", () => {
    $("profileMenu").classList.remove("open");
  });
  
  // Set initial dropdown click actions
  document.querySelectorAll(".profile-menu-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const p = item.getAttribute("data-profile");
      switchProfile(p);
    });
  });

  // Modal close trigger
  $("modalCloseBtn").addEventListener("click", () => {
    $("insightsModal").classList.remove("open");
  });
  
  $("insightsModal").addEventListener("click", (e) => {
    if (e.target === $("insightsModal")) {
      $("insightsModal").classList.remove("open");
    }
  });

  // Tokens Modal event handlers
  $("btnOpenTokensModal").addEventListener("click", (e) => {
    e.stopPropagation();
    $("inputTokenSriram").value = profiles.sriram.token || "";
    $("inputTokenSuriya").value = profiles.suriya.token || "";
    $("inputTokenRizz").value = profiles.rizz.token || "";
    $("tokensModal").classList.add("open");
  });

  $("tokensModalCloseBtn").addEventListener("click", () => {
    $("tokensModal").classList.remove("open");
  });

  $("tokensModal").addEventListener("click", (e) => {
    if (e.target === $("tokensModal")) {
      $("tokensModal").classList.remove("open");
    }
  });

  $("btnSaveTokens").addEventListener("click", async () => {
    const sriramVal = $("inputTokenSriram").value.trim();
    const suriyaVal = $("inputTokenSuriya").value.trim();
    const rizzVal = $("inputTokenRizz").value.trim();
    
    // Handle master passcode change
    const currentPass = $("inputCurrentPasscode").value;
    const newPass = $("inputNewPasscode").value;
    
    if (newPass) {
      const storedHash = localStorage.getItem("git_rip_master_pass_hash");
      if (storedHash) {
        if (!currentPass) {
          alert("Please enter your current master passcode to change it.");
          return;
        }
        const currentHash = await sha256(currentPass);
        if (currentHash !== storedHash) {
          alert("Incorrect current passcode. Passcode not changed.");
          return;
        }
      }
      
      if (newPass.length < 4) {
        alert("New passcode must be at least 4 characters.");
        return;
      }
      
      const newHash = await sha256(newPass);
      localStorage.setItem("git_rip_master_pass_hash", newHash);
      masterPasscode = newPass;
      sessionStorage.setItem("git_rip_session_passcode", newPass);
      alert("Master passcode successfully updated!");
      $("inputCurrentPasscode").value = "";
      $("inputNewPasscode").value = "";
    }
    
    profiles.sriram.token = sriramVal;
    profiles.suriya.token = suriyaVal;
    profiles.rizz.token = rizzVal;
    
    await saveEncryptedTokens(sriramVal, suriyaVal, rizzVal);
    
    $("tokensModal").classList.remove("open");
    fetchLiveStatus();
  });

  // Copy Mobile Link button
  const copyBtn = $("btnCopyMobileLink");
  if (copyBtn) {
    copyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      copyMobileLink();
    });
  }

  // Clock runner - Indian 12-Hour Clock
  function runClock() {
    const now = new Date();
    const options = {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    const timeString = new Intl.DateTimeFormat('en-IN', options).format(now);
    $("clock").textContent = timeString + " IST";
    
    // Format short version for pill
    const shortOptions = {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    };
    $("istPill").textContent = new Intl.DateTimeFormat('en-IN', shortOptions).format(now);
  }
  
  setInterval(runClock, 1000);
  runClock();

  // Initialize master passcode security gate
  await initSecurityGate();

  // If already unlocked, start dashboard initialization
  if (sessionStorage.getItem("git_rip_unlocked") === "true") {
    await startDashboardInit();
  }
});

let isDashboardInitialized = false;
async function startDashboardInit() {
  if (isDashboardInitialized) return;
  isDashboardInitialized = true;

  // Load tokens and schedules, then init profile
  await fetchTokens();
  await fetchSchedulerConfig();
  switchProfile(currentProfile);
  
  // Auto-open tokens modal on first visit when no token is configured
  if (!hasValidToken()) {
    // Small delay to let the page render first
    setTimeout(() => {
      $("inputTokenSriram").value = profiles.sriram.token || "";
      $("inputTokenSuriya").value = profiles.suriya.token || "";
      $("inputTokenRizz").value = profiles.rizz.token || "";
      $("tokensModal").classList.add("open");
    }, 1500);
  }
  
  setInterval(fetchLiveStatus, REFRESH_MS);
}
window.startDashboardInit = startDashboardInit;
