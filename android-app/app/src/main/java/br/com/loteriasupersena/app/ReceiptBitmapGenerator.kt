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
 * Único renderizador do comprovante térmico.
 * Recebe JSON e produz um bitmap monocromático de 384 pontos.
 * Não captura tela, WebView, HTML ou imagens do site.
 */
object ReceiptBitmapGenerator {
    private const val WIDTH = 384
    private const val MARGIN = 2f
    private const val RIGHT = WIDTH - MARGIN
    private const val CONTENT_WIDTH = WIDTH - 2 * MARGIN
    private const val QR_SIZE = 136
    private const val MAX_BITMAP_HEIGHT = 60_000

    private val receiptTypeface = Typeface.DEFAULT_BOLD

    private data class TextLine(
        val text: String,
        val size: Float = 20f,
        val centered: Boolean = false,
        val gapAfter: Float = 0f,
        val bold: Boolean = true
    )

    private fun paint(size: Float, bold: Boolean = true): Paint = Paint().apply {
        color = Color.BLACK
        textSize = if (bold) size.coerceAtLeast(19f) else size.coerceAtLeast(14f)
        typeface = if (bold) receiptTypeface else Typeface.DEFAULT
        style = if (bold) Paint.Style.FILL_AND_STROKE else Paint.Style.FILL
        strokeWidth = if (bold) 0.9f else 0f
        strokeJoin = Paint.Join.ROUND
        isAntiAlias = false
        isFilterBitmap = false
        isDither = false
        textAlign = Paint.Align.LEFT
    }

    private fun wrap(text: String, p: Paint, maxWidth: Float): List<String> {
        val result = mutableListOf<String>()
        var current = ""
        text.trim().split(Regex("\\s+")).forEach { word ->
            val candidate = if (current.isEmpty()) word else "$current $word"
            if (current.isNotEmpty() && p.measureText(candidate) > maxWidth) {
                result += current
                current = word
            } else {
                current = candidate
            }
        }
        if (current.isNotEmpty()) result += current
        return result.ifEmpty { listOf("") }
    }

    private fun createQr(payload: String): Bitmap {
        val hints = mapOf(
            EncodeHintType.MARGIN to 0,
            EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M
        )
        val matrix = QRCodeWriter().encode(payload, BarcodeFormat.QR_CODE, QR_SIZE, QR_SIZE, hints)
        return Bitmap.createBitmap(QR_SIZE, QR_SIZE, Bitmap.Config.ARGB_8888).apply {
            val row = IntArray(QR_SIZE)
            for (y in 0 until QR_SIZE) {
                for (x in 0 until QR_SIZE) {
                    row[x] = if (matrix[x, y]) Color.BLACK else Color.WHITE
                }
                setPixels(row, 0, QR_SIZE, 0, y, QR_SIZE, 1)
            }
        }
    }

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

