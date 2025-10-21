import Link from 'next/link';
import dynamic from 'next/dynamic';
import MenuForm from '../../components/MenuForm';

// 목록은 CSR 컴포넌트로
const MenuTable = dynamic(() => import('../../components/MenuTable'), { ssr: false });

export default function AdminPage() {
  return (
    <main>
      <header
        style={{
          position: 'sticky',
          top: 0,
          background: '#fff',
          zIndex: 10,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: '1px solid #eee',
        }}
      >
        <h1 style={{ margin: 0 }}>관리자 메뉴</h1>
        <nav style={{ display: 'flex', gap: 8 }}>
          <Link
            href="/"
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              textDecoration: 'none',
              color: '#111',
            }}
          >
            ← 메인
          </Link>
          <Link
            href="/admin/stats"
            style={{
              padding: '8px 12px',
              border: '1px solid #ddd',
              borderRadius: 8,
              textDecoration: 'none',
              color: '#111',
            }}
          >
            통계 대시보드
          </Link>
        </nav>
      </header>

      <div style={{ maxWidth: 960, margin: '16px auto', padding: '0 16px' }}>
        <MenuForm />
        <MenuTable />
      </div>
    </main>
  );
}
