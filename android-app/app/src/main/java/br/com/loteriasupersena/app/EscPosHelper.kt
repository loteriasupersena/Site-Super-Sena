package br.com.loteriasupersena.app

import android.graphics.Bitmap
import java.io.ByteArrayOutputStream

/**
 * Converts the PNG receipt bitmap into a monochrome ESC/POS raster for 58 mm paper.
 */
object EscPosHelper {
    private val esc = 0x1B.toByte()
    private val gs = 0x1D.toByte()

    fun encodeBitmap(source: Bitmap, columns: Int): ByteArray {
        require(columns == 32) { "Este aplicativo utiliza exclusivamente papel de 58 mm." }
        require(source.width > 0 && source.height > 0) { "Imagem do recibo inválida." }

        val targetWidth = 384
        val targetHeight = ((source.height.toLong() * targetWidth) / source.width)
            .coerceIn(1L, 60000L).toInt()
        val scaled = Bitmap.createScaledBitmap(source, targetWidth, targetHeight, true)
        val bytesPerRow = targetWidth / 8
        val raster = ByteArray(bytesPerRow * targetHeight)

        for (y in 0 until targetHeight) {
            for (byteX in 0 until bytesPerRow) {
                var packed = 0
                for (bit in 0..7) {
                    val x = byteX * 8 + bit
                    val pixel = scaled.getPixel(x, y)
                    val red = (pixel shr 16) and 0xFF
                    val green = (pixel shr 8) and 0xFF
                    val blue = pixel and 0xFF
                    val luminance = (red * 299 + green * 587 + blue * 114) / 1000
                    if (luminance < 180) packed = packed or (0x80 shr bit)
                }
                raster[y * bytesPerRow + byteX] = packed.toByte()
            }
        }

        val output = ByteArrayOutputStream(raster.size + 32)
        output.write(byteArrayOf(
            esc, 0x40,
            esc, 'a'.code.toByte(), 1,
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
}
