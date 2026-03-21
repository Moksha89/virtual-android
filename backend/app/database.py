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

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS device_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT DEFAULT '',
                profile_id TEXT NOT NULL,
                android_version TEXT DEFAULT '14',
                os_type TEXT DEFAULT 'aosp',
                ram_mb INTEGER DEFAULT 4096,
                storage_gb INTEGER DEFAULT 64,
                cpus INTEGER DEFAULT 4,
                gpu_mode TEXT DEFAULT 'guest_swiftshader',
                pre_installed_apps TEXT DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS api_keys (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                key_hash TEXT UNIQUE NOT NULL,
                key_prefix TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                permissions TEXT DEFAULT '["read"]',
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_used TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL DEFAULT 'info',
                title TEXT NOT NULL,
                message TEXT NOT NULL,
                device_id TEXT,
                is_read INTEGER DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS analytics_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                device_id TEXT,
                user_id INTEGER,
                details TEXT DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS device_tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                tag TEXT NOT NULL,
                color TEXT DEFAULT '#3b82f6',
                UNIQUE(device_id, tag)
            );

            CREATE TABLE IF NOT EXISTS device_pools (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT DEFAULT '',
                color TEXT DEFAULT '#3b82f6',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS device_pool_members (
                pool_id INTEGER NOT NULL,
                device_id TEXT NOT NULL,
                PRIMARY KEY (pool_id, device_id),
                FOREIGN KEY (pool_id) REFERENCES device_pools(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS usage_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                user_id INTEGER,
                started_at TEXT NOT NULL DEFAULT (datetime('now')),
                ended_at TEXT,
                duration_seconds INTEGER DEFAULT 0,
                cost_cents INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS device_schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                title TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                status TEXT DEFAULT 'scheduled',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS webhooks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                events TEXT DEFAULT '["device.created","device.deleted"]',
                secret TEXT DEFAULT '',
                is_active INTEGER DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                last_triggered TEXT
            );

            CREATE TABLE IF NOT EXISTS screenshot_comparisons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                device_id_a TEXT NOT NULL,
                device_id_b TEXT NOT NULL,
                screenshot_a TEXT,
                screenshot_b TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS session_recordings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL DEFAULT 'Untitled',
                device_id TEXT NOT NULL,
                events_data TEXT DEFAULT '',
                duration_seconds INTEGER DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS plugins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                description TEXT DEFAULT '',
                version TEXT DEFAULT '1.0.0',
                author TEXT DEFAULT '',
                hook_events TEXT DEFAULT '[]',
                config_schema TEXT DEFAULT '{}',
                is_enabled INTEGER DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
