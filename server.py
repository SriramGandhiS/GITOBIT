import http.server
import socketserver
import json
import os
import mimetypes

mimetypes.init()
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/javascript', '.js')

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_GET(self):
        try:
            if self.path == '/api/tokens':
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                tokens = get_local_tokens()
                self.wfile.write(json.dumps(tokens).encode('utf-8'))
            elif self.path == '/api/schedule':
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                schedule_data = {}
                times_path = os.path.join(DIRECTORY, "scheduler_times.json")
                if os.path.exists(times_path):
                    try:
                        with open(times_path, "r") as f:
                            schedule_data = json.load(f)
                    except Exception as e:
                        print("Error reading schedule file:", e)
                
                self.wfile.write(json.dumps(schedule_data).encode('utf-8'))
            elif self.path.startswith('/api/local-state'):
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                
                import urllib.parse
                parsed = urllib.parse.urlparse(self.path)
                params = urllib.parse.parse_qs(parsed.query)
                filename = params.get('file', [''])[0]
                
                scratch_dir = r"C:\Users\iamra\.gemini\antigravity\brain\3cb12e90-b46a-469f-929f-57a45c066e50\scratch"
                logs_dir = r"c:\gitupdater\logs"
                
                data = None
                if filename == 'leetcode_sync_idx.json':
                    path = os.path.join(scratch_dir, 'leetcode_sync_idx.json')
                elif filename == 'railflow_state.json':
                    path = os.path.join(scratch_dir, 'railflow_state.json')
                elif filename == 'dsa_progress.json':
                    path = os.path.join(logs_dir, 'dsa_progress.json')
                else:
                    path = None
                    
                if path and os.path.exists(path):
                    try:
                        with open(path, 'r') as f:
                            data = json.load(f)
                    except Exception as e:
                        print("Error loading local state file:", e)
                        
                self.wfile.write(json.dumps(data).encode('utf-8'))
            else:
                super().do_GET()
        except Exception as e:
            print("Error handling do_GET:", e)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_HEAD(self):
        try:
            super().do_HEAD()
        except Exception as e:
            print("Error handling do_HEAD:", e)

    def do_POST(self):
        try:
            if self.path == '/api/emergency-trigger':
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                req_data = json.loads(post_data.decode('utf-8'))
                repo = req_data.get('repo', 'Study-and-Code')
                profile = req_data.get('profile', 'sriram')

                import subprocess
                script_path = os.path.join(DIRECTORY, 'emergency_fallback.py')
                result = subprocess.run(
                    ['python', script_path, repo, profile],
                    capture_output=True, text=True, timeout=60
                )
                success = result.returncode == 0
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": success,
                    "repo": repo,
                    "profile": profile,
                    "output": result.stdout.strip(),
                    "error": result.stderr.strip() if not success else ""
                }).encode('utf-8'))

            elif self.path == '/api/ai-chat':
                content_length = int(self.headers['Content-Length'])
                post_data = self.rfile.read(content_length)
                req_data = json.loads(post_data.decode('utf-8'))
                user_message = req_data.get('message', '')
                
                # Fetch real-world status of all files
                scratch_dir = r"C:\Users\iamra\.gemini\antigravity\brain\3cb12e90-b46a-469f-929f-57a45c066e50\scratch"
                logs_dir = r"c:\gitupdater\logs"
                import datetime
                
                # 1. RailFlow State
                rf_state = {}
                rf_path = os.path.join(scratch_dir, 'railflow_state.json')
                if os.path.exists(rf_path):
                    try:
                        with open(rf_path, 'r') as f:
                            rf_state = json.load(f)
                    except Exception:
                        pass
                        
                # 2. LeetCode Index State
                lc_state = {}
                lc_path = os.path.join(scratch_dir, 'leetcode_sync_idx.json')
                if os.path.exists(lc_path):
                    try:
                        with open(lc_path, 'r') as f:
                            lc_state = json.load(f)
                    except Exception:
                        pass
                        
                # 3. DSA Progress
                dsa_state = {}
                dsa_path = os.path.join(logs_dir, 'dsa_progress.json')
                if os.path.exists(dsa_path):
                    try:
                        with open(dsa_path, 'r') as f:
                            dsa_state = json.load(f)
                    except Exception:
                        pass
                
                # 4. Keeper Files completed check
                keepers = {}
                for name in ['Hiresense', 'Javino', 'Portfolio', 'SmartSlate']:
                    k_path = os.path.join(logs_dir, f'done_today_{name}.txt')
                    if os.path.exists(k_path):
                        try:
                            with open(k_path, 'r') as f:
                                keepers[name] = f.read().strip()
                        except Exception:
                            keepers[name] = "Not found"
                    else:
                        keepers[name] = "Pending / Not executed today"
                
                # 5. Build prompt
                status_summary = {
                    "date": datetime.date.today().isoformat(),
                    "RailFlow": {
                        "current_day": rf_state.get("current_day", "--"),
                        "last_run_date": rf_state.get("last_run_date", "--"),
                        "status": "COMPLETED" if rf_state.get("last_run_date") == datetime.date.today().isoformat() else "PENDING/RUNNING"
                    },
                    "LeetCode": {
                        "total_target": lc_state.get("today_target", 14),
                        "completed_solves": lc_state.get("today_submitted", 5),
                        "sync_index": lc_state.get("idx", 5),
                        "status": "COMPLETED" if lc_state.get("today_submitted", 5) >= lc_state.get("today_target", 14) else "IN_PROGRESS"
                    },
                    "DSA_Push": {
                        "completed_count": len(dsa_state.get("completed", [])) if "completed" in dsa_state else "--",
                        "status": "COMPLETED" if os.path.exists(os.path.join(logs_dir, 'badge_done_today.txt')) else "PENDING"
                    },
                    "Keeper_Updaters": keepers
                }
                
                ai_response = call_claude_api(user_message, status_summary)
                
                # Post-process AI response to detect [TRIGGER: repo/workflow_file]
                triggered_messages = []
                if "[TRIGGER:" in ai_response:
                    import re
                    triggers = re.findall(r'\[TRIGGER:\s*(.*?)/(.*?)\]', ai_response)
                    for repo_name, wf_file in triggers:
                        success = trigger_github_workflow(repo_name, wf_file)
                        status_text = "SUCCESS ✅" if success else "FAILED ❌"
                        triggered_messages.append(f"\n⚡ **[Auto-Trigger]** Initiated dispatch for `{repo_name}/{wf_file}`: **{status_text}**")
                    
                    # Strip out the trigger tags from the response
                    ai_response = re.sub(r'\[TRIGGER:\s*.*?\]', '', ai_response).strip()
                    if triggered_messages:
                        ai_response += "\n" + "\n".join(triggered_messages)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"response": ai_response}).encode('utf-8'))
            else:
                self.send_response(404)
                self.end_headers()
        except Exception as e:
            print("Error handling do_POST:", e)
            try:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
            except Exception:
                pass

