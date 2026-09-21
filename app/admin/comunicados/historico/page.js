'use client';
import { useEffect, useMemo, useState } from 'react';
import BotaoVoltar from '../../../components/BotaoVoltar';

export default function HistoricoComunicados() {
  const [comunicados, setComunicados] = useState([]);

  useEffect(() => {
    fetch('/api/comunicados').then((r) => r.json()).then(setComunicados);
  }, []);

  const lotes = useMemo(() => {
    const grupos = {};
    for (const c of comunicados) {
      const chave = c.loteId || c.id;
      if (!grupos[chave]) grupos[chave] = { assunto: c.assunto, texto: c.texto, data: c.data, destinatarios: [] };
      grupos[chave].destinatarios.push(c);
    }
    return Object.values(grupos).sort((a, b) => new Date(b.data) - new Date(a.data));
  }, [comunicados]);

  return (
    <div>
      <BotaoVoltar />
      <h2 style={{ marginTop: 16 }}>Histórico de comunicados enviados</h2>

      {lotes.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhum comunicado enviado ainda.</p>}

      {lotes.map((lote, i) => {
        const lidos = lote.destinatarios.filter((d) => d.lido).length;
        return (
          <div key={i} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <b>{lote.assunto}</b>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                {new Date(lote.data).toLocaleString('pt-BR')}
              </span>
            </div>
            <p style={{ fontSize: 14 }}>{lote.texto}</p>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              {lidos}/{lote.destinatarios.length} colaborador(es) já visualizaram
            </p>
            <details>
              <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--verde)' }}>Ver destinatários</summary>
              <div style={{ marginTop: 8 }}>
                {lote.destinatarios.map((d) => (
                  <div key={d.id} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    {d.colaborador?.nomeSocial || d.colaborador?.nome} · {d.colaborador?.loja}
                    {' — '}
                    {d.lido ? (
                      <span style={{ color: 'var(--success)' }}>visualizado em {new Date(d.lidoEm).toLocaleString('pt-BR')}</span>
                    ) : (
                      <span style={{ color: 'var(--warning)' }}>ainda não visualizado</span>
                    )}
                  </div>
                ))}
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}
