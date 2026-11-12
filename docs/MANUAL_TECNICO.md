# Manual Técnico — Arquitetura e Construção do Super Sena

**Projeto:** Super Sena  
**Repositório:** `loteriasupersena/Site-Super-Sena`  
**Branch de referência desta edição:** `main`  
**Domínio previsto:** `https://loteriasupersena.com.br`  
**Idioma e fuso operacional:** pt-BR, UTC−03:00 (`Etc/GMT+3`)  
**Escopo:** aplicação web, API, domínio, persistência, integrações e operação. O APK Android é documentado apenas como componente separado; sua implementação não faz parte deste manual web.

> Este manual descreve a arquitetura encontrada no código do repositório. Ele não substitui testes de produção nem comprova que variáveis, DNS, banco ou tarefas do AquaCloud/Hydro estejam configurados corretamente. Quando houver diferença entre documentação antiga e código, prevalece o código executável validado, e a divergência deve ser registrada para correção.

---

## 1. Visão geral do sistema

O Super Sena é uma aplicação web full-stack construída como um único projeto Next.js. Interface, páginas, endpoints HTTP e lógica de negócio vivem no mesmo repositório e são compilados e publicados como um serviço.

O sistema tem quatro áreas funcionais:

1. **Pública:** apresentação do produto, cadastro/login, termos de uso, consulta de bilhete e verificação de recibo.
2. **Jogador:** compra de jogos numéricos, consulta de resultados e histórico, carteira e solicitação de saque.
3. **Cambista:** venda de jogos, recebimento Pix ou dinheiro, recibos, resumo financeiro e pagamento presencial de prêmios elegíveis.
4. **Administrador:** gestão de usuários/cambistas, rodadas, regras de premiação, prêmios, saques, conciliação e acertos financeiros.

O produto é numérico. Cada palpite tem seis algarismos, de `000000` a `999999`, e os zeros à esquerda fazem parte do número.

### 1.1 Princípios arquiteturais

- Um único aplicativo Next.js, sem microsserviços próprios separados.
- Separação entre interface, rotas HTTP, domínio puro, módulos de aplicação e infraestrutura.
- PostgreSQL como fonte persistente de verdade.
- Prisma como ORM e mecanismo de migrações.
- Valores financeiros armazenados em centavos inteiros.
- Confirmação Pix baseada na consulta do estado canônico do Mercado Pago, nunca somente no conteúdo recebido pelo webhook.
- Operações financeiras e de sorteio com transações, bloqueios e idempotência.
- Snapshot das regras numéricas preservado em cada intenção/linha para que alterações futuras não reescrevam apostas antigas.
- Tarefas agendadas executadas por chamada externa autenticada; o código do site fornece o endpoint, mas não cria sozinho o cron do provedor.

## 2. Tecnologias e ferramentas

| Camada | Tecnologia encontrada | Responsabilidade |
|---|---|---|
| Linguagem | TypeScript | Tipagem do frontend e backend |
| Framework | Next.js 16 (App Router) | Páginas, layouts, API e build |
| UI | React 19 | Componentes e experiência de uso |
| Estilos | CSS do projeto | Layout responsivo e identidade visual |
| Validação | Zod 4 | Validação de entradas onde adotado |
| Persistência | PostgreSQL | Dados transacionais |
| ORM | Prisma 7 | Schema, client e migrações |
| Driver | `pg` e `@prisma/adapter-pg` | Conexão PostgreSQL |
| Pagamentos | Mercado Pago Orders/Pix API | Cobrança Pix e consulta do estado |
| QR Code | `qrcode-generator` | QR de consulta/recibo e recursos relacionados |
| Testes | Vitest | Testes unitários, de rota e integração |
| Qualidade | ESLint e TypeScript | Lint e verificação estática |
| Container | Docker / Node 22 | Build e execução no AquaCloud/Hydro |

As versões exatas ficam no `package.json` e no `package-lock.json`. Não atualizar dependências sem executar o pipeline de qualidade.

## 3. Organização do repositório

### 3.1 Diretórios principais

```text
/
├── src/
│   ├── app/                 # Páginas, layouts e Route Handlers da API
│   ├── components/          # Componentes visuais reutilizáveis
│   ├── domain/              # Regras puras de negócio
│   ├── modules/             # Casos de uso e serviços de aplicação
│   ├── lib/                 # Infraestrutura compartilhada (auth, crypto etc.)
│   ├── generated/prisma/    # Prisma Client gerado; não editar manualmente
│   └── test/                # Configuração e utilitários de teste
├── prisma/
│   ├── schema.prisma        # Modelo relacional
│   └── migrations/          # Histórico SQL versionado
├── scripts/                 # Provisionamento e recuperação administrativa
├── public/                  # Imagens, ícones, manifest e assets públicos
├── docs/                    # Regras, decisões e manuais
├── android-app/             # Projeto Android independente do runtime web
├── .github/workflows/       # CI e build de APK
├── Dockerfile
├── prisma.config.ts
├── package.json
└── next.config.ts
```

