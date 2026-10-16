'use client';
import { useEffect, useState } from 'react';
import NavColaborador from '../components/NavColaborador';
import BotaoVoltar from '../components/BotaoVoltar';
import IconeSelo from '../components/IconeSelo';

// <ajudantes>
const ESTADOS = {
  disponivel: { texto: 'Disponível', classe: 'aberta' },
  em_analise: { texto: 'Em análise', classe: 'em_analise' },
  concluida: { texto: 'Concluída ✓', classe: 'respondida' },
  encerrada: { texto: 'Encerrada', classe: 'encerrada' },
};
const STATUS_PEDIDO = { pendente: 'Em análise pelo RH', aprovada: 'Aprovada ✓', recusada: 'Não aprovada' };

// Datas de calendário ficam guardadas à meia-noite UTC: ler em UTC evita o "um dia a menos".
function dataCal(v) {
  return new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
function dataHora(v) {
  return new Date(v).toLocaleDateString('pt-BR');
}
// </ajudantes>

export default function Missoes() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [aberta, setAberta] = useState(null);       // id da missão com o formulário aberto
  const [referencia, setReferencia] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [aviso, setAviso] = useState('');

  async function carregar(marcarVistas) {
    try {
      const r = await fetch('/api/missoes');
      const json = await r.json();
      if (!r.ok || !Array.isArray(json.missoes)) throw new Error(json.erro || 'Não foi possível carregar as missões.');
      setDados(json);
      if (marcarVistas) fetch('/api/missoes/marcar-vistas', { method: 'POST' });   // tira a bolinha da tela inicial
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar as missões.');
    }
  }
  useEffect(() => { carregar(true); }, []);

  function abrirFormulario(id) {
    setAberta(aberta === id ? null : id);
    setReferencia(''); setMensagem(''); setErroForm(''); setAviso('');
  }

  async function registrar(m) {
    setEnviando(true);
    setErroForm('');
    try {
      const r = await fetch(`/api/missoes/${m.id}/pedido`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referencia, mensagem }),
      });
      const json = await r.json();
      if (!r.ok) { setErroForm(json.erro || 'Não foi possível registrar.'); return; }
      setAberta(null);
      setAviso('Pedido enviado! O RH vai analisar e você vê o resultado aqui.');
      await carregar(false);
    } catch (e) {
      setErroForm(e.message || 'Não foi possível registrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <NavColaborador />
      <BotaoVoltar />
      <h2>Missões</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>
        Cumpra missões e ganhe selos e recompensas. Os selos aparecem em "Minhas conquistas".
      </p>

      {!dados && !erro && <p style={{ color: 'var(--muted)' }}>Carregando...</p>}
      {erro && <div className="erro">{erro}</div>}
      {aviso && <p style={{ fontSize: 13, color: 'var(--success)' }}>{aviso}</p>}
      {dados && dados.missoes.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhuma missão aberta no momento.</p>}

      {dados && dados.missoes.map((m) => {
        const est = ESTADOS[m.estado] || ESTADOS.disponivel;
        return (
          <div key={m.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <b>🎯 {m.titulo}</b>
              <span className={`badge ${est.classe}`}>{est.texto}</span>
            </div>
            {m.descricao && <p style={{ fontSize: 14, whiteSpace: 'pre-wrap', margin: '8px 0' }}>{m.descricao}</p>}

            <div style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              {m.prazo && <span>⏳ Até {dataCal(m.prazo)}</span>}
              {m.selo && <span><IconeSelo icone={m.selo.icone} tamanho={18} /> Selo: <b>{m.selo.nome}</b></span>}
              {m.recompensaTexto && <span>🎁 {m.recompensaTexto}</span>}
            </div>
            {m.modo === 'selo' && m.estado !== 'concluida' && m.selo && (
              <p style={{ fontSize: 13, margin: '8px 0 0' }}>Esta missão se cumpre sozinha quando você ganhar o selo <b>{m.selo.nome}</b>.</p>
            )}

            {m.pedidos.length > 0 && (
              <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                {m.pedidos.map((p) => (
                  <div key={p.id} style={{ fontSize: 13, padding: '4px 0' }}>
                    <b>{STATUS_PEDIDO[p.status] || p.status}</b>
                    {p.novo && <span className="badge aberta" style={{ marginLeft: 6 }}>Novo</span>}
                    {p.referencia && <span> · {m.rotuloReferencia}: {p.referencia}</span>}
                    <span style={{ color: 'var(--muted)' }}> · {dataHora(p.criadoEm)}</span>
                    {p.status === 'recusada' && p.motivoRecusa && <div style={{ color: 'var(--danger)' }}>Motivo: {p.motivoRecusa}</div>}
                    {p.status === 'aprovada' && p.recompensaPendente && <div style={{ color: 'var(--warning)' }}>🎁 Sua recompensa será entregue pelo RH.</div>}
                  </div>
                ))}
              </div>
            )}

            {m.podeEnviar && (
              <div style={{ marginTop: 10 }}>
                {aberta !== m.id ? (
                  <button type="button" onClick={() => abrirFormulario(m.id)}>
                    {m.repetivel && m.pedidos.length > 0 ? 'Registrar outra' : 'Registrar que cumpri'}
                  </button>
                ) : (
                  <div>
                    {m.rotuloReferencia && (
                      <>
                        <label>{m.rotuloReferencia}</label>
                        <input value={referencia} maxLength={100} onChange={(e) => setReferencia(e.target.value)} />
                      </>
                    )}
                    <label>Mensagem para o RH (opcional)</label>
                    <textarea rows={3} value={mensagem} maxLength={300} onChange={(e) => setMensagem(e.target.value)} />
                    {erroForm && <div className="erro">{erroForm}</div>}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => registrar(m)} disabled={enviando}>{enviando ? 'Enviando...' : 'Enviar'}</button>
                      <button type="button" className="secundario" onClick={() => abrirFormulario(m.id)}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
