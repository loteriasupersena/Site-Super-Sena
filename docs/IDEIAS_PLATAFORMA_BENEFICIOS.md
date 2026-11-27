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

## 4. Regra única de sorteio: fila geral e lotes de 100 cupons

- Haverá **uma fila única e geral de cupons**, compartilhada por todos os estabelecimentos participantes da promoção.
- Cada cupom entra nessa fila assim que é emitido e registrado corretamente, independentemente de a loja já ter pago ou não o valor devido à plataforma.
- Os cupons de lojas diferentes podem compor o mesmo lote. A origem de cada cupom continua identificada e vinculada à respectiva loja, maquininha/caixa, compra e funcionário.
- A fila forma lotes sequenciais de exatamente **100 cupons**. Cada lote completo gera automaticamente um sorteio independente e exatamente um ganhador.
- Assim que o centésimo cupom de um lote for registrado, o servidor deve fechar aquele lote e processar o sorteio automaticamente, sem aguardar fechamento administrativo ou pagamento de qualquer loja.
- A fila deve continuar recebendo cupons e formando novos lotes continuamente. A inadimplência de uma loja não pode pausar, atrasar ou impedir a formação dos lotes e a realização dos sorteios.
- Cada cupom participa de apenas um lote e de apenas um sorteio. O servidor deve registrar de forma permanente a composição exata dos lotes e os resultados.
- O valor do prêmio associado ao cupom sorteado corresponde ao valor integral da compra registrada naquele cupom.
- A situação financeira da loja emissora não altera a elegibilidade do consumidor nem o resultado do sorteio. O cliente não pode ser prejudicado por atraso ou falta de pagamento da loja.
- Não haverá lotes exclusivos por estabelecimento nem exigência de 100 cupons da mesma loja para realizar um sorteio.

## 5. Apuração financeira e pagamento devido por cada loja

- A emissão dos cupons e a participação dos consumidores na fila geral não dependem de pagamento prévio da loja.
- Para cada cupom emitido, a plataforma calcula e registra o valor devido pela loja emissora, aplicando o percentual comercial configurado ao valor integral da compra.
- A obrigação financeira permanece individualizada por estabelecimento, mesmo que os cupons de várias lojas sejam misturados nos mesmos lotes e sorteios.
- O sistema deve manter um extrato financeiro por loja, com quantidade de cupons emitidos, valores de compra associados, percentual aplicado, total devido, pagamentos recebidos, saldo em aberto e histórico.
- O painel da loja deve apresentar de forma clara o valor acumulado e devido à plataforma, com detalhamento e período de referência.
- O painel geral deve consolidar os mesmos dados de todas as lojas, permitindo identificar valores vencidos, pendentes e pagos.
- A plataforma deverá permitir gerar uma cobrança Pix com QR Code para que a loja pague os valores devidos. A cobrança e sua confirmação são recursos de apoio à apuração e ao registro financeiro; não condicionam a entrada dos cupons na fila, a formação dos lotes ou os sorteios.
- O sistema deve registrar cada cobrança com identificador próprio, loja devedora, valor, período ou cupons de referência, data de criação, vencimento quando definido e situação.
- A confirmação de pagamento poderá ser registrada por integração e webhook do provedor Pix. O webhook atualiza a situação financeira e a conciliação da loja, mas **não dispara sorteio nem libera lote**, pois os sorteios já acontecem automaticamente pela fila geral.
- A loja pode acumular valores devidos enquanto continua emitindo cupons, observadas as regras comerciais e eventuais medidas de bloqueio definidas pela plataforma.
- A cobrança e o acompanhamento de inadimplência serão uma atividade administrativa e comercial conduzida pelo responsável pela plataforma, fora da lógica automática de sorteios. O aplicativo fornece os dados, cálculos, extratos, cobranças e indicadores necessários para apoiar essa administração.

## 6. Formação automática dos lotes e processamento dos sorteios

