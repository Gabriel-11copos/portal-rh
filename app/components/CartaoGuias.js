'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Cartão da tela inicial. Só aparece quando há pelo menos um guia publicado.
export default function CartaoGuias() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch('/api/guias')
      .then((r) => (r.ok ? r.json() : []))
      .then((l) => setTotal(Array.isArray(l) ? l.length : 0))
      .catch(() => {});
  }, []);

  if (!total) return null;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>Guias e treinamentos</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
            {total} {total === 1 ? 'guia disponível' : 'guias disponíveis'}: passo a passo, manuais e treinamentos
          </p>
        </div>
        <Link href="/guias"><button className="secundario">Ver guias</button></Link>
      </div>
    </div>
  );
}
