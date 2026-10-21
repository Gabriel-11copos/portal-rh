'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import BotaoVoltar from '../../../components/BotaoVoltar';

// <regras>
const POR_VEZ = 100;   // quantos documentos a tela manda excluir em cada chamada (o servidor aceita até 300)

const ORIGENS = {
  portal: { rotulo: 'Portal (privado)', aviso: false },
  'drive-antigo': { rotulo: 'Envio antigo (link aberto no Drive)', aviso: true },
  outro: { rotulo: 'Sem arquivo identificado', aviso: false },
};

function dataBR(valor) {
  return valor ? new Date(valor).toLocaleDateString('pt-BR') : '';
}

// O que mostrar no aviso de confirmação: quantos, de que tipo/competência e de quais lojas.
function resumoDaSelecao(itens, selecionados) {
  const marcados = itens.filter((d) => selecionados.includes(d.id));
  const lojas = [...new Set(marcados.map((d) => (d.colaborador ? d.colaborador.loja : '?')))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const competencias = [...new Set(marcados.map((d) => d.competencia))].sort();
  const antigos = marcados.filter((d) => d.origem === 'drive-antigo').length;
  return { total: marcados.length, lojas, competencias, antigos };
}

// A palavra que a pessoa digita para confirmar a exclusão (evita excluir sem querer).
const PALAVRA_DE_CONFIRMACAO = 'EXCLUIR';
function confirmou(resposta) {
  return String(resposta == null ? '' : resposta).trim().toUpperCase() === PALAVRA_DE_CONFIRMACAO;
}
// </regras>

export default function DocumentosEnviados() {
  const [tipo, setTipo] = useState('Contracheque');
  const [mes, setMes] = useState('');
  const [loja, setLoja] = useState('');
  const [dados, setDados] = useState(null);          // { itens, resumo, truncado }
  const [selecionados, setSelecionados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [excluindo, setExcluindo] = useState(null);  // { feitos, total }
  const competencia = mes ? `${mes.slice(5, 7)}/${mes.slice(0, 4)}` : '';

  async function buscar(filtros = { tipo, competencia, loja }) {
    setErro(''); setCarregando(true); setSelecionados([]);
    try {
      const qs = new URLSearchParams({ tipo: filtros.tipo });
      if (filtros.competencia) qs.set('competencia', filtros.competencia);
      if (filtros.loja) qs.set('loja', filtros.loja);
      const r = await fetch(`/api/contracheques/documentos?${qs.toString()}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro || 'Não foi possível buscar os documentos.');
      setDados(j);
    } catch (e) {
      setDados(null);
      setErro(e.message || 'Não foi possível buscar os documentos.');
    } finally {
      setCarregando(false);
    }
  }
  useEffect(() => { buscar(); }, []);

  const itens = dados ? dados.itens : [];
  const lojasDoResumo = dados ? [...new Set(dados.resumo.map((x) => x.loja))].sort((a, b) => a.localeCompare(b, 'pt-BR')) : [];
  const todosMarcados = itens.length > 0 && selecionados.length === itens.length;
  const alternar = (id) => setSelecionados(selecionados.includes(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id]);
  const marcarAntigos = () => setSelecionados(itens.filter((d) => d.origem === 'drive-antigo').map((d) => d.id));

  function usarResumo(linha) {
    const [mm, aaaa] = linha.competencia.split('/');
    setMes(`${aaaa}-${mm}`); setLoja(linha.loja);
    buscar({ tipo, competencia: linha.competencia, loja: linha.loja });
  }

  async function excluir() {
    const r = resumoDaSelecao(itens, selecionados);
    const texto = `Excluir ${r.total} documento(s) de "${tipo}"?\n\nLojas: ${r.lojas.join(', ')}\nCompetências: ${r.competencias.join(', ')}${r.antigos > 0 ? `\n${r.antigos} do envio antigo (o link aberto do Drive também deixa de funcionar)` : ''}\n\nOs colaboradores deixam de ver estes arquivos e os arquivos são apagados do Drive. Isso não pode ser desfeito.`;
    if (!window.confirm(texto)) return;
    if (!confirmou(window.prompt(`Para confirmar a exclusão de ${r.total} documento(s), digite ${PALAVRA_DE_CONFIRMACAO}:`))) { setAviso('Exclusão cancelada: a confirmação não foi digitada.'); return; }
    setAviso(''); setErro('');
    const fila = [...selecionados];
    let excluidos = 0;
    const naoApagados = [];
    const falhas = [];
    setExcluindo({ feitos: 0, total: fila.length });
    for (let i = 0; i < fila.length; i += POR_VEZ) {
      const lote = fila.slice(i, i + POR_VEZ);
      try {
        const res = await fetch('/api/contracheques/remover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentoIds: lote }) });
        const j = await res.json();
        if (!res.ok && !j.resultados) throw new Error(j.erro || 'Falhou.');
        excluidos += j.excluidos || 0;
        naoApagados.push(...(j.arquivosNaoApagados || []));
        falhas.push(...(j.resultados || []).filter((x) => !x.ok).map((x) => x.id));
      } catch (e) {
        falhas.push(...lote);
        setErro(`Parte da exclusão falhou: ${e.message || 'erro desconhecido'}`);
      }
      setExcluindo({ feitos: Math.min(i + POR_VEZ, fila.length), total: fila.length });
    }
    setExcluindo(null);
    setAviso(`${excluidos} documento(s) excluído(s).${falhas.length ? ` ${falhas.length} não puderam ser excluídos (nada foi feito com eles).` : ''}${naoApagados.length ? ` Em ${naoApagados.length}, o documento saiu da conta da pessoa, mas o arquivo não pôde ser apagado do Drive: avise o suporte.` : ''}`);
    await buscar();
  }

  return (
    <div>
      <BotaoVoltar />
      <h2>Documentos enviados</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Veja o que já foi enviado, por mês e por loja, e exclua o que foi enviado por engano. A pessoa deixa de ver o documento e o arquivo é apagado do Drive.
        Depois, envie o certo em <Link href="/admin/contracheques">Distribuir contracheques</Link>: quem foi excluído volta a aparecer em "quem falta" no histórico.
      </p>
      {erro && <div className="erro">{erro}</div>}

      <div className="card">
        <label>Tipo do documento</label>
        <input value={tipo} maxLength={40} onChange={(e) => setTipo(e.target.value)} />
        <label>Competência (deixe vazio para ver todas)</label>
        <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} style={{ maxWidth: 220 }} />
        <label>Loja</label>
        <select value={loja} onChange={(e) => setLoja(e.target.value)} style={{ maxWidth: 320 }}>
          <option value="">Todas</option>
          {lojasDoResumo.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <button type="button" onClick={() => buscar()} disabled={!tipo.trim() || carregando}>{carregando ? 'Buscando...' : 'Buscar'}</button>
      </div>

      {dados && dados.resumo.length > 0 && (
        <details className="card">
          <summary style={{ cursor: 'pointer', fontWeight: 600 }}>O que já foi enviado de "{tipo}" ({dados.resumo.reduce((n, x) => n + x.total, 0)} documentos)</summary>
          <table style={{ width: '100%', fontSize: 13, marginTop: 8, borderCollapse: 'collapse' }}>
            <thead><tr style={{ textAlign: 'left' }}><th>Competência</th><th>Loja</th><th>Documentos</th><th /></tr></thead>
            <tbody>
              {dados.resumo.map((x) => (
                <tr key={`${x.competencia}|${x.loja}`} style={{ borderTop: '1px solid var(--border)' }}>
                  <td>{x.competencia}</td><td>{x.loja}</td><td>{x.total}</td>
                  <td style={{ textAlign: 'right' }}><button type="button" className="secundario" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => usarResumo(x)}>Ver</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {dados && (
        <div className="card">
          {aviso && <p style={{ fontSize: 13 }}>{aviso}</p>}
          {dados.itens.length === 0 && <p style={{ color: 'var(--muted)' }}>Nenhum documento com estes filtros.</p>}
          {dados.truncado && <p style={{ fontSize: 13, color: 'var(--warning)' }}>Mostrando só os 5000 mais recentes. Use os filtros para ver os outros.</p>}
          {itens.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0 }}>
                  <input type="checkbox" checked={todosMarcados} onChange={() => setSelecionados(todosMarcados ? [] : itens.map((d) => d.id))} style={{ width: 'auto', margin: 0 }} />
                  Selecionar todos ({itens.length})
                </label>
                {itens.some((d) => d.origem === 'drive-antigo') && <button type="button" className="secundario" style={{ padding: '2px 10px', fontSize: 12 }} onClick={marcarAntigos}>Marcar só os do envio antigo</button>}
                <button type="button" onClick={excluir} disabled={selecionados.length === 0 || !!excluindo}>
                  {excluindo ? `Excluindo ${excluindo.feitos} de ${excluindo.total}...` : `Excluir selecionados (${selecionados.length})`}
                </button>
              </div>
              {itens.map((d) => (
                <label key={d.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', borderTop: '1px solid var(--border)', margin: 0 }}>
                  <input type="checkbox" checked={selecionados.includes(d.id)} onChange={() => alternar(d.id)} style={{ width: 'auto', margin: '4px 0 0' }} />
                  <span style={{ flex: 1 }}>
                    <b>{d.colaborador ? d.colaborador.nome : '(sem colaborador)'}</b>{' '}
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{d.colaborador ? d.colaborador.loja : ''} · {d.competencia} · enviado em {dataBR(d.criadoEm)}</span>
                    <span style={{ display: 'block', fontSize: 12, color: ORIGENS[d.origem] && ORIGENS[d.origem].aviso ? 'var(--danger)' : 'var(--muted)' }}>
                      {(ORIGENS[d.origem] || ORIGENS.outro).rotulo} · {d.visto ? 'o colaborador já abriu' : 'ainda não aberto'}
                    </span>
                  </span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
