'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Cartão da tela inicial. Só aparece para quem tem algum extrato de gorjeta.
export default function CartaoGorjeta() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    fetch('/api/gorjetas/nao-vistas')
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => {});
  }, []);

  if (!info || !info.total) return null;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>
            Minha gorjeta
            {info.naoVistas > 0 && <span className="bolinha-notificacao">{info.naoVistas}</span>}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
            Extrato por período: apuração, descontos, redistribuição e valor líquido
          </p>
        </div>
        <Link href="/gorjeta"><button className="secundario">Ver extrato</button></Link>
      </div>
    </div>
  );
}
