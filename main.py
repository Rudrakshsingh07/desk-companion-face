from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64, tempfile, os, sqlite3, subprocess, datetime, hashlib, secrets, time, pathlib, json, urllib.request, urllib.error, shutil
from pymongo import MongoClient
import face_recognition
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KNOWN_FACES_DIR = os.path.join(BASE_DIR, "known_faces")
UNKNOWN_LOGS_DIR = os.path.join(BASE_DIR, "logs/unknown")
DB_PATH = os.path.join(BASE_DIR, "analytics.db")

mongo_client = MongoClient("mongodb://127.0.0.1:27017/")
mongo_db = mongo_client["desk_companion"]
user_settings_col = mongo_db["user_settings"]

# Ensure unique index on (user_id, key)
user_settings_col.create_index([("user_id", 1), ("key", 1)], unique=True)

HOME = pathlib.Path.home()

# Ensure required directories exist so the app can start cleanly
os.makedirs(KNOWN_FACES_DIR, exist_ok=True)
os.makedirs(UNKNOWN_LOGS_DIR, exist_ok=True)

# ── Session tokens (in-memory) ────────────────────────────────────────────────
SESSION_TIMEOUT_SECONDS = int(os.getenv("SESSION_TIMEOUT_SECONDS", "86400"))
sessions_col = mongo_db["sessions"]

def create_token(username: str, role: str) -> str:
    token = secrets.token_hex(32)
    sessions_col.insert_one({
        "token": token,
        "user": username,
        "role": role,
        "expires": time.time() + SESSION_TIMEOUT_SECONDS,
        "created_at": datetime.datetime.utcnow()
    })
    return token

def verify_token(request: Request) -> dict:
    token = request.headers.get("X-Session-Token", "")
    session = sessions_col.find_one({"token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or missing token")
    if time.time() > session["expires"]:
        sessions_col.delete_one({"token": token})
        raise HTTPException(status_code=401, detail="Session expired")
    
    # sliding window
    sessions_col.update_one(
        {"token": token},
        {"$set": {"expires": time.time() + SESSION_TIMEOUT_SECONDS}}
    )
    return session

# ── Pre-compute encodings on startup ──────────────────────────────────────────
known_encodings = []
known_names = []

def load_known_faces():
    known_encodings.clear()
    known_names.clear()
    for user in os.listdir(KNOWN_FACES_DIR):
        user_dir = os.path.join(KNOWN_FACES_DIR, user)
        if not os.path.isdir(user_dir):
            continue
        for filename in os.listdir(user_dir):
            filepath = os.path.join(user_dir, filename)
            try:
                img = face_recognition.load_image_file(filepath)
                encs = face_recognition.face_encodings(img, num_jitters=5)
                if encs:
                    known_encodings.append(encs[0])
                    known_names.append(user)
                    print(f"Loaded: {user}/{filename}")
            except Exception as e:
                print(f"Skipped {filepath}: {e}")
    print(f"Total encodings loaded: {len(known_encodings)}")

load_known_faces()

# ── DB ─────────────────────────────────────────────────────────────────────────
conn = sqlite3.connect(DB_PATH, check_same_thread=False)
conn.execute("""CREATE TABLE IF NOT EXISTS events
    (id INTEGER PRIMARY KEY, event TEXT, user_id TEXT, timestamp TEXT)""")
conn.execute("""CREATE TABLE IF NOT EXISTS users
    (username TEXT PRIMARY KEY, password_hash TEXT, role TEXT, created_at TEXT)""")
conn.commit()

def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
    return base64.b64encode(salt + dk).decode("utf-8")

def _verify_password(password: str, stored: str) -> bool:
    try:
        raw = base64.b64decode(stored.encode("utf-8"))
        salt, expected = raw[:16], raw[16:]
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200_000)
        return secrets.compare_digest(dk, expected)
    except Exception:
        return False

def _ensure_admin_user():
    cur = conn.execute("SELECT username FROM users WHERE username = ?", ("admin",))
    if cur.fetchone() is None:
        conn.execute(
            "INSERT INTO users (username, password_hash, role, created_at) VALUES (?,?,?,?)",
            ("admin", _hash_password("admin"), "admin", datetime.datetime.utcnow().isoformat()),
        )
        conn.commit()

