'use client';
import { useEffect, useState } from 'react';
import BotaoVoltar from '../../components/BotaoVoltar';
import IconeMoeda, { usaDesenho } from '../../components/IconeMoeda';

// <regras>
// "20", "20,5", "20.50", "R$ 20,00" -> centavos (2000, 2050, 2050, 2000). Inválido: null.
function reaisParaCentavos(texto) {
  const t = String(texto == null ? '' : texto).replace(/R\$/gi, '').replace(/\s/g, '');
  const m = t.match(/^(\d{1,7})(?:[.,](\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] || '').padEnd(2, '0') || 0);
}

function centavosParaTexto(c) {
  return (c / 100).toFixed(2).replace('.', ',');
}

const PREMIO_VAZIO = { nome: '', descricao: '', custo: '', tipo: 'premio', valorReais: '', estoque: '', ativo: true };

function formDoPremio(p) {
  return { nome: p.nome, descricao: p.descricao || '', custo: String(p.custo), tipo: p.tipo, valorReais: p.valorCentavos ? centavosParaTexto(p.valorCentavos) : '', estoque: p.estoque === null || p.estoque === undefined ? '' : String(p.estoque), ativo: !!p.ativo };
}

// O que vai para o servidor (o servidor confere de novo). Devolve { erro } se faltar algo que dá para ver aqui.
function montarPremio(f) {
  const corpo = { nome: f.nome, descricao: f.descricao, custo: f.custo, tipo: f.tipo, estoque: f.estoque === '' ? null : f.estoque, ativo: !!f.ativo };
  if (f.tipo === 'zig') {
    const c = reaisParaCentavos(f.valorReais);
    if (c === null || c <= 0) return { erro: 'Informe quanto de saldo no Zig este prêmio dá (em reais, ex.: 20 ou 20,50).' };
    corpo.valorCentavos = c;
  }
  return { corpo };
}
// </regras>

