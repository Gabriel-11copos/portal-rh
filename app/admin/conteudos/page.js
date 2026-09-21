'use client';
import { useEffect, useMemo, useState } from 'react';
import BotaoVoltar from '../../components/BotaoVoltar';
import UploadAnexo from '../../components/UploadAnexo';

const CATEGORIAS_SUGERIDAS = ['Cursos', 'Links úteis', 'Contatos', 'Benefícios', 'Regras', 'Manuais'];
const VAZIO = { categoria: '', titulo: '', descricao: '', tipo: 'arquivo', url: '', nomeArquivo: '', ativo: true };

export default function GerenciarConteudos() {
  const [conteudos, setConteudos] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [editandoId, setEditandoId] = useState(null);

  function carregar() {
    fetch('/api/conteudos').then((r) => r.json()).then(setConteudos);
  }
  useEffect(carregar, []);

  const categoriasExistentes = useMemo(
    () => [...new Set([...CATEGORIAS_SUGERIDAS, ...conteudos.map((c) => c.categoria)])],
    [conteudos]
  );

  const porCategoria = useMemo(() => {
    const grupos = {};
    for (const c of conteudos) {
      if (!grupos[c.categoria]) grupos[c.categoria] = [];
      grupos[c.categoria].push(c);
    }
    return grupos;
  }, [conteudos]);

  function editar(c) {
    setEditandoId(c.id);
    setForm({
      categoria: c.categoria,
      titulo: c.titulo,
      descricao: c.descricao || '',
      tipo: c.tipo,
      url: c.url || '',
      nomeArquivo: c.nomeArquivo || '',
      ativo: c.ativo,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setForm(VAZIO);
  }

  async function salvar(e) {
    e.preventDefault();
    if (editandoId) {
      await fetch(`/api/conteudos/${editandoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    } else {
      await fetch('/api/conteudos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
    }
    cancelarEdicao();
    carregar();
  }

  return (
    <div>
      <BotaoVoltar />
      <h2>Conteúdos do portal</h2>
      <p style={{ fontSize: 13, color: 'var(--muted)' }}>
        Cursos, links úteis, contatos, benefícios, regras, manuais — tudo que o colaborador pode consultar dentro do portal.
      </p>

      <div className="card">
        <h3>{editandoId ? 'Editar conteúdo' : 'Novo conteúdo'}</h3>
        <form onSubmit={salvar}>
          <label>Categoria</label>
          <input
            list="categorias-sugeridas"
            value={form.categoria}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            placeholder="Ex: Cursos, Benefícios, Manuais..."
            required
          />
          <datalist id="categorias-sugeridas">
            {categoriasExistentes.map((c) => <option key={c} value={c} />)}
          </datalist>

          <label>Título</label>
          <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />

          <label>Tipo de conteúdo</label>
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value, url: '', nomeArquivo: '' })}>
            <option value="arquivo">Arquivo (PDF, vídeo, imagem)</option>
            <option value="link">Link externo</option>
            <option value="texto">Texto (ex: contato, regra)</option>
          </select>

          {form.tipo === 'arquivo' && (
            <>
              <UploadAnexo onUploaded={(a) => setForm({ ...form, url: a.link, nomeArquivo: a.nomeArquivo })} />
              {form.nomeArquivo && <p style={{ fontSize: 13, color: 'var(--success)' }}>✓ {form.nomeArquivo}</p>}
            </>
          )}

          {form.tipo === 'link' && (
            <>
              <label>URL</label>
              <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..." required />
            </>
          )}

          <label>{form.tipo === 'texto' ? 'Conteúdo' : 'Observação (opcional)'}</label>
          <textarea rows={form.tipo === 'texto' ? 5 : 2} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} required={form.tipo === 'texto'} />

          {editandoId && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                style={{ width: 'auto', margin: 0 }}
              />
              Ativo (visível para o colaborador)
            </label>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="submit">{editandoId ? 'Salvar alterações' : 'Publicar conteúdo'}</button>
            {editandoId && <button type="button" className="secundario" onClick={cancelarEdicao}>Cancelar</button>}
          </div>
        </form>
      </div>

      {Object.entries(porCategoria).map(([categoria, itens]) => (
        <div key={categoria} className="card">
          <h3 style={{ marginTop: 0 }}>{categoria}</h3>
          {itens.map((c) => (
            <div
              key={c.id}
              onClick={() => editar(c)}
              style={{
                padding: '8px 0', borderTop: '1px solid var(--border)', cursor: 'pointer',
                opacity: c.ativo ? 1 : 0.5, fontSize: 14,
              }}
            >
              <b>{c.titulo}</b> {!c.ativo && <span className="badge encerrada">Inativo</span>}
              <span style={{ color: 'var(--muted)' }}> · {c.tipo === 'arquivo' ? c.nomeArquivo : c.tipo === 'link' ? c.url : 'texto'}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
