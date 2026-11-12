# Cambista Super Sena — aplicativo Android

O APK é exclusivo para cambistas. Ao iniciar, abre diretamente `/cashier-app-login`, aceita somente usuários com perfil `CASHIER` e, após a autenticação, entra em `/cashier?app=1`.

## Isolamento da navegação

- O WebView não abre a página inicial do site.
- A navegação de documentos fica limitada à tela de login do cambista, à área do cambista em modo aplicativo e à alteração obrigatória de senha nesse mesmo modo.
- Links para a página inicial, jogadores, administração e outros caminhos são bloqueados dentro do APK.
- O bloqueio é somente de navegação de páginas. Requisições Fetch/XHR, APIs de cambista, autenticação, pagamentos, Pix, imagens e demais recursos do site continuam disponíveis no mesmo domínio.
- A tela de login e a área do cambista usam cabeçalho sem link para a página inicial.

## Impressão térmica

- O recibo oficial e seus dados são fornecidos pelo site; o APK não confirma pagamentos nem cria recibos financeiros.
- A página chama a ponte JavaScript nativa `AndroidPrinter.imprimirReciboJson`, enviando o DTO do recibo confirmado em JSON.
- O Android processa o JSON em `ReceiptBitmapGenerator`, gera o bitmap do recibo e `EscPosHelper` converte a imagem para raster ESC/POS.
- O único caminho de impressão é: JSON do recibo oficial → Bitmap → raster ESC/POS → Bluetooth Classic SPP por `BluetoothPrinterManager`.
- O protocolo de imagem usa largura de 384 pontos (58 mm); o envio Bluetooth é feito em blocos para reduzir perdas em impressoras com buffer limitado.
- Não há ponte Capacitor nem fluxo paralelo de impressão HTML/texto no APK atual.
- No navegador comum, a impressão continua usando o fluxo web.

## Ícone e identificação

- Nome exibido no Android: **Cambista Super Sena**.
- O ícone do APK é gerado durante o build a partir de `android-app/app/src/main/brand/super-sena-icon.png`; o Gradle cria uma versão quadrada com margem interna para o launcher.
- Versão Android atual no `app/build.gradle.kts`: `1.7.0` (código 8).

## Bluetooth

O app lista impressoras Bluetooth já pareadas, conecta por Bluetooth Classic SPP e salva o MAC/nome para reconexão. A impressora precisa estar pareada nas configurações Bluetooth do Android antes de ser selecionada no aplicativo.

## Gerar APK localmente

Na raiz do repositório:

```bash
cd android-app
gradle assembleDebug
```

Saída: `app/build/outputs/apk/debug/app-debug.apk`.

## GitHub Actions

O workflow `.github/workflows/build-unified-apk.yml` executa na `main` e na branch de limpeza da impressão térmica em texto nativo e QR raster de 240 pontos quando arquivos Android são alterados, ou pode ser iniciado manualmente pela aba **Actions**. O artefato gerado chama-se `Cambista-Super-Sena-APK`.

## Requisitos

- Min SDK 24
- Target SDK 34
- Java 17
- Gradle 8.7
- Android Gradle Plugin 8.6.1
