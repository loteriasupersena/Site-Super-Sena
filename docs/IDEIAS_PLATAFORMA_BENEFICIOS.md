# Caderno de ideias — Plataforma de benefícios

> Documento de registro de ideias em discussão. Não é uma especificação final nem uma autorização para implementar. As regras devem ser revisadas e aprovadas antes de qualquer alteração no sistema.

## Ideia: conta da loja, funcionários e fechamentos com liberação de cupons mediante pagamento

**Status:** ideia registrada para avaliação posterior  
**Origem:** conversa de 25/11/2026  
**Objetivo:** garantir que os cupons só sejam liberados para os sorteios quando a parte financeira correspondente tiver sido efetivamente recebida pela plataforma.

### 1. Cadastro e hierarquia da loja

- A plataforma cadastra cada estabelecimento na área **Administração**.
- Cada loja possui uma conta própria, com um usuário responsável: o dono ou administrador da loja.
- O administrador da loja pode cadastrar e gerenciar os funcionários que trabalham naquele estabelecimento.
- Cada funcionário possui seu próprio acesso e fica vinculado exclusivamente à loja que o cadastrou.
- O dono/administrador também pode registrar compras e emitir cupons usando o próprio acesso.
- Funcionários de uma loja não podem visualizar ou operar dados de outra loja.

### 2. Registro de compras e emissão de cupons

- O funcionário informa o valor da compra realizada pelo consumidor.
- O sistema calcula automaticamente o percentual devido à plataforma, conforme a taxa configurada para aquela loja.
- Exemplo ilustrativo: compra de **R$ 100,00** com taxa de **5%** gera **R$ 5,00** de valor devido à plataforma.
- O sistema registra a compra, o cupom/QR Code emitido, o funcionário responsável, a loja, o horário e o valor correspondente.
- Os valores de todos os funcionários são acumulados no financeiro da respectiva loja.

### 3. Vários fechamentos durante o mesmo dia

- A loja não precisa esperar o fim do expediente para fechar e pagar.
- O administrador pode realizar **vários fechamentos ao longo do dia**, sempre que desejar.
- Cada fechamento reúne um conjunto específico de cupons ainda não quitados.
- O sistema calcula o total devido à plataforma para aquele conjunto e apresenta o resumo antes do pagamento.
- O fechamento gera uma cobrança Pix, apresentada por QR Code, para a loja pagar à plataforma.
- Cada fechamento deve manter sua própria identificação, relação de cupons, valores, data e situação do pagamento.

### 4. Pagamento e liberação da cota de cupons

- A geração do QR Code Pix, por si só, não confirma o pagamento.
- A plataforma deve confirmar o recebimento por meio da integração com o provedor de pagamento.
- Após a confirmação efetiva, o sistema associa o pagamento ao fechamento correspondente.
- **Somente os cupons incluídos naquele fechamento pago são liberados** para participar dos sorteios, conforme as regras da plataforma.
- Cupons de fechamentos ainda não pagos permanecem pendentes e não podem ser considerados na apuração.
- Um pagamento não pode liberar cupons de outro fechamento nem ser utilizado duas vezes.
- A confirmação deve ser registrada de forma segura, com identificação da transação e histórico de auditoria.

### 5. Painel do administrador da loja

O dono/administrador deve conseguir consultar:

- Total de compras registradas pela loja.
- Quantidade de cupons emitidos.
- Histórico de compras e cupons.
- Funcionário responsável por cada emissão.
- Valores acumulados e percentual devido à plataforma.
- Fechamentos realizados, com seus respectivos cupons e valores.
- Situação de cada fechamento: pendente, aguardando confirmação ou pago/liberado.
- Botão para iniciar um novo fechamento e gerar o QR Code Pix da cobrança.

### 6. Regras essenciais de segurança

1. A separação dos dados deve ser feita por loja; cada estabelecimento só acessa seus próprios registros.
2. Cada cupom deve estar vinculado a uma loja, a uma emissão e a um fechamento financeiro.
3. O sistema não deve liberar cupons com base apenas em comprovante enviado ou informação visual de pagamento.
4. A liberação depende da confirmação da transação pelo provedor de pagamento.
5. O processamento da confirmação deve ser idempotente: notificações repetidas não podem duplicar pagamentos nem liberar cupons novamente.
6. Deve existir trilha de auditoria para emissões, fechamentos, pagamentos, liberações e eventuais cancelamentos.
7. A apuração dos sorteios deve considerar apenas os cupons que atendam às regras de liberação.

### 7. Exemplo ilustrativo do fluxo

1. Três funcionários e o dono emitem cupons durante o expediente.
2. As compras e os valores devidos ficam acumulados no painel da loja.
3. Às 10h, o dono fecha um primeiro grupo de cupons e paga o valor calculado.
4. Após a confirmação do Pix, somente os cupons desse primeiro fechamento são liberados.
5. A loja continua trabalhando e emitindo novos cupons.
6. Às 14h, o dono realiza outro fechamento e efetua um novo pagamento.
7. Após a confirmação, o segundo grupo também é liberado.
8. Os cupons que ainda não entraram em um fechamento pago continuam pendentes.

### 8. Pontos que ainda precisam ser definidos

- Se a taxa percentual será fixa para todas as lojas ou negociada/configurada individualmente.
- Se o fechamento incluirá automaticamente todos os cupons pendentes ou permitirá selecionar um grupo.
- Como tratar cancelamentos, estornos e erros em cupons já incluídos em um fechamento.
- Se será permitido pagamento parcial ou se cada fechamento deverá ser quitado integralmente.
- Qual provedor Pix será utilizado e como ocorrerá a conciliação automática.
- Como a quantidade de cupons liberados se relaciona com as cotas e regras de cada sorteio.
- Quais serão os horários, limites e critérios operacionais para participação nos sorteios.

---

**Observação de escopo:** este registro documenta a ideia para discussão futura. Não altera o banco de dados, as regras atuais, as telas, os pagamentos ou o funcionamento do sistema. A implementação depende de revisão e aprovação das regras pendentes.
