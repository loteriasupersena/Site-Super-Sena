# Caderno de ideias — Plataforma de benefícios

> Documento de registro de decisões e ideias em discussão. Não é, por si só, uma autorização para implementar. As regras registradas devem ser revisadas e aprovadas antes de qualquer alteração no sistema.

## 1. Objetivo geral da plataforma

Criar uma plataforma de promoções para estabelecimentos comerciais. A loja registra o valor de cada compra e emite um cupom individual com QR Code para o consumidor.

O valor informado da compra serve como base para calcular o percentual devido à plataforma e também fica associado ao cupom como valor do prêmio correspondente. Não haverá apostas por dezenas, centenas ou outras faixas numéricas.

## 2. Hierarquia de usuários e áreas do sistema

A plataforma terá áreas separadas, com funções e permissões distintas.

### 2.1 Administrador geral da plataforma

- O administrador geral possui controle administrativo global da plataforma.
- É responsabilidade do administrador geral cadastrar as lojas e criar/vincular o usuário administrador de cada estabelecimento. O administrador da loja não cria a própria conta nem cadastra outras lojas.
- O administrador geral pode ativar, editar, suspender e administrar lojas e seus administradores, além de controlar configurações e parâmetros gerais da plataforma.
- No cadastro de cada loja/administrador, o administrador geral deve definir livremente o percentual que aquela loja pagará à plataforma. Não existe faixa fixa obrigatória de 3% a 5%; essa faixa foi apenas uma referência inicial de desenvolvimento. Cada loja pode ter um percentual diferente, e o administrador geral poderá alterá-lo ao longo do tempo.
- No mesmo cadastro ou nas configurações da loja, o administrador geral define o limite de cupons por ciclo de cobrança que libera novas emissões. A referência inicial é de **100 cupons por ciclo**, podendo o limite ser controlado pela plataforma.
- **O administrador geral não cadastra nem cria maquininhas ou acessos operacionais.** Essa responsabilidade pertence exclusivamente ao administrador de cada loja.
- O administrador geral acompanha centralmente o movimento de toda a plataforma, com indicadores globais de cupons emitidos, cupons premiados, prêmios pendentes, prêmios resgatados e expirados, lojas e valores financeiros.
- Os principais indicadores devem ficar destacados no topo do painel, fora dos menus, sempre visíveis ao entrar na área administrativa.
- O painel geral deve aproveitar como referência visual e estrutural o painel administrativo atual da Super Sena, mantendo sua organização familiar e substituindo os indicadores antigos de jogos pelos indicadores correspondentes de cupons/vales. O conteúdo e os fluxos devem refletir a nova plataforma, sem manter funções antigas de jogo.
- O administrador geral pode consultar os cupons ganhadores e seus estados, inclusive os que estão próximos de atingir 20 dias sem resgate e os que expiraram aos 30 dias.
- O administrador geral pode acessar os dados de contato dos ganhadores para realizar o acompanhamento e registrar tentativas de contato, com acesso restrito e trilha de auditoria.
- O administrador geral não precisa visualizar senhas de administradores ou de maquininhas. Deve poder administrar contas por procedimentos seguros de redefinição de acesso.
- Um administrador de loja não pode acessar a administração geral nem os dados administrativos de outras lojas.

### 2.2 Administrador da loja

- Cada loja possui uma área administrativa própria, denominada simplesmente **Loja**, acessível pelo administrador do estabelecimento em celular ou outro dispositivo autorizado.
- O administrador da loja **não cria a própria conta**. O administrador geral cadastra a loja e cria/vincula o usuário administrador responsável por ela.
- O administrador da loja acompanha somente os dados e a operação do próprio estabelecimento.
- A área deve ser simples e objetiva, concentrada no acompanhamento em tempo real das maquininhas, na administração dos acessos operacionais e na transparência dos cupons e resultados.
- O administrador da loja pode cadastrar e administrar as maquininhas/caixas vinculados ao estabelecimento, criando os acessos que serão usados pelos funcionários diretamente nas maquininhas.
- O administrador da loja acompanha a quantidade de cupons emitidos por cada maquininha, o movimento do dia e os totais acumulados, com atualização em tempo real ou tão próxima disso quanto a arquitetura permitir.
- O administrador da loja consulta os cupons emitidos pelo estabelecimento, os cupons que participaram de lotes/sorteios gerais, os resultados dos cupons da loja e os prêmios pagos/resgatados.
- O administrador acompanha os valores devidos à plataforma, cobranças e pagamentos, sem poder alterar regras globais ou interferir nos sorteios.
- A área **Loja** deve exibir um contador de cupons do ciclo de cobrança atual, com o progresso até o limite liberado (por exemplo, 0/100, 65/100 e 100/100).
- Ao atingir o limite do ciclo (100 cupons, como referência), o sistema fecha a apuração daquele ciclo e gera automaticamente uma cobrança Pix com QR Code para o administrador pagar o percentual devido sobre os valores das compras associadas aos cupons daquele ciclo.
- Ao atingir o limite, novas emissões de cupons daquela loja ficam bloqueadas até que o pagamento da cobrança seja confirmado pelo webhook do provedor Pix. O painel deve mostrar a cobrança, o valor, o QR Code e a situação do pagamento.
- Após a confirmação válida do webhook, o sistema registra o pagamento, encerra o ciclo quitado e libera automaticamente a emissão de um novo ciclo, reiniciando o contador para o limite seguinte.
- O bloqueio é por loja: não impede outras lojas de emitir cupons e não bloqueia leitura ou resgate de cupons já emitidos.
- A área administrativa da loja não é a interface usada no caixa para registrar compras, emitir cupons ou resgatar prêmios. Essas tarefas pertencem à área operacional da maquininha (APK).
- O administrador da loja não acessa dados de outros estabelecimentos nem a administração geral.