### 3.2 Camadas internas

**`src/app` — camada HTTP e composição de páginas**

- Páginas Next.js e layouts.
- Route Handlers em `src/app/api/**/route.ts`.
- Recebe requisições, autentica/autoriza, valida parâmetros e chama módulos de aplicação.
- Deve evitar concentrar regra financeira ou de sorteio complexa dentro do componente de interface ou do handler.

**`src/components` — camada de apresentação**

- Componentes compartilhados em `src/components`.
- Componentes específicos por área em `admin`, `cashier`, `player`, `auth`, `purchases` e `receipts`.
- Formulários coletam dados e apresentam estados; a validação final e a autorização pertencem ao servidor.

**`src/domain` — regras independentes de infraestrutura**

- Regras de multiplicadores e snapshots.
- Rateio dos valores por categoria.
- Cálculo de comissão.
- Revisão/validação de premiação.
- Funções desta camada devem permanecer determinísticas e testáveis sem acessar banco ou rede.

**`src/modules` — casos de uso**

- Compras e alocação de compras pagas.
- Integração e reconciliação de Pix.
- Normalização, sorteio e cálculo de números.
- Abertura, fechamento, sorteio e apuração de rodadas.
- Carteira, saques e impressão.

**`src/lib` — infraestrutura compartilhada**

- Sessões, hash de senhas, controle de acesso e rate limit.
- Criptografia de chaves Pix de saque.
- Conexão Prisma compartilhada através do módulo de sessão.

## 4. Páginas e áreas do site

As páginas abaixo foram identificadas no App Router:

| Caminho | Finalidade |
|---|---|
| `/` | Página pública de apresentação |
| `/login` | Autenticação |
| `/cadastro` | Cadastro de jogador |
| `/change-password` | Troca obrigatória de senha |
| `/player` | Área do jogador |
| `/cashier` | Área do cambista |
| `/cashier-app-login` | Login/entrada do modo aplicativo do cambista |
| `/admin` | Painel administrativo |
| `/admin/cashiers/[cashierId]` | Visão financeira individual do cambista |
| `/termos-de-uso` | Termos públicos |
| `/verificar-recibo/[receiptCode]` | Verificação pública de recibo |
| `/consulta` | Consulta pública de bilhete/resultado |

O layout global em `src/app/layout.tsx` define idioma, metadados, favicon, imagem social, manifest e componentes globais. O endereço público é obtido de `NEXT_PUBLIC_SITE_URL`, com fallback para o domínio Super Sena.

A interface é dividida por responsabilidade: componentes de jogador, cambista e administrador não devem substituir uns aos outros. A página raiz é pública; a proteção das áreas privadas é aplicada no servidor.

## 5. API HTTP

As APIs são implementadas por Route Handlers do Next.js. Os grupos abaixo representam as responsabilidades encontradas no repositório; os contratos exatos de payload, códigos de resposta e permissões devem ser consultados nos respectivos arquivos `route.ts`.

### 5.1 Autenticação — `/api/auth`

- `POST /api/auth/login`: login padrão.
- `POST /api/auth/cashier-login`: entrada do cambista no contexto do aplicativo.
- `POST /api/auth/register`: cadastro.
- `POST /api/auth/logout`: revogação da sessão.
- `GET /api/auth/me`: consulta da identidade autenticada.
- `POST /api/auth/change-password`: alteração de senha.

### 5.2 Jogador — `/api/player`

- Compras numéricas e consulta do estado da compra.
- Histórico de apostas.
- Resultados recentes e rodadas disponíveis.
- Recibo da compra.
- Solicitações e histórico de saques.

### 5.3 Cambista — `/api/cashier`

- Criação de venda.
- Venda em dinheiro.
- Consulta do estado de compra.
- Resumo financeiro e rodadas.
- Consulta e baixa presencial em dinheiro de prêmio elegível.

### 5.4 Administrador — `/api/admin`

- Cadastro, edição, bloqueio e gestão de cambistas.
- Acertos financeiros por cambista.
- Gestão/consulta de rodadas e ações de fechar, sortear e liquidar.
- Consulta e baixa de prêmios.
- Reconciliação de créditos de prêmio.
- Regras/multiplicadores de premiação.
- Gestão de saques.