_ensure_admin_user()

# ── Models ─────────────────────────────────────────────────────────────────────
class ImagePayload(BaseModel):
    image: str  # base64

class LogPayload(BaseModel):
    event: str
    user_id: str
    timestamp: str

class CommandPayload(BaseModel):
    action: str
    meta: dict = {}

class RegisterFacePayload(BaseModel):
    username: str
    image: str  # base64

class RegisterUserPayload(BaseModel):
    username: str
    password: str
    role: str = "user"
    image: str  # base64

class LoginPayload(BaseModel):
    username: str
    password: str

# ── Command Registry ──────────────────────────────────────────────────────────
COMMANDS: dict[str, dict] = {
    "shutdown": {
        "cmd": ["systemctl", "poweroff"],
        "roles": ["admin"],
        "description": "Shut down the laptop",
    },
    "lock_screen": {
        "cmd": ["loginctl", "lock-session"],
        "roles": ["admin", "user"],
        "description": "Lock the session",
    },
    "code_mode": {
        "cmd": None,
        "roles": ["admin", "user"],
        "description": "Open Neovim, Obsidian, YouTube",
    },
    "capture_inspiration": {
        "cmd": None,
        "roles": ["admin", "user"],
        "description": "Full-screen screenshot to ~/Pictures/Inspiration",
    },
    "project_status": {
        "cmd": None,
        "roles": ["admin", "user"],
        "description": "Generate AI analyst report for saved GitHub repo",
    },
}

# ── Helper ─────────────────────────────────────────────────────────────────────
def decode_image(image_str: str) -> bytes:
    if "," in image_str:
        image_str = image_str.split(",")[1]
    return base64.b64decode(image_str)

def _utc_iso() -> str:
    return datetime.datetime.utcnow().isoformat()

def _log_event(event: str, user_id: str):
    try:
        conn.execute(
            "INSERT INTO events (event, user_id, timestamp) VALUES (?,?,?)",
            (event, user_id, _utc_iso()),
        )
        conn.commit()
    except Exception:
        # Best-effort: never break core UX for logging
        pass

def _binary_exists(name: str) -> bool:
    return shutil.which(name) is not None

def _proc_env() -> dict:
    env = os.environ.copy()
    env["DBUS_SESSION_BUS_ADDRESS"] = "unix:path=/run/user/1000/bus"
    env["XDG_RUNTIME_DIR"] = "/run/user/1000"
    env["WAYLAND_DISPLAY"] = "wayland-1"
    return env

def _run_cmd(cmd: list[str], timeout_s: int = 10) -> dict:
    try:
        print(f"Executing: {' '.join(cmd)}")
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            shell=False,
            check=False,
            env=_proc_env(),
        )
        msg = (proc.stderr or proc.stdout or "Done").strip()
        if proc.returncode != 0:
            print(f"Command failed with code {proc.returncode}. Error: {msg}")
        return {"ok": proc.returncode == 0, "message": msg[:300] if msg else ("Done" if proc.returncode == 0 else "Failed")}
    except subprocess.TimeoutExpired:
        return {"ok": False, "message": "Command timed out"}
    except FileNotFoundError as e:
        return {"ok": False, "message": f"Binary not found: {e}"}
    except Exception as e:
        return {"ok": False, "message": str(e)[:300]}

def _github_get_json(url: str) -> dict | list | None:
    import urllib.error
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "desk-companion",
            "Accept": "application/vnd.github+json",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise

