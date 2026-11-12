# Super Sena

Aplicação web de apostas numéricas com sorteios de seis algarismos, de `000000` a `999999`, preservando zeros à esquerda.

Inclui áreas pública, jogador, cambista e administrador; apostas numéricas; Pix via Mercado Pago; carteira; vendas em dinheiro; comissões; recibos digitais e térmicos; consulta pública por QR Code; agendador de rodadas e apuração idempotente.

O produto utiliza banco de dados próprio. Não importar nem manter histórico, cadastros, apostas, vendas, sorteios, resultados, prêmios, saldos ou comissões do sistema de placas.

## Regras vigentes

A especificação funcional está em [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) e as regras comerciais detalhadas em [docs/PRODUCT_RULES.md](docs/PRODUCT_RULES.md). Em caso de divergência, validar a regra com o responsável pelo produto antes de alterar a implementação.

## Configuração e operação

- Copie `.env.example` apenas como referência; nunca publique credenciais reais.
- Em produção, configure as variáveis no painel do serviço e use a URL PostgreSQL fornecida pelo provedor.
- Consulte [docs/HYDRO-PRODUCTION-CHECKLIST.md](docs/HYDRO-PRODUCTION-CHECKLIST.md) antes de iniciar ou atualizar o serviço.
- O deploy executa `prisma migrate deploy` antes de iniciar o servidor. O banco precisa estar acessível e a variável `DATABASE_URL` válida.

## APK Android do cambista

O aplicativo nativo está em `android-app/`. O APK será tratado em uma etapa separada; as correções desta auditoria não alteram arquivos Android nem workflows de APK.
