# Caderno de ideias — Plataforma de benefícios

> Documento de registro de decisões e ideias em discussão. Não é, por si só, uma autorização para implementar. As regras registradas devem ser revisadas e aprovadas antes de qualquer alteração no sistema.

## 1. Objetivo geral da plataforma

Criar uma plataforma de promoções para estabelecimentos comerciais. A loja registra o valor de cada compra e emite um cupom individual com QR Code para o consumidor.

O valor informado da compra serve como base para calcular o percentual devido à plataforma e também fica associado ao cupom como valor do prêmio correspondente. Não haverá apostas por dezenas, centenas ou outras faixas numéricas.

## 2. Cadastro e hierarquia da loja

- A plataforma cadastra cada estabelecimento na área **Administração**.
- Cada loja possui uma conta própria, com um usuário responsável: o dono ou administrador da loja.
- O administrador da loja pode cadastrar e gerenciar os funcionários que trabalham naquele estabelecimento.
- Cada funcionário possui seu próprio acesso e fica vinculado exclusivamente à loja que o cadastrou.
- O dono/administrador também pode registrar compras e emitir cupons usando o próprio acesso.
- Funcionários de uma loja não podem visualizar ou operar dados de outra loja.

## 3. Registro de compras, percentual e emissão de cupons

- No momento da venda, o funcionário ou responsável informa na plataforma o valor da compra realizada pelo consumidor.
- O valor informado representa o valor integral da compra e fica associado ao cupom.
- A plataforma calcula o valor devido à plataforma aplicando ao valor da compra o percentual configurado na área **Administração**.
- A faixa percentual pretendida é de **3% a 5%**, com **5% como referência inicial**. O percentual deverá ser editável pelo administrador. Ainda será definido se a configuração será geral ou individual por loja.
- Exemplo: compra de **R$ 100,00** com percentual de **5%** gera **R$ 5,00** de valor devido pela loja à plataforma.
- O consumidor recebe um cupom com QR Code. O cupom registra, entre outros dados, o valor integral da compra, a loja, a data/hora e um identificador único.
- O valor devido à plataforma não reduz o valor do prêmio. No exemplo, se o cupom for sorteado, o valor de referência do prêmio será **R$ 100,00**, e não R$ 5,00.
- A forma de entrega do prêmio — dinheiro ou mercadoria — será definida posteriormente e não faz parte das regras técnicas de sorteio desta etapa.
- Cada cupom deve ser individual e não pode ser duplicado.

## 4. Regra única de sorteio: grupos de 100 cupons

- Não haverá mais as modalidades antigas de Unidade, Dezena, Centena, Milhar, Quina ou Sena.
- Não haverá multiplicadores.
- A promoção terá uma única regra de premiação: **1 ganhador para cada grupo completo de 100 cupons válidos**.
- Os grupos serão formados somente com cupons elegíveis, isto é, cupons cuja parte financeira tenha sido paga e confirmada.
- Cada grupo completo de 100 cupons elegíveis terá um sorteio e exatamente um ganhador.
- Os grupos serão organizados separadamente para cada estabelecimento. Cupons de lojas diferentes nunca serão misturados no mesmo grupo ou sorteio.
- A periodicidade dos sorteios ainda não está definida. Poderá ser diária, semanal, mensal ou outra frequência acordada entre a plataforma e cada estabelecimento.
- O sistema deverá permitir configurar a periodicidade por estabelecimento, conforme o acordo comercial, sem fixar agora uma frequência única para todos.
- O sorteio não poderá incluir cupons emitidos que ainda estejam pendentes de pagamento.
- O valor do prêmio associado a cada cupom corresponde ao valor integral da compra registrada naquele cupom.

## 5. Fechamentos financeiros e pagamento da loja

- A loja poderá registrar vendas continuamente durante o período acordado: por exemplo, durante um dia, uma semana ou um mês.
- No momento combinado, o dono/administrador fará o fechamento financeiro dos cupons emitidos e ainda não pagos.
- A plataforma calculará o total devido com base na soma dos percentuais aplicados aos valores das compras incluídas no fechamento.
- O fechamento gera uma cobrança Pix, apresentada por QR Code, para a loja pagar à plataforma.
- Cada fechamento deve manter sua própria identificação, relação de cupons, valores, data e situação do pagamento.
- A loja poderá deixar valores acumularem por mais de um período e quitá-los posteriormente, conforme o acordo entre a plataforma e o estabelecimento.
- Cupons pendentes não expiram automaticamente por falta de pagamento. Permanecem registrados e fora dos sorteios até que o pagamento correspondente seja confirmado.
- Quando a loja quitar um fechamento acumulado, os cupons incluídos nele poderão ser liberados, mesmo que tenham sido emitidos em períodos anteriores.
- A periodicidade de pagamento e a periodicidade dos sorteios serão definidas no acordo entre a plataforma e cada estabelecimento.

## 6. Confirmação do pagamento e liberação dos cupons

