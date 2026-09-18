'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import UploadAnexo from '../../../components/UploadAnexo';

export default function DetalheSolicitacao() {
  const { id } = useParams();
  const router = useRouter();
  const [solicitacao, setSolicitacao] = useState(null);
  const [texto, setTexto] = useState('');
  const [anexos, setAnexos] = useState([]);

  async function carregar() {
    const todas = await fetch('/api/solicitacoes').then((r) => r.json());
    setSolicitacao(todas.find((s) => s.id === id));
  }

  useEffect(() => { carregar(); }, [id]);

  async function responder(e) {
    e.preventDefault();
    await fetch(`/api/solicitacoes/${id}/resposta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto, anexos }),
    });
    setTexto('');
    setAnexos([]);
    carregar();
  }

  async function encerrar() {
    await fetch(`/api/solicitacoes/${id}/encerrar`, { method: 'POST' });
    router.push('/admin');
  }

  if (!solicitacao) return <p>Carregando...</p>;

  return (
    <div>
      <button className="secundario" onClick={() => router.push('/admin')}>← Voltar</button>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>{solicitacao.assunto.nome}</h2>
        <p style={{ color: 'var(--muted)' }}>
          {solicitacao.colaborador.nome} · {solicitacao.colaborador.loja} · {solicitacao.colaborador.email}
        </p>
        <p>{solicitacao.descricao}</p>

        {solicitacao.anexos.filter((a) => a.enviadoPor === 'colaborador').map((a) => (
          <div key={a.id}><a href={a.linkDrive} target="_blank" rel="noreferrer">📎 {a.nomeArquivo}</a></div>
        ))}
      </div>

      {solicitacao.respostas.map((r) => (
        <div key={r.id} className="card" style={{ background: 'var(--pastel-blue)' }}>
          {r.texto} {r.automatica && <em style={{ fontSize: 12 }}>(resposta automática)</em>}
        </div>
      ))}

      {solicitacao.status !== 'encerrada' && (
        <div className="card">
          <h3>Responder</h3>
          <form onSubmit={responder}>
            <textarea rows={4} value={texto} onChange={(e) => setTexto(e.target.value)} required />
            <UploadAnexo onUploaded={(a) => setAnexos([...anexos, a])} />
            {anexos.map((a, i) => <div key={i} style={{ fontSize: 13, color: 'var(--success)' }}>✓ {a.nomeArquivo}</div>)}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="submit">Enviar resposta</button>
              <button type="button" className="secundario" onClick={encerrar}>Encerrar solicitação</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
