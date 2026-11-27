# Asaas — integração preservada para reutilização

Esta branch é um snapshot de preservação da integração Asaas que foi desenvolvida e validada no projeto Site-Super-Sena.

- Snapshot de origem: commit `41c03126c56971ded7a2d9da49fd7c0908a40af5` (19/11/2026).
- Objetivo: manter o código, os testes, as rotas, as migrações e as correções específicas da integração disponíveis para adaptação em outro projeto.
- Esta branch não deve ser mesclada automaticamente em produção nem usada como base do novo produto sem revisão.

## O que foi preservado

### Cliente Asaas e operações
- `src/modules/payments/asaas.ts`
- `src/modules/payments/asaas.test.ts`
- `src/modules/payments/reconcile-asaas-transfer.ts`
- `src/modules/payments/reconcile-asaas-transfer.test.ts`

Inclui chamadas autenticadas à API, criação de QR Code Pix estático, consulta de pagamentos, transferências Pix, tratamento de respostas/erros e reconciliação de transferências.

### Webhooks e validação de transferências
- `src/app/api/payments/asaas/webhook/route.ts`
- `src/app/api/payments/asaas/webhook/route.test.ts`
- `src/app/api/payments/asaas/transfers/webhook/route.ts`
- `src/app/api/payments/asaas/transfers/webhook/route.test.ts`
- `src/app/api/payments/asaas/transfers/validate/route.ts`
- `src/app/api/payments/asaas/transfers/validate/route.test.ts`

Técnicas importantes preservadas:
- validação do header `asaas-access-token` com comparação em tempo constante;
- idempotência por identificador do evento do provedor;
- confirmação do pagamento consultando o estado canônico na API, sem confiar apenas no payload recebido;
- conferência de valor, tipo Pix, referência externa e vínculo com a operação local;
- proteção contra transferências duplicadas e contra marcar como pago antes da confirmação;
- auditoria de decisões, falhas e transições de estado;
- tratamento de eventos repetidos e estados finais.

### Reconciliação automática e saques
- `src/app/api/internal/asaas/payments/reconcile/route.ts`
- `src/app/api/internal/asaas/transfers/reconcile/route.ts`
- `src/app/api/admin/withdrawals/[withdrawalId]/transfer/route.ts`
- `src/app/api/admin/withdrawals/[withdrawalId]/transfer/route.test.ts`
- `src/app/api/player/withdrawals/route.ts`
- `src/app/api/player/withdrawals/route.test.ts`

Inclui rotinas de reconciliação, validação de chave Pix, controle de estado, concorrência e trilha de auditoria. O comportamento de saque depende das regras de negócio deste projeto e deve ser adaptado antes de reutilizar.

### Persistência e testes
- Migrações Asaas em `prisma/migrations/`, incluindo transferências de prêmios, checkout Pix estático e saques.
- Testes unitários e de integração em `src/modules/payments/`, nas rotas Asaas e nos módulos de carteira.
- Modelos Prisma e enums relacionados às cobranças, transferências, eventos de webhook, saques e auditoria.

## Variáveis de ambiente documentadas

Consultar `.env.example`. Os nomes principais são:
- `ASAAS_API_KEY`
- `ASAAS_BASE_URL`
- `ASAAS_ENVIRONMENT`
- `ASAAS_WEBHOOK_TOKEN`
- `ASAAS_PIX_KEY`
- `WALLET_PIX_ENCRYPTION_KEY`

Nunca copiar credenciais reais para o repositório. Usar Sandbox durante desenvolvimento e homologação; produção somente após validação.

## Como reutilizar em outro projeto

1. Tratar esta branch como referência-fonte, não como pacote pronto para instalação.
2. Transportar primeiro o cliente Asaas e seus testes; depois adaptar rotas, webhooks e reconciliação.
3. Mapear os modelos Prisma para o domínio novo. Não importar dados, usuários, saldos, apostas, prêmios nem histórico deste projeto.
4. Criar migrações novas e específicas para o banco vazio do novo projeto. Não reaplicar migrações antigas sem revisão.
5. Adaptar autenticação, autorização, auditoria, filas/agendadores, estados e referências externas.
6. Configurar webhooks separados para cobranças e transferências, com token próprio e eventos necessários.
7. Validar no Sandbox: pagamento Pix, evento duplicado, webhook atrasado, timeout, valor divergente, transferência pendente/falha/cancelamento e reconciliação.
8. Só habilitar produção após testes automatizados e conferência operacional.

## Observação sobre o snapshot

A branch preserva o estado completo do repositório no commit de origem, e não apenas uma pasta isolada. Isso mantém o contexto técnico e os testes que permitiram fazer a integração funcionar. Para o novo projeto, copiar apenas os componentes necessários e suas dependências, após análise.