### 2.3 APK, maquininhas e acessos operacionais

- O APK é livre e não fica permanentemente vinculado a uma loja ou a um equipamento específico. Pode ser instalado nas maquininhas compatíveis e permanecer pronto para uso por diferentes estabelecimentos.
- Uma maquininha pode ser deslocada de uma loja para outra. Para começar a operar no novo estabelecimento, basta sair da sessão anterior e entrar com um acesso operacional criado pelo administrador da nova loja.
- O administrador da loja cria, pelo seu painel **Loja**, acessível pelo próprio celular (iPhone ou Android) ou outro dispositivo, os acessos operacionais que serão utilizados nas maquininhas do estabelecimento.
- O administrador geral cria a loja e seu administrador, mas não cria maquininhas nem seus usuários operacionais.
- Cada loja pode criar a quantidade de acessos/maquininhas permitida pelo limite liberado pela plataforma. O sistema deve informar e aplicar esse limite; a quantidade máxima e a forma de sua configuração comercial/administrativa ainda serão definidas.
- As maquininhas recebem o APK previamente instalado. No estabelecimento, o funcionário só precisa entrar no APK com um dos acessos operacionais criados pelo administrador da loja para começar a trabalhar.
- Ao autenticar, o servidor identifica a loja à qual aquele acesso pertence e carrega as permissões e os recursos correspondentes. Ao sair da conta, o APK fica disponível para autenticação com outro acesso, inclusive de outra loja.
- A maquininha física não deve ficar presa a uma loja. O vínculo da operação é determinado pela conta autenticada, e não por uma associação permanente entre aparelho e estabelecimento.
- Mesmo com o APK livre, cada sessão e cada operação devem ser identificadas com segurança: loja, acesso operacional/funcionário, equipamento quando tecnicamente identificável, data/hora e ação realizada. Isso preserva a auditoria sem impedir a transferência do equipamento entre lojas.
- Cada emissão e cada resgate ficam associados à loja da conta autenticada e ao contexto operacional que realizou a ação.
- O administrador da loja pode administrar seus próprios acessos operacionais, inclusive desativá-los e redefinir suas senhas. Senhas não devem ser armazenadas em texto aberto nem disponibilizadas para leitura; deve existir redefinição segura.
- O acesso administrativo do dono da loja e os acessos operacionais usados no APK são distintos. O dono pode usar o próprio acesso operacional quando também trabalhar no caixa.
- As funções administrativas e as funções de emissão/resgate não devem ser misturadas em uma única área.

## 3. Registro de compras, percentual e emissão de cupons

- No momento da venda, o funcionário ou responsável informa na maquininha o valor da compra realizada pelo consumidor.
- O valor informado representa o valor integral da compra e fica associado ao cupom.
- A plataforma calcula o valor devido aplicando ao valor da compra o percentual individual configurado pelo administrador geral para a loja emissora.
- O administrador geral define livremente o percentual no formulário de cadastro da loja/administrador. Não há mínimo ou máximo comercial fixado pela regra do produto; a referência de 3% a 5% foi apenas uma hipótese inicial para começar o desenvolvimento e poderá mudar.
- Cada loja pode ter um percentual diferente. O administrador geral poderá alterar o percentual de uma loja ao longo do tempo.
- Cada cupom deve guardar uma cópia histórica do percentual efetivamente aplicado no momento da emissão, junto ao valor calculado devido. Alterações posteriores na configuração da loja só valem para cupons emitidos depois da alteração e nunca recalculam cupons anteriores ou cobranças já apuradas.
- Exemplo: compra de **R$ 100,00** com percentual configurado de **5%** gera **R$ 5,00** de valor devido pela loja à plataforma.
- Antes de emitir o cupom, a interface de caixa registra obrigatoriamente o valor da compra e permite informar opcionalmente o WhatsApp/contato do consumidor. Nome do consumidor não será solicitado. O contato opcional pode ajudar a localizar o ganhador caso ele perca o cupom ou não consulte o resultado.
- A maquininha emite um cupom individual com QR Code para o consumidor.
- O cupom registra, entre outros dados, o valor integral da compra, a loja, a maquininha/caixa, o funcionário responsável, a data/hora e um identificador único.
- O valor devido à plataforma não reduz o valor do prêmio. No exemplo, se o cupom for sorteado, o valor de referência do prêmio será **R$ 100,00**, e não R$ 5,00.
- A forma de entrega do prêmio — dinheiro ou mercadoria — é escolhida no fluxo de resgate da maquininha, conforme as regras comerciais habilitadas para o estabelecimento.
- Cada cupom deve ser individual e não pode ser duplicado.
- O contato do consumidor deve ficar associado ao cupom com proteção adequada, acesso restrito e finalidade limitada à comunicação sobre o resultado e o resgate do prêmio. O contato não deve ficar exposto publicamente na consulta do QR Code.

