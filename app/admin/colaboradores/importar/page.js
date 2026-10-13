'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import BotaoVoltar from '../../../components/BotaoVoltar';

const MAPA_LOJA = {
  'BREWTECO TERRACO BAR E RESTAURANTE LTDA': 'Brewteco Terraço',
  'BREWTECO GAVEA BAR E RESTAURANTE LTDA': 'Brewteco Gávea',
  'BREWTECO ROSAS BAR E RESTAURANTE LTDA': 'Brewteco Rosas',
  'BREWTECO TIJUCA BAR E RESTAURANTE LTDA': 'Brewteco Tijuca',
  'ONZE COPOS PARTICIPACOES S.A.': 'Onze Copos (Administrativo)',
  'BREWTECO LARANJEIRAS BAR E RESTAURANTE LTDA': 'Brewteco Laranjeiras',
  'BAR MARISQUEIRA DO LEBLON LTDA': 'Marisqueira do Leblon',
  'CERVEJARIA BREWTECO LTDA': 'Cervejaria Brewteco (Fábrica)',
  'BREWTECO MORRO DA URCA BAR E RESTAURANTE LTDA': 'Brewteco Morro da Urca',
  'ONZE COPOS EVENTOS LTDA': 'Onze Copos Eventos',
};

function semAcento(txt) {
  return String(txt).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\.$/, '');
}

function tituloNome(nome) {
  const preps = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
  return String(nome).trim().toLowerCase().split(/\s+/).map((p, i) =>
    i > 0 && preps.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)
  ).join(' ');
}

function normalizarLoja(nomeEmpresa) {
  const chave = semAcento(nomeEmpresa);
  for (const k of Object.keys(MAPA_LOJA)) {
    if (chave.startsWith(semAcento(k))) return MAPA_LOJA[k];
  }
  return String(nomeEmpresa).trim();
}

// Converte a data lida da planilha em "aaaa-mm-dd". Soma 12h antes de ler o dia
// para não errar por diferenças de fuso/horário na leitura do Excel.
function paraDataISO(valor) {
  if (!(valor instanceof Date) || isNaN(valor)) return null;
  const d = new Date(valor.getTime() + 12 * 60 * 60 * 1000);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
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
        <Contador n={r.admitidos.length} rotulo="admissões" />
        <Contador n={r.transferidos.length} rotulo="transferências" />
        <Contador n={r.mudancasCargo.length} rotulo="mudanças de cargo" />
        <Contador n={r.reativados.length} rotulo="reativações" />
        <Contador n={r.inativados.length} rotulo="inativações" cor="var(--danger)" />
      </div>
      <Lista titulo="Admissões (novos cadastros)" itens={r.admitidos} render={(n) => n} />
      <Lista titulo="Transferências de loja" itens={r.transferidos} render={(t) => `${t.nome}: ${t.de} → ${t.para}`} />
      <Lista titulo="Mudanças de cargo" itens={r.mudancasCargo} render={(t) => `${t.nome}: ${t.de} → ${t.para}`} />
      <Lista titulo="Reativações" itens={r.reativados} render={(n) => n} />
      <Lista titulo="Inativações (não constam na lista)" itens={r.inativados} render={(n) => n} cor="var(--danger)" />
      <Lista titulo="Dados cadastrais atualizados" itens={r.atualizados} render={(n) => n} />
    </>
  );
}

