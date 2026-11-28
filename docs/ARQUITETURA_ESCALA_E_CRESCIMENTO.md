# Arquitetura de escala e crescimento — Plataforma de benefícios

> Direção arquitetural para preparar o produto para milhares de maquininhas e grandes picos de emissão. Este documento não declara capacidade já comprovada nem autoriza produção.

## 1. Objetivo

A plataforma deve atender centenas e milhares de maquininhas autenticadas e operando simultaneamente. Deve ser possível aumentar API, workers e banco de dados sem reconstruir as regras de negócio.

"Maquininha conectada" não é o mesmo que "requisições por segundo". O dimensionamento precisa medir sessões simultâneas, emissões por segundo e rajadas, consultas de QR Code, resgates, pagamentos, sincronizações do APK, volume diário e retenção.

A meta não é prometer ausência absoluta de falhas. É absorver picos, preservar operações financeiras e sorteios, recuperar trabalho automaticamente e permitir que outra equipe opere o sistema com documentação.

## 2. Princípios obrigatórios

1. Aplicação stateless: qualquer réplica da API atende qualquer maquininha; estado de sessão não depende da memória local.
2. Escala horizontal: aumentar réplicas da API e workers independentemente.
3. Banco protegido: pool de conexões limitado, consultas indexadas, transações curtas e limites de concorrência.
4. Trabalho assíncrono durável: filas persistentes, retentativas com backoff, dead-letter e idempotência.
5. Consistência financeira: cobrança, saldo, baixa, resgate e pagamento com transações, auditoria e reconciliação.
6. Sorteio verificável: concorrência não pode duplicar posição, lote, ganhador ou resultado.
7. Falha isolada: indisponibilidade de um provedor ou worker não deve derrubar operações que possam ser aceitas com segurança.
8. Operação simples: deploy, migração, restauração, monitoramento e recuperação documentados e automatizados.
9. Evolução incremental: começar com monólito modular bem separado e extrair serviços quando métricas justificarem. Microserviços prematuros aumentam custo e não garantem escala.

## 3. Leitura da implementação atual

A branch já tem bases úteis: Next.js em container, PostgreSQL/Prisma, sessão persistida, idempotência, contador financeiro por loja, estado persistente da fila de cupons, índices, testes PostgreSQL opt-in e pipeline de qualidade.

Ainda há gargalos que precisam ser tratados antes de declarar o sistema preparado para milhares de equipamentos.

### 3.1 Coordenador global de lotes

O serviço issueCoupon atualiza uma única linha CouponQueueState para atribuir cada posição. Isso preserva a ordem global e lotes exatos de 100, mas serializa as emissões nesse registro. Ao chegar ao centésimo cupom, a transação também consulta os membros, sorteia, fecha o lote e cria o próximo.

Esse é um ponto de contenção conhecido. O teste de 1.000 emissões concorrentes é uma primeira medição, não uma prova de capacidade ilimitada.

Direção: retirar processamento pesado do caminho HTTP e criar um sequenciador dedicado, com fila durável, processamento controlado, métricas de atraso e recuperação. A regra de lote global de 100 deve ser preservada até decisão formal em contrário. Um único fluxo global estritamente ordenado exige coordenação; adicionar réplicas web, sozinho, não remove essa restrição.

Comparar opções com teste de carga e prova de correção:
- PostgreSQL como fila inicial, com outbox e FOR UPDATE SKIP LOCKED;
- broker durável, como Kafka/Redpanda ou serviço gerenciado equivalente, quando o volume justificar;
- particionamento por campanha somente se a regra comercial permitir sorteios independentes. Particionar por loja mudaria a regra global e não pode ocorrer silenciosamente.

### 3.2 Worker acoplado ao processo web

O start-production inicia Next.js e um worker interno no mesmo container. Ao escalar réplicas web, cada réplica pode iniciar seu próprio scheduler, multiplicando rotinas periódicas.

Direção: separar os processos:
- web: API e interface stateless, várias réplicas;
- worker: consumidores de filas, escaláveis independentemente;
- scheduler: agendador lógico único, com lease distribuído e jobs idempotentes;
- draw-sequencer: consumidor responsável pela ordem global;
- reconciliation: workers para pagamentos e transferências.

