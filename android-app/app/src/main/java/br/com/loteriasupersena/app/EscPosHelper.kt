package br.com.loteriasupersena.app

import android.graphics.Bitmap
import java.io.ByteArrayOutputStream
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import java.nio.charset.Charset
import java.util.EnumMap

/**
 * Converts receipt text into ESC/POS bytes.
 *
 * The website sends QR payloads as [[QR:https://...]]. We rasterize the QR
 * instead of relying on a printer's optional native QR command support.
 */
object EscPosHelper {
    private val esc = 0x1B.toByte()
    private val gs = 0x1D.toByte()
    private val qrMarker = Regex("""\[\[QR:([^\]\r\n]{1,1024})\]\]""")

    private const val QR_SIZE = 240
    private const val MAX_QR_PAYLOAD_BYTES = 1024

    private fun qrRasterCommand(value: String): ByteArray {
        val payload = value.trim()
        require(payload.isNotEmpty()) { "QR Code vazio." }
        require(payload.toByteArray(Charsets.UTF_8).size <= MAX_QR_PAYLOAD_BYTES) {
            "Conteúdo do QR Code excede o limite."
        }

        val hints = EnumMap<EncodeHintType, Any>(EncodeHintType::class.java).apply {
            put(EncodeHintType.MARGIN, 1)
            put(EncodeHintType.ERROR_CORRECTION, com.google.zxing.qrcode.decoder.ErrorCorrectionLevel.M)
        }
        val matrix = QRCodeWriter().encode(payload, BarcodeFormat.QR_CODE, QR_SIZE, QR_SIZE, hints)
        val width = matrix.width
        val height = matrix.height
        val bytesPerRow = (width + 7) / 8
        val output = ArrayList<Byte>(8 + bytesPerRow * height + 4)

        // Center the raster QR on common 58 mm (384-dot) and 80 mm heads.
        output.add(esc)
        output.add('a'.code.toByte())
        output.add(1)

        // GS v 0: bit-image mode, width in bytes and height in dots.
        output.add(gs)
        output.add('v'.code.toByte())
        output.add('0'.code.toByte())
        output.add(0)
        output.add((bytesPerRow and 0xFF).toByte())
        output.add(((bytesPerRow shr 8) and 0xFF).toByte())
        output.add((height and 0xFF).toByte())
        output.add(((height shr 8) and 0xFF).toByte())

        for (y in 0 until height) {
            for (byteX in 0 until bytesPerRow) {
                var packed = 0
                for (bit in 0..7) {
                    val x = byteX * 8 + bit
                    if (x < width && matrix[x, y]) packed = packed or (0x80 shr bit)
                }
                output.add(packed.toByte())
            }
        }

        output.add(0x0A)
        output.add(esc)
        output.add('a'.code.toByte())
        output.add(0)
        return output.toByteArray()
    }

    /**
     * Rasterizes the exact HTML receipt rendered by the cashier app.
     * 32 columns map to a 384-dot 58 mm head; 48 columns to 576-dot 80 mm.
     */
    fun encodeBitmap(source: Bitmap, columns: Int): ByteArray {
        require(columns == 32 || columns == 48) { "Largura de papel inválida." }
        require(source.width > 0 && source.height > 0) { "Imagem do recibo inválida." }

        val targetWidth = if (columns == 48) 576 else 384
        val targetHeight = ((source.height.toLong() * targetWidth) / source.width)
            .coerceIn(1L, 60000L).toInt()
        val scaled = Bitmap.createScaledBitmap(source, targetWidth, targetHeight, true)
        val bytesPerRow = (targetWidth + 7) / 8
        val raster = ByteArray(bytesPerRow * targetHeight)

        for (y in 0 until targetHeight) {
            for (byteX in 0 until bytesPerRow) {
                var packed = 0
                for (bit in 0..7) {
                    val x = byteX * 8 + bit
                    if (x < targetWidth) {
                        val pixel = scaled.getPixel(x, y)
                        val red = (pixel shr 16) and 0xFF
                        val green = (pixel shr 8) and 0xFF
                        val blue = pixel and 0xFF
                        val luminance = (red * 299 + green * 587 + blue * 114) / 1000
                        if (luminance < 180) packed = packed or (0x80 shr bit)
                    }
                }
                raster[y * bytesPerRow + byteX] = packed.toByte()
            }
        }

        val output = ByteArrayOutputStream(raster.size + 32)
        output.write(byteArrayOf(
            esc, 0x40,             // initialize
            esc, 'a'.code.toByte(), 1, // center image
            gs, 'v'.code.toByte(), '0'.code.toByte(), 0,
            (bytesPerRow and 0xFF).toByte(),
            ((bytesPerRow shr 8) and 0xFF).toByte(),
            (targetHeight and 0xFF).toByte(),
            ((targetHeight shr 8) and 0xFF).toByte()
        ))
        output.write(raster)
        output.write(byteArrayOf(0x0A, esc, 'a'.code.toByte(), 0, esc, 'd'.code.toByte(), 4))
        if (scaled !== source) scaled.recycle()
        return output.toByteArray()
    }

    fun encode(text: String): ByteArray {
        val safeText = text
            .replace("\u001B", "")
            .replace("\u001D", "")
            .replace("\u0000", "")
            .replace("\r\n", "\n")
            .replace("\r", "\n")

        val charset = runCatching { Charset.forName("CP860") }
            .getOrElse { Charset.forName("IBM860") }
        val body = ArrayList<Byte>()
        var cursor = 0
        val matches = qrMarker.findAll(safeText).toList()

        for (match in matches) {
            body.addAll(safeText.substring(cursor, match.range.first).toByteArray(charset).toList())
            body.addAll(qrRasterCommand(match.groupValues[1]).toList())
            cursor = match.range.last + 1
        }
        body.addAll(safeText.substring(cursor).toByteArray(charset).toList())

        // Keep the printer's configured/default code page (PC860 on the reference unit).
        val header = byteArrayOf(esc, 0x40)
        val footer = byteArrayOf(0x0A, esc, 0x64, 0x04)
        return header + body.toByteArray() + footer
    }
}