def call_claude_api(message, status_summary):
    api_key = os.environ.get("CLAUDE_API_KEY", os.environ.get("ANTHROPIC_API_KEY", ""))
    url = "https://api.anthropic.com/v1/complete"
    import requests
    import datetime
    import time
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry

    if not api_key:
        return "Sorry, Claude API key not configured (set CLAUDE_API_KEY)."

    system_prompt = f"""You are the AI Grid Advisor, a premium automation dashboard assistant.
You help Sriram and Suriya track their daily automation runs, LeetCode solves, and keeper commits.
Here is the real-world status of all runs today ({datetime.date.today().isoformat()}):
{json.dumps(status_summary, indent=2)}

Trigger Guidelines:
If the user asks you to "fix", "trigger", or "run" any failed, pending, or incomplete workflows, you can trigger them by adding the tag `[TRIGGER: <repo_name>/<workflow_file>]` to your response.
Workflows map:
- RailFlow Core: `RailFlow/railflow.yml`
- LeetCode Sync: `Study-and-Code/leetcode.yml`
- DSA Push: `Study-and-Code/dsa.yml`
- Keeper Updaters: `Study-and-Code/repo-updaters.yml`

E.g., if LeetCode solves are incomplete and they say "fix these", you should output: "I will fix these. [TRIGGER: Study-and-Code/leetcode.yml]"

Output Structure Guidelines:
Do NOT output conversational intros or wordy paragraphs.
Format your responses to look extremely clean, simple, and structured (like Claude's thinking) using lists. E.g.:

### 🔍 Current Status:
1. **LeetCode**: 11/14 Solves Completed
2. **DSA Push**: Completed
3. **RailFlow**: Completed
4. **Keepers**: Pending (Hiresense, Javino, Portfolio, SmartSlate)

### 🚨 Issues Found:
1. **LeetCode**: 3 solves outstanding.
2. **Keepers**: Commits pending.

### 🛠️ Solving:
- Triggering LeetCode sync workflow.
- Triggering Keeper updaters workflow.
"""

    # Anthropics expects a back-and-forth style prompt; compose a short human/assistant exchange
    prompt = system_prompt + "\n\nHuman: " + message + "\n\nAssistant:"

    headers = {
        "x-api-key": api_key,
        "Content-Type": "application/json"
    }

    payload = {
        "model": "claude-2.1",
        "prompt": prompt,
        "max_tokens_to_generate": 1500,
        "temperature": 0.2
    }

    # session with retries for transient network/server errors
    session = requests.Session()
    retries = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504], allowed_methods=["POST"]) 
    session.mount("https://", HTTPAdapter(max_retries=retries))

    try:
        resp = session.post(url, json=payload, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        # Anthropic legacy 'completion' field or newer 'completions' shapes
        if isinstance(data, dict):
            if 'completion' in data:
                return data['completion']
            if 'completions' in data and isinstance(data['completions'], list) and data['completions']:
                c = data['completions'][0]
                if isinstance(c, dict):
                    return c.get('data', {}).get('text') or c.get('text') or ''
            # fallback to choices/text fields
            if 'choices' in data and data['choices']:
                choice = data['choices'][0]
                return choice.get('text') or choice.get('message', {}).get('content', '')
        return ""
    except requests.exceptions.RequestException as e:
        print("Claude API request error:", e)
        return f"Sorry, I encountered an error communicating with Claude API: {e}"
def get_local_tokens():
    sriram_token = ""
    suriya_token = ""
    rizz_token = ""
    try:
        scratch_dir = r"C:\Users\iamra\.gemini\antigravity\brain\3cb12e90-b46a-469f-929f-57a45c066e50\scratch"
        forks_path = os.path.join(scratch_dir, "check_forks.py")
        if os.path.exists(forks_path):
            with open(forks_path, "r") as f:
                content = f.read()
                for line in content.splitlines():
                    if "SRIRAM_TOKEN =" in line:
                        sriram_token = line.split("=", 1)[1].strip().strip('"').strip("'")
                    elif "SURIYA_TOKEN =" in line:
                        suriya_token = line.split("=", 1)[1].strip().strip('"').strip("'")
        if not suriya_token:
            collabs_path = os.path.join(scratch_dir, "check_collabs.py")
            if os.path.exists(collabs_path):
                with open(collabs_path, "r") as f:
                    content = f.read()
                    for line in content.splitlines():
                        if "SURIYA_TOKEN =" in line:
                            suriya_token = line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception as e:
        print("Error loading local tokens:", e)
    return {"sriram": sriram_token, "suriya": suriya_token, "rizz": rizz_token}

def trigger_github_workflow(repo, workflow_file):
    import urllib.request
    tokens = get_local_tokens()
    token = tokens.get("sriram")
    if not token:
        return False
    
    url = f"https://api.github.com/repos/SriramGandhiS/{repo}/actions/workflows/{workflow_file}/dispatches"
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
        print(f"Error triggering AI workflow dispatch for {repo}/{workflow_file}: {e}")
        return False

if __name__ == "__main__":
    os.chdir(DIRECTORY)
    from http.server import ThreadingHTTPServer
    class ThreadedHTTPServer(ThreadingHTTPServer):
        allow_reuse_address = True
        
    with ThreadedHTTPServer(("", PORT), CustomHandler) as httpd:
        print(f"Serving HTTP on port {PORT}...")
        httpd.serve_forever()