Nenhuma rotina pode depender da suposição implícita de que existe apenas uma réplica.

### 3.3 Conexões e banco

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

## 4. Arquitetura-alvo

### 4.1 Caminho de emissão

1. Maquininha envia emissão autenticada com chave de idempotência estável.
2. API valida identidade, loja, limites e formato; grava intenção e evento de outbox em transação curta.
3. API responde com estado explícito: recebido/em processamento ou emitido. Não afirmar que o cupom foi sorteado antes da confirmação do sequenciador.
4. Worker consome eventos com lease, idempotência e retentativa.
5. Sequenciador global atribui posição e lote de forma ordenada e durável.
6. Ao atingir 100, um único processamento fecha o lote e grava o resultado atomicamente.
7. Maquininha consulta o estado por identificador e repete a solicitação sem duplicar cupom.

O APK deve lidar com perda de conexão, timeout e repetição: a mesma chave de idempotência é reutilizada até receber resultado definitivo. Gerar uma chave nova a cada tentativa pode duplicar a operação.

### 4.2 Filas e eventos

Criar camada de eventos/outbox com identificador único, tipo e versão, entidade e loja, payload mínimo validado, instante de criação, tentativas, próximo retry, lease, estado, erro resumido e dead-letter.

Consumidores devem ser idempotentes. Mensagens podem ser entregues mais de uma vez. A garantia prática é entrega pelo menos uma vez com processamento idempotente, não presumir entrega exatamente uma vez em toda a infraestrutura.

### 4.3 Separação dos domínios

Manter módulos claros para identidade e autorização; lojas e maquininhas; emissão e consulta de cupons; sequenciamento e sorteios; cobranças e conciliação; resgate e pagamentos; auditoria e relatórios.

A separação lógica vem antes da separação física em serviços.

### 4.4 Cache e leitura

- CDN para assets estáticos.
- Cache distribuído para dados públicos e pouco mutáveis, com TTL e invalidação explícitos.
- Cache nunca será fonte de verdade para saldo, limite financeiro, status de pagamento ou resultado.
- Consultas com paginação por cursor, limites e índices; nunca retornar histórico ilimitado.
- Evitar polling agressivo do APK; usar backoff, jitter e atualização incremental. Avaliar push quando necessário.

## 5. Resiliência e operação

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

## 6. Observabilidade e governança

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

## 7. Plano de validação de capacidade

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

## 8. Fases de implementação

### Fase 1 — Fundação e segurança operacional
- concluir auditoria dos caminhos críticos;
- corrigir testes, tipos e migrações;
- separar web, scheduler e worker;
- estabelecer orçamento de conexões e pooler;
- health checks, logs, métricas e alertas;
- idempotência de ponta a ponta.

### Fase 2 — Emissão desacoplada
- introduzir outbox persistente;
- retirar sorteio e processamento pesado do request HTTP;
- implementar sequenciador durável;
- garantir recuperação, retentativa, dead-letter e auditoria;
- migrar sem perder ou duplicar cupons.

### Fase 3 — Escala horizontal
- API stateless em múltiplas réplicas;
- workers com concorrência configurável;
- scheduler com lease;
- CDN e cache apenas em leituras apropriadas;
- pooler e limites de conexões;
- testes com 1.000 e 2.000 maquininhas virtuais.

### Fase 4 — Crescimento elevado
- avaliar broker gerenciado e particionamento permitido pelas regras;
- réplicas de leitura para relatórios;
- particionamento/arquivamento de tabelas de grande volume;
- autoscaling baseado em métricas de fila e saturação;
- testes de falha, recuperação e capacidade acima do pico esperado.

## 9. Critérios para considerar pronta para grande escala

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

## 10. Regra global de sorteio

A regra atual é um fluxo global de cupons, formando lotes de exatamente 100 entre todas as lojas. Isso cria uma ordem global e um ponto de coordenação. Qualquer proposta de dividir o sorteio por loja ou campanha muda a regra do produto e exige aprovação explícita.

**Conclusão:** a plataforma deve crescer por capacidade horizontal e processamento assíncrono, mas sua capacidade só será comprovada por medições. O objetivo é evitar reconstrução futura, não prometer que nenhum sistema jamais precisará de ajustes, atualizações ou manutenção.
