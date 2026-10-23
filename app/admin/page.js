'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GradeCaixinhas, { aplicarOrdemCaixinhas } from '../components/GradeCaixinhas';

// <ajudantes>
// Lista das caixinhas (na ordem padrão). Para acrescentar uma nova, é só incluir uma linha aqui.
const CAIXINHAS = [
  { id: 'solicitacoes', icon: '📨', title: 'Solicitações', desc: 'Pedidos dos colaboradores ao RH e ao DP', href: '/admin/solicitacoes' },
  { id: 'atendimento', icon: '📥', title: 'Meus atendimentos', desc: 'Solicitações dos assuntos que você atende', href: '/admin/solicitacoes' },
  { id: 'colaboradores', icon: '👥', title: 'Colaboradores', desc: 'Cadastro, lista de ativos e histórico', href: '/admin/colaboradores' },
  { id: 'comunicados', icon: '📢', title: 'Enviar comunicado', desc: 'Avisos para um, vários ou todos', href: '/admin/comunicados' },
  { id: 'documentos', icon: '📄', title: 'Enviar documento', desc: 'Envie um documento a um colaborador', href: '/admin/enviar-documento' },
  { id: 'contracheques', icon: '🧾', title: 'Distribuir contracheques', desc: 'Envie os PDFs e cada colaborador recebe o dele', href: '/admin/contracheques' },
  { id: 'gorjetas', icon: '💰', title: 'Gorjetas', desc: 'Extrato de gorjeta por unidade e período', href: '/admin/gorjetas' },
  { id: 'aniversariantes', icon: '🎂', title: 'Aniversariantes', desc: 'Quem faz aniversário no mês e o cartão de parabéns', href: '/admin/aniversariantes' },
  { id: 'selos', icon: '🏅', title: 'Selos', desc: 'Reconhecimentos, presença e tempo de casa', href: '/admin/selos' },
  { id: 'dados', icon: '📋', title: 'Atualização de dados', desc: 'Libere a atualização cadastral e acompanhe', href: '/admin/atualizacao-dados' },
  { id: 'missoes', icon: '🎯', title: 'Missões', desc: 'Missões, aprovações e recompensas', href: '/admin/missoes' },
  { id: 'moedas', icon: 'moeda', title: 'Moedas', desc: 'Regras, prêmios e trocas', href: '/admin/moedas' },
  { id: 'whatsapp', icon: '💬', title: 'WhatsApp', desc: 'Avisos automáticos e fila de envios', href: '/admin/whatsapp' },
  { id: 'escala', icon: '🗓️', title: 'Escala (prévia)', desc: 'Ver a escala de um colaborador como ele vê', href: '/admin/escala-previa' },
  { id: 'guias', icon: '📖', title: 'Guias e treinamentos', desc: 'Páginas com texto, imagens, arquivos e links', href: '/admin/guias' },
  { id: 'conteudos', icon: '📚', title: 'Conteúdos', desc: 'Cursos, links, benefícios, regras e manuais', href: '/admin/conteudos' },
  { id: 'assuntos', icon: '🗂️', title: 'Assuntos', desc: 'Tipos de pedido, prazos e respostas automáticas', href: '/admin/assuntos' },
  { id: 'usuarios', icon: '👤', title: 'Usuários', desc: 'Quem acessa o painel do RH e o seu perfil', href: '/admin/usuarios' },
  { id: 'perfil', icon: '🙂', title: 'Meu perfil', desc: 'Sua foto e seus dados no painel', href: '/admin/usuarios' },
  { id: 'permissoes', icon: '🔐', title: 'Permissões', desc: 'Defina o que cada usuário pode fazer', href: '/admin/permissoes' },
];

// Números do menu. A bolinha mostra só o que está ESPERANDO o RH (pendentes de resposta).
// "Atrasada" = não encerrada e com o prazo vencido (mesma regra da tela de solicitações).
function calcularResumo(solicitacoes, agora) {
  let pendentes = 0;
  let atrasadas = 0;
  for (const s of solicitacoes || []) {
    if (s.status === 'aberta' || s.status === 'em_analise') pendentes++;
    if (s.status !== 'encerrada' && s.prazo && new Date(s.prazo) < agora) atrasadas++;
  }
  return { pendentes, atrasadas };
}

