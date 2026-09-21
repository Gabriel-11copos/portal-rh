'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import UploadAnexo from '../../../components/UploadAnexo';
import Avatar from '../../../components/Avatar';
import BotaoVoltar from '../../../components/BotaoVoltar';

const rotulos = {
  aberta: 'Pendente',
  em_analise: 'Pendente',
  respondida: 'Em andamento',
  encerrada: 'Encerrada',
};

function iconeArquivo(nome) {
  const ext = (nome.split('.').pop() || '').toLowerCase();
  if (['pdf'].includes(ext)) return '📄';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return '🎞️';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
  if (['doc', 'docx'].includes(ext)) return '📝';
  return '📎';
}

export default function DetalheSolicitacao() {
  const { id } = useParams();
  const router = useRouter();
  const [solicitacao, setSolicitacao] = useState(null);
  const [texto, setTexto] = useState('');
  const [nomeAtendente, setNomeAtendente] = useState('');
  const [anexos, setAnexos] = useState([]);
  const [alterandoPrazo, setAlterandoPrazo] = useState(false);
  const [novoPrazo, setNovoPrazo] = useState('');

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

  async function salvarNovoPrazo(e) {
    e.preventDefault();
    await fetch(`/api/solicitacoes/${id}/prazo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ novoPrazo }),
    });
    setAlterandoPrazo(false);
    carregar();
  }

  if (!solicitacao) return <p>Carregando...</p>;

  const respostasOrdenadas = [...solicitacao.respostas].sort((a, b) => new Date(a.data) - new Date(b.data));
  const diasRestantes = solicitacao.prazo
    ? Math.ceil((new Date(solicitacao.prazo) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const atrasada = solicitacao.status !== 'encerrada' && diasRestantes !== null && diasRestantes < 0;

  return (
    <div>
      <BotaoVoltar />

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <span className="numero-solicitacao">#{solicitacao.numero} · </span>
            <h2 style={{ display: 'inline' }}>{solicitacao.assunto.nome}</h2>
          </div>
          <span className={`badge ${atrasada ? 'encerrada' : solicitacao.status}`} style={atrasada ? { background: '#fed7d7', color: 'var(--danger)' } : {}}>
            {atrasada ? 'Atrasada' : rotulos[solicitacao.status]}
          </span>
        </div>
        <p style={{ fontWeight: 700, fontSize: 16, marginTop: 8 }}>
          {solicitacao.colaborador.nomeSocial || solicitacao.colaborador.nome}
          {solicitacao.colaborador.nomeSocial && (
            <span style={{ fontWeight: 400, fontSize: 13, color: 'var(--muted)' }}>
              {' '}(nome civil: {solicitacao.colaborador.nome})
            </span>
          )}
        </p>
        <p style={{ color: 'var(--muted)' }}>
          {solicitacao.colaborador.loja} · {solicitacao.emailContato || solicitacao.colaborador.email}
          {solicitacao.whatsapp && ` · WhatsApp: ${solicitacao.whatsapp}`}
        </p>
        <p>{solicitacao.descricao}</p>

        {solicitacao.status !== 'encerrada' && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            {!alterandoPrazo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={{ color: atrasada ? 'var(--danger)' : 'var(--muted)' }}>
                  Prazo: {solicitacao.prazo ? new Date(solicitacao.prazo).toLocaleDateString('pt-BR') : '-'}
                  {atrasada && ' (atrasada)'}
                </span>
                <button
                  type="button"
                  className="secundario"
                  style={{ padding: '2px 10px', fontSize: 12 }}
                  onClick={() => {
                    setNovoPrazo(new Date().toISOString().slice(0, 10));
                    setAlterandoPrazo(true);
                  }}
                >
                  Alterar prazo
                </button>
              </div>
            ) : (
              <form onSubmit={salvarNovoPrazo} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="date" value={novoPrazo} onChange={(e) => setNovoPrazo(e.target.value)} style={{ marginBottom: 0, maxWidth: 180 }} required />
                <button type="submit" style={{ padding: '6px 14px' }}>Salvar novo prazo</button>
                <button type="button" className="secundario" style={{ padding: '6px 14px' }} onClick={() => setAlterandoPrazo(false)}>Cancelar</button>
              </form>
            )}
          </div>
        )}
      </div>

      {respostasOrdenadas.map((r) => {
        const isColab = r.autor === 'colaborador';
        const nomeColab = solicitacao.colaborador.nomeSocial || solicitacao.colaborador.nome;
        return (
          <div key={r.id} className="linha-mensagem" style={{ justifyContent: isColab ? 'flex-end' : 'flex-start' }}>
            {!isColab && <Avatar fotoUrl={null} nome={r.nomeAutor || 'RH'} size={28} />}
            <div className={`bolha ${r.autor}`}>
              <div className="autor">
                {isColab ? nomeColab : (r.nomeAutor || 'RH/DP')}
                {r.automatica && ' · resposta automática'}
              </div>
              {r.texto}
            </div>
            {isColab && <Avatar fotoUrl={solicitacao.colaborador.fotoUrl} nome={nomeColab} size={28} />}
          </div>
        );
      })}

      {solicitacao.anexos.length > 0 && (
        <div className="card">
          <b style={{ fontSize: 13 }}>Anexos ({solicitacao.anexos.length})</b>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {solicitacao.anexos.map((a) => (
              <a
                key={a.id}
                href={a.linkDrive}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                  border: '1px solid var(--border)', borderRadius: 12, textDecoration: 'none',
                  color: 'var(--text)', fontSize: 13, background: 'var(--pastel-bg)', maxWidth: 220,
                }}
              >
                <span style={{ fontSize: 20 }}>{iconeArquivo(a.nomeArquivo)}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nomeArquivo}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.enviadoPor === 'rh' ? 'Enviado pelo RH' : 'Do colaborador'}</div>
                </span>
              </a>
            ))}
          </div>
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