### 5.5 Integrações e APIs compartilhadas

- `POST /api/payments/mercadopago/webhook`: notificação do Mercado Pago.
- `POST /api/internal/round-scheduler`: scheduler protegido por segredo.
- `/api/public/receipt-verification/[receiptCode]`: consulta pública do recibo.
- `/api/public/ticket-check`: consulta pública de bilhete.
- `/api/purchases/[purchaseId]/print-jobs`: reserva/controle de tarefas de impressão.
- `/api/print-jobs/[jobId]/transition`: transições de estado da impressão.

Não criar endpoints paralelos para uma responsabilidade já existente. Antes de mudar um fluxo, localizar o handler e o módulo central chamado por ele.

## 6. Autenticação e autorização

### 6.1 Papéis

O enum `UserRole` contém:

- `PLAYER`
- `CASHIER`
- `ADMIN`

O status de conta usa `ACTIVE`, `BLOCKED` ou `PENDING`.

### 6.2 Sessões

Implementação em `src/lib/auth/session.ts`:

1. Gera token aleatório criptograficamente seguro.
2. Armazena no banco somente o SHA-256 do token.
3. O token em texto é enviado ao navegador em cookie.
4. A sessão tem duração de 12 horas.
5. Logout grava `revokedAt`.
6. Consulta de sessão exige token não revogado, não expirado e usuário ativo.

Cookies são HTTP-only configurados pelas rotas de autenticação. O token não deve ser colocado em localStorage nem exposto em logs.

### 6.3 Proteção de rotas

`src/lib/auth/require-role.ts` centraliza proteção de páginas por papel. Também verifica a troca obrigatória de senha. Para o contexto de aplicativo do cambista, verifica um cookie marcador vinculado ao hash do token da sessão.

As APIs devem aplicar a mesma política no servidor: sessão válida, papel correto, conta ativa, propriedade do recurso e bloqueio quando `mustChangePassword` estiver ativo. Esconder um botão na interface não substitui autorização no endpoint.

### 6.4 Senhas e tentativas

- Hash de senha implementado em `src/lib/auth/password.ts` com scrypt.
- Controle de tentativas de login em `src/lib/auth/login-rate-limit.ts`, com integração PostgreSQL.
- A criação do primeiro administrador é feita por script de bootstrap protegido e não deve redefinir um administrador já existente.

## 7. Banco de dados e modelo relacional

O banco é PostgreSQL. O schema está em `prisma/schema.prisma`; migrações são versionadas em `prisma/migrations`.

### 7.1 Entidades centrais

| Modelo | Função |
|---|---|
| `User` | Jogador, cambista ou administrador |
| `Session` | Sessões autenticadas |
| `Customer` | Cliente opcional associado a venda de cambista |
| `Round` | Rodada, janelas de horário, status e resultado |
| `Purchase` | Compra, valor, origem, status e recibo |
| `NumericPurchaseIntent` | Números, repetições, rateio e snapshot da regra |
| `PurchaseParticipation` | Vínculo de uma compra com uma rodada |
| `NumericParticipationLine` | Linha numérica e distribuição por categoria |
| `Payment` | Cobrança Pix e estado do provedor |
| `WebhookEvent` | Registro/idempotência das notificações |
| `LedgerEntry` | Livro-razão de carteira |
| `CashierCommission` | Comissão materializada por compra |
| `CashierSettlement` | Snapshot de acerto financeiro |
| `Withdrawal` | Solicitação de saque |
| `WithdrawalStatusHistory` | Histórico de decisões de saque |
| `NumericPrizePayout` | Baixa manual de prêmio |
| `PrintJob` | Estado e auditoria de impressão |
| `AuditEvent` | Eventos administrativos e operacionais |
| `Setting` | Configurações/cursor operacional |
| `SettingChange` | Histórico de alteração de configuração |

### 7.2 Relações principais

- Um usuário pode possuir compras como jogador e/ou vendas como cambista.
- Uma compra possui uma intenção numérica, um pagamento opcional, várias participações e um recibo quando confirmada.
- Cada participação liga uma compra a uma rodada e contém linhas numéricas.
- Cada linha armazena os seis valores rateados, versão e snapshot de regra, valor de prêmio e momento do crédito.
- O pagamento pertence a uma compra; eventos de webhook apontam para o pagamento.
- O ledger liga lançamentos a usuário, compra, participação e/ou saque.
- Comissão é materializada por compra e guarda a taxa usada, sem recalcular vendas antigas pela taxa atual.
- Saque possui dono, revisor, lançamentos de ledger e histórico.
- Baixa de prêmio liga a linha premiada, ator e canal de pagamento.

