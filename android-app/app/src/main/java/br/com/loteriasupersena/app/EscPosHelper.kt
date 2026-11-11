package br.com.loteriasupersena.app

import java.nio.charset.Charset

object EscPosHelper {
    private val esc = 0x1B.toByte()
    private val gs = 0x1D.toByte()

    fun encode(text: String): ByteArray {
        val safeText = text
            .replace("\u001B", "")
            .replace("\u001D", "")
            .replace("\u0000", "")
            .replace("\r\n", "\n")
            .replace("\r", "\n")
        val charset = runCatching { Charset.forName("IBM860") }.getOrElse { Charsets.ISO_8859_1 }
        val body = safeText.toByteArray(charset)
        val header = byteArrayOf(esc, 0x40, esc, 0x74, 0x03)
        val footer = byteArrayOf(0x0A, esc, 0x64, 0x04, gs, 0x56, 0x41, 0x0A)
        return header + body + footer
    }
}
