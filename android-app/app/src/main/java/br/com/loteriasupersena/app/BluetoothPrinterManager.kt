package br.com.loteriasupersena.app

import android.graphics.Bitmap
import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.IOException
import java.util.UUID

data class PrinterDevice(val address: String, val name: String)

class BluetoothPrinterManager(context: Context) {
    private val appContext = context.applicationContext
    private val preferences = appContext.getSharedPreferences("super_sena_printer", Context.MODE_PRIVATE)
    private val mutex = Mutex()
    private val sppUuid = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    private var socket: BluetoothSocket? = null
    private var selectedAddress: String?
        get() = preferences.getString("printer_mac", null)
        set(value) { preferences.edit().putString("printer_mac", value).apply() }

    private fun requirePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            ContextCompat.checkSelfPermission(appContext, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED
        ) throw SecurityException("Permissão Bluetooth não concedida.")
    }

    suspend fun pairedDevices(): List<PrinterDevice> = withContext(Dispatchers.IO) {
        requirePermission()
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: throw IOException("Este aparelho não possui Bluetooth.")
        if (!adapter.isEnabled) throw IOException("Ative o Bluetooth do aparelho.")
        adapter.bondedDevices.map { device ->
            PrinterDevice(device.address, device.name?.takeIf { it.isNotBlank() } ?: "Impressora Bluetooth")
        }.sortedBy { it.name.lowercase() }
    }

    suspend fun connect(address: String): String = mutex.withLock {
        withContext(Dispatchers.IO) {
            requirePermission()
            val adapter = BluetoothAdapter.getDefaultAdapter() ?: throw IOException("Bluetooth indisponível.")
            if (!adapter.isEnabled) throw IOException("Ative o Bluetooth do aparelho.")
            val device = adapter.getRemoteDevice(address)
            closeSocket()
            var candidate: BluetoothSocket? = null
            try {
                val secureSocket = device.createRfcommSocketToServiceRecord(sppUuid)
                candidate = secureSocket
                secureSocket.connect()
            } catch (secureError: IOException) {
                try { candidate?.close() } catch (_: Exception) {}
                candidate = try {
                    device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType!!).invoke(device, 1) as BluetoothSocket
                } catch (reflectionError: Exception) {
                    throw IOException("A impressora não aceitou a conexão Bluetooth SPP.", reflectionError)
                }
                candidate!!.connect()
            }
            socket = candidate
            selectedAddress = device.address
            preferences.edit().putString("printer_name", device.name ?: "Impressora Bluetooth").apply()
            device.name ?: "Impressora Bluetooth"
        }
    }

    suspend fun reconnectSaved(): Boolean = withContext(Dispatchers.IO) {
        val address = selectedAddress ?: return@withContext false
        try {
            connect(address)
            true
        } catch (_: Exception) {
            false
        }
    }

    suspend fun printReceipt(text: String, qrPayload: String): Int =
        printPayload(EscPosHelper.encodeReceipt(text, qrPayload, paperColumns()))

    suspend fun printBitmap(bitmap: Bitmap, targetWidth: Int = 380): Int =
        printPayload(EscPosHelper.encodeBitmap(bitmap, targetWidth))

    private suspend fun printPayload(payload: ByteArray): Int = mutex.withLock {
        withContext(Dispatchers.IO) {
            require(payload.isNotEmpty()) { "O conteúdo da impressão está vazio." }
            var lastError: IOException? = null
            repeat(2) { attempt ->
                try {
                    var active = socket
                    if (active == null || !active.isConnected) {
                        val address = selectedAddress ?: throw IOException("Selecione uma impressora.")
                        val adapter = BluetoothAdapter.getDefaultAdapter() ?: throw IOException("Bluetooth indisponível.")
                        val device = adapter.getRemoteDevice(address)
                        closeSocket()
                        val newSocket: BluetoothSocket = try {
                            device.createRfcommSocketToServiceRecord(sppUuid).also { it.connect() }
                        } catch (_: IOException) {
                            (device.javaClass.getMethod("createRfcommSocket", Int::class.javaPrimitiveType!!)
                                .invoke(device, 1) as BluetoothSocket).also { it.connect() }
                        }
                        socket = newSocket
                        active = newSocket
                    }
                    val output = active!!.getOutputStream()
                    // Small paced writes are more reliable with low-cost Bluetooth
                    // thermal printers whose receive buffers are limited.
                    var offset = 0
                    while (offset < payload.size) {
                        val count = minOf(256, payload.size - offset)
                        output.write(payload, offset, count)
                        output.flush()
                        offset += count
                        if (offset < payload.size) delay(12)
                    }
                    return@withContext payload.size
                } catch (error: IOException) {
                    lastError = error
                    closeSocket()
                    if (attempt == 0) delay(800)
                }
            }
            throw lastError ?: IOException("Falha ao imprimir.")
        }
    }

    suspend fun disconnect() = mutex.withLock { withContext(Dispatchers.IO) { closeSocket() } }

    fun savedPrinterName(): String? = preferences.getString("printer_name", null)

    /** The Cambista Super Sena app is exclusively configured for 58 mm paper. */
    fun setPaperColumns(columns: Int) {
        require(columns == 32) { "Este aplicativo utiliza exclusivamente papel de 58 mm." }
        preferences.edit().putInt("paper_columns", 32).apply()
    }

    fun paperColumns(): Int = 32

    private fun closeSocket() {
        try { socket?.close() } catch (_: Exception) {}
        socket = null
    }
}
