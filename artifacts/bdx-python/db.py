import os
import asyncpg
from urllib.parse import urlparse

_pool = None


async def get_pool():
    global _pool
    if _pool is None:
        db_url = os.environ.get("DATABASE_URL", "")
        r = urlparse(db_url)
        _pool = await asyncpg.create_pool(
            host=r.hostname,
            port=r.port or 5432,
            user=r.username,
            password=r.password,
            database=r.path.lstrip("/"),
            min_size=2,
            max_size=10,
        )
    return _pool


async def run_migrations():
    """Create all tables and columns on first deploy — safe to re-run."""
    pool = await get_pool()
    async with pool.acquire() as c:
        # Enums
        await c.execute("""
            DO $$ BEGIN
                CREATE TYPE user_role AS ENUM ('admin', 'user');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        """)
        await c.execute("""
            DO $$ BEGIN
                CREATE TYPE server_status AS ENUM ('running', 'stopped', 'error', 'starting');
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        """)

        # Plans
        await c.execute("""
            CREATE TABLE IF NOT EXISTS plans (
                id               SERIAL PRIMARY KEY,
                name             TEXT NOT NULL,
                description      TEXT DEFAULT '',
                max_slots        INTEGER NOT NULL DEFAULT 1,
                ram_mb           INTEGER NOT NULL DEFAULT 512,
                cpu_percent      INTEGER NOT NULL DEFAULT 25,
                price_per_month  NUMERIC(10,2) NOT NULL DEFAULT 0,
                price_bdt        INTEGER NOT NULL DEFAULT 0,
                duration_days    INTEGER DEFAULT NULL,
                created_at       TIMESTAMP DEFAULT NOW()
            )
        """)

        # Users
        await c.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id                 SERIAL PRIMARY KEY,
                username           TEXT NOT NULL,
                email              TEXT NOT NULL UNIQUE,
                role               user_role NOT NULL DEFAULT 'user',
                plan_id            INTEGER REFERENCES plans(id) ON DELETE SET NULL,
                password_hash      TEXT NOT NULL DEFAULT '',
                plan_expires_at    TIMESTAMP DEFAULT NULL,
                last_payment_bdt   INTEGER DEFAULT 0,
                last_payment_days  INTEGER DEFAULT NULL,
                last_payment_date  TIMESTAMP DEFAULT NULL,
                created_at         TIMESTAMP DEFAULT NOW()
            )
        """)

        # Servers
        await c.execute("""
            CREATE TABLE IF NOT EXISTS servers (
                id          SERIAL PRIMARY KEY,
                name        TEXT NOT NULL,
                user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
                status      server_status NOT NULL DEFAULT 'stopped',
                ram_used_mb INTEGER DEFAULT 0,
                cpu_used    INTEGER DEFAULT 0,
                uptime      INTEGER DEFAULT 0,
                started_at  TIMESTAMP DEFAULT NULL,
                created_at  TIMESTAMP DEFAULT NOW()
            )
        """)

        # Console logs
        await c.execute("""
            CREATE TABLE IF NOT EXISTS console_logs (
                id        SERIAL PRIMARY KEY,
                server_id INTEGER REFERENCES servers(id) ON DELETE CASCADE,
                message   TEXT NOT NULL,
                level     TEXT NOT NULL DEFAULT 'info',
                timestamp TIMESTAMP DEFAULT NOW()
            )
        """)

        # Add any new columns safely (for existing deployments)
        safe_alters = [
            "ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_bdt INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE plans ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT NULL",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP DEFAULT NULL",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_bdt INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_days INTEGER DEFAULT NULL",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP DEFAULT NULL",
        ]
        for sql in safe_alters:
            try:
                await c.execute(sql)
            except Exception:
                pass

        # Seed default plans if empty
        count = await c.fetchval("SELECT COUNT(*) FROM plans")
        if count == 0:
            await c.execute("""
                INSERT INTO plans (name, description, max_slots, ram_mb, cpu_percent, price_per_month, price_bdt, duration_days) VALUES
                ('Starter',    'Free 7-day trial',         1,  512,  25,    0, 0,    7),
                ('Basic',      'Perfect for small bots',   3,  1024, 50,  299, 299,  NULL),
                ('Pro',        'For growing projects',     5,  2048, 75,  599, 599,  NULL),
                ('Enterprise', 'Unlimited power',          10, 4096, 100, 1499,1499, NULL)
            """)


async def fetchall(query: str, *args):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, *args)
        return [dict(r) for r in rows]


async def fetchone(query: str, *args):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, *args)
        return dict(row) if row else None


async def execute(query: str, *args):
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.execute(query, *args)


async def fetchval(query: str, *args):
    pool = await get_pool()
    async with pool.acquire() as conn:
        return await conn.fetchval(query, *args)
