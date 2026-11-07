package app.zevapay.sms

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.text.InputType
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import java.text.DateFormat
import java.util.Date
import java.util.concurrent.Executors
import org.json.JSONObject

/**
 * One screen. Not paired: enter the server address and the pairing code.
 * Paired: show whether SMS are getting through, and what the server said about
 * the latest ones.
 */
class MainActivity : Activity() {
    private lateinit var store: Store
    private lateinit var queue: Queue
    private lateinit var root: LinearLayout
    private val background = Executors.newSingleThreadExecutor()
    private var repairing = false
    private var pairError: String? = null
    private var pairing = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = "ZevaPay SMS"
        store = Store(this)
        queue = Queue(this)
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(24))
        }
        setContentView(ScrollView(this).apply { addView(root) })
    }

    override fun onResume() {
        super.onResume()
        if (store.isPaired) {
            Workers.scheduleHeartbeat(this)
            if (!store.tokenRejected) Workers.sendNow(this)
        }
        render()
    }

    override fun onRequestPermissionsResult(code: Int, permissions: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(code, permissions, results)
        render()
    }

    private fun render() {
        root.removeAllViews()
        if (!store.isPaired || store.tokenRejected || repairing) renderPairing() else renderStatus()
    }

    // ---------------------------------------------------------------- pairing

    private fun renderPairing() {
        heading("Connect this phone")
        if (store.tokenRejected) {
            note(
                "The server no longer accepts this phone. It may have been removed in the dashboard. " +
                    "Get a new pairing code and connect again. Messages already received are kept and will be sent.",
                warning = true,
            )
        } else {
            note(
                "In the ZevaPay dashboard open Devices, choose a payment account and create a pairing code. " +
                    "Enter it here with your ZevaPay address.",
            )
        }

        val url = field("ZevaPay address", store.baseUrl ?: "https://", InputType.TYPE_TEXT_VARIATION_URI)
        val code = field("Pairing code", "", InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS)
        pairError?.let { note(it, warning = true) }

        val button = Button(this).apply {
            text = if (pairing) "Connecting…" else "Connect"
            isEnabled = !pairing
            setOnClickListener { pair(url.text.toString(), code.text.toString()) }
        }
        root.addView(button)

        if (repairing && store.isPaired) {
            root.addView(Button(this).apply {
                text = "Cancel"
                setOnClickListener {
                    repairing = false
                    pairError = null
                    render()
                }
            })
        }
    }

    private fun pair(addressInput: String, codeInput: String) {
        val address = UrlRules.normalize(addressInput, allowHttp = BuildConfig.DEBUG)
        if (address == null) {
            pairError = "Enter a full address that starts with https://."
            render()
            return
        }
        if (codeInput.trim().length < 4) {
            pairError = "Enter the pairing code from the dashboard."
            render()
            return
        }

        pairError = null
        pairing = true
        render()

        val body = JSONObject()
            .put("code", codeInput.trim())
            .put("deviceId", store.deviceId)
            .put("deviceName", Build.MODEL.take(80).ifBlank { "Android phone" })
            .put("androidVersion", Build.VERSION.RELEASE.orEmpty().take(40))

        background.execute {
            val result = Api.post(address, "/api/v1/device/pair", body, token = null)
            runOnUiThread {
                pairing = false
                when (result) {
                    is ApiResult.Ok -> {
                        val token = result.json.optString("deviceToken")
                        if (token.isBlank()) {
                            pairError = "The server did not send a device token. Please try again."
                        } else {
                            val name = result.json.optJSONObject("device")?.optString("name").orEmpty()
                            store.savePairing(address, token, name.ifBlank { Build.MODEL })
                            repairing = false
                            Workers.scheduleHeartbeat(this)
                            Workers.sendNow(this)
                        }
                    }
                    is ApiResult.Rejected -> pairError = result.message
                    is ApiResult.Retry -> pairError = "Could not reach the server. Check the address and your connection."
                    ApiResult.Unauthorized -> pairError = "The server refused the request."
                }
                render()
            }
        }
    }

    // ----------------------------------------------------------------- status

    private fun renderStatus() {
        heading("ZevaPay SMS")
        note("Connected as ${store.deviceName ?: "this phone"}. This app only forwards payment SMS from " +
            "bKash, Nagad, Rocket (16216) and Upay. The server decides whether a payment matches.")

        val smsOk = checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
        val batteryOk = (getSystemService(POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(packageName)
        val waiting = queue.pendingCount()

        line("SMS permission", if (smsOk) "Allowed" else "Not allowed. Payments will be missed.", ok = smsOk)
        line(
            "Battery",
            if (batteryOk) "Not restricted" else "Android may stop this app in the background.",
            ok = batteryOk,
        )
        line("Waiting to send", if (waiting == 0) "Nothing" else "$waiting message(s)", ok = waiting == 0)
        line(
            "Last check-in",
            if (store.lastHeartbeatAt == 0L) "Not yet"
            else DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(Date(store.lastHeartbeatAt)),
            ok = store.lastHeartbeatAt != 0L,
        )

        if (!smsOk) button("Allow SMS") {
            requestPermissions(arrayOf(Manifest.permission.RECEIVE_SMS), 1)
        }
        if (!batteryOk) button("Allow running in the background") {
            startActivity(
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")),
            )
        }
        if (waiting > 0) button("Send now") {
            Workers.sendNow(this)
            render()
        }

        heading("Recent messages", small = true)
        val recent = queue.recent(20)
        if (recent.isEmpty()) {
            note("Nothing yet. A payment SMS from one of the four providers will appear here.")
        } else {
            val time = DateFormat.getTimeInstance(DateFormat.SHORT)
            for (message in recent) {
                val state = when (message.state) {
                    "SENT" -> message.detail ?: "Sent"
                    "FAILED" -> "Not accepted: ${message.detail ?: "unknown reason"}"
                    else -> "Waiting to send" + (message.detail?.let { " ($it)" } ?: "")
                }
                val instant = runCatching { java.time.Instant.parse(message.receivedAt).toEpochMilli() }.getOrNull()
                val at = instant?.let { time.format(Date(it)) } ?: ""
                line("${message.provider.label} $at", state, ok = message.state == "SENT")
                // The text of the SMS is shown here on the phone only.
                note(message.body)
            }
        }

        button("Connect again") {
            repairing = true
            render()
        }
    }

    // ---------------------------------------------------------------- helpers

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private fun heading(text: String, small: Boolean = false) {
        root.addView(TextView(this).apply {
            this.text = text
            textSize = if (small) 16f else 22f
            setPadding(0, dp(if (small) 20 else 4), 0, dp(8))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        })
    }

    private fun note(text: String, warning: Boolean = false) {
        root.addView(TextView(this).apply {
            this.text = text
            textSize = 13f
            setPadding(0, dp(2), 0, dp(8))
            if (warning) setTextColor(0xFFB45309.toInt())
        })
    }

    private fun line(label: String, value: String, ok: Boolean) {
        root.addView(LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, dp(6), 0, dp(6))
            addView(TextView(context).apply {
                text = label
                textSize = 12f
                setTextColor(0xFF475569.toInt())
            })
            addView(TextView(context).apply {
                text = value
                textSize = 15f
                setTextColor(if (ok) 0xFF047857.toInt() else 0xFFB45309.toInt())
            })
        })
    }

    private fun field(label: String, initial: String, inputType: Int): EditText {
        root.addView(TextView(this).apply {
            text = label
            textSize = 12f
            setPadding(0, dp(8), 0, 0)
        })
        return EditText(this).apply {
            setText(initial)
            this.inputType = InputType.TYPE_CLASS_TEXT or inputType
            setSingleLine()
            root.addView(this)
        }
    }

    private fun button(text: String, onClick: () -> Unit) {
        root.addView(Button(this).apply {
            this.text = text
            setOnClickListener { onClick() }
        })
    }
}
