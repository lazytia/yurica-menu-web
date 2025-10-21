'use client';
import { useEffect, useRef, useState } from 'react';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function MenuForm() {
  const [endpoint, setEndpoint] = useState('http://localhost:4000');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [description, setDescription] = useState('');
  const [allergies, setAllergies] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef(null);

  // 화면 폭에 따라 1열/2열 전환 (좁으면 1열)
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 820); // 임계값 820px
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function toCents(dollarsStr) {
    const num = parseFloat(String(dollarsStr).replace(/[^0-9.]/g, ''));
    if (Number.isNaN(num)) return 0;
    return Math.round(num * 100);
  }

  async function uploadImageIfNeeded() {
    if (!imageFile) return '';
    const form = new FormData();
    form.append('file', imageFile);
    const res = await fetch(`${endpoint.replace(/\/+$/,'')}/api/upload`, { method:'POST', body: form });
    if (!res.ok) throw new Error(`업로드 실패: HTTP ${res.status}`);
    const json = await res.json();
    return `${endpoint.replace(/\/+$/,'')}${json.url}`;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      const imageUrl = await uploadImageIfNeeded();
      const body = {
        name: name.trim(),
        category: category.trim(),
        price_cents: toCents(priceUsd),
        description: description.trim(),
        allergies: allergies.trim(),
        image_url: imageUrl,
        currency: 'USD'
      };
      if (!body.name) throw new Error('메뉴 이름을 입력하세요.');
      if (!body.category) throw new Error('카테고리를 입력하세요.');
      if (!body.price_cents) throw new Error('가격(USD)을 입력하세요.');

      const res = await fetch(`${endpoint.replace(/\/+$/,'')}/api/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`등록 실패: HTTP ${res.status}`);

      setMessage('✅ 메뉴가 등록되었습니다.');
      setName(''); setCategory(''); setPriceUsd(''); setDescription(''); setAllergies('');
      setImageFile(null); setImagePreview(''); fileRef.current && (fileRef.current.value = '');
    } catch (err) {
      setMessage(`❌ ${err.message || err}`);
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #ddd',
    borderRadius: 8,
    boxSizing: 'border-box' // ← 겹침 방지 핵심
  };

  return (
    <div
      style={{
        border:'1px solid #eee',
        borderRadius:16,
        padding:16,
        background:'#fff',
        boxShadow:'0 2px 10px rgba(0,0,0,0.03)',
        maxWidth: 700,
        margin: '0 auto'
      }}
    >
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, gap:12, flexWrap:'wrap' }}>
        <h2 style={{ margin:0 }}>메뉴 추가하기</h2>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:12, color:'#666' }}>API</span>
          <input
            value={endpoint} onChange={e=>setEndpoint(e.target.value)}
            style={{ ...inputStyle, width: 240, padding:'6px 10px' }}
          />
        </div>
      </div>

      {/* 폼: 좁으면 1열, 넓으면 이미지+필드 2열 */}
      <form
        onSubmit={onSubmit}
        style={{
          display:'grid',
          gridTemplateColumns: isNarrow ? '1fr' : '180px 1fr',
          gap:14,
          alignItems:'start'
        }}
      >
        {/* 왼쪽: 이미지 */}
        <div>
          <div
            style={{
              width:'100%',
              aspectRatio:'1 / 1',
              border:'1px dashed #ccd',
              borderRadius:12,
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              overflow:'hidden',
              background:'#fafafa',
              cursor:'pointer'
            }}
            onClick={()=>fileRef.current?.click()}
            title="이미지 선택"
          >
            {imagePreview
              ? <img src={imagePreview} alt="preview" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
              : <span style={{ color:'#888', fontSize:12 }}>사진 업로드</span>
            }
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display:'none' }}
            onChange={(e)=>{
              const f = e.target.files?.[0];
              if (!f) return;
              setImageFile(f);
              const reader = new FileReader();
              reader.onload = () => setImagePreview(reader.result);
              reader.readAsDataURL(f);
            }}
          />
          <div style={{ fontSize:12, color:'#888', marginTop:8 }}>JPG/PNG/WebP, 최대 5MB</div>
        </div>

        {/* 오른쪽: 필드들 (자동 줄바꿈 그리드) */}
        <div style={{
          display:'grid',
          gridTemplateColumns: isNarrow ? '1fr' : 'repeat(auto-fit, minmax(220px, 1fr))',
          gap:10
        }}>
          <label style={{ display:'block' }}>
            <div style={{ fontSize:12, color:'#666' }}>메뉴 이름</div>
            <input
              value={name} onChange={e=>setName(e.target.value)}
              placeholder="예) Salmon Sashimi"
              style={inputStyle}
            />
          </label>

          <label style={{ display:'block' }}>
            <div style={{ fontSize:12, color:'#666' }}>카테고리</div>
            <input
              value={category} onChange={e=>setCategory(e.target.value)}
              placeholder="예) Sushi, Don, Noodles"
              style={inputStyle}
            />
          </label>

          <label style={{ display:'block' }}>
            <div style={{ fontSize:12, color:'#666' }}>가격 (USD)</div>
            <input
              value={priceUsd}
              onChange={e=>{
                const v = e.target.value.replace(/[^0-9.]/g, '');
                const fixed = v.split('.').length > 2 ? v.replace(/\.+$/, '') : v;
                setPriceUsd(fixed);
              }}
              placeholder="예) 12.50"
              inputMode="decimal"
              style={{ ...inputStyle, textAlign:'right' }}
            />
            {priceUsd && (
              <div style={{ fontSize:12, color:'#666', marginTop:4, textAlign:'right' }}>
                {USD.format(parseFloat(priceUsd || '0') || 0)}
              </div>
            )}
          </label>

          <label style={{ display:'block' }}>
            <div style={{ fontSize:12, color:'#666' }}>알러지 정보 (콤마로 구분)</div>
            <input
              value={allergies}
              onChange={e=>setAllergies(e.target.value)}
              placeholder="e.g., Milk, Nuts, Gluten"
              style={inputStyle}
            />
          </label>

          <label style={{ display:'block', gridColumn: isNarrow ? 'auto' : '1 / -1' }}>
            <div style={{ fontSize:12, color:'#666' }}>설명</div>
            <textarea
              value={description} onChange={e=>setDescription(e.target.value)}
              placeholder="메뉴에 대해 간단히 적어주세요."
              rows={4}
              style={{ ...inputStyle, resize:'vertical' }}
            />
          </label>

          <div style={{ gridColumn: isNarrow ? 'auto' : '1 / -1', display:'flex', gap:10, justifyContent:'flex-end', marginTop:6 }}>
            <button
              type="button"
              onClick={()=>{
                setName(''); setCategory(''); setPriceUsd(''); setDescription(''); setAllergies('');
                setImageFile(null); setImagePreview(''); fileRef.current && (fileRef.current.value='');
                setMessage('');
              }}
              style={{ padding:'10px 14px', border:'1px solid #ddd', background:'#f8f8f8', borderRadius:8 }}
            >
              초기화
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding:'10px 14px', border:'1px solid #111', background: submitting ? '#888' : '#111',
                color:'#fff', borderRadius:8, cursor: submitting ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? '등록 중…' : '메뉴 등록'}
            </button>
          </div>

          {message && (
            <div style={{ gridColumn: isNarrow ? 'auto' : '1 / -1', marginTop:8, color: message.startsWith('✅') ? 'green' : '#b00' }}>
              {message}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
