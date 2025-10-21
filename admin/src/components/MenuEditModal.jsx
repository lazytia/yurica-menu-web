'use client';
import { useEffect, useRef, useState } from 'react';

const AUS = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AUS' });

export default function MenuEditModal({ open, onClose, item, endpoint, onSaved }) {
  const [name, setName] = useState(item?.name || '');
  const [category, setCategory] = useState(item?.category || '');
  const [priceUsd, setPriceUsd] = useState(item ? ((item.price_cents||0)/100).toFixed(2) : '');
  const [description, setDescription] = useState(item?.description || '');
  const [allergies, setAllergies] = useState(item?.allergies || '');
  const [imagePreview, setImagePreview] = useState(item?.image_url || '');
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (open) {
      setName(item?.name || '');
      setCategory(item?.category || '');
      setPriceUsd(item ? ((item.price_cents||0)/100).toFixed(2) : '');
      setDescription(item?.description || '');
      setAllergies(item?.allergies || '');
      setImagePreview(item?.image_url || '');
      setImageFile(null);
    }
  }, [open, item]);

  if (!open) return null;

  function toCents(dollarsStr) {
    const num = parseFloat(String(dollarsStr).replace(/[^0-9.]/g, ''));
    if (Number.isNaN(num)) return 0;
    return Math.round(num * 100);
  }

  async function uploadImageIfNeeded() {
    if (!imageFile) return imagePreview || '';
    const form = new FormData();
    form.append('file', imageFile);
    const res = await fetch(`${endpoint.replace(/\/+$/,'')}/api/upload`, { method:'POST', body: form });
    if (!res.ok) throw new Error(`업로드 실패: HTTP ${res.status}`);
    const json = await res.json();
    // 서버가 /uploads/... 를 주므로 endpoint 합쳐서 절대경로로
    return `${endpoint.replace(/\/+$/,'')}${json.url}`;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const imgUrl = await uploadImageIfNeeded();
      const body = {
        name: name.trim(),
        category: category.trim(),
        price_cents: toCents(priceUsd),
        description: description.trim(),
        allergies: allergies.trim(),
        image_url: imgUrl,
        currency: 'AUS'
      };
      const res = await fetch(`${endpoint.replace(/\/+$/,'')}/api/menu/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(`수정 실패: HTTP ${res.status}`);
      onSaved?.();
      onClose?.();
    } catch (err) {
      alert(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  const overlay = {
    position:'fixed', inset:0, background:'rgba(0,0,0,0.4)',
    display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000
  };
  const card = { width:'min(720px, 92vw)', background:'#fff', borderRadius:12, padding:16, boxShadow:'0 10px 30px rgba(0,0,0,0.2)' };
  const input = { width:'100%', padding:'10px 12px', border:'1px solid #ddd', borderRadius:8, boxSizing:'border-box' };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={card} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
          <h3 style={{margin:0}}>메뉴 수정</h3>
          <button onClick={onClose} style={{border:'1px solid #ddd', background:'#fff', borderRadius:8, padding:'6px 10px'}}>닫기</button>
        </div>

        <form onSubmit={onSubmit} style={{ display:'grid', gridTemplateColumns:'180px 1fr', gap:14, alignItems:'start' }}>
          {/* 이미지 */}
          <div>
            <div
              style={{ width:'100%', aspectRatio:'1/1', border:'1px dashed #ccd', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', background:'#fafafa', cursor:'pointer' }}
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

          {/* 필드들 */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:10 }}>
            <label>
              <div style={{ fontSize:12, color:'#666' }}>메뉴 이름</div>
              <input value={name} onChange={e=>setName(e.target.value)} style={input} />
            </label>
            <label>
              <div style={{ fontSize:12, color:'#666' }}>카테고리</div>
              <input value={category} onChange={e=>setCategory(e.target.value)} style={input} />
            </label>
            <label>
              <div style={{ fontSize:12, color:'#666' }}>가격 (AUS)</div>
              <input
                value={priceUsd}
                onChange={e=>{
                  const v = e.target.value.replace(/[^0-9.]/g, '');
                  const fixed = v.split('.').length > 2 ? v.replace(/\.+$/, '') : v;
                  setPriceUsd(fixed);
                }}
                inputMode="decimal"
                style={{ ...input, textAlign:'right' }}
              />
              {priceUsd && <div style={{ fontSize:12, color:'#666', marginTop:4, textAlign:'right' }}>{AUS.format(parseFloat(priceUsd || '0') || 0)}</div>}
            </label>
            <label>
              <div style={{ fontSize:12, color:'#666' }}>알러지 (콤마 구분)</div>
              <input value={allergies} onChange={e=>setAllergies(e.target.value)} style={input} />
            </label>
            <label style={{ gridColumn:'1 / -1' }}>
              <div style={{ fontSize:12, color:'#666' }}>설명</div>
              <textarea value={description} onChange={e=>setDescription(e.target.value)} rows={4} style={{ ...input, resize:'vertical' }} />
            </label>

            <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button type="button" onClick={onClose} style={{ padding:'10px 14px', border:'1px solid #ddd', background:'#f8f8f8', borderRadius:8 }}>취소</button>
              <button type="submit" disabled={saving} style={{ padding:'10px 14px', border:'1px solid #111', background: saving ? '#888' : '#111', color:'#fff', borderRadius:8 }}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
