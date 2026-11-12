package br.com.loteriasupersena.app

import java.io.ByteArrayOutputStream
import java.nio.charset.Charset
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import java.util.EnumMap

/**
 * Native text + high-resolution QR raster for 58 mm ESC/POS printers.
 * Text stays as printer characters; only the QR symbol is rasterized.
 */
object EscPosHelper {
    private val esc = 0x1B.toByte()
    private val gs = 0x1D.toByte()
    private const val PAPER_DOTS = 384
    private const val QR_DOTS = 192
    private const val COLUMNS = 32

    fun encodeReceipt(text: String, qrPayload: String, columns: Int): ByteArray {
        require(columns == COLUMNS) { "Este aplicativo utiliza exclusivamente papel de 58 mm." }
        require(text.isNotBlank() && text.length <= 30000) { "Texto do recibo inválido." }
        require(qrPayload.startsWith("https://") && qrPayload.toByteArray(Charsets.UTF_8).size <= 1024) {
            "Endereço do QR Code inválido."
        }

        val charset = runCatching { Charset.forName("CP860") }
            .getOrElse { Charset.forName("IBM860") }
        val output = ByteArrayOutputStream()
        output.write(byteArrayOf(esc, 0x40, esc, 'a'.code.toByte(), 1, esc, 'E'.code.toByte(), 1))
        output.write("SUPER SENA\n".toByteArray(charset))
        output.write(byteArrayOf(esc, 'E'.code.toByte(), 0))
        output.write("COMPROVANTE DE APOSTA\n".toByteArray(charset))
        output.write(byteArrayOf(esc, 'a'.code.toByte(), 0))
        output.write(text.substringAfter("COMPROVANTE DE APOSTA\n", text).toByteArray(charset))
        output.write(byteArrayOf(0x0A, esc, 'a'.code.toByte(), 1))
        output.write(qrRaster(qrPayload))
        output.write(byteArrayOf(0x0A, 0x0A, esc, 'a'.code.toByte(), 0, esc, 'd'.code.toByte(), 4))
        return output.toByteArray()
    }

    private fun qrRaster(value: String): ByteArray {
        val hints = EnumMap<EncodeHintType, Any>(EncodeHintType::class.java).apply {
            put(EncodeHintType.MARGIN, 2)
            put(EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.M)
        }
        val matrix = QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, QR_DOTS, QR_DOTS, hints)
        val width = matrix.width
        val height = matrix.height
        val bytesPerRow = (width + 7) / 8
        val raster = ByteArray(bytesPerRow * height)
        for (y in 0 until height) {
            for (x in 0 until width) {
                if (matrix[x, y]) {
                    val index = y * bytesPerRow + x / 8
                    raster[index] = (raster[index].toInt() or (0x80 shr (x % 8))).toByte()
                }
            }
        }
        val out = ByteArrayOutputStream(raster.size + 16)
        out.write(byteArrayOf(
            esc, 'a'.code.toByte(), 1,
            gs, 'v'.code.toByte(), '0'.code.toByte(), 0,
            (bytesPerRow and 0xFF).toByte(),
            ((bytesPerRow shr 8) and 0xFF).toByte(),
            (height and 0xFF).toByte(),
            ((height shr 8) and 0xFF).toByte()
        ))
        out.write(raster)
        out.write(byteArrayOf(0x0A, esc, 'a'.code.toByte(), 0))
        return out.toByteArray()
    }
}