// Quantos aniversariantes do mês fazem aniversário hoje (resposta de /api/aniversariantes).
function contarAniversariantesHoje(dados) {
  if (!dados || !Array.isArray(dados.aniversariantes) || !dados.hoje) return 0;
  const mes = Number(dados.hoje.slice(5, 7));
  const dia = Number(dados.hoje.slice(8, 10));
  return dados.aniversariantes.filter((a) => a.mes === mes && a.dia === dia).length;
}

// Primeiro nome para a saudação ("Gabriel Silva" -> "Gabriel"). Vazio se não houver nome.
function primeiroNomeSaudacao(nome) {
  if (typeof nome !== 'string') return '';
  return nome.trim().split(/\s+/)[0] || '';
}

// Monta a lista final: soma bolinha e aviso às caixinhas certas.
function montarCaixinhas(base, resumo, aniversariosHoje, missoes = null, atualizacao = null) {
  return base.map((c) => {
    if ((c.id === 'solicitacoes' || c.id === 'atendimento') && resumo) {
      return {
        ...c,
        contador: resumo.pendentes,
        aviso: resumo.atrasadas > 0 ? `⏰ ${resumo.atrasadas} atrasada${resumo.atrasadas > 1 ? 's' : ''}` : null,
      };
    }
    if (c.id === 'missoes' && missoes) {
      return { ...c, contador: missoes.pendentes, aviso: missoes.aEntregar > 0 ? `🎁 ${missoes.aEntregar} a entregar` : null };
    }
    if (c.id === 'dados' && atualizacao && atualizacao.ativa) {
      return { ...c, contador: atualizacao.pendentes, aviso: atualizacao.pendentes === 0 ? '✓ todos em dia' : null };
    }
    if (c.id === 'aniversariantes' && aniversariosHoje > 0) {
      return { ...c, aviso: `🎂 ${aniversariosHoje} hoje` };
    }
    return c;
  });
}
// Só as caixinhas que a pessoa pode abrir. Sem a informação de acesso (deu erro ao consultar), mostra todas:
// quem não pode abrir uma tela é barrado pelo servidor de qualquer jeito. Enquanto carrega (null), não mostra nenhuma.
function caixinhasVisiveis(base, acesso) {
  if (acesso === null || acesso === undefined) return [];
  if (acesso === false || !Array.isArray(acesso.paginas)) return base;
  return base.filter((c) => {
    if (c.id === 'atendimento') return acesso.escopoSolicitacoes === 'meus';
    if (c.id === 'solicitacoes') return acesso.escopoSolicitacoes === 'todas';
    if (c.id === 'usuarios') return acesso.perfil === 'master';     // gerenciar usuários é só do master
    if (c.id === 'perfil') return acesso.perfil !== 'master';        // quem não é master vê só o próprio perfil
    return acesso.paginas.includes(c.href);
  });
}
// </ajudantes>

