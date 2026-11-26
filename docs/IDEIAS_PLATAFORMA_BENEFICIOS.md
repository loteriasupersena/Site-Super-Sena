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
- Quando o prazo estiver próximo do fim e o prêmio ainda não tiver sido resgatado, a plataforma deverá tentar entrar em contato com o ganhador para avisá-lo e orientá-lo sobre o resgate. O momento exato dessa comunicação ainda será definido.
- O procedimento de contato e recuperação para quem perdeu o cupom está descrito na seção 11.4.

## 11. Resgate do prêmio exclusivamente pela maquininha credenciada

**Regra central: somente o aplicativo (APK) autorizado de uma maquininha vinculada a estabelecimento credenciado pode executar o resgate e dar baixa no prêmio. A consulta por celular comum é apenas informativa.**

### 11.1 Leitura informativa pelo consumidor

- O consumidor pode ler o QR Code com a câmera do celular ou abrir o endereço de consulta em um navegador.
- A página apresenta apenas o resultado do cupom: não premiado ou premiado, o valor correspondente e a orientação para procurar um estabelecimento credenciado.
- A página não oferece botões de iniciar resgate, confirmar recebimento, dar baixa ou sacar.
- O QR Code de consulta não concede ao consumidor permissão para concluir a operação de resgate.

### 11.2 Leitura e resgate pelo aplicativo da loja

- O ganhador apresenta o QR Code original ou sua representação digital na tela do celular.
- Um funcionário usa o APK da maquininha de qualquer estabelecimento credenciado para ler o QR Code.
- O APK consulta o servidor e apresenta a situação do prêmio, seu valor, validade e modalidades de resgate permitidas para o estabelecimento que está atendendo.
- **Qualquer maquininha autorizada de qualquer estabelecimento credenciado poderá resgatar o prêmio**, não apenas a maquininha da loja que emitiu o cupom.
- A loja de origem deve ser recomendada na mensagem ao ganhador, mas não pode ser uma restrição técnica para o resgate.
- O servidor deve validar automaticamente se o prêmio está ativo, dentro do prazo e ainda não resgatado. Não haverá necessidade de autorização em tempo real do administrador geral ou do dono da loja.
- A operação fica vinculada à loja credenciada que efetivamente realizou o resgate, à maquininha, ao funcionário, ao prêmio, à modalidade e ao valor.

### 11.3 Modalidades de recebimento conforme acordo comercial

- A modalidade disponível será definida pelo acordo comercial entre a plataforma e cada estabelecimento. O sistema deverá respeitar as modalidades habilitadas para a loja que está realizando o atendimento.
- **Mercados e lojas com produtos:** a orientação preferencial poderá ser que o ganhador escolha mercadorias no estabelecimento, até o limite do valor do prêmio. No caixa, o valor do prêmio será aplicado como desconto na compra.
- O consumidor poderá escolher os produtos que desejar, respeitando o limite do prêmio e as condições comerciais informadas.
- **Estabelecimentos em que a entrega de mercadoria ou serviço não seja adequada**, como determinados serviços profissionais ou lojas especializadas, poderão habilitar recebimento em dinheiro/Pix, desde que isso esteja previsto no acordo comercial.
- Um estabelecimento poderá oferecer mercadoria/desconto, dinheiro/Pix ou ambas as opções, conforme o convênio.
- A modalidade acordada deve ser apresentada no APK antes da conclusão do resgate e informada ao consumidor nos termos da promoção.

### 11.4 Recuperação do prêmio quando o consumidor perde o cupom

