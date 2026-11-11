# Super Sena

Aplicação web de apostas numéricas com sorteios de cinco algarismos, de 00000 a 99999.

Inclui áreas do jogador, cambista e administrador; apostas numéricas; Pix via Mercado Pago; carteira; vendas em dinheiro; comissões; recibos digitais e térmicos; consulta pública por QR Code; agendador de rodadas e apuração idempotente.

Branch de trabalho atual: `site-super-sena`.

O Super Sena é um produto novo, com banco de dados próprio e vazio. Não importar nem manter histórico, cadastros, apostas, vendas, sorteios, resultados, prêmios, saldos ou comissões do sistema de placas.

A estrutura técnica existente é apenas uma base de código a ser aproveitada seletivamente. As regras do produto e os fluxos serão definidos para o Super Sena, sem seguir manuais ou processos do sistema anterior.


## APK Android do cambista

O aplicativo nativo está em `android-app/`. Ele abre somente o login do cambista e usa Bluetooth Classic SPP para impressão térmica. Consulte `android-app/README.md` para configurar o domínio e gerar o APK. O build automático fica em `.github/workflows/build-unified-apk.yml`.
