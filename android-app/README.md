# Cambista Super Sena — aplicativo Android

O APK é exclusivo para cambistas. Ao iniciar, abre diretamente `/cashier-app-login`, aceita somente usuários com perfil `CASHIER` e, após a autenticação, entra em `/cashier?app=1`.

## Isolamento da navegação

- O WebView não abre a página inicial do site.
- A navegação de documentos fica limitada à tela de login do cambista, à área do cambista em modo aplicativo e à alteração obrigatória de senha nesse mesmo modo.
- Links para a página inicial, jogadores, administração e outros caminhos são bloqueados dentro do APK.
- O bloqueio é somente de navegação de páginas. Requisições Fetch/XHR, APIs de cambista, autenticação, pagamentos, Pix, imagens e demais recursos do site continuam disponíveis no mesmo domínio.
- A tela de login e a área do cambista usam cabeçalho sem link para a página inicial.

## Impressão térmica

- O botão **Imprimir recibo** captura o comprovante oficial com `html2canvas` em PNG Base64.
- Antes da captura, o recibo é normalizado para fundo branco puro, textos e bordas pretos, sem sombras e sem fundos cinzas.
- O PNG Base64 é enviado pela ponte JavaScript `imprimirImagemBase64`; o Android decodifica para Bitmap, redimensiona proporcionalmente para 384 pontos e imprime em raster ESC/POS.
- O fluxo Android possui um único caminho de impressão: PNG Base64 → Bitmap → raster ESC/POS. As antigas pontes HTML e texto foram removidas.
- O aplicativo usa exclusivamente papel de **58 mm — 32 colunas — 384 pontos**. Não oferece configuração para 80 mm.
- Os dados do recibo continuam sendo fornecidos pela página oficial; o APK apenas transmite os comandos de impressão por Bluetooth.
- Os dados são enviados em blocos pequenos com pausas curtas para reduzir perdas em impressoras Bluetooth com buffer limitado.
- No navegador comum, a impressão continua usando o fluxo web.

## Ícone e identificação

- Nome exibido no Android: **Cambista Super Sena**.
- O ícone do APK é gerado durante o build a partir de `public/images/brand/super-sena-icon.svg`, usando a imagem PNG incorporada nesse SVG.
- Versão Android: `1.4.0` (código 5).

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

O workflow `.github/workflows/build-unified-apk.yml` executa na `main` e na branch de limpeza da impressão gráfica quando arquivos Android são alterados, ou pode ser iniciado manualmente pela aba **Actions**. O artefato gerado chama-se `Cambista-Super-Sena-APK`.

## Requisitos

- Min SDK 24
- Target SDK 34
- Java 17
- Gradle 8.7
- Android Gradle Plugin 8.6.1
