"""SQLite database layer — replaces the JSON inventory file."""
import sqlite3, json, os, hashlib, secrets
from datetime import datetime

DB_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'inventory')
DB_PATH = os.path.join(DB_DIR, 'market.db')


def get_db():
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS products (
            market_id          TEXT PRIMARY KEY,
            name               TEXT NOT NULL,
            short_description  TEXT DEFAULT '',
            description        TEXT DEFAULT '',
            category           TEXT DEFAULT '',
            price              REAL DEFAULT 0,
            currency           TEXT DEFAULT 'USD',
            billing            TEXT DEFAULT 'monthly',
            seller             TEXT DEFAULT '',
            seller_avatar      TEXT DEFAULT '',
            seller_verified    INTEGER DEFAULT 0,
            rating             REAL DEFAULT 0,
            review_count       INTEGER DEFAULT 0,
            downloads          INTEGER DEFAULT 0,
            parameters         TEXT DEFAULT 'N/A',
            accuracy           TEXT DEFAULT 'N/A',
            api_calls          INTEGER DEFAULT 10000,
            response_time      TEXT DEFAULT 'N/A',
            tags               TEXT DEFAULT '[]',
            license_type       TEXT DEFAULT 'Commercial',
            featured           INTEGER DEFAULT 0,
            gradient           TEXT DEFAULT 'linear-gradient(135deg,#667eea,#764ba2)',
            created_at         TEXT,
            specs              TEXT DEFAULT '{}',
            source             TEXT DEFAULT 'manual',
            source_url         TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS reviews (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id  TEXT NOT NULL REFERENCES products(market_id),
            author      TEXT DEFAULT 'Anonymous',
            initials    TEXT DEFAULT 'AN',
            rating      REAL DEFAULT 5,
            review_text TEXT DEFAULT '',
            created_at  TEXT
        );

        CREATE TABLE IF NOT EXISTS global_stats (
            key   TEXT PRIMARY KEY,
            value INTEGER DEFAULT 0
        );

        INSERT OR IGNORE INTO global_stats (key, value) VALUES ('total_sellers',      4800);
        INSERT OR IGNORE INTO global_stats (key, value) VALUES ('total_buyers',     124700);
        INSERT OR IGNORE INTO global_stats (key, value) VALUES ('total_transactions',389200);

        CREATE TABLE IF NOT EXISTS api_keys (
            key_id        TEXT PRIMARY KEY,
            product_id    TEXT NOT NULL,
            user_email    TEXT NOT NULL,
            access_type   TEXT DEFAULT 'rent',  -- 'rent' | 'purchase'
            rent_period   TEXT,                 -- '24h' | '7d' | '30d' | NULL
            calls_used    INTEGER DEFAULT 0,
            calls_limit   INTEGER DEFAULT 100,  -- -1 = unlimited
            created_at    TEXT,
            expires_at    TEXT,                 -- NULL = never expires
            is_active     INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS api_call_log (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            key_id        TEXT NOT NULL,
            product_id    TEXT,
            input_preview TEXT,
            output_tokens INTEGER DEFAULT 0,
            latency_ms    INTEGER DEFAULT 0,
            ollama_model  TEXT,
            success       INTEGER DEFAULT 1,
            created_at    TEXT
        );

        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT NOT NULL,
            email         TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            account_type  TEXT DEFAULT 'buyer',
            avatar        TEXT DEFAULT '',
            joined_at     TEXT,
            last_login    TEXT
        );
    """)
    conn.commit()
    conn.close()


# ── Password hashing (pbkdf2 — no external deps) ───────────────────────────────
def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key  = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 260000)
    return f"{salt}:{key.hex()}"


def _verify_password(stored: str, provided: str) -> bool:
    try:
        salt, key_hex = stored.split(':', 1)
        key = hashlib.pbkdf2_hmac('sha256', provided.encode(), salt.encode(), 260000)
        return secrets.compare_digest(key.hex(), key_hex)
    except Exception:
        return False


# ── User CRUD ──────────────────────────────────────────────────────────────────
def create_user(name: str, email: str, password: str, account_type: str = 'buyer'):
    """Returns user dict on success, None if email already exists."""
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO users (name, email, password_hash, account_type, avatar, joined_at) "
            "VALUES (?,?,?,?,?,?)",
            (name.strip(), email.strip().lower(),
             _hash_password(password), account_type,
             name.strip()[:2].upper(),
             datetime.now().isoformat())
        )
        conn.commit()
        row = conn.execute("SELECT * FROM users WHERE email=?", (email.lower(),)).fetchone()
        return _safe_user(dict(row))
    except sqlite3.IntegrityError:
        return None   # duplicate email
    finally:
        conn.close()


def get_user_by_email(email: str):
    conn = get_db()
    row  = conn.execute("SELECT * FROM users WHERE email=?", (email.lower(),)).fetchone()
    conn.close()
    return dict(row) if row else None


def login_user(email: str, password: str):
    """Returns public user dict on success, None on bad credentials."""
    user = get_user_by_email(email)
    if not user or not _verify_password(user['password_hash'], password):
        return None
    conn = get_db()
    conn.execute("UPDATE users SET last_login=? WHERE id=?",
                 (datetime.now().isoformat(), user['id']))
    conn.commit()
    conn.close()
    return _safe_user(user)


def get_all_users():
    conn = get_db()
    rows = conn.execute("SELECT * FROM users ORDER BY joined_at DESC").fetchall()
    conn.close()
    return [_safe_user(dict(r)) for r in rows]


def _safe_user(u: dict) -> dict:
    """Strip password_hash before sending to the client."""
    return {k: v for k, v in u.items() if k != 'password_hash'}


# ── API Key management ──────────────────────────────────────────────────────────
def create_api_key(product_id: str, user_email: str, access_type: str, rent_period: str = None) -> str:
    from datetime import datetime, timedelta
    key_id = 'swm_live_' + secrets.token_urlsafe(32)

    RENT_CONFIG = {
        '24h': (timedelta(hours=24),    100,   ),
        '7d':  (timedelta(days=7),     1_000,  ),
        '30d': (timedelta(days=30),   10_000,  ),
    }

    expires_at  = None
    calls_limit = -1  # unlimited for purchase

    if access_type == 'rent' and rent_period in RENT_CONFIG:
        delta, calls_limit = RENT_CONFIG[rent_period]
        expires_at = (datetime.now() + delta).isoformat()

    conn = get_db()
    conn.execute("""
        INSERT INTO api_keys (key_id, product_id, user_email, access_type, rent_period,
                              calls_limit, created_at, expires_at)
        VALUES (?,?,?,?,?,?,?,?)
    """, (key_id, product_id, user_email, access_type, rent_period,
          calls_limit, datetime.now().isoformat(), expires_at))
    conn.commit()
    conn.close()
    return key_id


def validate_api_key(key_id: str, product_id: str = None):
    """Returns key record if valid, None if invalid/expired/exhausted."""
    from datetime import datetime
    conn = get_db()
    row = conn.execute("SELECT * FROM api_keys WHERE key_id=? AND is_active=1", (key_id,)).fetchone()
    conn.close()
    if not row:
        return None
    rec = dict(row)
    # Check product match
    if product_id and rec['product_id'] != product_id:
        return None
    # Check expiry
    if rec['expires_at'] and datetime.now().isoformat() > rec['expires_at']:
        return None
    # Check call limit
    if rec['calls_limit'] >= 0 and rec['calls_used'] >= rec['calls_limit']:
        return None
    return rec


def increment_key_usage(key_id: str):
    conn = get_db()
    conn.execute("UPDATE api_keys SET calls_used = calls_used + 1 WHERE key_id=?", (key_id,))
    conn.commit()
    conn.close()


def log_api_call(key_id: str, product_id: str, input_preview: str,
                 output_tokens: int, latency_ms: int, ollama_model: str, success: bool = True):
    from datetime import datetime
    conn = get_db()
    conn.execute("""
        INSERT INTO api_call_log (key_id, product_id, input_preview, output_tokens,
                                  latency_ms, ollama_model, success, created_at)
        VALUES (?,?,?,?,?,?,?,?)
    """, (key_id, product_id, input_preview[:200], output_tokens,
          latency_ms, ollama_model, int(success), datetime.now().isoformat()))
    conn.commit()
    conn.close()


def get_key_usage(key_id: str):
    conn = get_db()
    key  = conn.execute("SELECT * FROM api_keys WHERE key_id=?", (key_id,)).fetchone()
    logs = conn.execute(
        "SELECT * FROM api_call_log WHERE key_id=? ORDER BY created_at DESC LIMIT 20", (key_id,)
    ).fetchall()
    conn.close()
    return {
        'key': dict(key) if key else None,
        'recent_calls': [dict(r) for r in logs],
    }


def get_keys_for_product(product_id: str):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM api_keys WHERE product_id=? ORDER BY created_at DESC", (product_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def _parse(row):
    if row is None:
        return None
    d = dict(row)
    for field in ('tags', 'specs'):
        raw = d.get(field)
        if isinstance(raw, str):
            try:
                d[field] = json.loads(raw)
            except Exception:
                d[field] = [] if field == 'tags' else {}
        elif raw is None:
            d[field] = [] if field == 'tags' else {}
    d['seller_verified']   = bool(d.get('seller_verified', 0))
    d['featured']          = bool(d.get('featured', 0))
    d['license']           = d.get('license_type', 'Commercial')
    d['api_calls_per_month'] = d.get('api_calls', 10000)
    return d


def get_all_products():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM products ORDER BY featured DESC, rating DESC, downloads DESC"
    ).fetchall()
    conn.close()
    return [_parse(r) for r in rows]


def get_product(market_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM products WHERE market_id=?", (market_id,)).fetchone()
    conn.close()
    return _parse(row)


def search_products(query='', category='all', min_price=None, max_price=None, min_rating=None):
    conn = get_db()
    sql, params = "SELECT * FROM products WHERE 1=1", []
    if category and category != 'all':
        sql += " AND LOWER(category)=LOWER(?)"
        params.append(category)
    if min_price is not None:
        sql += " AND price>=?"
        params.append(min_price)
    if max_price is not None:
        sql += " AND price<=?"
        params.append(max_price)
    if min_rating is not None:
        sql += " AND rating>=?"
        params.append(min_rating)
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    products = [_parse(r) for r in rows]

    if not query:
        products.sort(key=lambda p: (p['featured'], p['rating']), reverse=True)
        return products

    terms = query.lower().split()

    def score(p):
        s = 0
        name   = p.get('name','').lower()
        desc   = (p.get('description','') + ' ' + p.get('short_description','')).lower()
        tags   = ' '.join(p.get('tags',[])).lower()
        cat    = p.get('category','').lower()
        seller = p.get('seller','').lower()
        for t in terms:
            if t in name:   s += 10
            if t in tags:   s += 6
            if t in cat:    s += 5
            if t in desc:   s += 2
            if t in seller: s += 1
        return s

    results = [(score(p), p) for p in products if score(p) > 0]
    results.sort(reverse=True)
    return [p for _, p in results]


def insert_product(p):
    conn = get_db()
    conn.execute("""
        INSERT OR REPLACE INTO products
          (market_id,name,short_description,description,category,price,currency,billing,
           seller,seller_avatar,seller_verified,rating,review_count,downloads,
           parameters,accuracy,api_calls,response_time,tags,license_type,featured,
           gradient,created_at,specs,source,source_url)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        p['market_id'], p.get('name',''), p.get('short_description',''),
        p.get('description',''), p.get('category',''), float(p.get('price',0)),
        p.get('currency','USD'), p.get('billing','monthly'),
        p.get('seller',''), p.get('seller_avatar',''),
        int(bool(p.get('seller_verified',False))),
        float(p.get('rating',0)), int(p.get('review_count',0)), int(p.get('downloads',0)),
        p.get('parameters','N/A'), p.get('accuracy','N/A'),
        int(p.get('api_calls_per_month', p.get('api_calls',10000))),
        p.get('response_time','N/A'),
        json.dumps(p.get('tags',[])),
        p.get('license', p.get('license_type','Commercial')),
        int(bool(p.get('featured',False))),
        p.get('gradient','linear-gradient(135deg,#667eea 0%,#764ba2 100%)'),
        p.get('created_at', datetime.now().isoformat()),
        json.dumps(p.get('specs',{})),
        p.get('source','manual'), p.get('source_url',''),
    ))
    conn.commit()
    conn.close()


