package br.com.loteriasupersena.app

import android.graphics.Bitmap
import android.graphics.Color
import java.io.ByteArrayOutputStream

/**
 * Transporte ESC/POS do bitmap nativo. Não contém impressão textual/HTML.
 * Entrada obrigatória: bitmap monocromático de 384px.
 */
object EscPosHelper {
    private const val WIDTH = 384
    private const val BYTES_PER_ROW = WIDTH / 8
    private val esc = 0x1B.toByte()
    private val gs = 0x1D.toByte()

    fun encodeBitmap(source: Bitmap, targetWidth: Int = WIDTH): ByteArray {
        require(targetWidth == WIDTH && source.width == WIDTH) {
            "O recibo deve ter exatamente 384 pontos para papel de 58 mm."
        }
        require(source.height in 1..60_000) { "Altura do recibo inválida." }

        val raster = ByteArray(BYTES_PER_ROW * source.height)
        val row = IntArray(WIDTH)
        for (y in 0 until source.height) {
            source.getPixels(row, 0, WIDTH, 0, y, WIDTH, 1)
            for (x in row.indices) {
                if (row[x] != Color.WHITE) {
                    val offset = y * BYTES_PER_ROW + x / 8
                    raster[offset] = (raster[offset].toInt() or (0x80 shr (x % 8))).toByte()
                }
            }
        }

        val output = ByteArrayOutputStream(raster.size + 32)
        output.write(byteArrayOf(
            esc, 0x40                         // Inicializa a impressora
        ))
        output.write(byteArrayOf(
            gs, 'v'.code.toByte(), '0'.code.toByte(), 0,
            BYTES_PER_ROW.toByte(), 0,
            (source.height and 0xFF).toByte(),
            ((source.height shr 8) and 0xFF).toByte()
        ))
        output.write(raster)
        output.write(byteArrayOf(
            0x0A,
            esc, '2'.code.toByte(),
            esc, 'a'.code.toByte(), 0,
            esc, 'E'.code.toByte(), 0,
            esc, '!'.code.toByte(), 0,
            gs, 'V'.code.toByte(), 0
        ))
        return output.toByteArray()
    }
}
