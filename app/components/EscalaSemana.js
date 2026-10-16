'use client';

// Mostra uma semana de escala. Usado pela tela do colaborador e pela prévia do RH.

// <ajudantes>
const ROTULO_STATUS = {
  TRABALHO: 'Trabalho',
  FOLGA: 'Folga',
  FERIAS: 'Férias',
  FALTA: 'Falta',
  AFASTADA: 'Afastamento',
  BANCO_HORAS: 'Banco de horas',
  EMPRESTADO: 'Emprestado',
};

function rotuloStatus(status) {
  if (ROTULO_STATUS[status]) return ROTULO_STATUS[status];
  const s = String(status || '').toLowerCase().replace(/_/g, ' ');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Sem informação';
}

// Se a saída é menor que a entrada (ex: 18:00 às 02:00), o turno termina no dia seguinte.
function viraODia(entrada, saida) {
  return !!entrada && !!saida && saida < entrada;
}

function diaDaSemana(dataISO) {
  const [a, m, d] = dataISO.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  const semana = dt.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

function somarDiasISO(dataISO, n) {
  const [a, m, d] = dataISO.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}
// </ajudantes>

const ESTILO_STATUS = {
  TRABALHO: { background: 'var(--verde-pastel)', color: 'var(--verde)' },
  FALTA: { background: '#fed7d7', color: 'var(--danger)' },
  FERIAS: { background: '#fff3cd', color: 'var(--warning)' },
  BANCO_HORAS: { background: '#fff3cd', color: 'var(--warning)' },
};

function Turno({ item }) {
  const trabalho = item.status === 'TRABALHO';
  const estilo = ESTILO_STATUS[item.status] || { background: '#f1f5f1', color: 'var(--muted)' };
  const detalhes = [item.lojaNome, item.cargo, item.area].filter(Boolean).join(' · ');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', flexWrap: 'wrap' }}>
      <span style={{ ...estilo, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
        {rotuloStatus(item.status)}
      </span>
      {trabalho && item.entrada && item.saida && (
        <span style={{ fontWeight: 700, fontSize: 16 }}>
          {item.entrada} às {item.saida}
          {viraODia(item.entrada, item.saida) && (
            <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--muted)' }}> (sai no dia seguinte)</span>
          )}
        </span>
      )}
      {detalhes && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{detalhes}</span>}
    </div>
  );
}

// dados: resposta da API (inicio, hoje, minimo, maximo, dias). onCarregar(dataInicio): busca outra semana.
export default function EscalaSemana({ dados, carregando, onCarregar, aviso }) {
  const inicio = dados.inicio;
  const podeVoltar = somarDiasISO(inicio, -7) >= dados.minimo;
  const podeAvancar = somarDiasISO(inicio, 7) <= dados.maximo;
  const haErroNosDias = dados.dias.some((d) => d.erro);

  return (
    <>
      {aviso && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{aviso}</p>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button className="secundario" disabled={!podeVoltar || carregando} onClick={() => onCarregar(somarDiasISO(inicio, -7))}>
          ← Semana anterior
        </button>
        <button className="secundario" disabled={carregando || inicio === dados.hoje} onClick={() => onCarregar(dados.hoje)}>
          Hoje
        </button>
        <button className="secundario" disabled={!podeAvancar || carregando} onClick={() => onCarregar(somarDiasISO(inicio, 7))}>
          Próxima semana →
        </button>
      </div>

      {haErroNosDias && (
        <div style={{ background: '#fff3cd', border: '1px solid #ffe69c', borderRadius: 10, padding: 12, fontSize: 13, marginBottom: 12 }}>
          Alguns dias não puderam ser carregados porque o serviço de escalas não respondeu. Ele pode estar
          "acordando": espere um minuto e{' '}
          <button className="secundario" style={{ padding: '2px 10px', fontSize: 12 }} onClick={() => onCarregar(inicio)}>
            tente de novo
          </button>.
        </div>
      )}

      {dados.dias.map((dia) => (
        <div key={dia.data} className="card" style={{ opacity: carregando ? 0.6 : 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b>{diaDaSemana(dia.data)}</b>
            {dia.data === dados.hoje && <span className="badge respondida">Hoje</span>}
          </div>
          {dia.erro && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0 0' }}>Não foi possível carregar este dia.</p>}
          {!dia.erro && dia.itens.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '6px 0 0' }}>Sem escala lançada para este dia.</p>
          )}
          {dia.itens.map((item, i) => <Turno key={i} item={item} />)}
        </div>
      ))}
    </>
  );
}
