'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function NavColaborador() {
  const router = useRouter();
  const pathname = usePathname();
  const [naoLidos, setNaoLidos] = useState([]);
  const [atualizacao, setAtualizacao] = useState(null);   // a atualização de dados que o RH liberou e ele ainda não fez
  const [avisoAberto, setAvisoAberto] = useState(false);
  const [moeda, setMoeda] = useState(null);   // saldo de moedas (só aparece com o programa ligado)

  useEffect(() => {
    fetch('/api/comunicados')
      .then((r) => r.json())
      .then((lista) => setNaoLidos(Array.isArray(lista) ? lista.filter((c) => !c.lido) : []))
      .catch(() => {});

    // atualização de dados pendente: aparece a janela de aviso uma vez a cada vez que ele entra no portal,
    // e a faixa fica nas telas até ele fazer (ou o RH dar baixa)
    fetch('/api/dados-pessoais/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!s || !s.pendente || !s.campanha) return;
        setAtualizacao(s.campanha);
        let jaVisto = false;
        try { jaVisto = sessionStorage.getItem(`aviso-dados:${s.campanha.id}`) === '1'; } catch { /* sem armazenamento: avisa sempre */ }
        if (!jaVisto) setAvisoAberto(true);
      })
      .catch(() => {});
  }, []);

  // o saldo no cantinho de cima; a carteira avisa (evento) quando ele muda, para atualizar na hora
  useEffect(() => {
    const ler = () => fetch('/api/moedas/saldo').then((r) => (r.ok ? r.json() : null)).then((s) => setMoeda(s && s.habilitada ? s : null)).catch(() => {});
    ler();
    window.addEventListener('moedas-atualizadas', ler);
    return () => window.removeEventListener('moedas-atualizadas', ler);
  }, []);

  async function sair() {
    // ao sair, esquece que o aviso da atualização de dados já foi mostrado: na próxima entrada ele aparece de novo
    try { Object.keys(sessionStorage).filter((k) => k.startsWith('aviso-dados:')).forEach((k) => sessionStorage.removeItem(k)); } catch { /* ok */ }
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  async function marcarLido() {
    const atual = naoLidos[0];
    await fetch(`/api/comunicados/${atual.id}/lido`, { method: 'POST' });
    setNaoLidos(naoLidos.slice(1));
    window.dispatchEvent(new Event('comunicados-lidos'));
  }

  function fecharAviso(ir) {
    try { sessionStorage.setItem(`aviso-dados:${atualizacao.id}`, '1'); } catch { /* ok */ }
    setAvisoAberto(false);
    if (ir) router.push('/atualizar-dados');
  }

  const naPaginaDeAtualizar = pathname === '/atualizar-dados';

  return (
    <div>
      {naoLidos.length > 0 && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }}>
          <div className="card" style={{ maxWidth: 420, width: '100%' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Comunicado do RH</div>
            <h3 style={{ marginTop: 0 }}>{naoLidos[0].assunto}</h3>
            <p style={{ fontSize: 14 }}>{naoLidos[0].texto}</p>
            {naoLidos[0].anexos?.map((a) => (
              <div key={a.id} style={{ marginBottom: 6 }}>
                <a href={a.linkDrive} target="_blank" rel="noreferrer">📎 {a.nomeArquivo}</a>
              </div>
            ))}
            <button onClick={marcarLido} style={{ marginTop: 8 }}>OK, entendi</button>
            {naoLidos.length > 1 && (
              <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 10 }}>
                +{naoLidos.length - 1} comunicado(s) depois deste
              </span>
            )}
          </div>
        </div>
      )}

      {naoLidos.length === 0 && avisoAberto && atualizacao && !naPaginaDeAtualizar && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }}>
          <div className="card" style={{ maxWidth: 420, width: '100%' }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Aviso do RH</div>
            <h3 style={{ marginTop: 0 }}>📋 {atualizacao.titulo}</h3>
            <p style={{ fontSize: 14 }}>
              {atualizacao.mensagem || 'O RH liberou a atualização dos seus dados. Falta você informar telefone, e-mail, endereço e enviar um comprovante de residência.'}
            </p>
            {atualizacao.prazo && <p style={{ fontSize: 13 }}>⏳ Faça até {new Date(atualizacao.prazo).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}.</p>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={() => fecharAviso(true)}>Atualizar agora</button>
              <button className="secundario" onClick={() => fecharAviso(false)}>Depois</button>
            </div>
          </div>
        </div>
      )}

      <div className="topo-marca">
        {moeda && (
          <Link
            href="/missoes/carteira"
            title={`Seu saldo de ${moeda.nomePlural}`}
            aria-label={`Seu saldo: ${moeda.saldo} ${moeda.saldo === 1 ? moeda.nomeSingular : moeda.nomePlural}`}
            style={{ position: 'absolute', left: 0, top: 0, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid var(--border)', borderRadius: 999, fontSize: 13, textDecoration: 'none', color: 'inherit', background: 'var(--verde-pastel)' }}
          >
            <span aria-hidden="true">{moeda.simbolo}</span> <b>{moeda.saldo}</b>
          </Link>
        )}
        <button className="secundario botao-sair" onClick={sair} style={{ padding: '4px 12px', fontSize: 13 }}>Sair</button>
        <Link href="/inicio">
          <img src="/logo.png" alt="Logo" />
        </Link>
        <div className="titulo-portal">Portal do Colaborador</div>
      </div>

      {atualizacao && pathname !== '/inicio' && !naPaginaDeAtualizar && (
        <Link href="/atualizar-dados" style={{ display: 'block', background: '#fff8e1', border: '1px solid #f5d77a', borderRadius: 8, padding: '8px 12px', fontSize: 13, margin: '8px 0', color: 'inherit', textDecoration: 'none' }}>
          📋 <b>Atualização de dados pendente.</b> Toque aqui para atualizar.
        </Link>
      )}
    </div>
  );
}
