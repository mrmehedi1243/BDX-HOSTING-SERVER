import os
import bcrypt
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

SECRET = os.environ.get("SESSION_SECRET", "bdx-hosting-secret-key-2024")
SALT = "bdx-session-v1"
COOKIE = "bdx_session"
MAX_AGE = 86400 * 30  # 30 days


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    if not hashed:
        return False
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_token(user_id: int) -> str:
    s = URLSafeTimedSerializer(SECRET)
    return s.dumps(user_id, salt=SALT)


def read_token(token: str) -> int | None:
    s = URLSafeTimedSerializer(SECRET)
    try:
        return s.loads(token, salt=SALT, max_age=MAX_AGE)
    except (BadSignature, SignatureExpired, Exception):
        return None
