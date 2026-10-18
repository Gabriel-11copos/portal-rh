'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import NavColaborador from '../components/NavColaborador';
import Avatar from '../components/Avatar';
import CartaoAniversario from '../components/CartaoAniversario';
import GradeCaixinhas, { aplicarOrdemCaixinhas } from '../components/GradeCaixinhas';

// <ajudantes>
// Lista das caixinhas (na ordem padrão). Para acrescentar uma nova, é só incluir uma linha aqui
// (e tratar o id dela em montarCaixinhas, se ela tiver bolinha ou regra para aparecer).
const CAIXINHAS = [
  { id: 'solicitacoes', icon: '📨', title: 'Minhas solicitações', desc: 'Acompanhe seus pedidos ao RH e ao DP', href: '/minhas-solicitacoes' },
  { id: 'nova', icon: '✍️', title: 'Nova solicitação', desc: 'Envie um pedido ao RH ou ao DP', href: '/nova-solicitacao' },
  { id: 'comunicados', icon: '📢', title: 'Comunicados', desc: 'Avisos do RH e da empresa', href: '/comunicados' },
  { id: 'documentos', icon: '📄', title: 'Documentos', desc: 'Contracheques e outros documentos pessoais', href: '/documentos' },
  { id: 'gorjeta', icon: '💰', title: 'Minha gorjeta', desc: 'Extrato por período: apuração, descontos e valor líquido', href: '/gorjeta' },
  { id: 'escala', icon: '🗓️', title: 'Minha escala', desc: 'Veja seus turnos da semana', href: '/escala' },
  { id: 'conquistas', icon: '🏅', title: 'Minhas conquistas', desc: 'Veja seus selos', href: '/conquistas' },
  { id: 'missoes', icon: '🎯', title: 'Missões', desc: 'Cumpra missões e ganhe selos e recompensas', href: '/missoes' },
  { id: 'guias', icon: '📖', title: 'Guias e treinamentos', desc: 'Passo a passo, manuais e treinamentos', href: '/guias' },
  { id: 'conteudos', icon: '📚', title: 'Conteúdos', desc: 'Cursos, links úteis, contatos, benefícios, regras e manuais', href: '/conteudos' },
  { id: 'perfil', icon: '👤', title: 'Meu perfil', desc: 'Foto, nome social e seus dados', href: '/perfil' },
];

function primeiroNome(nome) {
  return String(nome || '').trim().split(/\s+/)[0] || '';
}

// "Hoje: 18:00 às 02:00 · Loja" (mesma regra do antigo cartão da escala)
function resumoEscala(escala) {
  if (!escala || !escala.liberada) return null;
  const hoje = escala.dias && escala.dias[0];
  if (!hoje || hoje.erro) return 'Veja seus turnos da semana';
  const turno = (hoje.itens || []).find((i) => i.status === 'TRABALHO' && i.entrada && i.saida);
  if (turno) return `Hoje: ${turno.entrada} às ${turno.saida}${turno.lojaNome ? ` · ${turno.lojaNome}` : ''}`;
  if ((hoje.itens || []).length === 0) return 'Hoje: sem escala lançada';
  return 'Hoje: sem turno de trabalho';
}

// Decide quais caixinhas aparecem e com qual bolinha. Gorjeta, escala e guias só aparecem
// quando a pessoa tem algo para ver (como acontecia com os cartões soltos de antes).
function montarCaixinhas(d) {
  const lista = [];
  for (const base of CAIXINHAS) {
    if (base.id === 'gorjeta' && !(d.gorjeta && d.gorjeta.total > 0)) continue;
    if (base.id === 'escala' && !(d.escala && d.escala.liberada)) continue;
    if (base.id === 'guias' && !(d.guias > 0)) continue;
    if (base.id === 'missoes' && !(d.missoes && d.missoes.total > 0)) continue;

    const c = { ...base };
    if (c.id === 'solicitacoes') c.contador = d.solicitacoes;
    if (c.id === 'documentos') c.contador = d.documentos;
    if (c.id === 'comunicados') c.contador = d.comunicadosNaoLidos;
    if (c.id === 'gorjeta') c.contador = d.gorjeta.naoVistas;
    if (c.id === 'escala') c.desc = resumoEscala(d.escala) || c.desc;
    if (c.id === 'conquistas' && d.conquistas) {
      c.contador = d.conquistas.novos;
      if (d.conquistas.total > 0) c.desc = `${d.conquistas.total} conquista${d.conquistas.total > 1 ? 's' : ''}`;
      else if (d.conquistas.tempo && d.conquistas.tempo.proximo) c.desc = `Próximo selo: ${d.conquistas.tempo.proximo.nome}`;
    }
    if (c.id === 'missoes') {
      c.contador = d.missoes.novos;
      if (d.missoes.disponiveis > 0) c.desc = `${d.missoes.disponiveis} ${d.missoes.disponiveis === 1 ? 'missão para cumprir' : 'missões para cumprir'}`;
    }
    if (c.id === 'guias') c.desc = `${d.guias} ${d.guias === 1 ? 'guia disponível' : 'guias disponíveis'}`;
    lista.push(c);
  }
  return lista;
}
// </ajudantes>

// Busca um endereço sem nunca dar erro: se falhar, devolve null e a tela segue.
async function buscar(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

async function preferencias(acao, ordem) {
  try {
    const res = await fetch('/api/preferencias-colaborador', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao, ordem }),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null; // se falhar, a tela continua com a ordem que já tem
  }
}

const VAZIO = { solicitacoes: 0, documentos: 0, comunicadosNaoLidos: 0, gorjeta: null, escala: null, conquistas: null, guias: 0, missoes: null, atualizacao: null };

