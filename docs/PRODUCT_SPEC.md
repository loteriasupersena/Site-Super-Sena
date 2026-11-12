# Especificação funcional — Super Sena

Status: regras vigentes do produto. Esta especificação descreve exclusivamente o Super Sena.

## 1. Produto
- Jogo exclusivamente numérico.
- Cada palpite contém exatamente seis algarismos, de `000000` a `999999`; zeros à esquerda são significativos.
- Não existem placas, formatos de placas, resultados de placas ou compatibilidade operacional com o Joga Placas.
- Áreas do sistema: público, jogador, cambista e administrador.

## 2. Participações
- Uma compra pode conter de 1 a 10 repetições consecutivas.
- A repetição representa quantas vezes o conjunto completo de números concorre em rodadas distintas.
- A interface informa somente a quantidade de repetições; o jogador e o cambista não escolhem códigos nem horários de rodadas.
- Os números e valores são validados no servidor. O total é calculado em centavos inteiros.
- A intenção de compra registra os números, a quantidade, a distribuição do valor e o snapshot da regra aplicada.

## 3. Rodadas e sorteio
- Cada rodada tem um único resultado numérico de seis algarismos.
- O agendador mantém até 48 rodadas futuras, com intervalos de 30 minutos, cobrindo aproximadamente as próximas 24 horas.
- O limite de 1 a 10 repetições por compra é independente da quantidade de rodadas futuras mantidas pelo agendador.
- Fuso operacional: UTC−03:00 (`Etc/GMT+3`).
- Fechamento, sorteio e apuração são etapas distintas.
- O sorteio deve ser uniforme no intervalo de 000000 a 999999 e preservar zeros à esquerda.
- Rodadas fechadas/sorteadas não podem receber participações retroativas.

## 4. Categorias e premiação
O valor de cada número é dividido em seis partes iguais; eventual sobra de centavos é destinada à Unidade.

| Categoria | Critério | Multiplicador |
|---|---|---:|
| Unidade | Último algarismo | 3× |
| Dezena | Últimos 2 algarismos | 30× |
| Centena | Últimos 3 algarismos | 300× |
| Quadra | Últimos 4 algarismos | 3.000× |
| Quina | Últimos 5 algarismos | 30.000× |
| Sena | Número exato, seis algarismos | 300.000× |

Cada aposta paga somente a categoria de maior precisão acertada; os prêmios das categorias inferiores não são acumulados. A apuração utiliza o snapshot da regra gravado na compra, sem recalcular compras pagas com configurações posteriores.

## 5. Pagamentos e confirmação
- Integração externa de negócio: Mercado Pago, para cobrança Pix e confirmação.
- QR Code Pix não é recibo nem prova suficiente de pagamento.
- Pix só é confirmado após validação autêntica do estado e dos dados da cobrança no Mercado Pago.
- Webhook, consulta de status e reconciliação convergem para o mesmo processo idempotente.
- CASH só confirma quando o cambista registra o recebimento.
- WALLET só confirma quando o débito é efetivado.
- Valores, débitos, créditos e comissões usam centavos inteiros e operações transacionais/idempotentes.

## 6. Confirmação, alocação e recibo
- A compra Pix pendente representa uma intenção; não recebe participação válida, linha numérica, rodada definitiva, código de recibo ou QR de consulta antes da confirmação financeira.
- Após confirmação, uma transação revalida o horário pelo relógio do banco e seleciona as próximas rodadas futuras válidas, criando participações e linhas numéricas.
- Em CASH e WALLET, recebimento/débito, seleção de rodadas, participações, comissão e recibo devem ser atômicos.
- Conflito de concorrência exige retry transacional limitado, com nova validação de horário e seleção.
- Se não houver rodadas válidas, não emitir recibo nem criar participações incompletas. A intenção e o recebimento devem permanecer registrados para reconciliação.
- Compras já pagas preservam `numbers`, `allocation`, `ruleVersion` e `ruleSnapshot` armazenados na criação da intenção; nunca recalcular o rateio a partir do total após o pagamento.
- O recibo tem código único `SQ-` e QR Code interno de consulta. Só fica disponível depois do commit bem-sucedido.
- A consulta pública lê os dados oficiais do servidor e considera somente participações confirmadas.

## 7. Resultados e prêmios
- Estados distinguem rodada aguardando sorteio, resultado publicado, participação premiada e não premiada.
- Não declarar derrota antes da publicação e apuração oficial.
- A apuração considera apenas participações confirmadas e usa o snapshot de regras registrado na compra.
- Créditos de prêmio devem ser transacionais e idempotentes.
- Prêmios de bilhetes anônimos vendidos por cambistas seguem os canais de pagamento manual previstos em `docs/PRODUCT_RULES.md`.

## 8. Segurança e operação
- Autorização e propriedade dos registros são verificadas no servidor.
- Eventos financeiros, alterações administrativas e reconciliações devem ser auditáveis.
- Não expor segredos em código, documentação ou logs.
- Não importar usuários, apostas, vendas, sorteios, resultados, prêmios, saldos ou comissões de outro sistema.
- A especificação define o comportamento esperado; não prova que cada requisito esteja testado. O estado implementado deve ser verificado nos módulos, rotas e testes existentes antes de qualquer alteração.
