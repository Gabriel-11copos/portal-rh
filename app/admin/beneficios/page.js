'use client';
import { useEffect, useState } from 'react';
import BotaoVoltar from '../../components/BotaoVoltar';
import V from '../../../lib/vt';

const FILTROS = [['', 'Todos'], ['bui', 'BUI a validar'], ['caso_diferente', 'Caso diferente'], ['sem_mapeamento', 'Sem mapeamento'], ['saldo_pendente', 'Saldo pendente'], ['saldo_refazer', 'Nova foto pedida'], ['nao_usa', 'Não utilizam']];
const COR = { bui: '#fde68a', caso_diferente: '#fde68a', sem_mapeamento: '#fdecea', saldo_pendente: '#fff3cd', saldo_refazer: '#fff3cd' };
const dataBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '');
const centavos = (c) => (c === null || c === undefined ? '' : V.reais(c));

// Painel de Benefícios (vale-transporte) do RH.
export default function PainelBeneficios() {
  const [aba, setAba] = useState('colaboradores');
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(''); const [aviso, setAviso] = useState('');
  const [busca, setBusca] = useState(''); const [loja, setLoja] = useState(''); const [filtro, setFiltro] = useState('');
  const [config, setConfig] = useState(null);
  const [novaSaldo, setNovaSaldo] = useState({ titulo: '', prazo: '' }); const [novaMapa, setNovaMapa] = useState({ titulo: '', prazo: '' });

  async function carregar() {
    try {
      const r = await fetch('/api/vt-admin'); const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Não foi possível carregar.');
      setDados(j);
    } catch (e) { setErro(e.message || 'Não foi possível carregar.'); }
  }
  async function carregarConfig() {
    try { const r = await fetch('/api/vt-admin/config'); const j = await r.json(); if (r.ok) setConfig({ regras: Object.fromEntries(Object.entries(j.regras).map(([k, v]) => [k, (v / 100).toFixed(2).replace('.', ',')])), unidades: j.unidades }); } catch { /* a aba mostra o aviso */ }
  }
  useEffect(() => { carregar(); }, []);
  useEffect(() => { if (aba === 'valores' && !config) carregarConfig(); }, [aba]);

  async function enviar(url, metodo, corpo, sucesso) {
    setErro(''); setAviso('');
    try {
      const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.erro || 'Não foi possível concluir.'); return false; }
      setAviso(typeof sucesso === 'function' ? sucesso(j) : sucesso); return j;
    } catch { setErro('Sem conexão. Tente de novo.'); return false; }
  }
  async function liberar(tipo, form, setForm) {
    const quem = tipo === 'saldo' ? 'pedir o saldo do cartão' : 'pedir a atualização do transporte';
    if (!window.confirm(`Liberar agora para ${quem}? Os colaboradores serão avisados por WhatsApp.`)) return;
    const j = await enviar('/api/vt-admin/coletas', 'POST', { acao: 'criar', tipo, ...form }, (x) => `Liberado. ${x.avisados} colaborador(es) na coleta.`);
    if (j) { setForm({ titulo: '', prazo: '' }); carregar(); }
  }
  async function encerrar(id) {
    if (!window.confirm('Encerrar esta coleta? Ninguém mais será cobrado por ela.')) return;
    if (await enviar('/api/vt-admin/coletas', 'POST', { acao: 'encerrar', id }, 'Coleta encerrada.')) carregar();
  }

  const linhas = dados && dados.linhas ? dados.linhas.filter((l) => (!busca || l.nome.toLowerCase().includes(busca.toLowerCase())) && (!loja || l.loja === loja) && (!filtro || (filtro === 'nao_usa' ? l.status === 'nao_usa' : l.alertas.includes(filtro)))) : [];
  const res = dados && dados.resumo;
  const coletaAberta = (tipo) => dados && dados.coletas.find((c) => c.tipo === tipo && c.ativa);

  return (
    <div>
      <BotaoVoltar />
      <h2>🚌 Benefícios · Vale-transporte</h2>
      {erro && <div className="erro" role="alert">{erro}</div>}
      {aviso && <div className="card" style={{ background: 'var(--verde-pastel)' }} role="status">{aviso}</div>}
      {dados && dados.instalado === false && <div className="card">O vale-transporte ainda não está instalado (falta rodar o SQL do vale-transporte no Neon).</div>}
      {res && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          {[['Ativos', res.ativos], ['Mapeados', res.mapeados], ['Não utilizam', res.naoUsam], ['Sem mapeamento', res.semMapeamento], ['BUI a validar', res.bui], ['Caso diferente', res.casoDiferente], ['Saldo pendente', res.saldoPendente]].map(([r, n]) => <div className="card" key={r} style={{ textAlign: 'center', margin: 0 }}><div style={{ fontSize: 22, fontWeight: 700 }}>{n}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{r}</div></div>)}
          <div className="card" style={{ textAlign: 'center', margin: 0 }}><div style={{ fontSize: 18, fontWeight: 700 }}>{centavos(res.mensalTotalCentavos)}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>Estimativa de {String(res.mes).padStart(2, '0')}/{res.ano} (sem descontar folgas)</div></div>
        </div>
      )}
      <div className="filtros-status" style={{ margin: '12px 0' }}>
        {[['colaboradores', 'Colaboradores'], ['coletas', 'Coletas'], ['valores', 'Valores e unidades']].map(([k, r]) => <button key={k} type="button" className={aba === k ? 'ativo' : ''} onClick={() => setAba(k)}>{r}</button>)}
      </div>

      {aba === 'colaboradores' && dados && dados.instalado !== false && (
        <div className="card">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input placeholder="Buscar por nome" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ maxWidth: 220 }} />
            <select value={loja} onChange={(e) => setLoja(e.target.value)} style={{ maxWidth: 220 }}><option value="">Todas as unidades</option>{(dados.lojas || []).map((l) => <option key={l} value={l}>{l}</option>)}</select>
            <select value={filtro} onChange={(e) => setFiltro(e.target.value)} style={{ maxWidth: 200 }}>{FILTROS.map(([k, r]) => <option key={k} value={k}>{r}</option>)}</select>
            <a href={`/api/vt-admin/exportar${loja ? `?loja=${encodeURIComponent(loja)}` : ''}`}>⬇️ Baixar planilha</a>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>{['Nome', 'Unidade', 'Modalidade', 'Transportes', 'Dia', 'Mês', 'Alertas', 'Saldo'].map((t) => <th key={t} style={{ padding: 6 }}>{t}</th>)}</tr></thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'top' }}>
                    <td style={{ padding: 6 }}><a href={`/admin/beneficios/${l.id}`}>{l.nome}</a></td>
                    <td style={{ padding: 6 }}>{l.loja}</td>
                    <td style={{ padding: 6 }}>{l.status === 'nao_usa' ? 'Não utiliza' : l.modalidadeRotulo || '—'}</td>
                    <td style={{ padding: 6 }}>{l.transportes.join(' + ') || '—'}</td>
                    <td style={{ padding: 6 }}>{centavos(l.valorDia)}</td>
                    <td style={{ padding: 6 }}>{centavos(l.valorMensal)}</td>
                    <td style={{ padding: 6 }}>{l.alertas.map((a) => <span key={a} className="badge" style={{ background: COR[a] || '#eee', marginRight: 4 }}>{V.ROTULO_ALERTA[a] || a}</span>)}</td>
                    <td style={{ padding: 6 }}>{l.saldo ? `${l.saldo.jaeCentavos !== null ? `Jaé ${centavos(l.saldo.jaeCentavos)} ` : ''}${l.saldo.riocardCentavos !== null ? `Riocard ${centavos(l.saldo.riocardCentavos)}` : ''}` : ''}</td>
                  </tr>
                ))}
                {linhas.length === 0 && <tr><td colSpan={8} style={{ padding: 10, color: 'var(--muted)' }}>Nenhum colaborador neste filtro.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aba === 'coletas' && dados && dados.instalado !== false && (
        <>
          {[['saldo', '💳 Pedir o saldo do vale-transporte', 'Cada colaborador que usa vale-transporte informa o saldo do cartão e anexa foto ou PDF (os dois cartões, para JAE + RIOCARD).', novaSaldo, setNovaSaldo], ['mapeamento', '🗺️ Pedir a atualização do transporte', 'Todos (menos quem declarou que não usa) conferem ou refazem modalidade, transportes e endereço.', novaMapa, setNovaMapa]].map(([tipo, titulo, ajuda, form, setForm]) => (
            <div className="card" key={tipo}>
              <h3 style={{ marginTop: 0 }}>{titulo}</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>{ajuda}</p>
              {coletaAberta(tipo) ? <p style={{ fontSize: 14 }}>Já existe uma coleta aberta: <b>{coletaAberta(tipo).titulo}</b>. Encerre-a abaixo para abrir outra.</p> : (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
                  <div><label>Título (opcional)</label><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder={tipo === 'saldo' ? 'Saldo do vale-transporte' : 'Mapeamento de transporte'} /></div>
                  <div><label>Prazo (opcional)</label><input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} /></div>
                  <button type="button" onClick={() => liberar(tipo, form, setForm)}>{tipo === 'saldo' ? 'Liberar coleta de saldo' : 'Liberar atualização'}</button>
                </div>
              )}
            </div>
          ))}
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Coletas</h3>
            {dados.coletas.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhuma coleta ainda.</p>}
            {dados.coletas.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
                <div><b>{c.titulo}</b> <span style={{ fontSize: 12, color: 'var(--muted)' }}>({c.tipo === 'saldo' ? 'saldo' : 'transporte'} · aberta em {dataBR(c.criadaEm)}{c.prazo ? ` · prazo ${dataBR(c.prazo)}` : ''})</span><div style={{ fontSize: 13 }}>{c.respondidos} de {c.alvos} responderam</div></div>
                {c.ativa ? <button type="button" className="secundario" onClick={() => encerrar(c.id)}>Encerrar</button> : <span className="badge encerrada">Encerrada</span>}
              </div>
            ))}
          </div>
        </>
      )}

      {aba === 'valores' && (config ? (
        <>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Valores por viagem</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Valem para quem preencher (ou atualizar) a partir de agora. Quem já preencheu mantém o valor até atualizar. O valor do dia é sempre 2 viagens (ida e volta).</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[['jae', 'JAE (integração)'], ['riocardUm', 'Riocard: 1 transporte (metrô, trem, barca)'], ['riocardIntegracao', 'Riocard: integração de 2 (ou intermunicipal)']].map(([k, r]) => <div key={k}><label>{r}</label><input value={config.regras[k]} onChange={(e) => setConfig({ ...config, regras: { ...config.regras, [k]: e.target.value } })} inputMode="decimal" style={{ maxWidth: 140 }} /></div>)}
            </div>
            <button type="button" style={{ marginTop: 8 }} onClick={() => enviar('/api/vt-admin/config', 'PUT', { regras: config.regras }, 'Valores salvos.')}>Salvar valores</button>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Unidades</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>O endereço é o destino do trajeto. A razão social e o CNPJ aparecem no termo de quem não utiliza o vale-transporte. Sem endereço, a unidade não tem trajeto no mapa.</p>
            {config.unidades.map((u, i) => {
              const mudar = (k) => (e) => setConfig({ ...config, unidades: config.unidades.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)) });
              return (
                <div key={u.loja} style={{ borderTop: '1px solid var(--border)', padding: '8px 0' }}>
                  <b>{u.loja}</b>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                    <div style={{ gridColumn: 'span 2' }}><label>Endereço do trabalho</label><input value={u.endereco || ''} onChange={mudar('endereco')} /></div>
                    <div><label>Bairro</label><input value={u.bairro || ''} onChange={mudar('bairro')} /></div>
                    <div style={{ gridColumn: 'span 2' }}><label>Razão social</label><input value={u.razaoSocial || ''} onChange={mudar('razaoSocial')} /></div>
                    <div><label>CNPJ</label><input value={u.cnpj || ''} onChange={mudar('cnpj')} /></div>
                  </div>
                  <button type="button" className="secundario" style={{ marginTop: 6 }} onClick={() => enviar('/api/vt-admin/config', 'PUT', { unidade: u }, `${u.loja}: salvo.`)}>Salvar {u.loja}</button>
                </div>
              );
            })}
          </div>
        </>
      ) : <p>Carregando...</p>)}
      {!dados && !erro && <p>Carregando...</p>}
    </div>
  );
}
