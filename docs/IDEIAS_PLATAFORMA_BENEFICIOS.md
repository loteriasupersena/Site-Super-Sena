# Caderno de ideias — Plataforma de benefícios

> Documento de registro de decisões e ideias em discussão. Não é, por si só, uma autorização para implementar. As regras registradas devem ser revisadas e aprovadas antes de qualquer alteração no sistema.

## 1. Objetivo geral da plataforma

Criar uma plataforma de promoções para estabelecimentos comerciais. A loja registra o valor de cada compra e emite um cupom individual com QR Code para o consumidor.

O valor informado da compra serve como base para calcular o percentual devido à plataforma e também fica associado ao cupom como valor do prêmio correspondente. Não haverá apostas por dezenas, centenas ou outras faixas numéricas.

## 2. Hierarquia de usuários e áreas do sistema

A plataforma terá áreas separadas, com funções e permissões distintas.

### 2.1 Administrador geral da plataforma

- O administrador geral possui acesso global à plataforma e é responsável por cadastrar, ativar, editar, suspender e administrar os estabelecimentos.
- A hierarquia de cadastro é obrigatória: **o administrador geral cadastra as lojas; cada loja cadastra e administra suas próprias maquininhas/caixas**. A loja não cadastra outras lojas.
- O administrador geral deve ter visão operacional de todas as lojas, incluindo os dados e resultados produzidos por suas maquininhas.
- O administrador geral pode consultar quantas maquininhas cada loja possui, quantos cupons cada maquininha emitiu, o total emitido por loja, os valores acumulados, os lotes disponíveis, os fechamentos, os pagamentos, os sorteios e a situação dos prêmios.
- O administrador geral deve conseguir acompanhar se cada loja está realizando fechamentos e pagamentos, se os sorteios foram processados corretamente pelo servidor e se existem prêmios aguardando contato ou entrega.
- O administrador geral precisa de acesso aos resultados operacionais e indicadores das maquininhas, mas não precisa visualizar as senhas dos caixas. As credenciais individuais são administradas pela loja e devem permanecer protegidas.
- O administrador geral não deve depender do administrador da loja para obter os indicadores operacionais: essas informações devem ser registradas centralmente e apresentadas no painel geral.

- Existe um administrador geral, responsável pela administração central da plataforma.
- O administrador geral cadastra e gerencia os administradores dos estabelecimentos.
- O administrador geral controla as configurações gerais e os parâmetros permitidos da plataforma.
- O administrador geral pode consultar e administrar os estabelecimentos conforme suas permissões.
- Um administrador de loja não pode acessar a administração geral nem os dados administrativos de outras lojas.

### 2.2 Administrador da loja

- Cada estabelecimento possui sua própria área administrativa, acessível pelo celular ou outro dispositivo autorizado.
- O administrador da loja é o responsável pelo estabelecimento e pode acompanhar somente os dados da própria loja.
- Essa área é destinada à administração da loja: acompanhar movimento, vendas registradas, cupons emitidos, lotes, valores devidos, pagamentos e histórico de sorteios.
- O administrador da loja cadastra e administra exclusivamente as maquininhas/caixas vinculados ao próprio estabelecimento, incluindo seus acessos.
- O administrador da loja escolhe quantos lotes completos deseja incluir em cada fechamento, respeitando a quantidade de cupons elegíveis e ainda não fechados.
- A área administrativa da loja não é a interface usada no caixa para registrar compras e emitir cupons.

### 2.3 Caixas/maquininhas e funcionários

- Cada maquininha ou caixa terá seu próprio login e senha.
- O acesso da maquininha é usado pelo funcionário responsável para registrar o valor da compra e emitir o cupom com QR Code.
- Cada emissão fica vinculada à loja e ao caixa/maquininha que a realizou, permitindo identificar a origem de cada cupom.
- Uma loja pode ter várias maquininhas, por exemplo, uma para cada caixa de supermercado.
- Uma loja pequena também pode operar com apenas uma maquininha.
- O dono pode ser o único administrador da loja. Se também realizar vendas e emitir cupons, deverá utilizar o acesso operacional de uma maquininha/caixa, separado do acesso administrativo.
- O acesso administrativo da loja pode ser feito pelo celular; a emissão de cupons ocorre pela interface de caixa/maquininha.
- As funções administrativas e as funções de emissão não devem ser misturadas em uma única área.

## 3. Registro de compras, percentual e emissão de cupons