### 7.3 Integridade e índices

O schema usa chaves únicas e índices para:
- impedir idempotency keys repetidas;
- impedir mais de uma participação da mesma compra na mesma rodada;
- manter um único pagamento por compra;
- impedir duplicidade de ID de pagamento do provedor;
- impedir repetição de evento webhook;
- manter um único código de recibo;
- localizar filas por status/data e linhas por número/participação;
- manter lançamentos de ledger e jobs de impressão rastreáveis.

Valores monetários são inteiros em centavos (BRL). Não introduzir ponto flutuante para armazenar ou somar dinheiro.

### 7.4 Migrações

A sequência de migrações documenta a evolução do banco: estrutura inicial, sessões, rate limit, recibos, integridade, Mercado Pago, comissões, migração para jogo numérico, remoção do domínio legado de placas, intenção numérica, acertos, índices, pagamentos de prêmios, jobs de impressão, dados de cambista e regra de seis algarismos.

A migração `20261111010000_six_digit_six_prizes` atualiza constraints de formato para seis algarismos e seis categorias. Não aplicar migrações desta aplicação em banco legado de outro produto. Em produção, usar `prisma migrate deploy`; não usar `migrate reset`.

## 8. Regras numéricas e cálculo de prêmios

### 8.1 Normalização e sorteio

- `src/modules/numbers/normalize-number.ts`: valida/normaliza a representação com seis algarismos.
- `src/modules/numbers/draw-number.ts`: usa `crypto.randomInt(1_000_000)` e `padStart(6, "0")`.
- Resultado e palpite são armazenados como texto para preservar zeros à esquerda.

### 8.2 Categorias e multiplicadores padrão

| Categoria | Acerto | Multiplicador |
|---|---|---:|
| Unidade | Último algarismo | 3× |
| Dezena | Últimos 2 | 30× |
| Centena | Últimos 3 | 300× |
| Quadra | Últimos 4 | 3.000× |
| Quina | Últimos 5 | 30.000× |
| Sena | Todos os 6 | 300.000× |

A implementação está em `src/domain/numeric-prize-rules.ts`. A versão da regra atual é `numeric-six-digit-v1`.

### 8.3 Rateio

`src/domain/allocate-number-stake.ts` divide o valor de cada número em seis partes inteiras. A divisão base é `floor(totalCents / 6)`; a sobra fica na Unidade. O total mínimo por número/rodada é R$ 1,00.

### 8.4 Categoria vencedora

`src/modules/numbers/calculate-number-prize.ts` testa da maior precisão para a menor: Sena, Quina, Quadra, Centena, Dezena e Unidade. Só a primeira categoria correspondente paga. Não somar prêmios das categorias inferiores.

O cálculo usa os valores rateados e o snapshot gravado na compra. Se o snapshot estiver inválido, a apuração falha de forma fechada; não usa silenciosamente os multiplicadores atuais.

## 9. Ciclo de vida das rodadas

### 9.1 Janela temporal

Cada rodada tem:
- `startsAt`: início programado;
- `cutoffAt`: limite para aceitar venda;
- `resultAt`: horário programado para o resultado.

A ordem precisa ser `startsAt < cutoffAt < resultAt`. A venda só pode ser aceita antes do cutoff. As decisões críticas usam relógio do banco e transação, para evitar depender do relógio do navegador.

### 9.2 Estados

O enum `RoundStatus` define:
- `SCHEDULED`
- `OPEN`
- `CLOSED`
- `COMPLETED`
- `CANCELLED`

O ciclo normal é: SCHEDULED → OPEN → CLOSED → COMPLETED. A rodada concluída possui resultado numérico persistido.

### 9.3 Serviços

- `open-round.ts`: abre rodada após horário de início, com bloqueio de linha e transação serializável.
- `close-round.ts`: fecha após cutoff; retry de conflito serializável.
- `draw-round-results.ts`: sorteia e persiste resultado uma única vez, depois do fechamento e horário de resultado.
- `settle-numeric-round-prizes.ts`: calcula prêmios somente de participações/compra confirmadas, grava valores e credita carteira de forma idempotente.

Ações administrativas chamam os mesmos serviços centrais; não devem implementar outra versão de abertura, sorteio ou apuração.

## 10. Scheduler automático

Endpoint: `POST /api/internal/round-scheduler`.

### 10.1 Segurança e execução

