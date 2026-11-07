package app.zevapay.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import java.time.Instant

/**
 * Gets each incoming SMS, keeps only the four providers' messages, writes them
 * to the local queue and asks for them to be sent. It decides nothing else.
 */
class SmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val store = Store(context)
        if (!store.isPaired) return

        val parts = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        if (parts.isEmpty()) return

        // A long SMS arrives in pieces. Join the pieces from each sender.
        val bySender = LinkedHashMap<String, StringBuilder>()
        for (part in parts) {
            val address = part.originatingAddress ?: continue
            bySender.getOrPut(address) { StringBuilder() }.append(part.messageBody.orEmpty())
        }

        val receivedAt = Instant.ofEpochMilli(parts[0].timestampMillis).toString()
        val queue = Queue(context)
        var queued = false
        for ((address, text) in bySender) {
            val body = text.toString()
            val provider = SenderFilter.shouldForward(address, body) ?: continue
            queue.insert(provider, address, body, receivedAt)
            queued = true
        }
        if (queued) Workers.sendNow(context)
    }
}
