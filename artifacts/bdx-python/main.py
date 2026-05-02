import os, asyncio, json, random
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI, Request, HTTPException, Form
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sse_starlette.sse import EventSourceResponse
from pydantic import BaseModel
from typing import Optional

import db
import auth as Auth

BASE = os.environ.get("BASE_PATH", "/python-panel").rstrip("/")
PORT = int(os.environ.get("PORT", 5000))

# SSE registry: server_id -> set of asyncio.Queue
sse_clients: dict[int, set[asyncio.Queue]] = {}

PUBLIC_PATHS = [f"{BASE}/login", f"{BASE}/signup", f"{BASE}/static"]

async def broadcast_log(server_id: int, log: dict):
    if server_id in sse_clients:
        data = json.dumps(log)
        for q in list(sse_clients[server_id]):
            try:
                q.put_nowait(data)
            except asyncio.QueueFull:
                pass

def rand(a, b): return random.randint(a, b)

def row_to_json(row: dict) -> dict:
    out = {}
    for k, v in row.items():
        if isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out

@asynccontextmanager
async def lifespan(app: FastAPI):
    await db.get_pool()
    yield

app = FastAPI(lifespan=lifespan)

# ── Auth middleware ───────────────────────────────────────────────────────────
@app.middleware("http")
async def session_middleware(request: Request, call_next):
    token = request.cookies.get(Auth.COOKIE)
    user = None
    if token:
        uid = Auth.read_token(token)
        if uid:
            user = await db.fetchone("SELECT * FROM users WHERE id=$1", uid)
    request.state.user = user

    path = request.url.path
    is_public = any(path.startswith(p) for p in PUBLIC_PATHS) or path == f"{BASE}/login" or path == f"{BASE}/signup"

    # Redirect to login if not authenticated (only for page routes, skip API/static)
    if not is_public and user is None and not path.startswith(f"{BASE}/static"):
        # Allow API routes to return 401 instead of redirect
        if path.startswith(f"{BASE}/api/"):
            return JSONResponse({"detail": "Not authenticated"}, status_code=401)
        return RedirectResponse(f"{BASE}/login", status_code=302)

    # Admin-only routes
    if path.startswith(f"{BASE}/admin") and user and user.get("role") != "admin":
        return RedirectResponse(f"{BASE}/", status_code=302)

    return await call_next(request)

templates = Jinja2Templates(directory=os.path.join(os.path.dirname(__file__), "templates"))
app.mount(f"{BASE}/static", StaticFiles(directory=os.path.join(os.path.dirname(__file__), "static")), name="static")

# ── Template helper ───────────────────────────────────────────────────────────
def tpl(request: Request, name: str, **kwargs):
    return templates.TemplateResponse(
        request=request, name=name,
        context={"base": BASE, "current_user": request.state.user, **kwargs}
    )

# ══════════════════════════════════════════════════════════════════════════════
# AUTH PAGES
# ══════════════════════════════════════════════════════════════════════════════

@app.get(f"{BASE}/login", response_class=HTMLResponse)
async def page_login(request: Request):
    if request.state.user:
        return RedirectResponse(f"{BASE}/", status_code=302)
    return tpl(request, "login.html")

@app.post(f"{BASE}/login")
async def do_login(request: Request, email: str = Form(...), password: str = Form(...)):
    user = await db.fetchone("SELECT * FROM users WHERE email=$1", email)
    if not user or not Auth.verify_password(password, user.get("password_hash", "")):
        return tpl(request, "login.html", error="Invalid email or password.")
    token = Auth.create_token(user["id"])
    resp = RedirectResponse(f"{BASE}/", status_code=302)
    resp.set_cookie(Auth.COOKIE, token, max_age=Auth.MAX_AGE, httponly=True, samesite="lax")
    return resp

@app.get(f"{BASE}/signup", response_class=HTMLResponse)
async def page_signup(request: Request):
    if request.state.user:
        return RedirectResponse(f"{BASE}/", status_code=302)
    plans = await db.fetchall("SELECT * FROM plans ORDER BY price_per_month")
    return tpl(request, "signup.html", plans=plans)

