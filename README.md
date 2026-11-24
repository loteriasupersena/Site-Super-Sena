# Plataforma de benefícios comerciais

Aplicação em reconstrução para conectar estabelecimentos conveniados, registrar vendas, emitir cupons com QR Code, permitir consulta pública e controlar resgates e liquidações.

## Banco de dados

A aplicação deve usar um PostgreSQL **exclusivo, novo e vazio**. Não reutilize a conexão do sistema anterior.

- Não importar dados, cadastros, vendas, apostas, sorteios, resultados, prêmios, pagamentos, saldos ou históricos do sistema anterior.
- Não reaproveitar o histórico de migrações Prisma antigo.
- A estrutura será criada por uma migração inicial nova, exclusiva desta aplicação.
- Antes da migração inicial, executar `npm run db:assert-empty` com `DATABASE_PURPOSE=benefits-platform-empty`.
- O verificador não apaga dados; bloqueia a preparação se encontrar tabelas de aplicação.
- Nunca apontar esta branch para o banco atualmente usado pelo site original.

Configure `.env` localmente com base em `.env.example`. Não coloque credenciais reais no Git.

## Estado

A base está em fase de limpeza. Modelos Prisma, rotas, autenticação, pagamentos, emissão de cupons, resgates, painel administrativo e aplicativo Android ainda precisam ser adaptados antes do deploy.

A branch `work/nova-plataforma-beneficios` é a área de trabalho. A `main` e o serviço publicado permanecem intocados.
