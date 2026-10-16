'use client';
import { useEffect, useState } from 'react';
import BotaoVoltar from '../../components/BotaoVoltar';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// <csv>
function dois(n) {
  return String(n).padStart(2, '0');
}

// Planilha para abrir no Excel em português: separador ";" e BOM para os acentos.
function montarCsv(lista) {
  const celula = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const linhas = [['Dia', 'Nome', 'Loja', 'Cargo'].map(celula).join(';')];
  for (const a of lista) {
    linhas.push([`${dois(a.dia)}/${dois(a.mes)}`, a.nome, a.loja, a.cargo].map(celula).join(';'));
  }
  return '\uFEFF' + linhas.join('\r\n');
}
// </csv>

export default function Aniversariantes() {
  const [mes, setMes] = useState(null);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  async function carregar(m) {
    setErro('');
    try {
      const res = await fetch(`/api/aniversariantes${m ? `?mes=${m}` : ''}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao carregar.');
      setDados(json);
      setMes(json.mes);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar.');
    }
  }

  useEffect(() => { carregar(null); }, []);

  function baixar() {
    const blob = new Blob([montarCsv(dados.aniversariantes)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aniversariantes-${dois(dados.mes)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const hojeMes = dados ? Number(dados.hoje.slice(5, 7)) : null;
  const hojeDia = dados ? Number(dados.hoje.slice(8, 10)) : null;

  return (
    <div>
      <BotaoVoltar />
      <h2>Aniversariantes</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Colaboradores ativos que fazem aniversário no mês. Cada um recebe o cartão de parabéns no dia,
        direto no portal. Use a lista para conferir quem recebe o BrewCheque no mês.
      </p>

      <div className="card">
        <label>Mês</label>
        <select value={mes || ''} onChange={(e) => { setDados(null); carregar(e.target.value); }}>
          {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
        </select>
        {erro && <div className="erro">{erro}</div>}
        {dados && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <b>{dados.aniversariantes.length} aniversariante(s)</b>
            <button className="secundario" onClick={baixar} disabled={dados.aniversariantes.length === 0}>
              Baixar planilha (.csv)
            </button>
          </div>
        )}
      </div>

      {dados && dados.aniversariantes.map((a) => {
        const hoje = a.mes === hojeMes && a.dia === hojeDia;
        return (
          <div key={a.id} className="card" style={hoje ? { borderColor: 'var(--verde)', background: 'var(--verde-pastel)' } : undefined}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <div>
                <b>{a.nome}</b>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{a.loja}{a.cargo ? ` · ${a.cargo}` : ''}</div>
              </div>
              <div style={{ textAlign: 'right', fontWeight: 700, color: 'var(--verde)' }}>
                {dois(a.dia)}/{dois(a.mes)}{hoje ? ' · hoje 🎂' : ''}
              </div>
            </div>
          </div>
        );
      })}

      <h3 style={{ marginTop: 24 }}>Como o cartão aparece para o colaborador</h3>
      <div className="card" style={{ textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 10px' }}>Feliz aniversário, Maria! 🎂</h3>
        <img src="/aniversario.jpg" alt="Cartão de aniversário" style={{ width: '100%', maxWidth: 340, borderRadius: 16 }} />
      </div>
    </div>
  );
}
