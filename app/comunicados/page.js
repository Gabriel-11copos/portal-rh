'use client';
import { useEffect, useState } from 'react';
import NavColaborador from '../components/NavColaborador';
import BotaoVoltar from '../components/BotaoVoltar';

// Todos os comunicados recebidos (os não lidos também aparecem como aviso ao entrar no portal).
export default function Comunicados() {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch('/api/comunicados')
      .then(async (r) => ({ ok: r.ok, json: await r.json() }))
      .then(({ ok, json }) => {
        if (!ok || !Array.isArray(json)) throw new Error('Não foi possível carregar os comunicados.');
        setLista(json);
      })
      .catch((e) => setErro(e.message || 'Não foi possível carregar os comunicados.'));
  }, []);

  return (
    <div>
      <NavColaborador />
      <BotaoVoltar />
      <h2>Comunicados</h2>
      {!lista && !erro && <p style={{ color: 'var(--muted)' }}>Carregando...</p>}
      {erro && <div className="erro">{erro}</div>}
      {lista && lista.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhum comunicado recebido ainda.</p>}
      {lista && lista.map((c) => (
        <div key={c.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <b>{c.assunto}</b>
            {!c.lido && <span className="badge aberta">Novo</span>}
          </div>
          {c.data && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {new Date(c.data).toLocaleDateString('pt-BR')}
            </div>
          )}
          <p style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{c.texto}</p>
          {(c.anexos || []).map((a) => (
            <div key={a.id}>
              <a href={a.linkDrive} target="_blank" rel="noreferrer">📎 {a.nomeArquivo}</a>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