- Exige `Authorization: Bearer <ROUND_SCHEDULER_SECRET>`.
- Compara o segredo em tempo constante.
- Executa em runtime Node.js e sem cache.
- A plataforma de hospedagem precisa chamar o endpoint a cada minuto. A tarefa externa não é criada pelo Next.js.

### 10.2 Responsabilidades

O scheduler:
1. calcula horários de resultado em janelas de 30 minutos no fuso UTC−03:00;
2. mantém até 48 rodadas futuras (aproximadamente 24 horas);
3. cria rodadas ausentes;
4. abre rodadas cujo início chegou;
5. fecha rodadas após cutoff;
6. sorteia rodadas fechadas cujo horário de resultado chegou;
7. apura prêmios de rodadas concluídas;
8. consulta/reconcilia pagamentos Pix pendentes;
9. tenta alocar compras CASH/WALLET pagas que ainda aguardam rodadas.

A resposta contém contadores como `created`, `closed`, `drawn`, `prizesSettled`, `failures`, `pixChecked`, `pixConfirmed`, `pixNeedsReconciliation`, `paidPurchasesChecked`, `paidPurchasesAllocated` e `paidPurchasesWaiting`.

### 10.3 Alocação em lotes

A alocação de compras pendentes usa cursor persistido em `Setting`, processa lotes limitados e volta ao início da fila ao chegar ao fim. Isso evita que uma compra com falha bloqueie indefinidamente as compras seguintes.

## 11. Compras e participações

### 11.1 Criação de intenção

`src/modules/purchases/create-numeric-purchase.ts` é o serviço central de criação. Recebe chave de idempotência, origem (jogador/cambista), meio de pagamento, números, quantidade de repetições e valor por número.

A intenção armazena:
- números;
- quantidade de rodadas/repetições;
- distribuição do valor por categoria;
- versão da regra;
- snapshot completo de multiplicadores.

O total é calculado no servidor em centavos. Não confiar no total calculado pelo browser.

### 11.2 Seleção de rodadas

`select-next-valid-rounds.ts` seleciona próximas rodadas elegíveis pela janela temporal, sem aceitar rodada cujo cutoff passou. O usuário não escolhe códigos ou horários de rodadas.

### 11.3 Pix versus dinheiro/carteira

- Pix: intenção fica pendente até confirmação autêntica do Mercado Pago; depois é alocada.
- CASH: o cambista registra recebimento; se não houver sequência de rodadas válida no instante, a compra aguarda alocação.
- WALLET: débito no ledger é transacional; se necessário, aguarda alocação posterior.
- Recibo só aparece depois da confirmação e de todas as repetições terem participações completas.

### 11.4 Compras pagas preservam intenção

`allocate-paid-purchases.ts` valida e usa os números, rateio, versão e snapshot persistidos. Não recalcula o rateio de uma compra paga a partir do total nem substitui as regras antigas pelas atuais.

## 12. Integração Mercado Pago — Pix

### 12.1 Módulo de integração

`src/modules/payments/mercado-pago.ts` encapsula comunicação com a API do Mercado Pago, interpretação de Orders, validação de assinatura e classificação de estados.

