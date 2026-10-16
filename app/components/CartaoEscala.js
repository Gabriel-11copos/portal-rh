'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

// Cartão da tela inicial. Só aparece se a escala estiver liberada para a pessoa.
export default function CartaoEscala() {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    fetch('/api/escala?dias=1')
      .then((r) => r.json())
      .then(setDados)
      .catch(() => {});
  }, []);

  if (!dados || !dados.liberada) return null;

  const hoje = dados.dias && dados.dias[0];
  const turno = hoje && hoje.itens && hoje.itens.find((i) => i.status === 'TRABALHO' && i.entrada && i.saida);
  let resumo = null;
  if (hoje && !hoje.erro) {
    if (turno) resumo = `Hoje: ${turno.entrada} às ${turno.saida}${turno.lojaNome ? ` · ${turno.lojaNome}` : ''}`;
    else if (hoje.itens.length === 0) resumo = 'Hoje: sem escala lançada';
    else resumo = 'Hoje: sem turno de trabalho';
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div>
          <h3 style={{ margin: 0 }}>Minha escala</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
            {resumo || 'Veja seus turnos da semana'}
          </p>
        </div>
        <Link href="/escala"><button className="secundario">Ver escala</button></Link>
      </div>
    </div>
  );
}