## 3.1. Estrutura persistente dos cupons e lotes

- O cupom promocional terá registro próprio, separado das entidades antigas de apostas, compras numéricas e rodadas.
- Cada cupom terá identificador interno, código público único para o QR Code, loja emissora, usuário operacional responsável, lote global, valor integral da compra, percentual histórico aplicado, valor devido à plataforma, WhatsApp opcional e datas de emissão/sorteio/resgate.
- O percentual aplicado será copiado da configuração da loja no instante da emissão. Alterações futuras no cadastro da loja não poderão recalcular o valor devido de cupons já emitidos.
- O valor devido será calculado em centavos, com arredondamento monetário definido no serviço de emissão e validado por testes.
- O lote global terá sequência única e estado próprio. O modelo persistente registra os cupons associados e o cupom vencedor; a regra de completar exatamente 100 cupons e sortear uma única vez deverá ser garantida por transação no servidor, com controle de concorrência e testes antes de liberar a emissão.
- Estados iniciais do cupom: ativo, premiado, resgatado e expirado. Estados do lote: aberto e sorteado.
- A criação destas entidades é apenas a fundação de dados. Ainda não implementa emissão, fechamento de lote, sorteio, consulta pública, impressão ou resgate.
- Cupons e lotes novos não devem utilizar as entidades Purchase, Round ou NumericParticipationLine do sistema antigo. O histórico antigo permanece preservado e isolado.

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

### 4.1 Transformação do mecanismo de sorteio existente

- O sistema atual possui um mecanismo antigo baseado em sorteio de seis números e modalidades/faixas como unidade, dezena, centena, milhar, quina e sena. Esse mecanismo será substituído pela nova regra promocional: **um ganhador a cada lote de 100 cupons da fila geral**.
- A mudança deverá partir de uma **refatoração limpa e planejada**, não de remendos. O objetivo é aproveitar o que comprovadamente funciona, mas deixar cada parte adaptada à sua responsabilidade nova, com arquitetura coerente, clara e sustentável.
- Não se deve preservar código antigo apenas por conveniência nem empilhar novas condições sobre uma lógica que foi criada para outro produto ou regra. Se um componente, serviço, módulo ou estrutura não puder ser adaptado de forma limpa, deverá ser substituído por uma implementação adequada, removendo-se depois o código antigo que ficar sem uso.
- É proibido deixar código morto, caminhos antigos ativos sem finalidade, funções duplicadas, regras conflitantes, compatibilidades provisórias sem prazo, desvios condicionais improvisados ou estruturas paralelas que confundam qual fluxo é o oficial.
- Não fazer “pontes”, gambiarras ou camadas temporárias para encaixar a nova promoção no sorteio antigo de seis números. A nova regra deve ter um fluxo de domínio consistente: fila geral, lotes de 100 cupons, um ganhador por lote e processamento automático no servidor.
- A decisão entre adaptar, refatorar profundamente ou substituir uma parte deverá ser tomada após inspecionar o código e suas dependências. Preservar o que funciona não significa manter uma arquitetura inadequada; criar uma estrutura nova é aceitável quando for a solução mais limpa.
- Toda substituição deverá incluir remoção segura do código obsoleto, atualização dos pontos que dependem dele e testes para confirmar que não restaram referências, rotas ou comportamentos antigos indevidos.
- Não se deve apagar o sistema existente indiscriminadamente nem reconstruir tudo do zero. A prioridade é uma transformação criteriosa, com cada parte reaproveitada ou substituída por razões técnicas claras.
- O mecanismo antigo de sorteio de seis números e suas modalidades deixa de ser a regra operacional da promoção. A lógica do servidor deverá ser adaptada para formar lotes sequenciais de 100 cupons e selecionar exatamente um cupom ganhador por lote.
- A execução do sorteio deve ocorrer no servidor, automaticamente quando o lote geral completar 100 cupons. A interface não deve simular o resultado nem depender de ação manual do administrador.
- A transformação deve resultar em uma estrutura lapidada, sem código morto, remendos ou regras antigas convivendo indevidamente com a nova promoção.
- Antes de qualquer alteração, deve-se inspecionar o fluxo atual de sorteio ponta a ponta: emissão/registro dos cupons, entrada na fila, serviço responsável pelo sorteio, persistência do resultado, consulta pública, painéis administrativos e resgate. A adaptação deve preservar as funcionalidades úteis e atualizar todos os pontos que dependem da regra antiga.
- A migração deve evitar perda de histórico. Registros históricos do mecanismo antigo devem ser preservados para consulta/auditoria, sem serem misturados aos novos lotes promocionais. A estratégia de compatibilidade e tratamento dos registros existentes deverá ser definida após a inspeção do banco e do código.
- A implementação deverá incluir testes para garantir: lote com exatamente 100 cupons; um único ganhador; mistura de lojas; disparo automático no servidor; nenhum sorteio antes do centésimo cupom; nenhum efeito de pagamentos/webhooks sobre o sorteio; e prevenção de lotes ou resultados duplicados.
- Nenhuma alteração deverá ser feita diretamente na branch `main`. O trabalho deverá ocorrer na branch de desenvolvimento definida para o projeto, com inspeção e commits incrementais.

