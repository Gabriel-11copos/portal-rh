'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import BotaoVoltar from '../../../components/BotaoVoltar';

const dataHora = (v) => new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function Barra({ feitos, total }) {
  const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;
  return (
    <div style={{ background: 'var(--border)', borderRadius: 6, height: 8, overflow: 'hidden', margin: '4px 0' }} aria-label={`${pct}%`}>
      <div style={{ width: `${pct}%`, height: '100%', background: feitos === total ? 'var(--success)' : 'var(--warning)' }} />
    </div>
  );
}

export default function HistoricoContracheques() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [soPendentes, setSoPendentes] = useState(false);

  async function carregar(tipo, competencia) {
    setErro('');
    try {
      const qs = tipo ? `?tipo=${encodeURIComponent(tipo)}&competencia=${encodeURIComponent(competencia)}` : '';
      const r = await fetch(`/api/contracheques/historico${qs}`);
      const json = await r.json();
      if (!r.ok) throw new Error(json.erro || 'Não foi possível carregar o histórico.');
      setDados(json);
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar o histórico.');
    }
  }
  useEffect(() => { carregar(); }, []);

  const escolhido = dados && dados.escolhido;
  const chave = escolhido ? `${escolhido.tipo}|${escolhido.competencia}` : '';
  const painel = dados && dados.painel;
  const lojas = painel ? painel.lojas.filter((l) => !soPendentes || l.faltam.length > 0) : [];

  return (
    <div>
      <BotaoVoltar />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Histórico de documentos enviados</h2>
        <Link href="/admin/contracheques" style={{ fontSize: 13, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 8, textDecoration: 'none', whiteSpace: 'nowrap' }}>🧾 Enviar contracheques</Link>
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Escolha o documento e a competência para ver, loja por loja, quem já recebeu e quem ainda falta.
        Vale para tudo que foi enviado, inclusive pela tela antiga.
      </p>
      {erro && <div className="erro">{erro}</div>}
      {!dados && !erro && <p style={{ color: 'var(--muted)' }}>Carregando...</p>}

      {dados && dados.combos.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhum documento enviado ainda.</p>}

      {dados && dados.combos.length > 0 && (
        <div className="card">
          <label>Documento e competência</label>
          <select value={chave} onChange={(e) => { const [t, c] = e.target.value.split('|'); carregar(t, c); }}>
            {dados.combos.map((c) => (
              <option key={`${c.tipo}|${c.competencia}`} value={`${c.tipo}|${c.competencia}`}>
                {c.tipo} · {c.competencia} ({c.enviados} enviado{c.enviados === 1 ? '' : 's'})
              </option>
            ))}
          </select>
        </div>
      )}

      {painel && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{escolhido.tipo} · {escolhido.competencia}</h3>
          <div style={{ fontSize: 15 }}>
            <b style={{ color: painel.totais.faltam === 0 ? 'var(--success)' : 'inherit' }}>{painel.totais.enviados} de {painel.totais.total}</b> colaboradores ativos já receberam
            {painel.totais.faltam > 0 ? <span> · <b style={{ color: 'var(--warning)' }}>faltam {painel.totais.faltam}</b></span> : <span> · ✓ todos receberam</span>}
          </div>
          <Barra feitos={painel.totais.enviados} total={painel.totais.total} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
            Mostrar só as lojas com pendência
          </label>
          {painel.totais.deInativos > 0 && (
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 0' }}>
              {painel.totais.deInativos} documento(s) deste mês são de colaboradores que já saíram (não entram na conta).
            </p>
          )}
        </div>
      )}

      {painel && lojas.map((l) => (
        <div key={l.loja} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <b>{l.loja}</b>
            <span className={`badge ${l.faltam.length === 0 ? 'respondida' : 'aberta'}`}>
              {l.faltam.length === 0 ? '✓ Completa' : `Faltam ${l.faltam.length}`}
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>{l.enviados.length} de {l.total} enviados</div>
          <Barra feitos={l.enviados.length} total={l.total} />
          {l.faltam.length > 0 && (
            <details open style={{ marginTop: 6 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14, color: 'var(--warning)' }}>Faltam enviar ({l.faltam.length})</summary>
              <ul style={{ fontSize: 13, margin: '6px 0' }}>{l.faltam.map((p) => <li key={p.id}>{p.nome}</li>)}</ul>
            </details>
          )}
          {l.enviados.length > 0 && (
            <details style={{ marginTop: 6 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14, color: 'var(--success)' }}>Já enviados ({l.enviados.length})</summary>
              <ul style={{ fontSize: 13, margin: '6px 0' }}>{l.enviados.map((p) => <li key={p.id}>{p.nome} <span style={{ color: 'var(--muted)' }}>· {dataHora(p.quando)}</span></li>)}</ul>
            </details>
          )}
        </div>
      ))}
      {painel && painel.totais.faltam > 0 && (
        <p style={{ fontSize: 12, color: 'var(--muted)' }}>
          Quem aparece como "falta" pode não ter contracheque neste mês (por exemplo, admitido depois do fechamento da folha ou afastado).
        </p>
      )}

      {dados && dados.lotes.length > 0 && (
        <>
          <h3>Envios feitos pelo portal</h3>
          {dados.lotes.map((l) => {
            const feitos = (l.criados || 0) + (l.substituidos || 0);
            const completo = feitos >= l.total;
            return (
              <div key={l.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div>
                    <b>{l.loja}</b> <span style={{ color: 'var(--muted)', fontSize: 13 }}>· {l.tipo} · {l.competencia}</span>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{dataHora(l.criadoEm)}{l.enviadoPor ? ` · por ${l.enviadoPor}` : ''}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className={`badge ${completo ? 'respondida' : 'aberta'}`}>{completo ? '✓ Concluído' : `Incompleto (${l.total - feitos} não enviado${l.total - feitos === 1 ? '' : 's'})`}</span>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {feitos} de {l.total}{l.substituidos > 0 ? ` · ${l.substituidos} substituído${l.substituidos === 1 ? '' : 's'}` : ''}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
