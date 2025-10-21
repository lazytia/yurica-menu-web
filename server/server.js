import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { v4 as uuid } from 'uuid';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const app = express();
app.use(cors());
app.use(express.json());

// 업로드 디렉토리 준비
const UPLOAD_DIR = path.resolve('./uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// 정적 서빙 (http://localhost:4000/uploads/파일명)
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d', etag: true }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = path.basename(file.originalname || 'image', ext).replace(/[^\w\-]+/g, '_');
    cb(null, `${Date.now()}_${base}${ext || '.jpg'}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const ok = /image\/(png|jpe?g|webp|gif)/i.test(file.mimetype);
    cb(ok ? null : new Error('이미지 파일만 업로드 가능합니다.'));
  }
});

// 업로드 엔드포인트
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    const filename = req.file?.filename;
    if (!filename) return res.status(400).json({ error: 'upload_failed' });
    const url = `/uploads/${filename}`;
    res.json({ ok: true, url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'upload_error' });
  }
});


// ── middleware
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.options('/api/*', cors());


// ── DB: schema init
const dbPromise = (async () => {
  const db = await open({ filename: './yurica.db', driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price_cents INTEGER,
      created_at TEXT
    );
    /* ... 기존 events 테이블 생성 및 인덱스 ... */
  `);

  // 🔧 menu_items 컬럼 보강
  async function ensureMenuCol(name, type = 'TEXT') {
    const cols = await db.all(`PRAGMA table_info('menu_items')`);
    if (!cols.some(c => c.name === name)) {
      await db.exec(`ALTER TABLE menu_items ADD COLUMN ${name} ${type};`);
    }
  }
  await ensureMenuCol('image_url', 'TEXT');   // 메뉴 사진
  await ensureMenuCol('allergies', 'TEXT');   // 알러지(콤마 구분 문자열)
  await ensureMenuCol('currency', 'TEXT');    // 통화 (기본 AUD)
  await ensureMenuCol('category', 'TEXT');    // 카테고리

  return db;
})();




// ── basic routes
app.get('/', (_req, res) => {
  res.send('Yurica API 서버입니다. 관리자 UI는 http://localhost:3000 에서 확인하세요.');
});
app.get('/health', (_req, res) => res.json({ ok: true }));

// ── menu API
app.get('/api/menu', async (_req, res) => {
  try {
    const db = await dbPromise;
    const rows = await db.all('SELECT * FROM menu_items');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'db_read_failed' });
  }
});

app.post('/api/menu', async (req, res) => {
  try {
    const {
      name,
      price_cents = 0,
      description = '',
      allergies = '',
      image_url = '',
      currency = 'AUD',     // ← 기본 AUD
      category = ''         // ← 카테고리
    } = req.body || {};

    if (!name) return res.status(400).json({ error: 'name_required' });

    const db = await dbPromise;
    const id = uuid();
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO menu_items (id, name, description, price_cents, created_at, image_url, allergies, currency, category)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, name, description, Number(price_cents) || 0, now, image_url, allergies, currency, category]
    );

    res.json({
      id, name, description,
      price_cents: Number(price_cents) || 0,
      image_url, allergies, currency, category
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'db_write_failed' });
  }
});



app.delete('/api/menu/:id', async (req, res) => {
  try {
    const db = await dbPromise;
    await db.run('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'db_delete_failed' });
  }
});

// ── events history (latest first)
app.get('/api/events', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const db = await dbPromise;
    const rows = await db.all(
      `SELECT id,
              ts,
              type,
              message,
              device_id as deviceId,
              order_id as orderId,
              table_no as "table",
              items_json as itemsJson,
              note
       FROM events
       ORDER BY ts DESC
       LIMIT ?`,
      [limit]
    );
    const parsed = rows.map(r => ({
      ...r,
      items: r.itemsJson ? JSON.parse(r.itemsJson) : undefined,
    }));
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json(parsed);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'events_history_failed' });
  }
});

// ── SSE (app → web)
const sseClients = new Set();

app.get('/api/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  sseClients.add(res);
  res.write(`event: ping\ndata: "connected"\n\n`);

  const hb = setInterval(() => {
    try { res.write(`event: ping\ndata: ${Date.now()}\n\n`); } catch {}
  }, 15000);

  const cleanup = () => {
    clearInterval(hb);
    sseClients.delete(res);
    try { res.end(); } catch {}
  };
  req.on('close', cleanup);
  req.on('end', cleanup);
  res.on?.('error', cleanup);
});

function broadcastEvent(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try { client.write(data); } catch {}
  }
}