def handle_code_mode() -> dict:
    term = "kitty" if _binary_exists("kitty") else None
    browser = "zen-browser" if _binary_exists("zen-browser") else ("firefox" if _binary_exists("firefox") else None)
    if not term:
        return {"ok": False, "message": "kitty not found in PATH"}
    if not _binary_exists("nvim"):
        return {"ok": False, "message": "nvim not found in PATH"}
    obsidian_path = "/home/r/.local/bin/obsidian.AppImage"
    if not os.path.exists(obsidian_path):
        return {"ok": False, "message": f"Obsidian not found at {obsidian_path}"}
    if not browser:
        return {"ok": False, "message": "No browser found (zen-browser or firefox)"}

    try:
        env = _proc_env()
        subprocess.Popen([term, "--", "nvim"], start_new_session=True, env=env)
        subprocess.Popen([obsidian_path], start_new_session=True, env=env)
        subprocess.Popen([browser, "https://youtube.com"], start_new_session=True, env=env)
        return {"ok": True, "message": "Launched Neovim, Obsidian, YouTube"}
    except Exception as e:
        return {"ok": False, "message": str(e)[:300]}

def handle_capture_inspiration() -> dict:
    dest = HOME / "Pictures" / "Inspiration"
    dest.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = dest / f"inspiration_{timestamp}.png"

    # Prefer grim on Wayland; then common fallbacks.
    candidates: list[list[str]] = []
    if _binary_exists("grim"):
        candidates.append(["grim", str(filepath)])
    if _binary_exists("scrot"):
        candidates.append(["scrot", str(filepath)])
    if _binary_exists("gnome-screenshot"):
        candidates.append(["gnome-screenshot", "-f", str(filepath)])
    if _binary_exists("import"):
        candidates.append(["import", "-window", "root", str(filepath)])

    if not candidates:
        return {"ok": False, "message": "No screenshot tool found (grim/scrot/gnome-screenshot/import)"}

    last_err = ""
    for cmd in candidates:
        try:
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=10,
                shell=False,
                check=False,
                env=_proc_env(),
            )
            if res.returncode == 0 and filepath.exists() and filepath.stat().st_size > 0:
                return {"ok": True, "message": f"Saved to {filepath}"}
            last_err = (res.stderr or res.stdout or "").strip() or "Screenshot failed"
        except Exception as e:
            last_err = str(e)
    return {"ok": False, "message": last_err[:300]}