Variáveis principais:
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_WEBHOOK_SECRET`
- `MERCADOPAGO_PAYER_EMAIL_DOMAIN` (fallback legado documentado; padronizar domínio com cuidado)

### 12.2 Checkout e confirmação

O QR Code e o código copia-e-cola são dados de cobrança, não comprovantes de pagamento. O servidor consulta o estado do pedido no provedor e confere:
- identificador do pedido;
- referência externa da compra;
- moeda BRL;
- valor total em centavos;
- método Pix e tipo de pagamento;
- estado aprovado/acreditado esperado pela Orders API.

A confirmação passa pelo serviço central `confirm-payment.ts`, que usa transação, bloqueios e seleção temporal de rodadas. O webhook não deve confirmar uma compra com base apenas no corpo recebido.

### 12.3 Webhook

Rota: `POST /api/payments/mercadopago/webhook`.

- Exige segredo configurado.
- Verifica `x-signature`, `x-request-id` e identificador do recurso.
- Rejeita assinatura inválida e janela de replay vencida.
- Consulta o estado canônico do provedor.
- Confere se pedido/valor/moeda/referência correspondem à compra.
- Registra evento com unicidade e digest do payload.
- Faz claim/controle de processamento para suportar reentrega e concorrência.
- Encaminha aprovação para o serviço central de confirmação.
- Estados terminais são tratados por serviço central de cancelamento; reembolso inesperado é registrado para conciliação, sem desfazer participações já confirmadas.

Webhook e polling são mecanismos de detecção/recuperação que convergem para a mesma máquina de estados. Não criar outro fluxo independente de confirmação.

## 13. Carteira, comissões, saques e prêmios manuais

### 13.1 Livro-razão (ledger)

`LedgerEntry` é a fonte para calcular saldo. Cada lançamento tem tipo, valor em centavos, chave idempotente e vínculo opcional à compra/participação/saque.

Tipos incluem depósito, débito de compra, crédito de prêmio, reserva/liberação de saque, baixa de saque, reembolso e ajuste.

Não alterar lançamentos antigos para corrigir saldo; registrar movimento compensatório auditável.

### 13.2 Comissão de cambista

`CashierCommission` materializa taxa em basis points e valor por compra. A taxa vigente é capturada na venda; alteração futura da comissão não reescreve o histórico.

### 13.3 Acerto de cambista

`CashierSettlement` registra snapshot financeiro por intervalo/cutoff. A transação serializável e bloqueio do cambista protegem contra acertos concorrentes. Prêmios pagos em dinheiro pelo cambista são tratados como adiantamento de caixa da plataforma, não como comissão do cambista.

### 13.4 Saques

O jogador solicita saque integral do saldo disponível. A solicitação reserva o valor por lançamento negativo. A chave Pix é criptografada em `src/lib/wallet/pix-key-crypto.ts`.

- ADMIN realiza transferência externa manual e só depois marca como paga.
- Se recusar, informa motivo e o valor reservado é devolvido ao ledger.
- Ação só é permitida enquanto PENDING; concorrência/reenvio deve ser bloqueado por transação e estado.

A aplicação não envia Pix de saque automaticamente.

### 13.5 Prêmios de bilhetes de cambista

Bilhetes sem jogador vinculado não geram crédito automático na carteira do jogador. A baixa pode ser feita pelo ADMIN via Pix externo ou pelo próprio cambista em dinheiro, conforme regras de produto. Cada linha premiada só pode ser baixada uma vez e a consulta pública reflete o estado.

## 14. Recibos e impressão

### 14.1 Recibo oficial

O recibo possui código único e QR de verificação. Só pode ser disponibilizado quando a compra está confirmada, o pagamento Pix está confirmado quando aplicável e as participações estão alocadas.

A consulta pública do QR usa o código do recibo e retorna dados permitidos para verificação, sem expor informações pessoais desnecessárias.

### 14.2 Jobs de impressão

`PrintJob` registra reserva, tentativa e resultado da impressão:
- `RESERVED`
- `SENDING`
- `SENT`
- `FAILED`
- `UNKNOWN`

Há um job automático único por compra e registros separados para reimpressões manuais. Estado UNKNOWN é importante quando o transporte falha sem ser possível saber se a impressora recebeu o papel; não repetir automaticamente como se nada tivesse sido enviado.

### 14.3 ESC/POS e transporte

- Codificação térmica em `src/modules/printing/escpos`.
- Perfil genérico de impressora 58 mm.
- O cliente possui ponte de impressão e tipos de recibo.
- O APK Android com Bluetooth Classic SPP está em `android-app/` e é um artefato/projeto separado. O código web também possui fallback de impressão do navegador.

## 15. Segurança e privacidade

- Senhas com hash scrypt.
- Tokens de sessão aleatórios; somente hash persistido.
- Cookies HTTP-only.
- Autorização por papel e propriedade de registro no servidor.
- Rate limit de login.
- Segredo do scheduler validado em tempo constante.
- Assinatura do webhook Mercado Pago com HMAC e janela temporal.
- Chaves Pix de saque criptografadas com AES-256-GCM.
- Auditoria de operações administrativas e financeiras.
- Respostas sensíveis devem usar `Cache-Control: no-store` quando aplicável.
- Segredos não podem estar no Git, em documentação de exemplo com valores reais, em capturas de tela ou em logs.

Variáveis de ambiente devem ser definidas no painel de hospedagem. O arquivo `.env.example` contém somente exemplos e nomes, não valores de produção.

## 16. Build, inicialização e deploy

### 16.1 Comandos principais

| Comando | Finalidade |
|---|---|
| `npm run dev` | Desenvolvimento Next.js |
| `npm run build` | Valida Prisma, gera client e compila Next |
| `npm start` | Migra banco, provisiona primeiro admin e inicia Next |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sem emitir arquivos |
| `npm test` | Suíte Vitest |
| `npm run test:postgres` | Testes de integração PostgreSQL |
| `npm run db:validate` | Validação do schema |
| `npm run db:deploy` | Aplica migrações versionadas |

### 16.2 Docker

O Dockerfile usa Node 22 slim, instala dependências com `npm ci`, copia o projeto e executa build com uma URL PostgreSQL placeholder exclusiva da etapa de build. A URL real deve ser injetada no runtime pelo provedor.

O container expõe a porta 3000 e executa `npm start`.

### 16.3 Ordem de inicialização

O script `start` executa:
1. `prisma migrate deploy`;
2. `npm run admin:provision`;
3. `next start`.

Portanto, se `DATABASE_URL` for inválida, o Prisma pode encerrar a inicialização antes de o Next.js servir páginas. O erro Prisma P1013 indica que a string da URL não pôde ser interpretada; conferir esquema PostgreSQL, host, porta, nome do banco e codificação percent-encoding dos caracteres reservados em usuário/senha.

### 16.4 Variáveis de ambiente relevantes

| Variável | Uso |
|---|---|
| `DATABASE_URL` | URL PostgreSQL do banco do Super Sena |
| `AUTH_SECRET` | Segredo de autenticação/recursos que o utilizam |
| `APP_BASE_URL` | URL base da aplicação |
| `NEXT_PUBLIC_SITE_URL` | URL pública usada em metadados |
| `ROUND_SCHEDULER_SECRET` | Autenticação do scheduler |
| `MERCADOPAGO_ACCESS_TOKEN` | Acesso à API Mercado Pago |
| `MERCADOPAGO_WEBHOOK_SECRET` | Verificação do webhook |
| `MERCADOPAGO_PAYER_EMAIL_DOMAIN` | Domínio do e-mail sintético exigido no checkout, se aplicável |
| `WALLET_PIX_ENCRYPTION_KEY` | Chave estável para criptografia das chaves Pix |
| `NEXT_PUBLIC_PRIZE_SUPPORT_WHATSAPP` | Contato oficial para prêmio |
| `ADMIN_USERNAME` | Bootstrap temporário do primeiro administrador |
| `ADMIN_INITIAL_PASSWORD` | Bootstrap temporário do primeiro administrador |
| `CONFIRM_ADMIN_PROVISIONING` | Confirmação explícita do bootstrap |

Não colocar credenciais em `.env.example`. As três variáveis de bootstrap do administrador devem ser removidas após a criação inicial.

## 17. Testes e qualidade

O projeto usa Vitest para:
- regras puras de números, rateio e prêmios;
- normalização e sorteio;
- autenticação e rate limit;
- rotas HTTP e permissões;
- webhook, reconciliação e confirmação Pix;
- ciclo de vida de rodadas;
- alocação de compras pagas;
- saques concorrentes;
- acerto de cambista concorrente;
- jobs de impressão e codificação ESC/POS.

Testes PostgreSQL de integração usam banco real descartável no pipeline. A CI também executa TypeScript, testes, lint, validação/migração e build. A existência de um teste não significa que todos os cenários de produção estejam cobertos; consultar o workflow e a execução mais recente.

### 17.1 Fluxo recomendado antes de uma alteração

1. Identificar a página/rota envolvida.
2. Encontrar o serviço central chamado pelo handler.
3. Verificar domínio, schema e migrações afetadas.
4. Ler os testes existentes e adicionar teste para o comportamento novo.
5. Preservar idempotência, locks, snapshots e auditoria.
6. Executar typecheck, testes, lint, migrations e build.
7. Abrir PR separada; revisar diff e CI.
8. Mesclar somente com autorização.
9. Fazer deploy separado e validar logs/fluxos no ambiente real.

## 18. Operação e diagnóstico

### 18.1 Scheduler

O painel AquaCloud/Hydro deve executar a tarefa a cada minuto com POST para `/api/internal/round-scheduler` e header Bearer correspondente. A resposta JSON informa quantas rodadas criou/fechou/sorteou, prêmios liquidados, reconciliações Pix, compras alocadas e falhas.

Uma resposta HTTP 200 com `ok: true` e `failures: 0` demonstra que aquela execução terminou sem falhas registradas. Não prova, isoladamente, que Pix real, impressora ou todas as telas funcionam. Verificar histórico de várias execuções e os logs de cada estágio.

### 18.2 Erro Prisma P1013

- Conferir a variável `DATABASE_URL` no serviço web, não no código do browser.
- Usar URL `postgresql://USER:PASSWORD@HOST:5432/DB?schema=public`.
- Usar host e credenciais fornecidos pelo PostgreSQL do AquaCloud.
- Codificar caracteres reservados da senha (ex.: `@` como `%40`, `#` como `%23`, `/` como `%2F`).
- Não incluir aspas, espaços, quebra de linha ou comando `psql`.
- Confirmar que aponta para o banco novo do Super Sena, não para o banco do produto antigo.
- Reiniciar o serviço e verificar a saída de `prisma migrate deploy`.

