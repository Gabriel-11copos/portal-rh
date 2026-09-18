// Popula a tabela de assuntos com os temas de RH e DP mais comuns.
// Rode com: npm run seed (depois de configurar o DATABASE_URL)
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const assuntos = [
  { nome: 'Férias', prazoPadraoDias: 5, responsavelPadrao: 'DP' },
  { nome: 'Recibo de pagamento', prazoPadraoDias: 2, responsavelPadrao: 'DP',
    respostaAutomatica: 'Seu recibo/holerite pode ser acessado diretamente pelo aplicativo de folha de pagamento. Caso não consiga acessar, sua solicitação seguirá para o DP.' },
  { nome: 'Segunda via de vale-transporte', prazoPadraoDias: 3, responsavelPadrao: 'DP' },
  { nome: 'Passagem/Reembolso', prazoPadraoDias: 5, responsavelPadrao: 'DP' },
  { nome: 'Atestado médico', prazoPadraoDias: 2, responsavelPadrao: 'DP' },
  { nome: 'Declaração de vínculo', prazoPadraoDias: 5, responsavelPadrao: 'RH' },
  { nome: 'Uniforme/Equipamento', prazoPadraoDias: 5, responsavelPadrao: 'RH' },
  { nome: 'Dúvidas gerais', prazoPadraoDias: 3, responsavelPadrao: 'RH' },
  { nome: 'Reclamação', prazoPadraoDias: 5, responsavelPadrao: 'RH' },
  { nome: 'Outros assuntos', prazoPadraoDias: 5, responsavelPadrao: 'RH' },
];

async function main() {
  for (const a of assuntos) {
    await prisma.assunto.upsert({
      where: { nome: a.nome },
      update: {},
      create: a,
    });
  }
  console.log('Assuntos criados/atualizados com sucesso.');
}

main().finally(() => prisma.$disconnect());
