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
- A plataforma não coleta nem mantém dados de contato dos consumidores/ganhadores. O administrador geral consulta os registros e estados dos cupons, sem contato ativo com ganhadores.
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
- O administrador da loja pode gerar uma cobrança Pix a qualquer momento, inclusive após emitir apenas um cupom. A cobrança inclui exatamente os cupons pendentes vinculados a ela e soma os valores devidos desses cupons.
- Ao atingir o limite de cupons ainda não quitados (100 como referência), novas emissões daquela loja ficam bloqueadas até que uma cobrança seja paga e confirmada pelo webhook do provedor Pix. O painel deve mostrar os cupons pendentes, o valor, o QR Code e a situação do pagamento.
- Após a confirmação válida do webhook, somente os cupons vinculados àquela cobrança são considerados quitados. A loja pode gerar uma nova cobrança para os cupons pendentes seguintes; o contador financeiro considera apenas cupons ainda não quitados.
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
- Antes de emitir o cupom, a interface registra exclusivamente o valor da compra. Não solicita nome, telefone, WhatsApp nem qualquer dado de contato do consumidor.
- A maquininha emite um cupom individual com QR Code para o consumidor.
- O cupom registra, entre outros dados, o valor integral da compra, a loja, a maquininha/caixa, o funcionário responsável, a data/hora e um identificador único.
- O valor devido à plataforma não reduz o valor do prêmio. No exemplo, se o cupom for sorteado, o valor de referência do prêmio será **R$ 100,00**, e não R$ 5,00.
- O prêmio terá exatamente duas opções na maquininha após a leitura de um QR Code premiado e válido: **Saque para a loja**, com transferência Pix automática para a chave pré-cadastrada da loja e registro de que o consumidor recebeu mercadoria; ou **Transferência Pix para o cliente**, com chave informada na maquininha e pagamento direto ao consumidor pela plataforma. As opções são mutuamente exclusivas. Não haverá uma terceira opção nem escolha administrativa prévia da modalidade.
- Cada cupom deve ser individual e não pode ser duplicado.
- Nenhum telefone, WhatsApp ou contato do consumidor será coletado, armazenado ou utilizado pela plataforma.

## 3.1. Estrutura persistente dos cupons e lotes

- O cupom promocional terá registro próprio, separado das entidades antigas de apostas, compras numéricas e rodadas.
- Cada cupom terá identificador interno, código público único para o QR Code, loja emissora, usuário operacional responsável, lote global, valor integral da compra, percentual histórico aplicado, valor devido à plataforma, datas de emissão/sorteio/resgate e prazo de resgate.
- O percentual aplicado será copiado da configuração da loja no instante da emissão. Alterações futuras no cadastro da loja não poderão recalcular o valor devido de cupons já emitidos.
- O valor devido será calculado em centavos, com arredondamento monetário definido no serviço de emissão e validado por testes.
- O lote global terá sequência única e estado próprio. O modelo persistente registra os cupons associados e o cupom vencedor; a regra de completar exatamente 100 cupons e sortear uma única vez deverá ser garantida por transação no servidor, com controle de concorrência e testes antes de liberar a emissão.
- Estados iniciais do cupom: ativo, premiado, resgatado e expirado. Estados do lote: aberto e sorteado.
- A criação destas entidades é apenas a fundação de dados. Ainda não implementa emissão, fechamento de lote, sorteio, consulta pública, impressão ou resgate.
- Cupons e lotes novos não devem utilizar as entidades Purchase, Round ou NumericParticipationLine do sistema antigo. O histórico antigo permanece preservado e isolado.

### 3.2 Idempotência da emissão

- Cada solicitação de emissão deverá apresentar uma chave de idempotência única, gerada pelo cliente operacional para aquela tentativa de compra.
- O banco garante unicidade dessa chave em `Coupon`. Repetir uma solicitação por falha de rede ou reenvio não poderá criar um segundo cupom nem inserir uma segunda participação na fila global.
- A chave deve ser persistida junto com o cupom na mesma transação da emissão. Em uma repetição com a mesma chave, o serviço deverá recuperar e devolver o cupom já criado, sem recalcular sua comissão, alterar seu lote ou disparar outro sorteio.
- A chave deve ser vinculada ao contexto autenticado da loja/operador; não poderá ser usada para consultar ou recuperar cupom de outra loja.
- Registros antigos, se existirem antes da ativação da emissão, recebem uma chave técnica de legado durante a migração. Novas emissões devem sempre fornecer uma chave própria.
- A unicidade no banco é a última barreira contra duplicidade; validações apenas na interface ou na aplicação não são suficientes.

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
- A cobrança do ciclo financeiro é individual por loja e soma os valores devidos dos cupons daquele ciclo. A loja pode gerar e pagar a cobrança antecipadamente, mesmo antes de completar 100 cupons. Ao atingir 100 cupons ainda não quitados, novas emissões daquela loja são bloqueadas até a confirmação do pagamento. Esse controle financeiro é independente da fila global e dos lotes de sorteio; não condiciona a entrada de cupons na fila, a formação dos lotes ou os sorteios.
- O sistema deve registrar cada cobrança com identificador próprio, loja devedora, valor, período ou cupons de referência, data de criação, vencimento quando definido e situação.
- A confirmação de pagamento poderá ser registrada por integração e webhook do provedor Pix. O webhook atualiza a situação financeira e a conciliação da loja, mas **não dispara sorteio nem libera lote**, pois os sorteios já acontecem automaticamente pela fila geral.
- Neste modelo, o webhook também é responsável por confirmar a quitação do ciclo de cobrança da loja e liberar novas emissões. Essa liberação é independente do mecanismo de sorteio: o webhook não inicia, pausa, repete ou altera sorteios; apenas atualiza o financeiro e o estado de bloqueio/liberação de novas emissões da loja.
- A loja não poderá continuar acumulando emissões indefinidamente sem pagar: ao atingir 100 cupons não quitados no controle financeiro individual, novas emissões serão bloqueadas até a confirmação do pagamento. A loja pode, porém, gerar a cobrança e quitá-la antes desse limite. Cupons já emitidos permanecem válidos e participam dos sorteios gerais.
- A cobrança e o acompanhamento de inadimplência serão uma atividade administrativa e comercial conduzida pelo responsável pela plataforma, fora da lógica automática de sorteios. O aplicativo fornece os dados, cálculos, extratos, cobranças e indicadores necessários para apoiar essa administração.

### 5.1 Separação obrigatória entre lotes de sorteio e lotes de cobrança

Existem **dois controles independentes**, que não podem compartilhar a mesma contagem, composição, identificador de lote, estado ou regra de fechamento:

