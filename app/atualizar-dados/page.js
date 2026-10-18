'use client';
import { useEffect, useState } from 'react';
import NavColaborador from '../components/NavColaborador';
import BotaoVoltar from '../components/BotaoVoltar';

// <ajudantes>
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const MAX_BYTES = 4 * 1024 * 1024;
const REDUZIR_ACIMA_DE = 1024 * 1024;   // fotos maiores que 1 MB são reduzidas antes de enviar

function formatarTelefone(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function formatarCep(v) {
  const d = String(v || '').replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

// Tamanho da foto reduzida: o maior lado não passa de "maximo", sem deformar.
function calcularTamanho(largura, altura, maximo) {
  const escala = Math.min(1, maximo / Math.max(largura, altura));
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) };
}

// Só PDF, JPG ou PNG (pelo nome; o servidor confere o conteúdo de verdade).
function tipoPermitido(arquivo) {
  return /\.(pdf|jpe?g|png)$/i.test(arquivo.name) || /^(application\/pdf|image\/jpeg|image\/png)$/.test(arquivo.type);
}

// Foto de celular costuma ter vários MB: reduz no navegador (maior lado 1800 px, ainda legível) antes de enviar.
async function reduzirImagem(arquivo) {
  if (!arquivo.type.startsWith('image/')) return arquivo;
  const bitmap = await createImageBitmap(arquivo);
  const { largura, altura } = calcularTamanho(bitmap.width, bitmap.height, 1800);
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85));
  if (!blob) return arquivo;
  return new File([blob], arquivo.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
}

// Datas de calendário ficam guardadas à meia-noite UTC: ler em UTC evita o "um dia a menos".
const dataCal = (v) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
// </ajudantes>

const VAZIO = { telefone: '', email: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '' };

