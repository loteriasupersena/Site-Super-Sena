# Checklist de produção — AquaCloud/Hydro

Este checklist cobre o serviço web Super Sena. O APK Android é tratado separadamente.

## 1. DATABASE_URL — bloqueio de inicialização atual

O erro Prisma `P1013` ("The provided database string is invalid") ocorre antes de o Next.js iniciar. A causa é o valor configurado em `DATABASE_URL` no painel do serviço, ou uma URL com caracteres reservados sem codificação. Não é corrigido por alterar credenciais do Mercado Pago nem por editar o schema do jogo.

No AquaCloud/Hydro, abra as variáveis do serviço web e confira apenas a variável `DATABASE_URL`. O formato esperado pelo Prisma/PostgreSQL é:

```text
postgresql://USUARIO:SENHA@HOST:5432/NOME_DO_BANCO?schema=public
```

- Copie a URL de conexão PostgreSQL fornecida pelo próprio provedor; prefira o host interno quando o app e o banco estiverem na mesma rede/serviço.
- Confirme que o esquema é `postgresql://` (ou `postgres://`), não `http://`, `https://`, `psql ` nem uma URL de painel.
- Não inclua aspas, espaços, quebras de linha ou texto explicativo no valor.
- Se usuário ou senha contiverem caracteres reservados, codifique-os em percent-encoding dentro dos componentes de usuário/senha. Exemplos: `@` → `%40`, `#` → `%23`, `/` → `%2F`, `:` → `%3A`, `%` → `%25`. Não codifique os separadores estruturais da URL.
- Confirme o nome do banco e a porta conforme os dados fornecidos pelo provedor.
- Não compartilhe a senha em prints ou mensagens. Para pedir ajuda, oculte a senha e mantenha visíveis esquema, host, porta, nome do banco e query string.

Depois de corrigir a variável no painel, salve e reinicie/reimplante o serviço. O comando de inicialização executa `prisma migrate deploy`, depois o provisionamento seguro do primeiro administrador e, por fim, `next start`.

## 2. Banco novo

- Confirme que `DATABASE_URL` aponta para o banco novo e vazio destinado ao Super Sena, nunca para o banco do sistema de placas.
- Faça backup/snapshot antes de qualquer operação em banco que já contenha dados.
- Aplique as migrações versionadas com `prisma migrate deploy`; não use `prisma migrate reset` em produção.
- Confira os logs para confirmar que todas as migrações terminaram antes de considerar o serviço saudável.
- Não execute manualmente SQL de migração já gerenciado pelo Prisma.

## 3. Variáveis de produção

Configure no painel do serviço, sem colocar segredos no Git:
- `DATABASE_URL`
- `AUTH_SECRET`
- `APP_BASE_URL=https://loteriasupersena.com.br`
- `NEXT_PUBLIC_SITE_URL=https://loteriasupersena.com.br`
- `ROUND_SCHEDULER_SECRET`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `WALLET_PIX_ENCRYPTION_KEY` (32 bytes, estável entre reinicializações)
- `NEXT_PUBLIC_PRIZE_SUPPORT_WHATSAPP`

`ADMIN_USERNAME`, `ADMIN_INITIAL_PASSWORD` e `CONFIRM_ADMIN_PROVISIONING=CREATE_FIRST_ADMIN` são variáveis temporárias para provisionar o primeiro administrador em banco sem administrador. Remova-as após a criação. O script não redefine a senha de administrador existente.

## 4. Mercado Pago

- Mantenha as credenciais atuais e confira se pertencem ao ambiente de produção.
- Configure o webhook de produção para a rota publicada no próprio domínio, conforme a rota implementada no repositório.
- O segredo do webhook no painel do Mercado Pago deve corresponder exatamente a `MERCADOPAGO_WEBHOOK_SECRET`.
- Faça uma cobrança Pix de baixo valor e confira a confirmação canônica, a alocação, a emissão única do recibo e os registros do servidor.
- Não marque compra como paga manualmente apenas porque o QR foi exibido ou porque o navegador retornou ao site.

## 5. Scheduler

- Configure chamada autenticada a `/api/internal/round-scheduler` a cada minuto.
- Use `Authorization: Bearer <ROUND_SCHEDULER_SECRET>`.
- Verifique nos logs que as rodadas são abertas/fechadas/sorteadas e que reconciliação Pix, alocação e apuração não acumulam falhas.
- Não confunda a quantidade de repetições escolhida pelo jogador (1–10) com a fila de até 48 rodadas futuras.

## 6. Critérios de liberação

Não considerar produção pronta até confirmar:
- [ ] App inicia sem erro Prisma P1013.
- [ ] Banco correto e migrações aplicadas.
- [ ] Login de administrador, jogador e cambista.
- [ ] Compra Pix real, webhook e reconciliação.
- [ ] Recibo aparece somente após confirmação e alocação.
- [ ] Scheduler executa no intervalo previsto.
- [ ] Sorteio e apuração idempotentes.
- [ ] Carteira, comissão, acerto e saque conferidos.
- [ ] Domínio HTTPS, favicon, manifest e metadados corretos.
- [ ] Logs sem segredos ou dados financeiros sensíveis.

A aprovação da CI não substitui esses testes no ambiente real. Não alterar DNS, credenciais, banco ou serviço sem autorização explícita do responsável.
