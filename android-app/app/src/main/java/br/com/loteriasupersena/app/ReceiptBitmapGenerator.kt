package br.com.loteriasupersena.app

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

/**
 * Builds the complete 58 mm receipt on-device.
 * All receipt text and the QR symbol are drawn into a pure black/white bitmap.
 * Anti-aliasing, filtering and dithering are deliberately disabled.
 */
object ReceiptBitmapGenerator {
    private const val WIDTH = 384
    private const val MARGIN = 12f
    private const val CONTENT_WIDTH = WIDTH - MARGIN * 2

    private data class TextLine(
        val text: String,
        val size: Float = 18f,
        val bold: Boolean = false,
        val centered: Boolean = false,
        val gapAfter: Float = 0f
    )

    fun fromJson(json: String): Bitmap {
        require(json.isNotBlank() && json.length <= 30_000) { "Dados do recibo inválidos." }
        val data = JSONObject(json)
        require(data.optString("receiptCode").matches(Regex("SQ-[A-Z0-9]{8,32}"))) {
            "Código do recibo inválido."
        }
        val qrPayload = data.optString("qrPayload")
        require(qrPayload.startsWith("https://") && qrPayload.length <= 1024) {
            "Endereço de verificação inválido."
        }
        val entries = data.optJSONArray("entries") ?: error("Apostas não encontradas.")
        require(entries.length() in 1..100) { "Quantidade de apostas inválida." }

        val lines = mutableListOf<TextLine>()
        lines += TextLine("SUPER SENA", 27f, true, true, 2f)
        lines += TextLine("COMPROVANTE DE APOSTA", 20f, true, true, 3f)
        lines += TextLine(data.optString("issuedAtLabel"), 18f, true, true, 2f)
        lines += TextLine(data.optString("paymentLabel", "Dinheiro recebido"), 19f, true, true, 10f)

        val code = data.getString("receiptCode")
        val cashier = data.optString("cashierName").ifBlank { "—" }
        val qr = createQr(qrPayload, 132)
        val details = mutableListOf<TextLine>()
        details += TextLine("CAMBISTA: $cashier", 17f, true, false, 8f)
        details += TextLine("APOSTAS", 22f, true, false, 7f)

        val money = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))
        fun amount(cents: Int): String = money.format(cents / 100.0)

        for (index in 0 until entries.length()) {
            val item = entries.getJSONObject(index)
            val number = item.optString("numberValue")
            val stake = amount(item.optInt("stakeCents"))
            details += TextLine("$number|$stake", 20f, true, false, 2f)
            details += TextLine("Repetição ${item.optInt("repetition")} · Jogo Super Sena", 16f)
            details += TextLine("Unidade: ${amount(item.optInt("unitCents"))} · Dezena: ${amount(item.optInt("tensCents"))}", 15f)
            details += TextLine("Centena: ${amount(item.optInt("hundredsCents"))} · Quadra: ${amount(item.optInt("quadraCents"))}", 15f)
            details += TextLine("Quina: ${amount(item.optInt("quinaCents"))} · Sena: ${amount(item.optInt("senaCents"))}", 15f)
            details += TextLine("Sorteio: ${item.optString("drawAtLabel")}", 15f, true)
            details += TextLine("Rodada ${item.optString("roundCode")}", 15f, false, false, 8f)
        }
        details += TextLine("TOTAL PAGO|${amount(data.optInt("totalCents"))}", 22f, true, false, 12f)
        details += TextLine("GUARDE ESTE COMPROVANTE", 18f, true, true, 5f)
        details += TextLine("Consulte o resultado pelo código do recibo.", 15f, false, true, 3f)
        details += TextLine("Este recibo comprova o pagamento e contém suas apostas.", 15f, false, true, 5f)
        details += TextLine(code, 18f, true, true, 12f)

        val paint = Paint().apply {
            color = Color.BLACK
            isAntiAlias = false
            isFilterBitmap = false
            isDither = false
            textAlign = Paint.Align.LEFT
        }
        val boldPaint = Paint(paint).apply { typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.BOLD) }
        val normalPaint = Paint(paint).apply { typeface = android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.NORMAL) }

        fun measureHeight(line: TextLine): Float {
            val p = if (line.bold) boldPaint else normalPaint
            p.textSize = line.size
            val available = CONTENT_WIDTH
            val chunks = wrap(line.text, p, available)
            return chunks.size * (line.size + 5f) + line.gapAfter
        }

        val headerHeight = lines.sumOf { measureHeight(it).toDouble() }.toFloat()
        val detailsHeight = details.sumOf { measureHeight(it).toDouble() }.toFloat()
        val codeAreaHeight = 154f
        val dividersAndSpacing = 54f
        val height = (MARGIN * 2 + headerHeight + codeAreaHeight + detailsHeight + dividersAndSpacing).toInt().coerceAtLeast(500)
        val bitmap = Bitmap.createBitmap(WIDTH, height, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(Color.WHITE)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)
        var y = MARGIN

        fun drawLine(line: TextLine) {
            val p = if (line.bold) boldPaint else normalPaint
            p.textSize = line.size
            val wrapped = wrap(line.text, p, CONTENT_WIDTH)
            for (part in wrapped) {
                y += line.size
                val x = if (line.centered) (WIDTH - p.measureText(part)) / 2f else MARGIN
                canvas.drawText(part, x, y, p)
                y += 5f
            }
            y += line.gapAfter
        }
        fun divider() {
            val dividerPaint = Paint().apply { color = Color.BLACK; style = Paint.Style.STROKE; strokeWidth = 1f; isAntiAlias = false }
            y += 2f
            canvas.drawLine(MARGIN, y, WIDTH - MARGIN, y, dividerPaint)
            y += 10f
        }

        lines.forEach(::drawLine)
        divider()

        val qrTop = y
        val qrLeft = WIDTH - MARGIN - qr.width
        val qrPaint = Paint().apply { isAntiAlias = false; isFilterBitmap = false; isDither = false }
        canvas.drawBitmap(qr, qrLeft, qrTop, qrPaint)
        val codePaint = Paint(boldPaint).apply { textSize = 15f }
        canvas.drawText("CÓDIGO DO RECIBO", MARGIN, qrTop + 28f, codePaint)
        val codeLines = wrap(code, codePaint, qrLeft - MARGIN * 2)
        var codeY = qrTop + 56f
        codeLines.forEach {
            canvas.drawText(it, MARGIN, codeY, codePaint)
            codeY += 20f
        }
        y = qrTop + qr.height + 12f
        divider()

        details.forEach(::drawLine)
        return bitmap
    }

    private fun wrap(text: String, paint: Paint, maxWidth: Float): List<String> {
        if (text.contains("|")) {
            val parts = text.split("|", limit = 2)
            val left = parts[0]
            val right = parts[1]
            val gap = maxWidth - paint.measureText(left) - paint.measureText(right)
            if (gap >= 8f) return listOf(left + " ".repeat((gap / (paint.measureText(" ") + 1)).toInt().coerceAtLeast(1)) + right)
            return listOf(left, right)
        }
        val result = mutableListOf<String>()
        var current = ""
        for (word in text.split(Regex("\\s+"))) {
            val candidate = if (current.isEmpty()) word else "$current $word"
            if (current.isNotEmpty() && paint.measureText(candidate) > maxWidth) {
                result += current
                current = word
            } else current = candidate
        }
        if (current.isNotEmpty()) result += current
        return result.ifEmpty { listOf("") }
    }

    private fun createQr(value: String, size: Int): Bitmap {
        val hints = mapOf(
            EncodeHintType.MARGIN to 1,
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M
        )
        val matrix = QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, size, size, hints)
        val qr = Bitmap.createBitmap(matrix.width, matrix.height, Bitmap.Config.ARGB_8888)
        for (y in 0 until matrix.height) {
            for (x in 0 until matrix.width) {
                qr.setPixel(x, y, if (matrix[x, y]) Color.BLACK else Color.WHITE)
            }
        }
        return qr
    }
}