@app.post(f"{BASE}/signup")
async def do_signup(
    request: Request,
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    plan_id: Optional[int] = Form(None),
):
    existing = await db.fetchone("SELECT id FROM users WHERE email=$1", email)
    if existing:
        plans = await db.fetchall("SELECT * FROM plans ORDER BY price_per_month")
        return tpl(request, "signup.html", plans=plans, error="An account with this email already exists.")
    pw_hash = Auth.hash_password(password)
    user = await db.fetchone(
        "INSERT INTO users(username,email,role,password_hash,plan_id) VALUES($1,$2,'user',$3,$4) RETURNING *",
        username, email, pw_hash, plan_id
    )
    token = Auth.create_token(user["id"])
    resp = RedirectResponse(f"{BASE}/", status_code=302)
    resp.set_cookie(Auth.COOKIE, token, max_age=Auth.MAX_AGE, httponly=True, samesite="lax")
    return resp

@app.get(f"{BASE}/logout")
async def do_logout():
    resp = RedirectResponse(f"{BASE}/login", status_code=302)
    resp.delete_cookie(Auth.COOKIE)
    return resp

# ══════════════════════════════════════════════════════════════════════════════
# HTML PAGES
# ══════════════════════════════════════════════════════════════════════════════

@app.get(f"{BASE}/", response_class=HTMLResponse)
@app.get(f"{BASE}", response_class=HTMLResponse)
async def page_dashboard(request: Request):
    return tpl(request, "index.html", active="dashboard")

@app.get(f"{BASE}/servers", response_class=HTMLResponse)
async def page_servers(request: Request):
    return tpl(request, "servers.html", active="servers")

@app.get(f"{BASE}/console/{{server_id}}", response_class=HTMLResponse)
async def page_console(request: Request, server_id: int):
    return tpl(request, "console.html", server_id=server_id)

@app.get(f"{BASE}/admin/plans", response_class=HTMLResponse)
async def page_plans(request: Request):
    return tpl(request, "admin/plans.html", active="plans")

@app.get(f"{BASE}/admin/users", response_class=HTMLResponse)
async def page_users(request: Request):
    return tpl(request, "admin/users.html", active="users")

@app.get(f"{BASE}/admin/servers", response_class=HTMLResponse)
async def page_admin_servers(request: Request):
    return tpl(request, "admin/servers.html", active="allservers")

# ══════════════════════════════════════════════════════════════════════════════
# API — DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

@app.get(f"{BASE}/api/me")
async def api_me(request: Request):
    u = request.state.user
    if not u:
        raise HTTPException(401, "Not authenticated")
    row = await db.fetchone("""
        SELECT u.*, p.name as plan_name, p.max_slots, p.price_per_month,
               (SELECT COUNT(*) FROM servers s WHERE s.user_id=u.id) as slots_used
        FROM users u LEFT JOIN plans p ON u.plan_id=p.id
        WHERE u.id=$1
    """, u["id"])
    return row_to_json(row)

@app.get(f"{BASE}/api/stats")
async def api_stats():
    rows = await db.fetchall("SELECT status FROM servers")
    statuses = [r["status"] for r in rows]
    ram = await db.fetchval("SELECT COALESCE(SUM(ram_used_mb),0) FROM servers") or 0
    cpu = await db.fetchval("SELECT COALESCE(AVG(cpu_used),0) FROM servers WHERE status='running'") or 0
    plans = await db.fetchval("SELECT COUNT(*) FROM plans") or 0
    users = await db.fetchval("SELECT COUNT(*) FROM users") or 0
    return {
        "totalUsers": users,
        "totalServers": len(statuses),
        "runningServers": statuses.count("running"),
        "stoppedServers": statuses.count("stopped"),
        "errorServers": statuses.count("error"),
        "totalPlans": plans,
        "totalRamUsedMB": float(ram),
        "avgCpuUsed": float(cpu),
    }

# ══════════════════════════════════════════════════════════════════════════════
# API — SERVERS
# ══════════════════════════════════════════════════════════════════════════════

