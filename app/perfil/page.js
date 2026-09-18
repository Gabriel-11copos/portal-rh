'use client';
import { useEffect, useState } from 'react';
import NavColaborador from '../components/NavColaborador';

export default function MeuPerfil() {
  const [perfil, setPerfil] = useState(null);

  useEffect(() => {
    fetch('/api/perfil').then((r) => r.json()).then(setPerfil);
  }, []);

  if (!perfil) return <p>Carregando...</p>;

  const admissao = perfil.dataAdmissao
    ? new Date(perfil.dataAdmissao).toLocaleDateString('pt-BR')
    : '-';

  return (
    <div>
      <NavColaborador />
      <h2>Meu perfil</h2>
      <div className="card">
        <p><label>Nome</label>{perfil.nome}</p>
        <p><label>Loja</label>{perfil.loja}</p>
        <p><label>Cargo</label>{perfil.cargo || '-'}</p>
        <p><label>Data de admissão</label>{admissao}</p>
        <p><label>E-mail</label>{perfil.email}</p>
        <p><label>CPF (login)</label>{perfil.matricula}</p>
      </div>
    </div>
  );
}
