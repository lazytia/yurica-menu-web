'use client';
import { useEffect, useRef, useState } from 'react';

export default function EventsPanel() {
  const [endpoint, setEndpoint] = useState('http://localhost:4000');
  const [logs, setLogs] = useState([]);
  const esRef = useRef(null);

  const connect = () => {
    // 기존 연결 닫기
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    const url = `${endpoint.replace(/\/+$/,'')}/api/events/stream`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setLogs(prev => [{ ...data }, ...prev].slice(0, 200)); // 최근 200개만
      } catch {}
    };
    es.onerror = () => {
      // 자동 재연결은 브라우저가 처리. 일단 표시만.
      // console.warn('SSE error');
    };
    esRef.current = es;
  };

  useEffect(() => {
    connect();
    return () => { if (esRef.current) esRef.current.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: '24px auto', padding: 16, border: '1px solid #ddd', borderRadius: 12 }}>
      <h2>실시간 이벤트 (App → Web)</h2>
      <label>API Endpoint
        <input value={endpoint} onChange={e=>setEndpoint(e.target.value)} style={{ width:'100%' }} />
      </label>
      <div style={{ marginTop: 8 }}>
        <button onClick={connect}>연결/재연결</button>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, marginTop: 12 }}>
        {logs.map((l, i) => (
          <li key={i} style={{ border:'1px solid #eee', borderRadius: 10, padding: 10, marginBottom: 8 }}>
            <div><b>{new Date(l.ts).toLocaleString()}</b></div>
            <div>type: {l.type}</div>
            <div>device: {l.deviceId}</div>
            <div>msg: {l.message}</div>
          </li>
        ))}
      </ul>

      {logs.length === 0 && <p>아직 이벤트가 없습니다. 앱에서 버튼을 눌러보세요.</p>}
    </div>
  );
}
