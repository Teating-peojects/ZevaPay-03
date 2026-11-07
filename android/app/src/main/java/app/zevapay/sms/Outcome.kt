package app.zevapay.sms

import org.json.JSONObject

/**
 * What the server said about an SMS. The phone never decides this: it only
 * shows the server's answer. "Matched" means the SMS matched a customer's
 * TrxID and amount on a payment. It is not a bKash/Nagad/Rocket/Upay check.
 */
enum class Outcome(val label: String) {
    MATCHED("Matched a payment"),
    REVIEW("Needs review"),
    WAITING("Recorded, no payment matched yet"),
    DUPLICATE("Already sent"),
    FAILED("Rejected by the server"),
}

fun outcomeOf(reply: JSONObject): Outcome = when {
    reply.optBoolean("duplicate", false) -> Outcome.DUPLICATE
    reply.optBoolean("autoAccepted", false) -> Outcome.MATCHED
    reply.optString("status") == "REVIEW" -> Outcome.REVIEW
    else -> Outcome.WAITING
}
