package br.com.loteriasupersena.app

import android.graphics.Bitmap
import android.graphics.Color
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
    private const val QR_DOTS = 240
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
        output.write(byteArrayOf(
            esc, 0x40,
            gs, 'L'.code.toByte(), 2, 0,
            gs, 'W'.code.toByte(), 0x7C, 0x01,
            esc, 'a'.code.toByte(), 0,
            esc, 'E'.code.toByte(), 1,
            esc, 'M'.code.toByte(), 0
        ))
        // Header: larger and bold, while preserving the 58 mm line width.
        output.write(byteArrayOf(esc, 'E'.code.toByte(), 1, esc, '!'.code.toByte(), 0x30))
        output.write("SUPER SENA\n".toByteArray(charset))
        output.write(byteArrayOf(esc, '!'.code.toByte(), 0x10))
        output.write("COMPROVANTE DE APOSTA\n".toByteArray(charset))
        // Body: double-height + bold for legibility; normal width avoids clipping.
        output.write(byteArrayOf(esc, 'a'.code.toByte(), 0, esc, 'E'.code.toByte(), 1, esc, '!'.code.toByte(), 0x10))
        val body = text.substringAfter("COMPROVANTE DE APOSTA\n", text)
        val qrMarker = "[[QR]]"
        val qrPosition = body.indexOf(qrMarker)
        val beforeQr = if (qrPosition >= 0) body.substring(0, qrPosition) else body
        val afterQr = if (qrPosition >= 0) body.substring(qrPosition + qrMarker.length).trimStart() else ""
        output.write(beforeQr.toByteArray(charset))
        output.write(byteArrayOf(esc, '!'.code.toByte(), 0, 0x0A, esc, 'a'.code.toByte(), 2))
        output.write(qrRaster(qrPayload))
        output.write(byteArrayOf(0x0A, esc, 'a'.code.toByte(), 0, esc, '!'.code.toByte(), 0x10))
        output.write(afterQr.toByteArray(charset))
        output.write(byteArrayOf(esc, 'E'.code.toByte(), 0, esc, '!'.code.toByte(), 0, 0x0A, esc, 'd'.code.toByte(), 4))
        return output.toByteArray()
    }

    fun encodeBitmap(source: Bitmap, targetWidth: Int = 380): ByteArray {
        require(targetWidth in 300..384) { "Largura de impressão inválida." }
        val height = (source.height.toFloat() * targetWidth / source.width).toInt().coerceAtLeast(1)
        val scaled = Bitmap.createScaledBitmap(source, targetWidth, height, true)
        val bytesPerRow = (targetWidth + 7) / 8
        val raster = ByteArray(bytesPerRow * height)
        val pixels = IntArray(targetWidth)
        for (y in 0 until height) {
            scaled.getPixels(pixels, 0, targetWidth, 0, y, targetWidth, 1)
            for (x in 0 until targetWidth) {
                val color = pixels[x]
                val gray = (Color.red(color) * 299 + Color.green(color) * 587 + Color.blue(color) * 114) / 1000
                if (gray < 190) {
                    val index = y * bytesPerRow + x / 8
                    raster[index] = (raster[index].toInt() or (0x80 shr (x % 8))).toByte()
                }
            }
        }
        if (scaled !== source) scaled.recycle()
        val out = ByteArrayOutputStream(raster.size + 32)
        out.write(byteArrayOf(
            esc, 0x40,
            gs, 'L'.code.toByte(), 2, 0,
            gs, 'W'.code.toByte(), 0x7C, 0x01,
            esc, 'a'.code.toByte(), 0,
            gs, 'v'.code.toByte(), '0'.code.toByte(), 0,
            (bytesPerRow and 0xFF).toByte(),
            ((bytesPerRow shr 8) and 0xFF).toByte(),
            (height and 0xFF).toByte(),
            ((height shr 8) and 0xFF).toByte()
        ))
        out.write(raster)
        out.write(byteArrayOf(0x0A, esc, 'd'.code.toByte(), 4))
        return out.toByteArray()
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