## 5. Apuração financeira e pagamento devido por cada loja

- A emissão dos cupons e a participação dos consumidores na fila geral não dependem de pagamento prévio da loja.
- Para cada cupom emitido, a plataforma calcula e registra o valor devido pela loja emissora, aplicando o percentual comercial configurado ao valor integral da compra.
- A obrigação financeira permanece individualizada por estabelecimento, mesmo que os cupons de várias lojas sejam misturados nos mesmos lotes e sorteios.
- O sistema deve manter um extrato financeiro por loja, com quantidade de cupons emitidos, valores de compra associados, percentual aplicado, total devido, pagamentos recebidos, saldo em aberto e histórico.
- O painel da loja deve apresentar de forma clara o valor acumulado e devido à plataforma, com detalhamento e período de referência.
- O painel geral deve consolidar os mesmos dados de todas as lojas, permitindo identificar valores vencidos, pendentes e pagos.
- A plataforma deverá permitir gerar uma cobrança Pix com QR Code para que a loja pague os valores devidos.
- A cobrança por ciclo será gerada automaticamente quando a loja atingir o limite de cupons definido para ela (100 como referência inicial). O valor da cobrança será calculado pela soma dos valores devidos em cada cupom do ciclo, usando o percentual individual cadastrado para aquela loja. A cobrança e sua confirmação são recursos de apoio à apuração e ao registro financeiro; não condicionam a entrada dos cupons na fila, a formação dos lotes ou os sorteios.
- O sistema deve registrar cada cobrança com identificador próprio, loja devedora, valor, período ou cupons de referência, data de criação, vencimento quando definido e situação.
- A confirmação de pagamento poderá ser registrada por integração e webhook do provedor Pix. O webhook atualiza a situação financeira e a conciliação da loja, mas **não dispara sorteio nem libera lote**, pois os sorteios já acontecem automaticamente pela fila geral.
- Neste modelo, o webhook também é responsável por confirmar a quitação do ciclo de cobrança da loja e liberar novas emissões. Essa liberação é independente do mecanismo de sorteio: o webhook não inicia, pausa, repete ou altera sorteios; apenas atualiza o financeiro e o estado de bloqueio/liberação de novas emissões da loja.
- A loja não poderá continuar acumulando emissões indefinidamente sem pagar: ao atingir o limite do ciclo, novas emissões serão bloqueadas até a confirmação do pagamento pelo webhook. Cupons já emitidos permanecem válidos e participam dos sorteios gerais.
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
- **Regra separada de limite de emissão e cobrança:** além dos lotes gerais de sorteio de 100 cupons, cada loja possui seu próprio ciclo de cobrança, contado individualmente pelos cupons que ela emite. Ao completar o limite configurado para a loja (100 cupons como referência), o sistema fecha a apuração financeira daquele ciclo, gera a cobrança Pix e bloqueia novas emissões daquela loja até a confirmação do pagamento pelo webhook.
- Esse limite por loja não cria lote de sorteio exclusivo, não altera a fila geral e não condiciona sorteios ao pagamento. Os cupons já emitidos continuam participando normalmente dos lotes gerais, e os sorteios continuam automáticos mesmo enquanto a loja aguarda pagar a cobrança.

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
- Quantidade de cupons emitidos pela loja e sua situação na fila geral (aguardando completar lote, já sorteados ou premiados).
- Histórico de compras e cupons, identificando a maquininha/caixa e o funcionário responsável.
- Valores acumulados e percentual devido à plataforma.
- Histórico das cobranças e pagamentos da loja, com valores, datas e identificadores.
- Histórico dos sorteios gerais dos quais participaram cupons emitidos pela loja, incluindo o resultado do próprio cupom.
- Cadastro, situação e acessos das maquininhas/caixas vinculados à loja.
- Opção para consultar valores devidos e gerar QR Code Pix para pagamento.
- Contador do ciclo de cobrança atual, com quantidade de cupons emitidos em relação ao limite liberado para a loja.
- Cobrança Pix/QR Code gerada automaticamente quando o ciclo atinge o limite, com valor calculado pelo percentual individual da loja aplicado aos valores das compras daquele ciclo.
- Situação do pagamento e do bloqueio de novas emissões; após confirmação do webhook, indicação de que um novo ciclo foi liberado.

