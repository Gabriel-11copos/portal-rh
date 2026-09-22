'use client';
import { useState } from 'react';

// Envia o arquivo DIRETO pro Google Drive a partir do navegador (rápido, sem
// gargalo mesmo em vídeos grandes), e devolve {link, nomeArquivo} igual antes.
// colaboradorId é opcional: usado quando o RH está anexando algo numa solicitação
// de um colaborador específico, para organizar o arquivo na pasta certa do Drive.
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
          if (ev.lengthComputable) setProgresso(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error('Falha no envio para o Drive.'));
          }
        };
        xhr.onerror = () => reject(new Error('Falha de conexão durante o envio.'));
        xhr.send(arquivo);
      });

      await fetch('/api/upload/finalizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: resultado.id }),
      });

      onUploaded({ link: resultado.webViewLink, nomeArquivo: arquivo.name });
    } catch (err) {
      setErro(err.message || 'Erro ao enviar arquivo. Tente novamente.');
    } finally {
      setEnviando(false);
      setProgresso(0);
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <label>{label || 'Anexar documento (opcional)'}</label>
      <input type="file" onChange={handleChange} disabled={enviando} />
      {enviando && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Enviando... {progresso}%</span>}
      {erro && <div className="erro">{erro}</div>}
    </div>
  );
}
