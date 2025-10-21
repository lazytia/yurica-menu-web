'use client';
import { useEffect, useMemo, useState } from 'react';

// 통화: 호주달러(AUD)
const AUD = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
const fmtMoney = (cents) => AUD.format((Number(cents) || 0) / 100);
const KR = new Intl.NumberFormat('ko-KR');

function Card({ title, value, sub }) {
  return (
    <div style={{ padding:16, border:'1px solid #eee', borderRadius:12, background:'#fff' }}>
      <div style={{ fontSize:13, color:'#666' }}>{title}</div>
      <div style={{ fontSize:24, fontWeight:700, marginTop:6 }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:'#999', marginTop:4 }}>{sub}</div>}
    </div>
  );
}

function ymdLocal(date) {
  // 로컬 타임존 기준 YYYY-MM-DD
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function dayStartMs(ymd) {
  const [y,m,d] = ymd.split('-').map(Number);
  return new Date(y, m-1, d, 0,0,0,0).getTime();
}
function dayEndMs(ymd) {
  const [y,m,d] = ymd.split('-').map(Number);
  return new Date(y, m-1, d, 23,59,59,999).getTime();
}

export default function AdminStats() {
  const [endpoint, setEndpoint] = useState('http://localhost:4000');

  // 요약(오늘/1주/1달/3/6/1년)
  const [sum, setSum] = useState(null);
  const [loadingSum, setLoadingSum] = useState(false);

  // 커스텀 범위
  const todayStr = ymdLocal(new Date());
  const weekAgoStr = ymdLocal(Date.now() - 6*24*3600*1000);
  const [fromDate, setFromDate] = useState(weekAgoStr);
  const [toDate, setToDate] = useState(todayStr);
  const [range, setRange] = useState(null); // { from,to,total_cents,orders_count,byItem,daily }
  const [loadingRange, setLoadingRange] = useState(false);
  const [msg, setMsg] = useState('');

  async function loadSummary() {
    try {
      setLoadingSum(true);
      const res = await fetch(`${endpoint.replace(/\/+$/,'')}/api/orders/sales/summary`, { cache:'no-store' });
      const json = await res.json();
      setSum(json);
    } catch (e) {
      setMsg(`❌ 요약 불러오기 실패: ${e.message || e}`);
    } finally {
      setLoadingSum(false);
    }
  }

  async function loadRange() {
    // 날짜 유효성
    if (!fromDate || !toDate) {
      setMsg('❌ 날짜를 선택하세요.');
      return;
    }
    const fromMs = dayStartMs(fromDate);
    const toMs = dayEndMs(toDate);
    if (toMs < fromMs) {
      setMsg('❌ 종료일이 시작일보다 빠릅니다.');
      return;
    }
    try {
      setMsg('');
      setLoadingRange(true);
      const url = `${endpoint.replace(/\/+$/,'')}/api/orders/sales?from=${fromMs}&to=${toMs}`;
      const res = await fetch(url, { cache:'no-store' });
      const json = await res.json();
      setRange(json);
    } catch (e) {
      setMsg(`❌ 범위 통계 실패: ${e.message || e}`);
    } finally {
      setLoadingRange(false);
    }
  }

  useEffect(()=>{ loadSummary(); loadRange(); /* 초기 진입 시 */ }, []);

  // 전기간 Top10 (요약 기반)
  const bestItemsOverall = useMemo(() => {
    const counter = new Map();
    if (!sum) return [];
    for (const k of Object.keys(sum)) {
      for (const it of (sum[k].topItems || [])) {
        counter.set(it.name, (counter.get(it.name)||0) + it.count);
      }
    }
    return Array.from(counter.entries()).sort((a,b)=>b[1]-a[1]).slice(0,10);
  }, [sum]);

  // 범위 내 Top10
  const bestItemsInRange = useMemo(() => {
    if (!range?.byItem) return [];
    const entries = Object.entries(range.byItem).map(([name, info]) => [name, info.count || 0]);
    return entries.sort((a,b)=>b[1]-a[1]).slice(0,10);
  }, [range]);

  return (
    <div style={{ maxWidth: 1100, margin:'24px auto', padding:'0 16px' }}>
      {/* 헤더/엔드포인트 */}
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:12, flexWrap:'wrap' }}>
        <h2 style={{ margin:'0 12px 0 0' }}>통계 대시보드</h2>
        <label style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:12, color:'#666' }}>API</span>
          <input
            value={endpoint}
            onChange={e=>setEndpoint(e.target.value)}
            style={{ width:280, padding:'6px 10px', border:'1px solid #ddd', borderRadius:8 }}
          />
        </label>
        <button onClick={loadSummary} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #ddd' }}>
          {loadingSum ? '요약 로딩…' : '요약 새로고침'}
        </button>
      </div>

      {/* 요약 카드 */}
      {!sum ? (
        <div style={{ border:'1px solid #eee', borderRadius:12, padding:16 }}>요약 데이터 없음</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
          <Card title="오늘 매출" value={fmtMoney(sum.today.total_cents)} sub={`${sum.today.orders_count}건`} />
          <Card title="1주 매출" value={fmtMoney(sum.d7.total_cents)} sub={`${sum.d7.orders_count}건`} />
          <Card title="1개월 매출" value={fmtMoney(sum.d30.total_cents)} sub={`${sum.d30.orders_count}건`} />
          <Card title="3개월 매출" value={fmtMoney(sum.d90.total_cents)} sub={`${sum.d90.orders_count}건`} />
          <Card title="6개월 매출" value={fmtMoney(sum.d180.total_cents)} sub={`${sum.d180.orders_count}건`} />
          <Card title="1년 매출" value={fmtMoney(sum.d365.total_cents)} sub={`${sum.d365.orders_count}건`} />
        </div>
      )}

      {/* 범위 선택 */}
      <section style={{ marginTop:22 }}>
        <h3 style={{ margin:'8px 0' }}>기간 지정 통계</h3>

        {/* 프리셋 버튼 */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
          {[
            {label:'오늘', days:0},
            {label:'1주', days:6},
            {label:'1개월', days:29},
            {label:'3개월', days:89},
            {label:'6개월', days:179},
            {label:'1년', days:364},
          ].map(p => (
            <button
              key={p.label}
              onClick={()=>{
                const to = new Date();
                const from = new Date(Date.now() - p.days*24*3600*1000);
                setFromDate(ymdLocal(from));
                setToDate(ymdLocal(to));
              }}
              style={{ padding:'6px 10px', border:'1px solid #ddd', borderRadius:8, background:'#fff' }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* 날짜 입력 + 조회 */}
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:12 }}>
          <label style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:12, color:'#666' }}>시작일</span>
            <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}
                   style={{ padding:'6px 10px', border:'1px solid #ddd', borderRadius:8 }}/>
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:12, color:'#666' }}>종료일</span>
            <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}
                   style={{ padding:'6px 10px', border:'1px solid #ddd', borderRadius:8 }}/>
          </label>
          <button onClick={loadRange} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #111', background:'#111', color:'#fff' }}>
            {loadingRange ? '조회 중…' : '조회'}
          </button>
          {msg && <span style={{ color: msg.startsWith('❌') ? '#b00' : 'green' }}>{msg}</span>}
        </div>

        {/* 범위 결과 카드 */}
        {range ? (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:12 }}>
              <Card title="선택 기간 매출" value={fmtMoney(range.total_cents)} sub={`${range.orders_count}건`} />
              <Card title="시작일" value={ymdLocal(range.from)} />
              <Card title="종료일" value={ymdLocal(range.to)} />
            </div>

            {/* 일자별 매출 (간단 표) */}
            <div style={{ marginTop:16 }}>
              <h4 style={{ margin:'8px 0' }}>일자별 매출</h4>
              <div style={{ border:'1px solid #eee', borderRadius:12, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead style={{ background:'#fafafa' }}>
                    <tr>
                      <th style={th}>날짜</th>
                      <th style={{ ...th, textAlign:'right' }}>매출</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(range.daily || []).length === 0 ? (
                      <tr><td colSpan={2} style={tdCenter}>데이터 없음</td></tr>
                    ) : (range.daily || []).sort((a,b)=> a.date.localeCompare(b.date)).map(row => (
                      <tr key={row.date}>
                        <td style={td}>{row.date}</td>
                        <td style={{ ...td, textAlign:'right' }}>{fmtMoney(row.total_cents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 범위 내 베스트셀러 */}
            <div style={{ marginTop:16 }}>
              <h4 style={{ margin:'8px 0' }}>베스트셀러 (선택 기간 Top 10)</h4>
              <div style={{ border:'1px solid #eee', borderRadius:12, overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead style={{ background:'#fafafa' }}>
                    <tr>
                      <th style={th}>메뉴</th>
                      <th style={{ ...th, textAlign:'right' }}>판매수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestItemsInRange.length === 0 ? (
                      <tr><td colSpan={2} style={tdCenter}>데이터 없음</td></tr>
                    ) : bestItemsInRange.map(([name,count]) => (
                      <tr key={name}>
                        <td style={td}>{name}</td>
                        <td style={{ ...td, textAlign:'right' }}>{KR.format(count)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div style={{ border:'1px solid #eee', borderRadius:12, padding:16 }}>선택 기간 데이터 없음</div>
        )}
      </section>

      {/* 전체기간 베스트셀러(요약 기반) */}
      <section style={{ marginTop:22 }}>
        <h3 style={{ margin:'8px 0' }}>베스트셀러 (전체 요약 Top 10)</h3>
        <div style={{ border:'1px solid #eee', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead style={{ background:'#fafafa' }}>
              <tr>
                <th style={th}>메뉴</th>
                <th style={{ ...th, textAlign:'right' }}>판매수</th>
              </tr>
            </thead>
            <tbody>
              {bestItemsOverall.length===0 ? (
                <tr><td colSpan={2} style={tdCenter}>데이터 없음</td></tr>
              ) : bestItemsOverall.map(([name,count]) => (
                <tr key={name}>
                  <td style={td}>{name}</td>
                  <td style={{ ...td, textAlign:'right' }}>{KR.format(count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const th = { textAlign:'left', padding:10, borderBottom:'1px solid #eee', fontWeight:600, fontSize:13 };
const td = { padding:10, borderBottom:'1px solid #f2f2f2', fontSize:14, verticalAlign:'middle' };
const tdCenter = { ...td, textAlign:'center', color:'#666' };
