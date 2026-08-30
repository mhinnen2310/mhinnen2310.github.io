package nl.demifietsen.staff

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import android.util.Base64
import java.util.UUID
import java.security.SecureRandom
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

/** Thin transport only: every decision and mutation remains in the Demi backend. */
class DemiApi(private val baseUrl: String, private val sessions: SessionStore) {
  private val client = OkHttpClient()
  private fun request(path: String, method: String = "GET", body: JSONObject? = null): Request = Request.Builder().url("${baseUrl.trimEnd('/')}$path")
    .header("Authorization", "Bearer ${sessions.token() ?: ""}").method(method, body?.toString()?.toRequestBody("application/json".toMediaType())).build()
  private fun execute(request: Request): JSONObject = client.newCall(request).execute().use { response ->
    val text = response.body?.string().orEmpty(); if (!response.isSuccessful) throw ApiException(response.code, JSONObject(text.ifBlank { "{}" }).optString("error", "Verzoek mislukt.")); JSONObject(text)
  }
  fun resolveQr(token: String) = execute(request("/api/mobile/qr/$token"))
  fun bike(id: String) = execute(request("/api/mobile/bikes/$id"))
  fun inventory() = execute(request("/api/mobile/bikes"))
  fun bindQr(token: String, bikeId: String) = execute(request("/api/mobile/qr/$token", "POST", JSONObject().put("bikeId", bikeId)))
  fun createBike(payload: JSONObject) = execute(request("/api/mobile/bikes", "POST", payload))
  fun saveIntake(bikeId: String, payload: JSONObject) = execute(request("/api/mobile/bikes/$bikeId/intake", "PATCH", payload))
  fun workshop(bikeId: String, payload: JSONObject) = execute(request("/api/mobile/bikes/$bikeId/service-tasks", "POST", payload))
  fun confirmCash(orderId: String, cashReceivedCents: Int? = null, changeReturnedCents: Int? = null): JSONObject {
    val body = JSONObject().put("method", "CASH")
    if (cashReceivedCents != null) body.put("cashReceivedCents", cashReceivedCents)
    if (changeReturnedCents != null) body.put("changeReturnedCents", changeReturnedCents)
    return execute(request("/api/mobile/orders/$orderId/manual-payment", "POST", body))
  }
  fun startSale(payload: JSONObject) = execute(request("/api/mobile/orders", "POST", payload))
  fun login(email: String, password: String): JSONObject {
    val body = JSONObject().put("email", email).put("password", password).put("deviceId", sessions.deviceId())
    val result = execute(request("/api/mobile/auth/login", "POST", body))
    sessions.saveTokens(result.getString("accessToken"), result.getString("refreshToken"))
    return result
  }
  fun refresh(): JSONObject {
    val refresh = sessions.refreshToken() ?: throw ApiException(401, "Log opnieuw in.")
    val result = execute(request("/api/mobile/auth/refresh", "POST", JSONObject().put("refreshToken", refresh).put("deviceId", sessions.deviceId())))
    sessions.saveTokens(result.getString("accessToken"), result.getString("refreshToken"))
    return result
  }
  fun logout() { try { execute(request("/api/mobile/auth/logout", "POST")) } finally { sessions.clear() } }
}
class ApiException(val code: Int, override val message: String): Exception(message)
class SessionStore(context: Context) {
  private val prefs = EncryptedSharedPreferences.create(context, "mobile-session", MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(), EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV, EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM)
  fun token() = prefs.getString("access_token", null)
  fun refreshToken() = prefs.getString("refresh_token", null)
  fun deviceId() = prefs.getString("device_id", null) ?: UUID.randomUUID().toString().also { prefs.edit().putString("device_id", it).apply() }
  fun saveTokens(accessToken: String, refreshToken: String) = prefs.edit().putString("access_token", accessToken).putString("refresh_token", refreshToken).apply()
  private fun pinHash(pin: String, salt: ByteArray): String {
    val chars = pin.toCharArray()
    return try { Base64.encodeToString(SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(PBEKeySpec(chars, salt, 210_000, 256)).encoded, Base64.NO_WRAP) }
    finally { chars.fill('\u0000') }
  }
  fun hasPin() = prefs.contains("pin_hash") && prefs.contains("pin_salt")
  // The first-run screen immediately checks hasPin() after this call. Commit
  // synchronously so that Compose cannot render the setup screen once more
  // while SharedPreferences.apply() is still queued.
  fun savePin(pin: String) { val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }; prefs.edit().putString("pin_salt", Base64.encodeToString(salt, Base64.NO_WRAP)).putString("pin_hash", pinHash(pin, salt)).commit() }
  fun verifyPin(pin: String): Boolean { val encoded = prefs.getString("pin_salt", null) ?: return false; val expected = prefs.getString("pin_hash", null) ?: return false; return java.security.MessageDigest.isEqual(expected.toByteArray(), pinHash(pin, Base64.decode(encoded, Base64.NO_WRAP)).toByteArray()) }
  fun clear() = prefs.edit().remove("access_token").remove("refresh_token").apply()
}
