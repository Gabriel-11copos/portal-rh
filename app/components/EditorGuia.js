'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import GuiaBlocos from './GuiaBlocos';

// <editor>
const CATEGORIAS = ['Treinamentos', 'Manuais', 'Regras', 'Benefícios', 'Cursos', 'Geral'];
const LIMITE_MB = 4;

let contador = 0;
function chave() { contador += 1; return `b${Date.now()}-${contador}`; }

function blocoNovo(tipo) {
  if (tipo === 'texto') return { _k: chave(), tipo, texto: '' };
  if (tipo === 'imagem') return { _k: chave(), tipo, midiaId: '', legenda: '' };
  if (tipo === 'arquivo') return { _k: chave(), tipo, nome: '', midiaId: '', url: '' };
  return { _k: chave(), tipo: 'link', texto: '', url: '' };
}

// Troca dois blocos de lugar (para as setinhas de subir e descer).
function mover(blocos, indice, direcao) {
  const destino = indice + direcao;
  if (destino < 0 || destino >= blocos.length) return blocos;
  const copia = [...blocos];
  [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
  return copia;
}

// Tamanho da imagem depois de reduzida (largura máxima), sem distorcer.
function calcularTamanho(largura, altura, maximo) {
  if (largura <= maximo) return { largura, altura };
  return { largura: maximo, altura: Math.round((altura * maximo) / largura) };
}

// Tira os campos de controle e os campos vazios do bloco antes de enviar para salvar.
function blocosParaEnviar(blocos) {
  return blocos.map(({ _k, ...b }) => {
    if (b.tipo === 'arquivo') return b.midiaId ? { tipo: b.tipo, nome: b.nome, midiaId: b.midiaId } : { tipo: b.tipo, nome: b.nome, url: b.url };
    return b;
  });
}
// </editor>

// Reduz fotos grandes no navegador (largura máxima de 1200 px) para o envio ser leve.
async function reduzirImagem(arquivo) {
  if (arquivo.type === 'image/gif' || !arquivo.type.startsWith('image/')) return arquivo;
  const bitmap = await createImageBitmap(arquivo);
  const { largura, altura } = calcularTamanho(bitmap.width, bitmap.height, 1200);
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';            // PNG com fundo transparente fica com fundo branco
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.82));
  if (!blob) return arquivo;
  const nome = arquivo.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], nome, { type: 'image/jpeg' });
}