- O evento que dispara a formação e o sorteio de um lote é a entrada do centésimo cupom válido na fila geral, e não um pagamento Pix.
- Ao completar 100 cupons, o servidor deve registrar o lote, congelar sua composição e executar automaticamente o sorteio correspondente.
- O sistema deve manter a ordem de entrada dos cupons e garantir que cada cupom seja atribuído uma única vez a um único lote.
- O sorteio deve ser independente para cada lote de 100 cupons, mesmo quando os participantes forem originários de várias lojas.
- O processamento deve ser confiável e idempotente: falhas, repetições de eventos ou reinicializações não podem gerar dois resultados para o mesmo lote nem deixar um lote completo sem processamento.
- Cada lote deve guardar os 100 cupons participantes, a loja de origem de cada um, o resultado, a data/hora, a versão do procedimento de sorteio e os registros técnicos necessários para auditoria.
- O pagamento de uma loja, a geração de uma cobrança Pix ou a confirmação de um webhook não inicia, interrompe, altera ou repete um sorteio.
- A inadimplência de qualquer estabelecimento não pode impedir o sorteio de um lote completo nem alterar a participação de um consumidor.

## 7. Separação operacional e financeira por estabelecimento

- A fila de participação e os lotes de sorteio são gerais e compartilhados por todos os estabelecimentos.
- Embora os cupons de lojas diferentes possam participar do mesmo lote, cada cupom mantém sua identificação de origem: loja, maquininha/caixa, funcionário, compra, valor e data/hora.
- Os dados administrativos e financeiros continuam separados por estabelecimento. Cada loja só pode consultar seus próprios cupons, vendas, valores devidos, cobranças, pagamentos e indicadores.
- O administrador geral pode consultar a fila global, a composição de cada lote, os sorteios e os dados financeiros individualizados de todas as lojas.
- O valor devido por uma loja continua sendo responsabilidade daquela loja, ainda que seus cupons tenham sido sorteados em lotes compartilhados com cupons de outros estabelecimentos.
- A situação de pagamento de uma loja não pode bloquear, retirar ou prejudicar cupons já emitidos, nem impedir que eles sejam sorteados na fila geral.
- Eventual bloqueio por inadimplência pode impedir novas emissões pela loja, conforme política comercial e administrativa a ser definida, mas não altera cupons já emitidos nem resultados já produzidos.

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
- Alertas para valores vencidos ou pendentes por loja, falhas de processamento, lotes completos ainda não sorteados e prêmios ainda não resgatados.\n- Ferramentas para consultar e exportar os dados necessários à cobrança administrativa dos estabelecimentos.

O administrador geral deve conseguir abrir o detalhe de uma loja e acompanhar seus caixas, cupons, fechamentos, lotes, sorteios e prêmios. A visualização dos dados operacionais não implica acesso às senhas dos usuários ou maquininhas.

## 10. Consulta do QR Code, comunicação e prazo do prêmio

- A leitura do QR Code por um celular comum ou navegador serve **somente para consultar o resultado**: informa se o cupom foi premiado ou não e, se foi, apresenta o valor do prêmio e a orientação para resgatá-lo em um estabelecimento credenciado.
- Na consulta pública do QR Code não haverá botão para iniciar resgate, confirmar recebimento, solicitar saque ou executar qualquer outra ação.
- A mensagem para o ganhador deve orientar: **“Dirija-se preferencialmente à loja onde você recebeu este cupom para resgatar seu prêmio.”** A orientação favorece o estabelecimento que emitiu o cupom, mas não restringe o resgate a ele.
- O prêmio poderá ser resgatado em qualquer estabelecimento credenciado que possua maquininha com o aplicativo autorizado para leitura e resgate. O estabelecimento de origem é recomendado, não obrigatório.
- A consulta pública não deve exibir telefone nem outros dados pessoais do consumidor.
- O contato informado na emissão fica vinculado ao cupom, protegido e com acesso restrito, para que a plataforma possa localizar e avisar o ganhador caso ele não procure o resgate.
- O prazo para resgatar começa no momento em que o sorteio é realizado. O prêmio fica disponível por **30 dias corridos**.
- Ao completar 30 dias sem resgate, o prêmio muda automaticamente para **expirado**. A expiração ocorre exclusivamente por regra automática do sistema, sem ação ou autorização manual de qualquer administrador.
- Um prêmio expirado não pode ser resgatado pela leitura do QR Code original nem por uma segunda via.
- Quando o prêmio estiver se aproximando do fim do prazo e continuar sem resgate, a plataforma deverá entrar em contato com o ganhador para avisá-lo e orientá-lo sobre como resgatar. A antecedência exata da mensagem ainda será definida.
- O procedimento de contato e recuperação para quem perdeu o cupom está descrito na seção 11.4.

