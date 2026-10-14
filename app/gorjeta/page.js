'use client';
import { useEffect, useState } from 'react';
import NavColaborador from '../components/NavColaborador';
import BotaoVoltar from '../components/BotaoVoltar';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dinheiro = (c) => brl.format(c / 100);
// Datas de calendário são guardadas à meia-noite UTC: ler em UTC evita o "um dia a menos".
const dataCal = (v) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

function Linha({ rotulo, nota, centavos, sinal, forte, cor }) {
  const texto = centavos === 0 ? '—' : `${sinal && centavos > 0 ? '+' : ''}${dinheiro(centavos)}`;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0',
      borderTop: '1px solid var(--border)', fontWeight: forte ? 700 : 400, fontSize: 14,
    }}>
      <span>
        {rotulo}
        {nota && <span style={{ color: 'var(--muted)', fontWeight: 400 }}> · {nota}</span>}
      </span>
      <span style={{ color: cor || 'inherit', whiteSpace: 'nowrap' }}>{texto}</span>
    </div>
  );
}

function Extrato({ g }) {
  const percentual = g.valorFinal > 0 ? Math.round((g.retencao / g.valorFinal) * 100) : null;
  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

  return (
    <div>
      <Linha rotulo="Gorjeta apuração" centavos={g.apuracao} />
      <Linha
        rotulo="Atrasos"
        nota={g.atrasosQtd > 0 ? plural(g.atrasosQtd, 'ocorrência', 'ocorrências') : null}
        centavos={g.valorAtrasos}
        cor={g.valorAtrasos < 0 ? 'var(--danger)' : null}
      />
      <Linha
        rotulo="Faltas injustificadas"
        nota={g.faltasQtd > 0 ? plural(g.faltasQtd, 'falta', 'faltas') : null}
        centavos={g.valorFaltas}
        cor={g.valorFaltas < 0 ? 'var(--danger)' : null}
      />
      <Linha rotulo="Redistribuição" centavos={g.redistribuicao} sinal cor={g.redistribuicao > 0 ? 'var(--success)' : null} />
      {g.devolucao !== 0 && (
        <>
          <Linha rotulo="Gorjeta final bruta" centavos={g.brutaFinal} />
          <Linha rotulo="Devolução (teto 50%)" centavos={g.devolucao} sinal cor="var(--success)" />
        </>
      )}
      <Linha rotulo="Gorjeta final" centavos={g.valorFinal} forte />
      <Linha
        rotulo="Retenção legal"
        nota={percentual !== null ? `${percentual}%` : null}
        centavos={-g.retencao}
      />
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6,
        background: 'var(--verde-pastel)', borderRadius: 12, padding: '12px 14px',
      }}>
        <span style={{ fontWeight: 700, color: 'var(--verde)' }}>Gorjeta líquida</span>
        <span style={{ fontWeight: 700, fontSize: 20, color: 'var(--verde)' }}>{dinheiro(g.liquida)}</span>
      </div>
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
                  <div style={{ fontWeight: 700, color: 'var(--verde)' }}>{dinheiro(g.liquida)}</div>
                </div>
              </div>
            </summary>

            <div style={{ marginTop: 12 }}>
              {parcial && (
                <p style={{ fontSize: 13, color: 'var(--warning)', margin: '0 0 8px' }}>
                  Valores parciais, apurados até {dataCal(g.periodoFim)}. Podem mudar até o fechamento do período.
                </p>
              )}
              <Extrato g={g} />
            </div>
          </details>
        );
      })}
    </div>
  );
}
