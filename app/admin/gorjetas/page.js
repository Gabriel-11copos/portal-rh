'use client';
import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import BotaoVoltar from '../../components/BotaoVoltar';

// <parser>
function semAcento(t) {
  return String(t == null ? '' : t).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizarCabecalho(t) {
  return semAcento(t).toUpperCase().replace(/-\s*/g, '').replace(/\s+/g, ' ').trim();
}

// Converte "R$ 2.007,37", "R$ -25,97", "+R$ 34,21" ou "—" em centavos (número inteiro).
function centavos(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) : null;
  let s = String(v == null ? '' : v).trim();
  if (s === '' || s === '—' || s === '–' || s === '-') return 0;
  s = s.replace(/R\$/g, '').replace(/\s/g, '').replace(/\u2212/g, '-').replace('+', '');
  s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function inteiroCelula(v) {
  const s = String(v == null ? '' : v).trim();
  if (s === '' || s === '—' || s === '–' || s === '-') return 0;
  const n = parseInt(s.replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

const COLUNAS = [
  { chave: 'nome', rotulo: 'NOME', teste: (h) => h === 'NOME' },
  { chave: 'cpf', rotulo: 'CPF', teste: (h) => h === 'CPF' },
  { chave: 'cargo', rotulo: 'CARGO', teste: (h) => h === 'CARGO' },
  { chave: 'atrasosQtd', rotulo: 'ATRASOS QTD.', teste: (h) => h.startsWith('ATRASOS QTD') },
  { chave: 'faltasQtd', rotulo: 'FALTAS QTD.', teste: (h) => h.startsWith('FALTAS QTD') },
  { chave: 'apuracao', rotulo: 'GORJETA APURAÇÃO', teste: (h) => h.startsWith('GORJETA APURACAO') },
  { chave: 'valorAtrasos', rotulo: 'ATRASOS', teste: (h) => h === 'ATRASOS' },
  { chave: 'valorFaltas', rotulo: 'FALTAS INJ.', teste: (h) => h.startsWith('FALTAS INJ') },
  { chave: 'redistribuicao', rotulo: 'REDISTRIBUIÇÃO', teste: (h) => h.startsWith('REDISTRIBUICAO') },
  { chave: 'brutaFinal', rotulo: 'GORJETA FINAL BRUTA', teste: (h) => h === 'GORJETA FINAL BRUTA' },
  { chave: 'devolucao', rotulo: 'DEVOLUÇÃO', teste: (h) => h.startsWith('DEVOLUCAO') },
  { chave: 'valorFinal', rotulo: 'GORJETA FINAL', teste: (h) => h === 'GORJETA FINAL' },
  { chave: 'retencao', rotulo: 'RETENÇÃO LEGAL', teste: (h) => h.startsWith('RETENCAO LEGAL') },
  { chave: 'liquida', rotulo: 'GORJETA FINAL LÍQUIDA', teste: (h) => h === 'GORJETA FINAL LIQUIDA' },
];
const CAMPOS_DINHEIRO = ['apuracao', 'valorAtrasos', 'valorFaltas', 'redistribuicao', 'brutaFinal', 'devolucao', 'valorFinal', 'retencao', 'liquida'];

function lerLinhas(XLSXlib, dados) {
  const wb = XLSXlib.read(dados, { type: 'array' });
  const folha = wb.Sheets[wb.SheetNames[0]];
  const matriz = XLSXlib.utils.sheet_to_json(folha, { header: 1, defval: '', raw: true });

  const idxCab = matriz.findIndex((r) => {
    const h = r.map(normalizarCabecalho);
    return h.includes('CPF') && h.includes('NOME');
  });
  if (idxCab < 0) throw new Error('Não encontrei o cabeçalho (colunas NOME e CPF). Confira se é a planilha de gorjeta.');

  const cab = matriz[idxCab].map(normalizarCabecalho);
  const pos = {};
  const faltando = [];
  for (const col of COLUNAS) {
    const i = cab.findIndex(col.teste);
    if (i < 0) faltando.push(col.rotulo);
    else pos[col.chave] = i;
  }
  if (faltando.length > 0) throw new Error('Faltam colunas na planilha: ' + faltando.join(', '));

  const linhas = [];
  let totais = null;
  for (const r of matriz.slice(idxCab + 1)) {
    const nome = String(r[pos.nome] == null ? '' : r[pos.nome]).trim();
    const cpfBruto = String(r[pos.cpf] == null ? '' : r[pos.cpf]).replace(/\D/g, '');
    if (!nome && !cpfBruto) continue;

    const reg = {
      nome,
      cpf: cpfBruto ? cpfBruto.padStart(11, '0') : '',
      cargo: String(r[pos.cargo] == null ? '' : r[pos.cargo]).trim(),
      atrasosQtd: inteiroCelula(r[pos.atrasosQtd]),
      faltasQtd: inteiroCelula(r[pos.faltasQtd]),
    };
    for (const c of CAMPOS_DINHEIRO) reg[c] = centavos(r[pos[c]]);

    if (nome.toLowerCase() === 'total') {
      totais = {};
      for (const c of CAMPOS_DINHEIRO) totais[c] = reg[c];
    } else {
      linhas.push(reg);
    }
  }
  return { linhas, totais };
}
// </parser>

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dinheiro = (c) => brl.format(c / 100);
// Datas de calendário são guardadas à meia-noite UTC: ler em UTC evita o "um dia a menos".
const dataCal = (v) => new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

const ROTULO_CAMPO = {
  apuracao: 'Gorjeta apuração',
  valorAtrasos: 'Atrasos',
  valorFaltas: 'Faltas',
  redistribuicao: 'Redistribuição',
  brutaFinal: 'Gorjeta final bruta',
  devolucao: 'Devolução',
  valorFinal: 'Gorjeta final',
  retencao: 'Retenção legal',
  liquida: 'Gorjeta líquida',
};

function dois(n) {
  return String(n).padStart(2, '0');
}

function Contador({ n, rotulo, cor }) {
  return (
    <div style={{ minWidth: 96 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: cor || 'var(--verde)' }}>{n}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{rotulo}</div>
    </div>
  );
}

function Lista({ titulo, itens, render, cor }) {
  if (!itens || itens.length === 0) return null;
  return (
    <details style={{ marginTop: 8 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 14, color: cor }}>
        {titulo} ({itens.length})
      </summary>
      <ul style={{ fontSize: 13, marginTop: 6 }}>
        {itens.map((it, i) => <li key={i}>{render(it)}</li>)}
      </ul>
    </details>
  );
}

function Relatorio({ r }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', margin: '8px 0 12px' }}>
        <Contador n={r.novos} rotulo="novos extratos" />
        <Contador n={r.atualizados} rotulo="atualizados" />
        <Contador n={r.semMudanca} rotulo="sem mudança" />
        <Contador n={r.removidos.length} rotulo="removidos" cor="var(--danger)" />
        <Contador n={r.naoEncontrados.length} rotulo="CPF não cadastrado" cor="var(--warning)" />
      </div>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 8px' }}>
        Soma da gorjeta líquida dos extratos publicáveis: <b>{dinheiro(r.somaLiquida)}</b>
      </p>
      <Lista
        titulo="CPF não encontrado no cadastro (não serão publicados)"
        itens={r.naoEncontrados}
        render={(n) => `${n.nome} — CPF ${n.cpf}${n.cargo ? ` — ${n.cargo}` : ''} — líquida ${dinheiro(n.liquida)}`}
        cor="var(--warning)"
      />
      <Lista titulo="Linhas com conta que não fecha (não serão publicadas)" itens={r.inconsistentes} render={(n) => n} cor="var(--danger)" />
      <Lista titulo="Linhas ignoradas" itens={r.ignoradas} render={(t) => t} cor="var(--danger)" />
      <Lista titulo="Pessoas inativas no cadastro (não conseguem entrar para ver)" itens={r.inativos} render={(n) => n} cor="var(--warning)" />
      <Lista titulo="Saem deste período (estavam publicados e não estão na planilha)" itens={r.removidos} render={(n) => n} cor="var(--danger)" />
    </>
  );
}

export default function GorjetasAdmin() {
  const [unidade, setUnidade] = useState('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [situacao, setSituacao] = useState('parcial');
  const [leitura, setLeitura] = useState(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [previa, setPrevia] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [aceitaRisco, setAceitaRisco] = useState(false);
  const [periodos, setPeriodos] = useState([]);

  function carregarPeriodos() {
    fetch('/api/gorjetas/periodos').then((r) => r.json()).then((d) => setPeriodos(Array.isArray(d) ? d : []));
  }
  useEffect(carregarPeriodos, []);

  const unidadesConhecidas = useMemo(() => [...new Set(periodos.map((p) => p.unidade))], [periodos]);

  function mudou(setter) {
    return (e) => {
      setter(e.target.value);
      setPrevia(null);
      setResultado(null);
      setAceitaRisco(false);
    };
  }

  // Atalho: o mês de fechamento (ex: 2026-10) preenche 26/09 a 25/10
  function preencherPeloMes(e) {
    const [a, m] = e.target.value.split('-').map(Number);
    if (!a || !m) return;
    const ma = m === 1 ? 12 : m - 1;
    const aa = m === 1 ? a - 1 : a;
    setInicio(`${aa}-${dois(ma)}-26`);
    setFim(`${a}-${dois(m)}-25`);
    setPrevia(null);
    setResultado(null);
  }

  async function chamar(corpo) {
    const res = await fetch('/api/gorjetas/publicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const texto = await res.text();
    let data;
    try {
      data = JSON.parse(texto);
    } catch {
      throw new Error('O servidor devolveu uma resposta inesperada. Tente de novo.');
    }
    return { ok: res.ok, data };
  }

  function lerArquivo(e) {
    const file = e.target.files[0];
    setLeitura(null);
    setPrevia(null);
    setResultado(null);
    setErro('');
    setAceitaRisco(false);
    setNomeArquivo('');
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const lido = lerLinhas(XLSX, evt.target.result);
        if (lido.linhas.length === 0) {
          setErro('Não encontrei nenhuma pessoa nessa planilha.');
          return;
        }
        setLeitura(lido);
        setNomeArquivo(file.name);
        // O nome do arquivo costuma trazer o período (ex: ..._26092026_09102026.xlsx)
        const m = file.name.match(/(\d{2})(\d{2})(\d{4})_(\d{2})(\d{2})(\d{4})/);
        if (m && !inicio && !fim) {
          setInicio(`${m[3]}-${m[2]}-${m[1]}`);
          setFim(`${m[6]}-${m[5]}-${m[4]}`);
        }
      } catch (err) {
        setErro(err.message || 'Não foi possível ler a planilha.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function corpo(extra) {
    return {
      unidade,
      periodoInicio: inicio,
      periodoFim: fim,
      situacao,
      linhas: leitura.linhas,
      totaisPlanilha: leitura.totais,
      ...extra,
    };
  }

  async function conferir() {
    setCarregando(true);
    setErro('');
    setPrevia(null);
    try {
      const { ok, data } = await chamar(corpo({ simular: true }));
      if (ok) setPrevia(data);
      else setErro(data.erro || 'Erro ao conferir.');
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function publicar() {
    setCarregando(true);
    setErro('');
    try {
      const { ok, data } = await chamar(corpo({ simular: false, forcar: aceitaRisco }));
      if (ok) {
        setResultado(data);
        setPrevia(null);
        carregarPeriodos();
      } else {
        setErro(data.erro || 'Erro ao publicar.');
      }
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  async function despublicar(p) {
    const ok = window.confirm(
      `Apagar os extratos de "${p.unidade}" do período iniciado em ${dataCal(p.periodoInicio)}? ` +
      `${p.pessoas} pessoa(s) deixam de ver esse extrato.`
    );
    if (!ok) return;
    await fetch('/api/gorjetas/periodos', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unidade: p.unidade, periodoInicio: String(p.periodoInicio).slice(0, 10) }),
    });
    carregarPeriodos();
  }

  const podeConferir = leitura && unidade.trim() && inicio && fim;
  const confOk = previa && previa.conferencia && previa.conferencia.ok;

  return (
    <div>
      <BotaoVoltar />
      <h2>Gorjetas</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Suba a planilha de gorjeta (retenções legais) de uma unidade. O sistema identifica cada pessoa
        pelo <b>CPF</b> (a loja do cadastro não importa, então transferidos seguem o CPF), mostra uma
        prévia e, depois que você confirmar, cada colaborador passa a ver o próprio extrato.
      </p>

      <div className="card">
        <label>Unidade</label>
        <input
          list="unidades-gorjeta"
          value={unidade}
          onChange={mudou(setUnidade)}
          placeholder="Ex: Terraço Botafogo"
        />
        <datalist id="unidades-gorjeta">
          {unidadesConhecidas.map((u) => <option key={u} value={u} />)}
        </datalist>

        <label>Atalho: mês de fechamento (preenche do dia 26 do mês anterior ao dia 25)</label>
        <input type="month" onChange={preencherPeloMes} />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label>Início do período</label>
            <input type="date" value={inicio} onChange={mudou(setInicio)} />
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <label>Fim do período</label>
            <input type="date" value={fim} onChange={mudou(setFim)} />
          </div>
        </div>

        <label>Situação</label>
        <select value={situacao} onChange={mudou(setSituacao)}>
          <option value="parcial">Parcial — período ainda em aberto, valores podem mudar</option>
          <option value="fechado">Fechado — apuração concluída</option>
        </select>

        <label>Planilha (.xlsx ou .xls)</label>
        <input type="file" accept=".xlsx,.xls" onChange={lerArquivo} />
        {leitura && (
          <p style={{ fontSize: 13, color: 'var(--success)' }}>
            ✓ {nomeArquivo}: {leitura.linhas.length} pessoas lidas{leitura.totais ? ' e linha de total encontrada' : ' (sem linha de total)'}.
          </p>
        )}
        {erro && <div className="erro">{erro}</div>}

        <button onClick={conferir} disabled={!podeConferir || carregando}>
          {carregando && !previa ? 'Conferindo...' : 'Conferir antes de publicar'}
        </button>
      </div>

      {previa && (
        <div className="card">
          <h3>Confira antes de publicar</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {previa.totalNaPlanilha} pessoas na planilha. Nada foi gravado ainda.
          </p>

          {previa.conferencia && (
            confOk ? (
              <p style={{ fontSize: 13, color: 'var(--success)' }}>✓ A soma das linhas confere com o total da planilha.</p>
            ) : (
              <div style={{ background: '#fff3cd', border: '1px solid #ffe69c', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12 }}>
                A soma das linhas não bate com o total em:{' '}
                {previa.conferencia.diferencas.map((d) => `${ROTULO_CAMPO[d.campo] || d.campo} (planilha ${dinheiro(d.planilha)}, soma ${dinheiro(d.soma)})`).join('; ')}.
              </div>
            )
          )}

          {previa.alerta && (
            <div style={{ background: '#fff3cd', border: '1px solid #ffe69c', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12 }}>
              <b>⚠ Atenção:</b> {previa.motivosAlerta.join(' ')}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 0 }}>
                <input type="checkbox" checked={aceitaRisco} onChange={(e) => setAceitaRisco(e.target.checked)} style={{ width: 'auto', margin: 0 }} />
                Conferi e quero publicar mesmo assim
              </label>
            </div>
          )}

          <Relatorio r={previa} />

          <button
            onClick={publicar}
            disabled={carregando || (previa.alerta && !aceitaRisco) || previa.novos + previa.atualizados + previa.removidos.length === 0}
            style={{ marginTop: 14 }}
          >
            {carregando ? 'Publicando...' : 'Publicar extratos'}
          </button>
          {previa.novos + previa.atualizados + previa.removidos.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--success)' }}>✓ Nada para mudar: o que está publicado já é igual à planilha.</p>
          )}
        </div>
      )}

      {resultado && (
        <div className="card">
          <h3 style={{ color: 'var(--success)' }}>✓ Publicado</h3>
          <Relatorio r={resultado} />
        </div>
      )}

      <h3 style={{ marginTop: 28 }}>Períodos publicados</h3>
      {periodos.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Nenhum período publicado ainda.</p>}
      {periodos.map((p) => (
        <div key={`${p.unidade}-${p.periodoInicio}`} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div>
              <b>{p.unidade}</b>{' '}
              <span className={`badge ${p.situacao === 'fechado' ? 'respondida' : 'aberta'}`}>
                {p.situacao === 'fechado' ? 'Fechado' : 'Parcial'}
              </span>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                {dataCal(p.periodoInicio)} a {dataCal(p.periodoFim)} · {p.pessoas} pessoas · líquida total {dinheiro(p.somaLiquida)}
                {p.atualizadoEm && ` · atualizado em ${new Date(p.atualizadoEm).toLocaleString('pt-BR')}`}
              </div>
            </div>
            <button className="secundario" style={{ padding: '4px 12px', fontSize: 12 }} onClick={() => despublicar(p)}>
              Despublicar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