export default function EditorGuia({ id }) {
  const router = useRouter();
  const [carregando, setCarregando] = useState(!!id);
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('Treinamentos');
  const [ativo, setAtivo] = useState(false);
  const [blocos, setBlocos] = useState([]);
  const [previa, setPrevia] = useState(false);
  const [enviando, setEnviando] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/guias/${id}`)
      .then(async (r) => ({ ok: r.ok, json: await r.json() }))
      .then(({ ok, json }) => {
        if (!ok) throw new Error(json.erro || 'Não foi possível abrir o guia.');
        setTitulo(json.titulo);
        setDescricao(json.descricao || '');
        setCategoria(json.categoria);
        setAtivo(!!json.ativo);
        setBlocos(json.blocos.map((b) => ({ _k: chave(), ...b, legenda: b.legenda || '', nome: b.nome || '', url: b.url || '', midiaId: b.midiaId || '', texto: b.texto || '' })));
      })
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, [id]);

  function alterar(indice, campos) {
    setBlocos((atual) => atual.map((b, i) => (i === indice ? { ...b, ...campos } : b)));
    setMsg('');
  }

  async function enviarArquivo(indice, arquivo, ehImagem) {
    if (!arquivo) return;
    setErro('');
    setEnviando(`Enviando ${arquivo.name}...`);
    try {
      let envio = arquivo;
      if (ehImagem) envio = await reduzirImagem(arquivo).catch(() => arquivo);
      if (envio.size > LIMITE_MB * 1024 * 1024) {
        setErro(`O arquivo passa de ${LIMITE_MB} MB. Para arquivos grandes, cole um link (por exemplo, do Google Drive).`);
        return;
      }
      const form = new FormData();
      form.set('arquivo', envio);
      const res = await fetch('/api/guias/midia', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) { setErro(json.erro || 'Não foi possível enviar o arquivo.'); return; }
      alterar(indice, ehImagem ? { midiaId: json.id } : { midiaId: json.id, url: '', nome: blocos[indice].nome || json.nome });
    } catch (e) {
      setErro(e.message || 'Não foi possível enviar o arquivo.');
    } finally {
      setEnviando('');
    }
  }

  async function salvar(publicar) {
    setSalvando(true);
    setErro('');
    setMsg('');
    try {
      const corpo = { titulo, descricao, categoria, ativo: publicar === undefined ? ativo : publicar, blocos: blocosParaEnviar(blocos) };
      const res = await fetch(id ? `/api/guias/${id}` : '/api/guias', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      const json = await res.json();
      if (!res.ok) { setErro(json.erro || 'Não foi possível salvar.'); return; }
      if (!id) { router.replace(`/admin/guias/${json.id}`); return; }
      setAtivo(corpo.ativo);
      setMsg(corpo.ativo ? 'Salvo e publicado.' : 'Salvo como rascunho.');
    } catch (e) {
      setErro(e.message || 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!window.confirm('Excluir este guia? As imagens e arquivos dele também serão apagados. Não dá para desfazer.')) return;
    const res = await fetch(`/api/guias/${id}`, { method: 'DELETE' });
    if (res.ok) router.replace('/admin/guias');
    else setErro('Não foi possível excluir.');
  }

  if (carregando) return <p style={{ color: 'var(--muted)' }}>Carregando...</p>;

  return (
    <div>
      <div className="card">
        <label>Título</label>
        <input value={titulo} maxLength={80} onChange={(e) => { setTitulo(e.target.value); setMsg(''); }} placeholder="Ex: Abertura do bar" />
        <label>Descrição curta (aparece na lista)</label>
        <input value={descricao} maxLength={200} onChange={(e) => { setDescricao(e.target.value); setMsg(''); }} placeholder="Ex: Passo a passo para abrir a casa" />
        <label>Categoria</label>
        <input list="categorias-guia" value={categoria} maxLength={40} onChange={(e) => { setCategoria(e.target.value); setMsg(''); }} />
        <datalist id="categorias-guia">{CATEGORIAS.map((c) => <option key={c} value={c} />)}</datalist>
      </div>

      <h3>Conteúdo</h3>
      {blocos.length === 0 && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Adicione os blocos abaixo, na ordem em que o colaborador deve ler.</p>}

      {blocos.map((b, i) => (
        <div key={b._k} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8 }}>
            <b style={{ fontSize: 13, color: 'var(--muted)' }}>
              {i + 1}. {{ texto: '📝 Texto', imagem: '🖼️ Imagem', arquivo: '📎 Arquivo', link: '🔗 Link ou vídeo' }[b.tipo]}
            </b>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" className="secundario" style={{ padding: '2px 10px' }} disabled={i === 0} onClick={() => setBlocos(mover(blocos, i, -1))} title="Subir">↑</button>
              <button type="button" className="secundario" style={{ padding: '2px 10px' }} disabled={i === blocos.length - 1} onClick={() => setBlocos(mover(blocos, i, 1))} title="Descer">↓</button>
              <button type="button" className="secundario" style={{ padding: '2px 10px' }} onClick={() => { setBlocos(blocos.filter((_, j) => j !== i)); setMsg(''); }} title="Remover">✕</button>
            </div>
          </div>

          {b.tipo === 'texto' && (
            <textarea rows={5} value={b.texto} maxLength={5000} onChange={(e) => alterar(i, { texto: e.target.value })} placeholder="Escreva o texto aqui. As quebras de linha são mantidas." />
          )}

          {b.tipo === 'imagem' && (
            <>
              {b.midiaId
                ? <img src={`/api/guias/midia/${b.midiaId}`} alt="" style={{ maxWidth: 220, borderRadius: 10, display: 'block', marginBottom: 8 }} />
                : <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px' }}>Nenhuma imagem enviada ainda.</p>}
              <input type="file" accept="image/*" onChange={(e) => enviarArquivo(i, e.target.files[0], true)} />
              <label>Legenda (opcional)</label>
              <input value={b.legenda} maxLength={160} onChange={(e) => alterar(i, { legenda: e.target.value })} />
            </>
          )}

          {b.tipo === 'arquivo' && (
            <>
              <label>Nome do botão</label>
              <input value={b.nome} maxLength={120} onChange={(e) => alterar(i, { nome: e.target.value })} placeholder="Ex: Checklist de abertura (PDF)" />
              <label>Enviar arquivo (até {LIMITE_MB} MB: PDF, Word, Excel, PowerPoint)</label>
              <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" onChange={(e) => enviarArquivo(i, e.target.files[0], false)} />
              {b.midiaId && <p style={{ fontSize: 13, color: 'var(--success)', margin: '6px 0 0' }}>✓ Arquivo enviado. O colaborador só abre com login no portal.</p>}
              {!b.midiaId && (
                <>
                  <label>Ou cole um link (para arquivos grandes)</label>
                  <input value={b.url} onChange={(e) => alterar(i, { url: e.target.value })} placeholder="https://drive.google.com/..." />
                </>
              )}
            </>
          )}

          {b.tipo === 'link' && (
            <>
              <label>Texto do botão</label>
              <input value={b.texto} maxLength={80} onChange={(e) => alterar(i, { texto: e.target.value })} placeholder="Ex: Assistir ao vídeo do treinamento" />
              <label>Link (precisa começar com http)</label>
              <input value={b.url} onChange={(e) => alterar(i, { url: e.target.value })} placeholder="https://youtu.be/..." />
            </>
          )}
        </div>
      ))}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 16px' }}>
        <button type="button" className="secundario" onClick={() => setBlocos([...blocos, blocoNovo('texto')])}>+ Texto</button>
        <button type="button" className="secundario" onClick={() => setBlocos([...blocos, blocoNovo('imagem')])}>+ Imagem</button>
        <button type="button" className="secundario" onClick={() => setBlocos([...blocos, blocoNovo('arquivo')])}>+ Arquivo</button>
        <button type="button" className="secundario" onClick={() => setBlocos([...blocos, blocoNovo('link')])}>+ Link ou vídeo</button>
      </div>
      {enviando && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{enviando}</p>}

      {previa && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{titulo || 'Sem título'}</h3>
          {descricao && <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 0 }}>{descricao}</p>}
          <GuiaBlocos blocos={blocosParaEnviar(blocos).filter((b) => (b.tipo === 'texto' ? b.texto : true))} />
        </div>
      )}

      {erro && <div className="erro">{erro}</div>}
      {msg && <p style={{ fontSize: 13, color: 'var(--success)' }}>{msg}</p>}

      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={ativo} onChange={(e) => { setAtivo(e.target.checked); setMsg(''); }} style={{ width: 'auto', margin: 0 }} />
        Publicado (os colaboradores veem)
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => salvar()} disabled={salvando || !!enviando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
        <button type="button" className="secundario" onClick={() => setPrevia((v) => !v)}>{previa ? 'Esconder pré-visualização' : 'Pré-visualizar'}</button>
        {id && <button type="button" className="secundario" onClick={excluir}>Excluir guia</button>}
      </div>
    </div>
  );
}