export default function ImportarColaboradores() {
  const [previa, setPrevia] = useState(null);
  const [linhas, setLinhas] = useState([]);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [aceitaRisco, setAceitaRisco] = useState(false);

  async function chamar(corpo) {
    const res = await fetch('/api/colaboradores/sincronizar', {
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
    setPrevia(null);
    setResultado(null);
    setErro('');
    setAceitaRisco(false);
    setLinhas([]);
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'array', cellDates: true });
        const dados = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });

        const processadas = dados
          .filter((r) => r['CPF'])
          .map((r) => ({
            nome: tituloNome(r['Nome do Funcionário'] || ''),
            cpf: String(r['CPF']).replace(/\D/g, '').padStart(11, '0'),
            loja: normalizarLoja(r['Nome da Empresa'] || ''),
            cargo: r['Função'] || null,
            email: r['Email'] || null,
            dataAdmissao: paraDataISO(r['Admissão']),
            dataNascimento: paraDataISO(r['Nascimento']),
          }));

        if (processadas.length === 0) {
          setErro('Não encontrei nenhuma linha com CPF nessa planilha. Confira se é a planilha de ativos.');
          return;
        }

        setLinhas(processadas);
        setCarregando(true);
        const { ok, data } = await chamar({ colaboradores: processadas, simular: true });
        if (ok) setPrevia(data);
        else setErro(data.erro || 'Erro ao conferir a planilha.');
      } catch (err) {
        setErro(err.message || 'Não foi possível ler a planilha.');
      } finally {
        setCarregando(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function aplicar() {
    setCarregando(true);
    setErro('');
    try {
      const { ok, data } = await chamar({ colaboradores: linhas, simular: false, forcar: aceitaRisco });
      if (ok) {
        setResultado(data);
        setPrevia(null);
      } else {
        setErro(data.erro || 'Erro ao sincronizar.');
      }
    } catch (err) {
      setErro(err.message || 'Erro inesperado.');
    } finally {
      setCarregando(false);
    }
  }

  const semMudancas =
    previa &&
    previa.admitidos.length + previa.transferidos.length + previa.mudancasCargo.length +
      previa.reativados.length + previa.inativados.length + previa.atualizados.length === 0;

  return (
    <div>
      <BotaoVoltar />
      <h2>Importar lista de ativos</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Suba a planilha de ativos. Antes de gravar, o sistema mostra o que vai acontecer:
        novos colaboradores são cadastrados, quem mudou de empresa ou de função é atualizado
        (o histórico da pessoa é mantido e a mudança fica registrada), e quem não consta mais
        na lista é inativado.
      </p>

      <div className="card">
        <label>Planilha de colaboradores ativos (.xls ou .xlsx)</label>
        <input type="file" accept=".xls,.xlsx" onChange={lerArquivo} />
        {carregando && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Processando...</p>}
        {erro && <div className="erro">{erro}</div>}
      </div>

      {previa && (
        <div className="card">
          <h3>Confira antes de aplicar</h3>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {previa.totalNaLista} pessoas na planilha · {previa.ativosAntes} ativas hoje no sistema.
            Nada foi gravado ainda.
          </p>

          {previa.alerta && (
            <div style={{ background: '#fff3cd', border: '1px solid #ffe69c', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12 }}>
              <b>⚠ Atenção:</b> {previa.motivoAlerta}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 0 }}>
                <input
                  type="checkbox"
                  checked={aceitaRisco}
                  onChange={(e) => setAceitaRisco(e.target.checked)}
                  style={{ width: 'auto', margin: 0 }}
                />
                Conferi e quero aplicar mesmo assim
              </label>
            </div>
          )}

          {previa.lojasNovas.length > 0 && (
            <div style={{ background: '#fff3cd', border: '1px solid #ffe69c', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12 }}>
              <b>Loja/empresa nova no sistema:</b> {previa.lojasNovas.join(', ')}. Confira se o nome está certo,
              porque ele vai passar a existir como loja.
            </div>
          )}

          <Relatorio r={previa} />

          <Lista titulo="Linhas ignoradas da planilha" itens={previa.ignoradas} render={(t) => t} cor="var(--danger)" />
          <Lista
            titulo="Não inativados por segurança (a planilha tem esse nome com CPF inválido — confira)"
            itens={previa.verificar}
            render={(n) => n}
            cor="var(--warning)"
          />

          {semMudancas && <p style={{ fontSize: 14, color: 'var(--success)' }}>✓ Nada para mudar: o sistema já está igual à planilha.</p>}

          <button
            onClick={aplicar}
            disabled={carregando || semMudancas || (previa.alerta && !aceitaRisco)}
            style={{ marginTop: 14 }}
          >
            {carregando ? 'Aplicando...' : 'Aplicar mudanças'}
          </button>
        </div>
      )}

      {resultado && (
        <div className="card">
          <h3 style={{ color: 'var(--success)' }}>✓ Importação concluída</h3>
          <Relatorio r={resultado} />
          <Lista titulo="Linhas ignoradas da planilha" itens={resultado.ignoradas} render={(t) => t} cor="var(--danger)" />
          <Lista titulo="Não inativados por segurança (confira)" itens={resultado.verificar} render={(n) => n} cor="var(--warning)" />
        </div>
      )}
    </div>
  );
}
