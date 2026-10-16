'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GradeCaixinhas, { aplicarOrdemCaixinhas } from '../components/GradeCaixinhas';

// <ajudantes>
// Lista das caixinhas (na ordem padrão). Para acrescentar uma nova, é só incluir uma linha aqui.
const CAIXINHAS = [
  { id: 'solicitacoes', icon: '📨', title: 'Solicitações', desc: 'Pedidos dos colaboradores ao RH e ao DP', href: '/admin/solicitacoes' },
  { id: 'colaboradores', icon: '👥', title: 'Colaboradores', desc: 'Cadastro, lista de ativos e histórico', href: '/admin/colaboradores' },
  { id: 'comunicados', icon: '📢', title: 'Enviar comunicado', desc: 'Avisos para um, vários ou todos', href: '/admin/comunicados' },
  { id: 'documentos', icon: '📄', title: 'Documentos', desc: 'Contracheques e documentos por colaborador', href: '/admin/documentos' },
  { id: 'gorjetas', icon: '💰', title: 'Gorjetas', desc: 'Extrato de gorjeta por unidade e período', href: '/admin/gorjetas' },
  { id: 'aniversariantes', icon: '🎂', title: 'Aniversariantes', desc: 'Quem faz aniversário no mês e o cartão de parabéns', href: '/admin/aniversariantes' },
  { id: 'selos', icon: '🏅', title: 'Selos', desc: 'Reconhecimentos, presença e tempo de casa', href: '/admin/selos' },
  { id: 'missoes', icon: '🎯', title: 'Missões', desc: 'Missões, aprovações e recompensas', href: '/admin/missoes' },
  { id: 'escala', icon: '🗓️', title: 'Escala (prévia)', desc: 'Ver a escala de um colaborador como ele vê', href: '/admin/escala-previa' },
  { id: 'guias', icon: '📖', title: 'Guias e treinamentos', desc: 'Páginas com texto, imagens, arquivos e links', href: '/admin/guias' },
  { id: 'conteudos', icon: '📚', title: 'Conteúdos', desc: 'Cursos, links, benefícios, regras e manuais', href: '/admin/conteudos' },
  { id: 'assuntos', icon: '🗂️', title: 'Assuntos', desc: 'Tipos de pedido, prazos e respostas automáticas', href: '/admin/assuntos' },
  { id: 'usuarios', icon: '👤', title: 'Usuários', desc: 'Quem acessa o painel do RH', href: '/admin/usuarios' },
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
function montarCaixinhas(base, resumo, aniversariosHoje, missoes = null) {
  return base.map((c) => {
    if (c.id === 'solicitacoes' && resumo) {
      return {
        ...c,
        contador: resumo.pendentes,
        aviso: resumo.atrasadas > 0 ? `⏰ ${resumo.atrasadas} atrasada${resumo.atrasadas > 1 ? 's' : ''}` : null,
      };
    }
    if (c.id === 'missoes' && missoes) {
      return { ...c, contador: missoes.pendentes, aviso: missoes.aEntregar > 0 ? `🎁 ${missoes.aEntregar} a entregar` : null };
    }
    if (c.id === 'aniversariantes' && aniversariosHoje > 0) {
      return { ...c, aviso: `🎂 ${aniversariosHoje} hoje` };
    }
    return c;
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
  const [nome, setNome] = useState('');

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

  // números das bolinhas: ao abrir e a cada 90 segundos (a tela nunca some durante a atualização)
  useEffect(() => {
    let vivo = true;
    async function atualizar() {
      try {
        const r = await fetch('/api/solicitacoes');
        const d = await r.json();
        if (vivo && r.ok && Array.isArray(d)) setResumo(calcularResumo(d, new Date()));
      } catch { /* sem internet agora: mantém o número que já tinha */ }
      try {
        const r = await fetch('/api/aniversariantes');
        const d = await r.json();
        if (vivo && r.ok) setAniversariosHoje(contarAniversariantesHoje(d));
      } catch { /* idem */ }
      try {
        const r = await fetch('/api/missoes-admin');
        const d = await r.json();
        if (vivo && r.ok) setMissoes({ pendentes: (d.pendentes || []).length, aEntregar: (d.aEntregar || []).length });
      } catch { /* idem */ }
    }
    atualizar();
    const t = setInterval(atualizar, 90000);
    return () => { vivo = false; clearInterval(t); };
  }, []);

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

  const cards = aplicarOrdemCaixinhas(montarCaixinhas(CAIXINHAS, resumo, aniversariosHoje, missoes), ordem);

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
