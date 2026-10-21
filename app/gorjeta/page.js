'use client';
import { useEffect, useState } from 'react';
import NavColaborador from '../components/NavColaborador';
import BotaoVoltar from '../components/BotaoVoltar';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dinheiro = (c) => brl.format(c / 100);
// Datas de calendário são guardadas à meia-noite UTC: ler em UTC evita o "um dia a menos".
const dataCal = (v) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

// <extrato>
// Enquanto o período é parcial, atrasos, faltas e redistribuição mostram EM APURAÇÃO
// (ainda podem mudar até o fechamento do ciclo).
function Linha({ rotulo, nota, detalhe, centavos, sinal, forte, cor, emApuracao }) {
  const texto = emApuracao ? 'EM APURAÇÃO' : (centavos === 0 ? '—' : `${sinal && centavos > 0 ? '+' : ''}${dinheiro(centavos)}`);
  const estiloValor = emApuracao
    ? { color: 'var(--warning)', fontWeight: 700, fontSize: 12, letterSpacing: 0.5, whiteSpace: 'nowrap' }
    : { color: cor || 'inherit', whiteSpace: 'nowrap' };
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0',
      borderTop: '1px solid var(--border)', fontWeight: forte ? 700 : 400, fontSize: 14,
    }}>
      <span>
        {rotulo}
        {nota && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {nota}</span>}
        {(detalhe || []).map((linha) => <span key={linha} style={{ display: 'block', color: 'var(--muted)', fontWeight: 400, fontSize: 12, marginTop: 2 }}>{linha}</span>)}
      </span>
      <span style={estiloValor}>{texto}</span>
    </div>
  );
}

// A retenção é definida pelo Acordo Coletivo com o SIGABAM (vigente 2026/2028): o percentual é fixo, não calculado.
const RETENCAO_PERCENTUAL = 33;
const RETENCAO_DETALHE = [
  'Conforme Acordo Coletivo com o SIGABAM, vigente entre 2026/2028.',
  'Retenção para fins de encargos previdenciários e sociais.',
];

function Extrato({ g }) {
  const parcial = g.situacao !== 'fechado';
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {/* marca d'água: deixa claro, mesmo em print de tela, que o valor ainda não é o definitivo */}
      {parcial && (
        <div aria-hidden="true" data-marca="parcial" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', userSelect: 'none', zIndex: 1 }}>
          <span style={{ transform: 'rotate(-24deg)', fontSize: 'clamp(40px, 14vw, 84px)', fontWeight: 800, letterSpacing: 4, color: 'var(--warning)', opacity: 0.17, whiteSpace: 'nowrap' }}>PARCIAL</span>
        </div>
      )}
      <Linha rotulo="Gorjeta apuração" centavos={g.apuracao} />
      <Linha
        rotulo="Atrasos"
        nota={!parcial && g.atrasosQtd > 0 ? plural(g.atrasosQtd, 'ocorrência', 'ocorrências') : null}
        centavos={g.valorAtrasos}
        cor={g.valorAtrasos < 0 ? 'var(--danger)' : null}
        emApuracao={parcial}
      />
      <Linha
        rotulo="Faltas injustificadas"
        nota={!parcial && g.faltasQtd > 0 ? plural(g.faltasQtd, 'falta', 'faltas') : null}
        centavos={g.valorFaltas}
        cor={g.valorFaltas < 0 ? 'var(--danger)' : null}
        emApuracao={parcial}
      />
      <Linha
        rotulo="Redistribuição"
        centavos={g.redistribuicao}
        sinal
        cor={g.redistribuicao > 0 ? 'var(--success)' : null}
        emApuracao={parcial}
      />
      {!parcial && g.devolucao !== 0 && (
        <>
          <Linha rotulo="Gorjeta final bruta" centavos={g.brutaFinal} />
          <Linha rotulo="Devolução (teto 50%)" centavos={g.devolucao} sinal cor="var(--success)" />
        </>
      )}
      <Linha
        rotulo={`Retenção legal ${RETENCAO_PERCENTUAL}%`}
        detalhe={RETENCAO_DETALHE}
        centavos={-g.retencao}
      />
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6,
        background: 'var(--verde-pastel)', borderRadius: 12, padding: '12px 14px',
      }}>
        <span style={{ fontWeight: 700, color: 'var(--verde)' }}>{parcial ? 'Gorjeta líquida parcial' : 'Gorjeta líquida'}</span>
        <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--verde)' }}>{dinheiro(g.liquida)}</span>
      </div>
    </div>
  );
}

// </extrato>

