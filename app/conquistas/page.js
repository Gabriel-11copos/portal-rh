'use client';
import { useEffect, useState } from 'react';
import NavColaborador from '../components/NavColaborador';
import BotaoVoltar from '../components/BotaoVoltar';
import IconeSelo, { ehImagemDeSelo } from '../components/IconeSelo';

// <ajudantes>
// "14 meses" -> "1 ano e 2 meses"
function formatarTempo(meses) {
  if (!(meses >= 1)) return 'menos de 1 mês';
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes = [];
  if (anos > 0) partes.push(`${anos} ${anos === 1 ? 'ano' : 'anos'}`);
  if (resto > 0) partes.push(`${resto} ${resto === 1 ? 'mês' : 'meses'}`);
  return partes.join(' e ');
}

function textoFaltam(meses) {
  return `${meses === 1 || meses === 12 ? 'falta' : 'faltam'} ${formatarTempo(meses)}`;
}

// Datas de calendário ficam guardadas à meia-noite UTC: ler em UTC evita o "um dia a menos".
function dataCal(v) {
  return new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
// </ajudantes>

const ESTILOS = `
.sl-grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin: 12px 0 24px; }
.sl-selo {
  position: relative; background: #fff; border: 1px solid var(--border); border-radius: 18px;
  padding: 16px 12px; text-align: center;
}
.sl-selo.sl-ganho { border-color: var(--verde); box-shadow: 0 4px 14px rgba(7, 94, 84, .10); }
.sl-selo.sl-bloqueado { opacity: .5; filter: grayscale(1); }
.sl-icone {
  width: 60px; height: 60px; margin: 0 auto 8px; border-radius: 50%; background: var(--verde-pastel);
  display: flex; align-items: center; justify-content: center; font-size: 32px;
}
.sl-icone-img { background: transparent; width: 72px; height: 72px; }
.sl-nome { font-weight: 700; color: var(--verde); font-size: 15px; }
.sl-desc { font-size: 12px; color: var(--muted); margin-top: 2px; line-height: 1.35; }
.sl-extra { font-size: 12px; margin-top: 6px; color: #b5603a; font-weight: 700; }
.sl-msg { font-size: 12px; margin-top: 6px; font-style: italic; color: var(--text); }
.sl-novo { position: absolute; top: 8px; right: 8px; background: #d93025; color: #fff; border-radius: 999px; font-size: 10px; font-weight: 700; padding: 2px 7px; }
.sl-destaque { background: var(--verde-pastel); border: 1px solid var(--verde); border-radius: 18px; padding: 14px 16px; display: flex; gap: 12px; align-items: center; margin-bottom: 20px; }
`;

function Selo({ icone, imagem, nome, descricao, estado, extra, mensagem, novo }) {
  return (
    <div className={`sl-selo ${estado === 'ganho' ? 'sl-ganho' : 'sl-bloqueado'}`}>
      {novo && <span className="sl-novo">NOVO</span>}
      <div className={`sl-icone ${ehImagemDeSelo(icone) || imagem ? 'sl-icone-img' : ''}`}><IconeSelo icone={icone} imagem={imagem} tamanho={ehImagemDeSelo(icone) || imagem ? 68 : 32} /></div>
      <div className="sl-nome">{nome}</div>
      {descricao && <div className="sl-desc">{descricao}</div>}
      {extra && <div className="sl-extra">{extra}</div>}
      {mensagem && <div className="sl-msg">“{mensagem}”</div>}
    </div>
  );
}

export default function MinhasConquistas() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetch('/api/conquistas')
      .then(async (r) => ({ ok: r.ok, json: await r.json() }))
      .then(({ ok, json }) => {
        if (!ok) throw new Error(json.erro || 'Não foi possível carregar suas conquistas.');
        setDados(json);
        fetch('/api/conquistas/marcar-vistas', { method: 'POST' }); // tira a bolinha da tela inicial
      })
      .catch((e) => setErro(e.message || 'Não foi possível carregar suas conquistas.'));
  }, []);

  return (
    <div>
      <style>{ESTILOS}</style>
      <NavColaborador />
      <BotaoVoltar />
      <h2>Minhas conquistas</h2>

      {!dados && !erro && <p style={{ color: 'var(--muted)' }}>Carregando...</p>}
      {erro && <div className="erro">{erro}</div>}

      {dados && (
        <>
          {dados.aniversario && (
            <div className="sl-destaque">
              <div className="sl-icone sl-icone-img" style={{ margin: 0 }}><IconeSelo icone={dados.aniversario.icone} imagem={`/selos/${dados.aniversario.codigo}.png`} tamanho={68} /></div>
              <div>
                <div className="sl-nome">{dados.aniversario.nome}</div>
                <div className="sl-desc">Você é aniversariante do mês. Parabéns! 🎂</div>
              </div>
            </div>
          )}

          {dados.tempo && (
            <>
              <h3 style={{ marginBottom: 0 }}>Tempo de casa</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
                Você tem {formatarTempo(dados.tempo.meses)} de casa.
              </p>
              <div className="sl-grade">
                {dados.tempo.niveis.map((n) => (
                  <Selo
                    key={n.codigo}
                    icone={n.icone}
                    imagem={`/selos/${n.codigo}.png`}
                    nome={n.nome}
                    descricao={n.descricao}
                    estado={n.conquistado ? 'ganho' : 'bloqueado'}
                    extra={!n.conquistado && dados.tempo.proximo && dados.tempo.proximo.codigo === n.codigo ? textoFaltam(n.faltam) : null}
                  />
                ))}
              </div>
            </>
          )}

          <h3 style={{ marginBottom: 0 }}>Reconhecimentos e presença</h3>
          {dados.concedidos.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              Ainda não há reconhecimentos por aqui. Eles aparecem quando o RH registra uma conquista sua.
            </p>
          ) : (
            <div className="sl-grade">
              {dados.concedidos.map((g) => (
                <Selo
                  key={g.id}
                  icone={g.icone}
                  nome={g.nome}
                  descricao={g.descricao}
                  estado="ganho"
                  extra={dataCal(g.data)}
                  mensagem={g.mensagem}
                  novo={g.novo}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
