'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavColaborador from '../../../components/NavColaborador';
import BotaoVoltar from '../../../components/BotaoVoltar';
import V from '../../../../lib/vt';

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const VAZIA = { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: 'Rio de Janeiro', uf: 'RJ' };
const MAX_ARQUIVO = 4 * 1024 * 1024; const MAX_TOTAL = 4.2 * 1024 * 1024;

// <regras>
const mascaraCep = (v) => { const d = String(v || '').replace(/\D/g, '').slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; };
const dataBR = (d) => (d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '');
// a casa só vira trajeto quando o endereço está completo o bastante para o Google Maps achar
const enderecoCompleto = (o) => String(o.cep || '').replace(/\D/g, '').length === 8 && String(o.logradouro || '').trim().length >= 3 && String(o.numero || '').trim() && String(o.cidade || '').trim();
// Foto do celular pesa muito e o envio tem limite (~4 MB no total): reduz fotos grandes antes de enviar. PDFs e fotos pequenas seguem como estão.
async function prepararArquivo(f) {
  try {
    if (!/^image\//.test(f.type) || f.size < 1000000 || typeof document === 'undefined') return f;
    const url = URL.createObjectURL(f);
    const img = await new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = falha; i.src = url; });
    const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * escala); c.height = Math.round(img.height * escala);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.8));
    return blob ? new File([blob], String(f.name || 'foto').replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : f;
  } catch { return f; }
}
// </regras>