- A geração do QR Code Pix, por si só, não confirma o pagamento.
- A plataforma deve confirmar o recebimento por meio da integração com o provedor de pagamento.
- Após a confirmação efetiva, o sistema associa o pagamento ao fechamento correspondente.
- **Somente os cupons incluídos no fechamento efetivamente pago são liberados** para participar dos sorteios.
- Cupons de fechamentos ainda não pagos permanecem emitidos, registrados e pendentes, mas não podem entrar nos grupos de sorteio.
- Se uma loja deixar de pagar durante uma ou mais semanas ou períodos, seus cupons continuam acumulados e válidos, sem participar dos sorteios enquanto não houver pagamento.
- Quando o pagamento atrasado for confirmado, os cupons daquele fechamento passam a ficar elegíveis para formar grupos de 100 daquela mesma loja.
- O pagamento de uma loja não libera cupons de outro estabelecimento.
- Um pagamento não pode liberar cupons de outro fechamento nem ser utilizado duas vezes.
- A confirmação deve ser registrada de forma segura, com identificação da transação e histórico de auditoria.

## 7. Separação por estabelecimento

- Cada estabelecimento terá sua própria base lógica de cupons, fila de participação, grupos de 100 e sorteios.
- Os consumidores de uma loja concorrem somente nos grupos formados com cupons elegíveis daquela mesma loja.
- Os cupons da Loja X não podem ser usados para completar um grupo da Loja Y, e vice-versa.
- Se a Loja X não pagar, os cupons dela permanecem fora dos sorteios, mesmo que outras lojas estejam em dia e realizando seus sorteios normalmente.
- O funcionamento de uma loja não deve bloquear nem alterar a participação de outra.
- A elegibilidade deve ser verificada por cupom, estabelecimento e confirmação financeira correspondente.

## 8. Painel do administrador da loja

O dono/administrador deve conseguir consultar:

- Total de compras registradas pela loja.
- Quantidade de cupons emitidos, pendentes e liberados.
- Histórico de compras e cupons.
- Funcionário responsável por cada emissão.
- Valores acumulados e percentual devido à plataforma.
- Fechamentos realizados, com seus respectivos cupons e valores.
- Situação de cada fechamento: pendente, aguardando confirmação ou pago/liberado.
- Grupos de 100 formados, cupons participantes e histórico de sorteios da própria loja.
- Periodicidade de pagamento e de sorteio acordada para a loja.
- Opção para iniciar um novo fechamento e gerar o QR Code Pix da cobrança.

## 9. Regras essenciais de segurança e auditoria

1. A separação dos dados deve ser feita por loja; cada estabelecimento só acessa seus próprios registros.
2. Cada cupom deve estar vinculado a uma loja, a uma compra, a uma emissão e ao fechamento financeiro correspondente.
3. O sistema não deve liberar cupons com base apenas em comprovante enviado ou informação visual de pagamento.
4. A liberação depende da confirmação da transação pelo provedor de pagamento.
5. O processamento da confirmação deve ser idempotente: notificações repetidas não podem duplicar pagamentos nem liberar cupons novamente.
6. Deve existir trilha de auditoria para emissões, fechamentos, pagamentos, liberações e eventuais cancelamentos.
7. A apuração deve considerar apenas cupons pagos, confirmados e pertencentes ao estabelecimento daquele sorteio.
8. Um cupom não pode participar mais de uma vez nem ser atribuído a mais de um grupo/sorteio.
9. A formação dos grupos deve ser rastreável, preservando a relação dos 100 cupons que compõem cada grupo e o resultado correspondente.

## 10. Exemplo ilustrativo do fluxo

1. Uma loja registra compras e emite cupons ao longo da semana.
2. Cada cupom fica associado ao valor integral da compra e ao percentual devido à plataforma.
3. Os cupons permanecem emitidos, mas não participam de sorteios enquanto a loja não pagar.
4. No dia combinado, o dono fecha o período e paga o total devido por Pix.
5. A plataforma confirma o recebimento e libera somente os cupons incluídos naquele fechamento.
6. Os cupons liberados entram na fila exclusiva daquela loja.
7. Quando houver 100 cupons elegíveis, forma-se um grupo completo para um sorteio daquela loja.
8. Outra loja mantém sua própria fila e seus próprios grupos, sem compartilhar cupons.
9. Se uma loja não pagar por vários períodos, seus cupons continuam acumulados e poderão ser liberados quando o pagamento for confirmado.

## 11. Pontos que ainda precisam ser definidos

- Se o percentual será único para todas as lojas ou configurável individualmente por estabelecimento, respeitando a faixa pretendida de 3% a 5%.
- Qual será a periodicidade de pagamento de cada loja e como ela será formalizada no acordo comercial.
- Qual será a periodicidade dos sorteios de cada loja: diária, semanal, mensal ou outra.
- Se, ao final de um período de sorteio, os cupons elegíveis que não completarem um grupo de 100 serão carregados para o período seguinte. A regra de grupos completos está definida, mas esse comportamento precisa de confirmação.
- Como tratar cancelamentos, estornos e erros em cupons já incluídos em um fechamento ou grupo.
- Se será permitido pagamento parcial ou se cada fechamento deverá ser quitado integralmente.
- Qual provedor Pix será utilizado e como ocorrerá a conciliação automática.
- Como será feito o procedimento operacional do sorteio e a comprovação do resultado.
- Como será realizada a entrega do prêmio ao consumidor, em dinheiro ou mercadoria.

---

**Observação de escopo:** este documento registra as regras e decisões discutidas para orientar o manual e a futura especificação. Não altera o banco de dados, as telas, os pagamentos ou o funcionamento do sistema. A implementação só deverá começar depois da revisão e aprovação da documentação.