**A. Lotes de sorteio — fila global da plataforma**
- Existe uma única fila global, compartilhada por todas as lojas.
- Cada cupom válido entra imediatamente na fila global quando é emitido, sem depender de pagamento da loja.
- A cada 100 cupons da fila global, o servidor fecha um lote de sorteio e realiza automaticamente um sorteio individual, com exatamente um ganhador.
- Um lote de sorteio pode conter cupons de várias lojas. Não existe exigência de 100 cupons da mesma loja.
- O pagamento, a cobrança, a inadimplência ou o bloqueio de uma loja não podem iniciar, adiar, cancelar, alterar ou impedir qualquer sorteio. Cupons já emitidos continuam participando normalmente.

**B. Lotes/ciclos de cobrança — controle individual de cada loja**
- Cada loja possui sua própria contagem financeira de cupons emitidos. Essa contagem não é a fila global e não corresponde aos lotes de sorteio.
- Para cada cupom emitido pela loja, o sistema registra o valor devido à plataforma com base no percentual daquela loja e no snapshot gravado no cupom.
- A loja pode solicitar e pagar uma cobrança Pix a qualquer momento, inclusive depois de emitir apenas um cupom. O painel deve permitir gerar o QR Code de pagamento antes de chegar a 100 cupons.
- Quando a loja completa 100 cupons ainda não quitados nesse controle financeiro, fecha-se um ciclo de cobrança daquela loja, calculado pela soma dos valores devidos dos cupons que o compõem.
- Ao atingir 100 cupons sem quitação, a emissão de novos cupons fica bloqueada **somente para aquela loja** até a confirmação do pagamento devido. O bloqueio não afeta outras lojas, cupons já emitidos, consultas, resgates, a fila global nem os sorteios.
- Após a confirmação autêntica do pagamento, o sistema registra a quitação e libera novas emissões para a loja. A contagem financeira inicia o próximo ciclo, sem alterar ou reabrir lotes de sorteio.
- A cobrança pode ser gerada antes do limite; o limite de 100 é a trava máxima de emissão sem quitação, não uma condição para permitir o pagamento.
- Cada cobrança deve ter referência própria e vínculo explícito à loja e aos cupons/valores quitados. Evitar cobranças duplicadas para os mesmos valores.
- A baixa de pagamento via webhook/consulta/reconciliação atualiza exclusivamente o financeiro e a permissão de emissão da loja. **Nunca dispara nem condiciona sorteio.**

**Regra de implementação:** os lotes globais de sorteio e os ciclos/lotes financeiros por loja devem ser entidades ou controles logicamente separados. Não reutilizar o mesmo contador ou registro para representar os dois processos. A conclusão de um lote de sorteio não fecha a cobrança de uma loja; a conclusão ou quitação de uma cobrança não fecha nem libera um lote de sorteio.

---

## 6. Formação automática dos lotes e processamento dos sorteios

- O evento que dispara a formação e o sorteio de um lote é a entrada do centésimo cupom válido na fila geral, e não um pagamento Pix.
- Ao completar 100 cupons, o servidor deve registrar o lote, congelar sua composição e executar automaticamente o sorteio correspondente.
- O sistema deve manter a ordem de entrada dos cupons e garantir que cada cupom seja atribuído uma única vez a um único lote.
- O sorteio deve ser independente para cada lote de 100 cupons, mesmo quando os participantes forem originários de várias lojas.
- O processamento deve ser confiável e idempotente: falhas, repetições de eventos ou reinicializações não podem gerar dois resultados para o mesmo lote nem deixar um lote completo sem processamento.
- Cada lote deve guardar os 100 cupons participantes, a loja de origem de cada um, o resultado, a data/hora, a versão do procedimento de sorteio e os registros técnicos necessários para auditoria.
- O pagamento de uma loja, a geração de uma cobrança Pix ou a confirmação de um webhook não inicia, interrompe, altera ou repete um sorteio.
- A inadimplência de qualquer estabelecimento não pode impedir o sorteio de um lote completo nem alterar a participação de um consumidor.
- **Regra separada de limite de emissão e cobrança:** além dos lotes gerais de sorteio de 100 cupons, cada loja possui seu próprio controle financeiro, contado individualmente pelos cupons ainda não quitados. O administrador pode gerar uma cobrança Pix a qualquer momento; ao completar o limite configurado (100 cupons como referência) sem quitação, novas emissões daquela loja são bloqueadas até a confirmação do pagamento pelo webhook.
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
- O administrador geral pode consultar os prêmios ainda não resgatados e seus prazos, sem dados pessoais do consumidor e sem opção de contato.
- O prêmio fica disponível para resgate pelo consumidor durante **30 dias corridos** desde o sorteio.
- Durante esse prazo, o painel acompanha o estado e a contagem regressiva, sem tentar localizar o ganhador.
- Ao completar **30 dias corridos** sem resgate, o sistema retira o direito de resgate do consumidor e muda automaticamente o prêmio para **DISPONÍVEL PARA A LOJA**, liberando o saque exclusivamente ao administrador da loja emissora.
- O administrador geral não pode estender o prazo, cancelar o prêmio, sacar ou dar baixa nele.

### 9.4 Simplicidade do painel

- Não haverá necessidade de painel para acompanhar rodadas, números sorteados ou etapas manuais de sorteio. O administrador apenas consulta os cupons premiados e seus estados.
- O painel deve concentrar a operação em indicadores globais, gestão de lojas/administradores, visão financeira e acompanhamento dos prêmios, sem ferramentas desnecessárias.
- O administrador geral não cria maquininhas nem acessos operacionais; essa função pertence ao administrador de cada loja, na área **Loja**.

## 10. Consulta do QR Code, comunicação e prazo do prêmio

- A leitura do QR Code por um celular comum ou navegador serve **somente para consultar o resultado**: informa se o cupom foi premiado ou não e, se foi, apresenta o valor do prêmio e a orientação para resgatá-lo em um estabelecimento credenciado.
- Na consulta pública do QR Code não haverá botão para iniciar resgate, confirmar recebimento, solicitar saque ou executar qualquer outra ação.
- A mensagem para o ganhador deve orientar: **“Dirija-se preferencialmente à loja onde você recebeu este cupom para resgatar seu prêmio.”** A orientação favorece o estabelecimento que emitiu o cupom, mas não restringe o resgate a ele.
- O prêmio só poderá ser resgatado na loja emissora do cupom. A maquininha que realiza o resgate deve estar autenticada em um acesso operacional vinculado à mesma loja emissora.
- A consulta pública não deve exibir telefone nem outros dados pessoais do consumidor.
- A plataforma não coleta dados de contato do consumidor e não realiza comunicação ativa com ganhadores.
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
- Após a leitura, o APK consulta o servidor e apresenta a situação do prêmio e sua validade. Se estiver premiado, válido e ainda não pago, apresenta exatamente as duas opções da seção 11.3: **Saque para a loja** ou **Transferência Pix para o cliente**.
- **A leitura do QR Code impresso e a leitura da segunda via digital levam ao mesmo fluxo de resgate**, sem diferença de permissões ou de valor.
- **Somente uma maquininha autenticada na loja emissora poderá concluir o resgate do cupom**, e o servidor deverá conferir esse vínculo antes de aceitar a operação.
- Não haverá mensagens ou contato ativo da plataforma com o ganhador. Durante os 30 dias, o consumidor pode resgatar presencialmente somente na loja emissora; após esse prazo, somente o administrador dessa mesma loja pode sacar o prêmio liberado por Pix automático para a chave cadastrada da loja.
- O servidor deve validar automaticamente se o prêmio está ativo, dentro do prazo e ainda não resgatado. Não haverá necessidade de autorização em tempo real do administrador geral ou do dono da loja.
- A operação fica vinculada à loja emissora (que obrigatoriamente também é a loja que realiza o resgate), à maquininha, ao funcionário, ao prêmio, à modalidade e ao valor.

