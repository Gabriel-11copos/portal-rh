'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import UploadAnexo from '../../../components/UploadAnexo';

const rotulos = {
  aberta: 'Aberta',
  em_analise: 'Em análise',
  respondida: 'Respondida',
  encerrada: 'Encerrada',
};

export default function DetalheSolicitacao() {
  const { id } = useParams();
  const router = useRouter();
  const [solicitacao, setSolicitacao] = useState(null);
  const [texto, setTexto] = useState('');
  const [nomeAtendente, setNomeAtendente] = useState('');
  const [anexos, setAnexos] = useState([]);

  async function carregar() {
    const todas = await fetch('/api/solicitacoes').then((r) => r.json());
    setSolicitacao(todas.find((s) => s.id === id));
  }

  useEffect(() => {
    carregar();
    const nomeSalvo = localStorage.getItem('nomeAtendenteRH');
    if (nomeSalvo) setNomeAtendente(nomeSalvo);
  }, [id]);

  async function responder(e) {
    e.preventDefault();
    if (!nomeAtendente.trim()) {
      alert('Informe seu nome antes de responder.');
      return;
    }
    localStorage.setItem('nomeAtendenteRH', nomeAtendente);
    await fetch(`/api/solicitacoes/${id}/resposta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto, anexos, nomeAtendente }),
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

  const respostasOrdenadas = [...solicitacao.respostas].sort((a, b) => new Date(a.data) - new Date(b.data));

  return (
    <div>
      <button className="secundario" onClick={() => router.push('/admin')}>← Voltar</button>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h2>{solicitacao.assunto.nome}</h2>
          <span className={`badge ${solicitacao.status}`}>{rotulos[solicitacao.status]}</span>
        </div>
        <p style={{ color: 'var(--muted)' }}>
          {solicitacao.colaborador.nome} · {solicitacao.colaborador.loja} · {solicitacao.colaborador.email}
        </p>
        <p>{solicitacao.descricao}</p>

        {solicitacao.anexos.filter((a) => a.enviadoPor === 'colaborador').map((a) => (
          <div key={a.id}><a href={a.linkDrive} target="_blank" rel="noreferrer">📎 {a.nomeArquivo}</a></div>
        ))}
      </div>

      {respostasOrdenadas.map((r) => (
        <div
          key={r.id}
          className="card"
          style={{ background: r.autor === 'rh' ? 'var(--pastel-blue)' : '#f1f5f9' }}
        >
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>
            {r.autor === 'rh' ? (r.nomeAutor || 'RH/DP') : solicitacao.colaborador.nome}
            {r.automatica && ' · resposta automática'}
          </div>
          {r.texto}
        </div>
      ))}

      {solicitacao.status === 'encerrada' && solicitacao.avaliacaoNota && (
        <div className="card">
          <b>Avaliação do colaborador:</b> {solicitacao.avaliacaoNota}/5
          {solicitacao.avaliacaoComentario && <p style={{ fontSize: 14 }}>"{solicitacao.avaliacaoComentario}"</p>}
        </div>
      )}

      {solicitacao.status !== 'encerrada' && (
        <div className="card">
          <h3>Responder</h3>
          <form onSubmit={responder}>
            <label>Seu nome (quem está atendendo)</label>
            <input value={nomeAtendente} onChange={(e) => setNomeAtendente(e.target.value)} required />

            <label>Mensagem</label>
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