## 11. Resgate do prêmio exclusivamente pela maquininha credenciada

**Regra central: somente o aplicativo (APK) autorizado de uma maquininha vinculada a estabelecimento credenciado pode executar o resgate e dar baixa no prêmio. A consulta por celular comum é apenas informativa.**

### 11.1 Leitura informativa pelo consumidor

- O consumidor pode ler o QR Code com a câmera do celular ou abrir o endereço de consulta em um navegador.
- A página apresenta apenas o resultado do cupom: não premiado ou premiado, o valor correspondente e a orientação para procurar um estabelecimento credenciado.
- A página não oferece botões de iniciar resgate, confirmar recebimento, dar baixa ou sacar.
- O QR Code de consulta não concede ao consumidor permissão para concluir a operação de resgate.

### 11.2 Leitura e resgate pelo aplicativo da loja

- A leitura do QR Code pelo APK da maquininha foi **testada e confirmada pelo usuário nos equipamentos utilizados no projeto**. As maquininhas possuem Android 11 instalado por ROM modificada, câmera integrada e impressora térmica.
- O APK possui a função de escanear o QR Code usando a câmera integrada da maquininha.
- A câmera de alguns equipamentos tem qualidade limitada e pode apresentar dificuldade para ler o QR Code diretamente no papel. Quando isso acontecer, o consumidor poderá apresentar uma imagem/print do QR Code ampliada na tela do celular para facilitar a leitura.
- O ganhador apresenta o QR Code original impresso ou sua representação digital na tela do celular.
- Um funcionário ou responsável da loja usa o APK da maquininha credenciada para ler o QR Code.
- Após a leitura, o APK consulta o servidor e apresenta a situação do prêmio, seu valor, validade e modalidades de resgate permitidas para o estabelecimento que está atendendo.
- **A leitura do QR Code impresso e a leitura da segunda via digital levam ao mesmo fluxo de resgate**, sem diferença de permissões ou de valor.
- **Qualquer maquininha autorizada de qualquer estabelecimento credenciado poderá resgatar o prêmio**, não apenas a maquininha da loja que emitiu o cupom.
- A loja de origem deve ser recomendada na mensagem ao ganhador, mas não pode ser uma restrição técnica para o resgate.
- O servidor deve validar automaticamente se o prêmio está ativo, dentro do prazo e ainda não resgatado. Não haverá necessidade de autorização em tempo real do administrador geral ou do dono da loja.
- A operação fica vinculada à loja credenciada que efetivamente realizou o resgate, à maquininha, ao funcionário, ao prêmio, à modalidade e ao valor.

### 11.3 Saque e escolha da modalidade de pagamento

- Depois que o APK validar o prêmio lido, será exibida a ação **Sacar prêmio**.
- Ao iniciar o saque, o responsável autorizado pela loja seleciona uma das duas modalidades disponíveis:
  1. **Pagar em mercadoria** — a loja entrega produtos ou concede desconto ao consumidor até o limite do valor do prêmio.
  2. **Pagar em dinheiro** — a loja entrega o valor ao consumidor em dinheiro ou por Pix.
- As duas opções são mutuamente exclusivas. O sistema não permite selecionar ambas.
- Antes de concluir, o APK apresenta uma confirmação clara da modalidade escolhida, por exemplo: **“Confirma o saque deste prêmio e o registro como pago em mercadoria?”** ou **“Confirma o saque deste prêmio e o registro como pago em dinheiro?”**
- Após a confirmação, o sistema realiza a transferência do valor do prêmio para a conta Pix da loja que está efetuando o resgate, previamente cadastrada e validada na plataforma.
- A loja entrega ao consumidor exatamente a modalidade selecionada: mercadoria/desconto ou dinheiro/Pix.
- A transferência para a conta da loja, o registro da modalidade e a baixa definitiva do prêmio fazem parte da mesma operação de resgate. A operação concluída encerra o prêmio.
- Se o responsável cancelar antes da confirmação final, o prêmio permanece ativo e sem baixa, permitindo que a operação seja iniciada novamente.
- Depois da confirmação e da conclusão da transferência, o servidor registra a baixa definitiva do prêmio e bloqueia novas tentativas de resgate em qualquer loja ou maquininha.
- O acordo comercial define se a loja pode pagar em mercadoria, dinheiro ou ambas as modalidades. O APK só apresenta opções habilitadas para o estabelecimento que está realizando o resgate.
- O histórico deve registrar a modalidade escolhida, o valor, estabelecimento, maquininha, funcionário/responsável, conta de destino identificada de forma protegida, data/hora e identificador da transação Pix.
- A operação deve impedir resgates simultâneos ou duplicados, inclusive quando duas maquininhas tentarem processar o mesmo QR Code ao mesmo tempo.
- **Ponto financeiro ainda pendente:** detalhar a origem dos recursos transferidos via Pix, a liquidação da transferência e a conciliação financeira entre a plataforma e o estabelecimento. O destino da transferência está definido: a conta Pix cadastrada da loja que realizou o resgate.

