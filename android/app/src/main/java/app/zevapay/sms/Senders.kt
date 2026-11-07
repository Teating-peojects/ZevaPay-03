package app.zevapay.sms

import java.net.URI

enum class Provider(val apiName: String, val label: String) {
    BKASH("BKASH", "bKash"),
    NAGAD("NAGAD", "Nagad"),
    ROCKET("ROCKET", "Rocket"),
    UPAY("UPAY", "Upay"),
}

/**
 * Decides which SMS may leave the phone. Anything not from one of the four
 * provider senders is dropped here and never stored or sent.
 */
object SenderFilter {
    /** Exact sender (case ignored) to provider. Rocket sends from a number, not a name. */
    private val senders: Map<String, Provider> = mapOf(
        "bkash" to Provider.BKASH,
        "nagad" to Provider.NAGAD,
        "16216" to Provider.ROCKET,
        "upay" to Provider.UPAY,
    )

    private val secretWords =
        Regex("""\b(otp|pin|passcode|verification code|one[- ]time)\b""", RegexOption.IGNORE_CASE)
    private val paymentMarkers =
        Regex("""\b(trx\s?id|txn\s?id|transaction\s?id)\b""", RegexOption.IGNORE_CASE)

    fun providerFor(address: String?): Provider? =
        address?.trim()?.lowercase()?.let { senders[it] }

    /**
     * The provider to report for this SMS, or null if it must not be sent:
     * wrong sender, empty text, or a PIN / one-time-code message.
     */
    fun shouldForward(address: String?, body: String?): Provider? {
        val provider = providerFor(address) ?: return null
        if (body.isNullOrBlank()) return null
        if (secretWords.containsMatchIn(body) && !paymentMarkers.containsMatchIn(body)) return null
        return provider
    }
}

/** The server address a merchant types in. */
object UrlRules {
    /** Returns a clean base URL, or null if it is not acceptable. Plain http only when [allowHttp]. */
    fun normalize(input: String, allowHttp: Boolean): String? {
        val text = input.trim().trimEnd('/')
        if (text.isEmpty()) return null
        val uri = try {
            URI(text)
        } catch (e: Exception) {
            return null
        }
        val scheme = uri.scheme?.lowercase() ?: return null
        if (scheme != "https" && !(allowHttp && scheme == "http")) return null
        if (uri.host.isNullOrBlank()) return null
        if (uri.userInfo != null) return null
        return text
    }
}
