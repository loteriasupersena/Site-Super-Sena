# Caderno de ideias — Plataforma de benefícios

> Documento de registro de decisões e ideias em discussão. Não é, por si só, uma autorização para implementar. As regras registradas devem ser revisadas e aprovadas antes de qualquer alteração no sistema.

## 1. Objetivo geral da plataforma

Criar uma plataforma de promoções para estabelecimentos comerciais. A loja registra o valor de cada compra e emite um cupom individual com QR Code para o consumidor.

O valor informado da compra serve como base para calcular o percentual devido à plataforma e também fica associado ao cupom como valor do prêmio correspondente. Não haverá apostas por dezenas, centenas ou outras faixas numéricas.

## 2. Hierarquia de usuários e áreas do sistema

A plataforma terá áreas separadas, com funções e permissões distintas.

### 2.1 Administrador geral da plataforma

- Existe um administrador geral, responsável pela administração central da plataforma.
- O administrador geral cadastra e gerencia os administradores dos estabelecimentos.
- O administrador geral controla as configurações gerais e os parâmetros permitidos da plataforma.
- O administrador geral pode consultar e administrar os estabelecimentos conforme suas permissões.
- Um administrador de loja não pode acessar a administração geral nem os dados administrativos de outras lojas.

### 2.2 Administrador da loja

- Cada estabelecimento possui sua própria área administrativa, acessível pelo celular ou outro dispositivo autorizado.
- O administrador da loja é o responsável pelo estabelecimento e pode acompanhar somente os dados da própria loja.
- Essa área é destinada à administração da loja: acompanhar movimento, vendas registradas, cupons emitidos, lotes, valores devidos, pagamentos e histórico de sorteios.
- O administrador da loja administra os caixas/maquininhas vinculados ao estabelecimento, criando ou gerenciando seus acessos.
- O administrador da loja escolhe quantos lotes completos deseja incluir em cada fechamento, respeitando a quantidade de cupons elegíveis e ainda não fechados.
- A área administrativa da loja não é a interface usada no caixa para registrar compras e emitir cupons.

### 2.3 Caixas/maquininhas e funcionários

- Cada maquininha ou caixa terá seu próprio login e senha.
- O acesso da maquininha é usado pelo funcionário responsável para registrar o valor da compra e emitir o cupom com QR Code.
- Cada emissão fica vinculada à loja e ao caixa/maquininha que a realizou, permitindo identificar a origem de cada cupom.
- Uma loja pode ter várias maquininhas, por exemplo, uma para cada caixa de supermercado.
- Uma loja pequena também pode operar com apenas uma maquininha.
- O dono pode ser o único administrador da loja e, se também realizar vendas, utilizar separadamente um acesso de caixa/maquininha para emitir cupons.
- O acesso administrativo da loja pode ser feito pelo celular; a emissão de cupons ocorre pela interface de caixa/maquininha.
- As funções administrativas e as funções de emissão não devem ser misturadas em uma única área.

## 3. Registro de compras, percentual e emissão de cupons

- No momento da venda, o funcionário ou responsável informa na maquininha o valor da compra realizada pelo consumidor.
- O valor informado representa o valor integral da compra e fica associado ao cupom.
- A plataforma calcula o valor devido à plataforma aplicando ao valor da compra o percentual configurado na área de administração geral.
- A faixa percentual pretendida é de **3% a 5%**, com **5% como referência inicial**. O percentual deverá ser editável pelo administrador geral. Ainda será definido se a configuração será geral ou individual por loja.
- Exemplo: compra de **R$ 100,00** com percentual de **5%** gera **R$ 5,00** de valor devido pela loja à plataforma.
- A maquininha emite um cupom individual com QR Code para o consumidor.
- O cupom registra, entre outros dados, o valor integral da compra, a loja, a maquininha/caixa, o funcionário responsável, a data/hora e um identificador único.
- O valor devido à plataforma não reduz o valor do prêmio. No exemplo, se o cupom for sorteado, o valor de referência do prêmio será **R$ 100,00**, e não R$ 5,00.
- A forma de entrega do prêmio — dinheiro ou mercadoria — será definida posteriormente e não faz parte das regras técnicas de sorteio desta etapa.
- Cada cupom deve ser individual e não pode ser duplicado.

## 4. Regra única de sorteio: lotes fechados de 100 cupons