@app.get(f"{BASE}/api/servers")
async def api_list_servers(request: Request, userId: Optional[int] = None):
    u = request.state.user
    # non-admin users only see their own servers
    if u and u.get("role") != "admin":
        rows = await db.fetchall("SELECT * FROM servers WHERE user_id=$1 ORDER BY created_at DESC", u["id"])
    elif userId:
        rows = await db.fetchall("SELECT * FROM servers WHERE user_id=$1 ORDER BY created_at DESC", userId)
    else:
        rows = await db.fetchall("SELECT * FROM servers ORDER BY created_at DESC")
    return [row_to_json(r) for r in rows]

@app.get(f"{BASE}/api/servers/{{server_id}}")
async def api_get_server(server_id: int):
    row = await db.fetchone("SELECT * FROM servers WHERE id=$1", server_id)
    if not row:
        raise HTTPException(404, "Server not found")
    return row_to_json(row)

class StatusBody(BaseModel):
    status: str

@app.put(f"{BASE}/api/servers/{{server_id}}/status")
async def api_update_status(server_id: int, body: StatusBody):
    row = await db.fetchone("SELECT * FROM servers WHERE id=$1", server_id)
    if not row:
        raise HTTPException(404, "Server not found")
    starting = body.status == "running"
    if starting:
        updated = await db.fetchone(
            """UPDATE servers SET status='running', started_at=NOW(), ram_used_mb=$2, cpu_used=$3, uptime=0
               WHERE id=$1 RETURNING *""",
            server_id, rand(128, 480), rand(5, 40)
        )
        boot_logs = [
            (server_id, f"▶ Initializing process runner...", "info"),
            (server_id, f"✓ Environment variables loaded ({rand(8,24)} vars)", "info"),
            (server_id, f"✓ Network interface bound to 0.0.0.0:{rand(3000,9999)}", "info"),
            (server_id, f"✓ Server \"{row['name']}\" is now running", "info"),
        ]
    else:
        updated = await db.fetchone(
            """UPDATE servers SET status='stopped', started_at=NULL, ram_used_mb=0, cpu_used=0, uptime=0
               WHERE id=$1 RETURNING *""",
            server_id
        )
        boot_logs = [
            (server_id, f"⏹ SIGTERM received — draining connections...", "warn"),
            (server_id, f"✓ Server \"{row['name']}\" stopped gracefully", "info"),
        ]

    for sid, msg, lvl in boot_logs:
        log_row = await db.fetchone(
            "INSERT INTO console_logs(server_id,message,level) VALUES($1,$2,$3) RETURNING *",
            sid, msg, lvl
        )
        await broadcast_log(server_id, row_to_json(log_row))

    return row_to_json(updated)

@app.delete(f"{BASE}/api/servers/{{server_id}}")
async def api_delete_server(server_id: int):
    await db.execute("DELETE FROM console_logs WHERE server_id=$1", server_id)
    await db.execute("DELETE FROM servers WHERE id=$1", server_id)
    return {"message": "deleted"}

# ══════════════════════════════════════════════════════════════════════════════
# API — LOGS + SSE
# ══════════════════════════════════════════════════════════════════════════════

@app.get(f"{BASE}/api/servers/{{server_id}}/logs")
async def api_get_logs(server_id: int, limit: int = 200):
    rows = await db.fetchall(
        "SELECT * FROM console_logs WHERE server_id=$1 ORDER BY timestamp DESC LIMIT $2",
        server_id, limit
    )
    return [row_to_json(r) for r in reversed(rows)]

@app.get(f"{BASE}/api/servers/{{server_id}}/logs/stream")
async def api_stream_logs(request: Request, server_id: int):
    queue: asyncio.Queue = asyncio.Queue(maxsize=100)
    sse_clients.setdefault(server_id, set()).add(queue)

    async def generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield {"data": data}
                except asyncio.TimeoutError:
                    yield {"comment": "heartbeat"}
        finally:
            sse_clients.get(server_id, set()).discard(queue)

    return EventSourceResponse(generator())

class LogBody(BaseModel):
    message: str
    level: str = "info"

@app.post(f"{BASE}/api/servers/{{server_id}}/logs")
async def api_add_log(server_id: int, body: LogBody):
    row = await db.fetchone(
        "INSERT INTO console_logs(server_id,message,level) VALUES($1,$2,$3) RETURNING *",
        server_id, body.message, body.level
    )
    log = row_to_json(row)
    await broadcast_log(server_id, log)
    return log

