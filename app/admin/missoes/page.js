'use client';
import { useEffect, useState } from 'react';
import BotaoVoltar from '../../components/BotaoVoltar';
import IconeSelo from '../../components/IconeSelo';

// Datas de calendário ficam guardadas à meia-noite UTC: ler em UTC evita o "um dia a menos".
const dataCal = (v) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
const dataHora = (v) => new Date(v).toLocaleDateString('pt-BR');
const dataParaCampo = (v) => (v ? new Date(v).toISOString().slice(0, 10) : '');

const NOVA = { titulo: '', descricao: '', modo: 'aprovacao', seloId: '', recompensaTexto: '', rotuloReferencia: '', repetivel: false, prazo: '' };

export default function MissoesAdmin() {
  const [dados, setDados] = useState(null);
  const [selos, setSelos] = useState([]);
  const [form, setForm] = useState(NOVA);
  const [edicao, setEdicao] = useState(null);
  const [recusando, setRecusando] = useState(null);    // { id, motivo }
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');

  async function carregar() {
    try {
      const [a, b] = await Promise.all([fetch('/api/missoes-admin'), fetch('/api/selos')]);
      const json = await a.json();
      if (!a.ok) throw new Error(json.erro || 'Não foi possível carregar as missões.');
      setDados(json);
      const s = await b.json();
      setSelos(Array.isArray(s.selos) ? s.selos.filter((x) => x.ativo) : []);
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar as missões.');
    }
  }
  useEffect(() => { carregar(); }, []);

  async function enviar(url, metodo, corpo) {
    setErro(''); setMsg('');
    const r = await fetch(url, { method: metodo, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const json = await r.json();
    if (!r.ok) { setErro(json.erro || 'Não foi possível concluir.'); return null; }
    return json;
  }

  async function criar(e) {
    e.preventDefault();
    const ok = await enviar('/api/missoes-admin', 'POST', form);
    if (ok) { setForm(NOVA); setMsg('Missão criada!'); carregar(); }
  }

  async function salvarEdicao() {
    const { id, ...campos } = edicao;
    const ok = await enviar(`/api/missoes-admin/${id}`, 'PATCH', campos);
    if (ok) { setEdicao(null); setMsg('Missão atualizada.'); carregar(); }
  }

  async function alternar(m) {
    const ok = await enviar(`/api/missoes-admin/${m.id}`, 'PATCH', { ativo: !m.ativo });
    if (ok) carregar();
  }

  async function decidir(pedido, acao, motivo) {
    if (acao === 'aprovar' && !window.confirm(`Aprovar a missão de ${pedido.colaborador}? Ele recebe o selo na hora.`)) return;
    const ok = await enviar(`/api/missoes-admin/pedidos/${pedido.id}`, 'POST', { acao, motivo });
    if (ok) {
      setRecusando(null);
      setMsg(acao === 'aprovar' ? 'Aprovada. O selo foi concedido.' : acao === 'recusar' ? 'Pedido recusado.' : 'Marcado como entregue.');
      carregar();
    } else {
      carregar();   // se outro usuário do RH já decidiu, a fila se atualiza
    }
  }

  const ehSelo = form.modo === 'selo';

  return (
    <div>
      <BotaoVoltar />
      <h2>Missões</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>
        Crie missões para os colaboradores. Uma missão pode se cumprir sozinha quando a pessoa ganha um selo,
        ou depender da sua aprovação.
      </p>
      {erro && <div className="erro">{erro}</div>}
      {msg && <p style={{ fontSize: 13, color: 'var(--success)' }}>{msg}</p>}

      <h3>Para aprovar {dados && dados.pendentes.length > 0 && <span className="bolinha-notificacao">{dados.pendentes.length}</span>}</h3>
      {dados && dados.pendentes.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Nenhum pedido esperando.</p>}
      {dados && dados.pendentes.map((p) => (
        <div key={p.id} className="card">
          <b>{p.colaborador}</b> <span style={{ color: 'var(--muted)', fontSize: 13 }}>· {p.loja}</span>
          <div style={{ fontSize: 14 }}>🎯 {p.missao}</div>
          {p.referencia && <div style={{ fontSize: 14 }}>{p.rotuloReferencia || 'Referência'}: <b>{p.referencia}</b></div>}
          {p.mensagem && <div style={{ fontSize: 13, fontStyle: 'italic' }}>“{p.mensagem}”</div>}
          <div style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 8px' }}>
            Enviado há {p.dias} {p.dias === 1 ? 'dia' : 'dias'} ({dataHora(p.criadoEm)})
          </div>
          {recusando && recusando.id === p.id ? (
            <div>
              <label>Motivo (o colaborador vê)</label>
              <input value={recusando.motivo} maxLength={200} onChange={(e) => setRecusando({ id: p.id, motivo: e.target.value })} placeholder="Ex: o indicado saiu antes dos 90 dias" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => decidir(p, 'recusar', recusando.motivo)}>Confirmar recusa</button>
                <button type="button" className="secundario" onClick={() => setRecusando(null)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => decidir(p, 'aprovar')}>Aprovar</button>
              <button type="button" className="secundario" onClick={() => setRecusando({ id: p.id, motivo: '' })}>Recusar</button>
            </div>
          )}
        </div>
      ))}

      {dados && dados.aEntregar.length > 0 && (
        <>
          <h3>Recompensas a entregar <span className="bolinha-notificacao">{dados.aEntregar.length}</span></h3>
          {dados.aEntregar.map((p) => (
            <div key={p.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <b>{p.colaborador}</b> <span style={{ color: 'var(--muted)', fontSize: 13 }}>· {p.loja}</span>
                  <div style={{ fontSize: 14 }}>🎁 {p.recompensa} <span style={{ color: 'var(--muted)' }}>· {p.missao}</span></div>
                  {p.referencia && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{p.referencia}</div>}
                </div>
                <button type="button" className="secundario" onClick={() => decidir(p, 'entregar')}>Marcar como entregue</button>
              </div>
            </div>
          ))}
        </>
      )}

      <h3>Nova missão</h3>
      <div className="card">
        <form onSubmit={criar}>
          <label>Título</label>
          <input value={form.titulo} maxLength={80} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex: Indique um amigo" required />
          <label>Descrição (o colaborador lê)</label>
          <textarea rows={3} value={form.descricao} maxLength={400} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          <label>Como a missão é cumprida</label>
          <select value={form.modo} onChange={(e) => setForm({ ...form, modo: e.target.value })}>
            <option value="aprovacao">A pessoa registra e o RH aprova</option>
            <option value="selo">Sozinha, quando a pessoa ganha um selo</option>
          </select>
          <label>{ehSelo ? 'Selo que cumpre a missão' : 'Selo de recompensa (opcional)'}</label>
          <select value={form.seloId} onChange={(e) => setForm({ ...form, seloId: e.target.value })} required={ehSelo}>
            <option value="">{ehSelo ? 'Escolha...' : 'Sem selo'}</option>
            {selos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
          <label>Recompensa em texto (opcional, ex: R$ 100 em voucher)</label>
          <input value={form.recompensaTexto} maxLength={80} onChange={(e) => setForm({ ...form, recompensaTexto: e.target.value })} />
          {!ehSelo && (
            <>
              <label>Pedir uma informação ao colaborador (opcional, ex: Nome do amigo indicado)</label>
              <input value={form.rotuloReferencia} maxLength={60} onChange={(e) => setForm({ ...form, rotuloReferencia: e.target.value })} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={form.repetivel} onChange={(e) => setForm({ ...form, repetivel: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
                Pode ser cumprida mais de uma vez (ex: cada indicação conta)
              </label>
            </>
          )}
          <label>Prazo (opcional)</label>
          <input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} style={{ maxWidth: 200 }} />
          <button type="submit">Criar missão</button>
        </form>
      </div>

      <h3>Missões criadas</h3>
      {dados && dados.missoes.length === 0 && <p style={{ color: 'var(--muted)', fontSize: 14 }}>Nenhuma missão criada ainda.</p>}
      {dados && dados.missoes.map((m) => (
        <div key={m.id} className="card" style={{ opacity: m.ativo ? 1 : 0.55 }}>
          {edicao && edicao.id === m.id ? (
            <div>
              <label>Título</label>
              <input value={edicao.titulo} maxLength={80} onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })} />
              <label>Descrição</label>
              <textarea rows={3} value={edicao.descricao} maxLength={400} onChange={(e) => setEdicao({ ...edicao, descricao: e.target.value })} />
              <label>Recompensa em texto</label>
              <input value={edicao.recompensaTexto} maxLength={80} onChange={(e) => setEdicao({ ...edicao, recompensaTexto: e.target.value })} />
              {m.modo === 'aprovacao' && (
                <>
                  <label>Informação pedida ao colaborador</label>
                  <input value={edicao.rotuloReferencia} maxLength={60} onChange={(e) => setEdicao({ ...edicao, rotuloReferencia: e.target.value })} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={edicao.repetivel} onChange={(e) => setEdicao({ ...edicao, repetivel: e.target.checked })} style={{ width: 'auto', margin: 0 }} />
                    Pode ser cumprida mais de uma vez
                  </label>
                </>
              )}
              <label>Prazo</label>
              <input type="date" value={edicao.prazo} onChange={(e) => setEdicao({ ...edicao, prazo: e.target.value })} style={{ maxWidth: 200 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={salvarEdicao}>Salvar</button>
                <button type="button" className="secundario" onClick={() => setEdicao(null)}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div>
                <b>🎯 {m.titulo}</b>{' '}
                <span className="badge encerrada">{m.modo === 'selo' ? 'Cumpre sozinha' : 'Com aprovação'}</span>
                {!m.ativo && <span className="badge encerrada" style={{ marginLeft: 6 }}>Desativada</span>}
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {m.selo && <span><IconeSelo icone={m.selo.icone} tamanho={16} /> {m.selo.nome} · </span>}
                  {m.recompensaTexto && <span>🎁 {m.recompensaTexto} · </span>}
                  {m.repetivel && <span>repetível · </span>}
                  {m.prazo ? `até ${dataCal(m.prazo)}` : 'sem prazo'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="secundario" style={{ padding: '4px 12px', fontSize: 12 }}
                  onClick={() => setEdicao({ id: m.id, titulo: m.titulo, descricao: m.descricao || '', recompensaTexto: m.recompensaTexto || '', rotuloReferencia: m.rotuloReferencia || '', repetivel: !!m.repetivel, prazo: dataParaCampo(m.prazo) })}>Editar</button>
                <button type="button" className="secundario" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => alternar(m)}>{m.ativo ? 'Desativar' : 'Ativar'}</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
