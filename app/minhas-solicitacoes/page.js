'use client';
import { useEffect, useState } from 'react';
import NavColaborador from '../components/NavColaborador';
import UploadAnexo from '../components/UploadAnexo';
import Avatar from '../components/Avatar';
import BotaoVoltar from '../components/BotaoVoltar';

const rotulos = {
  aberta: 'Pendente',
  em_analise: 'Pendente',
  respondida: 'Em andamento',
  encerrada: 'Encerrada',
};

function formatarDataHora(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const aa = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${aa} ${hh}:${min}`;
}

function CartaoSolicitacao({ s, onAtualizar, perfil }) {
  const [texto, setTexto] = useState('');
  const [anexosNovos, setAnexosNovos] = useState([]);
  const [avaliando, setAvaliando] = useState(false);
  const [nota, setNota] = useState(5);

  async function enviarMensagem(e) {
    e.preventDefault();
    if (!texto.trim() && anexosNovos.length === 0) return;
    await fetch(`/api/solicitacoes/${s.id}/mensagem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto, anexos: anexosNovos }),
    });
    setTexto('');
    setAnexosNovos([]);
    onAtualizar();
  }

  async function encerrarComAvaliacao(e) {
    e.preventDefault();
    await fetch(`/api/solicitacoes/${s.id}/avaliar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nota }),
    });
    setAvaliando(false);
    onAtualizar();
  }

  const nomeExibido = perfil?.nomeSocial || perfil?.nome || 'Você';
  const mensagemInicial = {
    id: 'inicial',
    autor: 'colaborador',
    texto: s.descricao,
    data: s.dataAbertura,
  };
  const respostasOrdenadas = [...s.respostas].sort((a, b) => new Date(a.data) - new Date(b.data));
  const conversa = [mensagemInicial, ...respostasOrdenadas];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <span className="numero-solicitacao">#{s.numero} · </span>
          <b>{s.assunto.nome}</b>
        </div>
        <span className={`badge ${s.status}`}>{rotulos[s.status]}</span>
      </div>
      {s.status !== 'encerrada' && s.prazo && (
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          Previsão de resposta: {new Date(s.prazo).toLocaleDateString('pt-BR')}
        </p>
      )}

      {conversa.map((r) => {
        const isColab = r.autor === 'colaborador';
        const nomeAvatar = isColab ? nomeExibido : (r.nomeAutor || 'RH');
        return (
          <div key={r.id} className="linha-mensagem" style={{ justifyContent: isColab ? 'flex-end' : 'flex-start' }}>
            {!isColab && <Avatar fotoUrl={r.autorFotoUrl} nome={nomeAvatar} size={28} />}
            <div className={`bolha ${r.autor}`}>
              <div className="autor">
                {isColab ? 'Você' : (r.nomeAutor || 'RH/DP')}
                {r.automatica && ' · resposta automática'}
              </div>
              {r.texto}
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, textAlign: 'right' }}>
                {formatarDataHora(r.data)}
              </div>
            </div>
            {isColab && <Avatar fotoUrl={perfil?.fotoUrl} nome={nomeAvatar} size={28} />}
          </div>
        );
      })}

      {s.anexos.map((a) => (
        <div key={a.id} style={{ marginTop: 6 }}>
          <a href={a.linkDrive} target="_blank" rel="noreferrer">
            📎 {a.nomeArquivo} {a.enviadoPor === 'rh' ? '(do RH)' : '(enviado por você)'}
          </a>
        </div>
      ))}

      {s.status === 'encerrada' && s.avaliacaoNota && (
        <p style={{ fontSize: 14, marginTop: 8 }}>
          Sua avaliação:{' '}
          <span style={{ color: '#f5b301', fontSize: 18 }}>
            {'★'.repeat(s.avaliacaoNota)}{'☆'.repeat(5 - s.avaliacaoNota)}
          </span>
        </p>
      )}

      {s.status !== 'encerrada' && !avaliando && (
        <div style={{ marginTop: 12 }}>
          <form onSubmit={enviarMensagem}>
            <textarea rows={2} placeholder="Responder..." value={texto} onChange={(e) => setTexto(e.target.value)} />
            <UploadAnexo onUploaded={(a) => setAnexosNovos([...anexosNovos, a])} />
            {anexosNovos.map((a, i) => <div key={i} style={{ fontSize: 13, color: 'var(--success)' }}>✓ {a.nomeArquivo}</div>)}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit">Enviar</button>
              <button type="button" className="secundario" onClick={() => setAvaliando(true)}>
                Encerrar e avaliar
              </button>
            </div>
          </form>
        </div>
      )}

      {avaliando && (
        <form onSubmit={encerrarComAvaliacao} style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <label>Avalie o atendimento</label>
          <div style={{ display: 'flex', gap: 6, fontSize: 30, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                onClick={() => setNota(n)}
                style={{ cursor: 'pointer', color: n <= nota ? '#f5b301' : '#d1d5db', lineHeight: 1 }}
              >
                ★
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit">Confirmar encerramento</button>
            <button type="button" className="secundario" onClick={() => setAvaliando(false)}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function MinhasSolicitacoes() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [comunicados, setComunicados] = useState([]);
  const [perfil, setPerfil] = useState(null);

  function carregar() {
    fetch('/api/solicitacoes').then((r) => r.json()).then(setSolicitacoes);
    fetch('/api/comunicados').then((r) => r.json()).then(setComunicados);
    fetch('/api/perfil').then((r) => r.json()).then(setPerfil);
    fetch('/api/solicitacoes/marcar-vistas', { method: 'POST' });
  }

  useEffect(() => { carregar(); }, []);

  return (
    <div>
      <NavColaborador />
      <BotaoVoltar />
      <h2>Minhas solicitações</h2>

      {solicitacoes.length === 0 && <p>Você ainda não abriu nenhuma solicitação.</p>}

      {solicitacoes.map((s) => (
        <CartaoSolicitacao key={s.id} s={s} onAtualizar={carregar} perfil={perfil} />
      ))}

      {comunicados.length > 0 && (
        <>
          <h3 style={{ marginTop: 32 }}>Comunicados recebidos do RH</h3>
          {comunicados.map((c) => (
            <div key={c.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>{c.assunto}</b>
                {!c.lido && <span className="badge aberta">Novo</span>}
              </div>
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