@app.delete(f"{BASE}/api/servers/{{server_id}}/logs")
async def api_clear_logs(server_id: int):
    await db.execute("DELETE FROM console_logs WHERE server_id=$1", server_id)
    return {"message": "cleared"}

# ══════════════════════════════════════════════════════════════════════════════
# API — PLANS
# ══════════════════════════════════════════════════════════════════════════════

@app.get(f"{BASE}/api/plans")
async def api_list_plans():
    rows = await db.fetchall("SELECT * FROM plans ORDER BY price_per_month")
    return [row_to_json(r) for r in rows]

class PlanBody(BaseModel):
    name: str
    maxSlots: int
    pricePerMonth: int
    ramMB: int
    cpuPercent: int
    description: Optional[str] = ""

@app.post(f"{BASE}/api/plans")
async def api_create_plan(body: PlanBody):
    row = await db.fetchone(
        """INSERT INTO plans(name,max_slots,price_per_month,ram_mb,cpu_percent,description)
           VALUES($1,$2,$3,$4,$5,$6) RETURNING *""",
        body.name, body.maxSlots, body.pricePerMonth, body.ramMB, body.cpuPercent, body.description
    )
    return row_to_json(row)

@app.put(f"{BASE}/api/plans/{{plan_id}}")
async def api_update_plan(plan_id: int, body: PlanBody):
    row = await db.fetchone(
        """UPDATE plans SET name=$2,max_slots=$3,price_per_month=$4,ram_mb=$5,cpu_percent=$6,description=$7
           WHERE id=$1 RETURNING *""",
        plan_id, body.name, body.maxSlots, body.pricePerMonth, body.ramMB, body.cpuPercent, body.description
    )
    if not row:
        raise HTTPException(404, "Plan not found")
    return row_to_json(row)

@app.delete(f"{BASE}/api/plans/{{plan_id}}")
async def api_delete_plan(plan_id: int):
    await db.execute("DELETE FROM plans WHERE id=$1", plan_id)
    return {"message": "deleted"}

# ══════════════════════════════════════════════════════════════════════════════
# API — USERS
# ══════════════════════════════════════════════════════════════════════════════

@app.get(f"{BASE}/api/users")
async def api_list_users():
    rows = await db.fetchall("""
        SELECT u.id, u.username, u.email, u.role, u.plan_id, u.created_at,
               p.name as plan_name, p.max_slots, p.price_per_month,
               (SELECT COUNT(*) FROM servers s WHERE s.user_id=u.id) as slots_used,
               (SELECT COUNT(*) FROM servers s WHERE s.user_id=u.id AND s.status='running') as slots_running
        FROM users u LEFT JOIN plans p ON u.plan_id=p.id
        ORDER BY u.id
    """)
    return [row_to_json(r) for r in rows]

@app.get(f"{BASE}/api/users/{{user_id}}")
async def api_get_user(user_id: int):
    row = await db.fetchone("""
        SELECT u.id, u.username, u.email, u.role, u.plan_id, u.created_at,
               p.name as plan_name, p.max_slots, p.price_per_month,
               (SELECT COUNT(*) FROM servers s WHERE s.user_id=u.id) as slots_used
        FROM users u LEFT JOIN plans p ON u.plan_id=p.id
        WHERE u.id=$1
    """, user_id)
    if not row:
        raise HTTPException(404, "User not found")
    return row_to_json(row)

class UserUpdateBody(BaseModel):
    planId: Optional[int] = None
    role: Optional[str] = None

@app.put(f"{BASE}/api/users/{{user_id}}")
async def api_update_user(user_id: int, body: UserUpdateBody):
    row = await db.fetchone(
        "UPDATE users SET plan_id=$2, role=COALESCE($3::user_role,role) WHERE id=$1 RETURNING id,username,email,role,plan_id",
        user_id, body.planId, body.role
    )
    if not row:
        raise HTTPException(404, "User not found")
    return row_to_json(row)

# ══════════════════════════════════════════════════════════════════════════════
# ENTRYPOINT
# ══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=False)
