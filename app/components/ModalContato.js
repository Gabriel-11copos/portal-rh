'use client';
import { useEffect, useState } from 'react';
import { FormContato } from './CartaoContato';

const CHAVE = 'aviso-contato';

// Primeiro acesso: pede para o colaborador conferir o celular que o RH tem na lista (ou corrigir) e escolher se quer receber os avisos
// por WhatsApp. Aparece uma vez por entrada no portal, até ele confirmar. "adiar" segura a janela enquanto outro aviso está na tela.
export default function ModalContato({ adiar = false }) {
  const [c, setC] = useState(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    fetch('/api/contato').then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j || !j.disponivel || !j.precisaConfirmar) return;
      setC(j);
      let visto = false;
      try { visto = sessionStorage.getItem(CHAVE) === '1'; } catch { /* sem armazenamento: avisa sempre */ }
      if (!visto) setAberto(true);
    }).catch(() => {});
  }, []);

  function fechar() {
    try { sessionStorage.setItem(CHAVE, '1'); } catch { /* ok */ }
    setAberto(false);
  }

  if (!aberto || adiar || !c) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Confirme o seu WhatsApp" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div className="card" style={{ maxWidth: 420, width: '100%' }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Aviso do RH</div>
        <h3 style={{ marginTop: 0 }}>📱 Confirme o seu WhatsApp</h3>
        <p style={{ fontSize: 14 }}>
          A partir de agora o RH avisa você também por WhatsApp (resposta às suas solicitações, comunicados, documentos...) e você poderá abrir e acompanhar solicitações por lá.
          {c.telefone ? ' Confira se o número abaixo é o seu, ou corrija.' : ' Informe o seu número.'}
        </p>
        <FormContato inicial={c} rotulo="Confirmar" aoSalvar={() => { setAberto(false); window.dispatchEvent(new Event('contato-atualizado')); }} secundario={<button type="button" className="secundario" onClick={fechar}>Agora não</button>} />
      </div>
    </div>
  );
}