def get_categories():
    conn = get_db()
    rows = conn.execute(
        "SELECT DISTINCT category FROM products WHERE category!='' ORDER BY category"
    ).fetchall()
    conn.close()
    return [r[0] for r in rows]


def get_stats():
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    srows = conn.execute("SELECT key, value FROM global_stats").fetchall()
    conn.close()
    stats = {r[0]: int(r[1]) for r in srows}
    stats['total_models'] = total
    return stats


def get_reviews(product_id, limit=10):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM reviews WHERE product_id=? ORDER BY created_at DESC LIMIT ?",
        (product_id, limit)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_review(product_id, author, rating, text):
    conn = get_db()
    initials = ''.join(w[0] for w in str(author).split()[:2]).upper() or 'AN'
    conn.execute(
        "INSERT INTO reviews (product_id,author,initials,rating,review_text,created_at) VALUES (?,?,?,?,?,?)",
        (product_id, author, initials, float(rating), text, datetime.now().isoformat())
    )
    avg = conn.execute(
        "SELECT AVG(rating), COUNT(*) FROM reviews WHERE product_id=?", (product_id,)
    ).fetchone()
    conn.execute(
        "UPDATE products SET rating=?, review_count=? WHERE market_id=?",
        (round(float(avg[0]), 1), int(avg[1]), product_id)
    )
    conn.commit()
    conn.close()
