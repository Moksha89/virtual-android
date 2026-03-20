"""SQLite database for user management and device assignments."""

import aiosqlite
import os
from pathlib import Path

DATA_DIR = Path("/data") if os.path.exists("/data") else Path(__file__).parent.parent
DB_PATH = DATA_DIR / "dashboard.db"


async def get_db() -> aiosqlite.Connection:
    """Get a database connection."""
    db = await aiosqlite.connect(str(DB_PATH))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    return db


async def init_db():
    """Initialize database tables."""
    db = await get_db()
    try:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'user',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_login TEXT
            );

            CREATE TABLE IF NOT EXISTS device_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(device_id, user_id)
            );
        """)
        await db.commit()

        # Create default admin if none exists
        cursor = await db.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
        row = await cursor.fetchone()
        if row[0] == 0:
            from app.auth import hash_password
            admin_hash = hash_password("admin123")
            await db.execute(
                "INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)",
                ("admin", "admin@localhost", admin_hash, "admin"),
            )
            await db.commit()
    finally:
        await db.close()
