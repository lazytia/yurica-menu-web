'use client';
import { useEffect, useRef, useState, useMemo } from 'react';

const CACHE_KEY = 'orders_main_v1';
const STATUS_FLOW = ['ordered','confirmed','cooking','delivering','delivered'];
const STATUS_LABEL = {
  ordered: '주문접수',
  confirmed: '주문확인',
  cooking: '조리중',
  delivering: '배달중',
  delivered: '배달완료',
};

function uniqueKey(e) { return e.id || `${e.ts}-${e.type}-${e.orderId ?? ''}`; }
const ymd = (t)=> new Date(t).toISOString().slice(0,10);
const hm  = (t)=> new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export default function OrdersFeed() {
  const [endpoint, setEndpoint] = useState('http://localhost:4000');
  const [connected, setConnected] = useState(false);
  const [orders, setOrders] = useState([]);         // delivered 제외
  const esRef = useRef(null);
  const retryRef = useRef(2000);

  // 초기: 캐시 → 서버(active) → SSE
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Array.isArray(cached)) setOrders(cached);
      }
    } catch {}
    // 서버에서 활성 주문만
    loadActive();
    connect();
    return () => { if (esRef.current) esRef.current.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadActive() {
    try {
      const url = `${endpoint.replace(/\/+$/,'')}/api/orders?active=true`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data)) {
        setOrders(data);
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      }
    } catch {}
  }

  function connect() {
    if (esRef.current) { try { esRef.current.close(); } catch {} esRef.current = null; }
    setConnected(false);
    const url = `${endpoint.replace(/\/+$/,'')}/api/events/stream`;
    const es = new EventSource(url);

    es.onopen = () => { setConnected(true); retryRef.current = 2000; };
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        setOrders(prev => {
          // 신규 주문
          if (msg.type === 'order') {
            const status = msg.status || 'ordered';
            if (status === 'delivered') return prev; // delivered는 메인에 표시 안 함
            const map = new Map(prev.map(x=>[uniqueKey(x), x]));
            map.set(uniqueKey(msg), msg);
            const arr = Array.from(map.values()).sort((a,b)=> (b.ts??0)-(a.ts??0));
            localStorage.setItem(CACHE_KEY, JSON.stringify(arr));
            return arr;
          }
          // 상태 업데이트
          if (msg.type === 'order_status' && msg.id) {
            const arr = prev.map(x => x.id === msg.id ? { ...x, status: msg.status } : x);
            const filtered = arr.filter(x => (x.status || 'ordered') !== 'delivered');
            localStorage.setItem(CACHE_KEY, JSON.stringify(filtered));
            return filtered;
          }
          return prev;
        });
      } catch {}
    };
    es.onerror = () => {
      setConnected(false);
      const delay = Math.min(retryRef.current, 30000);
      setTimeout(() => connect(), delay);
      retryRef.current = Math.min(delay * 2, 30000);
    };
    esRef.current = es;
  }

  async function setStatus(id, status) {
    try {
      const res = await fetch(`${endpoint.replace(/\/+$/,'')}/api/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // 즉시 UI 반영 (SSE로도 곧 들어옴)
      setOrders(prev => {
        const arr = prev.map(x => x.id === id ? ({ ...x, status }) : x);
        const filtered = arr.filter(x => (x.status || 'ordered') !== 'delivered');
        localStorage.setItem(CACHE_KEY, JSON.stringify(filtered));
        return filtered;
      });
    } catch (e) {
      alert(`상태 변경 실패: ${e.message}`);
    }
  }

  // 날짜별 그룹
  const grouped = useMemo(() => {
    const m = new Map();
    for (const o of orders) {
      const d = ymd(o.ts || Date.now());
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(o);
    }
    for (const [d, arr] of m) m.set(d, arr.sort((a,b)=> (b.ts??0)-(a.ts??0)));
    return Array.from(m.entries()).sort((a,b)=> a[0]<b[0]?1:-1); // 최신 날짜 먼저
  }, [orders]);

  return (
    <div style={{ maxWidth: 1100, margin: '24px auto', padding: 16 }}>
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:12 }}>
        <label style={{ flex: 1 }}>
          <div style={{ fontSize:12, color:'#666' }}>API Endpoint</div>
          <input value={endpoint} onChange={e=>setEndpoint(e.target.value)}
                 style={{ width:'100%', padding:'8px 10px', border:'1px solid #ddd', borderRadius:8 }}/>
        </label>
        <button onClick={()=>{ connect(); loadActive(); }} style={{ padding:'8px 12px', borderRadius:8 }}>
          {connected ? '재연결' : '연결'}
        </button>
        <span style={{ fontSize:12, color: connected ? 'green' : '#b00' }}>
          {connected ? '● 연결됨' : '○ 끊김'}
        </span>
      </div>

      {grouped.length === 0 && (
        <div style={{ border:'1px solid #eee', borderRadius:12, padding:16, textAlign:'center', color:'#666' }}>
          아직 주문이 없습니다.
        </div>
      )}

      {grouped.map(([date, arr]) => (
        <section key={date} style={{ marginBottom: 18 }}>
          <h3 style={{ margin:'10px 0' }}>{date}</h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, maxWidth:1100 }}>
            {arr.map(o => (
              <article key={o.id} style={{ border:'1px solid #eee', borderRadius:12, padding:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ fontSize:12, padding:'2px 8px', borderRadius:999, border:'1px solid #eee',
                                   background:'#fff2e5', color:'#a05a00' }}>
                      주문
                    </span>
                    <b>{hm(o.ts || Date.now())}</b>
                  </div>
                  <span style={{ fontSize:12, color:'#666' }}>{o.deviceId || ''}</span>
                </div>

                <div style={{ display:'grid', gap:4, marginBottom:10, lineHeight:1.5 }}>
                  {o.companyName && <div><b>회사:</b> {o.companyName}</div>}
                  {o.customerName && <div><b>고객:</b> {o.customerName}</div>}
                  {o.items && o.items.length>0 && <div><b>메뉴:</b> {o.items.join(', ')}</div>}
                  {o.table && <div><b>테이블:</b> {o.table}</div>}
                  {o.note && <div><b>요청:</b> {o.note}</div>}
                  <div><b>상태:</b> {STATUS_LABEL[o.status || 'ordered']}</div>
                </div>

                {/* 상태 버튼 */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {['confirmed','cooking','delivering','delivered'].map(s => (
                    <button key={s}
                      onClick={()=>setStatus(o.id, s)}
                      style={{
                        padding:'6px 10px', borderRadius:8, border:'1px solid #ddd',
                        background: (o.status===s) ? '#111' : '#f8f8f8',
                        color: (o.status===s) ? '#fff' : '#111',
                        cursor:'pointer'
                      }}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