- Não haverá mais as modalidades antigas de Unidade, Dezena, Centena, Milhar, Quina ou Sena.
- Não haverá multiplicadores.
- A promoção terá uma única regra: **cada lote fechado contém 100 cupons elegíveis e gera um ganhador**.
- Os lotes são exclusivos de cada estabelecimento. Cupons de lojas diferentes nunca serão misturados no mesmo lote ou sorteio.
- Somente cupons pagos e liberados podem compor um lote.
- O administrador da loja poderá escolher fechar um ou vários lotes de uma só vez, desde que existam cupons elegíveis suficientes. Por exemplo, poderá fechar 1 lote com 100 cupons ou 8 lotes com 800 cupons.
- Cada lote de 100 cupons gera seu próprio sorteio e exatamente um ganhador.
- O sorteio não depende de data, horário ou calendário periódico. Ele é disparado automaticamente após a confirmação do pagamento do fechamento correspondente.
- A frequência prática dos sorteios será determinada pelo ritmo de emissão dos cupons e pelas decisões de fechamento e pagamento de cada loja, não por uma agenda fixa da plataforma.
- O valor do prêmio associado ao cupom sorteado corresponde ao valor integral da compra registrada naquele cupom.
- Os cupons elegíveis que ainda não foram incluídos em um fechamento permanecem disponíveis para fechamentos posteriores. Não podem ser usados em mais de um lote.

## 5. Fechamentos financeiros e pagamento da loja

- A loja poderá registrar compras e emitir cupons continuamente.
- Na área administrativa, o dono acompanha quantos cupons estão disponíveis e quantos lotes completos podem ser fechados.
- O administrador da loja decide quantos lotes deseja fechar e pagar de uma vez: por exemplo, 100 cupons (1 lote), 200 (2 lotes) ou 800 (8 lotes).
- O sistema deve permitir selecionar somente quantidades correspondentes a lotes completos de 100 cupons elegíveis.
- O sistema calcula o valor devido à plataforma com base na soma dos percentuais aplicados aos valores das compras dos cupons incluídos no fechamento.
- Antes de pagar, o administrador visualiza a quantidade de lotes, a lista ou relação dos cupons incluídos e o valor total da cobrança.
- Ao confirmar o fechamento, a plataforma gera uma cobrança Pix com QR Code para pagamento.
- Cada fechamento mantém identificação própria, quantidade de lotes, relação exata dos cupons, valores, data e situação do pagamento.
- Os cupons que não forem incluídos naquele fechamento permanecem disponíveis na fila da mesma loja para um fechamento futuro.
- Cupons emitidos e ainda não pagos não expiram automaticamente. Permanecem registrados e fora dos sorteios até serem incluídos em fechamento pago.
- A loja poderá acumular cupons por quanto tempo for necessário antes de fechar e pagar, conforme o acordo comercial entre a plataforma e o estabelecimento.

## 6. Confirmação do pagamento e disparo automático dos sorteios

- A geração do QR Code Pix, por si só, não confirma o pagamento.
- A plataforma deve confirmar o recebimento por meio da integração com o provedor de pagamento, usando o webhook de confirmação.
- **O fechamento só é considerado pago após a confirmação efetiva do provedor.**
- Quando o webhook confirmar o pagamento, o servidor deverá processar automaticamente o fechamento correspondente.
- O sistema libera os cupons incluídos naquele fechamento e executa automaticamente um sorteio independente para cada lote de 100 cupons incluído.
- Exemplo: se o fechamento pago contiver 800 cupons, o sistema processará 8 lotes e realizará 8 sorteios, cada um com 100 cupons e um ganhador.
- Não será necessário que o administrador da loja acione manualmente o sorteio depois do pagamento.
- Cupons que não fazem parte daquele fechamento não podem ser liberados nem sorteados por causa daquele pagamento.
- O pagamento de uma loja não libera cupons de outro estabelecimento.
- Um pagamento não pode ser utilizado duas vezes nem disparar novamente sorteios já processados.
- O processamento do webhook deve ser idempotente: notificações repetidas não podem duplicar pagamentos, lotes ou sorteios.
- Cada sorteio deve guardar o lote exato de 100 cupons participantes, o resultado, a data/hora de processamento e os registros técnicos necessários para auditoria.

## 7. Separação por estabelecimento

