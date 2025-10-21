'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

// 수정 모달 (CSR 전용)
const MenuEditModal = dynamic(() => import('./MenuEditModal'), { ssr: false });

const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });

export default function MenuTable() {
  const [endpoint, setEndpoint] = useState('http://localhost:4000');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [msg, setMsg] = useState('');
  const [editing, setEditing] = useState(null); // 수정 중 메뉴

  // 메뉴 불러오기
  async function load() {
    try {
      setLoading(true);
      const res = await fetch(`${endpoint.replace(/\/+$/, '')}/api/menu`, { cache: 'no-store' });
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setMsg(`❌ 불러오기 실패: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // 삭제
  async function remove(id) {
    if (!confirm('정말 삭제할까요? 삭제 후 되돌릴 수 없습니다.')) return;
    try {
      const res = await fetch(`${endpoint.replace(/\/+$/, '')}/api/menu/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setItems(prev => prev.filter(x => x.id !== id));
      setMsg('🗑️ 삭제했습니다.');
      setTimeout(() => setMsg(''), 1500);
    } catch (e) {
      setMsg(`❌ 삭제 실패: ${e.message || e}`);
    }
  }

  // 카테고리 필터 목록
  const categories = useMemo(() => {
    const s = new Set();
    items.forEach(i => { if (i.category) s.add(i.category); });
    return ['전체', ...Array.from(s)];
  }, [items]);

  // 검색 + 필터링
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return items.filter(i => {
      const okQ = !qq || (i.name?.toLowerCase().includes(qq) || i.category?.toLowerCase().includes(qq));
      const okCat = !cat || cat === '전체' || i.category === cat;
      return okQ && okCat;
    });
  }, [items, q, cat]);

  const resolveImg = (u) => (!u ? '' : u.startsWith('http') ? u : `${endpoint.replace(/\/+$/, '')}${u}`);

  return (
    <section style={{ marginTop: 20 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>메뉴 목록</h3>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={endpoint}
            onChange={e => setEndpoint(e.target.value)}
            title="API"
            style={{ width: 260, padding: '6px 10px', border: '1px solid #ddd', borderRadius: 8 }}
          />
          <button onClick={load} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd' }}>
            새로고침
          </button>
        </div>
      </div>

      {/* 검색/필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input
          placeholder="이름/카테고리 검색"
          value={q}
          onChange={e => setQ(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8, minWidth: 200 }}
        />
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #ddd', borderRadius: 8 }}>
          {categories.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {msg && <span style={{ color: msg.startsWith('❌') ? '#b00' : 'green' }}>{msg}</span>}
      </div>

      {/* 테이블 */}
      <div style={{ border: '1px solid #eee', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#fafafa' }}>
            <tr>
              <th style={th}>사진</th>
              <th style={th}>이름</th>
              <th style={th}>카테고리</th>
              <th style={{ ...th, textAlign: 'right' }}>가격(AUS)</th>
              <th style={th}>알러지</th>
              <th style={{ ...th, width: 160 }}>작업</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={tdCenter}>불러오는 중…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={tdCenter}>데이터 없음</td></tr>
            ) : (
              filtered.map(i => (
                <tr key={i.id}>
                  <td style={td}>
                    {i.image_url ? (
                      <img src={resolveImg(i.image_url)} alt={i.name} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }} />
                    ) : (
                      <div style={{ width: 56, height: 56, border: '1px solid #eee', borderRadius: 8, background: '#fafafa' }} />
                    )}
                  </td>
                  <td style={td}>{i.name}</td>
                  <td style={td}>{i.category || '-'}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{AUD.format((i.price_cents || 0) / 100)}</td>
                  <td style={td}>{i.allergies || '-'}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button onClick={() => setEditing(i)} style={btnEdit}>수정</button>
                      <button onClick={() => remove(i.id)} style={btnDanger}>삭제</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 수정 모달 */}
      <MenuEditModal
        open={!!editing}
        onClose={() => setEditing(null)}
        item={editing}
        endpoint={endpoint}
        onSaved={load}
      />
    </section>
  );
}

// 스타일
const th = { textAlign: 'left', padding: 10, borderBottom: '1px solid #eee', fontWeight: 600, fontSize: 13 };
const td = { padding: 10, borderBottom: '1px solid #f2f2f2', fontSize: 14, verticalAlign: 'middle' };
const tdCenter = { ...td, textAlign: 'center', color: '#666' };

const btnEdit = {
  padding: '6px 10px',
  border: '1px solid #111',
  background: '#fff',
  color: '#111',
  borderRadius: 8,
  cursor: 'pointer'
};

const btnDanger = {
  padding: '6px 10px',
  border: '1px solid #b00',
  background: '#fff',
  color: '#b00',
  borderRadius: 8,
  cursor: 'pointer'
};
