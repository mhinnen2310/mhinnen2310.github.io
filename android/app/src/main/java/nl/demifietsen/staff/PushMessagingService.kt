package nl.demifietsen.staff

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.util.concurrent.Executors

private const val OPERATIONAL_CHANNEL = "operational"

/**
 * Receives real FCM messages and keeps the server-side device registry in sync.
 * The service remains safe on builds without google-services.json: Firebase
 * simply has no initialized app and registration is skipped until the real
 * Firebase project is added.
 */
class PushMessagingService : FirebaseMessagingService() {
  override fun onNewToken(token: String) {
    PushRegistrar.registerToken(applicationContext, token)
  }

  override fun onMessageReceived(message: RemoteMessage) {
    val category = message.data["category"] ?: "inventory"
    val sessions = SessionStore(this)
    if (!sessions.notificationEnabled(category)) return
    val title = message.notification?.title ?: message.data["title"] ?: "Demi Fietsen"
    val body = message.notification?.body ?: message.data["body"] ?: "Er staat een nieuwe actie klaar."
    ensureNotificationChannel(this)
    val openIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("notification_category", category)
      putExtra("notification_href", message.data["href"])
    }
    val pendingIntent = PendingIntent.getActivity(this, category.hashCode(), openIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = NotificationCompat.Builder(this, OPERATIONAL_CHANNEL)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
      .build()
    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) return
    runCatching { NotificationManagerCompat.from(this).notify((category.hashCode() * 31 + body.hashCode()).and(0x7fffffff), notification) }
  }

  companion object {
    fun ensureNotificationChannel(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val manager = context.getSystemService(NotificationManager::class.java)
      manager.createNotificationChannel(NotificationChannel(OPERATIONAL_CHANNEL, "Operationele meldingen", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Verkopen, voorraad, reserveringen, betalingen en werkplaats"
      })
    }
  }
}

object PushRegistrar {
  private val executor = Executors.newSingleThreadExecutor()

  fun registerCurrent(context: Context) {
    try {
      FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
        if (task.isSuccessful) registerToken(context.applicationContext, task.result)
      }
    } catch (_: IllegalStateException) {
      // No Firebase app is configured yet. The app remains usable with its
      // in-app notification polling until google-services.json is installed.
    }
  }

  fun registerToken(context: Context, token: String) {
    if (token.isBlank()) return
    executor.execute {
      val sessions = SessionStore(context.applicationContext)
      if (sessions.token() == null) return@execute
      runCatching { DemiApi(BuildConfig.API_BASE_URL, sessions).registerPushToken(token) }
    }
  }

  fun unregisterCurrent(context: Context, api: DemiApi) {
    val sessions = SessionStore(context.applicationContext)
    val token = sessions.pushToken() ?: return
    executor.execute { runCatching { api.unregisterPushToken(token) } }
  }
}