### 11.3 Duas opções de pagamento após a leitura do QR Code premiado

Depois de validar que o cupom está premiado, dentro do prazo e ainda não foi resgatado, o APK deve apresentar o valor do prêmio e **exatamente duas opções**:

1. **Saque para a loja**
   - O sistema transfere automaticamente o valor do prêmio para a chave Pix da própria loja, previamente cadastrada e validada.
   - O operador não digita a chave da loja. A tela mostra o valor e os dados de destino mascarados; o operador apenas pressiona **Confirmar**.
   - Essa opção representa que o consumidor recebeu mercadorias da loja. O sistema registra a modalidade como **mercadoria**, embora a liquidação financeira da plataforma seja uma transferência Pix para a loja.
   - O pagamento não deve ser descrito como Pix ao consumidor: o destino da transferência é a loja.

2. **Transferência Pix para o cliente**
   - O operador informa na maquininha a chave Pix do consumidor e o tipo da chave (CPF/CNPJ, telefone, e-mail ou aleatória).
   - Antes da confirmação, o APK mostra o valor do prêmio e os dados de destino mascarados para conferência.
   - Após a confirmação, a plataforma executa a transferência diretamente para a chave Pix informada. O dinheiro não passa pela conta da loja.
   - Essa opção representa pagamento em dinheiro ao consumidor e deve ser registrada como **Pix direto ao cliente**.

As opções são mutuamente exclusivas. Não existe uma opção separada para o operador marcar “mercadoria” ou “dinheiro”, nem uma escolha prévia do administrador da loja. A opção escolhida no APK define o destino do Pix e a classificação do resgate.

O servidor deve validar o cupom, prazo, loja emissora, operador, permissões e estado financeiro. A baixa definitiva só ocorre depois da confirmação confiável do provedor Pix. Para ambas as modalidades, registrar tentativa persistente e idempotente antes de chamar o provedor; tratar timeouts e estados ambíguos por consulta e conciliação; e nunca repetir uma transferência incerta sem verificar a anterior. O mesmo prêmio não pode ser liquidado pelas duas opções nem gerar transferências duplicadas.

A auditoria registra modalidade, cupom/prêmio, valor, loja emissora, operador, maquininha, horário, destino mascarado, provedor e identificador externo da transferência. A chave Pix completa e segredos não podem aparecer em telas de auditoria ou logs.

Se o operador cancelar antes de confirmar, nenhuma transferência é solicitada e o prêmio permanece disponível. Se a transferência ficar pendente ou ambígua, o prêmio permanece em processamento até conciliação. Depois da confirmação do pagamento e da baixa, uma nova leitura informa que o prêmio já foi pago e não oferece novamente as opções.

A origem dos recursos, tarifas, limites, saldo/garantia e conciliação dos dois tipos de transferência devem ser definidos na integração financeira. A existência de API de cobrança Pix não comprova que a transferência de saída esteja disponível.

### 11.4 Prazo de 30 dias e transferência do direito de resgate à loja de origem

- A emissão do cupom não solicita nem armazena telefone, WhatsApp, nome ou qualquer outro contato do consumidor. Não haverá contato ativo com ganhadores, mensagens, links de recuperação ou segunda via digital enviada pela plataforma.
- O prazo de resgate pelo consumidor é de **30 dias corridos**, contado a partir da data e hora em que o sorteio daquele cupom for concluído e o prêmio for registrado.
- Durante esses 30 dias, o consumidor só poderá resgatar o prêmio na própria loja que emitiu o cupom vencedor, apresentando o cupom/QR Code e comparecendo presencialmente. Nenhuma outra loja credenciada poderá consultar para pagamento, autorizar, entregar ou liquidar esse prêmio.
- Se o consumidor não resgatar dentro do prazo, o prêmio deixa de estar disponível para ele. O sistema deverá alterar automaticamente o estado para **DISPONÍVEL PARA A LOJA**, sem apagar o histórico nem o registro do ganhador.
- A partir dessa mudança, somente o administrador autenticado da **loja que emitiu o cupom vencedor** poderá solicitar o saque do valor para a própria loja, por uma opção específica na área administrativa da loja.
- O administrador geral não poderá sacar, cancelar, transferir, editar o ganhador ou dar baixa nesse prêmio. A área geral poderá apenas consultar o histórico e o estado, sem ação de saque ou cancelamento.
- O direito da loja de origem só é liberado depois de completados os 30 dias. Antes disso, a loja não pode sacar nem reservar o prêmio em nome próprio.
- Cada loja deverá manter uma chave Pix de recebimento cadastrada e validada em seu próprio cadastro financeiro. A chave e os dados do titular devem ser armazenados de forma protegida; telas e logs devem exibir apenas dados mascarados quando possível. Alterações da chave exigem autenticação reforçada, validação e trilha de auditoria.
- O saque da loja será automático via Pix, usando a mesma integração de transferência Pix já adotada pelo fluxo de saque/pagamento de prêmios da plataforma, adaptada para identificar a loja como beneficiária. Não será uma solicitação para pagamento manual.
- O saque deve usar uma referência/idempotency key única e estável por cupom/prêmio, registrar a tentativa antes de chamar o provedor, consultar/reconciliar estados ambíguos e nunca repetir uma transferência sem verificar a anterior. O provedor deve confirmar a liquidação antes de marcar o prêmio como pago.
- O registro financeiro e a auditoria devem identificar o cupom vencedor, lote global, loja emissora/beneficiária, valor integral do prêmio, chave Pix mascarada, titular validado, administrador solicitante, horário, provedor, identificador da transferência, estado/resposta do provedor e resultado final. Não registrar chave Pix completa nem segredos em logs.
- Uma repetição da solicitação, webhook ou rotina de conciliação não poderá gerar um segundo pagamento. Se o resultado da transferência for incerto, o prêmio permanece em processamento até reconciliação; não se cria uma nova transferência automaticamente sem confirmação de que a anterior não foi executada.
- Depois que a loja concluir o saque, o prêmio passa para **RESGATADO PELA LOJA** e não poderá ser novamente resgatado pelo consumidor ou por qualquer outra loja.
- O sistema deve executar a mudança de estado mesmo que ninguém esteja acessando o painel. A rotina de vencimento precisa ser confiável, repetível e protegida contra concorrência, sem depender de ação manual do administrador geral.


