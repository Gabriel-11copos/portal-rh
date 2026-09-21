# Portal RH & DP — Solicitações e Comunicados

App para colaboradores abrirem solicitações de RH/DP (férias, recibo, vale-transporte,
passagem, atestado, dúvidas, reclamações etc.), anexarem documentos e receberem
respostas e comunicados — com triagem automática, prazos e notificação por e-mail.

Feito no mesmo padrão dos outros painéis (Next.js 14 + Neon Postgres), para você publicar
pelo GitHub Desktop + Vercel, sem precisar mexer em linha de comando.

## O que você precisa configurar (uma vez só)

### 1. Banco de dados (Neon Postgres)
Se você já tem uma conta Neon (usada no Painel Banco de Horas), pode criar um **novo
banco de dados** dentro do mesmo projeto, ou um projeto novo — como preferir.
1. Acesse neon.tech e crie/abra seu projeto.
2. Copie a "Connection string".
3. Cole no `.env` (veja `.env.example`) como `DATABASE_URL`.

### 2. Google Drive (para os anexos)
1. Acesse https://console.cloud.google.com/ (pode usar sua conta Google normal).
2. Crie um projeto novo (ex: "portal-rh").
3. Ative a "Google Drive API" (menu "APIs e Serviços" > "Ativar APIs").
4. Crie uma "Conta de serviço" (Service Account) em "Credenciais".
5. Gere uma chave JSON para essa conta e baixe o arquivo.
6. Abra o arquivo JSON baixado, copie todo o conteúdo e cole na variável
   `GOOGLE_SERVICE_ACCOUNT_JSON` (em uma linha só).
7. Crie uma pasta no seu Google Drive (ex: "Anexos Portal RH"), compartilhe essa pasta
   com o e-mail da conta de serviço (algo como `nome@projeto.iam.gserviceaccount.com`,
   dando permissão de Editor), e copie o ID da pasta (fica na URL do Drive, depois de
   `/folders/`) para `GOOGLE_DRIVE_FOLDER_ID`.

### 3. E-mail (Resend — gratuito)
1. Crie conta gratuita em https://resend.com (até 3.000 e-mails/mês grátis).
2. Gere uma API Key em "API Keys".
3. Cole em `RESEND_API_KEY`.
4. Para usar seu próprio domínio de e-mail (ex: `rh@brewteco.com.br`) em vez do
   endereço de teste do Resend, siga o passo "Verificar domínio" no próprio site —
   é opcional para começar.

### 4. Senhas do sistema
- `SENHA_RH`: senha única que a equipe de RH/DP vai usar para entrar no painel.
- `JWT_SECRET`: qualquer texto longo aleatório (usado para proteger os logins).

## Como publicar (igual aos outros painéis)

1. Crie um repositório novo no GitHub (organização `onze-copos`).
2. Abra o GitHub Desktop, adicione esta pasta como repositório local, e publique.
3. No Vercel, importe esse repositório.
4. Nas configurações do projeto no Vercel, adicione todas as variáveis do `.env.example`
   com os valores reais (aba "Environment Variables").
5. Depois do primeiro deploy, rode a migração do banco uma única vez: no Vercel, vá em
   "Deployments" > seu último deploy > abra o terminal (ou peça pra mim te ajudar nesse
   passo específico quando chegar a hora) e rode:
   ```
   npx prisma db push
   npm run seed
   ```
   Isso cria as tabelas e já popula os assuntos padrão de RH/DP.

## Como usar no dia a dia

- **RH/DP**: entra em `/login` (aba "RH/DP"), cadastra colaboradores em
  `/admin/colaboradores`, acompanha e responde solicitações em `/admin`, e envia
  comunicados avulsos em `/admin/comunicados`.
- **Colaborador**: entra em `/login` com matrícula + senha (cadastrada pelo RH), abre
  solicitações em `/nova-solicitacao` e acompanha tudo em `/minhas-solicitacoes`.

## Próximos passos possíveis (v2)
- Colaborador poder trocar a própria senha.
- Busca de colaborador por nome (hoje o comunicado avulso pede o ID).
- App para gestores de loja acompanharem as solicitações da própria equipe.
   <!-- redeploy -->.
