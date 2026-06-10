import urllib.request
import json
import time
import datetime
import random
import os

# Repository configuration
SHARED_OWNER = "SriramGandhiS"
SURIYA_OWNER = "Suriyakumar4036"

# Load local tokens from scratch directory
def load_tokens():
    tokens = {"sriram": "", "suriya": ""}
    try:
        scratch_dir = r"C:\Users\iamra\.gemini\antigravity\brain\3cb12e90-b46a-469f-929f-57a45c066e50\scratch"
        forks_path = os.path.join(scratch_dir, "check_forks.py")
        if os.path.exists(forks_path):
            with open(forks_path, "r") as f:
                content = f.read()
                for line in content.splitlines():
                    if "SRIRAM_TOKEN =" in line:
                        tokens["sriram"] = line.split("=", 1)[1].strip().strip('"').strip("'")
                    elif "SURIYA_TOKEN =" in line:
                        tokens["suriya"] = line.split("=", 1)[1].strip().strip('"').strip("'")
        if not tokens["suriya"]:
            collabs_path = os.path.join(scratch_dir, "check_collabs.py")
            if os.path.exists(collabs_path):
                with open(collabs_path, "r") as f:
                    content = f.read()
                    for line in content.splitlines():
                        if "SURIYA_TOKEN =" in line:
                            tokens["suriya"] = line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception as e:
        print(f"Error loading local tokens: {e}")
    return tokens

TOKENS = load_tokens()

# Dispatch workflow helper
def trigger_workflow(owner, repo, workflow_file, token):
    url = f"https://api.github.com/repos/{owner}/{repo}/actions/workflows/{workflow_file}/dispatches"
    req = urllib.request.Request(url, method="POST")
    req.add_header("Authorization", f"token {token}")
    req.add_header("Accept", "application/vnd.github.v3+json")
    req.add_header("User-Agent", "Mozilla/5.0")
    req.add_header("Content-Type", "application/json")
    data = json.dumps({"ref": "main"}).encode('utf-8')
    try:
        with urllib.request.urlopen(req, data=data) as response:
            return response.status == 204
    except Exception as e:
        print(f"Failed to dispatch workflow {workflow_file}: {e}")
        return False

# Fetch live commits today helper
def check_commits_today(owner, repo, token):
    today = datetime.datetime.utcnow().date().isoformat()
    url = f"https://api.github.com/repos/{owner}/{repo}/commits?since={today}T00:00:00Z"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"token {token}")
    req.add_header("Accept", "application/vnd.github.v3+json")
    req.add_header("User-Agent", "Mozilla/5.0")
    try:
        with urllib.request.urlopen(req) as response:
            commits = json.loads(response.read().decode('utf-8'))
            return len(commits) > 0
    except Exception:
        return False

# Dynamic time generator for scheduling tasks
def generate_schedule():
    # Random hours between 9 AM and 6 PM
    def rand_time(start_h, end_h):
        h = random.randint(start_h, end_h)
        m = random.randint(0, 59)
        return f"{h:02d}:{m:02d}"

    return {
        "railflow": rand_time(10, 16),
        "leetcode": rand_time(9, 17),
        "dsa": rand_time(9, 17),
        "sriram_keeper": rand_time(11, 18),
        "suriya_keeper": rand_time(11, 18),
        "rizz_keeper": rand_time(11, 18)
    }

TIMES_FILE = "scheduler_times.json"
TRIGGERED_FILE = "scheduler_triggered.json"

def get_today_schedule():
    today = datetime.date.today().isoformat()
    if os.path.exists(TIMES_FILE):
        with open(TIMES_FILE, "r") as f:
            try:
                data = json.load(f)
                if data.get("date") == today:
                    return data.get("schedule")
            except Exception:
                pass

    # Generate and save new schedule for today
    sched = generate_schedule()
    with open(TIMES_FILE, "w") as f:
        json.dump({"date": today, "schedule": sched}, f, indent=2)
    print(f"Generated new randomized schedule for today: {sched}")
    return sched

def get_triggered_today():
    today = datetime.date.today().isoformat()
    if os.path.exists(TRIGGERED_FILE):
        try:
            with open(TRIGGERED_FILE, "r") as f:
                data = json.load(f)
                if data.get("date") == today:
                    return set(data.get("triggered", []))
        except Exception:
            pass
    return set()

def mark_triggered(task_key):
    today = datetime.date.today().isoformat()
    triggered = get_triggered_today()
    triggered.add(task_key)
    with open(TRIGGERED_FILE, "w") as f:
        json.dump({"date": today, "triggered": list(triggered)}, f, indent=2)

