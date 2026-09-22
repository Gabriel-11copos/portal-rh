'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const rotulos = {
  aberta: 'Pendente',
  em_analise: 'Pendente',
  respondida: 'Em andamento',
  encerrada: 'Encerrada',
};

function diasRestantes(prazo) {
  if (!prazo) return null;
  return Math.ceil((new Date(prazo) - new Date()) / (1000 * 60 * 60 * 24));
}

function pertenceAoFiltro(s, chave) {
  const dias = diasRestantes(s.prazo);
  switch (chave) {
    case 'pendente': return s.status === 'aberta' || s.status === 'em_analise';
    case 'no_prazo': return s.status !== 'encerrada' && dias !== null && dias >= 0;
    case 'atrasadas': return s.status !== 'encerrada' && dias !== null && dias < 0;
    case 'em_andamento': return s.status === 'respondida';
    case 'encerradas': return s.status === 'encerrada';
    default: return true; // todas
  }
}

const FILTROS = [
  { chave: 'todas', label: 'Todas' },
  { chave: 'pendente', label: 'Pendente' },
  { chave: 'no_prazo', label: 'No prazo' },
  { chave: 'atrasadas', label: 'Atrasadas' },
  { chave: 'em_andamento', label: 'Em andamento' },
  { chave: 'encerradas', label: 'Encerradas' },
];

export default function AdminPainel() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [filtro, setFiltro] = useState('todas');
  const [colaboradorBusca, setColaboradorBusca] = useState('');
  const [lojaBusca, setLojaBusca] = useState('');
  const [dataDe, setDataDe] = useState('');
  const [dataAte, setDataAte] = useState('');
  const router = useRouter();

  async function sair() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  useEffect(() => {
    fetch('/api/solicitacoes').then((r) => r.json()).then(setSolicitacoes);
  }, []);

  const colaboradoresUnicos = useMemo(
    () => [...new Map(solicitacoes.map((s) => [s.colaborador.id, s.colaborador])).values()]
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    [solicitacoes]
  );
  const lojasUnicas = useMemo(
    () => [...new Set(solicitacoes.map((s) => s.colaborador.loja))].sort(),
    [solicitacoes]
  );

  function passaOutrosFiltros(s) {
    const nomeExibido = (s.colaborador.nomeSocial || s.colaborador.nome).toLowerCase();
    const bateColaborador = !colaboradorBusca || nomeExibido.includes(colaboradorBusca.toLowerCase());
    const bateLoja = !lojaBusca || s.colaborador.loja.toLowerCase().includes(lojaBusca.toLowerCase());
    const dataAbertura = new Date(s.dataAbertura);
    const bateDataDe = !dataDe || dataAbertura >= new Date(dataDe);
    const bateDataAte = !dataAte || dataAbertura <= new Date(dataAte + 'T23:59:59');
    return bateColaborador && bateLoja && bateDataDe && bateDataAte;
  }

  const contagemPorFiltro = Object.fromEntries(
    FILTROS.map((f) => [
      f.chave,
      solicitacoes.filter((s) => pertenceAoFiltro(s, f.chave) && passaOutrosFiltros(s)).length,
    ])
  );

  const filtradas = solicitacoes.filter((s) => pertenceAoFiltro(s, filtro) && passaOutrosFiltros(s));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>Painel RH / DP</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/admin/colaboradores"><button className="secundario">Colaboradores</button></Link>
          <Link href="/admin/comunicados"><button className="secundario">Enviar comunicado</button></Link>
          <Link href="/admin/assuntos"><button className="secundario">Assuntos</button></Link>
          <Link href="/admin/conteudos"><button className="secundario">Conteúdos</button></Link>
          <Link href="/admin/documentos"><button className="secundario">Documentos</button></Link>
          <Link href="/admin/usuarios"><button className="secundario">Usuários</button></Link>
          <button className="secundario" onClick={sair}>Sair</button>
        </div>
      </div>

      <div className="filtros-status">
        {FILTROS.map((f) => (
          <button
            key={f.chave}
            className={filtro === f.chave ? 'ativo' : ''}
            onClick={() => setFiltro(f.chave)}
          >
            {f.label}
            {f.chave !== 'encerradas' && contagemPorFiltro[f.chave] > 0 && (
              <span className="bolinha-notificacao">{contagemPorFiltro[f.chave]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="card" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ minWidth: 200 }}>
          <label>Colaborador</label>
          <input
            list="lista-colaboradores"
            placeholder="Digite para buscar..."
            value={colaboradorBusca}
            onChange={(e) => setColaboradorBusca(e.target.value)}
            style={{ marginBottom: 0 }}
          />
          <datalist id="lista-colaboradores">
            {colaboradoresUnicos.map((c) => (
              <option key={c.id} value={c.nomeSocial || c.nome} />
            ))}
          </datalist>
        </div>
        <div style={{ minWidth: 180 }}>
          <label>Loja</label>
          <input
            list="lista-lojas"
            placeholder="Digite para buscar..."
            value={lojaBusca}
            onChange={(e) => setLojaBusca(e.target.value)}
            style={{ marginBottom: 0 }}
          />
          <datalist id="lista-lojas">
            {lojasUnicas.map((l) => <option key={l} value={l} />)}
          </datalist>
        </div>
        <div>
          <label>De</label>
          <input type="date" value={dataDe} onChange={(e) => setDataDe(e.target.value)} style={{ marginBottom: 0 }} />
        </div>
        <div>
          <label>Até</label>
          <input type="date" value={dataAte} onChange={(e) => setDataAte(e.target.value)} style={{ marginBottom: 0 }} />
        </div>
        {(colaboradorBusca || lojaBusca || dataDe || dataAte) && (
          <button
            type="button"
            className="secundario"
            onClick={() => { setColaboradorBusca(''); setLojaBusca(''); setDataDe(''); setDataAte(''); }}
          >
            Limpar filtros
          </button>
        )}
      </div>

      {filtradas.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhuma solicitação nesse filtro.</p>}

      {filtradas.map((s) => {
        const dias = diasRestantes(s.prazo);
        const atrasada = s.status !== 'encerrada' && dias !== null && dias < 0;
        return (
          <Link key={s.id} href={`/admin/solicitacao/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span className="numero-solicitacao">#{s.numero} · </span>
                  <b>{s.assunto.nome}</b>
                </div>
                <span
                  className={`badge ${atrasada ? 'encerrada' : s.status}`}
                  style={atrasada ? { background: '#fed7d7', color: 'var(--danger)' } : {}}
                >
                  {atrasada ? 'Atrasada' : rotulos[s.status]}
                </span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--muted)' }}>
                {s.colaborador.nomeSocial || s.colaborador.nome} · {s.colaborador.loja}
              </p>
              {s.status !== 'encerrada' && dias !== null && (
                <span style={{ fontSize: 12, color: dias < 0 ? 'var(--danger)' : dias <= 1 ? 'var(--warning)' : 'var(--muted)' }}>
                  {dias < 0 ? `Atrasada há ${Math.abs(dias)} dia(s)` : dias === 0 ? 'Vence hoje' : `${dias} dias restantes`}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