## 9. Painel do administrador geral

O painel do administrador geral deve manter como referência o painel administrativo atual da Super Sena, com organização visual familiar e bem acabada. A adaptação deve substituir os indicadores de jogos pelos indicadores da nova plataforma: cupons/vales emitidos, cupons premiados e demais situações relevantes. Não deve conservar telas ou funções de acompanhamento de rodadas e números sorteados, pois o novo produto funciona por cupons premiados.

### 9.1 Indicadores principais no topo

- Os indicadores mais importantes devem ficar em uma faixa de destaque no topo da página, fora dos menus, visíveis assim que o administrador entrar no painel.
- Mostrar, no mínimo, quantidade total de cupons/vales emitidos, quantidade de cupons premiados, quantidade de prêmios aguardando resgate, quantidade de prêmios resgatados e quantidade de prêmios expirados.
- Apresentar também o total de lojas cadastradas/ativas e os indicadores financeiros globais relevantes.
- Os números devem refletir o movimento geral da plataforma, com atualização em tempo real ou na menor latência tecnicamente viável.
- A interface deve ser organizada, clara e visualmente agradável, sem excesso de menus ou informações pouco úteis.

### 9.2 Administração das lojas e visão geral

- O administrador geral pode criar lojas e criar/vincular o respectivo administrador.
- Pode consultar, editar, ativar ou suspender lojas e administradores, conforme as permissões administrativas.
- Pode consultar o número de acessos/maquininhas criados por cada loja e o limite liberado para aquele estabelecimento, mas não criar esses acessos em nome da loja.
- Pode abrir o detalhe de cada estabelecimento para consultar cupons emitidos, cupons premiados, prêmios resgatados/expirados e situação financeira.
- Os dados devem permitir filtros por loja e período, mantendo também os totais globais.

### 9.3 Lista de cupons premiados e acompanhamento de ganhadores

- Os cupons premiados devem ficar disponíveis em uma área própria para consulta, sem exigir acompanhamento de números ou rodadas.
- A lista deve mostrar as informações necessárias para identificar o prêmio, como cupom, valor, loja de origem, data do sorteio, prazo final e situação atual.
- O administrador geral deve conseguir acompanhar os prêmios ainda não resgatados e registrar o andamento do contato com o ganhador.
- Ao completar **20 dias corridos** desde o sorteio sem resgate, o prêmio deve sair da lista comum de acompanhamento e entrar automaticamente em uma área destacada de **Urgência / Contato**, para que o administrador priorize a tentativa de localizar o ganhador.
- A área de urgência deve permitir consultar o contato fornecido na emissão, registrar tentativas de contato, datas, resultado e observações. O acesso a dados pessoais deve ser restrito e auditável.
- O prêmio continua válido durante os dias 21 a 30. A entrada na área de urgência não altera o prazo nem bloqueia o resgate.
- Ao completar **30 dias corridos** desde o sorteio sem resgate, o prêmio expira automaticamente, independentemente de o administrador ter conseguido contato com o ganhador.
- O administrador geral não pode estender o prazo nem dar baixa manual no prêmio.

### 9.4 Simplicidade do painel

- Não haverá necessidade de painel para acompanhar rodadas, números sorteados ou etapas manuais de sorteio. O administrador apenas consulta os cupons premiados e seus estados.
- O painel deve concentrar a operação em indicadores globais, gestão de lojas/administradores, visão financeira e acompanhamento dos prêmios, sem ferramentas desnecessárias.
- O administrador geral não cria maquininhas nem acessos operacionais; essa função pertence ao administrador de cada loja, na área **Loja**.

## 10. Consulta do QR Code, comunicação e prazo do prêmio