        val currency = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))
        fun money(cents: Int): String = currency.format(cents / 100.0)

        val header = listOf(
            TextLine("SUPER SENA", 32f, true, 6f),
            TextLine("COMPROVANTE DE APOSTA", 26f, true, 1f)
        )
        val issuedAt = data.optString("issuedAtLabel")
        val paymentMethod = if (data.optString("paymentLabel").contains("pix", ignoreCase = true)) {
            "Venda no Pix"
        } else {
            "Venda em dinheiro"
        }
        val footer = listOf(
            TextLine("GUARDE ESTE COMPROVANTE", 22f, true, 2f),
            TextLine("Consulte o resultado pelo QR Code.", 19f, true, 2f, true),
        )

        val cashier = data.optString("cashierName").ifBlank { "—" }
        val infoLines = mutableListOf(
            TextLine("CAMBISTA: $cashier", 20f, false, 4f),
            TextLine("APOSTAS", 28f, false, 3f)
        )
        val betRows = mutableListOf<Pair<String, String>>()
        for (index in 0 until entries.length()) {
            val item = entries.getJSONObject(index)
            betRows += item.optString("numberValue") to money(item.optInt("stakeCents"))
            infoLines += TextLine("Repetição ${item.optInt("repetition")} · Jogo Super Sena", 20f, false, 1f)
            infoLines += TextLine("Unidade: ${money(item.optInt("unitCents"))} · Dezena: ${money(item.optInt("tensCents"))}", 20f, false, 1f)
            infoLines += TextLine("Centena: ${money(item.optInt("hundredsCents"))} · Quadra: ${money(item.optInt("quadraCents"))}", 20f, false, 1f)
            infoLines += TextLine("Quina: ${money(item.optInt("quinaCents"))} · Sena: ${money(item.optInt("senaCents"))}", 20f, false, 1f)
            infoLines += TextLine("Sorteio: ${item.optString("drawAtLabel")}", 20f, false, 1f)
            infoLines += TextLine("Rodada ${item.optString("roundCode")}", 20f, false, 4f)
        }

        val qr = createQr(qrPayload)
        val estimatedHeight = (2_000 + entries.length() * 260).coerceAtMost(MAX_BITMAP_HEIGHT)
        val bitmap = Bitmap.createBitmap(WIDTH, estimatedHeight, Bitmap.Config.ARGB_8888)
        bitmap.eraseColor(Color.WHITE)
        val canvas = Canvas(bitmap)
        var y = 8f

        fun drawLine(line: TextLine, maxWidth: Float = CONTENT_WIDTH) {
            val p = paint(line.size, line.bold)
            wrap(line.text, p, maxWidth).forEach { text ->
                y += p.textSize
                val x = if (line.centered) (WIDTH - p.measureText(text)) / 2f else MARGIN
                canvas.drawText(text, x, y, p)
                y += 3f
            }
            y += line.gapAfter
        }

        fun divider() {
            val p = Paint().apply {
                color = Color.BLACK
                style = Paint.Style.STROKE
                strokeWidth = 2f
                isAntiAlias = false
                isFilterBitmap = false
                isDither = false
            }
            y += 4f
            canvas.drawLine(MARGIN, y, RIGHT, y, p)
            y += 6f
        }

        header.forEach(::drawLine)
        divider()

        // QR Code à esquerda; código, data e forma de pagamento à direita.
        val qrTop = y
        val qrLeft = MARGIN
        val qrPaint = Paint().apply {
            color = Color.BLACK
            isAntiAlias = false
            isFilterBitmap = false
            isDither = false
        }
        canvas.drawBitmap(qr, qrLeft, qrTop, qrPaint)
        val codeX = qrLeft + QR_SIZE + 12f
        val codeWidth = RIGHT - codeX
        var codeY = qrTop + 26f
        val labelPaint = paint(15f)
        wrap("CÓDIGO DO RECIBO", labelPaint, codeWidth).forEach { line ->
            canvas.drawText(line, codeX, codeY, labelPaint)
            codeY += labelPaint.textSize + 3f
        }
        val valuePaint = paint(14f)
        wrap(code, valuePaint, codeWidth).forEach { line ->
            canvas.drawText(line, codeX, codeY, valuePaint)
            codeY += valuePaint.textSize + 3f
        }

        val datePaint = paint(18f)
        wrap(issuedAt, datePaint, codeWidth).forEach { line ->
            codeY += datePaint.textSize + 4f
            canvas.drawText(line, codeX, codeY, datePaint)
        }
        val paymentPaint = paint(18f)
        wrap(paymentMethod, paymentPaint, codeWidth).forEach { line ->
            codeY += paymentPaint.textSize + 4f
            canvas.drawText(line, codeX, codeY, paymentPaint)
        }

        y = qrTop + QR_SIZE + 2f
        qr.recycle()
        divider()

        infoLines.take(2).forEach(::drawLine)
        betRows.forEach { (number, stake) ->
            val p = paint(30f)
            y += p.textSize
            canvas.drawText(number, MARGIN, y, p)
            canvas.drawText(stake, RIGHT - p.measureText(stake), y, p)
            y += 7f
        }
        infoLines.drop(2).forEach(::drawLine)

        val totalPaint = paint(28f)
        val total = money(data.optInt("totalCents"))
        y += totalPaint.textSize
        canvas.drawText("TOTAL PAGO", MARGIN, y, totalPaint)
        canvas.drawText(total, RIGHT - totalPaint.measureText(total), y, totalPaint)
        y += 12f
        divider()
        footer.forEach(::drawLine)

        val finalHeight = (y + 64f).toInt().coerceAtMost(MAX_BITMAP_HEIGHT)
        require(finalHeight < MAX_BITMAP_HEIGHT) { "Recibo excede o limite de impressão." }
        val cropped = Bitmap.createBitmap(bitmap, 0, 0, WIDTH, finalHeight)
        bitmap.recycle()

        // Somente branco puro e preto puro chegam ao protocolo ESC/POS.
        val pixels = IntArray(WIDTH)
        for (row in 0 until cropped.height) {
            cropped.getPixels(pixels, 0, WIDTH, 0, row, WIDTH, 1)
            for (x in pixels.indices) {
                pixels[x] = if (pixels[x] == Color.WHITE) Color.WHITE else Color.BLACK
            }
            cropped.setPixels(pixels, 0, WIDTH, 0, row, WIDTH, 1)
        }
        return cropped
    }
}
