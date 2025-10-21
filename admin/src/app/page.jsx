import Link from 'next/link';
import OrdersFeed from '../components/OrdersFeed';

export default function Page() {
  return (
    <main>
      <header style={{
        position:'sticky', top:0, background:'#fff', zIndex:10,
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'14px 16px', borderBottom:'1px solid #eee'
      }}>
        <h1 style={{ margin:0 }}>Yurica • 현재 들어온 주문</h1>
        <Link href="/admin" style={{
          padding:'8px 12px', border:'1px solid #ddd', borderRadius:8, textDecoration:'none', color:'#111'
        }}>
          관리자메뉴
        </Link>
      </header>

      <OrdersFeed />
    </main>
  );
}
