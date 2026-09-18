'use client';
import { useState } from 'react';

// Envia o arquivo para /api/upload (que joga no Google Drive) e devolve {link, nomeArquivo}.
// colaboradorId é opcional: usado quando o RH está anexando algo numa solicitação de um
// colaborador específico, para organizar o arquivo na pasta certa do Drive.
export default function UploadAnexo({ onUploaded, colaboradorId }) {
  const [enviando, setEnviando] = useState(false);

  async function handleChange(e) {
    const arquivo = e.target.files[0];
    if (!arquivo) return;

    setEnviando(true);
    const formData = new FormData();
    formData.append('arquivo', arquivo);
    if (colaboradorId) formData.append('colaboradorId', colaboradorId);

    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    setEnviando(false);

    if (res.ok) onUploaded(data);
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <label>Anexar documento (opcional)</label>
      <input type="file" onChange={handleChange} disabled={enviando} />
      {enviando && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Enviando...</span>}
    </div>
  );
}
