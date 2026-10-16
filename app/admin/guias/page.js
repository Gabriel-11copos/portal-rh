'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import BotaoVoltar from '../../components/BotaoVoltar';

export default function GuiasAdmin() {
  const [guias, setGuias] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch('/api/guias')
      .then(async (r) => ({ ok: r.ok, json: await r.json() }))
      .then(({ ok, json }) => {
        if (!ok) throw new Error(json.erro || 'Não foi possível carregar os guias.');
        setGuias(json);
      })
      .catch((e) => setErro(e.message));
  }, []);

  return (
    <div>
      <BotaoVoltar />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Guias e treinamentos</h2>
        <Link href="/admin/guias/novo"><button>+ Novo guia</button></Link>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Páginas montadas com texto, imagens, arquivos e links na ordem que você escolher. Só aparecem para os
        colaboradores quando estiverem <b>publicadas</b>.
      </p>
      {erro && <div className="erro">{erro}</div>}
      {!guias && !erro && <p style={{ color: 'var(--muted)' }}>Carregando...</p>}
      {guias && guias.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhum guia criado ainda.</p>}
      {guias && guias.map((g) => (
        <Link key={g.id} href={`/admin/guias/${g.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card" style={{ opacity: g.ativo ? 1 : 0.7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div>
                <b>{g.titulo}</b>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {g.categoria} · {g.blocos} {g.blocos === 1 ? 'bloco' : 'blocos'}
                  {g.descricao ? ` · ${g.descricao}` : ''}
                </div>
              </div>
              <span className={`badge ${g.ativo ? 'respondida' : 'aberta'}`}>{g.ativo ? 'Publicado' : 'Rascunho'}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
