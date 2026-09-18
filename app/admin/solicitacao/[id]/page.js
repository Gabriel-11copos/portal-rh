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
          <div>
            <span className="numero-solicitacao">#{solicitacao.numero} · </span>
            <h2 style={{ display: 'inline' }}>{solicitacao.assunto.nome}</h2>
          </div>
          <span className={`badge ${solicitacao.status}`}>{rotulos[solicitacao.status]}</span>
        </div>
        <p style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>{solicitacao.colaborador.nome}</p>
        <p style={{ color: 'var(--muted)' }}>
          {solicitacao.colaborador.loja} · {solicitacao.emailContato || solicitacao.colaborador.email}
          {solicitacao.whatsapp && ` · WhatsApp: ${solicitacao.whatsapp}`}
        </p>
        <p>{solicitacao.descricao}</p>
      </div>

      {respostasOrdenadas.map((r) => (
        <div key={r.id} className={`bolha ${r.autor}`}>
          <div className="autor">
            {r.autor === 'rh' ? (r.nomeAutor || 'RH/DP') : solicitacao.colaborador.nome}
            {r.automatica && ' · resposta automática'}
          </div>
          {r.texto}
        </div>
      ))}

      {solicitacao.anexos.length > 0 && (
        <div className="card">
          <b style={{ fontSize: 13 }}>Anexos</b>
          {solicitacao.anexos.map((a) => (
            <div key={a.id} style={{ marginTop: 6 }}>
              <a href={a.linkDrive} target="_blank" rel="noreferrer">
                📎 {a.nomeArquivo} {a.enviadoPor === 'rh' ? '(enviado pelo RH)' : '(do colaborador)'}
              </a>
            </div>
          ))}
        </div>
      )}

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

            <UploadAnexo colaboradorId={solicitacao.colaboradorId} onUploaded={(a) => setAnexos([...anexos, a])} />
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