### 11.6 Regra definitiva de propriedade e liquidação por loja

- **O cupom pertence à loja que o emitiu.** Esse vínculo é permanente e acompanha o cupom desde a emissão, passando pela fila/lote global, sorteio, consulta, resgate do consumidor, eventual expiração e saque pela loja.
- O sorteio é global: cupons de lojas diferentes podem integrar o mesmo lote de 100. Isso não cria uma carteira ou responsabilidade compartilhada entre as lojas. Cada cupom vencedor continua sendo obrigação operacional e financeira exclusiva da loja que o emitiu.
- O consumidor deve resolver o recebimento exclusivamente com a loja emissora. Durante os 30 dias, só essa loja pode validar o QR Code e operar uma das duas opções definidas na seção 11.3: transferência Pix para a chave pré-cadastrada da loja (registrada como mercadoria entregue ao consumidor) ou transferência Pix direta para a chave informada pelo consumidor. Outra loja credenciada não pode concluir a operação.
- A consulta pública do QR Code pode informar o estado do cupom e identificar a loja emissora, mas não permite que outra loja execute o pagamento. As APIs devem validar no servidor a correspondência entre o cupom e a loja autenticada, não confiar em identificadores enviados pela interface.
- Após 30 dias corridos do sorteio concluído, se o consumidor não tiver resgatado, somente o administrador autenticado da loja emissora pode acionar **Sacar prêmio** no painel Loja. O pagamento será automático por Pix para a chave cadastrada e validada daquela loja.
- A chave Pix de recebimento é dado financeiro da loja, não do cupom nem do funcionário. Deve ser cadastrada/alterada pelo administrador autorizado, protegida em repouso, mascarada nas telas e logs e sujeita a validação do titular. O saque usa a chave vigente e validada no momento da solicitação; a auditoria preserva a identificação segura do destino efetivo.
- O saque automático exige registro persistente da transferência, chave de idempotência única por prêmio, estados de processamento/falha/pago, referência do provedor, webhook e rotina de conciliação. A baixa definitiva só ocorre após confirmação confiável de pagamento pelo provedor.
- A operação registra a procedência completa: cupom, lote, compra/valor, loja emissora, loja beneficiária, administrador solicitante, chave mascarada/tipo, valor transferido, provedor, identificador externo, horários, tentativas e resultado. O administrador geral pode consultar e auditar, mas não pode iniciar, substituir, cancelar ou receber esse saque.
- Não existe resgate em qualquer loja da rede. A regra anterior de permitir que o consumidor recebesse em qualquer estabelecimento credenciado fica revogada e deve ser removida de telas, APIs, permissões, documentação, testes e textos destinados ao consumidor.
- Nenhum operador de outra loja, administrador geral ou funcionário pode transferir o vínculo do cupom ou reivindicar o prêmio. Exceções operacionais não podem ser resolvidas alterando o dono do cupom; devem seguir procedimento de suporte/auditoria sem pagamento por terceiro.

### 11.5 Baixa automática pela operação de resgate

- A baixa do prêmio acontece no servidor como consequência da operação válida concluída pelo APK da maquininha.
- Não haverá botão ou permissão para o administrador geral cancelar, sacar ou dar baixa manualmente em prêmios.
- O resgate do consumidor dentro dos 30 dias ocorre presencialmente, com apresentação do QR Code e entrega do prêmio exclusivamente pela loja emissora.
- Depois dos 30 dias, o saque fica disponível exclusivamente ao administrador da loja de origem, pela área administrativa dessa loja. O administrador geral não participa dessa operação.
- O saque da loja e a baixa definitiva devem ocorrer de forma atômica e idempotente, com auditoria e proteção contra solicitações simultâneas.
- A conclusão da operação deve invalidar imediatamente novas tentativas de resgate daquele prêmio em qualquer outra loja ou maquininha.
- O servidor deve impedir resgates simultâneos ou duplicados, mesmo se duas maquininhas tentarem processar o mesmo QR Code ao mesmo tempo.
- Cada operação deve gerar trilha de auditoria com data/hora, identificador do prêmio, estabelecimento que resgatou, maquininha, responsável, modalidade, valor, identificação da transferência e resultado.

## 12. Modalidades de liquidação e responsabilidades financeiras

- Durante os 30 dias de prazo do consumidor, a maquininha apresenta exatamente as duas opções descritas na seção 11.3:
  - **Saque para a loja:** a plataforma transfere o valor para a chave Pix pré-cadastrada da loja emissora. Essa operação é classificada no sistema como **mercadoria**, pois representa que o consumidor recebeu mercadorias da loja.
  - **Transferência Pix para o cliente:** a plataforma transfere o valor diretamente para a chave Pix informada pelo consumidor na maquininha. Essa operação é classificada como **dinheiro**.
- A escolha é feita no momento da leitura/resgate pela maquininha, não por configuração prévia do administrador da loja.
- As duas modalidades são exclusivas por prêmio. A confirmação de uma transferência impede a execução da outra.
- Na modalidade **Saque para a loja**, a chave de destino é a chave cadastrada e validada da loja; o operador não a informa novamente. Na modalidade **Transferência Pix para o cliente**, o operador informa a chave e o tipo de chave do consumidor, que são validados no servidor.
- O Pix direto ao cliente não passa pela conta da loja. O Pix para a loja não é um Pix ao consumidor: é a liquidação destinada à loja, classificada como mercadoria entregue.
- Após os 30 dias sem resgate pelo consumidor, somente o administrador da loja emissora poderá sacar o prêmio expirado para a chave Pix cadastrada da própria loja, conforme a seção 11.4. Esse é um fluxo administrativo distinto das duas opções de resgate apresentadas na maquininha.
- A integração financeira deve definir a origem dos recursos, tarifas, limites, validação de titularidade, saldo/garantia, conciliação e tratamento de transferências pendentes, falhas ou ambíguas. A disponibilidade de API de cobrança não comprova disponibilidade de API de transferência.
- Os termos da promoção devem explicar ao consumidor que a opção classificada como mercadoria é liquidada por Pix à loja, enquanto a opção classificada como dinheiro é paga por Pix diretamente ao consumidor.

## 13. Regras essenciais de segurança e auditoria