- No momento da venda, o funcionário ou responsável informa na maquininha o valor da compra realizada pelo consumidor.
- O valor informado representa o valor integral da compra e fica associado ao cupom.
- A plataforma calcula o valor devido à plataforma aplicando ao valor da compra o percentual configurado na área de administração geral.
- A faixa percentual pretendida é de **3% a 5%**, com **5% como referência inicial**. O percentual deverá ser editável pelo administrador geral. Ainda será definido se a configuração será geral ou individual por loja.
- Exemplo: compra de **R$ 100,00** com percentual de **5%** gera **R$ 5,00** de valor devido pela loja à plataforma.
- Antes de emitir o cupom, a interface de caixa registra o contato fornecido pelo consumidor, além do valor da compra. O contato deve permitir que a loja localize o cliente caso ele perca o cupom ou não consulte o resultado.
- A maquininha emite um cupom individual com QR Code para o consumidor.
- O cupom registra, entre outros dados, o valor integral da compra, a loja, a maquininha/caixa, o funcionário responsável, a data/hora e um identificador único.
- O valor devido à plataforma não reduz o valor do prêmio. No exemplo, se o cupom for sorteado, o valor de referência do prêmio será **R$ 100,00**, e não R$ 5,00.
- A forma de entrega do prêmio — dinheiro ou mercadoria — será definida posteriormente e não faz parte das regras técnicas de sorteio desta etapa.
- Cada cupom deve ser individual e não pode ser duplicado.
- O contato do consumidor deve ficar associado ao cupom com proteção adequada, acesso restrito e finalidade limitada à comunicação sobre o resultado e o resgate do prêmio. O contato não deve ficar exposto publicamente na consulta do QR Code.

## 4. Regra única de sorteio: lotes fechados de 100 cupons

- Não haverá mais as modalidades antigas de Unidade, Dezena, Centena, Milhar, Quina ou Sena.
- Não haverá multiplicadores.
- A promoção terá uma única regra: **cada lote fechado contém 100 cupons elegíveis e gera um ganhador**.
- Os lotes são exclusivos de cada estabelecimento. Cupons de lojas diferentes nunca serão misturados no mesmo lote ou sorteio.
- Somente cupons pagos e liberados podem compor um lote.
- O administrador da loja poderá escolher fechar um ou vários lotes de uma só vez, desde que existam cupons elegíveis suficientes. Por exemplo, poderá fechar 1 lote com 100 cupons ou 8 lotes com 800 cupons.
- Cada lote de 100 cupons gera seu próprio sorteio e exatamente um ganhador.
- Não haverá sorteios agendados por data ou horário no servidor. O sorteio será acionado automaticamente pelo webhook que confirmar o pagamento do fechamento.
- A frequência dos sorteios será consequência do fluxo de cupons e das decisões de fechamento e pagamento de cada loja, conforme acordo comercial com a plataforma. A frequência acordada orienta a operação e a comunicação aos clientes, mas não agenda o sorteio no servidor.
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

## 9. Painel do administrador geral

O administrador geral precisa de um painel central de acompanhamento de toda a operação. As informações essenciais devem estar visíveis em indicadores e listas, sem exigir que ele procure manualmente em cada área.

O painel deve apresentar, no mínimo:

- Quantidade de lojas cadastradas, ativas e suspensas.
- Para cada loja: quantidade de maquininhas cadastradas e situação de cada uma.
- Quantidade de cupons emitidos por loja e por maquininha, com filtros por período.
- Valores das compras registrados, percentual devido à plataforma, valores em aberto e valores pagos.
- Quantidade de cupons pendentes de pagamento, elegíveis e já utilizados em lotes.
- Quantidade de lotes disponíveis, em fechamento, aguardando pagamento, pagos e sorteados.
- Histórico de fechamentos e pagamentos de cada loja.
- Histórico de sorteios por loja e por lote, incluindo status do processamento e resultado.
- Identificação do cupom ganhador, valor da compra associado e contato do consumidor, com acesso restrito.
- Situação do contato com o ganhador e do resgate/entrega do prêmio: pendente de contato, avisado, aguardando comparecimento, entregue ou ocorrência registrada.
- Alertas para pagamentos pendentes, falhas de processamento, sorteios que não foram concluídos e prêmios ainda não resgatados.

O administrador geral deve conseguir abrir o detalhe de uma loja e acompanhar seus caixas, cupons, fechamentos, lotes, sorteios e prêmios. A visualização dos dados operacionais não implica acesso às senhas dos usuários ou maquininhas.

