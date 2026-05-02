# BDX Hosting Panel — Railway Deployment Guide

## One-click Deploy

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

## Steps

### 1. Create a Railway project
1. Go to [railway.app](https://railway.app) → New Project
2. Click **Deploy from GitHub repo** → select this repo
3. Set the **Root Directory** to `artifacts/bdx-python`

### 2. Add PostgreSQL
1. In your Railway project → **+ New** → **Database** → **PostgreSQL**
2. Railway auto-sets `DATABASE_URL` — no extra config needed

### 3. Set Environment Variables
In Railway project → **Variables**, add:

| Variable | Value | Required |
|---|---|---|
| `SESSION_SECRET` | Random 32+ char string | ✅ |
| `BASE_PATH` | `/` | ✅ |
| `ADMIN_EMAIL` | your email | optional |
| `ADMIN_PASSWORD` | your password | optional |

> `PORT` and `DATABASE_URL` are set automatically by Railway.

### 4. Create Admin Account
After deploy, visit `https://your-app.railway.app/signup` and create your account.
Then in Railway → **PostgreSQL** → **Query**:
```sql
UPDATE users SET role='admin' WHERE email='your@email.com';
```

### 5. Done!
Your app is live at `https://your-app.railway.app`

---

## Local Development
```bash
pip install -r requirements.txt
export DATABASE_URL=postgresql://...
export SESSION_SECRET=dev-secret
export BASE_PATH=/python-panel
python main.py
```

## Environment Variables Reference
```
DATABASE_URL      PostgreSQL connection string (auto on Railway)
SESSION_SECRET    Cookie signing key (required)
BASE_PATH         URL prefix — use / for Railway, /python-panel for Replit
PORT              Auto-set by Railway/Replit
WEB_CONCURRENCY   Uvicorn worker count (default: 1)
```
