'use client';
import { useEffect, useRef, useState } from 'react';
import BotaoVoltar from '../../components/BotaoVoltar';

// <regras>
const NOMES_DOS_AVISOS = {
  'solicitacao.respondida': 'Pedido respondido', 'solicitacao.encerrada': 'Pedido encerrado', 'solicitacao.mensagem': 'Mensagem recebida',
  'comunicado.novo': 'Comunicado', 'documento.disponivel': 'Documento', 'gorjeta.disponivel': 'Gorjeta', 'gorjeta.fechada': 'Gorjeta fechada',
  'missao.aprovada': 'Missão aprovada', 'missao.recusada': 'Missão recusada', 'troca.entregue': 'Troca entregue', 'troca.recusada': 'Troca recusada',
  'selo.recebido': 'Selo', teste: 'Teste',
};
const STATUS = { enviado: ['Enviado', 'var(--success)'], pendente: ['Na fila', 'var(--warning)'], falhou: ['Falhou', 'var(--danger)'], 'sem-telefone': ['Sem telefone', 'var(--muted)'] };
const FILTROS = [['', 'Todos'], ['pendentes', 'Na fila'], ['falhas', 'Falharam'], ['semtelefone', 'Sem telefone'], ['enviados', 'Enviados']];
const MAX_SEM_PROGRESSO = 3;
const ATRASO_AUTOMATICO_MS = 6000;   // espera entre uma rodada automática e outra

// Enquanto a tela está aberta e há aviso na fila, ela mesma manda o que dá (até 3 rodadas seguidas sem avançar: o resto espera a pausa da nova tentativa).
function deveProcessar(resumo, semProgresso) {
  return !!resumo && resumo.pendentes > 0 && semProgresso < MAX_SEM_PROGRESSO;
}

function textoDoResultado(r) {
  if (r.processados === 0 && r.restantes > 0) return `Nada para enviar agora: ${r.restantes} aguardando a pausa da nova tentativa.`;
  return `${r.enviados} enviado(s)${r.falhas ? `, ${r.falhas} falharam (vão tentar de novo)` : ''}${r.restantes ? `. Ainda na fila: ${r.restantes}.` : '. Fila vazia.'}`;
}
// </regras>

