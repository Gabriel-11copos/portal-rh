'use client';
import { useEffect, useState } from 'react';
import BotaoVoltar from '../../../components/BotaoVoltar';
import V from '../../../../lib/vt';

const dataHora = (d) => (d ? V.dataHoraBR(d) : '');
const centavos = (c) => (c === null || c === undefined ? '' : V.reais(c));
const MOTIVOS = { primeiro_mapeamento: 'Primeiro mapeamento', atualizacao: 'Atualização', termo_nao_optante: 'Termo de não optante' };

// Perfil de vale-transporte de UM colaborador, para o RH validar e ajudar.
export default function PerfilVT({ params }) {
  const [d, setD] = useState(null);
  const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('');
  const [nota, setNota] = useState(''); const [motivos, setMotivos] = useState({});

  async function carregar() {
    try { const r = await fetch(`/api/vt-admin/colaborador/${params.id}`); const j = await r.json(); if (!r.ok) throw new Error(j.erro || 'Não foi possível carregar.'); setD(j); }
    catch (e) { setErro(e.message || 'Não foi possível carregar.'); }
  }
  useEffect(() => { carregar(); }, []);

  async function acao(corpo, sucesso) {
    setErro(''); setAviso('');
    try {
      const r = await fetch(`/api/vt-admin/colaborador/${params.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.erro || 'Não foi possível concluir.'); return; }
      setAviso(sucesso); setNota(''); carregar();
    } catch { setErro('Sem conexão. Tente de novo.'); }
  }
  if (!d) return <div><BotaoVoltar />{erro ? <div className="erro" role="alert">{erro}</div> : <p>Carregando...</p>}</div>;
  const m = d.mapeamento; const c = d.colaborador;
  return (
    <div>
      <BotaoVoltar />
      <h2>🚌 {c.nome}</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: -8 }}>{c.cargo || 'Sem cargo'} · {c.loja} · CPF {c.cpf}</p>
      {erro && <div className="erro" role="alert">{erro}</div>}
      {aviso && <div className="card" style={{ background: 'var(--verde-pastel)' }} role="status">{aviso}</div>}

      {!m ? (
        <div className="card"><h3 style={{ marginTop: 0 }}>Ainda não preencheu</h3><p style={{ fontSize: 14 }}>Este colaborador ainda não informou o transporte. Ele vê o convite no primeiro acesso e em Meu perfil → Benefícios.</p></div>
      ) : (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0 }}>{m.usaVT ? m.modalidadeRotulo : 'Não utiliza vale-transporte'}</h3>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>informado em {dataHora(m.atualizadoEm)}</span>
          </div>
          {m.usaVT ? (
            <>
              <p style={{ fontSize: 14, margin: '8px 0' }}>{[...V.nomesDosTransportes(m.jae), ...V.nomesDosTransportes(m.riocard)].join(' + ') || '—'}</p>
              {m.modalidade === 'diferente' ? <p style={{ fontSize: 14 }}>Caso descrito: “{m.casoDiferente}”</p> : m.valores && m.valores.dia !== null && <p style={{ fontSize: 14 }}>{centavos(m.valores.viagem)} por viagem · <b>{centavos(m.valores.dia)} por dia</b> · {centavos(m.valores.mensal)} em {String(m.valores.mes).padStart(2, '0')}/{m.valores.ano} ({m.valores.diasNoMes} dias)</p>}
              {(m.modalidade === 'riocard' || m.modalidade === 'jae_riocard') && <p style={{ fontSize: 14 }}><b>BUI:</b> {V.BUI[m.buiAtivo] || 'Sem resposta'}{m.numeroRiocard ? ` · Riocard nº ${m.numeroRiocard}` : ''}</p>}
              {m.origem && <p style={{ fontSize: 14 }}><b>De:</b> {V.enderecoEmTexto(m.origem)}<br /><b>Para:</b> {d.unidade && d.unidade.endereco ? d.unidade.endereco : 'unidade sem endereço fixo'}</p>}
              {d.links && <p style={{ fontSize: 14 }}><a href={d.links.ida} target="_blank" rel="noreferrer">🗺️ Trajeto de ida</a> · <a href={d.links.volta} target="_blank" rel="noreferrer">🗺️ Trajeto de volta</a></p>}
            </>
          ) : (
            <p style={{ fontSize: 14 }}>Termo aceito em {dataHora(m.termo && m.termo.aceitoEm)}. <a href={`/api/vt-admin/termo?colaboradorId=${c.id}`} target="_blank" rel="noreferrer">📄 Abrir o termo (PDF)</a></p>
          )}

          {m.alertasAbertos.length > 0 && (
            <div style={{ background: '#fff8e1', border: '1px solid var(--warning)', borderRadius: 8, padding: 10, margin: '10px 0' }}>
              <b>⚠️ Alertas:</b> {m.alertasAbertos.map((a) => V.ROTULO_ALERTA[a] || a).join(' · ')}
              <div style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0' }}>Valide com o colaborador e anote o que foi feito.</div>
              <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="O que foi feito? (opcional)" />
              <button type="button" onClick={() => acao({ acao: 'resolver', nota }, 'Alerta marcado como resolvido.')}>Marcar como resolvido</button>
            </div>
          )}
          {m.alertaResolvido && m.alertasAbertos.length === 0 && m.alertas.length > 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>✅ Alerta resolvido por {m.alertaResolvido.por} em {dataHora(m.alertaResolvido.em)}{m.alertaResolvido.nota ? `: ${m.alertaResolvido.nota}` : ''}</p>}
          <button type="button" className="secundario" onClick={() => { if (window.confirm('Liberar o preenchimento para este colaborador? Ele será avisado por WhatsApp.')) acao({ acao: 'reabrir' }, m.reaberto ? 'Já estava liberado; avisamos de novo.' : 'Preenchimento liberado.'); }}>{m.reaberto ? 'Reenviar aviso de preenchimento' : 'Liberar novo preenchimento'}</button>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>💳 Saldos informados</h3>
        {d.saldos.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhum saldo informado ainda.</p>}
        {d.saldos.map((s) => (
          <div key={s.id} style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
            <b>{s.coleta || 'Coleta'}</b> <span style={{ fontSize: 12, color: 'var(--muted)' }}>· {dataHora(s.informadoEm)}</span> {s.status === 'refazer' && <span className="badge aberta">Nova foto pedida</span>}
            <div style={{ fontSize: 14 }}>{s.jaeCentavos !== null ? `Jaé ${centavos(s.jaeCentavos)} ` : ''}{s.riocardCentavos !== null ? `· Riocard ${centavos(s.riocardCentavos)}` : ''}</div>
            <div style={{ fontSize: 13 }}>{s.anexos.map((a, i) => <a key={i} href={a.url} target="_blank" rel="noreferrer" style={{ marginRight: 10 }}>📎 {a.nome}</a>)}</div>
            {s.status === 'refazer' && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Motivo: {s.motivoRefazer}</div>}
            {s.coletaAtiva && s.status !== 'refazer' && (
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <input value={motivos[s.id] || ''} onChange={(e) => setMotivos({ ...motivos, [s.id]: e.target.value })} placeholder="O que precisa ser refeito?" style={{ maxWidth: 280 }} />
                <button type="button" className="secundario" onClick={() => { const m = String(motivos[s.id] || '').trim(); if (m.length < 3) { setAviso(''); setErro('Explique o que precisa ser refeito (de 3 a 200 letras).'); return; } acao({ acao: 'pedir_nova_foto', saldoId: s.id, motivo: m }, 'Pedimos a nova foto por WhatsApp.'); }}>Pedir nova foto</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>🕘 Histórico</h3>
        {d.historico.length === 0 && <p style={{ color: 'var(--muted)' }}>Sem registros.</p>}
        {d.historico.map((h) => (
          <div key={h.id} style={{ fontSize: 13, borderTop: '1px solid var(--border)', padding: '6px 0' }}>
            <b>{MOTIVOS[h.motivo] || h.motivo}</b> · {dataHora(h.em)} · por {h.autor === 'colaborador' ? 'o colaborador' : h.autor.replace(/^rh:/, 'RH: ')}
            <div style={{ color: 'var(--muted)' }}>{h.dados.usaVT === false ? 'Não utiliza' : `${V.MODALIDADES[h.dados.modalidade] || ''} · ${[...V.nomesDosTransportes(h.dados.transportesJae || []), ...V.nomesDosTransportes(h.dados.transportesRiocard || [])].join(' + ')}${h.dados.valorDiaCentavos ? ` · ${centavos(h.dados.valorDiaCentavos)}/dia` : ''}`}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
