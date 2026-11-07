package app.zevapay.sms

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.security.SecureRandom

/** Everything the app remembers. Kept in encrypted storage, because it holds the device token. */
class Store(context: Context) {
    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context.applicationContext,
        "zevapay_secure",
        MasterKey.Builder(context.applicationContext).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    val baseUrl: String? get() = prefs.getString("baseUrl", null)
    val token: String? get() = prefs.getString("token", null)
    val deviceName: String? get() = prefs.getString("deviceName", null)
    val lastHeartbeatAt: Long get() = prefs.getLong("lastHeartbeatAt", 0L)

    /** True once the server has refused our token. Sending stops until the phone is paired again. */
    val tokenRejected: Boolean get() = prefs.getBoolean("tokenRejected", false)

    val isPaired: Boolean get() = token != null && baseUrl != null

    /** A stable identifier, made once. Pairing again keeps it, so the dashboard keeps one device. */
    val deviceId: String
        get() = prefs.getString("deviceId", null) ?: run {
            val bytes = ByteArray(3).also { SecureRandom().nextBytes(it) }
            val id = "ZP-SMS-" + bytes.joinToString("") { "%02X".format(it) }
            prefs.edit().putString("deviceId", id).apply()
            id
        }

    fun savePairing(baseUrl: String, token: String, deviceName: String) {
        prefs.edit()
            .putString("baseUrl", baseUrl)
            .putString("token", token)
            .putString("deviceName", deviceName)
            .putBoolean("tokenRejected", false)
            .apply()
    }

    fun rememberBaseUrl(baseUrl: String) {
        prefs.edit().putString("baseUrl", baseUrl).apply()
    }

    fun markTokenRejected() {
        prefs.edit().putBoolean("tokenRejected", true).apply()
    }

    fun markHeartbeat(now: Long) {
        prefs.edit().putLong("lastHeartbeatAt", now).apply()
    }
}
