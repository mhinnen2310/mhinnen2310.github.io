package nl.demifietsen.staff

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MultipartBody
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
  private fun execute(request: Request, allowRefresh: Boolean = true): JSONObject {
    val (code, text) = client.newCall(request).execute().use { response -> response.code to response.body?.string().orEmpty() }
    if (code in 200..299) return JSONObject(text.ifBlank { "{}" })
    if (code == 401 && allowRefresh && sessions.refreshToken() != null && !request.url.encodedPath.startsWith("/api/mobile/auth/")) {
      refresh()
      val retried = request.newBuilder().header("Authorization", "Bearer ${sessions.token() ?: ""}").build()
      return execute(retried, false)
    }
    throw ApiException(code, JSONObject(text.ifBlank { "{}" }).optString("error", "Verzoek mislukt."))
  }
  fun resolveQr(token: String) = execute(request("/api/mobile/qr/$token"))
  fun bike(id: String) = execute(request("/api/mobile/bikes/$id"))
  fun updateBike(id: String, payload: JSONObject) = execute(request("/api/mobile/bikes/$id", "PATCH", payload))
  fun inventory() = execute(request("/api/mobile/bikes"))
  fun advertisement(id: String) = execute(request("/api/mobile/bikes/$id/advertisement"))
  fun notifications() = execute(request("/api/mobile/notifications"))
  fun reservations() = execute(request("/api/mobile/reservations"))
  fun reserve(payload: JSONObject) = execute(request("/api/mobile/reservations", "POST", payload))
  fun releaseReservation(id: String) = execute(request("/api/mobile/reservations/$id", "DELETE"))
  fun updateBikeImage(bikeId: String, imageId: String, action: String, isInternal: Boolean? = null): JSONObject {
    val body = JSONObject().put("action", action).put("imageId", imageId)
    if (isInternal != null) body.put("isInternal", isInternal)
    return execute(request("/api/mobile/bikes/$bikeId/images", "PATCH", body))
  }
  fun uploadBikeImage(bikeId: String, name: String, bytes: ByteArray, contentType: String): JSONObject {
    val body = MultipartBody.Builder().setType(MultipartBody.FORM).addFormDataPart("image", name, bytes.toRequestBody(contentType.toMediaType())).build()
    val request = Request.Builder().url("${baseUrl.trimEnd('/')}/api/mobile/bikes/$bikeId/images").header("Authorization", "Bearer ${sessions.token() ?: ""}").post(body).build()
    return execute(request)
  }
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
  @Synchronized fun refresh(): JSONObject {
    val refresh = sessions.refreshToken() ?: throw ApiException(401, "Log opnieuw in.")
    val result = execute(request("/api/mobile/auth/refresh", "POST", JSONObject().put("refreshToken", refresh).put("deviceId", sessions.deviceId())), false)
    sessions.saveTokens(result.getString("accessToken"), result.getString("refreshToken"))
    return result
  }
  fun prepareLogout(): () -> Unit {
    val logoutRequest = request("/api/mobile/auth/logout", "POST")
    sessions.clear()
    return { try { execute(logoutRequest, false) } catch (_: Exception) { } }
  }
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
  fun biometricEnabled() = prefs.getBoolean("biometric_enabled", false)
  fun setBiometricEnabled(enabled: Boolean) = prefs.edit().putBoolean("biometric_enabled", enabled).apply()
  fun notificationEnabled(category: String) = prefs.getBoolean("notification_$category", true)
  fun setNotificationEnabled(category: String, enabled: Boolean) = prefs.edit().putBoolean("notification_$category", enabled).apply()
  // The first-run screen immediately checks hasPin() after this call. Commit
  // synchronously so that Compose cannot render the setup screen once more
  // while SharedPreferences.apply() is still queued.
  fun savePin(pin: String) { val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }; prefs.edit().putString("pin_salt", Base64.encodeToString(salt, Base64.NO_WRAP)).putString("pin_hash", pinHash(pin, salt)).commit() }
  fun changePin(current: String, next: String): Boolean { if (!verifyPin(current)) return false; savePin(next); return true }
  fun verifyPin(pin: String): Boolean { val encoded = prefs.getString("pin_salt", null) ?: return false; val expected = prefs.getString("pin_hash", null) ?: return false; return java.security.MessageDigest.isEqual(expected.toByteArray(), pinHash(pin, Base64.decode(encoded, Base64.NO_WRAP)).toByteArray()) }
  fun clear() = prefs.edit().remove("access_token").remove("refresh_token").remove("pin_hash").remove("pin_salt").remove("biometric_enabled").apply()
}