- A leitura do QR Code por um celular comum ou navegador serve **somente para consultar o resultado**: informa se o cupom foi premiado ou não e, se foi, apresenta o valor do prêmio e a orientação para resgatá-lo em um estabelecimento credenciado.
- Na consulta pública do QR Code não haverá botão para iniciar resgate, confirmar recebimento, solicitar saque ou executar qualquer outra ação.
- A mensagem para o ganhador deve orientar: **“Dirija-se preferencialmente à loja onde você recebeu este cupom para resgatar seu prêmio.”** A orientação favorece o estabelecimento que emitiu o cupom, mas não restringe o resgate a ele.
- O prêmio poderá ser resgatado em qualquer estabelecimento credenciado que possua maquininha com o aplicativo autorizado para leitura e resgate. O estabelecimento de origem é recomendado, não obrigatório.
- A consulta pública não deve exibir telefone nem outros dados pessoais do consumidor.
- O contato informado na emissão fica vinculado ao cupom, protegido e com acesso restrito, para que a plataforma possa localizar e avisar o ganhador caso ele não procure o resgate.
- O prazo para resgatar começa no momento em que o sorteio é realizado. O prêmio fica disponível por **30 dias corridos**.
- Ao completar 30 dias sem resgate, o prêmio muda automaticamente para **expirado**. A expiração ocorre exclusivamente por regra automática do sistema, sem ação ou autorização manual de qualquer administrador.
- Ao completar **20 dias corridos** desde o sorteio sem resgate, o prêmio deve ser movido automaticamente para a área de **Urgência / Contato** do administrador geral. Ele permanece válido até completar 30 dias.
- Ao completar **30 dias corridos** sem resgate, o prêmio expira automaticamente, mesmo que nenhuma tentativa de contato tenha sido realizada ou que o ganhador não tenha respondido.
- Na consulta pública de um QR Code expirado, deve aparecer uma mensagem clara informando que o prêmio ficou disponível por 30 dias para retirada e que o prazo terminou. A mensagem poderá informar que a plataforma tentou contato sem sucesso somente quando houver registro real de tentativa(s) de contato sem resposta; o sistema não deve afirmar uma tentativa que não aconteceu.
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
3. Cada cupom deve estar vinculado a uma compra, loja, maquininha/caixa e emissão; depois, deve ser atribuído uma única vez a um lote geral.
4. A entrada do centésimo cupom válido na fila geral fecha o lote e dispara o sorteio automático no servidor, sem depender de pagamento.
5. A confirmação Pix por webhook atualiza somente o financeiro da loja e não pode liberar, iniciar, interromper ou repetir sorteios.
6. O processamento da fila e dos sorteios deve ser idempotente: eventos repetidos não podem duplicar lotes ou resultados.
7. Cada lote deve conter exatamente 100 cupons da fila geral, podendo reunir cupons de diferentes lojas, e gerar exatamente um ganhador.
8. Deve existir trilha de auditoria para emissões, entrada na fila, composição dos lotes, sorteios, cobranças, pagamentos, bloqueios e resgates.
9. O administrador de uma loja não pode acessar dados de outra loja nem executar ações na administração geral.

## 14. Exemplo ilustrativo do fluxo

1. Um supermercado possui cinco caixas, cada um com uma maquininha e credenciais próprias.
2. Em cada caixa, o funcionário registra o valor da compra e emite o cupom com QR Code.
3. O cupom entra imediatamente na fila geral, junto com os cupons das demais lojas.
4. Quando a fila geral completa 100 cupons, o servidor fecha o lote e realiza automaticamente um sorteio com um ganhador.
5. A plataforma calcula e registra separadamente o valor devido pelo supermercado e disponibiliza a cobrança Pix.
6. Quando o supermercado paga, o webhook atualiza seu extrato financeiro, sem interferir no sorteio já realizado ou nos próximos.
7. Se a loja ficar inadimplente, poderá ser bloqueada para novas emissões conforme política definida, mas os cupons já emitidos continuam participando normalmente.

## 16. Área operacional da maquininha (APK)

A maquininha terá uma área operacional própria para registrar compras, emitir cupons, consultar QR Codes e resgatar prêmios. Essa área deverá ser construída a partir da inspeção e adaptação da atual área do cambista, especialmente dos objetos e recursos que já funcionam, como a leitura/escaneamento de QR Code. O reaproveitamento deverá seguir a diretriz de refatoração limpa da seção 4.1: não manter código incompatível nem criar remendos.

### 16.1 Registro da compra e emissão do cupom

- A tela de registro da maquininha terá somente dois campos de entrada:
  1. **Valor da compra** — obrigatório.
  2. **WhatsApp/contato do consumidor** — opcional.
