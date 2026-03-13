from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import base64, tempfile, os, sqlite3, subprocess, datetime, hashlib, secrets
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

# Ensure required directories exist so the app can start cleanly
os.makedirs(KNOWN_FACES_DIR, exist_ok=True)
os.makedirs(UNKNOWN_LOGS_DIR, exist_ok=True)

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
    command_id: str = ""

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

# KDE Connect — run `kdeconnect-cli -l` to find your device name
DEVICE_NAME = "your_device_name"

COMMANDS = {
    "media_pause":  ["kdeconnect-cli", "-n", DEVICE_NAME, "--pause"],
    "media_play":   ["kdeconnect-cli", "-n", DEVICE_NAME, "--play"],
    "media_next":   ["kdeconnect-cli", "-n", DEVICE_NAME, "--next"],
    "media_prev":   ["kdeconnect-cli", "-n", DEVICE_NAME, "--previous"],
    "volume_up":    ["kdeconnect-cli", "-n", DEVICE_NAME, "--increase-volume"],
    "volume_down":  ["kdeconnect-cli", "-n", DEVICE_NAME, "--decrease-volume"],
    "lock":         ["loginctl", "lock-session"],
}

# ── Helper ─────────────────────────────────────────────────────────────────────
def decode_image(image_str: str) -> bytes:
    if "," in image_str:
        image_str = image_str.split(",")[1]
    return base64.b64decode(image_str)

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
            return {"authenticated": True, "user_id": user_id}

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
    return {"status": "ok", "username": username, "role": row[1]}

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
def run_command(payload: CommandPayload):
    cmd = COMMANDS.get(payload.action)
    if cmd:
        try:
            subprocess.run(cmd, check=True)
            return {"status": "ok", "action": payload.action}
        except subprocess.CalledProcessError as e:
            return {"status": "error", "error": str(e)}
    return {"status": "unknown command"}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "known_users": list(set(known_names)),
        "encodings_loaded": len(known_encodings),
        "unknown_attempts": len(os.listdir(UNKNOWN_LOGS_DIR)) if os.path.exists(UNKNOWN_LOGS_DIR) else 0
    }