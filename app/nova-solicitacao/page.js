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
    const res = await fetch('/api/solicitacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assuntoId, descricao, anexos, emailContato, whatsapp, dadosExtras: ehAtestado ? { dataAtestado, dias: Number(dias) } : undefined }),
    });
    if (res.ok) setEnviado(true);
    else {
      const d = await res.json().catch(() => ({}));
      setErro(d.erro || 'Não foi possível enviar. Tente de novo.');
    }
  }

  const assuntoSelecionado = assuntos.find((a) => a.id === assuntoId);
  const ehAtestado = !!assuntoSelecionado && assuntoSelecionado.fluxo === 'atestado';

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

          <label>Descreva sua solicitação</label>
          <textarea rows={5} value={descricao} onChange={(e) => setDescricao(e.target.value)} required />

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