export default function PainelRH() {
  const router = useRouter();
  const [organizando, setOrganizando] = useState(false);
  const [ordem, setOrdem] = useState(null);          // null = ordem padrão
  const [resumo, setResumo] = useState(null);
  const [aniversariosHoje, setAniversariosHoje] = useState(0);
  const [missoes, setMissoes] = useState(null);
  const [atualizacao, setAtualizacao] = useState(null);
  const [nome, setNome] = useState('');
  const [acesso, setAcesso] = useState(null);       // null = carregando; false = não deu para consultar

  async function preferencias(acao, novaOrdem) {
    try {
      const res = await fetch('/api/preferencias-painel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao, ordem: novaOrdem }),
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null; // se falhar, a tela continua funcionando com a ordem que já tem
    }
  }

  // ordem salva e nome de quem está logado (o nome vem da sessão do login; se faltar, a saudação some)
  useEffect(() => {
    preferencias('ler').then((d) => {
      if (!d) return;
      if (Array.isArray(d.ordem)) setOrdem(d.ordem);
      setNome(primeiroNomeSaudacao(d.nome));
    });
  }, []);

  // o que esta pessoa pode fazer (e renova a sessão dela se o master mudou as permissões): ao abrir e a cada 90 segundos
  useEffect(() => {
    let vivo = true;
    async function consultar() {
      try {
        const r = await fetch('/api/acesso');
        const d = await r.json();
        if (!vivo) return;
        if (r.ok) setAcesso(d);
        else if (r.status === 401 || r.status === 403) router.push('/login');   // sessão encerrada ou sem acesso
        else setAcesso((anterior) => anterior || false);
      } catch {
        if (vivo) setAcesso((anterior) => anterior || false);
      }
    }
    consultar();
    const t = setInterval(consultar, 90000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

  // só busca os números das telas a que a pessoa tem acesso
  const chaveDoAcesso = acesso === null ? null : acesso === false ? 'erro' : JSON.stringify([acesso.paginas, acesso.escopoSolicitacoes]);

  // números das bolinhas: ao abrir e a cada 90 segundos (a tela nunca some durante a atualização)
  useEffect(() => {
    if (chaveDoAcesso === null) return undefined;   // espera saber o que a pessoa pode ver
    const pode = (pagina) => acesso === false || (acesso.paginas || []).includes(pagina);
    const veSolicitacoes = acesso === false || acesso.escopoSolicitacoes !== 'nenhum';
    let vivo = true;
    async function atualizar() {
      try {
        if (!veSolicitacoes) throw new Error('sem acesso a solicitações');
        const r = await fetch('/api/solicitacoes');
        const d = await r.json();
        if (vivo && r.ok && Array.isArray(d)) setResumo(calcularResumo(d, new Date()));
      } catch { /* sem internet agora: mantém o número que já tinha */ }
      try {
        if (!pode('/admin/aniversariantes')) throw new Error('sem acesso');
        const r = await fetch('/api/aniversariantes');
        const d = await r.json();
        if (vivo && r.ok) setAniversariosHoje(contarAniversariantesHoje(d));
      } catch { /* idem */ }
      try {
        if (!pode('/admin/missoes')) throw new Error('sem acesso');
        const r = await fetch('/api/missoes-admin');
        const d = await r.json();
        if (vivo && r.ok) setMissoes({ pendentes: (d.pendentes || []).length, aEntregar: (d.aEntregar || []).length });
      } catch { /* idem */ }
      try {
        if (!pode('/admin/atualizacao-dados')) throw new Error('sem acesso');
        const r = await fetch('/api/atualizacao-dados-admin?resumo=1');
        const d = await r.json();
        if (vivo && r.ok) setAtualizacao({ ativa: !!d.ativa, pendentes: d.pendentes || 0 });
      } catch { /* idem */ }
    }
    atualizar();
    const t = setInterval(atualizar, 90000);
    return () => { vivo = false; clearInterval(t); };
  }, [chaveDoAcesso]);

  function reordenar(novaOrdem) {
    setOrdem(novaOrdem);                 // muda na hora
    preferencias('salvar', novaOrdem);   // e grava em segundo plano
  }

  async function restaurar() {
    setOrdem(null);
    await preferencias('restaurar');
  }

  async function sair() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const cards = aplicarOrdemCaixinhas(montarCaixinhas(caixinhasVisiveis(CAIXINHAS, acesso), resumo, aniversariosHoje, missoes, atualizacao), ordem);

  function abrir(id) {
    const c = CAIXINHAS.find((x) => x.id === id);
    if (c) router.push(c.href);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
        <div>
          <h2 style={{ margin: 0 }}>Painel RH / DP</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--muted)' }}>
            {nome ? `Olá, ${nome}! ` : ''}O que você precisa fazer hoje?
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {organizando && (
            <button type="button" className="secundario" onClick={restaurar}>Restaurar ordem padrão</button>
          )}
          <button
            type="button"
            className={organizando ? '' : 'secundario'}
            onClick={() => setOrganizando((v) => !v)}
          >
            {organizando ? '✔ Concluir' : '✋ Organizar caixinhas'}
          </button>
          {!organizando && <button type="button" className="secundario" onClick={sair}>Sair</button>}
        </div>
      </div>

      {organizando && (
        <p style={{ margin: '8px 0 14px', fontSize: 13, color: 'var(--muted)' }}>
          Arraste as caixinhas para mudar a ordem (no celular, segure um instante e arraste).
          A sua ordem fica salva só para você.
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        <GradeCaixinhas cards={cards} organizando={organizando} onAbrir={abrir} onReordenar={reordenar} />
      </div>
    </div>
  );
}
