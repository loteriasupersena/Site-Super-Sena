package br.com.loteriasupersena.app

import java.nio.charset.Charset

object EscPosHelper {
    private val esc = 0x1B.toByte()
    private val gs = 0x1D.toByte()
    private val qrMarker = Regex("""\[\[QR:([^\]]{1,512})]]""")

    private fun qrCommand(value: String): ByteArray {
        val data = value.toByteArray(Charsets.UTF_8)
        require(data.isNotEmpty() && data.size <= 512) { "QR Code inválido ou muito grande." }
        val output = ArrayList<Byte>()
        fun command(vararg values: Int) { values.forEach { output.add(it.toByte()) } }
        // Select QR model 2.
        command(0x1D, 0x28, 0x6B, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00)
        // Module size 5 and error correction level L.
        command(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x43, 0x05)
        command(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x45, 0x30)
        // Store QR data in the printer buffer.
        val length = data.size + 3
        command(0x1D, 0x28, 0x6B, length and 0xFF, (length shr 8) and 0xFF, 0x31, 0x50, 0x30)
        data.forEach { output.add(it) }
        // Print the stored QR symbol.
        command(0x1D, 0x28, 0x6B, 0x03, 0x00, 0x31, 0x51, 0x30)
        command(0x0A)
        return output.toByteArray()
    }

    fun encode(text: String): ByteArray {
        val safeText = text
            .replace("\u001B", "")
            .replace("\u001D", "")
            .replace("\u0000", "")
            .replace("\r\n", "\n")
            .replace("\r", "\n")
        val charset = runCatching { Charset.forName("IBM860") }.getOrElse { Charsets.ISO_8859_1 }
        val body = ArrayList<Byte>()
        var cursor = 0
        qrMarker.findAll(safeText).forEach { match ->
            body.addAll(safeText.substring(cursor, match.range.first).toByteArray(charset).toList())
            body.addAll(qrCommand(match.groupValues[1]).toList())
            cursor = match.range.last + 1
        }
        body.addAll(safeText.substring(cursor).toByteArray(charset).toList())
        val header = byteArrayOf(esc, 0x40, esc, 0x74, 0x03)
        val footer = byteArrayOf(0x0A, esc, 0x64, 0x04, gs, 0x56, 0x41, 0x0A)
        return header + body.toByteArray() + footer
    }
}
