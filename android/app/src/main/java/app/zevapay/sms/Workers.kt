package app.zevapay.sms

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit
import org.json.JSONObject

private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

object Workers {
    fun sendNow(context: Context) {
        val request = OneTimeWorkRequestBuilder<SendWorker>()
            .setConstraints(online)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniqueWork("send", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }

    /** Android allows a repeating job no more often than every 15 minutes. */
    fun scheduleHeartbeat(context: Context) {
        val request = PeriodicWorkRequestBuilder<HeartbeatWorker>(15, TimeUnit.MINUTES)
            .setConstraints(online)
            .build()
        WorkManager.getInstance(context)
            .enqueueUniquePeriodicWork("heartbeat", ExistingPeriodicWorkPolicy.UPDATE, request)
    }
}

/** Sends queued SMS in the order they arrived. Stops at the first one that must wait. */
class SendWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val store = Store(applicationContext)
        val token = store.token
        val base = store.baseUrl
        if (token == null || base == null || store.tokenRejected) return Result.success()

        val queue = Queue(applicationContext)
        for (message in queue.pending(50)) {
            val body = JSONObject()
                .put("message", message.body)
                .put("receivedAt", message.receivedAt)
                .put("provider", message.provider.apiName)

            when (val result = Api.post(base, "/api/v1/device/notifications", body, token)) {
                is ApiResult.Ok -> {
                    val outcome = outcomeOf(result.json)
                    queue.markSent(message.id, outcome)
                    Alerts.paymentResult(applicationContext, message.provider, outcome)
                }
                is ApiResult.Rejected -> queue.markFailed(message.id, result.message)
                is ApiResult.Retry -> {
                    queue.noteRetry(message.id, result.reason)
                    return Result.retry()
                }
                ApiResult.Unauthorized -> {
                    // Keep the queue. After pairing again, the messages go out.
                    store.markTokenRejected()
                    Alerts.needsAttention(
                        applicationContext,
                        "This phone was disconnected",
                        "Open ZevaPay SMS and connect again. Payments are waiting.",
                    )
                    return Result.success()
                }
            }
        }
        return Result.success()
    }
}

/** Tells the server the phone is alive, so the dashboard shows it online. */
class HeartbeatWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
    override fun doWork(): Result {
        val store = Store(applicationContext)
        val token = store.token
        val base = store.baseUrl
        if (token == null || base == null || store.tokenRejected) return Result.success()

        return when (Api.post(base, "/api/v1/device/heartbeat", JSONObject(), token)) {
            is ApiResult.Ok -> {
                store.markHeartbeat(System.currentTimeMillis())
                // A good moment to send anything that was waiting.
                if (Queue(applicationContext).pendingCount() > 0) Workers.sendNow(applicationContext)
                Result.success()
            }
            ApiResult.Unauthorized -> {
                store.markTokenRejected()
                Alerts.needsAttention(
                    applicationContext,
                    "This phone was disconnected",
                    "Open ZevaPay SMS and connect again. Payments are waiting.",
                )
                Result.success()
            }
            is ApiResult.Rejected -> Result.success()
            is ApiResult.Retry -> Result.retry()
        }
    }
}
