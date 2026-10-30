'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const CHAVE = 'aviso-vt';
const CHAVE_CONTATO = 'aviso-contato';
const TEXTOS = {
  primeiro: 'Precisamos mapear o seu transporte: como você vai para o trabalho, qual cartão usa e quais transportes pega. É rápido e ajuda o RH a calcular o seu vale-transporte direitinho.',
  coleta: 'O RH pediu para você atualizar o seu transporte (vale-transporte e trajeto até o trabalho). É rápido.',
  reaberto: 'O RH liberou o preenchimento do seu vale-transporte. Faça agora, é rápido.',
};

// Primeiro acesso (e quando o RH pede para atualizar): convida a mapear o transporte. Aparece uma vez por entrada no portal, depois da janela do
// WhatsApp. Não trava nada: "Depois" fecha, e o convite continua no perfil. "adiar" segura a janela enquanto outro aviso está na tela.
export default function ModalVT({ adiar = false }) {
  const router = useRouter();
  const [pendencia, setPendencia] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [esperaContato, setEsperaContato] = useState(false);

  function avaliar() {
    fetch('/api/vt').then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j || !j.disponivel || !j.pendencia || !j.podeEditar) return;
      let visto = false;
      try { visto = sessionStorage.getItem(CHAVE) === '1'; } catch { /* sem armazenamento: avisa sempre */ }
      if (visto) return;
      setPendencia(j.pendencia); setAberto(true);
    }).catch(() => {});
  }

  useEffect(() => {
    // a janela do WhatsApp vem primeiro: espera ela ser resolvida (confirmou ou escolheu "Agora não")
    fetch('/api/contato').then((r) => (r.ok ? r.json() : null)).then((c) => {
      let contatoVisto = false;
      try { contatoVisto = sessionStorage.getItem(CHAVE_CONTATO) === '1'; } catch { /* ok */ }
      if (c && c.disponivel && c.precisaConfirmar && !contatoVisto) setEsperaContato(true);
      else avaliar();
    }).catch(() => avaliar());
    const aoResolver = () => { setEsperaContato(false); avaliar(); };
    window.addEventListener('contato-atualizado', aoResolver);
    return () => window.removeEventListener('contato-atualizado', aoResolver);
  }, []);

  function fechar() {
    try { sessionStorage.setItem(CHAVE, '1'); } catch { /* ok */ }
    setAberto(false);
  }
  function fazer() { fechar(); router.push('/perfil/beneficios/vale-transporte'); }

  if (!aberto || adiar || esperaContato || !pendencia) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Atualize o seu vale-transporte" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 1000 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Aviso do RH</div>
        <h3 style={{ marginTop: 0 }}>🚌 Vale-transporte</h3>
        <p style={{ fontSize: 14 }}>{TEXTOS[pendencia] || TEXTOS.coleta}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={fazer}>Fazer agora</button>
          <button type="button" className="secundario" onClick={fechar}>Depois</button>
        </div>
      </div>
    </div>
  );
}