1. Os dados financeiros, operacionais e os prêmios são segregados por loja; cada estabelecimento só acessa, resgata e recebe pagamentos dos cupons que ele próprio emitiu, embora a fila e os lotes de sorteio sejam globais.
2. Cada maquininha/caixa possui credenciais próprias e só pode emitir cupons para a loja à qual está vinculada.
3. Cada cupom deve estar vinculado de forma permanente a uma única loja emissora, compra, maquininha/caixa e operador; depois, deve ser atribuído uma única vez a um lote geral. O vínculo à loja nunca muda, mesmo quando o lote mistura cupons de vários estabelecimentos.
4. A entrada do centésimo cupom válido na fila geral fecha o lote e dispara o sorteio automático no servidor, sem depender de pagamento.
5. A confirmação Pix por webhook atualiza somente o financeiro da loja e não pode liberar, iniciar, interromper ou repetir sorteios.
6. O processamento da fila e dos sorteios deve ser idempotente: eventos repetidos não podem duplicar lotes ou resultados.
7. Cada lote deve conter exatamente 100 cupons da fila geral, podendo reunir cupons de diferentes lojas, e gerar exatamente um ganhador.
8. Deve existir trilha de auditoria para emissões, entrada na fila, composição dos lotes, sorteios, cobranças, pagamentos, bloqueios e resgates.
9. O administrador de uma loja não pode acessar dados de outra loja nem executar ações na administração geral.
10. No prazo de resgate, a maquininha apresenta exatamente duas opções mutuamente exclusivas: **Saque para a loja**, com Pix para a chave pré-cadastrada da loja e classificação do prêmio como mercadoria entregue ao consumidor; ou **Transferência Pix para o cliente**, com Pix direto para a chave informada pelo consumidor e classificação como dinheiro.
11. No Pix direto ao cliente, a chave e seu tipo são informados na maquininha, validados no servidor e usados em uma transferência de saída da plataforma. A auditoria registra a modalidade, loja emissora, maquininha, operador, valor, horário e referência do provedor, sem expor a chave completa.
12. O mesmo prêmio não pode ser liquidado por mais de uma modalidade. Transferências Pix pendentes ou de resultado ambíguo permanecem em conciliação e não podem ser repetidas sem consulta ao provedor.

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

- A tela de registro da maquininha terá **um único campo de entrada: Valor da compra**, obrigatório.
- Não haverá campo de nome, telefone, WhatsApp ou qualquer dado de contato do consumidor.
- O campo de valor deverá aceitar reais e centavos, com formatação monetária correta e validação para impedir valores inválidos ou vazios.
- A interface deverá ser projetada para a tela comprida da maquininha: valor em destaque na parte superior e teclado numérico grande na parte inferior, com distância e espaçamento suficientes para que o teclado não cubra o valor digitado.
- A disposição deve facilitar a leitura e reduzir erros de digitação. O valor deverá permanecer claramente visível durante a digitação.
- Depois de informar o valor, o operador usa o botão **Confirmar**. A tela apresenta o valor da compra em tamanho grande para conferência antes da impressão.
- Após a conferência, o operador usa o botão **Imprimir**. O sistema gera o QR Code individual, apresenta o cupom/QR Code na tela da própria maquininha e envia o mesmo cupom para a impressora térmica.
- A versão exibida na tela e a versão impressa devem ser espelhos uma da outra, conforme a especificação visual dos dois recibos registrada separadamente no projeto.
- A emissão deve manter o identificador interno único do cupom, mesmo que esse número não apareça visualmente no recibo.
- A operação registra somente o valor da compra, loja, maquininha, funcionário e data/hora, e insere o cupom na fila geral de sorteio conforme as regras da seção 4.

### 16.2 Leitura do QR Code e consulta do resultado

- A área operacional terá um botão visível para **Ler QR Code** ou **Escanear QR Code**.
- O recurso de leitura existente na atual área do cambista deverá ser inspecionado e, se tecnicamente adequado, migrado/adaptado para a área da maquininha, preservando sua capacidade comprovada de leitura.
- Após a leitura, o APK consulta o servidor e apresenta o resultado do cupom, indicando claramente se está premiado, não premiado, expirado ou já resgatado.
- Quando o cupom estiver premiado, válido e ainda não pago, a tela apresenta o valor do prêmio e exatamente duas opções: **Saque para a loja** e **Transferência Pix para o cliente**.
- Se o cupom não estiver premiado, estiver expirado, já resgatado ou em processamento de pagamento, as opções de pagamento não devem ser exibidas.

### 16.3 Resgate e baixa do prêmio

- Após a leitura de um cupom premiado e válido, o APK apresenta exatamente duas opções: **Saque para a loja** e **Transferência Pix para o cliente**.
- **Saque para a loja:** o destino é a chave Pix da loja emissora, previamente cadastrada e validada. O operador não digita essa chave; confere o valor e o destino mascarado e pressiona **Confirmar**. A transferência Pix para a loja é classificada no sistema como **mercadoria**, representando que o consumidor recebeu mercadorias da loja.
- **Transferência Pix para o cliente:** o operador informa a chave Pix do consumidor e o tipo da chave (CPF/CNPJ, telefone, e-mail ou aleatória). O APK mostra o valor e o destino mascarado para conferência; após confirmação, a plataforma transfere diretamente ao cliente. Essa modalidade é classificada como **dinheiro**.
- As opções são mutuamente exclusivas. Não deve haver opções adicionais de “pagar em mercadoria” ou “pagar em dinheiro”, nem seleção administrativa prévia que substitua a escolha na maquininha.
- A chave de destino, a titularidade, o valor e as permissões devem ser validados pelo servidor. Não confiar em valores, titularidade ou resultados informados apenas pelo APK.
- Ambas as opções são transferências Pix de saída. Cada tentativa deve ser persistida antes da chamada ao provedor, usar idempotência estável por prêmio e modalidade e ter conciliação para estados pendentes ou ambíguos. Não repetir uma transferência incerta sem consultar o provedor.
- A baixa definitiva só ocorre após confirmação confiável da transferência pelo provedor. Uma escolha na interface ou o toque em **Confirmar** não provam que o pagamento foi concluído.
- A auditoria registra a modalidade efetiva, valor, cupom/prêmio, loja emissora, maquininha, operador, data/hora, destino mascarado, provedor e identificador externo. A chave Pix completa e segredos não aparecem em logs ou telas de auditoria.
- Uma nova leitura do mesmo QR Code deve informar que o prêmio já foi pago ou que o pagamento está em processamento, sem oferecer uma segunda transferência.
- O servidor deve impedir pagamentos simultâneos/duplicados do mesmo prêmio e rejeitar qualquer tentativa feita por loja diferente da loja emissora.
- O fluxo deve respeitar a propriedade do cupom e as regras de expiração da seção 11.6. O saque administrativo da loja após 30 dias é separado dessas duas opções de pagamento ao consumidor.

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
- **Cupons premiados:** relação dos cupons da loja que foram sorteados como ganhadores, com valor do prêmio, situação e prazo de resgate pelo consumidor.
- **Prêmios liberados para saque da loja:** lista dos prêmios de cupons emitidos pela própria loja cujo prazo de 30 dias terminou sem resgate pelo consumidor. Cada item deverá mostrar valor, cupom, data de liberação e botão **Sacar prêmio**, disponível exclusivamente ao administrador daquela loja.
- **Prêmios resgatados/pagos:** histórico separado dos prêmios pagos ao consumidor e dos prêmios sacados pela loja após o prazo, com modalidade, valor, data e identificação do responsável pela operação.
- **Financeiro:** resumo do percentual devido à plataforma, valores acumulados, cobranças e pagamentos da própria loja, incluindo os valores de prêmios liberados e sacados pela loja.

