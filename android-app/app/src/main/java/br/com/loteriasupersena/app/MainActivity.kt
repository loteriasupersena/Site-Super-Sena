package br.com.loteriasupersena.app

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
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
        // URL pública única do site. Altere somente aqui se o domínio mudar.
        private const val SITE_URL = "https://loteriasupersena.com.br"
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
        webView.loadUrl(SITE_URL)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack()
                else toast("Você está no início do aplicativo.")
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

    private fun isAllowedUrl(uri: Uri): Boolean =
        uri.scheme.equals("https", ignoreCase = true) &&
            uri.host.equals(Uri.parse(SITE_URL).host, ignoreCase = true)

    private fun requiredBluetoothPermissions(): Array<String> = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            arrayOf(Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN)
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ->
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        else -> emptyArray()
    }

    private fun hasBluetoothPermission(): Boolean = requiredBluetoothPermissions().all {
        checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED
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
            "Papel 80 mm — 48 colunas",
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
                    2 -> {
                        printer.setPaperColumns(48)
                        toast("Papel configurado: 80 mm (48 colunas).")
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