## 10. Contato do consumidor, consulta do cupom e resgate do prêmio

- No registro da compra para emissão do cupom, a interface da maquininha deve solicitar um meio de contato do consumidor, como telefone celular. O campo e o formato exatos ainda serão definidos.
- O contato fica vinculado ao cupom e deve ser armazenado com proteção e acesso restrito.
- O QR Code impresso permite ao consumidor consultar o estado do cupom e verificar se foi contemplado.
- A página pública de consulta não deve exibir o telefone nem outros dados pessoais do consumidor.
- Se o consumidor perder o cupom ou esquecer de consultar o resultado, a loja deverá conseguir localizar o ganhador pelo contato registrado e comunicar que existe um prêmio a resgatar.
- O administrador da loja acompanha os ganhadores dos sorteios da própria loja e registra as tentativas de contato e o andamento do resgate, mas não pode aprovar sozinho a entrega nem dar baixa definitiva no prêmio.
- O administrador geral acompanha os mesmos indicadores e o status de todos os estabelecimentos.
- O sistema deve registrar quando o ganhador foi avisado, quando compareceu, qual funcionário realizou a entrega e quando o prêmio foi efetivamente recebido e confirmado pelo consumidor.
- A forma de entrega — dinheiro ou crédito/mercadoria na loja — e os procedimentos de validação da identidade do ganhador serão definidos em etapa posterior.
- O resgate não deve ser considerado concluído apenas porque o sorteio foi realizado; é necessário registrar a entrega efetiva do prêmio.

## 11. Controle antifraude e autorização de resgate de prêmios

**Regra central: o administrador da loja não pode aprovar, liquidar ou dar baixa definitiva em um prêmio por conta própria. A conclusão do resgate depende do controle da plataforma e de evidências de confirmação do ganhador.**

### 11.1 Acompanhamento do ganhador pela plataforma

- Assim que um sorteio for concluído, o resultado e os dados do cupom ganhador devem aparecer no painel do administrador geral.
- O painel deve destacar a loja responsável, o número/identificador do cupom, o valor integral da compra associado ao prêmio, a data/hora do sorteio e o contato cadastrado do consumidor.
- O prêmio começa com status **aguardando contato/resgate**.
- O administrador geral é responsável por acompanhar o ganhador e pode iniciar o contato diretamente com ele.
- O administrador da loja pode visualizar o prêmio e acompanhar o processo, mas não pode ocultar o resultado, trocar o ganhador, alterar o contato cadastrado sem trilha de auditoria, nem marcar o prêmio como definitivamente entregue.

### 11.2 Solicitação de resgate na loja

- O ganhador pode comparecer à loja por iniciativa própria, mesmo que ainda não tenha sido contatado.
- Nesse caso, a loja inicia uma **solicitação de resgate** no sistema, sem poder concluir a baixa.
- A solicitação deve identificar o cupom premiado e a loja, e ficar registrada com data/hora e usuário/caixa que iniciou o atendimento.
- O sistema deve verificar que o cupom é realmente o ganhador daquele sorteio e que o prêmio ainda não foi resgatado nem está bloqueado por outra solicitação.
- A apresentação do QR Code impresso, isoladamente, não deve ser considerada prova suficiente de identidade do ganhador.

### 11.3 Confirmação da identidade e do recebimento pelo consumidor

- A confirmação deve usar o contato que foi registrado na emissão do cupom, por meio de código de uso único enviado ao telefone ou outro canal validado.
- O código de confirmação deve ter validade limitada, ser de uso único e estar vinculado àquela solicitação de resgate. Não deve ser reutilizável em outro prêmio.
- A loja deve conferir o código no fluxo de atendimento, mas a confirmação deve ficar registrada centralmente e ser visível ao administrador geral.
- Depois da entrega física do dinheiro ou da mercadoria, o consumidor deve realizar uma segunda confirmação de recebimento, também de uso único, ou outro mecanismo equivalente aprovado pela plataforma.
- A confirmação do consumidor é evidência de recebimento; não deve ser substituída por uma declaração unilateral do lojista.
- Se o consumidor não tiver acesso ao telefone cadastrado, o caso deve ficar pendente e ser encaminhado ao administrador geral para verificação alternativa. A loja não pode dispensar a confirmação por conta própria.

### 11.4 Autorização e baixa definitiva