### 18.3 Compra Pix

Verificar em conjunto:
- pagamento persistido e ID do pedido;
- evento webhook recebido e assinatura válida;
- estado consultado diretamente na API do provedor;
- valor, moeda, método e referência compatíveis;
- compra confirmada;
- participações criadas;
- recibo emitido após alocação;
- ausência de duplicidade no ledger, comissão e recibo.

### 18.4 Falhas e recuperação

Não editar diretamente o banco para “forçar” status financeiro. Identificar o serviço central, verificar a auditoria e executar reconciliação idempotente. Não recalcular intenção de compra paga nem alterar snapshots antigos.

## 19. Decisões e pontos de atenção documentais

A revisão encontrou documentos antigos com conteúdo divergente do código atual. Este manual deve ser mantido como referência principal da arquitetura. Atenção especial:

- `ARCHITECTURE.md` tinha descrições antigas de cinco algarismos e de apenas dez rodadas futuras; o código e as regras atuais usam seis algarismos e até 48 rodadas futuras.
- Existem nomes e referências internas históricas com “superquina” (por exemplo, cookie de sessão, referência externa de pagamento e fallback de domínio de e-mail sintético). Não renomear em lote sem plano de compatibilidade: isso pode afetar sessões existentes, conciliação de pagamentos ou checkout.
- O `.env.example` é um exemplo, não é a configuração efetiva do Hydro.
- O código do scheduler define a lógica, mas o cron de um minuto precisa existir no painel do provedor.
- CI verde valida o commit, não o ambiente de produção.
- O APK em `android-app/` tem ciclo de build e testes separado. Este manual não declara o APK validado.

