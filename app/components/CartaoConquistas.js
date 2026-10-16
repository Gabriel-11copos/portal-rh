'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Cartão da tela inicial do colaborador: resume as conquistas e avisa quando há selo novo.
export default function CartaoConquistas() {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    fetch('/api/conquistas')
      .then((r) => (r.ok ? r.json() : null))
      .then(setDados)
      .catch(() => {});
  }, []);

  if (!dados || dados.erro) return null;

  let resumo = 'Veja seus selos';
  if (dados.total > 0) resumo = `${dados.total} conquista${dados.total > 1 ? 's' : ''}`;
  else if (dados.tempo && dados.tempo.proximo) resumo = `Próximo selo: ${dados.tempo.proximo.nome}`;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>
            Minhas conquistas
            {dados.novos > 0 && <span className="bolinha-notificacao">{dados.novos}</span>}
          </h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>{resumo}</p>
        </div>
        <Link href="/conquistas"><button className="secundario">Ver selos</button></Link>
      </div>
    </div>
  );
}
