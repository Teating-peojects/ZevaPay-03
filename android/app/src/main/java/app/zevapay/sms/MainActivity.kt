package app.zevapay.sms

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
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
    /** Outer column: the brand header plus the scrolling body below it. */
    private lateinit var root: LinearLayout
    /** Everything other than the header is added here. */
    private lateinit var body: LinearLayout
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

    // ----------------------------------------------------------------- brand

    private object Brand {
        const val NAVY = 0xFF03084A.toInt()
        const val SOLID = 0xFF0A3CFF.toInt()
        const val SOLID_DARK = 0xFF0626B8.toInt()
        const val CYAN = 0xFF00D4FF.toInt()
        const val CYAN_LIGHT = 0xFFBFE9FF.toInt()
        const val INK = 0xFF0F172A.toInt()
        const val INK_MUTED = 0xFF5B6B8C.toInt()
        const val LINE = 0xFFE1E6F5.toInt()
        const val SURFACE = 0xFFFFFFFF.toInt()
        const val CANVAS = 0xFFF3F5FC.toInt()
        const val SUCCESS = 0xFF047857.toInt()
        const val SUCCESS_TINT = 0xFFE7F8F1.toInt()
        const val WARNING = 0xFFB45309.toInt()
        const val WARNING_TINT = 0xFFFFF4E5.toInt()
        const val WHITE = 0xFFFFFFFF.toInt()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        title = "ZevaPay SMS"
        store = Store(this)
        queue = Queue(this)
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Brand.CANVAS)
        }
        body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(16), dp(16), dp(24))
        }
        setContentView(
            ScrollView(this).apply {
                setBackgroundColor(Brand.CANVAS)
                addView(root)
            },
        )
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
        body.removeAllViews()
        root.addView(header())
        root.addView(body)
        if (!store.isPaired || store.tokenRejected || repairing) renderConnect() else renderStatus()
    }

    /** The logo mark, wordmark and a one-line tagline on a navy-to-blue gradient. */
    private fun header(): View {
        val tagline = if (store.isPaired && !store.tokenRejected && !repairing) {
            store.deviceName ?: "This phone is connected"
        } else {
            "Payment SMS forwarder"
        }
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(18), dp(20), dp(18), dp(20))
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(Brand.NAVY, Brand.SOLID),
            )
            addView(
                ImageView(this@MainActivity).apply {
                    setImageResource(R.drawable.logo_mark)
                    layoutParams = LinearLayout.LayoutParams(dp(38), dp(38)).apply { marginEnd = dp(12) }
                },
            )
            addView(
                LinearLayout(this@MainActivity).apply {
                    orientation = LinearLayout.VERTICAL
                    addView(
                        TextView(this@MainActivity).apply {
                            text = "ZevaPay"
                            textSize = 19f
                            setTextColor(Brand.WHITE)
                            setTypeface(typeface, Typeface.BOLD)
                        },
                    )
                    addView(
                        TextView(this@MainActivity).apply {
                            text = tagline
                            textSize = 12f
                            setTextColor(Brand.CYAN_LIGHT)
                            setPadding(0, dp(2), 0, 0)
                        },
                    )
                },
            )
        }
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
            outlineButton("Cancel") {
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

        primaryButton("Next") {
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

        primaryButton(if (connecting) "Connecting…" else "Connect", enabled = !connecting) {
            connect(key.text.toString())
        }
        if (!connecting) {
            outlineButton("Back") {
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

        val requestBody = JSONObject()
            .put("email", email)
            .put("password", password)
            .put("deviceKey", key)
            .put("deviceId", store.deviceId)
            .put("deviceName", Build.MODEL.take(80).ifBlank { "Android phone" })
            .put("androidVersion", Build.VERSION.RELEASE.orEmpty().take(40))

        val target = address
        background.execute {
            val result = Api.post(target, "/api/v1/device/connect", requestBody, token = null)
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
        heading("Status")
        note("This app only forwards payment SMS from bKash, Nagad, Rocket (16216) and Upay. " +
            "The server decides whether a payment matches.")

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
                outlineButton("Open settings") { openAppSettings() }
            } else {
                outlineButton("Allow SMS") {
                    askedPermissions = true
                    requestPermissions(arrayOf(Manifest.permission.RECEIVE_SMS), 1)
                }
            }
        }
        if (!notifyOk) {
            val settings = Build.VERSION.SDK_INT < 33 || needsSettings(Manifest.permission.POST_NOTIFICATIONS)
            outlineButton(if (settings) "Open notification settings" else "Allow notifications") {
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
        if (!batteryOk) outlineButton("Allow running in the background") {
            startActivity(
                Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")),
            )
        }
        if (waiting > 0) outlineButton("Send now") {
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

        outlineButton("Connect again") {
            resetConnect()
            repairing = true
            render()
        }
    }

    // ---------------------------------------------------------------- helpers

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private fun pill(color: Int, corner: Float = dp(12).toFloat()) = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = corner
        setColor(color)
    }

    private fun outline(strokeColor: Int, fillColor: Int = Brand.SURFACE, corner: Float = dp(12).toFloat()) =
        GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = corner
            setColor(fillColor)
            setStroke(dp(1), strokeColor)
        }

    private fun heading(text: String, small: Boolean = false) {
        body.addView(TextView(this).apply {
            this.text = text
            textSize = if (small) 15f else 18f
            setTextColor(Brand.INK)
            setPadding(0, dp(if (small) 20 else 6), 0, dp(10))
            setTypeface(typeface, Typeface.BOLD)
        })
    }

    private fun note(text: String, warning: Boolean = false) {
        if (warning) {
            body.addView(TextView(this).apply {
                this.text = text
                textSize = 13f
                setTextColor(Brand.WARNING)
                background = outline(Brand.WARNING, Brand.WARNING_TINT, dp(10).toFloat())
                setPadding(dp(12), dp(10), dp(12), dp(10))
                val params = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
                params.bottomMargin = dp(10)
                layoutParams = params
            })
            return
        }
        body.addView(TextView(this).apply {
            this.text = text
            textSize = 13f
            setTextColor(Brand.INK_MUTED)
            setPadding(0, dp(2), 0, dp(10))
        })
    }

    private fun line(label: String, value: String, ok: Boolean) {
        val card = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            background = outline(Brand.LINE, Brand.SURFACE, dp(12).toFloat())
            val params = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            params.bottomMargin = dp(8)
            layoutParams = params
        }
        card.addView(
            View(this).apply {
                layoutParams = LinearLayout.LayoutParams(dp(4), LinearLayout.LayoutParams.MATCH_PARENT)
                setBackgroundColor(if (ok) Brand.SUCCESS else Brand.WARNING)
            },
        )
        card.addView(
            LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(12), dp(10), dp(12), dp(10))
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                addView(
                    TextView(context).apply {
                        text = label
                        textSize = 11.5f
                        setTextColor(Brand.INK_MUTED)
                    },
                )
                addView(
                    TextView(context).apply {
                        text = value
                        textSize = 14.5f
                        setTextColor(if (ok) Brand.SUCCESS else Brand.WARNING)
                        setTypeface(typeface, Typeface.BOLD)
                        setPadding(0, dp(2), 0, 0)
                    },
                )
            },
        )
        body.addView(card)
    }

    private fun field(label: String, initial: String, inputType: Int): EditText {
        body.addView(TextView(this).apply {
            text = label
            textSize = 12f
            setTextColor(Brand.INK_MUTED)
            setPadding(0, dp(8), 0, dp(4))
        })
        return EditText(this).apply {
            setText(initial)
            this.inputType = InputType.TYPE_CLASS_TEXT or inputType
            setSingleLine()
            setTextColor(Brand.INK)
            setHintTextColor(Brand.INK_MUTED)
            background = outline(Brand.LINE, Brand.SURFACE, dp(10).toFloat())
            setPadding(dp(12), dp(10), dp(12), dp(10))
            val params = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            params.bottomMargin = dp(4)
            layoutParams = params
            body.addView(this)
        }
    }

    /** The main call to action: a solid logo-blue button with white text. */
    private fun primaryButton(text: String, enabled: Boolean = true, onClick: () -> Unit) {
        body.addView(Button(this).apply {
            this.text = text
            isAllCaps = false
            isEnabled = enabled
            setTextColor(Brand.WHITE)
            setTypeface(typeface, Typeface.BOLD)
            background = GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(Brand.SOLID, Brand.SOLID_DARK),
            ).apply { cornerRadius = dp(12).toFloat() }
            alpha = if (enabled) 1f else 0.6f
            setPadding(dp(16), dp(12), dp(16), dp(12))
            val params = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            params.topMargin = dp(6)
            layoutParams = params
            setOnClickListener { onClick() }
        })
    }

    /** A secondary action: an outlined button in logo blue. */
    private fun outlineButton(text: String, onClick: () -> Unit) {
        body.addView(Button(this).apply {
            this.text = text
            isAllCaps = false
            setTextColor(Brand.SOLID)
            setTypeface(typeface, Typeface.BOLD)
            background = outline(Brand.SOLID, Brand.SURFACE, dp(12).toFloat())
            setPadding(dp(16), dp(12), dp(16), dp(12))
            val params = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
            params.topMargin = dp(6)
            layoutParams = params
            setOnClickListener { onClick() }
        })
    }
}
