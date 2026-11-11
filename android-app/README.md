# Super Sena — APK do Cambista

Aplicativo Android nativo (Kotlin) que abre exclusivamente a área do cambista do site.

## Configurar o domínio

Antes de publicar o APK, altere a constante `CASHIER_WEB_URL` em:

`app/src/main/java/br/com/loteriasupersena/app/MainActivity.kt`

Use a URL HTTPS da tela exclusiva, terminando em `/cashier-app-login`. O host permitido pelo WebView é derivado dessa mesma constante.

No servidor Next.js, configure `NEXT_PUBLIC_SITE_URL` com o domínio público definitivo para canonical, Open Graph e metadados.

## Segurança

- A tela inicial é `/cashier-app-login`.
- O endpoint `/api/auth/cashier-login` só cria sessão para usuários ativos com perfil `CASHIER`.
- A API emite um cookie HttpOnly adicional vinculado ao token de sessão. A rota `/cashier?app=1` exige esse marcador e o perfil CASHIER.
- O login normal do site continua separado.
- O WebView bloqueia navegação para outros hosts e páginas fora da experiência do cambista.
- As APIs continuam aplicando suas próprias regras de autorização; não há bloqueio global de APIs.

## Impressão Bluetooth

A página do recibo oficial chama `window.AndroidPrinter.imprimir(texto)` quando aberta no APK. No navegador comum, continua usando `window.print()`.

O aplicativo lista dispositivos já pareados no Android, guarda o MAC selecionado, tenta reconectar automaticamente e envia ESC/POS por Bluetooth Classic SPP. O botão flutuante **Impressora** permite selecionar e conectar a impressora.

## Gerar APK

Na raiz do repositório:

```bash
cd android-app
gradle assembleDebug
```

O APK de depuração será gerado em:

`app/build/outputs/apk/debug/app-debug.apk`

O workflow GitHub Actions `.github/workflows/build-unified-apk.yml` também gera e publica o artefato `AppCompleto-Impressora-APK` após alterações em `android-app/**` ou por execução manual.

## Requisitos

- Android minSdk 24
- targetSdk 34
- Java 17
- Gradle 8.7
- Android Gradle Plugin 8.6.1
