package br.com.loteriasupersena.app

import android.graphics.Bitmap
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