def handle_project_status(username: str) -> dict:
    doc = user_settings_col.find_one(
        {"user_id": username, "key": "project_status_repo"},
        {"_id": 0, "value": 1}
    )
    if not doc:
        return {"ok": False, "message": f"No repo configured for user '{username}'. Set it in the Repo link (pencil icon)."}
    
    repo_url = doc["value"].strip().removesuffix(".git")
    parts = repo_url.rstrip("/").split("/")
    if len(parts) < 2:
        return {"ok": False, "message": "Invalid repo URL"}
    owner, repo = parts[-2], parts[-1]
    api_base = f"https://api.github.com/repos/{owner}/{repo}"

    try:
        meta = _github_get_json(api_base)
        if not meta or not isinstance(meta, dict):
            return {"ok": False, "message": f"Repository not found or API error: {repo_url}"}

        commits = _github_get_json(f"{api_base}/commits?per_page=10")
        if not isinstance(commits, list):
            commits = []
        
        languages_data = _github_get_json(f"{api_base}/languages") or {}
        
        readme_text = ""
        readme_data = _github_get_json(f"{api_base}/readme")
        if readme_data:
            content = readme_data.get("content", "")
            if content:
                readme_text = base64.b64decode(content).decode("utf-8", errors="replace")[:15000]
        else:
            readme_text = "(No README found)"

        # Strip HTML tags from README to avoid rendering issues in Obsidian
        import re
        readme_text = re.sub(r'<[^>]+>', '', readme_text)

        # --- Professional Analysis Logic ---
        stars = meta.get('stargazers_count', 0)
        issues = meta.get('open_issues_count', 0)
        forks = meta.get('forks_count', 0)
        
        health_score = "Healthy"
        if issues > stars * 2 and stars > 10:
            health_score = "Needs Attention (High Issue Ratio)"
        elif not meta.get('pushed_at') or (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(meta.get('pushed_at').replace('Z', '+00:00'))).days > 180:
            health_score = "Stale (No recent activity)"
        
        # --- Build Mermaid Language Pie ---
        lang_pie = ""
        if languages_data:
            total_bytes = sum(languages_data.values())
            lang_pie = "```mermaid\npie title Language Distribution\n"
            for lang, val in list(languages_data.items())[:5]: # Top 5
                per = (val / total_bytes) * 100
                lang_pie += f'    "{lang}" : {per:.1f}\n'
            lang_pie += "```"

        # --- Build Commit Table ---
        commit_table = "| Date | Author | Message |\n| :--- | :--- | :--- |\n"
        if commits:
            for c in commits[:10]:
                date = c['commit']['author']['date'][:10]
                author = c['commit']['author']['name']
                msg = c['commit']['message'].splitlines()[0][:50].replace('|', '\\|')
                commit_table += f"| {date} | {author} | {msg} |\n"
        else:
            commit_table = "_No recent commits found._"

        # --- Assembly with better line handling for Obsidian ---
        prompt_date = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        owner_repo = meta.get('full_name', repo)
        
        # Pre-indent README for blockquote to avoid complex f-string joins
        readme_indented = ""
        if readme_text:
            readme_indented = "\n".join([f"> {line}" for line in readme_text.splitlines()])
        else:
            readme_indented = "> _No README content available._"

        report_md = f"""# 🚀 Project Analysis: {owner_repo}
*Generated on {prompt_date}*

![Stars](https://img.shields.io/github/stars/{owner_repo}?style=for-the-badge&color=gold)
![Forks](https://img.shields.io/github/forks/{owner_repo}?style=for-the-badge&color=blue)
![Issues](https://img.shields.io/github/issues/{owner_repo}?style=for-the-badge&color=red)
![License](https://img.shields.io/github/license/{owner_repo}?style=for-the-badge)

## 📋 Executive Summary
This report provides a technical overview of **{meta.get('name')}**. General repository health is currently rated as **{health_score}**.

> {meta.get('description') or 'No description provided.'}

---

## 📊 Repository Health Metrics
| Metric | Value | Status |
| :--- | :--- | :--- |
| **Stars** | {stars} | Popularity Index |
| **Forks** | {forks} | Community Reach |
| **Open Issues** | {issues} | Maintenance Load |
| **Main Language** | `{meta.get('language', 'N/A')}` | Core Tech Stack |

### 🛠️ Technology Breakdown
{lang_pie}

---

## 🕒 Recent Activity (Last 10 Commits)
{commit_table}

## 📝 README Insight
> [!ABSTRACT] 
> **Source documentation excerpt:**
> 
{readme_indented}

---
*Report generated by Desk Companion Analyst Suite.*
"""
        desktop = HOME / "Desktop"
        desktop.mkdir(exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = desktop / f"analysis_{repo}_{timestamp}.md"
        out_path.write_text(report_md, encoding="utf-8")
        return {"ok": True, "message": f"Full analysis saved to {out_path.name}"}

    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            body = ""
        msg = f"GitHub API error: {e.code}"
        if e.code == 403 and "rate limit" in body.lower():
            msg = "GitHub API rate limit exceeded"
        return {"ok": False, "message": msg}
    except urllib.error.URLError as e:
        return {"ok": False, "message": f"Network error: {getattr(e, 'reason', e)}"}
    except Exception as e:
        # Common case: Ollama not running -> connection refused
        return {"ok": False, "message": str(e)[:300]}

# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "desk-companion API is running"}

@app.post("/recognize")
def recognize(payload: ImagePayload):
    try:
        img_data = decode_image(payload.image)
    except Exception as e:
        return {"authenticated": False, "user_id": "unknown", "error": f"decode error: {str(e)}"}

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        f.write(img_data)
        tmp_path = f.name

    try:
        img = face_recognition.load_image_file(tmp_path)
        encodings = face_recognition.face_encodings(img)

        if not encodings:
            return {"authenticated": False, "user_id": "unknown", "reason": "no face detected"}

        incoming_enc = encodings[0]
        matches = face_recognition.compare_faces(known_encodings, incoming_enc, tolerance=0.65)
        distances = face_recognition.face_distance(known_encodings, incoming_enc)

        if True in matches:
            best_idx = int(np.argmin(distances))
            user_id = known_names[best_idx]
            role = "user"
            try:
                cur = conn.execute("SELECT role FROM users WHERE username = ?", (user_id,))
                row = cur.fetchone()
                if row and row[0]:
                    role = row[0]
            except Exception:
                role = "user"
            if user_id == "Rudraksh":
                role = "admin"
            token = create_token(user_id, role)
            return {"authenticated": True, "user_id": user_id, "role": role, "token": token}

        # unknown — save face crop with correct jpeg bytes
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        os.makedirs(UNKNOWN_LOGS_DIR, exist_ok=True)
        unknown_path = os.path.join(UNKNOWN_LOGS_DIR, f"{ts}.jpg")
        with open(unknown_path, "wb") as f:
            f.write(img_data)
        return {"authenticated": False, "user_id": "unknown"}

    except Exception as e:
        return {"authenticated": False, "user_id": "unknown", "error": str(e)}
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.post("/reload-faces")
def reload_faces():
    load_known_faces()
    return {"status": "ok", "loaded": len(known_encodings)}

@app.post("/register-face")
def register_face(payload: RegisterFacePayload):
    username = payload.username.strip()
    if not username:
        return {"status": "error", "error": "username required"}
    try:
        img_data = decode_image(payload.image)
    except Exception as e:
        return {"status": "error", "error": f"decode error: {str(e)}"}

    user_dir = os.path.join(KNOWN_FACES_DIR, username)
    os.makedirs(user_dir, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(user_dir, f"{ts}.jpg")
    with open(filepath, "wb") as f:
        f.write(img_data)

    # Reload encodings so the new face is immediately available
    load_known_faces()
    return {"status": "ok", "username": username, "encodings_loaded": len(known_encodings)}

@app.post("/register-user")
def register_user(payload: RegisterUserPayload):
    username = payload.username.strip()
    password = payload.password
    role = (payload.role or "user").strip().lower()
    if not username:
        return {"status": "error", "error": "username required"}
    if not password or not password.strip():
        return {"status": "error", "error": "password required"}
    if role not in ("admin", "user"):
        return {"status": "error", "error": "invalid role"}

    # Enforce unique usernames
    cur = conn.execute("SELECT username FROM users WHERE username = ?", (username,))
    if cur.fetchone() is not None:
        return {"status": "error", "error": "username already exists"}

    try:
        img_data = decode_image(payload.image)
    except Exception as e:
        return {"status": "error", "error": f"decode error: {str(e)}"}

    # Persist user in DB
    conn.execute(
        "INSERT INTO users (username, password_hash, role, created_at) VALUES (?,?,?,?)",
        (username, _hash_password(password), role, datetime.datetime.utcnow().isoformat()),
    )
    conn.commit()

    # Persist face image on disk
    user_dir = os.path.join(KNOWN_FACES_DIR, username)
    os.makedirs(user_dir, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = os.path.join(user_dir, f"{ts}.jpg")
    with open(filepath, "wb") as f:
        f.write(img_data)

    load_known_faces()
    return {"status": "ok", "username": username, "role": role}

@app.get("/users")
def list_users():
    cur = conn.execute("SELECT username, role, created_at FROM users ORDER BY created_at DESC")
    rows = cur.fetchall()
    return {"users": [{"username": r[0], "role": r[1], "createdAt": r[2]} for r in rows]}

@app.delete("/users/{username}")
def delete_user(username: str):
    username = username.strip()
    if not username:
        return {"status": "error", "error": "username required"}
    if username == "admin":
        return {"status": "error", "error": "cannot delete admin"}

    conn.execute("DELETE FROM users WHERE username = ?", (username,))
    conn.commit()

    # Best-effort delete of stored face images
    user_dir = os.path.join(KNOWN_FACES_DIR, username)
    if os.path.isdir(user_dir):
        for fn in os.listdir(user_dir):
            try:
                os.remove(os.path.join(user_dir, fn))
            except Exception:
                pass
        try:
            os.rmdir(user_dir)
        except Exception:
            pass

    load_known_faces()
    return {"status": "ok"}

@app.post("/login")
def login(payload: LoginPayload):
    username = payload.username.strip()
    password = payload.password
    if not username or not password:
        return {"status": "error", "error": "missing credentials"}
    cur = conn.execute("SELECT password_hash, role FROM users WHERE username = ?", (username,))
    row = cur.fetchone()
    if not row:
        return {"status": "error", "error": "invalid credentials"}
    if not _verify_password(password, row[0]):
        return {"status": "error", "error": "invalid credentials"}
    role = row[1] or "user"
    token = create_token(username, role)
    return {"status": "ok", "username": username, "role": role, "token": token}

@app.get("/notifications")
def notifications():
    """
    Best-effort notifications feed.
    If KDE Connect is available and paired, return recent notifications.
    Otherwise return an empty list.
    """
    try:
        # kdeconnect-cli output format can vary; keep parsing conservative.
        res = subprocess.run(
            ["kdeconnect-cli", "--list-notifications"],
            capture_output=True,
            text=True,
            check=False,
            env=_proc_env(),
        )
        out = (res.stdout or "").strip()
        if not out:
            return {"notifications": []}

        # Very tolerant parsing: each line may contain an id + title.
        # Example-ish: "<id>: <title>"
        items = []
        for line in out.splitlines():
            line = line.strip()
            if not line:
                continue
            if ":" in line:
                nid, title = line.split(":", 1)
                items.append({
                    "id": nid.strip(),
                    "title": title.strip(),
                    "timestamp": _utc_iso(),
                })
            else:
                items.append({
                    "id": line,
                    "title": line,
                    "timestamp": _utc_iso(),
                })
        return {"notifications": items[:30]}
    except Exception:
        return {"notifications": []}

@app.post("/log")
def log_event(payload: LogPayload):
    try:
        conn.execute(
            "INSERT INTO events (event, user_id, timestamp) VALUES (?,?,?)",
            (payload.event, payload.user_id, payload.timestamp)
        )
        conn.commit()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.get("/analytics")
def get_analytics():
    cursor = conn.execute(
        "SELECT event, user_id, timestamp FROM events ORDER BY timestamp DESC LIMIT 100"
    )
    rows = cursor.fetchall()
    return {"events": [{"event": r[0], "user_id": r[1], "timestamp": r[2]} for r in rows]}

@app.post("/command")
def run_command(payload: CommandPayload, request: Request):
    session = verify_token(request)
    action = payload.action

    if action not in COMMANDS:
        raise HTTPException(status_code=400, detail="Unknown command")
    if session["role"] not in COMMANDS[action]["roles"] and session["user"] != "Rudraksh":
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    if action == "code_mode":
        result = handle_code_mode()
    elif action == "capture_inspiration":
        result = handle_capture_inspiration()
    elif action == "project_status":
        result = handle_project_status(session["user"])
    else:
        cmd = COMMANDS[action]["cmd"]
        if not isinstance(cmd, list):
            raise HTTPException(status_code=500, detail="Command misconfigured")
        result = _run_cmd(cmd, timeout_s=10)

    _log_event(f"command_run:{action}", session["user"])
    return {**result, "action": action}

@app.get("/settings/{key}")
def get_setting(key: str, request: Request):
    session = verify_token(request)
    doc = user_settings_col.find_one(
        {"user_id": session["user"], "key": key},
        {"_id": 0, "value": 1}
    )
    return {"key": key, "value": doc["value"] if doc else None}

@app.post("/settings/{key}")
def set_setting(key: str, request: Request, value: str = Query(...)):
    session = verify_token(request)
    if key != "project_status_repo" and session["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    user_settings_col.update_one(
        {"user_id": session["user"], "key": key},
        {"$set": {"user_id": session["user"], "key": key, "value": value}},
        upsert=True
    )
    return {"ok": True}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "known_users": list(set(known_names)),
        "encodings_loaded": len(known_encodings),
        "unknown_attempts": len(os.listdir(UNKNOWN_LOGS_DIR)) if os.path.exists(UNKNOWN_LOGS_DIR) else 0
    }