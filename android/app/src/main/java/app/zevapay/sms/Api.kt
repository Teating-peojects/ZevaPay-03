package app.zevapay.sms

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

sealed class ApiResult {
    data class Ok(val json: JSONObject) : ApiResult()

    /** The device token is wrong, or the device was removed in the dashboard. */
    data object Unauthorized : ApiResult()

    /** The server will never accept this request as it is. Do not retry it. */
    data class Rejected(val message: String, val code: String? = null) : ApiResult()

    /** Try again later: no network, too many requests, or a server error. */
    data class Retry(val reason: String) : ApiResult()
}

const val INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
const val INVALID_DEVICE_KEY = "INVALID_DEVICE_KEY"
private val CONNECT_ERRORS = setOf(INVALID_CREDENTIALS, INVALID_DEVICE_KEY)

/** Maps an HTTP status to what the app should do. Pure, so it can be tested. */
fun classify(status: Int, json: JSONObject?): ApiResult = when {
    status in 200..299 -> ApiResult.Ok(json ?: JSONObject())
    // Signing in a phone answers 401 for a wrong email/password or phone key.
    // Those are not "this phone was removed", so they keep their own code.
    status == 401 && json?.optJSONObject("error")?.optString("code") in CONNECT_ERRORS ->
        ApiResult.Rejected(
            json?.optJSONObject("error")?.optString("message").orEmpty().ifBlank { "The server refused the request." },
            json?.optJSONObject("error")?.optString("code"),
        )
    status == 401 -> ApiResult.Unauthorized
    status == 429 || status >= 500 -> ApiResult.Retry("The server answered $status.")
    else -> ApiResult.Rejected(
        json?.optJSONObject("error")?.optString("message")?.takeIf { it.isNotBlank() }
            ?: "The server answered $status.",
    )
}

object Api {
    fun post(baseUrl: String, path: String, body: JSONObject, token: String?): ApiResult {
        var connection: HttpURLConnection? = null
        return try {
            connection = (URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = 15_000
                readTimeout = 20_000
                doOutput = true
                instanceFollowRedirects = false
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
                if (token != null) setRequestProperty("Authorization", "Bearer $token")
            }
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }

            val status = connection.responseCode
            val stream = if (status >= 400) connection.errorStream else connection.inputStream
            val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = try {
                if (text.isBlank()) null else JSONObject(text)
            } catch (e: Exception) {
                null
            }
            classify(status, json)
        } catch (e: IOException) {
            ApiResult.Retry(e.message ?: "No connection.")
        } finally {
            connection?.disconnect()
        }
    }
}
