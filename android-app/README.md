# Cambista Super Sena — aplicativo Android

O APK é exclusivo para cambistas. Ao iniciar, abre diretamente `/cashier-app-login`, aceita somente usuários com perfil `CASHIER` e, após a autenticação, entra em `/cashier?app=1`.

## Isolamento da navegação

- O WebView não abre a página inicial do site.
- A navegação de documentos fica limitada à tela de login do cambista, à área do cambista em modo aplicativo e à alteração obrigatória de senha nesse mesmo modo.
- Links para a página inicial, jogadores, administração e outros caminhos são bloqueados dentro do APK.
- O bloqueio é somente de navegação de páginas. Requisições Fetch/XHR, APIs de cambista, autenticação, pagamentos, Pix, imagens e demais recursos do site continuam disponíveis no mesmo domínio.
- A tela de login e a área do cambista usam cabeçalho sem link para a página inicial.

## Impressão térmica

- O botão **Imprimir recibo** envia os dados oficiais ao Android pela ponte nativa.
- O Android imprime o conteúdo como texto ESC/POS usando a tabela PC860, com alinhamento e quebra de linhas adequados à largura selecionada.
- O QR Code de verificação é convertido em imagem monocromática ESC/POS e enviado junto com o recibo.
- Para papel de 58 mm, o perfil padrão usa 32 colunas; para 80 mm, usa 48 colunas.
- A impressão por imagem de uma WebView fica somente como compatibilidade de reserva para pontes antigas; não é o caminho principal, evitando páginas brancas ou cortadas em renderizações off-screen.
- No navegador comum, a impressão continua usando o fluxo web.

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