### 17.5 Limites e simplicidade da área

- O administrador da loja não precisa de ferramentas para controlar a fila geral, formar lotes ou iniciar sorteios. Essas operações são automáticas no servidor.
- O administrador da loja não pode alterar resultados, escolher ganhadores, cancelar prêmios nem sacar prêmios antes do fim dos 30 dias. Depois do prazo, só pode sacar os prêmios liberados que pertencem à própria loja, pelo fluxo específico e auditado; não pode acessar dados de outros estabelecimentos.
- A área não deve acumular ferramentas administrativas desnecessárias. O foco é acompanhar as maquininhas, administrar seus acessos e consultar os registros da própria loja.
- A construção deverá priorizar a adaptação/refatoração de componentes existentes que sejam compatíveis, sem manter funcionalidades antigas sem uso ou criar remendos. A arquitetura final deve seguir a diretriz de código limpo registrada na seção 4.1.

## 15. Pontos que ainda precisam ser definidos

- Como será apresentada no painel a edição do percentual individual da loja e a data de início de vigência de cada alteração.
- Prazos de vencimento, periodicidade de apuração e condições de pagamento das lojas.
- Regras comerciais e contratuais de cobrança, garantias e consequências para inadimplência.
- Critérios objetivos para alertas, suspensão temporária e bloqueio de novas emissões por loja inadimplente, incluindo quem pode aplicar e retirar o bloqueio.
- Como registrar pagamentos parciais, acordos, renegociações, estornos e divergências nos valores devidos.
- Qual provedor Pix será utilizado e como ocorrerá a conciliação automática por webhook. O webhook não terá função de disparar sorteios.
- Como garantir financeiramente a entrega dos prêmios sorteados quando a loja emissora ainda não tiver pago à plataforma, sem transferir a obrigação de resgate ou pagamento para outro estabelecimento.
- Como será feito o procedimento técnico do sorteio, a geração de aleatoriedade verificável e a comprovação do resultado.
- Definir o provedor e a fonte de recursos para o Pix direto ao cliente executado pela plataforma na maquininha, incluindo tarifas, limites, validação de titularidade, conciliação, estornos e tratamento de transferências pendentes/ambíguas.
- Definir o procedimento de contestação sem permitir cancelamento ou saque administrativo indevido, mantendo o direito de saque do consumidor no prazo e da loja de origem após 30 dias.
- Revisão jurídica do modelo de promoção, da fila compartilhada, dos compromissos com consumidores e dos acordos comerciais com os estabelecimentos.

---

**Observação de escopo:** este documento registra as regras e decisões discutidas para orientar o manual e a futura especificação. Não altera o banco de dados, as telas, os pagamentos ou o funcionamento do sistema. A implementação só deverá começar depois da revisão e aprovação da documentação.


## 18. Registro de implementação — 27/11/2026

Esta seção registra o que já foi codificado na branch de desenvolvimento. Ela não substitui as regras funcionais acima e não significa que o fluxo esteja liberado para produção.

### 18.1 Primeira etapa: emissão e fila global de cupons

- Criado o serviço `src/modules/benefits/issue-coupon.ts` para registrar um cupom a partir do valor da compra informado em centavos.
- Criado o endpoint autenticado `POST /api/cashier/coupons`, destinado ao acesso operacional da maquininha.
- A emissão valida o usuário operacional, a loja vinculada e a situação ativa da loja.
- O cupom registra a loja emissora, o operador, o valor integral da compra, o percentual configurado na loja e o valor devido à plataforma calculado em centavos.
- A chave de idempotência é persistida no cupom. Uma repetição com a mesma chave e mesmo operador/loja recupera o cupom existente, sem criar nova participação.
- A alocação na fila geral usa o estado persistente `CouponQueueState`, atualizado atomicamente em uma transação curta. Isso mantém uma única ordem global e impede duas emissões de ocupar a mesma posição ou fechar o mesmo lote.
- Ao registrar o centésimo cupom, o servidor seleciona um único ganhador, marca o lote como sorteado e grava o prazo de resgate de 30 dias.
- O sorteio não consulta o estado de cobrança ou pagamento da loja.
- A emissão não faz mais uma contagem histórica de cupons: reserva atomicamente uma unidade em `Store.outstandingCouponCount`, limitada por `Store.couponLimit` (100 por padrão). A reserva é revertida automaticamente se a transação falhar. Essa verificação não altera a fila global nem o sorteio.
- Criados testes unitários para o cálculo monetário do percentual, incluindo arredondamento, percentual superior a 100% e limite do inteiro persistido.

### 18.2 Limitações e validações ainda pendentes

- Os testes ainda precisam ser executados no ambiente de integração; a criação dos arquivos de teste não equivale a aprovação.
- As migrações `20261127090000_store_billing_coupon_links` e `20261127100000_coupon_queue_and_store_counter` precisam ser aplicadas no banco antes de ativar os novos fluxos. O contador financeiro é inicializado por backfill dos cupons já existentes.
- O fluxo ainda não está integrado à tela operacional do APK nem à impressão do recibo com QR Code.
- Ainda faltam testes de carga e concorrência PostgreSQL com 100, 500, 1.000 e 5.000 emissões simultâneas, incluindo várias lojas, repetição de chaves de idempotência, rollback e fechamento único de lotes.
- Ainda faltam consulta pública do cupom, apresentação do resultado e integração completa do resgate.
- Foi criada a gestão básica de maquininhas na área Loja: o administrador da loja pode listar e criar acessos operacionais individuais, com usuário, senha inicial armazenada como hash e troca obrigatória no primeiro acesso. Edição, bloqueio e redefinição de senha ainda não foram implementados.
- Implementados a geração antecipada da cobrança Pix, o vínculo persistente e exclusivo entre cada cupom e sua cobrança, a consulta do saldo pendente no painel da loja e a conciliação existente por webhook/reconciliação Asaas. A quitação só remove do saldo pendente os cupons associados à cobrança paga; não altera a fila global nem o sorteio.
- Adicionado `Store.outstandingCouponCount`, contador financeiro atualizado por incremento/decremento atômico. O painel usa esse contador para exibir a quantidade pendente sem contar linhas de cupons.
- O webhook e a rotina de reconciliação baixam o contador na mesma transação em que a cobrança muda para `PAID`, usando a quantidade de vínculos da cobrança. A operação é condicional e falha fechada em caso de divergência para impedir contador negativo.
- A cobrança congela seu conjunto de cupons com bloqueio de linha exclusivo da loja, compartilhado com a reserva do contador na emissão. Lojas diferentes não disputam esse bloqueio financeiro.
- A alocação global dos lotes deixou de executar consultas de busca/contagem sob um advisory lock amplo. Agora uma única atualização atômica de `CouponQueueState` atribui a posição; a inserção, o fechamento do lote e a rotação para o próximo lote são confirmados na mesma transação. A ordem global continua sendo um ponto de serialização intencional para preservar lotes globais exatos de 100 cupons.
- Adicionados testes unitários para a baixa exata do contador e para a proteção contra divergência/underflow. Esses testes ainda precisam ser executados.
- Adicionado teste de integração PostgreSQL opt-in que dispara 1.000 emissões concorrentes distribuídas entre 20 lojas, verifica unicidade, contadores, lotes completos e repetição idempotente. Ele exige banco local `superquina_test` e `RUN_POSTGRES_INTEGRATION=1`; ainda não foi executado.
- Nenhuma credencial real do Asaas foi configurada ou utilizada nesta etapa.

