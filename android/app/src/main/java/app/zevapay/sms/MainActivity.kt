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
 * One screen. Not connected: sign in with email and password, then enter the phone key.
 * Connected: show whether SMS are getting through, and what the server said about
 * the latest ones.
 */
class MainActivity : Activity() {
    private lateinit var store: Store
    private lateinit var queue: Queue
    private lateinit var root: LinearLayout
    private val background = Executors.newSingleThreadExecutor()
    private var repairing = false
    private var step = 1
    private var address = ""
    private var email = ""
    /** Kept in memory for the two steps only. Never saved, never logged. */
    private var password = ""
    private var connectError: String? = null
    private var connecting = false
    /** Set once we have shown Android's permission dialogs in this run. */
    private var askedPermissions = false

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
            if (!store.tokenRejected) {
                Workers.sendNow(this)
                Alerts.clearAttention(this)
                askForMissingPermissions()
            }
        }
        render()
    }

    override fun onRequestPermissionsResult(code: Int, permissions: Array<out String>, results: IntArray) {
        super.onRequestPermissionsResult(code, permissions, results)
        render()
    }

    /** The permissions this app cannot do its job without, and whether each is granted. */
    private fun wanted(): List<String> = buildList {
        add(Manifest.permission.RECEIVE_SMS)
        if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
    }

    private fun granted(permission: String) =
        checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    /**
     * Asks for whatever is still missing, once per run, as soon as the phone is
     * connected. If Android will no longer show the dialog (the user chose
     * "don't allow", or the app was installed outside the Play Store and
     * Android restricts it), the status screen shows a button to Settings.
     */
    private fun askForMissingPermissions() {
        if (askedPermissions) return
        val missing = wanted().filterNot { granted(it) }
        if (missing.isEmpty()) return
        askedPermissions = true
        requestPermissions(missing.toTypedArray(), 1)
    }

    /** True when asking again would show nothing, so only Settings can help. */
    private fun needsSettings(permission: String) =
        askedPermissions && !granted(permission) && !shouldShowRequestPermissionRationale(permission)

    private fun openAppSettings() {
        startActivity(
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")),
        )
    }

    private fun render() {
        root.removeAllViews()
        if (!store.isPaired || store.tokenRejected || repairing) renderConnect() else renderStatus()
    }

    // ---------------------------------------------------------------- connect

    /**
     * Two steps. First the ZevaPay address and the merchant's email and
     * password; then the phone key made on the website. Nothing is sent until
     * the second step, and the password is kept in memory only, never saved.
     */
    private fun renderConnect() {
        heading("Connect this phone")
        if (store.tokenRejected) {
            note(
                "The server no longer accepts this phone. It may have been removed in the dashboard. " +
                    "Sign in again to connect it. Messages already received are kept and will be sent.",
                warning = true,
            )
        }
        if (step == 1) renderSignIn() else renderPhoneKey()

        if (repairing && store.isPaired) {
            button("Cancel") {
                repairing = false
                resetConnect()
                render()
            }
        }
    }

    private fun renderSignIn() {
        note("Step 1 of 2. Sign in with the email and password you use on the ZevaPay website.")
        val url = field("ZevaPay address", address.ifBlank { store.baseUrl ?: "https://" }, InputType.TYPE_TEXT_VARIATION_URI)
        val mail = field("Email", email, InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS)
        val pass = field("Password", "", InputType.TYPE_TEXT_VARIATION_PASSWORD)
        connectError?.let { note(it, warning = true) }

        button("Next") {
            val normalized = UrlRules.normalize(url.text.toString(), allowHttp = BuildConfig.DEBUG)
            val typedEmail = mail.text.toString().trim()
            val typedPassword = pass.text.toString()
            connectError = when {
                normalized == null -> "Enter a full address that starts with https://."
                !typedEmail.contains("@") -> "Enter the email you use on ZevaPay."
                typedPassword.isEmpty() -> "Enter your password."
                else -> null
            }
            if (connectError == null) {
                address = normalized!!
                email = typedEmail
                password = typedPassword
                step = 2
            }
            render()
        }
    }

    private fun renderPhoneKey() {
        note(
            "Step 2 of 2. On the ZevaPay website open Devices, tap Connect, make a phone key and paste it here. " +
                "The key is shown only once.",
        )
        val key = field("Phone key", "", InputType.TYPE_TEXT_VARIATION_PASSWORD)
        connectError?.let { note(it, warning = true) }

        root.addView(Button(this).apply {
            text = if (connecting) "Connecting…" else "Connect"
            isEnabled = !connecting
            setOnClickListener { connect(key.text.toString()) }
        })
        if (!connecting) {
            button("Back") {
                connectError = null
                step = 1
                render()
            }
        }
    }

    private fun resetConnect() {
        step = 1
        password = ""
        connectError = null
        connecting = false
    }

    private fun connect(keyInput: String) {
        val key = keyInput.trim()
        if (key.length < 10) {
            connectError = "Paste the phone key from the website."
            render()
            return
        }

        connectError = null
        connecting = true
        render()

        val body = JSONObject()
            .put("email", email)
            .put("password", password)
            .put("deviceKey", key)
            .put("deviceId", store.deviceId)
            .put("deviceName", Build.MODEL.take(80).ifBlank { "Android phone" })
            .put("androidVersion", Build.VERSION.RELEASE.orEmpty().take(40))

        val target = address
        background.execute {
            val result = Api.post(target, "/api/v1/device/connect", body, token = null)
            runOnUiThread {
                connecting = false
                when (result) {
                    is ApiResult.Ok -> {
                        val token = result.json.optString("deviceToken")
                        if (token.isBlank()) {
                            connectError = "The server did not send a device token. Please try again."
                        } else {
                            val name = result.json.optJSONObject("device")?.optString("name").orEmpty()
                            store.savePairing(target, token, name.ifBlank { Build.MODEL })
                            repairing = false
                            resetConnect()
                            Workers.scheduleHeartbeat(this)
                            Workers.sendNow(this)
                            askForMissingPermissions()
                        }
                    }
                    is ApiResult.Rejected -> {
                        connectError = result.message
                        // A wrong email or password goes back to step 1; a wrong key stays.
                        if (result.code == INVALID_CREDENTIALS) {
                            password = ""
                            step = 1
                        }
                    }
                    is ApiResult.Retry -> connectError = "Could not reach the server. Check the address and your connection."
                    ApiResult.Unauthorized -> connectError = "The server refused the request."
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

        val smsOk = granted(Manifest.permission.RECEIVE_SMS)
        val notifyOk = Alerts.allowed(this)
        val batteryOk = (getSystemService(POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(packageName)
        val waiting = queue.pendingCount()

        line("SMS permission", if (smsOk) "Allowed" else "Not allowed. Payments will be missed.", ok = smsOk)
        line(
            "Notifications",
            if (notifyOk) "Allowed" else "Not allowed. You will not be told when a payment needs you.",
            ok = notifyOk,
        )
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

        if (!smsOk) {
            if (needsSettings(Manifest.permission.RECEIVE_SMS)) {
                note(
                    "Android is not showing the SMS question. Open settings, tap the three dots at the top " +
                        "right, choose \"Allow restricted settings\", then Permissions, then SMS, then Allow.",
                    warning = true,
                )
                button("Open settings") { openAppSettings() }
            } else {
                button("Allow SMS") {
                    askedPermissions = true
                    requestPermissions(arrayOf(Manifest.permission.RECEIVE_SMS), 1)
                }
            }
        }
        if (!notifyOk) {
            val settings = Build.VERSION.SDK_INT < 33 || needsSettings(Manifest.permission.POST_NOTIFICATIONS)
            button(if (settings) "Open notification settings" else "Allow notifications") {
                if (settings) {
                    startActivity(
                        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                            .putExtra(Settings.EXTRA_APP_PACKAGE, packageName),
                    )
                } else {
                    askedPermissions = true
                    requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 2)
                }
            }
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
            resetConnect()
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
