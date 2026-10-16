'use client';
import { useState } from 'react';
import BotaoVoltar from '../../components/BotaoVoltar';

function hojeLocal() {
  const d = new Date();
  const dois = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
}

export default function TesteEscalas() {
  const [data, setData] = useState(hojeLocal());
  const [lojaCodigo, setLojaCodigo] = useState('61');
  const [resultados, setResultados] = useState([]);
  const [rodando, setRodando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  async function consultar(rotulo, params) {
    const qs = new URLSearchParams({ data, ...params }).toString();
    try {
      const res = await fetch(`/api/escalas/diagnostico?${qs}`);
      const texto = await res.text();
      let corpo;
      try {
        corpo = JSON.parse(texto);
      } catch {
        corpo = { ok: false, mensagem: 'O servidor devolveu uma resposta inesperada (possivelmente demorou demais).' };
      }
      return { teste: rotulo, ...corpo };
    } catch (err) {
      return { teste: rotulo, ok: false, mensagem: err.message };
    }
  }

  async function rodar() {
    setRodando(true);
    setCopiado(false);
    setResultados([]);
    const lista = [];
    const loja = lojaCodigo.trim();

    if (loja) lista.push(await consultar(`1) Com a loja ${loja}`, { lojaCodigo: loja }));
    setResultados([...lista]);

    lista.push(await consultar('2) Sem informar loja', {}));
    setResultados([...lista]);

    lista.push(await consultar(
      loja ? `3) Com a loja ${loja} e ausências` : '3) Sem loja e com ausências',
      { ...(loja ? { lojaCodigo: loja } : {}), incluirAusencias: '1' }
    ));
    setResultados([...lista]);
    setRodando(false);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(resultados, null, 2));
      setCopiado(true);
    } catch {
      setCopiado(false);
      alert('Não consegui copiar automaticamente. Selecione o texto abaixo e copie com Ctrl+C.');
    }
  }

  return (
    <div>
      <BotaoVoltar />
      <h2>Teste da integração com o escalas-app</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Ferramenta temporária para confirmar como a API de escalas responde. O resultado sai com CPF e
        nome mascarados, então pode ser copiado e enviado. Antes de usar, a chave precisa estar no Vercel
        como <b>ESCALAS_APP_API_KEY</b>.
      </p>

      <div className="card">
        <label>Dia para consultar (escolha um dia em que haja escala)</label>
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />

        <label>Código da loja (opcional — ex: 61 para o Terraço)</label>
        <input value={lojaCodigo} onChange={(e) => setLojaCodigo(e.target.value)} placeholder="61" />

        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          Roda três consultas: com a loja, sem loja e com ausências. A primeira pode demorar se o
          serviço de escalas estiver "dormindo".
        </p>
        <button onClick={rodar} disabled={rodando || !data}>
          {rodando ? 'Consultando...' : 'Rodar testes'}
        </button>
      </div>

      {resultados.map((r, i) => (
        <div key={i} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <b>{r.teste}</b>
            <span className={`badge ${r.ok ? 'respondida' : 'aberta'}`}>
              {r.ok ? 'Respondeu' : 'Falhou'}{r.status ? ` (${r.status})` : ''}{r.tempoMs != null ? ` · ${r.tempoMs} ms` : ''}
            </span>
          </div>
          {r.mensagem && <p style={{ fontSize: 13, color: 'var(--danger)' }}>{r.mensagem}</p>}
          <pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 320, overflow: 'auto', background: 'var(--pastel-bg)', padding: 10, borderRadius: 10 }}>
            {JSON.stringify({ itens: r.resposta ? r.resposta.totalDeItens : null, listaEm: r.resposta ? r.resposta.listaEm : null, ...r }, null, 2)}
          </pre>
        </div>
      ))}

      {resultados.length > 0 && !rodando && (
        <button onClick={copiar}>{copiado ? '✓ Copiado' : 'Copiar tudo para enviar'}</button>
      )}
    </div>
  );
}
