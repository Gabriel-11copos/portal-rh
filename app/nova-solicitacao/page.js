'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import UploadAnexo from '../components/UploadAnexo';
import NavColaborador from '../components/NavColaborador';
import BotaoVoltar from '../components/BotaoVoltar';

export default function NovaSolicitacao() {
  const router = useRouter();
  const [perfil, setPerfil] = useState(null);
  const [assuntos, setAssuntos] = useState([]);
  const [assuntoId, setAssuntoId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [emailContato, setEmailContato] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [anexos, setAnexos] = useState([]);
  const [enviado, setEnviado] = useState(false);
  const [dataAtestado, setDataAtestado] = useState('');
  const [dias, setDias] = useState('');
  const [erro, setErro] = useState('');
  const [kit, setKit] = useState(null);
  const [carregandoKit, setCarregandoKit] = useState(false);
  const [escolha, setEscolha] = useState({});
  const [motivoUnif, setMotivoUnif] = useState('');

  useEffect(() => {
    fetch('/api/assuntos').then((r) => r.json()).then(setAssuntos);
    fetch('/api/perfil').then((r) => r.json()).then((p) => {
      setPerfil(p);
      setEmailContato(p.email || '');
    });
  }, []);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    if (ehAtestado && anexos.length === 0) {
      setErro('Anexe a foto ou o PDF do atestado.');
      return;
    }
    let extrasUnif;
    let descricaoEnvio = descricao;
    if (ehUniforme) {
      const itensKit = kit && kit.itens ? kit.itens : [];
      const itens = itensKit.filter((i) => escolha[i.item] && escolha[i.item].marcado).map((i) => ({ item: i.item, qtd: Number(escolha[i.item].qtd) || 1, tamanho: escolha[i.item].tamanho || null }));
      if (itensKit.length > 0 && itens.length === 0) {
        setErro('Marque pelo menos um item.');
        return;
      }
      const semTamanho = itensKit.find((i) => escolha[i.item] && escolha[i.item].marcado && i.tamanhos && !escolha[i.item].tamanho);
      if (semTamanho) {
        setErro('Escolha o tamanho de: ' + semTamanho.item);
        return;
      }
      if (!motivoUnif) {
        setErro('Escolha o motivo do pedido.');
        return;
      }
      extrasUnif = { uniforme: { motivo: motivoUnif, observacao: descricao.trim(), itens } };
      descricaoEnvio = 'Pedido de ' + motivoUnif.toLowerCase() + ': ' + (itens.length ? itens.map((i) => i.qtd + '× ' + i.item + (i.tamanho ? ' (' + i.tamanho + ')' : '')).join(', ') : 'ver observação') + (descricao.trim() ? '\nObservação: ' + descricao.trim() : '');
    }
    const res = await fetch('/api/solicitacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assuntoId, descricao: descricaoEnvio, anexos, emailContato, whatsapp, dadosExtras: ehAtestado ? { dataAtestado, dias: Number(dias) } : extrasUnif }),
    });
    if (res.ok) setEnviado(true);
    else {
      const d = await res.json().catch(() => ({}));
      setErro(d.erro || 'Não foi possível enviar. Tente de novo.');
    }
  }

  const assuntoSelecionado = assuntos.find((a) => a.id === assuntoId);
  const ehAtestado = !!assuntoSelecionado && assuntoSelecionado.fluxo === 'atestado';
  const ehUniforme = !!assuntoSelecionado && assuntoSelecionado.fluxo === 'uniforme';
  useEffect(() => {
    if (!ehUniforme) return;
    setCarregandoKit(true);
    setKit(null);
    setEscolha({});
    fetch('/api/uniformes/kit')
      .then((resp) => resp.json())
      .then((k) => setKit(k))
      .catch(() => setKit({ disponivel: false, encontrada: false, itens: [], aviso: 'Não consegui carregar o uniforme do seu cargo agora. Descreva abaixo o que você precisa.' }))
      .finally(() => setCarregandoKit(false));
  }, [ehUniforme]);

  if (enviado) {
    return (
      <div>
        <NavColaborador />
        <div className="card">
          <h2>Solicitação enviada!</h2>
          <p>Você pode acompanhar o status a qualquer momento em "Minhas solicitações".</p>
          <button onClick={() => router.push('/minhas-solicitacoes')}>Ver minhas solicitações</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <NavColaborador />
      <BotaoVoltar />
      <div className="card">
        {perfil && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{perfil.nome}</div>
            <div style={{ color: 'var(--muted)', fontSize: 14 }}>{perfil.loja}</div>
          </div>
        )}
        <h2>Nova solicitação</h2>
        <form onSubmit={enviar}>
          <label>Assunto</label>
          <select value={assuntoId} onChange={(e) => setAssuntoId(e.target.value)} required style={{ fontWeight: 600 }}>
            <option value="">Selecione...</option>
            {assuntos.map((a) => (
              <option key={a.id} value={a.id}>{a.nome}</option>
            ))}
          </select>

          {ehAtestado && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <b>Dados do atestado</b>
              <label>Data do atestado (primeiro dia)</label>
              <input type="date" value={dataAtestado} onChange={(e) => setDataAtestado(e.target.value)} required />
              <label>Quantos dias de atestado?</label>
              <input type="number" min="1" max="30" value={dias} onChange={(e) => setDias(e.target.value)} required />
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>Anexe abaixo a foto ou o PDF do atestado. Seu gestor vai conferir a data e os dias e encaminhar ao RH.</p>
            </div>
          )}

          {ehUniforme && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <b>Seu uniforme e EPI</b>
              {carregandoKit && <p style={{ color: 'var(--muted)' }}>Carregando o kit do seu cargo…</p>}
              {kit && kit.encontrada && kit.itens.length > 0 ? (
                <>
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>Só aparecem os itens do seu cargo. Marque o que você precisa e escolha o tamanho e a quantidade.</p>
                  {kit.itens.map((i) => {
                    const v = escolha[i.item] || { marcado: false, qtd: 1, tamanho: '' };
                    return (
                      <div key={i.item} style={{ padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input type="checkbox" checked={!!v.marcado} onChange={(e) => setEscolha({ ...escolha, [i.item]: { ...v, marcado: e.target.checked } })} style={{ width: 'auto', margin: 0 }} />
                          <b>{i.item}</b>
                          {i.categoria === 'epi' && <span className="badge aberta">EPI</span>}
                        </label>
                        {i.obs && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{i.obs}</div>}
                        {i.condicional && <div style={{ fontSize: 12, color: 'var(--muted)' }}>⚠️ {i.condicional}</div>}
                        {i.ultima && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Você recebeu em {new Date(i.ultima.entregueEm + 'T12:00:00').toLocaleDateString('pt-BR')} · reposição prevista em {new Date(i.ultima.venceEm + 'T12:00:00').toLocaleDateString('pt-BR')}</div>}
                        {v.marcado && (
                          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                            <div>
                              <span style={{ fontSize: 12 }}>Quantidade</span>
                              <input type="number" min="1" max={i.qtd} value={v.qtd} onChange={(e) => setEscolha({ ...escolha, [i.item]: { ...v, qtd: e.target.value } })} style={{ maxWidth: 90 }} />
                            </div>
                            <div>
                              <span style={{ fontSize: 12 }}>Tamanho</span>
                              {i.tamanhos ? (
                                <select value={v.tamanho} onChange={(e) => setEscolha({ ...escolha, [i.item]: { ...v, tamanho: e.target.value } })} style={{ maxWidth: 130 }}>
                                  <option value="">Escolha…</option>
                                  {i.tamanhos.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                              ) : (
                                <div style={{ paddingTop: 8 }}>Tamanho único</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              ) : (
                kit && !carregandoKit && <p style={{ color: 'var(--muted)' }}>{kit.aviso || 'Não encontrei o uniforme do seu cargo. Descreva abaixo o que você precisa.'}</p>
              )}
              <label>Motivo do pedido</label>
              <select value={motivoUnif} onChange={(e) => setMotivoUnif(e.target.value)} required>
                <option value="">Escolha…</option>
                <option value="Kit inicial (admissão)">Kit inicial (admissão)</option>
                <option value="Reposição (vencimento)">Reposição (vencimento)</option>
                <option value="Troca (dano ou perda)">Troca (dano ou perda)</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          )}

          <label>{ehUniforme ? 'Observação (opcional)' : 'Descreva sua solicitação'}</label>
          <textarea rows={5} value={descricao} onChange={(e) => setDescricao(e.target.value)} required={!ehUniforme} />

          <label>E-mail para contato</label>
          <input type="email" value={emailContato} onChange={(e) => setEmailContato(e.target.value)} required />

          <label>WhatsApp para contato</label>
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(21) 90000-0000" required />

          <UploadAnexo onUploaded={(a) => setAnexos([...anexos, a])} />
          {anexos.map((a, i) => (
            <div key={i} style={{ fontSize: 13, color: 'var(--success)' }}>✓ {a.nomeArquivo}</div>
          ))}

          {erro && <p style={{ color: 'var(--danger)', marginTop: 8 }}>{erro}</p>}
          <div style={{ marginTop: 16 }}>
            <button type="submit">Enviar solicitação</button>
          </div>
        </form>
      </div>
    </div>
  );
}
