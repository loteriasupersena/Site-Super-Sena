# Decisão funcional — pagamento de cupom premiado na maquininha

**Status: decisão funcional confirmada pelo responsável do produto em 27/11/2026.**

Este documento registra a regra mais recente para substituir descrições anteriores conflitantes sobre as opções de resgate na maquininha. Aplica-se ao fluxo de leitura do QR Code de um cupom premiado e válido.

## 1. Tela após a leitura

Depois de ler o QR Code, o APK consulta o servidor. Se o cupom estiver premiado, dentro do prazo e ainda não tiver sido pago, a tela mostra o valor do prêmio e **exatamente duas opções**:

1. **Saque para a loja**
2. **Transferência Pix para o cliente**

Não deve existir uma terceira opção, nem uma seleção separada chamada “mercadoria” ou “dinheiro”.

## 2. Opção “Saque para a loja”

- A loja recebe o valor do prêmio por transferência Pix para a chave Pix da própria loja, previamente cadastrada e validada no sistema.
- A maquininha apresenta a opção e, após o operador selecioná-la, mostra o valor e a chave de destino mascarada para conferência.
- O operador só precisa pressionar **Confirmar** para solicitar a transferência. Não deve digitar novamente a chave Pix da loja.
- Após a confirmação confiável da transferência pelo provedor, o sistema registra essa modalidade como **prêmio pago em mercadoria**.
- A interpretação operacional é que o consumidor recebeu mercadorias da loja; o dinheiro transferido é destinado à loja, não ao consumidor.
- A auditoria registra a loja beneficiária, a chave mascarada, o valor, o operador, a maquininha e a referência da transferência.

## 3. Opção “Transferência Pix para o cliente”

- O operador informa na maquininha a chave Pix do próprio cliente e seleciona o tipo de chave, quando necessário.
- Antes de enviar, o APK apresenta o valor do prêmio e os dados de destino mascarados para conferência.
- Após o operador confirmar, a plataforma executa a transferência diretamente para a chave Pix informada pelo cliente. O valor não passa pela conta Pix da loja.
- Após a confirmação confiável da transferência pelo provedor, o sistema registra a modalidade como **prêmio pago em dinheiro (Pix direto ao cliente)**.
- A auditoria registra o tipo de chave, a chave mascarada, o valor, a loja emissora, o operador, a maquininha e a referência da transferência. A chave completa não deve aparecer em telas de auditoria ou logs.

## 4. Regras obrigatórias para as duas opções

- As duas opções são mutuamente exclusivas. Um prêmio só pode ser liquidado uma vez.
- A escolha da opção determina o significado do pagamento:
  - **Saque para a loja:** Pix para a chave pré-cadastrada da loja; registrar como mercadoria entregue ao consumidor.
  - **Transferência Pix para o cliente:** Pix para a chave informada pelo consumidor; registrar como pagamento em dinheiro ao consumidor.
- Não marcar o prêmio como pago apenas porque o operador apertou o botão. Para Pix, a baixa definitiva depende de confirmação confiável do provedor.
- Cada tentativa deve usar chave de idempotência estável por prêmio e modalidade. Repetições, timeouts, webhooks duplicados ou leituras simultâneas não podem gerar pagamentos duplicados.
- Se o resultado da transferência for pendente ou ambíguo, manter o prêmio em processamento e consultar/reconciliar o provedor antes de tentar novamente.
- O servidor deve validar o estado do cupom, o prazo, a loja emissora, as permissões do operador e a disponibilidade do prêmio. A interface não é fonte de verdade.
- Somente a loja emissora pode concluir o resgate durante o prazo do consumidor.
- Depois que uma das transferências for confirmada e o prêmio for baixado, uma nova leitura deve informar que o prêmio já foi resgatado e não oferecer novamente as opções.

## 5. O que não deve ser confundido

O **Saque para a loja** não é um saque manual em dinheiro pelo operador e não é um Pix para o cliente. É uma transferência automática para a chave Pix da loja já cadastrada, e o sistema classifica o resgate como mercadoria entregue ao consumidor.

A **Transferência Pix para o cliente** é uma transferência direta da plataforma para a chave Pix que o operador informa na maquininha em nome do consumidor.

## 6. Estado de implementação

Este documento registra a regra aprovada; não comprova que as duas opções já estejam implementadas na interface do APK, nas APIs ou na integração de transferências. Antes de declarar o fluxo concluído, é necessário auditar e implementar a tela, os endpoints, os registros financeiros, as integrações Pix, a idempotência, a conciliação e os testes de concorrência.