function Aviso({ cor = 'var(--warning)', fundo = '#fff8e1', children }) {
  return <div style={{ background: fundo, border: `1px solid ${cor}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, margin: '10px 0' }}>{children}</div>;
}

function Resumo({ st, aoEditar }) {
  const v = st.valores;
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>🚌 O seu transporte</h3>
        {st.pendencia ? <span className="badge aberta">Atualização pedida pelo RH</span> : <span className="badge respondida">Informado em {dataBR(st.atualizadoEm)}</span>}
      </div>
      {st.usaVT === false ? (
        <>
          <p style={{ fontSize: 14 }}>Você declarou que <b>não utiliza vale-transporte</b>{st.termo ? ` (termo aceito em ${dataBR(st.termo.aceitoEm)})` : ''}.</p>
          <a href="/api/vt/termo" target="_blank" rel="noreferrer">📄 Abrir o termo assinado (PDF)</a>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>Se a sua necessidade mudar, abra uma solicitação ao RH. Quando o RH liberar, você preenche o seu transporte aqui.</p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 14, margin: '8px 0' }}><b>{V.MODALIDADES[st.modalidade]}</b>{st.jae.length + st.riocard.length > 0 ? ` · ${[...V.nomesDosTransportes(st.jae), ...V.nomesDosTransportes(st.riocard)].join(' + ')}` : ''}</p>
          {st.modalidade === 'diferente' ? <p style={{ fontSize: 13 }}>O RH vai olhar o seu caso: “{st.casoDiferente}”.</p> : v && v.dia !== null && (
            <p style={{ fontSize: 13, margin: '4px 0' }}>{V.reais(v.viagem)} por viagem · <b>{V.reais(v.dia)} por dia</b> (ida e volta) · cerca de {V.reais(v.mensal)} em {String(v.mes).padStart(2, '0')}/{v.ano} ({v.diasNoMes} dias, antes dos descontos de folgas e faltas)</p>
          )}
          {(st.modalidade === 'riocard' || st.modalidade === 'jae_riocard') && st.buiAtivo && st.buiAtivo !== 'sim' && <Aviso>⚠️ Você disse que {st.buiAtivo === 'nao' ? 'não tem' : 'não sabe se tem'} o BUI ativo. O RH vai entrar em contato para ajudar.</Aviso>}
          {st.links ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              <a href={st.links.ida} target="_blank" rel="noreferrer">🗺️ Ver trajeto de ida</a>
              <a href={st.links.volta} target="_blank" rel="noreferrer">🗺️ Ver trajeto de volta</a>
            </div>
          ) : st.unidade.semEnderecoFixo && <p style={{ fontSize: 13, color: 'var(--muted)' }}>A sua unidade não tem endereço fixo, então não há trajeto no mapa.</p>}
        </>
      )}
      {st.podeEditar && <button type="button" className="secundario" style={{ marginTop: 10 }} onClick={aoEditar}>Atualizar o meu transporte</button>}
    </div>
  );
}

function FormMapeamento({ st, aoSalvo, aoCancelar }) {
  const inicial = st.origem || st.enderecoSugerido || VAZIA;
  const [usa, setUsa] = useState(st.usaVT === false ? 'nao' : st.mapeado ? 'sim' : '');
  const [origem, setOrigem] = useState({ ...VAZIA, ...inicial, cep: mascaraCep(inicial.cep) });
  const [modalidade, setModalidade] = useState(st.modalidade && st.modalidade !== 'nao_usa' ? st.modalidade : '');
  const [jae, setJae] = useState(st.jae || []);
  const [riocard, setRiocard] = useState(st.riocard || []);
  const [bui, setBui] = useState(st.buiAtivo || '');
  const [numero, setNumero] = useState(st.numeroRiocard || '');
  const [caso, setCaso] = useState(st.casoDiferente || '');
  const [aceite, setAceite] = useState(false);
  const [erro, setErro] = useState(''); const [salvando, setSalvando] = useState(false);

  const trocarModalidade = (m) => { setModalidade(m); setJae([]); setRiocard([]); setErro(''); };
  const alternar = (lista, setLista, k) => setLista(lista.includes(k) ? lista.filter((x) => x !== k) : [...lista, k]);
  const campo = (k) => (e) => setOrigem({ ...origem, [k]: k === 'cep' ? mascaraCep(e.target.value) : e.target.value });
  const usaJae = modalidade === 'jae' || modalidade === 'jae_riocard'; const usaRio = modalidade === 'riocard' || modalidade === 'jae_riocard';
  const calc = modalidade && modalidade !== 'diferente' ? V.calcular({ modalidade, jae: usaJae ? jae : [], riocard: usaRio ? riocard : [] }, st.regras) : null;
  const agora = new Date(); const mensal = calc && calc.ok ? V.valorMensal(calc.dia, agora.getFullYear(), agora.getMonth() + 1) : null;
  const linksVivos = enderecoCompleto(origem) && st.unidade.endereco ? { ida: V.linkTrajeto({ origem: V.enderecoEmTexto(origem), destino: st.unidade.endereco, sentido: 'ida' }), volta: V.linkTrajeto({ origem: V.enderecoEmTexto(origem), destino: st.unidade.endereco, sentido: 'volta' }) } : null;

  async function salvar() {
    setErro('');
    const corpo = usa === 'nao' ? { usaVT: false, aceiteTermo: aceite } : { usaVT: true, modalidade, jae: usaJae ? jae : [], riocard: usaRio ? riocard : [], casoDiferente: caso, buiAtivo: usaRio ? bui : null, numeroRiocard: usaRio ? numero : '', origem };
    if (usa === 'sim') {
      if (!modalidade) { setErro('Escolha como você usa o vale-transporte.'); return; }
      if (modalidade === 'diferente' ? caso.trim().length < 10 : !calc.ok) { setErro(modalidade === 'diferente' ? V.MSG.caso_vazio : calc.erro); return; }
      if (usaRio && !bui) { setErro('Diga se você tem o BUI (Bilhete Único Intermunicipal) ativo.'); return; }
    }
    setSalvando(true);
    try {
      const r = await fetch('/api/vt', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.erro || 'Não foi possível salvar. Tente de novo.'); return; }
      aoSalvo();
    } catch { setErro('Sem conexão. Tente de novo.'); } finally { setSalvando(false); }
  }

  const Opcao = ({ valor, atual, aoEscolher, titulo, ajuda }) => (
    <label style={{ display: 'block', border: `1px solid ${atual === valor ? 'var(--verde)' : 'var(--border)'}`, borderRadius: 8, padding: '8px 10px', margin: '6px 0', cursor: 'pointer', background: atual === valor ? 'var(--verde-pastel)' : 'transparent' }}>
      <input type="radio" name={`opcao-${titulo}`} checked={atual === valor} onChange={() => aoEscolher(valor)} style={{ width: 'auto', marginRight: 8 }} /><b>{titulo}</b>
      {ajuda && <div style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 24 }}>{ajuda}</div>}
    </label>
  );
  const Caixas = ({ itens, marcados, aoMarcar }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '6px 0' }}>
      {itens.map((t) => (
        <label key={t.chave} style={{ border: `1px solid ${marcados.includes(t.chave) ? 'var(--verde)' : 'var(--border)'}`, borderRadius: 999, padding: '6px 12px', cursor: 'pointer', background: marcados.includes(t.chave) ? 'var(--verde-pastel)' : 'transparent', fontSize: 14 }}>
          <input type="checkbox" checked={marcados.includes(t.chave)} onChange={() => aoMarcar(t.chave)} style={{ width: 'auto', marginRight: 6 }} />{t.rotulo}
        </label>
      ))}
    </div>
  );

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>🚌 {st.mapeado ? 'Atualizar o meu transporte' : 'Vamos mapear o seu transporte'}</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>É rápido. Com isso o RH calcula o seu vale-transporte direitinho.</p>
      <label>Você usa vale-transporte para ir ao trabalho?</label>
      <Opcao valor="sim" atual={usa} aoEscolher={setUsa} titulo="Sim, uso" />
      <Opcao valor="nao" atual={usa} aoEscolher={setUsa} titulo="Não, não preciso" ajuda="Você aceita um termo e ele fica guardado no seu perfil." />

      {usa === 'nao' && (st.termoParaLer ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 12, margin: '10px 0', fontSize: 13 }}>
          <div style={{ textAlign: 'center', fontWeight: 700, marginBottom: 8 }}>{st.termoParaLer.titulo}</div>
          {st.termoParaLer.cabecalho.map(([k, v]) => <div key={k}><b>{k}:</b> {v}</div>)}
          {st.termoParaLer.paragrafos.map((p, i) => <p key={i} style={{ margin: '8px 0' }}>{p}</p>)}
          <p style={{ margin: '8px 0' }}>{st.termoParaLer.local}</p>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600 }}><input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} style={{ width: 'auto' }} />Li o termo e aceito.</label>
        </div>
      ) : <Aviso>O RH ainda precisa cadastrar os dados da empresa da sua unidade para gerar o termo. Fale com o RH.</Aviso>)}

      {usa === 'sim' && (
        <>
          <h4 style={{ marginBottom: 4 }}>De onde você sai?</h4>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 6px' }}>O endereço da sua casa. O destino é a sua unidade{st.unidade.endereco ? ` (${st.unidade.endereco})` : ''}.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
            <div><label>CEP</label><input value={origem.cep} onChange={campo('cep')} inputMode="numeric" placeholder="00000-000" /></div>
            <div style={{ gridColumn: 'span 2' }}><label>Rua</label><input value={origem.logradouro} onChange={campo('logradouro')} /></div>
            <div><label>Número</label><input value={origem.numero} onChange={campo('numero')} /></div>
            <div><label>Complemento</label><input value={origem.complemento} onChange={campo('complemento')} /></div>
            <div><label>Bairro</label><input value={origem.bairro} onChange={campo('bairro')} /></div>
            <div><label>Cidade</label><input value={origem.cidade} onChange={campo('cidade')} /></div>
            <div><label>UF</label><select value={origem.uf} onChange={campo('uf')}>{UFS.map((u) => <option key={u} value={u}>{u}</option>)}</select></div>
          </div>

          <h4 style={{ marginBottom: 4 }}>Qual cartão você usa?</h4>
          <Opcao valor="jae" atual={modalidade} aoEscolher={trocarModalidade} titulo="JAE" ajuda="Ônibus municipal, van, BRT, cabritinho e VLT." />
          <Opcao valor="riocard" atual={modalidade} aoEscolher={trocarModalidade} titulo="RIOCARD" ajuda="Ônibus intermunicipal, barca, metrô e trem (ônibus municipal só junto com outro transporte do Riocard)." />
          <Opcao valor="jae_riocard" atual={modalidade} aoEscolher={trocarModalidade} titulo="JAE + RIOCARD" ajuda="Usa os dois: por exemplo van (JAE) + metrô (Riocard)." />
          <Opcao valor="diferente" atual={modalidade} aoEscolher={trocarModalidade} titulo="Meu caso é diferente" ajuda="O seu trajeto não se encaixa nas opções acima. O RH vai te ajudar." />

          {usaJae && (<><label>{modalidade === 'jae_riocard' ? 'Transportes do JAE que você usa' : 'Quais transportes você usa?'}</label><Caixas itens={V.TRANSPORTES.jae} marcados={jae} aoMarcar={(k) => alternar(jae, setJae, k)} /></>)}
          {modalidade === 'riocard' && (<><label>Quais transportes do Riocard você usa? <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(no máximo 2)</span></label><Caixas itens={V.TRANSPORTES.riocard} marcados={riocard} aoMarcar={(k) => alternar(riocard, setRiocard, k)} /></>)}
          {modalidade === 'jae_riocard' && (<><label>E no Riocard, qual você usa? <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(só um)</span></label><Caixas itens={V.TRANSPORTES.riocardCombinado} marcados={riocard} aoMarcar={(k) => setRiocard(riocard.includes(k) ? [] : [k])} /></>)}
          {modalidade === 'diferente' && (<><label>Conte o seu caso</label><textarea value={caso} onChange={(e) => setCaso(e.target.value)} rows={3} placeholder="Ex.: pego van, depois trem e metrô..." /></>)}

          {usaRio && (
            <Aviso>
              <b>⚠️ Atenção ao BUI.</b> Para usar o Riocard você precisa ter o <b>BUI (Bilhete Único Intermunicipal) ativo</b>.
              <div style={{ margin: '6px 0 2px' }}>Você tem o BUI ativo?</div>
              {Object.entries(V.BUI).map(([k, rot]) => <label key={k} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', marginRight: 14, fontWeight: 400 }}><input type="radio" name="bui" checked={bui === k} onChange={() => setBui(k)} style={{ width: 'auto' }} />{rot}</label>)}
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Se não tem ou não sabe, tudo bem: você continua e o RH entra em contato para ajudar.</div>
              <label style={{ marginTop: 8 }}>Número do Riocard <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(se quiser informar)</span></label>
              <input value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="numeric" />
            </Aviso>
          )}

          {modalidade === 'diferente' ? <Aviso cor="var(--border)" fundo="#f6f8f6">Neste caso o valor não é calculado: o RH vai analisar e falar com você.</Aviso> : calc && (calc.ok ? (
            <Aviso cor="var(--verde)" fundo="var(--verde-pastel)">
              <b>{V.reais(calc.viagem)} por viagem</b> · <b>{V.reais(calc.dia)} por dia</b> (ida e volta)<br />
              <span style={{ fontSize: 12 }}>Cerca de {V.reais(mensal)} neste mês ({V.diasNoMes(agora.getFullYear(), agora.getMonth() + 1)} dias), antes dos descontos de folgas e faltas.</span>
            </Aviso>
          ) : <Aviso cor="var(--danger)" fundo="#fdecea">{calc.erro}</Aviso>)}

          {linksVivos && (
            <div style={{ margin: '10px 0' }}>
              <div style={{ fontSize: 13, marginBottom: 4 }}>Veja no Google Maps as linhas que servem para o seu trajeto:</div>
              <a href={linksVivos.ida} target="_blank" rel="noreferrer" style={{ marginRight: 12 }}>🗺️ Ver trajeto de ida</a><a href={linksVivos.volta} target="_blank" rel="noreferrer">🗺️ Ver trajeto de volta</a>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>O Google mostra ônibus, metrô e trem. Vans e cabritinhos podem não aparecer: se você usa, marque acima do mesmo jeito.</div>
            </div>
          )}
        </>
      )}

      {erro && <div className="erro" role="alert">{erro}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="button" onClick={salvar} disabled={salvando || !usa || (usa === 'nao' && (!aceite || !st.termoParaLer))}>{salvando ? 'Salvando...' : usa === 'nao' ? 'Aceitar e enviar' : 'Salvar'}</button>
        {st.mapeado && aoCancelar && <button type="button" className="secundario" onClick={aoCancelar}>Cancelar</button>}
      </div>
    </div>
  );
}

function FormSaldo({ saldo, aoEnviado }) {
  const [jae, setJae] = useState(''); const [rio, setRio] = useState(''); const [arquivos, setArquivos] = useState([]);
  const [erro, setErro] = useState(''); const [enviando, setEnviando] = useState(false);
  const temJae = saldo.cartoes.includes('jae'); const temRio = saldo.cartoes.includes('riocard');

  async function escolher(e) {
    setErro('');
    const novos = [...e.target.files]; e.target.value = '';
    const prontos = [];
    for (const f of novos) prontos.push(await prepararArquivo(f));
    setArquivos([...arquivos, ...prontos].slice(0, 2));
    if (arquivos.length + prontos.length > 2) setErro('Só cabem 2 arquivos: ficaram os 2 primeiros.');
  }
  async function enviar() {
    setErro('');
    if (temJae && V.lerReais(jae) === null) return setErro('Informe o saldo do cartão Jaé (ex.: 12,50).');
    if (temRio && V.lerReais(rio) === null) return setErro('Informe o saldo do cartão Riocard (ex.: 12,50).');
    if (arquivos.length < saldo.anexosMinimos) return setErro(saldo.anexosMinimos === 2 ? 'Anexe o comprovante dos dois cartões (Jaé e Riocard): são 2 arquivos.' : 'Anexe pelo menos 1 foto ou PDF do saldo.');
    if (arquivos.some((f) => f.size > MAX_ARQUIVO) || arquivos.reduce((n, f) => n + f.size, 0) > MAX_TOTAL) return setErro('Os arquivos estão muito grandes (até 4 MB no total). Tire a foto de novo com menos qualidade.');
    const f = new FormData(); f.set('coletaId', saldo.coletaId); f.set('saldoJae', jae); f.set('saldoRiocard', rio);
    arquivos.forEach((a) => f.append('arquivo', a, a.name));
    setEnviando(true);
    try {
      const r = await fetch('/api/vt/saldo', { method: 'POST', body: f });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return setErro(j.erro || 'Não foi possível enviar. Tente de novo.');
      aoEnviado();
    } catch { setErro('Sem conexão. Tente de novo.'); } finally { setEnviando(false); }
  }

  return (
    <div>
      {temJae && <><label>Saldo do cartão Jaé hoje (R$)</label><input value={jae} onChange={(e) => setJae(e.target.value)} inputMode="decimal" placeholder="0,00" /></>}
      {temRio && <><label>Saldo do cartão Riocard hoje (R$)</label><input value={rio} onChange={(e) => setRio(e.target.value)} inputMode="decimal" placeholder="0,00" /></>}
      <label>{saldo.anexosMinimos === 2 ? 'Foto ou PDF do saldo dos dois cartões (2 arquivos)' : 'Foto ou PDF do saldo (até 2 arquivos)'}</label>
      <input type="file" accept="image/jpeg,image/png,application/pdf" multiple onChange={escolher} />
      {arquivos.map((a, i) => <div key={i} style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>📎 {a.name} <button type="button" className="secundario" style={{ padding: '2px 8px' }} onClick={() => setArquivos(arquivos.filter((_, j) => j !== i))}>Remover</button></div>)}
      {erro && <div className="erro" role="alert">{erro}</div>}
      <button type="button" onClick={enviar} disabled={enviando} style={{ marginTop: 8 }}>{enviando ? 'Enviando...' : 'Enviar saldo'}</button>
    </div>
  );
}

export default function ValeTransporte() {
  const router = useRouter();
  const [st, setSt] = useState(undefined);
  const [editando, setEditando] = useState(false);
  const [msg, setMsg] = useState('');
  const [reenviando, setReenviando] = useState(false);

  async function carregar() {
    try { const r = await fetch('/api/vt'); setSt(r.ok ? await r.json() : null); } catch { setSt(null); }
  }
  useEffect(() => { carregar(); }, []);

  const topo = (<><NavColaborador /><BotaoVoltar /><h2>Vale-transporte</h2></>);
  if (st === undefined) return <div>{topo}<p>Carregando...</p></div>;
  if (!st || !st.disponivel) return <div>{topo}<div className="card">O vale-transporte ainda não está disponível. Tente novamente mais tarde.</div></div>;

  const formulario = (!st.mapeado || st.pendencia || editando) && st.podeEditar;
  const saldo = st.saldo;
  return (
    <div>
      {topo}
      {msg && <div className="card" style={{ background: 'var(--verde-pastel)' }} role="status">{msg}</div>}
      {saldo && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>💳 {saldo.titulo}</h3>
          {saldo.prazo && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px' }}>Envie até {dataBR(saldo.prazo)}.</p>}
          {saldo.status === 'refazer' && <Aviso>O RH pediu para você enviar de novo: <b>{saldo.motivoRefazer}</b></Aviso>}
          {saldo.respondido && !reenviando ? (
            <>
              <p style={{ fontSize: 14 }}>✅ Enviado em {dataBR(saldo.enviado.informadoEm)}{saldo.enviado.jaeCentavos !== null ? ` · Jaé ${V.reais(saldo.enviado.jaeCentavos)}` : ''}{saldo.enviado.riocardCentavos !== null ? ` · Riocard ${V.reais(saldo.enviado.riocardCentavos)}` : ''}</p>
              <button type="button" className="secundario" onClick={() => setReenviando(true)}>Enviar de novo</button>
            </>
          ) : <FormSaldo saldo={saldo} aoEnviado={() => { setMsg('Saldo enviado. Obrigado!'); setReenviando(false); carregar(); }} />}
        </div>
      )}
      {st.mapeado && !formulario && <Resumo st={st} aoEditar={() => setEditando(true)} />}
      {formulario && <FormMapeamento st={st} aoCancelar={st.mapeado && !st.pendencia ? () => setEditando(false) : null} aoSalvo={() => { setEditando(false); setMsg(st.mapeado ? 'Transporte atualizado. Obrigado!' : 'Transporte informado. Obrigado!'); carregar(); }} />}
      {!st.mapeado && !st.podeEditar && <div className="card">Aguarde: o RH precisa liberar o seu preenchimento.</div>}
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>Dúvidas? <a href="/nova-solicitacao" onClick={(e) => { e.preventDefault(); router.push('/nova-solicitacao'); }}>Abra uma solicitação ao RH</a>.</p>
    </div>
  );
}