- A plataforma acompanhará os prêmios que continuam sem resgate e poderá entrar em contato diretamente com o ganhador usando o contato registrado na emissão.
- A mensagem informará que o consumidor foi contemplado, indicará o valor do prêmio e avisará que ele ainda está disponível para resgate em qualquer estabelecimento credenciado habilitado.
- A mensagem poderá ser enviada pelo WhatsApp e conter um link individual e seguro para consultar o resultado do prêmio.
- Ao abrir o link, o consumidor verá a página com o resultado premiado e uma **segunda via digital do QR Code original**, correspondente ao mesmo cupom e ao mesmo prêmio.
- O consumidor poderá manter o link ou apresentar a tela/print da segunda via na loja. O funcionário fará a leitura desse QR Code pelo APK da maquininha, como faria com o QR Code impresso original.
- A segunda via não cria um novo cupom, não altera o identificador, não aumenta o valor e não reinicia o prazo. É apenas outra forma de apresentar o mesmo QR Code já emitido.
- O link deve ser individual, difícil de adivinhar e protegido contra alteração ou reutilização para criar um prêmio novo. A validade do link de recuperação e os controles adicionais de identidade ainda serão especificados.
- A recuperação do QR Code não permite resgate por celular comum: a baixa continua restrita ao APK de uma maquininha credenciada.

### 11.5 Baixa automática pela operação de resgate

- A baixa do prêmio acontece no servidor como consequência de uma operação válida concluída pelo APK da maquininha.
- Não haverá botão ou permissão para o administrador geral ou o administrador da loja dar baixa manualmente em um prêmio.
- No caso de mercadorias/desconto, o funcionário registra a aplicação do valor do prêmio na compra e conclui o resgate no APK.
- No caso de dinheiro/Pix, o funcionário usa a função de saque/resgate disponível no APK, respeitando o acordo e a conta de destino previamente cadastrada para o estabelecimento que está atendendo.
- O saque em dinheiro/Pix só pode ser iniciado pelo APK da maquininha autorizada. Não poderá ser iniciado pelo painel do administrador geral, pelo painel da loja ou por um celular comum.
- A conclusão da operação deve invalidar imediatamente novas tentativas de resgate daquele prêmio em qualquer outra loja ou maquininha.
- O servidor deve impedir resgates simultâneos ou duplicados, mesmo se duas maquininhas tentarem processar o mesmo QR Code ao mesmo tempo.
- Cada operação deve gerar trilha de auditoria com data/hora, identificador do prêmio, estabelecimento que resgatou, maquininha, funcionário, modalidade, valor e resultado.
- **Ponto financeiro ainda pendente:** detalhar como o saque Pix é liquidado, quem recebe os valores em cada etapa e como o estabelecimento que realizou o resgate é compensado. A conta de destino deve ser previamente cadastrada e validada para aquele estabelecimento.

## 12. Acordos comerciais por estabelecimento

- Cada estabelecimento terá um acordo comercial com a plataforma que definirá as modalidades de resgate aceitas naquele local: mercadorias/desconto, dinheiro/Pix ou ambas.
- A modalidade poderá variar conforme a natureza do negócio. Exemplo: supermercado pode priorizar mercadorias com desconto; uma autopeça ou consultório pode habilitar pagamento em dinheiro/Pix quando não fizer sentido entregar outro produto ou serviço.
- O acordo comercial da loja que efetivamente realizar o resgate determina quais modalidades seu APK poderá oferecer.
- O prêmio pode ser resgatado em qualquer estabelecimento credenciado habilitado, independentemente de qual loja emitiu o cupom.
- A mensagem ao ganhador deve recomendar primeiro a loja de origem, sem impedir que ele procure outra loja credenciada.
- As condições do acordo devem estar claras para o consumidor nos termos da promoção e na consulta do prêmio.

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
- Como será liquidado financeiramente o saque Pix e como será compensado o estabelecimento que realizou o resgate.
- Com quantos dias de antecedência do vencimento a plataforma tentará avisar o ganhador.
- Como será validado o acesso ao link individual de recuperação do QR Code e por quanto tempo esse link ficará disponível.
- Como tratar tecnicamente uma contestação de resgate sem permitir duplicidade ou baixa manual.

---

**Observação de escopo:** este documento registra as regras e decisões discutidas para orientar o manual e a futura especificação. Não altera o banco de dados, as telas, os pagamentos ou o funcionamento do sistema. A implementação só deverá começar depois da revisão e aprovação da documentação.
