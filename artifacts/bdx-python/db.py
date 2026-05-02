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
            min_size=1,
            max_size=10,
        )
    return _pool

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