// <evolucao>
// Evolução mês a mês, só com meses FECHADOS (o mês parcial ainda pode mudar: entra na comparação quando for fechado).
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function chaveDoMes(valor) {
  const d = new Date(valor);   // datas de calendário são guardadas à meia-noite UTC
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function rotuloDoMes(chave) {
  const [ano, mes] = chave.split('-');
  return `${MESES[Number(mes) - 1]}/${ano}`;
}

// Soma a gorjeta líquida de cada mês fechado (o mês é o do fechamento do período; várias unidades somam), do mais antigo ao mais novo.
function mesesFechados(extratos) {
  const mapa = new Map();
  for (const g of extratos || []) {
    if (g.situacao !== 'fechado') continue;
    const chave = chaveDoMes(g.periodoFim);
    mapa.set(chave, (mapa.get(chave) || 0) + g.liquida);
  }
  return [...mapa.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([chave, liquida]) => ({ chave, rotulo: rotuloDoMes(chave), liquida }));
}

// Para cada mês, quanto variou em relação ao anterior (em reais e em %).
function compararMeses(meses) {
  return meses.map((m, i) => {
    const anterior = i > 0 ? meses[i - 1] : null;
    const diferenca = anterior ? m.liquida - anterior.liquida : null;
    const percentual = anterior && anterior.liquida > 0 ? Math.round((diferenca / anterior.liquida) * 100) : null;
    return { ...m, anterior: anterior ? anterior.rotulo : null, diferenca, percentual };
  });
}
// </evolucao>

function Evolucao({ extratos }) {
  const meses = compararMeses(mesesFechados(extratos)).slice(-6);
  if (meses.length === 0) return null;   // só aparece depois que houver gorjeta fechada
  const maior = Math.max(...meses.map((m) => m.liquida), 1);
  const ultimo = meses[meses.length - 1];
  const temParcial = (extratos || []).some((g) => g.situacao !== 'fechado');
  const sinal = (n) => (n >= 0 ? '+' : '−');
  const variacao = (m) => `${sinal(m.diferenca)}${dinheiro(Math.abs(m.diferenca))}${m.percentual !== null ? ` (${sinal(m.percentual)}${Math.abs(m.percentual)}%)` : ''}`;

  return (
    <div className="card" data-secao="evolucao">
      <h3 style={{ marginTop: 0 }}>Evolução da gorjeta</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 10px' }}>Gorjeta líquida de cada mês fechado.</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
        {meses.map((m, i) => (
          <div key={m.chave} title={`${m.rotulo}: ${dinheiro(m.liquida)}`} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2, whiteSpace: 'nowrap' }}>{dinheiro(m.liquida)}</span>
            <div style={{ width: '100%', maxWidth: 48, height: Math.max(4, Math.round((m.liquida / maior) * 90)), background: i === meses.length - 1 ? 'var(--verde)' : 'var(--verde-pastel)', borderRadius: 6 }} />
            <span style={{ fontSize: 12, marginTop: 4 }}>{m.rotulo}</span>
          </div>
        ))}
      </div>
      {meses.length > 1 ? (
        <div style={{ marginTop: 12, fontSize: 14 }}>
          <b>Em {ultimo.rotulo}:</b> {dinheiro(ultimo.liquida)},{' '}
          <span style={{ color: ultimo.diferenca >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{variacao(ultimo)}</span> em relação a {ultimo.anterior}.
          {meses.slice(1, -1).length > 0 && (
            <div style={{ marginTop: 6, fontSize: 13, color: 'var(--muted)' }}>
              {meses.slice(1, -1).map((m) => <div key={m.chave}>{m.rotulo}: {variacao(m)} em relação a {m.anterior}</div>)}
            </div>
          )}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '10px 0 0' }}>A comparação entre os meses aparece quando houver pelo menos dois meses fechados.</p>
      )}
      {temParcial && <p style={{ fontSize: 12, color: 'var(--muted)', margin: '8px 0 0' }}>O mês em andamento (parcial) entra na comparação quando for fechado.</p>}
    </div>
  );
}

export default function MinhaGorjeta() {
  const [extratos, setExtratos] = useState(null);

  useEffect(() => {
    fetch('/api/gorjetas').then((r) => r.json()).then((d) => setExtratos(Array.isArray(d) ? d : []));
    fetch('/api/gorjetas/marcar-vistas', { method: 'POST' });
  }, []);

  return (
    <div>
      <NavColaborador />
      <BotaoVoltar />
      <h2>Minha gorjeta</h2>

      {extratos === null && <p style={{ color: 'var(--muted)' }}>Carregando...</p>}
      {extratos && extratos.length === 0 && (
        <p style={{ color: 'var(--muted)' }}>Nenhum extrato de gorjeta disponível ainda.</p>
      )}

      {extratos && extratos.length > 0 && <Evolucao extratos={extratos} />}

      {(extratos || []).map((g, i) => {
        const parcial = g.situacao !== 'fechado';
        return (
          <details key={g.id} open={i === 0} className="card">
            <summary style={{ cursor: 'pointer', listStyle: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <b>{dataCal(g.periodoInicio)} a {dataCal(g.periodoFim)}</b>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{g.unidade}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className={`badge ${parcial ? 'aberta' : 'respondida'}`}>{parcial ? 'Parcial' : 'Fechado'}</span>
                  <div style={{ fontWeight: 700, color: 'var(--verde)' }}>{dinheiro(g.liquida)}{parcial && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning)' }}> parcial</span>}</div>
                </div>
              </div>
            </summary>

            <div style={{ marginTop: 12 }}>
              {parcial && (
                <div role="note" style={{ border: '2px solid var(--warning)', borderRadius: 10, padding: '10px 12px', margin: '0 0 10px' }}>
                  <b style={{ color: 'var(--warning)', letterSpacing: 0.5 }}>GORJETA PARCIAL</b>
                  <div style={{ fontSize: 13, marginTop: 2 }}>
                    Valores apurados até {dataCal(g.periodoFim)}. Atrasos, faltas e redistribuição estão EM APURAÇÃO e os valores podem mudar até o fechamento do ciclo. Este não é o valor definitivo.
                  </div>
                </div>
              )}
              <Extrato g={g} />
            </div>
          </details>
        );
      })}
    </div>
  );
}