app.post('/api/events', async (req, res) => {
  try {
    const {
      type = 'tap',
      message = 'button pressed',
      deviceId = 'ios',
      orderId = null,
      table: tableNo = null,
      items = null,          // ['Salmon','Udon']
      note = null,
      companyName = null,
      customerName = null,
      status = null,         // 주문이면 기본 'ordered'
      total_cents = null,    // 선택: 직접 합계 전달 가능
      ts: tsClient = null
    } = req.body || {};

    const ts = Number(tsClient) || Date.now();
    const id = uuid();
    const createdAt = new Date().toISOString();
    const finalStatus = type === 'order' ? (status || 'ordered') : status;

    // 합계 계산
    let computedTotal = Number.isFinite(Number(total_cents)) ? Number(total_cents) : 0;
    if (type === 'order' && !Number.isFinite(Number(total_cents)) && Array.isArray(items) && items.length > 0) {
      const db = await dbPromise;
      const qMarks = items.map(() => '?').join(',');
      const rows = await db.all(`SELECT name, price_cents FROM menu_items WHERE name IN (${qMarks})`, items);
      const priceMap = new Map(rows.map(r => [r.name, Number(r.price_cents) || 0]));
      computedTotal = items.reduce((sum, nm) => sum + (priceMap.get(nm) || 0), 0);
    }

    const db = await dbPromise;
    await db.run(
      `INSERT INTO events (
         id, ts, type, message, device_id, order_id, table_no, items_json, note, created_at,
         company_name, customer_name, status, total_cents
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, ts, String(type), String(message),
        String(deviceId), orderId ? String(orderId) : null,
        tableNo ? String(tableNo) : null,
        items ? JSON.stringify(items) : null,
        note ? String(note) : null,
        createdAt,
        companyName ? String(companyName) : null,
        customerName ? String(customerName) : null,
        finalStatus ? String(finalStatus) : null,
        computedTotal
      ]
    );

    const payload = {
      id, ts, type, message, deviceId,
      orderId, table: tableNo, items, note,
      companyName, customerName, status: finalStatus,
      total_cents: computedTotal
    };

    broadcastEvent(payload);
    res.json({ ok: true, received: payload });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'event_failed' });
  }
});



// ── 주문 목록 (active=true 이면 'delivered' 제외)
app.get('/api/orders', async (req, res) => {
  try {
    const active = String(req.query.active || 'false') === 'true';
    const db = await dbPromise;
    const rows = await db.all(
      `SELECT id, ts, type, message, device_id as deviceId,
              order_id as orderId, table_no as "table",
              items_json as itemsJson, note,
              company_name as companyName, customer_name as customerName,
              status
       FROM events
       WHERE type = 'order' ${active ? `AND IFNULL(status,'ordered') <> 'delivered'` : ''}
       ORDER BY ts DESC`
    );
    const data = rows.map(r => ({ ...r, items: r.itemsJson ? JSON.parse(r.itemsJson) : undefined }));
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json(data);
  } catch (e) { console.error(e); res.status(500).json({ error: 'orders_list_failed' }); }
});

// ── 주문 상태 변경
app.patch('/api/orders/:id/status', async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body || {};
    const allowed = ['confirmed','cooking','delivering','delivered'];
    if (!allowed.includes(String(status))) return res.status(400).json({ error: 'invalid_status' });

    const db = await dbPromise;
    await db.run(`UPDATE events SET status = ? WHERE id = ?`, [status, id]);

    const payload = { id, type: 'order_status', status, ts: Date.now() };
    broadcastEvent(payload);  // 실시간 반영
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'order_status_failed' }); }
});

// 메뉴 수정(PATCH) : 전달된 필드만 업데이트
app.patch('/api/menu/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const {
      name, description, price_cents, currency,
      allergies, image_url, category
    } = req.body || {};

    const db = await dbPromise;

    // 동적 업데이트 쿼리 구성
    const sets = [];
    const params = [];
    const push = (col, val) => { sets.push(`${col} = ?`); params.push(val); };

    if (typeof name === 'string') push('name', name);
    if (typeof description === 'string') push('description', description);
    if (Number.isFinite(Number(price_cents))) push('price_cents', Number(price_cents));
    if (typeof currency === 'string') push('currency', currency);
    if (typeof allergies === 'string') push('allergies', allergies);
    if (typeof image_url === 'string') push('image_url', image_url);
    if (typeof category === 'string') push('category', category);

    if (sets.length === 0) return res.status(400).json({ error: 'no_fields' });

    params.push(id);
    await db.run(`UPDATE menu_items SET ${sets.join(', ')} WHERE id = ?`, params);

    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'db_update_failed' });
  }
});

// ── 주문 통계 (최근 7일)
app.get('/api/orders/stats', async (_req, res) => {
  try {
    const db = await dbPromise;
    const since = Date.now() - 7*24*3600*1000;
    const rows = await db.all(
      `SELECT id, ts, status, company_name as companyName
       FROM events
       WHERE type='order' AND ts >= ?`, [since]
    );

    // status 카운트
    const byStatus = rows.reduce((m, r) => {
      const k = r.status || 'ordered'; m[k] = (m[k]||0)+1; return m;
    }, {});

    // 일자별 카운트
    const toYmd = (t)=> new Date(t).toISOString().slice(0,10);
    const byDay = rows.reduce((m, r) => {
      const d = toYmd(r.ts); m[d] = (m[d]||0)+1; return m;
    }, {});

    // 회사별 카운트
    const byCompany = rows.reduce((m, r) => {
      const c = r.companyName || 'Unknown'; m[c] = (m[c]||0)+1; return m;
    }, {});

    res.json({ byStatus, byDay, byCompany });
  } catch (e) { console.error(e); res.status(500).json({ error: 'orders_stats_failed' }); }
});

// 유틸: 기간으로 주문 조회 (type='order')
async function getOrdersInRange(db, fromMs, toMs) {
  const rows = await db.all(
    `SELECT id, ts, items_json as itemsJson, total_cents, company_name as companyName, customer_name as customerName, status
     FROM events
     WHERE type='order' AND ts >= ? AND ts < ?`,
    [fromMs, toMs]
  );
  return rows.map(r => ({
    ...r,
    items: r.itemsJson ? JSON.parse(r.itemsJson) : []
  }));
}

// ① 임의 기간 매출/베스트셀러
app.get('/api/orders/sales', async (req, res) => {
  try {
    const db = await dbPromise;
    const now = Date.now();
    const from = Number(req.query.from) || (now - 7*24*3600*1000);
    const to   = Number(req.query.to)   || now;

    const orders = await getOrdersInRange(db, from, to);
    const total = orders.reduce((s, o)=> s + (Number(o.total_cents)||0), 0);

    const byItem = {};
    for (const o of orders) {
      for (const nm of (o.items||[])) {
        if (!byItem[nm]) byItem[nm] = { count:0, total_cents:0 };
        byItem[nm].count += 1;
        byItem[nm].total_cents += Number(o.total_cents)||0; // 단순 분배가 아니라 주문 합계 더하기(간단화)
      }
    }

    // 일별 총액
    const dayKey = t => new Date(t).toISOString().slice(0,10);
    const byDayMap = new Map();
    for (const o of orders) {
      const d = dayKey(o.ts);
      byDayMap.set(d, (byDayMap.get(d)||0) + (Number(o.total_cents)||0));
    }
    const daily = Array.from(byDayMap.entries()).map(([date, total_cents])=>({date, total_cents}));

    res.json({ from, to, orders_count: orders.length, total_cents: total, byItem, daily });
  } catch (e) { console.error(e); res.status(500).json({ error: 'sales_failed' }); }
});

// ② 요약(오늘/1주/1달/3달/6달/1년)
app.get('/api/orders/sales/summary', async (_req, res) => {
  try {
    const db = await dbPromise;
    const now = Date.now();
    const DAY = 24*3600*1000;

    const ranges = {
      today:   [new Date().setHours(0,0,0,0), new Date().setHours(24,0,0,0)],
      d7:      [now - 7*DAY, now],
      d30:     [now - 30*DAY, now],
      d90:     [now - 90*DAY, now],
      d180:    [now - 180*DAY, now],
      d365:    [now - 365*DAY, now],
    };

    const out = {};
    for (const [k,[from,to]] of Object.entries(ranges)) {
      const orders = await getOrdersInRange(db, from, to);
      const total = orders.reduce((s, o)=> s + (Number(o.total_cents)||0), 0);
      // Top items (상위 5)
      const counter = {};
      for (const o of orders) (o.items||[]).forEach(nm => { counter[nm]=(counter[nm]||0)+1; });
      const topItems = Object.entries(counter)
        .sort((a,b)=> b[1]-a[1]).slice(0,5)
        .map(([name,count])=>({ name, count }));
      out[k] = { from, to, orders_count: orders.length, total_cents: total, topItems };
    }
    res.json(out);
  } catch (e) { console.error(e); res.status(500).json({ error: 'sales_summary_failed' }); }
});



// ── start
app.listen(4000, () => console.log('Server running on http://localhost:4000'));