- Cada estabelecimento terá sua própria fila de cupons elegíveis, seus próprios lotes, fechamentos, pagamentos e sorteios.
- Os consumidores de uma loja concorrem somente nos lotes formados com cupons daquela mesma loja.
- Os cupons da Loja X não podem ser usados para completar um lote da Loja Y, e vice-versa.
- Se a Loja X não pagar, seus cupons permanecem fora dos sorteios, mesmo que outras lojas estejam em dia e realizando seus sorteios normalmente.
- O funcionamento de uma loja não deve bloquear nem alterar a participação de outra.
- A elegibilidade deve ser verificada por cupom, estabelecimento e confirmação financeira correspondente.

## 8. Painel do administrador da loja

O administrador da loja deve conseguir consultar:

- Total de compras registradas pela loja.
- Quantidade de cupons emitidos, pendentes de pagamento e elegíveis.
- Quantidade de lotes completos disponíveis para fechamento.
- Quantos lotes foram fechados, pagos e sorteados.
- Histórico de compras e cupons, identificando a maquininha/caixa e o funcionário responsável.
- Valores acumulados e percentual devido à plataforma.
- Fechamentos realizados, com seus respectivos lotes, cupons e valores.
- Situação de cada fechamento: aberto, aguardando pagamento, pago/processado.
- Histórico dos sorteios e respectivos ganhadores da própria loja.
- Cadastro, situação e acessos das maquininhas/caixas vinculados à loja.
- Opção para escolher a quantidade de lotes, realizar o fechamento e gerar o QR Code Pix da cobrança.

## 9. Regras essenciais de segurança e auditoria

1. A separação dos dados deve ser feita por loja; cada estabelecimento só acessa seus próprios registros.
2. Cada maquininha/caixa possui credenciais próprias e só pode emitir cupons para a loja à qual está vinculada.
3. Cada cupom deve estar vinculado a uma compra, loja, maquininha/caixa, emissão e, depois, ao fechamento e lote correspondentes.
4. O sistema não deve liberar cupons com base apenas em comprovante enviado ou informação visual de pagamento.
5. A liberação e o disparo do sorteio dependem da confirmação da transação pelo provedor de pagamento.
6. O processamento da confirmação deve ser idempotente: notificações repetidas não podem duplicar pagamentos nem sorteios.
7. Um cupom não pode participar mais de uma vez nem ser atribuído a mais de um lote.
8. Cada lote deve conter exatamente 100 cupons elegíveis da mesma loja.
9. Deve existir trilha de auditoria para emissões, fechamentos, pagamentos, liberações, formação dos lotes e sorteios.
10. O administrador de uma loja não pode acessar dados de outra loja nem executar ações na administração geral.

## 10. Exemplo ilustrativo do fluxo

1. Um supermercado possui cinco caixas, cada um com uma maquininha e credenciais próprias.
2. Em cada caixa, o funcionário registra o valor da compra e emite o cupom com QR Code.
3. O administrador acompanha pelo celular os cupons emitidos por todos os caixas da loja.
4. Quando houver 800 cupons elegíveis ainda não fechados, o administrador pode escolher fechar os 8 lotes de uma vez.
5. A plataforma calcula o valor devido, apresenta o resumo e gera o QR Code Pix.
6. O administrador paga a cobrança.
7. O provedor confirma o pagamento por webhook.
8. O servidor processa o fechamento automaticamente e realiza 8 sorteios independentes, um para cada lote de 100 cupons.
9. Outra loja mantém sua própria fila, seus próprios pagamentos e seus próprios sorteios, sem compartilhar cupons.

## 11. Pontos que ainda precisam ser definidos

- Se o percentual será único para todas as lojas ou configurável individualmente por estabelecimento, respeitando a faixa pretendida de 3% a 5%.
- Se haverá limites ou regras comerciais específicas para a quantidade de lotes que uma loja pode fechar por vez.
- Como tratar cancelamentos, estornos e erros em cupons já incluídos em um fechamento ou lote.
- Se será permitido pagamento parcial. A regra descrita pressupõe pagamento integral do fechamento antes do processamento dos lotes nele incluídos.
- Qual provedor Pix será utilizado e como ocorrerá a conciliação automática por webhook.
- Como será feito o procedimento técnico do sorteio, a geração de aleatoriedade verificável e a comprovação do resultado.
- Como será realizada a entrega do prêmio ao consumidor, em dinheiro ou mercadoria.
- Quais serão os dados e procedimentos de identificação do ganhador.

---

**Observação de escopo:** este documento registra as regras e decisões discutidas para orientar o manual e a futura especificação. Não altera o banco de dados, as telas, os pagamentos ou o funcionamento do sistema. A implementação só deverá começar depois da revisão e aprovação da documentação.