## 20. Glossário

- **Intenção de compra:** registro persistido dos números, valor, repetições e regra antes da alocação final.
- **Participação:** vínculo de uma compra com uma rodada.
- **Linha numérica:** um número dentro de uma participação, com rateio e snapshot.
- **Snapshot:** cópia imutável da versão e multiplicadores usados pela compra.
- **Cutoff:** instante limite para aceitar apostas em uma rodada.
- **Scheduler:** endpoint chamado por cron externo para manter e processar rodadas.
- **Ledger:** livro-razão imutável de movimentos da carteira.
- **Idempotência:** garantia de que reprocessar uma mesma operação não duplica efeitos.
- **Reconciliação:** consulta e comparação do estado local com o estado canônico do provedor.
- **Acerto de cambista:** snapshot de valores devidos/recebidos num intervalo.
- **Job de impressão:** registro rastreável de uma tentativa de impressão de recibo.

---

## 21. Arquivos de referência para manutenção

| Tema | Arquivos principais |
|---|---|
| Arquitetura geral | `ARCHITECTURE.md`, este manual |
| Regras comerciais | `docs/PRODUCT_RULES.md`, `docs/PRODUCT_SPEC.md` |
| Banco | `prisma/schema.prisma`, `prisma/migrations/**` |
| Conexão e sessão | `src/lib/auth/session.ts` |
| Papéis | `src/lib/auth/require-role.ts` |
| Regras de premiação | `src/domain/numeric-prize-rules.ts` |
| Rateio | `src/domain/allocate-number-stake.ts` |
| Criação de compra | `src/modules/purchases/create-numeric-purchase.ts` |
| Alocação pós-pagamento | `src/modules/purchases/allocate-paid-purchases.ts` |
| Mercado Pago | `src/modules/payments/mercado-pago.ts` |
| Confirmação Pix | `src/modules/payments/confirm-payment.ts` |
| Reconciliação Pix | `src/modules/payments/reconcile-pix-payment.ts` |
| Webhook | `src/app/api/payments/mercadopago/webhook/route.ts` |
| Scheduler | `src/app/api/internal/round-scheduler/route.ts` |
| Rodadas | `src/modules/rounds/**` |
| Carteira/saques | `src/modules/wallet/**`, `src/app/api/player/withdrawals`, `src/app/api/admin/withdrawals` |
| Impressão | `src/modules/printing/**`, `src/components/receipts/**` |
| Container | `Dockerfile`, `package.json`, `prisma.config.ts` |
| Configuração Hydro | `docs/HYDRO-PRODUCTION-CHECKLIST.md`, `.env.example` |

**Manutenção deste manual:** toda alteração relevante em rotas, modelos, estados financeiros, regra de jogo, scheduler, variáveis ou integração deve atualizar este documento no mesmo PR da implementação.