### 11.4 Recuperação do prêmio quando o consumidor perde o cupom

- A plataforma acompanhará os prêmios que continuam sem resgate. Quando identificar que um prêmio está próximo de completar o prazo de 30 dias sem que o ganhador tenha comparecido, deverá entrar em contato usando o telefone registrado na emissão.
- A mensagem informará que o consumidor foi contemplado, indicará o valor do prêmio e orientará que ele procure uma loja credenciada para fazer o resgate.
- A mensagem poderá ser enviada pelo WhatsApp e conter um link individual e seguro para abrir o cupom premiado.
- Ao abrir o link, o consumidor verá o resultado premiado e a **segunda via digital do QR Code original**, correspondente ao mesmo cupom e ao mesmo prêmio.
- O consumidor poderá abrir o link e apresentar o QR Code na tela do celular, ou mostrar um print ampliado, para facilitar a leitura pela câmera da maquininha.
- O funcionário ou responsável da loja fará a leitura desse QR Code pelo APK da maquininha. A leitura digital abrirá exatamente a mesma tela e as mesmas opções de resgate disponíveis quando o consumidor apresenta o recibo físico.
- Depois da leitura, o responsável seleciona **Pagar em mercadoria** ou **Pagar em dinheiro**, confirma o saque e conclui a entrega ao consumidor. A transferência para a conta Pix da loja e a baixa definitiva ocorrem pelo mesmo procedimento do cupom físico.
- A segunda via não cria um novo cupom, não altera o identificador, não aumenta o valor e não reinicia o prazo. É apenas outra forma de apresentar o mesmo QR Code já emitido.
- O link deve ser individual, difícil de adivinhar e protegido contra alteração ou reutilização para criar um prêmio novo. A validade do link de recuperação e os controles adicionais de identidade ainda serão especificados.
- A recuperação do QR Code não permite resgate por celular comum: a baixa continua restrita ao APK de uma maquininha credenciada.

### 11.5 Baixa automática pela operação de resgate

- A baixa do prêmio acontece no servidor como consequência da operação válida concluída pelo APK da maquininha.
- Não haverá botão ou permissão para o administrador geral ou o administrador da loja dar baixa manualmente em um prêmio.
- A modalidade escolhida, a transferência para a conta Pix da loja, a entrega ao consumidor e a baixa do prêmio pertencem ao mesmo fluxo de resgate.
- A conclusão da operação deve invalidar imediatamente novas tentativas de resgate daquele prêmio em qualquer outra loja ou maquininha.
- O servidor deve impedir resgates simultâneos ou duplicados, mesmo se duas maquininhas tentarem processar o mesmo QR Code ao mesmo tempo.
- Cada operação deve gerar trilha de auditoria com data/hora, identificador do prêmio, estabelecimento que resgatou, maquininha, responsável, modalidade, valor, identificação da transferência e resultado.

## 12. Acordos comerciais por estabelecimento

- Cada estabelecimento terá um acordo comercial com a plataforma que definirá as modalidades de resgate aceitas naquele local: mercadorias/desconto, dinheiro/Pix ou ambas.
- A modalidade poderá variar conforme a natureza do negócio. Exemplo: supermercado pode priorizar mercadorias com desconto; uma autopeça ou consultório pode habilitar pagamento em dinheiro/Pix quando não fizer sentido entregar outro produto ou serviço.
- O acordo comercial da loja que efetivamente realizar o resgate determina quais modalidades seu APK poderá oferecer.
- O prêmio pode ser resgatado em qualquer estabelecimento credenciado habilitado, independentemente de qual loja emitiu o cupom.
- A mensagem ao ganhador deve recomendar primeiro a loja de origem, sem impedir que ele procure outra loja credenciada.
- As condições do acordo devem estar claras para o consumidor nos termos da promoção e na consulta do prêmio.

