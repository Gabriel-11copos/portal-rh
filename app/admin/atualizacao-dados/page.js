'use client';
import { useEffect, useMemo, useState } from 'react';
import BotaoVoltar from '../../components/BotaoVoltar';

// <ajudantes>
// Datas de calendário (prazo) ficam à meia-noite UTC; já as de "quando" são instantes: cada uma lida do jeito certo.
const dataCal = (v) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const dataHora = (v) => new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function formatarTelefone(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatarCep(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

function textoEndereco(e) {
  if (!e) return '';
  const rua = [e.logradouro, e.numero].filter(Boolean).join(', ');
  return [rua, e.complemento, e.bairro, [e.cidade, e.uf].filter(Boolean).join('/'), e.cep ? `CEP ${formatarCep(e.cep)}` : ''].filter(Boolean).join(' · ');
}

// Uma célula da planilha: protege contra "fórmulas" digitadas por alguém (=, +, -, @) e escapa aspas e ponto e vírgula.
function celulaCsv(v) {
  let s = String(v == null ? '' : v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Planilha com todo mundo: quem atualizou, quem teve baixa e quem falta. Separada por ponto e vírgula (abre certo no Excel em português).
function gerarCsv({ concluidos, pendentes }) {
  const cab = ['Nome', 'Loja', 'CPF', 'Situação', 'Quando', 'Telefone', 'E-mail', 'CEP', 'Rua', 'Número', 'Complemento', 'Bairro', 'Cidade', 'UF', 'Baixa dada por', 'Motivo da baixa'];
  const linhas = [cab.join(';')];
  for (const c of concluidos) {
    const e = c.endereco || {};
    linhas.push([c.nome, c.loja, c.cpf, c.origem === 'colaborador' ? 'Atualizou' : 'Baixa do RH', dataHora(c.quando), formatarTelefone(c.telefone), c.email, formatarCep(e.cep), e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf, c.baixaPor, c.baixaMotivo].map(celulaCsv).join(';'));
  }
  for (const p of pendentes) linhas.push([p.nome, p.loja, '', 'Pendente'].map(celulaCsv).join(';'));
  return `\ufeff${linhas.join('\r\n')}\r\n`;
}
// </ajudantes>

function Barra({ feitos, total }) {
  const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;
  return (
    <div style={{ background: 'var(--border)', borderRadius: 6, height: 10, overflow: 'hidden', margin: '6px 0' }} aria-label={`${pct}%`}>
      <div style={{ width: `${pct}%`, height: '100%', background: feitos === total ? 'var(--success)' : 'var(--warning)' }} />
    </div>
  );
}

export default function AtualizacaoDadosAdmin() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState({ titulo: '', mensagem: '', prazo: '' });
  const [busca, setBusca] = useState('');
  const [baixando, setBaixando] = useState(null);     // { id, motivo }
  const [abertos, setAbertos] = useState({});

  async function carregar() {
    try {
      const r = await fetch('/api/atualizacao-dados-admin');
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Não foi possível carregar.');
      setDados(j);
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar.');
    }
  }
  useEffect(() => { carregar(); }, []);

  async function enviar(url, corpo) {
    setErro(''); setMsg('');
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo || {}) });
    const j = await r.json();
    if (!r.ok) { setErro(j.erro || 'Não foi possível concluir.'); return null; }
    return j;
  }

  async function liberar(e) {
    e.preventDefault();
    if (!window.confirm('Liberar a atualização de dados para TODOS os colaboradores? Quem ainda não fez será avisado toda vez que entrar no portal.')) return;
    const ok = await enviar('/api/atualizacao-dados-admin', form);
    if (ok) { setForm({ titulo: '', mensagem: '', prazo: '' }); setMsg('Atualização liberada. Os colaboradores já estão sendo avisados.'); carregar(); }
  }

  async function encerrar() {
    if (!window.confirm('Encerrar a atualização? Os colaboradores que não fizeram deixam de ser avisados.')) return;
    const ok = await enviar('/api/atualizacao-dados-admin/encerrar');
    if (ok) { setMsg('Atualização encerrada.'); setBaixando(null); carregar(); }
  }

  async function baixa(colaboradorId, acao, motivo) {
    const ok = await enviar('/api/atualizacao-dados-admin/baixa', { colaboradorId, acao, motivo });
    setBaixando(null);
    if (ok) setMsg(acao === 'dar' ? 'Baixa registrada. O colaborador não será mais avisado.' : 'Baixa desfeita. O colaborador volta a ser avisado.');
    carregar();   // se outro usuário do RH mexeu antes, a lista se atualiza
  }

  function baixarPlanilha() {
    const blob = new Blob([gerarCsv(dados)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `atualizacao-de-dados-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const pendentesPorLoja = useMemo(() => {
    if (!dados) return [];
    const q = busca.trim().toLowerCase();
    const filtrados = dados.pendentes.filter((p) => !q || p.nome.toLowerCase().includes(q));
    const grupos = new Map();
    for (const p of filtrados) { if (!grupos.has(p.loja)) grupos.set(p.loja, []); grupos.get(p.loja).push(p); }
    return [...grupos.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'pt-BR'));
  }, [dados, busca]);

  const ativa = dados && dados.ativa;
  const t = dados && dados.totais;

  return (
    <div>
      <BotaoVoltar />
      <h2>Atualização de dados pessoais</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>
        Libere de vez em quando para os colaboradores atualizarem telefone, e-mail, endereço e comprovante de residência.
        Enquanto estiver liberada, quem ainda não fez é avisado toda vez que entra no portal, até fazer ou até você dar baixa.
      </p>
      {erro && <div className="erro">{erro}</div>}
      {msg && <p style={{ fontSize: 13, color: 'var(--success)' }}>{msg}</p>}
      {dados && dados.semTabela && <div className="erro">As tabelas desta função ainda não foram criadas no banco. Rode o arquivo SQL da atualização de dados.</div>}

      {dados && !ativa && !dados.semTabela && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Liberar uma atualização</h3>
          <form onSubmit={liberar}>
            <label>Título (o colaborador vê)</label>
            <input value={form.titulo} maxLength={80} placeholder="Atualização de dados pessoais" onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            <label>Mensagem (opcional)</label>
            <textarea rows={3} value={form.mensagem} maxLength={400} placeholder="Ex: Precisamos atualizar seus dados para o cadastro do benefício." onChange={(e) => setForm({ ...form, mensagem: e.target.value })} />
            <label>Prazo (opcional, só informativo)</label>
            <input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} style={{ maxWidth: 200 }} />
            <button type="submit">Liberar para todos</button>
          </form>
        </div>
      )}

      {ativa && (
        <>
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <b>📋 {ativa.titulo}</b> <span className="badge aberta">Liberada</span>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Liberada em {dataHora(ativa.criadaEm)}{ativa.criadaPor ? ` por ${ativa.criadaPor}` : ''}{ativa.prazo ? ` · prazo ${dataCal(ativa.prazo)}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" className="secundario" onClick={baixarPlanilha}>⬇ Baixar planilha</button>
                <button type="button" className="secundario" onClick={encerrar}>Encerrar atualização</button>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 15 }}>
              <b>{t.atualizaram + t.baixas} de {t.ativos}</b> colaboradores em dia
              {t.pendentes > 0 ? <span> · <b style={{ color: 'var(--warning)' }}>faltam {t.pendentes}</b></span> : <span> · ✓ todos em dia</span>}
            </div>
            <Barra feitos={t.atualizaram + t.baixas} total={t.ativos} />
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{t.atualizaram} atualizaram sozinhos · {t.baixas} com baixa do RH · {t.pendentes} pendentes</div>
          </div>

          <h3>Pendentes {t.pendentes > 0 && <span className="bolinha-notificacao">{t.pendentes}</span>}</h3>
          {dados.pendentes.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Ninguém pendente. 🎉</p>}
          {dados.pendentes.length > 0 && (
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome..." style={{ maxWidth: 320 }} />
          )}
          {dados.pendentes.length > 0 && pendentesPorLoja.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Ninguém com esse nome entre os pendentes.</p>}
          {pendentesPorLoja.map(([loja, pessoas]) => (
            <details key={loja} className="card" open={!!busca || pendentesPorLoja.length === 1}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{loja} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({pessoas.length})</span></summary>
              {pessoas.map((p) => (
                <div key={p.id} style={{ padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span>{p.nome}</span>
                    {!(baixando && baixando.id === p.id) && (
                      <button type="button" className="secundario" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => setBaixando({ id: p.id, motivo: '' })}>Dar baixa</button>
                    )}
                  </div>
                  {baixando && baixando.id === p.id && (
                    <div style={{ marginTop: 6 }}>
                      <label>Motivo (opcional, só o RH vê)</label>
                      <input value={baixando.motivo} maxLength={200} placeholder="Ex: falou com o RH por telefone" onChange={(e) => setBaixando({ id: p.id, motivo: e.target.value })} />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => baixa(p.id, 'dar', baixando.motivo)}>Confirmar baixa</button>
                        <button type="button" className="secundario" onClick={() => setBaixando(null)}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </details>
          ))}

          <h3>Já em dia ({dados.concluidos.length})</h3>
          {dados.concluidos.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Ninguém ainda.</p>}
          {dados.concluidos.map((c) => (
            <div key={c.colaboradorId} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <b>{c.nome}</b> <span style={{ color: 'var(--muted)', fontSize: 13 }}>· {c.loja}</span>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{dataHora(c.quando)}</div>
                </div>
                <span className={`badge ${c.origem === 'colaborador' ? 'respondida' : 'encerrada'}`}>{c.origem === 'colaborador' ? '✓ Atualizou' : 'Baixa do RH'}</span>
              </div>
              {c.origem === 'colaborador' ? (
                <>
                  <button type="button" className="secundario" style={{ padding: '3px 10px', fontSize: 12, marginTop: 6 }} onClick={() => setAbertos({ ...abertos, [c.colaboradorId]: !abertos[c.colaboradorId] })}>
                    {abertos[c.colaboradorId] ? 'Esconder dados' : 'Ver dados'}
                  </button>
                  {abertos[c.colaboradorId] && (
                    <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
                      <div>📞 {formatarTelefone(c.telefone)}</div>
                      <div>✉️ {c.email}</div>
                      <div>🏠 {textoEndereco(c.endereco)}</div>
                      {c.comprovanteUrl && <div><a href={c.comprovanteUrl} target="_blank" rel="noreferrer">📎 Ver comprovante de residência</a></div>}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, marginTop: 6 }}>
                  Baixa dada por {c.baixaPor || 'RH'}{c.baixaMotivo ? `: ${c.baixaMotivo}` : ''}.{' '}
                  <button type="button" className="secundario" style={{ padding: '3px 10px', fontSize: 12 }} onClick={() => baixa(c.colaboradorId, 'desfazer')}>Desfazer baixa</button>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {dados && dados.historico.length > 0 && (
        <>
          <h3>Atualizações anteriores</h3>
          {dados.historico.map((h) => (
            <div key={h.id} className="card">
              <b>{h.titulo}</b>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {dataHora(h.criadaEm)}{h.encerradaEm ? ` até ${dataHora(h.encerradaEm)}` : ''} · {h.atualizaram} atualizaram · {h.baixas} com baixa
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