const TIPOS = [['premio', 'Prêmio'], ['zig', 'Saldo no Zig']];
const dataHora = (v) => (v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export default function MoedasAdmin() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [cfg, setCfg] = useState(null);
  const [valores, setValores] = useState({});
  const [novo, setNovo] = useState(PREMIO_VAZIO);
  const [editando, setEditando] = useState(null);       // id do prêmio em edição
  const [edicao, setEdicao] = useState(PREMIO_VAZIO);
  const [q, setQ] = useState('');
  const [achados, setAchados] = useState([]);
  const [pessoa, setPessoa] = useState(null);           // { colaborador, saldo, extrato }
  const [ajusteValor, setAjusteValor] = useState('');
  const [ajusteMotivo, setAjusteMotivo] = useState('');

  async function chamar(rota, metodo, corpo) {
    const r = await fetch(rota, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, j };
  }

  async function carregar() {
    try {
      const r = await fetch('/api/moedas-admin');
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Não foi possível carregar.');
      setDados(j);
      if (j.instalada) {
        setCfg(j.config);
        setValores(Object.fromEntries([...j.regras, ...j.missoes].map((x) => [x.chave, String(x.valor)])));
      }
    } catch (e) { setErro(e.message || 'Não foi possível carregar.'); }
  }
  useEffect(() => { carregar(); }, []);

  // busca de colaborador (a partir de 2 letras)
  useEffect(() => {
    if (q.trim().length < 2) { setAchados([]); return undefined; }
    const t = setTimeout(async () => {
      try { const r = await fetch(`/api/moedas-admin/colaboradores?q=${encodeURIComponent(q.trim())}`); const j = await r.json(); setAchados(Array.isArray(j.itens) ? j.itens : []); } catch { setAchados([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const feito = (msg) => { setErro(''); setAviso(msg); };
  const falhou = (msg) => { setAviso(''); setErro(msg); };

  async function salvarConfig() {
    const { ok, j } = await chamar('/api/moedas-admin/config', 'PUT', cfg);
    if (ok) { feito('Configuração salva.'); await carregar(); } else falhou(j.erro || 'Não foi possível salvar.');
  }
  async function salvarRegra(chave) {
    const { ok, j } = await chamar('/api/moedas-admin/regras', 'PUT', { chave, valor: valores[chave] });
    if (ok) { feito('Valor salvo.'); await carregar(); } else falhou(j.erro || 'Não foi possível salvar.');
  }
  async function criarPremio() {
    const m = montarPremio(novo); if (m.erro) return falhou(m.erro);
    const { ok, j } = await chamar('/api/moedas-admin/premios', 'POST', m.corpo);
    if (ok) { setNovo(PREMIO_VAZIO); feito('Prêmio criado.'); await carregar(); } else falhou(j.erro || 'Não foi possível criar.');
  }
  async function salvarPremio(id) {
    const m = montarPremio(edicao); if (m.erro) return falhou(m.erro);
    const { ok, j } = await chamar(`/api/moedas-admin/premios/${id}`, 'PATCH', m.corpo);
    if (ok) { setEditando(null); feito('Prêmio salvo.'); await carregar(); } else falhou(j.erro || 'Não foi possível salvar.');
  }
  async function decidir(t, acao) {
    let motivo;
    if (acao === 'recusar') {
      motivo = window.prompt('Motivo da recusa (a pessoa vê; pode deixar em branco). As moedas voltam para ela.');
      if (motivo === null) return;
    } else if (!window.confirm(`Marcar como entregue: ${t.premioNome} para ${t.colaborador.nome}?${t.tipo === 'zig' && t.valorCentavos ? ` Você já creditou R$ ${centavosParaTexto(t.valorCentavos)} no Zig dela?` : ''}`)) return;
    const { ok, j } = await chamar(`/api/moedas-admin/resgates/${t.id}`, 'POST', { acao, motivo });
    if (ok) { feito(acao === 'entregar' ? 'Marcado como entregue.' : 'Troca recusada; as moedas voltaram para a pessoa.'); await carregar(); } else falhou(j.erro || 'Não foi possível concluir.');
  }
  async function escolher(p, limparAvisos = true) {
    const r = await fetch(`/api/moedas-admin/extrato?colaboradorId=${encodeURIComponent(p.id)}`); const j = await r.json();
    if (!r.ok) return falhou(j.erro || 'Não foi possível abrir o extrato.');
    setPessoa(j); setAchados([]); setQ('');
    if (limparAvisos) { setAviso(''); setErro(''); }   // ao recarregar depois de um ajuste, a mensagem de "feito" tem que ficar
  }
  async function aplicarAjuste() {
    const { ok, j } = await chamar('/api/moedas-admin/ajuste', 'POST', { colaboradorId: pessoa.colaborador.id, valor: ajusteValor, motivo: ajusteMotivo });
    if (!ok) return falhou(j.erro || 'Não foi possível aplicar.');
    setAjusteValor(''); setAjusteMotivo(''); feito(`Feito. Novo saldo de ${pessoa.colaborador.nome}: ${j.saldo}.`);
    await escolher(pessoa.colaborador, false); await carregar();
  }

  const campoPremio = (f, set) => (
    <div>
      <label>Nome do prêmio</label>
      <input value={f.nome} maxLength={80} onChange={(e) => set({ ...f, nome: e.target.value })} />
      <label>Descrição (opcional)</label>
      <input value={f.descricao} maxLength={300} onChange={(e) => set({ ...f, descricao: e.target.value })} />
      <label>Tipo</label>
      <select value={f.tipo} onChange={(e) => set({ ...f, tipo: e.target.value })}>{TIPOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
      {f.tipo === 'zig' && (<><label>Quanto de saldo no Zig (R$)</label><input value={f.valorReais} inputMode="decimal" onChange={(e) => set({ ...f, valorReais: e.target.value })} /></>)}
      <label>Custo (em {cfg ? cfg.nomePlural : 'moedas'})</label>
      <input value={f.custo} inputMode="numeric" onChange={(e) => set({ ...f, custo: e.target.value })} />
      <label>Estoque (deixe vazio para não limitar)</label>
      <input value={f.estoque} inputMode="numeric" onChange={(e) => set({ ...f, estoque: e.target.value })} />
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={f.ativo} onChange={(e) => set({ ...f, ativo: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> Ativo (aparece para os colaboradores)</label>
    </div>
  );

  const linhaRegra = (x, rotulo) => (
    <div key={x.chave} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 14 }}>{rotulo}{x.ativo === false ? ' (missão encerrada)' : ''}</div>
        {x.descricao && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{x.descricao}</div>}
      </div>
      <input aria-label={`Valor de ${rotulo}`} value={valores[x.chave] ?? ''} inputMode="numeric" onChange={(e) => setValores({ ...valores, [x.chave]: e.target.value })} style={{ width: 90 }} />
      <button type="button" className="secundario" style={{ padding: '4px 12px', fontSize: 13 }} disabled={String(valores[x.chave]) === String(x.valor)} onClick={() => salvarRegra(x.chave)}>Salvar</button>
    </div>
  );

  return (
    <div>
      <BotaoVoltar />
      <h2><IconeMoeda tamanho={30} /> Moedas</h2>
      {erro && <div className="erro">{erro}</div>}
      {aviso && <p style={{ fontSize: 13, color: 'var(--success)' }}>{aviso}</p>}
      {!dados && !erro && <p style={{ color: 'var(--muted)' }}>Carregando...</p>}
      {dados && dados.instalada === false && <div className="card"><p style={{ margin: 0 }}>As tabelas das moedas ainda não foram instaladas. Rode o arquivo <b>moedas.sql</b> no Neon e atualize o <b>schema.prisma</b>.</p></div>}

      {dados && dados.instalada && cfg && (
        <>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Programa</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>
              {cfg.ativo ? 'Ligado: os colaboradores veem o saldo e ganham moedas pelas atividades que valem algo.' : 'Desligado: ninguém vê o saldo nem ganha moedas. Dá para configurar tudo antes de ligar.'}
              {' '}Moedas em circulação: <b>{dados.emCirculacao}</b>.
            </p>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={cfg.ativo} onChange={(e) => setCfg({ ...cfg, ativo: e.target.checked })} style={{ width: 'auto', margin: 0 }} /> Programa ligado</label>
            <label>Nome da moeda (singular)</label><input value={cfg.nomeSingular} maxLength={20} onChange={(e) => setCfg({ ...cfg, nomeSingular: e.target.value })} />
            <label>Nome da moeda (plural)</label><input value={cfg.nomePlural} maxLength={20} onChange={(e) => setCfg({ ...cfg, nomePlural: e.target.value })} />
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={usaDesenho(cfg.simbolo)} onChange={(e) => setCfg({ ...cfg, simbolo: e.target.checked ? 'moeda' : '⭐' })} style={{ width: 'auto', margin: 0 }} /> Usar o desenho da moeda do Brew <IconeMoeda tamanho={22} /></label>
            {!usaDesenho(cfg.simbolo) && (<><label>Símbolo (um emoji)</label><input value={cfg.simbolo} maxLength={8} onChange={(e) => setCfg({ ...cfg, simbolo: e.target.value })} style={{ maxWidth: 120 }} /></>)}
            <button type="button" onClick={salvarConfig}>Salvar configuração</button>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>O que rende {cfg.nomePlural}</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>Quanto cada atividade paga. <b>0 = não paga.</b> Cada atividade paga uma vez por pessoa (por pedido, comunicado, campanha ou missão aprovada).</p>
            {dados.regras.map((x) => linhaRegra(x, x.rotulo))}
            {dados.missoes.length > 0 && <h4 style={{ margin: '12px 0 0' }}>Missões</h4>}
            {dados.missoes.map((x) => linhaRegra(x, `Missão: ${x.titulo}`))}
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 0 }}>Missão por selo paga uma vez, na primeira vez que a pessoa a vê concluída. Isso vale também para quem <b>já</b> tinha o selo.</p>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Trocas para entregar ({dados.resgatesPendentes.length})</h3>
            {dados.resgatesPendentes.length === 0 && <p style={{ color: 'var(--muted)', margin: 0 }}>Nenhuma troca esperando.</p>}
            {dados.resgatesPendentes.map((t) => (
              <div key={t.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                <b>{t.colaborador.nome}</b> <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t.colaborador.loja} · {dataHora(t.criadoEm)}</span>
                <div style={{ fontSize: 14 }}>{t.premioNome} ({t.custo} <IconeMoeda simbolo={cfg.simbolo} tamanho={16} />){t.tipo === 'zig' && t.valorCentavos ? ` · creditar R$ ${centavosParaTexto(t.valorCentavos)} no Zig` : ''}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <button type="button" onClick={() => decidir(t, 'entregar')}>Marcar como entregue</button>
                  <button type="button" className="secundario" onClick={() => decidir(t, 'recusar')}>Recusar</button>
                </div>
              </div>
            ))}
            {dados.resgatesRecentes.length > 0 && (
              <details style={{ marginTop: 10 }}><summary style={{ cursor: 'pointer', fontSize: 13 }}>Últimas decididas</summary>
                {dados.resgatesRecentes.map((t) => <div key={t.id} style={{ fontSize: 13, padding: '4px 0' }}>{t.colaborador.nome}: {t.premioNome} · {t.statusRotulo}</div>)}
              </details>
            )}
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Prêmios</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>Os custos são editáveis a qualquer momento. Mudar o custo não altera o que já foi trocado.</p>
            {dados.premios.map((p) => (
              <div key={p.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)', opacity: p.ativo ? 1 : 0.55 }}>
                {editando === p.id ? (
                  <div>
                    {campoPremio(edicao, setEdicao)}
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button type="button" onClick={() => salvarPremio(p.id)}>Salvar prêmio</button>
                      <button type="button" className="secundario" onClick={() => setEditando(null)}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                    <div>
                      <b>{p.nome}</b> {!p.ativo && <span style={{ fontSize: 12 }}>(inativo)</span>}
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.tipoRotulo}{p.tipo === 'zig' && p.valorCentavos ? ` · R$ ${centavosParaTexto(p.valorCentavos)}` : ''} · custa {p.custo} <IconeMoeda simbolo={cfg.simbolo} tamanho={14} /> · {p.estoque === null ? 'sem limite de estoque' : `estoque: ${p.estoque}`}</div>
                    </div>
                    <button type="button" className="secundario" style={{ padding: '4px 12px', fontSize: 13 }} onClick={() => { setEditando(p.id); setEdicao(formDoPremio(p)); }}>Editar</button>
                  </div>
                )}
              </div>
            ))}
            <h4 style={{ margin: '14px 0 0' }}>Novo prêmio</h4>
            {campoPremio(novo, setNovo)}
            <button type="button" style={{ marginTop: 6 }} onClick={criarPremio}>Criar prêmio</button>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0 }}>Dar ou tirar {cfg.nomePlural}</h3>
            <label>Buscar colaborador (a partir de 2 letras)</label>
            <input value={q} onChange={(e) => setQ(e.target.value)} />
            {achados.map((a) => (
              <button key={a.id} type="button" className="secundario" style={{ display: 'block', width: '100%', textAlign: 'left', marginTop: 4 }} onClick={() => escolher(a)}>{a.nome} <span style={{ fontSize: 12, color: 'var(--muted)' }}>· {a.loja}</span></button>
            ))}
            {pessoa && (
              <div style={{ marginTop: 10 }}>
                <b>{pessoa.colaborador.nome}</b> <span style={{ fontSize: 12, color: 'var(--muted)' }}>{pessoa.colaborador.loja}</span>
                <div>Saldo: <b><IconeMoeda simbolo={cfg.simbolo} tamanho={18} /> {pessoa.saldo}</b></div>
                <label>Quantas moedas (positivo dá, negativo tira)</label>
                <input value={ajusteValor} inputMode="numeric" onChange={(e) => setAjusteValor(e.target.value)} style={{ maxWidth: 160 }} />
                <label>Motivo (fica no extrato dela)</label>
                <input value={ajusteMotivo} maxLength={200} onChange={(e) => setAjusteMotivo(e.target.value)} />
                <button type="button" onClick={aplicarAjuste}>Aplicar</button>
                <details style={{ marginTop: 10 }}><summary style={{ cursor: 'pointer', fontSize: 13 }}>Extrato ({pessoa.extrato.length})</summary>
                  {pessoa.extrato.map((e) => <div key={e.id} style={{ fontSize: 13, padding: '3px 0' }}>{dataHora(e.criadoEm)} · {e.descricao}{e.criadoPor ? ` (${e.criadoPor})` : ''} · <b>{e.valor > 0 ? '+' : ''}{e.valor}</b></div>)}
                </details>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
