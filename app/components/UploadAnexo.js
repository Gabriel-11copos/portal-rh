'use client';
import { useState } from 'react';

// Tenta o caminho rápido (upload direto do navegador pro Drive). Se falhar por
// qualquer motivo (rede, CORS, etc.), cai automaticamente pro caminho antigo,
// que passa pelo nosso servidor — mais lento, mas sempre funciona.
async function uploadViaServidor(arquivo, colaboradorId) {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  if (colaboradorId) formData.append('colaboradorId', colaboradorId);
  const res = await fetch('/api/upload', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Falha ao enviar arquivo.');
  return res.json();
}

async function uploadDireto(arquivo, colaboradorId, onProgresso) {
  const initRes = await fetch('/api/upload/iniciar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nomeArquivo: arquivo.name,
      mimeType: arquivo.type || 'application/octet-stream',
      colaboradorId,
    }),
  });
  if (!initRes.ok) throw new Error('Não foi possível iniciar o envio.');
  const { sessionUrl } = await initRes.json();

  const resultado = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', sessionUrl, true);
    xhr.setRequestHeader('Content-Type', arquivo.type || 'application/octet-stream');
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgresso(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(new Error('Falha no envio para o Drive.'));
    };
    xhr.onerror = () => reject(new Error('Falha de conexão durante o envio.'));
    xhr.send(arquivo);
  });

  await fetch('/api/upload/finalizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileId: resultado.id }),
  });

  return { link: resultado.webViewLink, nomeArquivo: arquivo.name };
}

export default function UploadAnexo({ onUploaded, colaboradorId, label }) {
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [erro, setErro] = useState('');

  async function handleChange(e) {
    const arquivo = e.target.files[0];
    if (!arquivo) return;

    setErro('');
    setEnviando(true);
    setProgresso(0);

    try {
      let resultado;
      try {
        resultado = await uploadDireto(arquivo, colaboradorId, setProgresso);
      } catch {
        // Caminho rápido falhou — tenta o caminho confiável, sem incomodar o usuário.
        setProgresso(0);
        resultado = await uploadViaServidor(arquivo, colaboradorId);
      }
      onUploaded(resultado);
    } catch (err) {
      setErro('Não foi possível enviar o arquivo. Tente novamente.');
    } finally {
      setEnviando(false);
      setProgresso(0);
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <label>{label || 'Anexar documento (opcional)'}</label>
      <input type="file" onChange={handleChange} disabled={enviando} />
      {enviando && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Enviando... {progresso > 0 ? `${progresso}%` : ''}</span>}
      {erro && <div className="erro">{erro}</div>}
    </div>
  );
}
