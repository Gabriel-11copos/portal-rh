'use client';
import { useEffect, useState } from 'react';
import BotaoVoltar from '../../components/BotaoVoltar';
import EscalaSemana from '../../components/EscalaSemana';

const rotulo = (c) => `${c.nomeSocial || c.nome} — ${c.loja}`;

export default function EscalaPrevia() {
  const [colaboradores, setColaboradores] = useState([]);
  const [texto, setTexto] = useState('');
  const [pessoa, setPessoa] = useState(null);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    fetch('/api/colaboradores')
      .then((r) => r.json())
      .then((lista) => setColaboradores(Array.isArray(lista) ? lista.filter((c) => c.ativo) : []));
  }, []);

  async function carregar(id, dataInicio) {
    setCarregando(true);
    setErro('');
    try {
      const qs = `colaboradorId=${encodeURIComponent(id)}${dataInicio ? `&inicio=${dataInicio}` : ''}`;
      const res = await fetch(`/api/escalas/previa?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.erro || 'Erro ao carregar a escala.');
      setDados(json);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar a escala.');
    } finally {
      setCarregando(false);
    }
  }

  function escolher(valor) {
    setTexto(valor);
    const c = colaboradores.find((x) => rotulo(x) === valor);
    if (c) {
      setPessoa(c);
      setDados(null);
      carregar(c.id, null);
    }
  }

  return (
    <div>
      <BotaoVoltar />
      <h2>Prévia da escala de um colaborador</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Escolha um colaborador e veja a escala exatamente como ele verá. Serve para conferir com o
        escalas-app antes de liberar. Esta tela é só do RH e funciona mesmo com a escala fechada para os
        colaboradores.
      </p>

      <div className="card">
        <label>Colaborador (digite o nome e escolha na lista)</label>
        <input
          list="lista-colaboradores-escala"
          value={texto}
          onChange={(e) => escolher(e.target.value)}
          placeholder="Digite para buscar..."
        />
        <datalist id="lista-colaboradores-escala">
          {colaboradores.map((c) => <option key={c.id} value={rotulo(c)} />)}
        </datalist>
      </div>

      {erro && <div className="erro">{erro}</div>}
      {carregando && !dados && <p style={{ color: 'var(--muted)' }}>Carregando... na primeira vez do dia pode demorar um pouco.</p>}

      {dados && pessoa && (
        <>
          <h3>Escala de {dados.colaborador.nome}</h3>
          <EscalaSemana dados={dados} carregando={carregando} onCarregar={(d) => carregar(pessoa.id, d)} />
        </>
      )}
    </div>
  );
}
