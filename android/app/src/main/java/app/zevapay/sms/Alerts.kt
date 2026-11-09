package app.zevapay.sms

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build

/**
 * The notifications this app shows. They say what happened, never what the SMS
 * said: no amount, no TrxID, no phone number, so nothing private appears on a
 * lock screen. Nothing is shown unless the user has allowed notifications.
 */
object Alerts {
    private const val PAYMENTS = "payments"
    private const val ATTENTION = "attention"
    private const val ATTENTION_ID = 1

    /** Whether Android will actually show a notification from this app. */
    fun allowed(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false
        return manager(context).areNotificationsEnabled()
    }

    /** A payment SMS was sent and the server matched it or wants a person to look. */
    fun paymentResult(context: Context, provider: Provider, outcome: Outcome) {
        val text = when (outcome) {
            Outcome.MATCHED -> "${provider.label}: matched a payment."
            Outcome.REVIEW -> "${provider.label}: needs your review in the dashboard."
            else -> return
        }
        post(context, PAYMENTS, "Payments", Notification.PRIORITY_DEFAULT, nextId(), "ZevaPay", text)
    }

    /** Something stops payments getting through and a person must act. */
    fun needsAttention(context: Context, title: String, text: String) {
        post(context, ATTENTION, "Needs attention", Notification.PRIORITY_HIGH, ATTENTION_ID, title, text)
    }

    /** The problem is fixed; take the warning down. */
    fun clearAttention(context: Context) = manager(context).cancel(ATTENTION_ID)

    private var counter = 100
    @Synchronized private fun nextId() = counter++

    private fun manager(context: Context) =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    private fun post(
        context: Context,
        channelId: String,
        channelName: String,
        priority: Int,
        id: Int,
        title: String,
        text: String,
    ) {
        if (!allowed(context)) return
        val manager = manager(context)
        if (Build.VERSION.SDK_INT >= 26) {
            val importance =
                if (priority == Notification.PRIORITY_HIGH) NotificationManager.IMPORTANCE_HIGH
                else NotificationManager.IMPORTANCE_DEFAULT
            manager.createNotificationChannel(NotificationChannel(channelId, channelName, importance))
        }
        val open = PendingIntent.getActivity(
            context,
            0,
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = Notification.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_stat_zevapay)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        manager.notify(id, notification)
    }
}