- Não haverá campo para nome do consumidor.
- O campo de valor deverá aceitar reais e centavos, com formatação monetária correta e validação para impedir valores inválidos ou vazios.
- A interface deverá ser projetada para a tela comprida da maquininha: valor em destaque na parte superior e teclado numérico grande na parte inferior, com distância e espaçamento suficientes para que o teclado não cubra o valor digitado.
- A disposição deve facilitar a leitura e reduzir erros de digitação. O valor deverá permanecer claramente visível durante a digitação.
- O contato deverá aceitar um número de WhatsApp/telefone, mas sua ausência não impedirá a emissão.
- Depois de informar o valor, o operador usa o botão **Confirmar**. A tela apresenta o valor da compra em tamanho grande para conferência antes da impressão.
- Após a conferência, o operador usa o botão **Imprimir**. O sistema gera o QR Code individual, apresenta o cupom/QR Code na tela da própria maquininha e envia o mesmo cupom para a impressora térmica.
- A versão exibida na tela e a versão impressa devem ser espelhos uma da outra, conforme a especificação visual dos dois recibos registrada separadamente no projeto.
- A emissão deve manter o identificador interno único do cupom, mesmo que esse número não apareça visualmente no recibo.
- A operação registra valor da compra, contato se fornecido, loja, maquininha, funcionário e data/hora, e insere o cupom na fila geral de sorteio conforme as regras da seção 4.

### 16.2 Leitura do QR Code e consulta do resultado

- A área operacional terá um botão visível para **Ler QR Code** ou **Escanear QR Code**.
- O recurso de leitura existente na atual área do cambista deverá ser inspecionado e, se tecnicamente adequado, migrado/adaptado para a área da maquininha, preservando sua capacidade comprovada de leitura.
- Após a leitura, o APK consulta o servidor e apresenta o resultado do cupom, indicando claramente se está premiado, não premiado, expirado ou já resgatado.
- Quando o cupom estiver premiado e válido, a tela apresenta o valor do prêmio e a ação **Sacar**.
- O botão **Sacar** só deve estar disponível para prêmio válido, ainda não resgatado e dentro do prazo.

### 16.3 Resgate e baixa do prêmio

- Ao pressionar **Sacar**, o APK abre uma janela com duas opções mutuamente exclusivas: **Mercadoria** e **Dinheiro**.
- O operador seleciona somente uma das modalidades, conforme as opções habilitadas para a loja.
- A confirmação da modalidade escolhida conclui o registro do resgate no servidor. A operação deve registrar a modalidade, o valor, o cupom/prêmio, a loja que realizou o resgate, a maquininha, o funcionário/responsável e data/hora, mantendo a trilha de auditoria definida nas seções 11 e 13.
- A conclusão deve dar baixa definitiva no prêmio e atualizar seu estado para **resgatado/pago** no sistema.
- Uma nova leitura do mesmo QR Code, em qualquer maquininha credenciada, deverá informar que o prêmio já foi resgatado e não poderá oferecer novamente o botão **Sacar**.
- O servidor deve garantir atomicidade e impedir dois resgates simultâneos ou duplicados do mesmo prêmio.
- O fluxo de resgate deve continuar respeitando as regras financeiras e de liquidação descritas na seção 11.3. A escolha na interface não deve ser tratada como prova de que a entrega ou transferência financeira foi concluída sem o registro correspondente.

### 16.4 Reaproveitamento da área atual do cambista

- A área atual do cambista é a principal referência para construir a área operacional da maquininha, pois já contém objetos e recursos usados pelo sistema, incluindo o mecanismo de escaneamento do QR Code.
- Antes de implementar, deve-se mapear quais componentes, telas, serviços e permissões do cambista são realmente reutilizáveis.
- Os elementos compatíveis devem ser migrados ou refatorados para a nova área operacional, com nomes, responsabilidades e fluxo coerentes com a função de maquininha.
- Elementos exclusivos do antigo fluxo de cambista que não tenham função na promoção devem ser removidos do novo fluxo e, quando deixarem de ser usados em todo o sistema, eliminados com segurança.
- Não se deve simplesmente renomear a área antiga nem manter funcionalidades de cambista escondidas. A área final deve representar claramente as tarefas da maquininha: registrar compra, emitir/imprimir cupom, ler QR Code e resgatar prêmio.

## 17. Área administrativa da loja

A área administrativa do estabelecimento será identificada simplesmente como **Loja**. Ela será uma área enxuta, voltada ao acompanhamento do funcionamento das maquininhas e à gestão dos acessos operacionais.

### 17.1 Criação e acesso do administrador da loja

- O administrador geral é quem cadastra o estabelecimento e cria/vincula seu usuário administrador.
- O administrador da loja recebe as credenciais de acesso à área **Loja** e administra somente o próprio estabelecimento.
- O administrador da loja não pode criar outra loja nem promover a própria conta a administrador geral.

### 17.2 Painel de movimento das maquininhas

- A tela principal deve apresentar um painel simples com o movimento das maquininhas vinculadas à loja.
- Deve mostrar cada maquininha individualmente, sua identificação, situação operacional e quantidade de cupons emitidos no dia.
- Deve apresentar totais da loja, como quantidade total de cupons emitidos no dia e acumulado do período selecionado.
- Os indicadores devem atualizar em tempo real ou com a menor latência tecnicamente viável, para que o administrador acompanhe o movimento enquanto as maquininhas trabalham.
- O administrador deve conseguir consultar o histórico de produção por maquininha e comparar o movimento entre os equipamentos.
- A interface deve deixar claro de qual maquininha veio cada cupom, evitando apresentar apenas totais sem origem.