def run_scheduler_tick():
    print(f"Scheduler tick: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    sched = get_today_schedule()
    triggered_today = get_triggered_today()
    now = datetime.datetime.now()

    # Grace time margin: 20 minutes
    GRACE_MINUTES = 20

    def is_past_time(target_str):
        th, tm = map(int, target_str.split(":"))
        target_time = now.replace(hour=th, minute=tm, second=0, microsecond=0)
        grace_time = target_time + datetime.timedelta(minutes=GRACE_MINUTES)
        return now >= grace_time

    # 1. RailFlow Core
    if is_past_time(sched["railflow"]) and "railflow" not in triggered_today:
        print("Checking RailFlow status...")
        scratch_dir = r"C:\Users\iamra\.gemini\antigravity\brain\3cb12e90-b46a-469f-929f-57a45c066e50\scratch"
        rf_state_path = os.path.join(scratch_dir, "railflow_state.json")
        rf_done = False
        if os.path.exists(rf_state_path):
            try:
                with open(rf_state_path, "r") as f:
                    rf_state = json.load(f)
                    if rf_state.get("last_run_date") == datetime.date.today().isoformat():
                        rf_done = True
            except Exception as e:
                print(f"Error reading local railflow_state: {e}")

        if not rf_done:
            print("[AUTO-FORCE] RailFlow pending. Triggering...")
            trigger_workflow(SHARED_OWNER, "RailFlow", "railflow.yml", TOKENS["sriram"])
            mark_triggered("railflow")
        else:
            print("RailFlow already completed today. Skipping trigger.")
            mark_triggered("railflow")

    # 2. LeetCode Sync
    if is_past_time(sched["leetcode"]) and "leetcode" not in triggered_today:
        has_commits = check_commits_today(SHARED_OWNER, "Study-and-Code", TOKENS["sriram"])
        if not has_commits:
            print(f"[AUTO-FORCE] LeetCode sync pending past target {sched['leetcode']}. Dispatching...")
            trigger_workflow(SHARED_OWNER, "Study-and-Code", "leetcode.yml", TOKENS["sriram"])
        mark_triggered("leetcode")

    # 3. DSA Push
    if is_past_time(sched["dsa"]) and "dsa" not in triggered_today:
        has_commits = check_commits_today(SHARED_OWNER, "Study-and-Code", TOKENS["sriram"])
        if not has_commits:
            print(f"[AUTO-FORCE] DSA push pending past target {sched['dsa']}. Dispatching...")
            trigger_workflow(SHARED_OWNER, "Study-and-Code", "dsa.yml", TOKENS["sriram"])
        mark_triggered("dsa")

    # 4. Sriram Keeper
    if is_past_time(sched["sriram_keeper"]) and "sriram_keeper" not in triggered_today:
        day = datetime.date.today().weekday() + 1  # Monday = 1
        sriramMap = { 1: "Hiresense.ai", 2: "Javino-AI-Authenticity", 3: "SmartSlate", 4: "Sriram-Portfolio" }
        target_repo = sriramMap.get(day)
        if target_repo:
            has_commits = check_commits_today(SHARED_OWNER, target_repo, TOKENS["sriram"])
            if not has_commits:
                print(f"[AUTO-FORCE] Sriram keeper pending on {target_repo} past target {sched['sriram_keeper']}. Dispatching...")
                trigger_workflow(SHARED_OWNER, "Study-and-Code", "repo-updaters.yml", TOKENS["sriram"])
        mark_triggered("sriram_keeper")

    # 5. Suriya Keeper
    if is_past_time(sched["suriya_keeper"]) and "suriya_keeper" not in triggered_today:
        day = datetime.date.today().weekday() + 1
        suriyaMap = { 1: "smart-ai-resume-analyser", 2: "Suriya-portfolio-", 3: "Accerdian-dashboard-Front-end-project-", 4: "unipay" }
        target_repo = suriyaMap.get(day)
        if target_repo:
            has_commits = check_commits_today(SURIYA_OWNER, target_repo, TOKENS["suriya"])
            if not has_commits:
                print(f"[AUTO-FORCE] Suriya keeper pending on {target_repo} past target {sched['suriya_keeper']}. Dispatching...")
                trigger_workflow(SURIYA_OWNER, "Study-and-Code", "repo-updaters.yml", TOKENS["suriya"])
        mark_triggered("suriya_keeper")

    # 6. Rizz Keeper
    if is_past_time(sched.get("rizz_keeper", "18:00")) and "rizz_keeper" not in triggered_today:
        day = datetime.date.today().weekday() + 1
        rizzMap = { 1: "ROI-THE-LEGAL-APP", 2: "Study-and-Code", 3: "RailFlow", 4: "Study-and-Code" }
        target_repo = rizzMap.get(day)
        if target_repo:
            has_commits = check_commits_today("rizz-architect", target_repo, TOKENS["sriram"])
            if not has_commits:
                print(f"[AUTO-FORCE] Rizz keeper pending on {target_repo} past target {sched.get('rizz_keeper')}. Dispatching...")
                trigger_workflow("rizz-architect", "Study-and-Code", "repo-updaters.yml", TOKENS["sriram"])
        mark_triggered("rizz_keeper")

if __name__ == "__main__":
    run_scheduler_tick()
