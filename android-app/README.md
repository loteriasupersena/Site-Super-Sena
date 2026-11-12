# Cambista Super Sena — aplicativo Android

O APK é exclusivo para cambistas. Ao iniciar, abre diretamente `/cashier-app-login`, aceita somente usuários com perfil `CASHIER` e, após a autenticação, entra em `/cashier?app=1`.

## Isolamento da navegação

- O WebView não abre a página inicial do site.
- A navegação de documentos fica limitada à tela de login do cambista, à área do cambista em modo aplicativo e à alteração obrigatória de senha nesse mesmo modo.
- Links para a página inicial, jogadores, administração e outros caminhos são bloqueados dentro do APK.
- O bloqueio é somente de navegação de páginas. Requisições Fetch/XHR, APIs de cambista, autenticação, pagamentos, Pix, imagens e demais recursos do site continuam disponíveis no mesmo domínio.
- A tela de login e a área do cambista usam cabeçalho sem link para a página inicial.

## Impressão térmica

- O botão **Imprimir recibo** envia ao Android o HTML do próprio recibo oficial exibido na tela.
- O Android renderiza esse HTML em uma WebView isolada, sem JavaScript e sem acesso à rede, converte a página em imagem monocromática e envia a imagem em raster ESC/POS.
- O QR Code é impresso como parte da mesma imagem do recibo, preservando a organização, os títulos, valores e separadores do recibo exibido.
- 32 colunas usam 384 pontos para papel de 58 mm; 48 colunas usam 576 pontos para papel de 80 mm.
- No navegador comum, a impressão continua usando o fluxo web. O modo de texto legado permanece como compatibilidade para versões anteriores do APK.

## Ícone e identificação

- Nome exibido no Android: **Cambista Super Sena**.
- O ícone do APK é gerado durante o build a partir de `public/images/brand/super-sena-icon.svg`, usando a imagem PNG incorporada nesse SVG.
- Versão Android: `1.3.0` (código 4).

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

O workflow `.github/workflows/build-unified-apk.yml` executa na `main` e nesta branch de correção quando arquivos Android são alterados, ou pode ser iniciado manualmente pela aba **Actions**. O artefato gerado chama-se `Cambista-Super-Sena-APK`.

## Requisitos

- Min SDK 24
- Target SDK 34
- Java 17
- Gradle 8.7
- Android Gradle Plugin 8.6.1
