# Super Sena — aplicativo Android unificado

O APK abre o site completo em uma WebView de tela cheia e oferece impressão térmica Bluetooth nativa por ESC/POS.

## URL do site

A URL inicial está definida em:

`app/src/main/java/br/com/loteriasupersena/app/MainActivity.kt`

Altere a constante `SITE_URL` para o endereço HTTPS definitivo do site. O WebView mantém a navegação interna no mesmo domínio e bloqueia hosts externos.

## Impressão térmica

- O botão **Imprimir recibo** chama `window.AndroidPrinter.imprimir(texto)` quando está dentro do APK.
- No navegador comum, continua usando `window.print()`.
- O app lista impressoras Bluetooth já pareadas, conecta por SPP e salva MAC/nome para reconexão.
- O recibo usa 32 colunas (58 mm) por padrão; no botão flutuante Impressora é possível escolher 32 colunas (58 mm) ou 48 colunas (80 mm).
- O marcador `[[QR:URL]]` é convertido em comandos ESC/POS de QR Code.
- A codificação de texto usa CP860, inicialização ESC @, avanço de quatro linhas e corte parcial.
- O envio é feito em blocos de até 512 bytes, com flush e uma tentativa de reconexão após falha de I/O.

O app trabalha com Bluetooth Classic SPP. A impressora precisa estar pareada nas configurações Bluetooth do Android antes de ser selecionada no aplicativo.

## Gerar APK localmente

Na raiz do repositório:

```bash
cd android-app
gradle assembleDebug
```

Saída:

`app/build/outputs/apk/debug/app-debug.apk`

## Gerar pelo GitHub Actions

O workflow `.github/workflows/build-unified-apk.yml` executa na branch `main` quando há alterações em `android-app/**`, ou pode ser iniciado manualmente pela aba **Actions**.

O artefato gerado chama-se `AppCompleto-Impressora-APK`.

## Requisitos

- Min SDK 24
- Target SDK 34
- Java 17
- Gradle 8.7
- Android Gradle Plugin 8.6.1