- O administrador da loja e seus funcionários não têm permissão para dar baixa definitiva, cancelar ou marcar o prêmio como pago/resgatado.
- A plataforma mantém o controle central da situação do prêmio.
- O administrador geral é o único perfil autorizado a aprovar a conclusão e registrar a baixa definitiva do prêmio, após verificar a confirmação do consumidor e os registros da entrega.
- O sistema deve impedir tecnicamente que contas da loja executem essa ação, não bastando apenas uma orientação operacional.
- A baixa deve guardar quem autorizou, quando autorizou, qual prêmio foi encerrado e quais evidências de confirmação foram utilizadas.
- Cada prêmio só pode ser resgatado uma vez. Solicitações simultâneas, códigos repetidos ou tentativas de baixa duplicada devem ser bloqueados e registrados.

### 11.5 Estados e alertas do prêmio

O acompanhamento deve distinguir, no mínimo, os seguintes estados:

1. **Sorteado — aguardando contato:** resultado gerado, ainda sem contato confirmado com o ganhador.
2. **Contato realizado:** a plataforma registrou tentativa ou confirmação de aviso ao ganhador.
3. **Solicitação de resgate aberta:** o ganhador compareceu ou iniciou o processo na loja.
4. **Identidade em confirmação:** aguardando validação do código ou procedimento alternativo.
5. **Aguardando entrega:** identidade confirmada, prêmio ainda não entregue.
6. **Entrega informada pela loja:** a loja registrou que entregou, aguardando confirmação do consumidor e validação da plataforma.
7. **Aguardando baixa da plataforma:** evidências recebidas, pendentes de análise pelo administrador geral.
8. **Resgatado/encerrado:** baixa definitiva autorizada pelo administrador geral.
9. **Em análise/contestação:** divergência, suspeita de fraude ou reclamação registrada.

O painel geral deve destacar prêmios sem contato, solicitações pendentes, entregas sem confirmação do consumidor, casos em análise e prêmios aguardando baixa.

## 12. Regras essenciais de segurança e auditoria

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

## 13. Exemplo ilustrativo do fluxo

1. Um supermercado possui cinco caixas, cada um com uma maquininha e credenciais próprias.
2. Em cada caixa, o funcionário registra o valor da compra e emite o cupom com QR Code.
3. O administrador acompanha pelo celular os cupons emitidos por todos os caixas da loja.
4. Quando houver 800 cupons elegíveis ainda não fechados, o administrador pode escolher fechar os 8 lotes de uma vez.
5. A plataforma calcula o valor devido, apresenta o resumo e gera o QR Code Pix.
6. O administrador paga a cobrança.
7. O provedor confirma o pagamento por webhook.
8. O servidor processa o fechamento automaticamente e realiza 8 sorteios independentes, um para cada lote de 100 cupons.
9. Outra loja mantém sua própria fila, seus próprios pagamentos e seus próprios sorteios, sem compartilhar cupons.

## 14. Pontos que ainda precisam ser definidos

- Se o percentual será único para todas as lojas ou configurável individualmente por estabelecimento, respeitando a faixa pretendida de 3% a 5%.
- Se haverá limites ou regras comerciais específicas para a quantidade de lotes que uma loja pode fechar por vez.
- Como tratar cancelamentos, estornos e erros em cupons já incluídos em um fechamento ou lote.
- Se será permitido pagamento parcial. A regra descrita pressupõe pagamento integral do fechamento antes do processamento dos lotes nele incluídos.
- Qual provedor Pix será utilizado e como ocorrerá a conciliação automática por webhook.
- Como será feito o procedimento técnico do sorteio, a geração de aleatoriedade verificável e a comprovação do resultado.
- Como será realizada a entrega do prêmio ao consumidor, em dinheiro ou mercadoria.
- Qual canal será utilizado para enviar os códigos de uso único ao consumidor e qual procedimento alternativo será aceito quando ele não tiver acesso ao contato cadastrado.
- Quais evidências adicionais poderão ser exigidas pela plataforma antes da baixa definitiva, especialmente para prêmios de maior valor.
- Quais serão os dados e procedimentos de identificação do ganhador.

---

**Observação de escopo:** este documento registra as regras e decisões discutidas para orientar o manual e a futura especificação. Não altera o banco de dados, as telas, os pagamentos ou o funcionamento do sistema. A implementação só deverá começar depois da revisão e aprovação da documentação.
