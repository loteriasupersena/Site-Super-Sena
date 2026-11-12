# Arquitetura — Super Sena

Este arquivo é o resumo executivo da arquitetura. A documentação técnica completa está em [docs/MANUAL_TECNICO.md](docs/MANUAL_TECNICO.md).

## Aplicação

Aplicação full-stack única em Next.js (App Router), TypeScript e React:

- `src/app`: páginas, layouts e rotas HTTP.
- `src/components`: interface reutilizável.
- `src/domain`: regras puras de jogo, rateio e comissão.
- `src/modules`: casos de uso de compras, pagamentos, números, rodadas, carteira e impressão.
- `src/lib`: autenticação, sessão, criptografia e infraestrutura compartilhada.
- `prisma/schema.prisma`: modelo PostgreSQL.
- `prisma/migrations`: histórico de alterações do banco.
- `src/generated/prisma`: cliente gerado; não editar manualmente.

## Produto numérico

O Super Sena usa números textuais de exatamente seis algarismos, de `000000` a `999999`, preservando zeros à esquerda. As categorias são Unidade, Dezena, Centena, Quadra, Quina e Sena. Cada linha guarda rateio, versão e snapshot dos multiplicadores aplicados.

## Financeiro

Compras, pagamentos Pix, participações, ledger, comissões, saques, prêmios manuais e auditoria são persistidos no PostgreSQL. A confirmação Pix consulta o estado canônico do Mercado Pago e converge para um serviço central transacional/idempotente. Compras pagas preservam a intenção e o snapshot originais.

## Rodadas e scheduler

A criação automática de rodadas é responsabilidade de `POST /api/internal/round-scheduler`, protegido por `ROUND_SCHEDULER_SECRET`. A hospedagem precisa chamar o endpoint a cada minuto. O scheduler mantém até 48 rodadas futuras em intervalos de 30 minutos e processa abertura, fechamento, sorteio, apuração, reconciliação Pix e alocação de compras pagas que aguardam rodadas.

Os serviços de abertura, fechamento, sorteio e liquidação estão em `src/modules/rounds`. O painel administrativo usa os mesmos serviços centrais.

## Banco e implantação

O projeto usa PostgreSQL e Prisma. O container executa `prisma migrate deploy`, provisionamento seguro do primeiro administrador e inicialização Next.js. O banco deve ser próprio do Super Sena; não executar migrações sobre banco legado de outro produto.

## Fonte de verdade

- Regras de produto: [docs/PRODUCT_RULES.md](docs/PRODUCT_RULES.md) e [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md).
- Arquitetura e construção: [docs/MANUAL_TECNICO.md](docs/MANUAL_TECNICO.md).
- Preparação do ambiente: [docs/HYDRO-PRODUCTION-CHECKLIST.md](docs/HYDRO-PRODUCTION-CHECKLIST.md).
