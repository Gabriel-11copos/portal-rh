'use client';
import { useEffect, useState } from 'react';
import NavColaborador from '../components/NavColaborador';
import BotaoVoltar from '../components/BotaoVoltar';

export default function MeusDocumentos() {
  const [documentos, setDocumentos] = useState([]);

  useEffect(() => {
    fetch('/api/documentos').then((r) => r.json()).then(setDocumentos);
    fetch('/api/documentos/marcar-vistas', { method: 'POST' });
  }, []);

  return (
    <div>
      <NavColaborador />
      <BotaoVoltar />
      <h2>Meus documentos</h2>

      {documentos.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhum documento disponível ainda.</p>}

      {documentos.map((d) => (
        <a
          key={d.id}
          href={d.url}
          target="_blank"
          rel="noreferrer"
          className="card"
          style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'var(--text)' }}
        >
          <span style={{ fontSize: 24 }}>📄</span>
          <div>
            <div style={{ fontWeight: 600 }}>{d.tipo} — {d.competencia}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Disponibilizado em {new Date(d.criadoEm).toLocaleDateString('pt-BR')}
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
