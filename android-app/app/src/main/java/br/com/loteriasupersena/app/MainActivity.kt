package br.com.loteriasupersena.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.floatingactionbutton.FloatingActionButton
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    companion object {
        private const val SITE_URL = "https://loteriasupersena.com.br"
        private const val CASHIER_LOGIN_URL = "$SITE_URL/cashier-app-login"
        private const val MAX_RECEIPT_HTML_LENGTH = 1_500_000
    }

    private lateinit var webView: WebView
    private lateinit var printer: BluetoothPrinterManager
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        if (results.values.all { it }) {
            lifecycleScope.launch { printer.reconnectSaved() }
            showPrinterMenu()
        } else {
            toast("Permita o Bluetooth para conectar e imprimir recibos.")
        }
    }

    private val filePicker = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = if (result.resultCode == RESULT_OK && result.data != null) {
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        } else null
        fileChooserCallback?.onReceiveValue(uris)
        fileChooserCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
        setContentView(R.layout.activity_main)
        printer = BluetoothPrinterManager(this)
        webView = findViewById(R.id.cashierWebView)
        configureWebView()
        findViewById<FloatingActionButton>(R.id.printerButton).setOnClickListener {
            requestBluetoothPermissions()
        }
        // The app always starts at the dedicated CASHIER-only login.
        webView.loadUrl(CASHIER_LOGIN_URL)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val current = runCatching { Uri.parse(webView.url ?: CASHIER_LOGIN_URL) }.getOrNull()
                if (webView.canGoBack() && current?.let(::isAllowedUrl) == true) {
                    webView.goBack()
                } else {
                    toast("O Cambista Super Sena permanece na área do cambista.")
                }
            }
        })

        requestBluetoothPermissions(autoOpenMenu = false)
    }

    private fun configureWebView() {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.settings.setSupportMultipleWindows(false)
        webView.settings.loadsImagesAutomatically = true
        webView.addJavascriptInterface(AndroidPrinterBridge(), "AndroidPrinter")
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                view?.evaluateJavascript("document.documentElement.classList.add('is-apk','is-android');", null)
                view?.evaluateJavascript("""
                    (function () {
                      function allowed(value) {
                        try {
                          var url = new URL(value, window.location.href);
                          if (url.origin !== window.location.origin) return false;
                          var path = url.pathname.replace(/\/+$/, '');
                          return path === '/cashier-app-login' ||
                            (path === '/cashier' && url.searchParams.get('app') === '1') ||
                            (path === '/change-password' && url.searchParams.get('app') === '1');
                        } catch (_) { return false; }
                      }
                      document.addEventListener('click', function (event) {
                        var link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
                        if (link && !allowed(link.href)) {
                          event.preventDefault();
                          event.stopImmediatePropagation();
                        }
                      }, true);
                      var originalPushState = history.pushState;
                      history.pushState = function (state, title, url) {
                        if (url != null && !allowed(url)) return;
                        return originalPushState.apply(this, arguments);
                      };
                      var originalReplaceState = history.replaceState;
                      history.replaceState = function (state, title, url) {
                        if (url != null && !allowed(url)) return;
                        return originalReplaceState.apply(this, arguments);
                      };
                      window.addEventListener('popstate', function () {
                        if (!allowed(window.location.href)) window.location.replace('https://loteriasupersena.com.br/cashier-app-login');
                      });
                    })();
                """.trimIndent(), null)
            }

            override fun doUpdateVisitedHistory(view: WebView?, url: String?, isReload: Boolean) {
                super.doUpdateVisitedHistory(view, url, isReload)
                val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return
                if (!isAllowedUrl(uri)) {
                    view?.post { view.loadUrl(CASHIER_LOGIN_URL) }
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return true
                return !isAllowedUrl(uri)
            }

            @Suppress("DEPRECATION")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return true
                return !isAllowedUrl(uri)
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = callback
                return try {
                    filePicker.launch(params?.createIntent()
                        ?: Intent(Intent.ACTION_GET_CONTENT).apply { type = "*/*" })
                    true
                } catch (_: Exception) {
                    fileChooserCallback = null
                    false
                }
            }
        }
    }

    /**
     * Restrict document navigation, not the site's network/API layer.
     * Fetch/XHR, payment callbacks, image assets and cashier APIs continue to
     * work because they are subresource requests, not top-level navigation.
     */
    private fun isAllowedUrl(uri: Uri): Boolean {
        if (!uri.scheme.equals("https", ignoreCase = true) ||
            !uri.host.equals(Uri.parse(SITE_URL).host, ignoreCase = true)
        ) return false

        return when (uri.path?.trimEnd('/')) {
            "/cashier-app-login" -> true
            "/cashier" -> uri.getQueryParameter("app") == "1"
            "/change-password" -> uri.getQueryParameter("app") == "1"
            else -> false
        }
    }

    private fun requiredBluetoothPermissions(): Array<String> = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            arrayOf(Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN)
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ->
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        else -> emptyArray()
    }

    private fun requestBluetoothPermissions(autoOpenMenu: Boolean = true) {
        val missing = requiredBluetoothPermissions().filter {
            checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        } else {
            lifecycleScope.launch { printer.reconnectSaved() }
            if (autoOpenMenu) showPrinterMenu()
        }
    }

    private fun showPrinterMenu() {
        val options = arrayOf(
            "Selecionar impressora pareada",
            "Papel 58 mm — 32 colunas",
            "Imprimir teste de comunicação",
            "Ver status da impressora"
        )
        AlertDialog.Builder(this)
            .setTitle("Impressora Bluetooth")
            .setItems(options) { _, index ->
                when (index) {
                    0 -> showPrinterPicker()
                    1 -> {
                        printer.setPaperColumns(32)
                        toast("Papel configurado: 58 mm (32 colunas).")
                    }
                    2 -> lifecycleScope.launch {
                        try {
                            val bytes = printer.printText("CAMBISTA SUPER SENA\\nTESTE DE COMUNICACAO BLUETOOTH\\nPAPEL 58 MM\\n\\n")
                            toast("Teste enviado à impressora ($bytes bytes).")
                        } catch (error: Exception) {
                            toast(error.message ?: "Falha no teste Bluetooth.")
                        }
                    }
                    3 -> toast(printer.savedPrinterName()?.let { "Impressora: $it" }
                        ?: "Nenhuma impressora selecionada.")
                }
            }
            .setNegativeButton("Fechar", null)
            .show()
    }

    private fun showPrinterPicker() {
        lifecycleScope.launch {
            try {
                val devices = printer.pairedDevices()
                if (devices.isEmpty()) {
                    toast("Nenhuma impressora pareada. Pareie a impressora nas configurações Bluetooth do Android.")
                    return@launch
                }
                val labels = devices.map { "${it.name}  •  ${it.address}" }.toTypedArray()
                AlertDialog.Builder(this@MainActivity)
                    .setTitle("Selecionar impressora")
                    .setItems(labels) { _, index ->
                        lifecycleScope.launch {
                            try {
                                val name = printer.connect(devices[index].address)
                                toast("Conectado: $name")
                            } catch (error: Exception) {
                                toast(error.message ?: "Não foi possível conectar à impressora.")
                            }
                        }
                    }
                    .setNegativeButton("Cancelar", null)
                    .show()
            } catch (error: Exception) {
                toast(error.message ?: "Falha ao consultar impressoras.")
            }
        }
    }

    private fun renderAndPrintReceipt(html: String, widthCssPx: Int) {
        if (html.length !in 1..MAX_RECEIPT_HTML_LENGTH || !html.contains("<html", ignoreCase = true)) {
            toast("Conteúdo do recibo inválido.")
            return
        }

        val columns = printer.paperColumns()
        val cssWidth = widthCssPx.coerceIn(180, 1000)
        val density = resources.displayMetrics.density
        val viewWidth = (cssWidth * density).toInt().coerceAtLeast(cssWidth)
        val root = findViewById<FrameLayout>(android.R.id.content)
        val renderView = WebView(this)
        renderView.settings.javaScriptEnabled = false
        renderView.settings.domStorageEnabled = false
        renderView.settings.allowFileAccess = false
        renderView.settings.blockNetworkLoads = true
        renderView.settings.textZoom = 100
        renderView.setBackgroundColor(Color.WHITE)
        renderView.layoutParams = FrameLayout.LayoutParams(viewWidth, 1).apply {
            leftMargin = -viewWidth - 32
        }
        root.addView(renderView)

        renderView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                if (view == null) return
                // WebView.contentHeight is the document height in CSS pixels.
                view.post {
                    val contentHeightCss = view.contentHeight.coerceIn(100, 20000)
                    val viewHeight = (contentHeightCss * density).toInt().coerceAtLeast(contentHeightCss)
                    try {
                        view.measure(
                            android.view.View.MeasureSpec.makeMeasureSpec(viewWidth, android.view.View.MeasureSpec.EXACTLY),
                            android.view.View.MeasureSpec.makeMeasureSpec(viewHeight, android.view.View.MeasureSpec.EXACTLY)
                        )
                        view.layout(0, 0, viewWidth, viewHeight)
                        val bitmap = Bitmap.createBitmap(viewWidth, viewHeight, Bitmap.Config.ARGB_8888)
                        view.draw(Canvas(bitmap))
                        root.removeView(view)
                        view.destroy()
                        lifecycleScope.launch {
                            try {
                                toast("Imprimindo recibo oficial...")
                                val bytes = printer.printBitmap(bitmap, columns)
                                toast("Recibo oficial enviado à impressora ($bytes bytes).")
                            } catch (error: Exception) {
                                toast(error.message ?: "Falha na impressão Bluetooth.")
                            } finally {
                                bitmap.recycle()
                            }
                        }
                    } catch (error: Exception) {
                        root.removeView(view)
                        view.destroy()
                        toast(error.message ?: "Não foi possível preparar a imagem do recibo.")
                    }
                }
            }
        }
        renderView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null)
    }

    private inner class AndroidPrinterBridge {
        @JavascriptInterface
        fun imprimir(texto: String) {
            runOnUiThread {
                toast("Imprimindo recibo...")
                lifecycleScope.launch {
                    try {
                        val bytes = printer.printText(texto)
                        toast("Recibo enviado à impressora ($bytes bytes).")
                    } catch (error: Exception) {
                        toast(error.message ?: "Falha na impressão. Verifique a conexão Bluetooth.")
                    }
                }
            }
        }

        @JavascriptInterface
        fun imprimirHtml(html: String, widthPx: Int) {
            runOnUiThread { renderAndPrintReceipt(html, widthPx) }
        }

        @JavascriptInterface
        fun colunas(): Int = printer.paperColumns()

        @JavascriptInterface
        fun status(): String = printer.savedPrinterName() ?: "Impressora não selecionada"
    }

    private fun toast(message: String) =
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()

    override fun onDestroy() {
        fileChooserCallback?.onReceiveValue(null)
        webView.removeJavascriptInterface("AndroidPrinter")
        webView.destroy()
        super.onDestroy()
    }
}
