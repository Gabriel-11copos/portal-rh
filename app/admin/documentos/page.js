'use client';
import { useState } from 'react';
import BotaoVoltar from '../../components/BotaoVoltar';

export default function DistribuirDocumentos() {
  const [tipo, setTipo] = useState('Contracheque');
  const [competencia, setCompetencia] = useState('');
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setResultado(null);
    if (!arquivo) return;

    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append('arquivo', arquivo);
      formData.append('tipo', tipo);
      formData.append('competencia', competencia);

      const res = await fetch('/api/documentos/distribuir', { method: 'POST', body: formData });
      const texto = await res.text();
      let data;
      try {
        data = JSON.parse(texto);
      } catch {
        throw new Error('O servidor demorou demais ou teve um problema inesperado. Tente novamente com um arquivo menor, ou avise o suporte.');
      }

      if (res.ok) {
        setResultado(data);
      } else {
        setErro(data.erro || 'Erro ao distribuir documentos.');
      }
    } catch (err) {
      setErro(err.message || 'Erro inesperado ao processar. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <BotaoVoltar />
      <h2>Distribuir documentos (contracheques)</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Envie aqui o PDF consolidado normal, exatamente como sai do sistema de folha
        (com todos os colaboradores juntos). O sistema identifica cada um pelo nome
        e pela loja, separa automaticamente, e já manda pra pasta certa de cada
        colaborador no Drive.
      </p>
      <p style={{ fontSize: 13, color: 'var(--warning)' }}>
        ⚠ Para arquivos com muitas pessoas, pode levar 1-2 minutos. Não feche
        nem atualize esta página enquanto estiver processando.
      </p>

      <div className="card">
        <form onSubmit={enviar}>
          <label>Tipo de documento</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="Contracheque">Contracheque</option>
            <option value="Informe de Rendimentos">Informe de Rendimentos</option>
            <option value="Outro">Outro</option>
          </select>

          <label>Competência (ex: 08/2026)</label>
          <input value={competencia} onChange={(e) => setCompetencia(e.target.value)} placeholder="08/2026" required />

          <label>PDF consolidado</label>
          <input type="file" accept=".pdf" onChange={(e) => setArquivo(e.target.files[0])} required />

          {erro && <div className="erro">{erro}</div>}
          <button type="submit" disabled={enviando}>{enviando ? 'Processando... (pode levar um minuto)' : 'Processar e distribuir'}</button>
        </form>
      </div>

      {resultado && (
        <div className="card">
          <h3>Resultado</h3>
          <p style={{ color: 'var(--success)' }}>
            ✓ {resultado.distribuidos.length} documento(s) distribuído(s) com sucesso
          </p>
          {resultado.naoEncontrados.length > 0 && (
            <>
              <p style={{ color: 'var(--danger)' }}>
                ⚠ {resultado.naoEncontrados.length} não identificado(s) automaticamente:
              </p>
              <ul style={{ fontSize: 13 }}>
                {resultado.naoEncontrados.map((n, i) => (
                  <li key={i}>
                    {n.nomeDetectado} — loja detectada: {n.lojaDetectada || 'não identificada'}
                    {n.ambiguo && ' (mais de um colaborador parecido)'}
                    {' '}(página{n.paginas.length > 1 ? 's' : ''} {n.paginas.join(', ')} do PDF original)
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                Confira se essas pessoas estão cadastradas com o nome exatamente igual ao da folha,
                e na loja certa. Depois de corrigir, é só enviar o PDF de novo — quem já foi
                distribuído não duplica.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