**Status:** otimização de emissão e contagem financeira codificada na branch; ainda não validada por execução, testes PostgreSQL ou teste de carga, e não liberada para produção.

---

## 19. Arquitetura, escala e crescimento

> Direção arquitetural para preparar o produto para milhares de maquininhas e grandes picos de emissão. Este documento não declara capacidade já comprovada nem autoriza produção.

### 1. Objetivo

A plataforma deve atender centenas e milhares de maquininhas autenticadas e operando simultaneamente. Deve ser possível aumentar API, workers e banco de dados sem reconstruir as regras de negócio.

"Maquininha conectada" não é o mesmo que "requisições por segundo". O dimensionamento precisa medir sessões simultâneas, emissões por segundo e rajadas, consultas de QR Code, resgates, pagamentos, sincronizações do APK, volume diário e retenção.

A meta não é prometer ausência absoluta de falhas. É absorver picos, preservar operações financeiras e sorteios, recuperar trabalho automaticamente e permitir que outra equipe opere o sistema com documentação.

### 2. Princípios obrigatórios

1. Aplicação stateless: qualquer réplica da API atende qualquer maquininha; estado de sessão não depende da memória local.
2. Escala horizontal: aumentar réplicas da API e workers independentemente.
3. Banco protegido: pool de conexões limitado, consultas indexadas, transações curtas e limites de concorrência.
4. Trabalho assíncrono durável: filas persistentes, retentativas com backoff, dead-letter e idempotência.
5. Consistência financeira: cobrança, saldo, baixa, resgate e pagamento com transações, auditoria e reconciliação.
6. Sorteio verificável: concorrência não pode duplicar posição, lote, ganhador ou resultado.
7. Falha isolada: indisponibilidade de um provedor ou worker não deve derrubar operações que possam ser aceitas com segurança.
8. Operação simples: deploy, migração, restauração, monitoramento e recuperação documentados e automatizados.
9. Evolução incremental: começar com monólito modular bem separado e extrair serviços quando métricas justificarem. Microserviços prematuros aumentam custo e não garantem escala.

### 3. Leitura da implementação atual

A branch já tem bases úteis: Next.js em container, PostgreSQL/Prisma, sessão persistida, idempotência, contador financeiro por loja, estado persistente da fila de cupons, índices, testes PostgreSQL opt-in e pipeline de qualidade.

Ainda há gargalos que precisam ser tratados antes de declarar o sistema preparado para milhares de equipamentos.

#### 3.1 Coordenador global de lotes

O serviço issueCoupon atualiza uma única linha CouponQueueState para atribuir cada posição. Isso preserva a ordem global e lotes exatos de 100, mas serializa as emissões nesse registro. Ao chegar ao centésimo cupom, a transação também consulta os membros, sorteia, fecha o lote e cria o próximo.

Esse é um ponto de contenção conhecido. O teste de 1.000 emissões concorrentes é uma primeira medição, não uma prova de capacidade ilimitada.

Direção: retirar processamento pesado do caminho HTTP e criar um sequenciador dedicado, com fila durável, processamento controlado, métricas de atraso e recuperação. A regra de lote global de 100 deve ser preservada até decisão formal em contrário. Um único fluxo global estritamente ordenado exige coordenação; adicionar réplicas web, sozinho, não remove essa restrição.

Comparar opções com teste de carga e prova de correção:
- PostgreSQL como fila inicial, com outbox e FOR UPDATE SKIP LOCKED;
- broker durável, como Kafka/Redpanda ou serviço gerenciado equivalente, quando o volume justificar;
- particionamento por campanha somente se a regra comercial permitir sorteios independentes. Particionar por loja mudaria a regra global e não pode ocorrer silenciosamente.

#### 3.2 Worker acoplado ao processo web

O start-production inicia Next.js e um worker interno no mesmo container. Ao escalar réplicas web, cada réplica pode iniciar seu próprio scheduler, multiplicando rotinas periódicas.

Direção: separar os processos:
- web: API e interface stateless, várias réplicas;
- worker: consumidores de filas, escaláveis independentemente;
- scheduler: agendador lógico único, com lease distribuído e jobs idempotentes;
- draw-sequencer: consumidor responsável pela ordem global;
- reconciliation: workers para pagamentos e transferências.

Nenhuma rotina pode depender da suposição implícita de que existe apenas uma réplica.

#### 3.3 Conexões e banco

Cada processo cria seu próprio Prisma Client. Multiplicar réplicas sem orçamento de conexões pode ultrapassar a capacidade do PostgreSQL.

Direção:
- pooler PostgreSQL compatível com o modo de conexão do Prisma;
- limites de pool por processo e orçamento total;
- orçamento separado para API, workers e tarefas administrativas;
- medir queries lentas, locks, deadlocks, cache hit, IOPS, CPU, memória e conexões;
- réplicas de leitura apenas para consultas que aceitem consistência eventual;
- escritas financeiras e decisões de sorteio no primário;
- particionar tabelas de alto crescimento somente com evidência e plano de retenção.

Não adicionar réplicas web sem calcular o total de conexões que cada uma abre.

### 4. Arquitetura-alvo

#### 4.1 Caminho de emissão

1. Maquininha envia emissão autenticada com chave de idempotência estável.
2. API valida identidade, loja, limites e formato; grava intenção e evento de outbox em transação curta.
3. API responde com estado explícito: recebido/em processamento ou emitido. Não afirmar que o cupom foi sorteado antes da confirmação do sequenciador.
4. Worker consome eventos com lease, idempotência e retentativa.
5. Sequenciador global atribui posição e lote de forma ordenada e durável.
6. Ao atingir 100, um único processamento fecha o lote e grava o resultado atomicamente.
7. Maquininha consulta o estado por identificador e repete a solicitação sem duplicar cupom.