export default function Inicio() {
  const router = useRouter();
  const [perfil, setPerfil] = useState(null);
  const [falhou, setFalhou] = useState(false);
  const [dados, setDados] = useState(VAZIO);
  const [pronto, setPronto] = useState(false);
  const [organizando, setOrganizando] = useState(false);
  const [ordem, setOrdem] = useState(null);   // null = ordem padrão

  async function carregarComunicados() {
    const lista = await buscar('/api/comunicados');
    if (Array.isArray(lista)) setDados((d) => ({ ...d, comunicadosNaoLidos: lista.filter((c) => !c.lido).length }));
  }

  // números das bolinhas (rápidos, só banco de dados)
  async function carregarNumeros() {
    const [sol, doc, gor, con, gui, mis, atu] = await Promise.all([
      buscar('/api/solicitacoes/nao-vistas'),
      buscar('/api/documentos/nao-vistas'),
      buscar('/api/gorjetas/nao-vistas'),
      buscar('/api/conquistas'),
      buscar('/api/guias'),
      buscar('/api/missoes'),
      buscar('/api/dados-pessoais/status'),
    ]);
    setDados((d) => ({
      ...d,
      solicitacoes: (sol && sol.count) || 0,
      documentos: (doc && doc.count) || 0,
      gorjeta: gor && typeof gor.total === 'number' ? gor : null,
      conquistas: con && !con.erro ? con : null,
      guias: Array.isArray(gui) ? gui.length : 0,
      missoes: mis && Array.isArray(mis.missoes)
        ? { total: mis.missoes.length, disponiveis: mis.missoes.filter((m) => m.estado === 'disponivel').length, novos: mis.novos || 0 }
        : null,
      atualizacao: atu && atu.pendente && atu.campanha ? atu.campanha : null,
    }));
    await carregarComunicados();
  }

  useEffect(() => {
    let vivo = true;
    (async () => {
      const p = await buscar('/api/perfil');
      if (!vivo) return;
      if (!p || p.erro) { setFalhou(true); return; }
      setPerfil(p);
      await carregarNumeros();
      if (vivo) setPronto(true);
    })();
    preferencias('ler').then((d) => { if (vivo && d && Array.isArray(d.ordem)) setOrdem(d.ordem); });
    // a escala pode demorar (o serviço de escalas às vezes "acorda"): a caixinha aparece quando chegar
    buscar('/api/escala?dias=1').then((e) => { if (vivo && e && !e.erro) setDados((d) => ({ ...d, escala: e })); });

    const atualizar = setInterval(carregarNumeros, 90000);
    const aoLerComunicado = () => carregarComunicados();
    window.addEventListener('comunicados-lidos', aoLerComunicado);
    return () => { vivo = false; clearInterval(atualizar); window.removeEventListener('comunicados-lidos', aoLerComunicado); };
  }, []);

  function reordenar(novaOrdem) {
    setOrdem(novaOrdem);                  // muda na hora
    preferencias('salvar', novaOrdem);    // e grava em segundo plano
  }

  async function restaurar() {
    setOrdem(null);
    await preferencias('restaurar');
  }

  if (falhou) {
    return (
      <div>
        <NavColaborador />
        <div className="erro">Não foi possível carregar seus dados. Atualize a página ou entre de novo.</div>
      </div>
    );
  }

  if (!perfil || !pronto) {
    return (
      <div>
        <NavColaborador />
        <p style={{ color: 'var(--muted)' }}>Carregando...</p>
      </div>
    );
  }

  const nomeExibido = perfil.nomeSocial || perfil.nome;
  const cards = aplicarOrdemCaixinhas(montarCaixinhas(dados), ordem);

  function abrir(id) {
    const c = cards.find((x) => x.id === id);
    if (c) router.push(c.href);
  }

  return (
    <div>
      <NavColaborador />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', margin: '4px 0 6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar fotoUrl={perfil.fotoUrl} nome={nomeExibido} size={56} />
          <div>
            <h2 style={{ margin: 0 }}>Olá, {primeiroNome(nomeExibido)}!</h2>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {[perfil.cargo, perfil.loja].filter(Boolean).join(' · ') || 'O que você precisa fazer hoje?'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {organizando && <button type="button" className="secundario" onClick={restaurar}>Restaurar ordem padrão</button>}
          <button type="button" className={organizando ? '' : 'secundario'} onClick={() => setOrganizando((v) => !v)}>
            {organizando ? '✔ Concluir' : '✋ Organizar caixinhas'}
          </button>
        </div>
      </div>

      {organizando && (
        <p style={{ margin: '8px 0 14px', fontSize: 13, color: 'var(--muted)' }}>
          Arraste as caixinhas para mudar a ordem (no celular, segure um instante e arraste). A sua ordem fica salva só para você.
        </p>
      )}

      <div style={{ marginTop: 14 }}>
        {dados.atualizacao && (
          <div className="card" style={{ background: '#fff8e1', borderColor: '#f5d77a', marginBottom: 14 }}>
            <b>📋 {dados.atualizacao.titulo}</b>
            <p style={{ fontSize: 14, margin: '6px 0 10px' }}>
              {dados.atualizacao.mensagem || 'O RH liberou a atualização dos seus dados. Falta você informar telefone, e-mail, endereço e enviar um comprovante de residência.'}
            </p>
            {dados.atualizacao.prazo && (
              <p style={{ fontSize: 13, margin: '0 0 10px' }}>⏳ Faça até {new Date(dados.atualizacao.prazo).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}.</p>
            )}
            <button type="button" onClick={() => router.push('/atualizar-dados')}>Atualizar agora</button>
          </div>
        )}
        <CartaoAniversario />
        <GradeCaixinhas cards={cards} organizando={organizando} onAbrir={abrir} onReordenar={reordenar} />
      </div>
    </div>
  );
}