export default function AtualizarDados() {
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [arquivo, setArquivo] = useState(null);
  const [chaveArquivo, setChaveArquivo] = useState(0);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  async function carregar() {
    try {
      const r = await fetch('/api/dados-pessoais/status');
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Não foi possível carregar.');
      setStatus(j);
      if (j.prefill) setForm({ ...VAZIO, ...j.prefill, telefone: formatarTelefone(j.prefill.telefone), cep: formatarCep(j.prefill.cep) });
    } catch (e) {
      setErro(e.message || 'Não foi possível carregar.');
    }
  }
  useEffect(() => { carregar(); }, []);

  function mudar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    setSucesso(false);
  }

  // Ao completar o CEP, preenche rua, bairro, cidade e estado (se o serviço de CEP não responder, é só digitar).
  async function mudarCep(valor) {
    const cep = formatarCep(valor);
    mudar('cep', cep);
    const digitos = cep.replace(/\D/g, '');
    if (digitos.length !== 8) return;
    setBuscandoCep(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const d = await r.json();
      if (d && !d.erro) {
        setForm((f) => ({ ...f, logradouro: d.logradouro || f.logradouro, bairro: d.bairro || f.bairro, cidade: d.localidade || f.cidade, uf: d.uf || f.uf }));
      }
    } catch { /* sem internet para o CEP: o colaborador digita */ }
    setBuscandoCep(false);
  }

  async function escolherArquivo(e) {
    setErro(''); setSucesso(false);
    const f = e.target.files[0];
    if (!f) { setArquivo(null); return; }
    if (!tipoPermitido(f)) { setErro('O comprovante precisa ser um PDF ou uma foto (JPG ou PNG).'); setArquivo(null); return; }
    let final = f;
    try {
      if (f.type.startsWith('image/') && f.size > REDUZIR_ACIMA_DE) final = await reduzirImagem(f);
    } catch { final = f; }
    if (final.size > MAX_BYTES) { setErro('O arquivo passa de 4 MB. Tire uma foto menor ou envie um PDF mais leve.'); setArquivo(null); return; }
    setArquivo(final);
  }

  async function enviar(e) {
    e.preventDefault();
    setErro(''); setSucesso(false);
    if (!arquivo && !(status && status.temComprovante)) { setErro('Anexe o comprovante de residência (PDF ou foto).'); return; }
    setEnviando(true);
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(form)) fd.set(k, v);
      if (arquivo) fd.set('comprovante', arquivo);
      const r = await fetch('/api/dados-pessoais', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) { setErro(j.erro || 'Não foi possível salvar.'); return; }
      setSucesso(true);
      setArquivo(null); setChaveArquivo((n) => n + 1);
      if (typeof window.scrollTo === 'function') window.scrollTo({ top: 0, behavior: 'smooth' });
      await carregar();
    } catch (err) {
      setErro(err.message || 'Não foi possível salvar.');
    } finally {
      setEnviando(false);
    }
  }

  const campanha = status && status.campanha;

  return (
    <div>
      <NavColaborador />
      <BotaoVoltar />
      <h2>Atualizar meus dados</h2>

      {!status && !erro && <p style={{ color: 'var(--muted)' }}>Carregando...</p>}
      {erro && <div className="erro">{erro}</div>}
      {status && !campanha && <p>Não há atualização de dados liberada no momento. Quando o RH liberar, você será avisado aqui.</p>}

      {campanha && (
        <>
          <div className="card" style={{ background: '#fff8e1', borderColor: '#f5d77a' }}>
            <b>📋 {campanha.titulo}</b>
            <p style={{ fontSize: 14, margin: '6px 0 0' }}>
              {campanha.mensagem || 'O RH pediu que você confirme seus dados de contato e endereço e envie um comprovante de residência.'}
            </p>
            {campanha.prazo && <p style={{ fontSize: 13, margin: '6px 0 0' }}>⏳ Faça até {dataCal(campanha.prazo)}.</p>}
          </div>

          {sucesso && <div className="card" style={{ borderColor: 'var(--success)' }}><b style={{ color: 'var(--success)' }}>✓ Dados atualizados! Obrigado.</b></div>}
          {status.concluido && !sucesso && (
            <p style={{ fontSize: 14, color: 'var(--success)' }}>
              ✓ {status.origem === 'baixa_rh' ? 'O RH já registrou a sua atualização.' : 'Você já concluiu esta atualização.'} Se quiser, pode corrigir os dados abaixo.
            </p>
          )}

          <form onSubmit={enviar} className="card">
            <h3 style={{ marginTop: 0 }}>Contato</h3>
            <label>Telefone (com DDD)</label>
            <input value={form.telefone} inputMode="tel" placeholder="(21) 99999-9999" onChange={(e) => mudar('telefone', formatarTelefone(e.target.value))} required />
            <label>E-mail</label>
            <input type="email" value={form.email} maxLength={120} onChange={(e) => mudar('email', e.target.value)} required />

            <h3>Endereço</h3>
            <label>CEP</label>
            <input value={form.cep} inputMode="numeric" placeholder="00000-000" onChange={(e) => mudarCep(e.target.value)} required style={{ maxWidth: 180 }} />
            {buscandoCep && <span style={{ fontSize: 12, color: 'var(--muted)' }}> Buscando endereço...</span>}
            <label>Rua (logradouro)</label>
            <input value={form.logradouro} maxLength={120} onChange={(e) => mudar('logradouro', e.target.value)} required />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 100px' }}>
                <label>Número</label>
                <input value={form.numero} maxLength={10} onChange={(e) => mudar('numero', e.target.value)} required />
              </div>
              <div style={{ flex: '2 1 160px' }}>
                <label>Complemento (opcional)</label>
                <input value={form.complemento} maxLength={60} onChange={(e) => mudar('complemento', e.target.value)} />
              </div>
            </div>
            <label>Bairro</label>
            <input value={form.bairro} maxLength={80} onChange={(e) => mudar('bairro', e.target.value)} required />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: '3 1 180px' }}>
                <label>Cidade</label>
                <input value={form.cidade} maxLength={80} onChange={(e) => mudar('cidade', e.target.value)} required />
              </div>
              <div style={{ flex: '1 1 90px' }}>
                <label>Estado</label>
                <select value={form.uf} onChange={(e) => mudar('uf', e.target.value)} required>
                  <option value="">UF</option>
                  {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <h3>Comprovante de residência</h3>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px' }}>
              Conta de luz, água, telefone ou outro comprovante recente, em PDF ou foto. Fotos grandes são reduzidas automaticamente.
            </p>
            <input key={chaveArquivo} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={escolherArquivo} />
            {arquivo && <div style={{ fontSize: 13, color: 'var(--success)', marginTop: 4 }}>✓ {arquivo.name}</div>}
            {!arquivo && status.temComprovante && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Você já enviou um comprovante. Só escolha outro se quiser trocar.</div>}

            <button type="submit" disabled={enviando} style={{ marginTop: 14 }}>{enviando ? 'Enviando...' : 'Salvar meus dados'}</button>
          </form>
        </>
      )}
    </div>
  );
}
