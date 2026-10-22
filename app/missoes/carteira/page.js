'use client';
import { useEffect, useState } from 'react';
import NavColaborador from '../../components/NavColaborador';
import BotaoVoltar from '../../components/BotaoVoltar';

// <regras>
const POR_PAGINA = 15;

// "1 Tampinha", "5 Tampinhas"
function quantidade(config, n) {
  return `${n} ${Math.abs(n) === 1 ? config.nomeSingular : config.nomePlural}`;
}

function reais(centavos) {
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataHora(valor) {
  return valor ? new Date(valor).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
}

// Por que o botão "Trocar" está desligado (ou null se pode trocar).
function motivoDeNaoTrocar(premio, saldo) {
  if (premio.esgotado) return 'Esgotado';
  if (saldo < premio.custo) return `Faltam ${premio.custo - saldo}`;
  return null;
}

const COR_STATUS = { pendente: 'var(--warning)', entregue: 'var(--success)', recusado: 'var(--danger)' };
// </regras>

export default function Carteira() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [trocando, setTrocando] = useState(null);   // id do prêmio em troca
  const [mostrar, setMostrar] = useState(POR_PAGINA);

  async function carregar() {
    try {
      const r = await fetch('/api/moedas');
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Não foi possível carregar a carteira.');
      setDados(j);
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar a carteira.');
    }
  }
  useEffect(() => { carregar(); }, []);

  async function trocar(premio) {
    if (!window.confirm(`Trocar ${quantidade(dados.config, premio.custo)} por "${premio.nome}"? As moedas saem do seu saldo agora e o RH entrega o prêmio.`)) return;
    setTrocando(premio.id); setAviso(''); setErro('');
    try {
      const r = await fetch('/api/moedas/resgatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ premioId: premio.id }) });
      const j = await r.json();
      if (!r.ok) { setErro(j.erro || 'Não foi possível trocar agora.'); }
      else { setAviso('Pedido enviado! O RH vai entregar e você acompanha em "Minhas trocas".'); window.dispatchEvent(new Event('moedas-atualizadas')); }
      await carregar();
    } catch (e) {
      setErro(e.message || 'Não foi possível trocar agora.');
    } finally {
      setTrocando(null);
    }
  }

  const cfg = dados && dados.habilitada ? dados.config : null;
  return (
    <div>
      <NavColaborador />
      <BotaoVoltar />
      <h2>Minha carteira</h2>
      {!dados && !erro && <p style={{ color: 'var(--muted)' }}>Carregando...</p>}
      {erro && <div className="erro">{erro}</div>}
      {aviso && <p style={{ fontSize: 13, color: 'var(--success)' }}>{aviso}</p>}
      {dados && !dados.habilitada && (
        <div className="card"><p style={{ margin: 0 }}>O programa de moedas ainda não começou. Quando começar, o seu saldo, o extrato e os prêmios aparecem aqui.</p></div>
      )}

      {cfg && (
        <>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Seu saldo</div>
            <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--verde)' }}><span aria-hidden="true">{cfg.simbolo}</span> {dados.saldo}</div>
            <div style={{ fontSize: 14 }}>{dados.saldo === 1 ? cfg.nomeSingular : cfg.nomePlural}</div>
          </div>

          {dados.comoGanhar.length > 0 && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Como ganhar {cfg.nomePlural}</h3>
              {dados.comoGanhar.map((g) => (
                <div key={g.rotulo} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 14 }}>
                  <span>{g.rotulo}</span><b style={{ color: 'var(--success)', whiteSpace: 'nowrap' }}>+{g.valor}</b>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Trocar por prêmios</h3>
            {dados.premios.length === 0 && <p style={{ color: 'var(--muted)', margin: 0 }}>Ainda não há prêmios disponíveis.</p>}
            {dados.premios.map((p) => {
              const motivo = motivoDeNaoTrocar(p, dados.saldo);
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ minWidth: 0 }}>
                    <b>{p.nome}</b>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {p.tipo === 'zig' && p.valorCentavos ? `${reais(p.valorCentavos)} de saldo no Zig` : p.tipoRotulo}
                      {p.estoque !== null && !p.esgotado ? ` · restam ${p.estoque}` : ''}
                    </div>
                    {p.descricao && <div style={{ fontSize: 13 }}>{p.descricao}</div>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700 }}>{cfg.simbolo} {p.custo}</div>
                    <button type="button" disabled={!!motivo || trocando === p.id} onClick={() => trocar(p)} style={{ padding: '4px 12px', fontSize: 13, opacity: motivo ? 0.4 : 1, cursor: motivo ? 'not-allowed' : 'pointer' }}>
                      {trocando === p.id ? 'Trocando...' : 'Trocar'}
                    </button>
                    {motivo && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{motivo}</div>}
                  </div>
                </div>
              );
            })}
          </div>

          {dados.resgates.length > 0 && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Minhas trocas</h3>
              {dados.resgates.map((x) => (
                <div key={x.id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                    <b>{x.premioNome}</b><span style={{ color: COR_STATUS[x.status], fontWeight: 700, fontSize: 13 }}>{x.statusRotulo}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{quantidade(cfg, x.custo)} · {dataHora(x.criadoEm)}</div>
                  {x.status === 'recusado' && x.motivoRecusa && <div style={{ fontSize: 13, color: 'var(--danger)' }}>Motivo: {x.motivoRecusa}</div>}
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Extrato</h3>
            {dados.extrato.length === 0 && <p style={{ color: 'var(--muted)', margin: 0 }}>Você ainda não tem movimentos.</p>}
            {dados.extrato.slice(0, mostrar).map((e) => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', borderTop: '1px solid var(--border)', fontSize: 14 }}>
                <span>{e.descricao}<span style={{ display: 'block', fontSize: 12, color: 'var(--muted)' }}>{e.tipoRotulo} · {dataHora(e.criadoEm)}</span></span>
                <b style={{ color: e.valor >= 0 ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>{e.valor > 0 ? '+' : ''}{e.valor}</b>
              </div>
            ))}
            {dados.extrato.length > mostrar && <button type="button" className="secundario" style={{ marginTop: 8 }} onClick={() => setMostrar(mostrar + POR_PAGINA)}>Ver mais</button>}
          </div>
        </>
      )}
    </div>
  );
}
