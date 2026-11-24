# Banco exclusivo da plataforma de benefícios

## Regra obrigatória

Esta branch deve usar um banco PostgreSQL novo, vazio e exclusivo. Não usar o banco da aplicação antiga nem restaurar backup dele.

## Preparação

1. Criar um banco PostgreSQL novo no provedor.
2. Confirmar no painel do provedor que o banco recém-criado não contém tabelas ou dados da aplicação antiga.
3. Configurar `DATABASE_URL` com a conexão desse banco.
4. Configurar `DATABASE_PURPOSE=benefits-platform-empty`.
5. Executar `npm run db:assert-empty`. O comando apenas consulta o catálogo do PostgreSQL; não cria, altera ou apaga tabelas.
6. Somente depois de o novo schema e a migração inicial da plataforma estarem prontos, aplicar as migrações com `npm run db:deploy`.

## Isolamento técnico implementado

- O Prisma desta branch aponta para `prisma/benefits-migrations`, separado do histórico antigo.
- A inicialização não executa mais `prisma migrate deploy`, não provisiona o administrador legado e não inicia o worker antigo de rodadas.
- O `.env.example` não contém domínio, banco ou credenciais do sistema anterior.
- O comando `db:assert-empty` bloqueia bancos sem identificação explícita da nova plataforma, nomes que aparentem ser antigos/de produção e bancos que já contenham tabelas de aplicação.

## Limite atual

A separação do caminho de migrações e da configuração de ambiente foi iniciada, mas o schema Prisma e os módulos da aplicação ainda estão em processo de substituição. **Não conectar este código a um ambiente público nem executar migrações até que o novo schema e a migração inicial estejam revisados.**

Nunca usar `prisma migrate reset` como método de limpeza. A preparação correta é criar um banco vazio novo, não apagar o banco existente.