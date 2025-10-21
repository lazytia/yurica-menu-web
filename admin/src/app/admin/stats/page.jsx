import Link from 'next/link';
import dynamic from 'next/dynamic';

// CSR 전용 컴포넌트로 불러오기 (SSE/브라우저 API 사용 대비)
const AdminStats = dynamic(() => import('../../../components/AdminStats'), { ssr: false });

export default function StatsPage() {
  return (
    <main>
      <header style={{
        position:'sticky', top:0, background:'#fff', zIndex:10,
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'14px 16px', borderBottom:'1px solid #eee'
      }}>
        <h1 style={{ margin:0 }}>통계 대시보드</h1>
        <nav style={{ display:'flex', gap:8 }}>
          <Link href="/admin" style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, textDecoration:'none', color:'#111' }}>
            관리자메뉴
          </Link>
          <Link href="/" style={{ padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, textDecoration:'none', color:'#111' }}>
            ← 메인
          </Link>
        </nav>
      </header>

      <AdminStats />
    </main>
  );
}
