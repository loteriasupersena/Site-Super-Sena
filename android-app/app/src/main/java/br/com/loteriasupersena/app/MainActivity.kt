package br.com.loteriasupersena.app

import android.Manifest
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    companion object {
        // Change this one constant when the production domain changes.
        private const val CASHIER_WEB_URL = "https://loteriasupersena.com.br/cashier-app-login"
    }

    private lateinit var webView: WebView
    private lateinit var printer: BluetoothPrinterManager
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        if (results.values.all { it }) showPrinterPicker()
        else toast("Permita o acesso Bluetooth para selecionar a impressora.")
    }

    private val filePicker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val data = result.data
        val uris = if (result.resultCode == RESULT_OK && data != null) {
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, data)
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
        findViewById<Button>(R.id.printerButton).setOnClickListener { requestBluetoothAndShowPrinters() }
        webView.loadUrl(CASHIER_WEB_URL)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack()
                else toast("Você está no início do aplicativo.")
            }
        })

        lifecycleScope.launch {
            if (hasBluetoothPermission()) printer.reconnectSaved()
        }
    }

    private fun configureWebView() {
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.settings.setSupportMultipleWindows(false)
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
                    filePicker.launch(params?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply { type = "*/*" })
                    true
                } catch (_: Exception) {
                    fileChooserCallback = null
                    false
                }
            }
        }
    }

    private fun isAllowedUrl(uri: Uri): Boolean {
        if (uri.scheme != "https" || !uri.host.equals(Uri.parse(CASHIER_WEB_URL).host, ignoreCase = true)) return false
        val path = uri.path.orEmpty()
        return path == "/cashier-app-login" ||
            path == "/cashier" ||
            path == "/change-password" ||
            path.startsWith("/api/") ||
            path.startsWith("/_next/") ||
            path.startsWith("/images/") ||
            path == "/manifest.webmanifest" ||
            path == "/favicon.ico"
    }

    private fun hasBluetoothPermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == android.content.pm.PackageManager.PERMISSION_GRANTED

    private fun requestBluetoothAndShowPrinters() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !hasBluetoothPermission()) {
            permissionLauncher.launch(arrayOf(Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN))
        } else showPrinterPicker()
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
        fun status(): String = printer.savedPrinterName() ?: "Impressora não selecionada"
    }

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()

    override fun onDestroy() {
        webView.removeJavascriptInterface("AndroidPrinter")
        webView.destroy()
        super.onDestroy()
    }
}