O APK deve lidar com perda de conexão, timeout e repetição: a mesma chave de idempotência é reutilizada até receber resultado definitivo. Gerar uma chave nova a cada tentativa pode duplicar a operação.

#### 4.2 Filas e eventos

Criar camada de eventos/outbox com identificador único, tipo e versão, entidade e loja, payload mínimo validado, instante de criação, tentativas, próximo retry, lease, estado, erro resumido e dead-letter.

Consumidores devem ser idempotentes. Mensagens podem ser entregues mais de uma vez. A garantia prática é entrega pelo menos uma vez com processamento idempotente, não presumir entrega exatamente uma vez em toda a infraestrutura.

#### 4.3 Separação dos domínios

Manter módulos claros para identidade e autorização; lojas e maquininhas; emissão e consulta de cupons; sequenciamento e sorteios; cobranças e conciliação; resgate e pagamentos; auditoria e relatórios.

A separação lógica vem antes da separação física em serviços.

#### 4.4 Cache e leitura

- CDN para assets estáticos.
- Cache distribuído para dados públicos e pouco mutáveis, com TTL e invalidação explícitos.
- Cache nunca será fonte de verdade para saldo, limite financeiro, status de pagamento ou resultado.
- Consultas com paginação por cursor, limites e índices; nunca retornar histórico ilimitado.
- Evitar polling agressivo do APK; usar backoff, jitter e atualização incremental. Avaliar push quando necessário.

### 5. Resiliência e operação

- Health checks separados para liveness e readiness.
- Timeouts em chamadas externas e no banco.
- Retry com backoff exponencial e jitter, limite de tentativas e dead-letter.
- Circuit breaker para provedores externos.
- Graceful shutdown: parar de aceitar trabalho, terminar ou liberar leases e encerrar conexões.
- Limites por IP, usuário, maquininha e loja com mecanismo compartilhado, nunca memória local de uma réplica.
- Backpressure: fila absorve picos, mas precisa de limite e política clara quando a capacidade for excedida.
- Webhooks autenticados, deduplicados e reconciliados por rotina independente.
- Backup automático, recuperação point-in-time quando disponível e testes periódicos de restauração.
- Migrações compatíveis com deploy gradual, usando expand/contract.

### 6. Observabilidade e governança

Painéis operacionais devem mostrar:
- requisições por segundo, latência p50/p95/p99 e taxa de erro;
- sessões e maquininhas ativas;
- emissões recebidas, concluídas e pendentes;
- tamanho e idade da fila, taxa de consumo e dead-letter;
- espera do sequenciador e contenção no estado global;
- conexões, CPU, memória, locks, queries lentas e I/O;
- sucesso e atraso de webhooks, conciliações e pagamentos;
- erros por versão do APK e da API.

Adicionar logs estruturados com correlation ID, loja, maquininha/usuário e chave de idempotência, sem segredos ou dados sensíveis, além de tracing distribuído e alertas com runbooks.

Documentar como diagnosticar fila parada, banco saturado, provedor indisponível, emissão duplicada, cobrança divergente e restauração de backup.

### 7. Plano de validação de capacidade

Não declarar "suporta milhares" sem testes reproduzíveis em ambiente isolado, com dados realistas.

Matriz inicial:
- 100, 500, 1.000 e 2.000 maquininhas virtuais autenticadas;
- rajadas e taxas sustentadas de emissão em níveis crescentes;
- consultas públicas de QR Code simultâneas;
- repetição de requisições e perda simulada de rede;
- várias lojas atingindo limite financeiro simultaneamente;
- webhook duplicado, atrasado e fora de ordem;
- indisponibilidade temporária do provedor;
- worker reiniciado no meio de um lote;
- banco com latência e conexões limitadas;
- teste prolongado (soak) para detectar vazamento, crescimento de memória e acúmulo de filas.

Cada rodada registra RPS oferecido/concluído, p50/p95/p99, erros, timeouts, duplicidades, fila máxima e tempo de drenagem, CPU, memória, conexões, locks e I/O, e consistência dos contadores, lotes e ganhadores.

Definir SLOs após medir linha de base e custo operacional. Metas provisórias para discussão: aceite de emissão p95 abaixo de 300 ms; processamento assíncrono p95 abaixo de 2 s em carga normal; disponibilidade mensal de 99,9%. Não são garantias até que sejam testadas.

### 8. Fases de implementação

#### Fase 1 — Fundação e segurança operacional
- concluir auditoria dos caminhos críticos;
- corrigir testes, tipos e migrações;
- separar web, scheduler e worker;
- estabelecer orçamento de conexões e pooler;
- health checks, logs, métricas e alertas;
- idempotência de ponta a ponta.

#### Fase 2 — Emissão desacoplada
- introduzir outbox persistente;
- retirar sorteio e processamento pesado do request HTTP;
- implementar sequenciador durável;
- garantir recuperação, retentativa, dead-letter e auditoria;
- migrar sem perder ou duplicar cupons.

#### Fase 3 — Escala horizontal
- API stateless em múltiplas réplicas;
- workers com concorrência configurável;
- scheduler com lease;
- CDN e cache apenas em leituras apropriadas;
- pooler e limites de conexões;
- testes com 1.000 e 2.000 maquininhas virtuais.

#### Fase 4 — Crescimento elevado
- avaliar broker gerenciado e particionamento permitido pelas regras;
- réplicas de leitura para relatórios;
- particionamento/arquivamento de tabelas de grande volume;
- autoscaling baseado em métricas de fila e saturação;
- testes de falha, recuperação e capacidade acima do pico esperado.

### 9. Critérios para considerar pronta para grande escala

A plataforma só será considerada pronta quando:
- múltiplas réplicas web atendem a mesma base sem estado local;
- múltiplos workers processam filas sem duplicar efeitos;
- scheduler não executa jobs duplicados por réplica;
- sequenciador fecha lotes exatos e auditáveis sob concorrência;
- banco permanece dentro do orçamento de conexões e latência;
- testes de carga e soak passam com margem definida;
- falhas de rede, provedor, worker e deploy são recuperáveis;
- backups foram restaurados em ensaio;
- runbooks permitem que outra equipe opere o produto sem depender do autor original.

### 10. Regra global de sorteio

A regra atual é um fluxo global de cupons, formando lotes de exatamente 100 entre todas as lojas. Isso cria uma ordem global e um ponto de coordenação. Qualquer proposta de dividir o sorteio por loja ou campanha muda a regra do produto e exige aprovação explícita.

**Conclusão:** a plataforma deve crescer por capacidade horizontal e processamento assíncrono, mas sua capacidade só será comprovada por medições. O objetivo é evitar reconstrução futura, não prometer que nenhum sistema jamais precisará de ajustes, atualizações ou manutenção.
