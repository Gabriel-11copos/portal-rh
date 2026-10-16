'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import NavColaborador from '../components/NavColaborador';
import BotaoVoltar from '../components/BotaoVoltar';

// <agrupar>
// Agrupa os guias por categoria, em ordem alfabética (a categoria "Geral" vai por último).
function agruparPorCategoria(guias) {
  const mapa = new Map();
  for (const g of guias) {
    if (!mapa.has(g.categoria)) mapa.set(g.categoria, []);
    mapa.get(g.categoria).push(g);
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => (a === 'Geral') - (b === 'Geral') || a.localeCompare(b, 'pt-BR'))
    .map(([categoria, itens]) => ({ categoria, itens }));
}
// </agrupar>

export default function Guias() {
  const [guias, setGuias] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch('/api/guias')
      .then(async (r) => ({ ok: r.ok, json: await r.json() }))
      .then(({ ok, json }) => {
        if (!ok) throw new Error(json.erro || 'Não foi possível carregar os guias.');
        setGuias(json);
      })
      .catch((e) => setErro(e.message || 'Não foi possível carregar os guias.'));
  }, []);

  return (
    <div>
      <NavColaborador />
      <BotaoVoltar />
      <h2>Guias e treinamentos</h2>
      {!guias && !erro && <p style={{ color: 'var(--muted)' }}>Carregando...</p>}
      {erro && <div className="erro">{erro}</div>}
      {guias && guias.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhum guia disponível ainda.</p>}
      {guias && agruparPorCategoria(guias).map(({ categoria, itens }) => (
        <div key={categoria}>
          <h3 style={{ marginBottom: 8 }}>{categoria}</h3>
          {itens.map((g) => (
            <Link key={g.id} href={`/guias/${g.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card">
                <b>{g.titulo}</b>
                {g.descricao && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{g.descricao}</div>}
              </div>
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}
