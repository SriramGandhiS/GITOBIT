"""
Emergency Fallback Script
Triggers 2 commits on a target repo by editing README.md twice.
Run this manually or via /api/emergency-trigger when GitHub Actions won't dispatch.

Usage:
  python emergency_fallback.py [repo] [profile]
  python emergency_fallback.py Study-and-Code sriram
  python emergency_fallback.py RailFlow sriram
"""
import urllib.request
import urllib.parse
import json
import os
import sys
import base64
import datetime

SHARED_OWNER = "SriramGandhiS"
SURIYA_OWNER = "Suriyakumar4036"
RIZZ_OWNER = "rizz-architect"

PROFILE_OWNERS = {
    "sriram": SHARED_OWNER,
    "suriya": SURIYA_OWNER,
    "rizz": RIZZ_OWNER,
}

def load_tokens():
    tokens = {"sriram": "", "suriya": "", "rizz": ""}
    try:
        scratch_dir = r"C:\Users\iamra\.gemini\antigravity\brain\3cb12e90-b46a-469f-929f-57a45c066e50\scratch"
        forks_path = os.path.join(scratch_dir, "check_forks.py")
        if os.path.exists(forks_path):
            with open(forks_path, "r") as f:
                for line in f.read().splitlines():
                    if "SRIRAM_TOKEN =" in line:
                        tokens["sriram"] = line.split("=", 1)[1].strip().strip('"').strip("'")
                    elif "SURIYA_TOKEN =" in line:
                        tokens["suriya"] = line.split("=", 1)[1].strip().strip('"').strip("'")
        if not tokens["suriya"]:
            collabs_path = os.path.join(scratch_dir, "check_collabs.py")
            if os.path.exists(collabs_path):
                with open(collabs_path, "r") as f:
                    for line in f.read().splitlines():
                        if "SURIYA_TOKEN =" in line:
                            tokens["suriya"] = line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception as e:
        print(f"[WARN] Token load error: {e}")
    return tokens

def github_api(method, path, token, body=None):
    url = f"https://api.github.com{path}"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "emergency-fallback/1.0",
        "Content-Type": "application/json",
    }
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            body_str = e.read().decode()
            return e.code, json.loads(body_str)
        except Exception:
            return e.code, {}

def get_readme_sha(owner, repo, token):
    status, data = github_api("GET", f"/repos/{owner}/{repo}/contents/README.md", token)
    if status == 200:
        return data.get("sha"), base64.b64decode(data.get("content", "")).decode("utf-8", errors="replace")
    return None, None

def commit_readme(owner, repo, token, sha, content, message):
    encoded = base64.b64encode(content.encode()).decode()
    status, data = github_api("PUT", f"/repos/{owner}/{repo}/contents/README.md", token, {
        "message": message,
        "content": encoded,
        "sha": sha,
        "branch": "main"
    })
    return status, data

def run_emergency(repo, profile="sriram"):
    tokens = load_tokens()
    token = tokens.get(profile, "")
    if not token:
        print(f"[ERROR] No token found for profile '{profile}'. Aborting.")
        return False

    owner = PROFILE_OWNERS.get(profile, SHARED_OWNER)
    now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"[EMERGENCY] Targeting {owner}/{repo} as '{profile}'")

    # Push 1: Add emergency sync marker line
    sha, content = get_readme_sha(owner, repo, token)
    if sha is None:
        print(f"[ERROR] Could not read README.md from {owner}/{repo}. Status may be 404 or auth failed.")
        return False

    marker = f"\n<!-- emergency-sync: {now} -->"
    new_content = content.rstrip() + marker + "\n"
    status1, resp1 = commit_readme(
        owner, repo, token, sha, new_content,
        f"chore: emergency sync marker [{now}]"
    )
    if status1 not in (200, 201):
        print(f"[ERROR] Push 1 failed. Status {status1}: {resp1}")
        return False

    new_sha = resp1.get("content", {}).get("sha") or resp1.get("commit", {}).get("sha")
    # Re-fetch to get updated SHA for the blob
    sha2, content2 = get_readme_sha(owner, repo, token)
    if not sha2:
        print(f"[ERROR] Could not re-read README after push 1.")
        return False

    # Push 2: Remove marker (clean up)
    restored = content2.replace(marker, "").rstrip() + "\n"
    status2, resp2 = commit_readme(
        owner, repo, token, sha2, restored,
        f"chore: emergency sync cleanup [{now}]"
    )
    if status2 not in (200, 201):
        print(f"[ERROR] Push 2 failed. Status {status2}: {resp2}")
        return False

    print(f"[SUCCESS] 2 commits pushed to {owner}/{repo}")
    return True

if __name__ == "__main__":
    repo = sys.argv[1] if len(sys.argv) > 1 else "Study-and-Code"
    profile = sys.argv[2] if len(sys.argv) > 2 else "sriram"
    ok = run_emergency(repo, profile)
    sys.exit(0 if ok else 1)
