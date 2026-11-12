package br.com.loteriasupersena.app

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import org.json.JSONObject
import java.text.NumberFormat
import java.util.Locale

/**
 * Desenha o comprovante integralmente em memória no Android.
 * Não captura WebView, tela, HTML ou qualquer conteúdo renderizado pelo site.
 */
object ReceiptBitmapGenerator {
    private const val WIDTH = 384
    private const val MARGIN = 12f
    private const val RIGHT = WIDTH - MARGIN
    private const val CONTENT_WIDTH = WIDTH - MARGIN * 2
    private const val QR_SIZE = 130

    private data class Line(
        val text: String,
        val size: Float = 18f,
        val centered: Boolean = false,
        val gapAfter: Float = 0f
    )

    private val boldTypeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)

    private fun textPaint(size: Float): Paint = Paint().apply {
        color = Color.BLACK
        textSize = size.coerceAtLeast(18f)
        typeface = boldTypeface
        isAntiAlias = false
        isFilterBitmap = false
        isDither = false
        // Reforça o traço sem suavização: preto sólido e caracteres mais encorpados na bobina.\n        style = Paint.Style.FILL_AND_STROKE\n        strokeWidth = 0.65f\n        textAlign = Paint.Align.LEFT
    }

    private fun lineHeight(size: Float) = size.coerceAtLeast(18f) + 7f

    fun fromJson(json: String): Bitmap {
        require(json.isNotBlank() && json.length <= 30_000) { "Dados do recibo inválidos." }
        val data = JSONObject(json)
        val code = data.optString("receiptCode")
        require(code.matches(Regex("SQ-[A-Z0-9]{8,32}"))) { "Código do recibo inválido." }

        val qrPayload = data.optString("qrPayload")
        require(qrPayload.startsWith("https://") && qrPayload.length <= 1024) {
            "Endereço de verificação inválido."
        }
        val entries = data.optJSONArray("entries") ?: error("Apostas não encontradas.")
        require(entries.length() in 1..100) { "Quantidade de apostas inválida." }

        val money = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))
        fun amount(cents: Int) = money.format(cents / 100.0)

        val header = listOf(
            Line("SUPER SENA", 30f, true, 2f),
            Line("COMPROVANTE DE APOSTA", 22f, true, 2f),
            Line(data.optString("issuedAtLabel"), 22f, true, 2f),
            Line(data.optString("paymentLabel", "Dinheiro recebido"), 22f, true, 8f)
        )

        val details = mutableListOf<Line>()
        val cashier = data.optString("cashierName").ifBlank { "—" }
        details += Line("CAMBISTA: $cashier", 22f, false, 8f)
        details += Line("APOSTAS", 28f, false, 6f)

        val betRows = mutableListOf<Pair<String, String>>()
        for (index in 0 until entries.length()) {
            val item = entries.getJSONObject(index)
            betRows += item.optString("numberValue") to amount(item.optInt("stakeCents"))
            details += Line("Repetição ${item.optInt("repetition")} · Jogo Super Sena", 18f)
            details += Line("Unidade: ${amount(item.optInt("unitCents"))} · Dezena: ${amount(item.optInt("tensCents"))}", 18f)
            details += Line("Centena: ${amount(item.optInt("hundredsCents"))} · Quadra: ${amount(item.optInt("quadraCents"))}", 18f)
            details += Line("Quina: ${amount(item.optInt("quinaCents"))} · Sena: ${amount(item.optInt("senaCents"))}", 18f)
            details += Line("Sorteio: ${item.optString("drawAtLabel")}", 18f, false, 1f)
            details += Line("Rodada ${item.optString("roundCode")}", 18f, false, 8f)
        }

        val footer = listOf(
            Line("GUARDE ESTE COMPROVANTE", 22f, true, 5f),
            Line("Consulte o resultado pelo código do recibo.", 18f, true, 3f),
            Line("Este recibo comprova o pagamento e contém suas apostas.", 18f, true, 5f),
            Line(code, 22f, true, 8f)
        )

        val qr = createQr(qrPayload)
        val headerHeight = header.sumOf { (lineHeight(it.size) + it.gapAfter).toDouble() }.toFloat()
        val codeBlockHeight = maxOf(QR_SIZE.toFloat(), 64f + wrapped(code, textPaint(18f), CONTENT_WIDTH - QR_SIZE - 12f).size * lineHeight(18f)) + 12f
        val detailHeight = details.sumOf { (wrapped(it.text, textPaint(it.size), CONTENT_WIDTH).size * lineHeight(it.size) + it.gapAfter).toDouble() }.toFloat()
        val betRowsHeight = betRows.size * 35f
        val totalHeight = 30f + headerHeight + 20f + codeBlockHeight + 20f +
            betRowsHeight + detailHeight + 12f + lineHeight(28f) + 10f +
            footer.sumOf { (lineHeight(it.size) + it.gapAfter).toDouble() }.toFloat() + 12f

        val bitmap = Bitmap.createBitmap(WIDTH, totalHeight.toInt().coerceAtLeast(400), Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(Color.WHITE)
        val canvas = Canvas(bitmap)
        canvas.drawColor(Color.WHITE)
        var y = 20f

        fun divider() {
            val p = Paint().apply {
                color = Color.BLACK
                strokeWidth = 2f
                style = Paint.Style.STROKE
                isAntiAlias = false
                isFilterBitmap = false
                isDither = false
            }
            y += 4f
            canvas.drawLine(MARGIN, y, RIGHT, y, p)
            y += 12f
        }

        fun drawLine(line: Line, maxWidth: Float = CONTENT_WIDTH) {
            val p = textPaint(line.size)
            for (part in wrapped(line.text, p, maxWidth)) {
                y += p.textSize
                val x = if (line.centered) (WIDTH - p.measureText(part)) / 2f else MARGIN
                canvas.drawText(part, x, y, p)
                y += 7f
            }
            y += line.gapAfter
        }

        header.forEach { drawLine(it) }
        divider()

        val qrLeft = RIGHT - QR_SIZE
        val qrTop = y
        val qrPaint = Paint().apply {
            isAntiAlias = false
            isFilterBitmap = false
            isDither = false
        }
        canvas.drawBitmap(qr, qrLeft, qrTop, qrPaint)
        drawLine(Line("CÓDIGO DO RECIBO", 18f), qrLeft - MARGIN - MARGIN)
        val codePaint = textPaint(18f)
        val codeParts = wrapped(code, codePaint, qrLeft - MARGIN * 2)
        for (part in codeParts) {
            y += 18f
            canvas.drawText(part, MARGIN, y, codePaint)
            y += 7f
        }
        y = maxOf(qrTop + QR_SIZE, y) + 12f
        qr.recycle()
        divider()

        details.take(2).forEach { drawLine(it) }
        betRows.forEach { (number, stake) ->
            val p = textPaint(28f)
            y += 28f
            canvas.drawText(number, MARGIN, y, p)
            canvas.drawText(stake, RIGHT - p.measureText(stake), y, p)
            y += 7f
        }
        details.drop(2).forEach { drawLine(it) }

        val total = amount(data.optInt("totalCents"))
        val totalPaint = textPaint(28f)
        y += 28f
        canvas.drawText("TOTAL PAGO", MARGIN, y, totalPaint)
        canvas.drawText(total, RIGHT - totalPaint.measureText(total), y, totalPaint)
        y += 12f
        divider()
        footer.forEach { drawLine(it) }

        // Binarização definitiva: somente branco puro ou preto puro no bitmap enviado.
        val pixels = IntArray(WIDTH)
        for (row in 0 until bitmap.height) {
            bitmap.getPixels(pixels, 0, WIDTH, 0, row, WIDTH, 1)
            for (x in pixels.indices) {
                pixels[x] = if (pixels[x] == Color.WHITE) Color.WHITE else Color.BLACK
            }
            bitmap.setPixels(pixels, 0, WIDTH, 0, row, WIDTH, 1)
        }
        return bitmap
    }

    private fun wrapped(value: String, paint: Paint, maxWidth: Float): List<String> {
        val output = mutableListOf<String>()
        var current = ""
        for (word in value.trim().split(Regex("\\s+"))) {
            val candidate = if (current.isEmpty()) word else "$current $word"
            if (current.isNotEmpty() && paint.measureText(candidate) > maxWidth) {
                output += current
                current = word
            } else {
                current = candidate
            }
        }
        if (current.isNotEmpty()) output += current
        return output.ifEmpty { listOf("") }
    }

    private fun createQr(value: String): Bitmap {
        val hints = mapOf(
            EncodeHintType.MARGIN to 1,
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M
        )
        val matrix = QRCodeWriter().encode(value, BarcodeFormat.QR_CODE, QR_SIZE, QR_SIZE, hints)
        return Bitmap.createBitmap(QR_SIZE, QR_SIZE, Bitmap.Config.ARGB_8888).apply {
            val row = IntArray(QR_SIZE)
            for (y in 0 until QR_SIZE) {
                for (x in 0 until QR_SIZE) row[x] = if (matrix[x, y]) Color.BLACK else Color.WHITE
                setPixels(row, 0, QR_SIZE, 0, y, QR_SIZE, 1)
            }
        }
    }
}
