package br.com.loteriasupersena.app

import android.graphics.Bitmap
import android.graphics.Color
import java.io.ByteArrayOutputStream

/**
 * Transporte ESC/POS exclusivo do Bitmap nativo 384px para papel de 58mm.
 * Nenhum texto, HTML, screenshot ou WebView é impresso por esta classe.
 */
object EscPosHelper {
    private val esc = 0x1B.toByte()
    private val gs = 0x1D.toByte()
    private const val WIDTH = 384
    private const val BYTES_PER_ROW = WIDTH / 8

    fun encodeBitmap(source: Bitmap, targetWidth: Int = WIDTH): ByteArray {
        require(targetWidth == WIDTH && source.width == WIDTH) {
            "O recibo deve ser gerado em 384 pontos para papel de 58 mm."
        }
        require(source.height in 1..60_000) { "Altura do recibo inválida." }

        val height = source.height
        val raster = ByteArray(BYTES_PER_ROW * height)
        val pixels = IntArray(WIDTH)
        for (y in 0 until height) {
            source.getPixels(pixels, 0, WIDTH, 0, y, WIDTH, 1)
            for (x in 0 until WIDTH) {
                // O gerador já entrega somente branco puro e preto puro.
                // Qualquer pixel diferente de branco é convertido em preto.
                if (pixels[x] != Color.WHITE) {
                    val index = y * BYTES_PER_ROW + x / 8
                    raster[index] = (raster[index].toInt() or (0x80 shr (x % 8))).toByte()
                }
            }
        }

        val output = ByteArrayOutputStream(raster.size + 32)
        output.write(byteArrayOf(
            esc, 0x40,                         // ESC @: limpar estado/buffer da impressora
            gs, 'L'.code.toByte(), 0, 0,      // margem esquerda zero
            gs, 'W'.code.toByte(), 0x80.toByte(), 0x01, // área imprimível: 384 dots
            esc, 'a'.code.toByte(), 0,        // alinhamento à esquerda
            esc, '3'.code.toByte(), 24        // espaçamento de linha padrão
        ))
        output.write(byteArrayOf(
            gs, 'v'.code.toByte(), '0'.code.toByte(), 0,
            (BYTES_PER_ROW and 0xFF).toByte(),
            ((BYTES_PER_ROW shr 8) and 0xFF).toByte(),
            (height and 0xFF).toByte(),
            ((height shr 8) and 0xFF).toByte()
        ))
        output.write(raster)
        output.write(byteArrayOf(
            0x0A,
            esc, '2'.code.toByte(),          // restaurar espaçamento padrão
            esc, 'a'.code.toByte(), 0,
            esc, 'E'.code.toByte(), 0,
            esc, '!'.code.toByte(), 0,
            gs, 'V'.code.toByte(), 0         // corte parcial, quando suportado
        ))
        return output.toByteArray()
    }
}