const dataHora = (v) => (v ? new Date(v).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

export default function WhatsappAdmin() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [filtro, setFiltro] = useState('');
  const [teste, setTeste] = useState({ nome: 'Teste do Portal', telefone: '', unidade: 'Matriz', mensagem: 'Olá! Este é um teste da integração do portal com o WhatsApp.', link: '' });
  const [resultado, setResultado] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const semProgresso = useRef(0);

  async function carregar(f = filtro) {
    try {
      const r = await fetch(`/api/whatsapp-admin${f ? `?filtro=${encodeURIComponent(f)}` : ''}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Não foi possível carregar.');
      setDados(j);
      return j;
    } catch (e) { setErro(e.message || 'Não foi possível carregar.'); return null; }
  }
  useEffect(() => { carregar(); }, []);

  async function processar(reenviarFalhas = false) {
    const r = await fetch('/api/whatsapp-admin/processar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reenviarFalhas }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro || 'Não foi possível processar.');
    return { ...j, processados: (j.enviados || 0) + (j.falhas || 0) };
  }

  async function clicarProcessar(reenviar) {
    setOcupado(true); setErro(''); setAviso('');
    try {
      const j = await processar(reenviar);
      semProgresso.current = 0;
      setAviso(`${reenviar && j.reenviadas ? `${j.reenviadas} voltaram para a fila. ` : ''}${textoDoResultado(j)}`);
      await carregar();
    } catch (e) { setErro(e.message); } finally { setOcupado(false); }
  }

  // manda a fila sozinha enquanto a tela está aberta
  useEffect(() => {
    if (!deveProcessar(dados && dados.resumo, semProgresso.current) || ocupado || !dados.configurada) return undefined;
    const t = setTimeout(async () => {
      try {
        const j = await processar(false);
        semProgresso.current = j.processados === 0 ? semProgresso.current + 1 : 0;
        await carregar();
      } catch { semProgresso.current = MAX_SEM_PROGRESSO; }
    }, ATRASO_AUTOMATICO_MS);
    return () => clearTimeout(t);
  }, [dados, ocupado]);

  async function enviarTeste() {
    setOcupado(true); setErro(''); setAviso(''); setResultado(null);
    try {
      const r = await fetch('/api/whatsapp-admin/teste', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(teste) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.erro || 'Não foi possível enviar o teste.');
      setResultado(j); await carregar();
    } catch (e) { setErro(e.message); } finally { setOcupado(false); }
  }

  const campo = (rotulo, chave, extra = {}) => (<><label>{rotulo}</label><input value={teste[chave]} onChange={(e) => setTeste({ ...teste, [chave]: e.target.value })} {...extra} /></>);

  return (
    <div>
      <BotaoVoltar />
      <h2>💬 WhatsApp</h2>
      {erro && <div className="erro">{erro}</div>}
      {aviso && <p style={{ fontSize: 13, color: 'var(--success)' }}>{aviso}</p>}
      {!dados && !erro && <p style={{ color: 'var(--muted)' }}>Carregando...</p>}

      {dados && (
        <>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Integração</h3>
            {dados.configurada
              ? <p style={{ margin: 0 }}>✅ Configurada. Os avisos vão para <b>{dados.host}</b>. Os links apontam para <b>{dados.portal}</b>.</p>
              : <p style={{ margin: 0 }}>⚠️ <b>Ainda não configurada.</b> No Vercel, abra o projeto → <b>Settings → Environment Variables</b>, crie <b>WHATSAPP_WEBHOOK_URL</b> com o link do webhook e faça um novo deploy. Enquanto isso, nenhum aviso é enviado.</p>}
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 0 }}>Cada aviso leva só um texto curto e o link do portal (sem valores nem o conteúdo das respostas). O corpo é sempre: nome, telefone, unidade, mensagem e link.</p>
          </div>

          {dados.instalada === false && <div className="card"><p style={{ margin: 0 }}>As tabelas do WhatsApp ainda não foram instaladas. Rode o arquivo <b>whatsapp.sql</b> no Neon e atualize o <b>schema.prisma</b>.</p></div>}

          {dados.instalada && (
            <>
              <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[['Enviados (24 h)', dados.resumo.enviados24h], ['Na fila', dados.resumo.pendentes], ['Falharam', dados.resumo.falhas], ['Sem telefone', dados.resumo.semTelefone]].map(([r, n]) => (
                  <div key={r} style={{ flex: '1 1 80px', textAlign: 'center' }}><div style={{ fontSize: 26, fontWeight: 800, color: 'var(--verde)' }}>{n}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{r}</div></div>
                ))}
              </div>

              <div className="card">
                <h3 style={{ marginTop: 0 }}>Enviar um teste</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 0 }}>Manda uma mensagem para o número que você digitar (use o seu). Serve para conferir a integração e para a plataforma de WhatsApp reconhecer o formato.</p>
                {campo('Nome', 'nome', { maxLength: 120 })}
                {campo('Celular com DDD', 'telefone', { inputMode: 'tel', placeholder: '21 99999-9999' })}
                {campo('Unidade', 'unidade', { maxLength: 80 })}
                {campo('Mensagem', 'mensagem', { maxLength: 600 })}
                {campo('Link (opcional, começa com https://)', 'link', { placeholder: dados.portal })}
                <button type="button" onClick={enviarTeste} disabled={ocupado || !dados.configurada}>Enviar teste</button>
                {resultado && (
                  <div style={{ marginTop: 10, fontSize: 13 }}>
                    <b style={{ color: resultado.ok ? 'var(--success)' : 'var(--danger)' }}>{resultado.ok ? `Enviado (resposta ${resultado.httpStatus}).` : `Não foi enviado: ${resultado.erro}.`}</b>
                    {resultado.resposta && <div>Resposta do webhook: <code>{resultado.resposta}</code></div>}
                    <div style={{ marginTop: 6 }}>O que foi enviado:</div>
                    <pre style={{ background: 'var(--verde-pastel)', padding: 8, borderRadius: 8, overflowX: 'auto', fontSize: 12 }}>{JSON.stringify(resultado.enviado, null, 2)}</pre>
                  </div>
                )}
              </div>

              <div className="card">
                <h3 style={{ marginTop: 0 }}>Fila e histórico</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  <button type="button" onClick={() => clicarProcessar(false)} disabled={ocupado || !dados.configurada}>Enviar a fila agora</button>
                  <button type="button" className="secundario" onClick={() => clicarProcessar(true)} disabled={ocupado || !dados.configurada || dados.resumo.falhas === 0}>Reenviar os que falharam</button>
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 0 }}>Aviso que falha é tentado de novo sozinho (1 min, 5 min, 15 min... até 8 vezes). Com esta tela aberta, a fila também é enviada automaticamente.</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {FILTROS.map(([v, r]) => <button key={v || 'todos'} type="button" className={filtro === v ? '' : 'secundario'} style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => { setFiltro(v); carregar(v); }}>{r}</button>)}
                </div>
                {dados.itens.length === 0 && <p style={{ color: 'var(--muted)', margin: 0 }}>Nenhum aviso aqui.</p>}
                {dados.itens.map((i) => (
                  <div key={i.id} style={{ padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span><b>{i.nome || '(sem nome)'}</b> <span style={{ color: 'var(--muted)' }}>{i.unidade} · {i.telefone || 'sem telefone'}</span></span>
                      <b style={{ color: STATUS[i.status][1], whiteSpace: 'nowrap' }}>{STATUS[i.status][0]}</b>
                    </div>
                    <div style={{ color: 'var(--muted)' }}>{NOMES_DOS_AVISOS[i.evento] || i.evento} · {dataHora(i.enviadoEm || i.criadoEm)}{i.tentativas > 0 ? ` · ${i.tentativas} tentativa(s)` : ''}</div>
                    <div>{i.mensagem}</div>
                    {i.erro && <div style={{ color: 'var(--danger)' }}>{i.erro}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
