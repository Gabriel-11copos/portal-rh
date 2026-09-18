'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const rotulos = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  respondida: 'Respondida',
  encerrada: 'Encerrada',
};

export default function MinhasSolicitacoes() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [comunicados, setComunicados] = useState([]);

  useEffect(() => {
    fetch('/api/solicitacoes').then((r) => r.json()).then(setSolicitacoes);
    fetch('/api/comunicados').then((r) => r.json()).then(setComunicados);
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Minhas solicitações</h2>
        <Link href="/nova-solicitacao"><button>+ Nova solicitação</button></Link>
      </div>

      {solicitacoes.length === 0 && <p>Você ainda não abriu nenhuma solicitação.</p>}

      {solicitacoes.map((s) => (
        <div key={s.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <b>{s.assunto.nome}</b>
            <span className={`badge ${s.status}`}>{rotulos[s.status]}</span>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>{s.descricao}</p>
          {s.respostas.map((r) => (
            <div key={r.id} style={{ background: 'var(--pastel-blue)', padding: 10, borderRadius: 8, marginTop: 8, fontSize: 14 }}>
              {r.texto}
            </div>
          ))}
          {s.anexos.filter((a) => a.enviadoPor === 'rh').map((a) => (
            <div key={a.id} style={{ marginTop: 6 }}>
              <a href={a.linkDrive} target="_blank" rel="noreferrer">📎 {a.nomeArquivo}</a>
            </div>
          ))}
        </div>
      ))}

      {comunicados.length > 0 && (
        <>
          <h3 style={{ marginTop: 32 }}>Comunicados recebidos do RH</h3>
          {comunicados.map((c) => (
            <div key={c.id} className="card">
              <b>{c.assunto}</b>
              <p style={{ fontSize: 14 }}>{c.texto}</p>
              {c.anexos.map((a) => (
                <div key={a.id}>
                  <a href={a.linkDrive} target="_blank" rel="noreferrer">📎 {a.nomeArquivo}</a>
                </div>
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