### 17.3 Cadastro e administração de maquininhas

- A área **Loja** terá uma opção/menu para cadastrar uma nova maquininha ou caixa.
- Ao cadastrar, o administrador cria um acesso operacional com login e senha para uso no APK instalado naquele equipamento.
- O cadastro deve permitir identificar cada equipamento de forma simples, por exemplo: **Maquininha 1**, **Maquininha 2**, **Maquininha 3**, ou por um nome/identificação escolhido pela loja.
- O administrador poderá consultar a lista de maquininhas, identificar quais estão ativas, editar sua identificação, desativar um acesso e redefinir a senha quando necessário.
- A criação de acessos deve ser simples e adequada à rotina de funcionários de loja.
- A decisão técnica entre credencial individual por equipamento ou credencial compartilhada ficará para a etapa de arquitetura. A recomendação funcional é manter uma identidade por maquininha, para que a produção e as operações possam ser auditadas por equipamento.
- Senhas não devem ser armazenadas em texto aberto. O administrador poderá redefinir/gerar uma nova senha e repassá-la ao funcionário, em vez de consultar a senha antiga em texto legível.

### 17.4 Menus de cupons, sorteios e prêmios

A área **Loja** terá menus simples para dar transparência ao movimento do estabelecimento:

- **Cupons emitidos:** lista dos cupons gerados pela loja, com data/hora, valor da compra, maquininha de origem e situação.
- **Sorteios:** lista dos lotes gerais dos quais participaram cupons da loja, com identificação do lote, data do sorteio e resultado relevante para os cupons emitidos pelo estabelecimento.
- **Cupons premiados:** relação dos cupons da loja que foram sorteados como ganhadores, com valor do prêmio, situação e prazo de resgate.
- **Prêmios resgatados/pagos:** histórico dos prêmios originados em cupons da loja que já foram resgatados, incluindo a modalidade registrada e a loja credenciada que realizou o resgate.
- **Financeiro:** resumo do percentual devido à plataforma, valores acumulados, cobranças e pagamentos da própria loja.

### 17.5 Limites e simplicidade da área

- O administrador da loja não precisa de ferramentas para controlar a fila geral, formar lotes ou iniciar sorteios. Essas operações são automáticas no servidor.
- O administrador da loja não pode alterar resultados, escolher ganhadores, dar baixa manual em prêmios ou acessar dados de outros estabelecimentos.
- A área não deve acumular ferramentas administrativas desnecessárias. O foco é acompanhar as maquininhas, administrar seus acessos e consultar os registros da própria loja.
- A construção deverá priorizar a adaptação/refatoração de componentes existentes que sejam compatíveis, sem manter funcionalidades antigas sem uso ou criar remendos. A arquitetura final deve seguir a diretriz de código limpo registrada na seção 4.1.

## 15. Pontos que ainda precisam ser definidos

- Como será apresentada no painel a edição do percentual individual da loja e a data de início de vigência de cada alteração.
- Prazos de vencimento, periodicidade de apuração e condições de pagamento das lojas.
- Regras comerciais e contratuais de cobrança, garantias e consequências para inadimplência.
- Critérios objetivos para alertas, suspensão temporária e bloqueio de novas emissões por loja inadimplente, incluindo quem pode aplicar e retirar o bloqueio.
- Como registrar pagamentos parciais, acordos, renegociações, estornos e divergências nos valores devidos.
- Qual provedor Pix será utilizado e como ocorrerá a conciliação automática por webhook. O webhook não terá função de disparar sorteios.
- Como garantir financeiramente a entrega dos prêmios sorteados, inclusive quando a loja de origem ainda não tiver pago à plataforma e quando o prêmio for resgatado em outra loja.
- Como será feito o procedimento técnico do sorteio, a geração de aleatoriedade verificável e a comprovação do resultado.
- Como será liquidada financeiramente a transferência Pix do resgate e como será feita a conciliação entre a plataforma e a loja.
- Definir os canais, a frequência e os modelos de mensagem usados no contato com ganhadores que entram na área de urgência aos 20 dias, incluindo como registrar tentativas e respostas.
- Como será validado o acesso ao link individual de recuperação do QR Code e por quanto tempo esse link ficará disponível.
- Como tratar tecnicamente uma contestação de resgate sem permitir duplicidade ou baixa manual.
- Revisão jurídica do modelo de promoção, da fila compartilhada, dos compromissos com consumidores e dos acordos comerciais com os estabelecimentos.

---

**Observação de escopo:** este documento registra as regras e decisões discutidas para orientar o manual e a futura especificação. Não altera o banco de dados, as telas, os pagamentos ou o funcionamento do sistema. A implementação só deverá começar depois da revisão e aprovação da documentação.
