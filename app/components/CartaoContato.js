'use client';
import { useEffect, useState } from 'react';

// <regras>
// "21999991234" -> "(21) 99999-1234" enquanto a pessoa digita
function mascaraTelefone(valor) {
  const d = String(valor || '').replace(/\D/g, '').replace(/^55(?=\d{11}$)/, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// Celular com DDD (o servidor confere de novo): 11 dígitos com 9 na frente do número, ou 10 sem o 9.
function celularValido(texto) {
  const d = String(texto || '').replace(/\D/g, '');
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (d.length === 11) return d[2] === '9';
  return d.length === 10 && /[6-9]/.test(d[2]);
}

// O que a pessoa precisa ver/corrigir antes de salvar (null = tudo certo)
function avisoDoFormulario(telefone, receber) {
  if (!receber && !String(telefone || '').trim()) return null;           // quem não quer receber nem precisa informar o número
  if (!celularValido(telefone)) return 'Informe um celular válido com DDD (ex.: (21) 99999-9999).';
  return null;
}
// </regras>

// O formulário em si (usado na janela do primeiro acesso e no cartão do perfil)
export function FormContato({ inicial, aoSalvar, rotulo = 'Salvar', secundario = null }) {
  const [telefone, setTelefone] = useState(mascaraTelefone(inicial.telefone));
  const [receber, setReceber] = useState(inicial.whatsappAtivo !== false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    const aviso = avisoDoFormulario(telefone, receber);
    if (aviso) { setErro(aviso); return; }
    setErro(''); setSalvando(true);
    try {
      const r = await fetch('/api/contato', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefone, whatsappAtivo: receber }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.erro || 'Não foi possível salvar agora.'); return; }
      aoSalvar(j);
    } catch { setErro('Não foi possível salvar agora.'); } finally { setSalvando(false); }
  }

  return (
    <div>
      <label>Seu celular (WhatsApp)</label>
      <input value={telefone} inputMode="tel" placeholder="(21) 99999-9999" onChange={(e) => setTelefone(mascaraTelefone(e.target.value))} />
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14 }}>
        <input type="checkbox" checked={receber} onChange={(e) => setReceber(e.target.checked)} style={{ width: 'auto', margin: '3px 0 0' }} />
        <span>Quero receber os avisos do RH por WhatsApp neste número (respostas, comunicados, documentos...).</span>
      </label>
      {erro && <p role="alert" style={{ color: 'var(--danger)', fontSize: 13, margin: '6px 0' }}>{erro}</p>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" onClick={salvar} disabled={salvando}>{salvando ? 'Salvando...' : rotulo}</button>
        {secundario}
      </div>
    </div>
  );
}

// O cartão do perfil: o colaborador vê e corrige o WhatsApp quando quiser
export default function CartaoContato() {
  const [c, setC] = useState(null);
  const [ok, setOk] = useState('');
  useEffect(() => { fetch('/api/contato').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j && j.disponivel) setC(j); }).catch(() => {}); }, []);
  if (!c) return null;
  return (
    <div className="card">
      <h3>Meu WhatsApp</h3>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        {c.confirmado ? 'Número confirmado por você.' : 'O RH tem este número na lista. Confira se está certo.'} Os avisos do RH chegam por aqui e por WhatsApp.
      </p>
      <FormContato inicial={c} rotulo="Salvar" aoSalvar={(j) => { setC({ ...c, telefone: j.telefone, whatsappAtivo: j.whatsappAtivo, confirmado: true }); setOk('Salvo!'); }} />
      {ok && <p style={{ fontSize: 13, color: 'var(--success)' }}>{ok}</p>}
    </div>
  );
}
