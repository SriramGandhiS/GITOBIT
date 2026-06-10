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

// Fetch Decrypted Tokens from local server
async function fetchTokens() {
  try {
    const res = await fetch(`${LOCAL_API}/api/tokens`);
    if (res.ok) {
      const tokens = await res.json();
      if (tokens.sriram) profiles.sriram.token = tokens.sriram;
      if (tokens.suriya) profiles.suriya.token = tokens.suriya;
      if (tokens.rizz) profiles.rizz.token = tokens.rizz;
      console.log("Successfully retrieved decrypted local tokens from API.");
    }
  } catch (e) {
    console.warn("Could not retrieve local tokens from API. Using local variables.", e);
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
      }
    }
  } catch (e) {
    console.warn("Could not fetch scheduler configs.", e);
  }
}

// Helper to fetch local state files from the helper server
async function fetchLocalState(filename) {
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

// ── LIVE ENGINE ──
async function fetchLiveStatus() {
  const banner = $("fetchBanner");
  const profile = profiles[currentProfile];
  
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
              data.repo_details[repo] = commits; // Cache today's commits for table display
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
    // Sort combined commits from all repos - limit to exactly top 5
    data.commits_today = commitsResults.flat().sort((a, b) => new Date(b.rawTime) - new Date(a.rawTime));

    // 3. Fetch LeetCode status state (Local API)
    if (profile.username === "SriramGandhiS") {
      const lcState = await fetchLocalState("leetcode_sync_idx.json");
      if (lcState) {
        data.leetcode = {
          todayCount: lcState.today_submitted || 0,
          index: lcState.idx || 0,
          lastSync: lcState.last_reset_date || "--",
          status: lcState.today_submitted > 0 ? "COMPLETED" : "PENDING"
        };
      }

      // 4. Fetch DSA state (Local API)
      const dsaState = await fetchLocalState("dsa_progress.json");
      if (dsaState) {
        const doneToday = dsaState.done_today?.[todayStr] || [];
        const target = dsaState.target_today || 10; // Default to 10 if not in state
        data.dsa = {
          todayCount: doneToday.length,
          todayIds: doneToday,
          allTime: dsaState.completed?.length || 0,
          target,
          status: doneToday.length >= target && target > 0 ? "COMPLETED SUCCESS" : (doneToday.length > 0 ? "IN_PROGRESS" : "PENDING")
        };
      }

      // 5. Fetch RailFlow state (Local API)
      const rfState = await fetchLocalState("railflow_state.json");
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
    banner.textContent = `⚠️ Connection error: ${e.message}. Using cached states.`;
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

  // Load tokens and schedules, then init profile
  await fetchTokens();
  await fetchSchedulerConfig();
  switchProfile(currentProfile);
  
  setInterval(fetchLiveStatus, REFRESH_MS);
});