## 13. Regras essenciais de segurança e auditoria

1. Os dados financeiros e administrativos são segregados por loja; cada estabelecimento só acessa seus próprios registros, embora a fila de sorteio seja global.
2. Cada maquininha/caixa possui credenciais próprias e só pode emitir cupons para a loja à qual está vinculada.
3. Cada cupom deve estar vinculado a uma compra, loja, maquininha/caixa, emissão e, depois, ao fechamento e lote correspondentes.
4. O sistema não deve liberar cupons com base apenas em comprovante enviado ou informação visual de pagamento.
5. A liberação e o disparo do sorteio dependem da confirmação da transação pelo provedor de pagamento.
6. O processamento da confirmação deve ser idempotente: notificações repetidas não podem duplicar pagamentos nem sorteios.
7. Um cupom não pode participar mais de uma vez nem ser atribuído a mais de um lote.
8. Cada lote deve conter exatamente 100 cupons elegíveis da mesma loja.
9. Deve existir trilha de auditoria para emissões, fechamentos, pagamentos, liberações, formação dos lotes, sorteios e resgates.
10. O administrador de uma loja não pode acessar dados de outra loja nem executar ações na administração geral.

## 14. Exemplo ilustrativo do fluxo

1. Um supermercado possui cinco caixas, cada um com uma maquininha e credenciais próprias.
2. Em cada caixa, o funcionário registra o valor da compra e emite o cupom com QR Code.
3. O administrador acompanha pelo celular os cupons emitidos por todos os caixas da loja.
4. Quando houver 800 cupons elegíveis ainda não fechados, o administrador pode escolher fechar os 8 lotes de uma vez.
5. A plataforma calcula o valor devido, apresenta o resumo e gera o QR Code Pix.
6. O administrador paga a cobrança.
7. O provedor confirma o pagamento por webhook.
8. O servidor processa o fechamento automaticamente e realiza 8 sorteios independentes, um para cada lote de 100 cupons.
9. Outra loja mantém sua própria fila, seus próprios pagamentos e seus próprios sorteios, sem compartilhar cupons.

## 15. Pontos que ainda precisam ser definidos

- Se o percentual será único para todas as lojas ou configurável individualmente por estabelecimento, respeitando a faixa pretendida de 3% a 5%.
- Prazos de vencimento, periodicidade de apuração e condições de pagamento das lojas.
- Regras comerciais e contratuais de cobrança, garantias e consequências para inadimplência.
- Critérios objetivos para alertas, suspensão temporária e bloqueio de novas emissões por loja inadimplente, incluindo quem pode aplicar e retirar o bloqueio.
- Como registrar pagamentos parciais, acordos, renegociações, estornos e divergências nos valores devidos.
- Qual provedor Pix será utilizado e como ocorrerá a conciliação automática por webhook. O webhook não terá função de disparar sorteios.
- Como garantir financeiramente a entrega dos prêmios sorteados, inclusive quando a loja de origem ainda não tiver pago à plataforma e quando o prêmio for resgatado em outra loja.
- Como será feito o procedimento técnico do sorteio, a geração de aleatoriedade verificável e a comprovação do resultado.
- Como será liquidada financeiramente a transferência Pix do resgate e como será feita a conciliação entre a plataforma e a loja.
- Com quantos dias de antecedência do vencimento a plataforma enviará o aviso ao ganhador.
- Como será validado o acesso ao link individual de recuperação do QR Code e por quanto tempo esse link ficará disponível.
- Como tratar tecnicamente uma contestação de resgate sem permitir duplicidade ou baixa manual.
- Revisão jurídica do modelo de promoção, da fila compartilhada, dos compromissos com consumidores e dos acordos comerciais com os estabelecimentos.

---

**Observação de escopo:** este documento registra as regras e decisões discutidas para orientar o manual e a futura especificação. Não altera o banco de dados, as telas, os pagamentos ou o funcionamento do sistema. A implementação só deverá começar depois da revisão e aprovação da documentação.
