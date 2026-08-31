package nl.demifietsen.staff

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.time.LocalDate
import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID

class MainActivity : FragmentActivity() {
  private val cameraPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
  private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
  private var pendingQrToken by mutableStateOf<String?>(null)

  private fun qrTokenFrom(intent: Intent?): String? {
    if (intent?.action != Intent.ACTION_VIEW) return null
    val uri = intent.data ?: return null
    val apiUri = android.net.Uri.parse(BuildConfig.API_BASE_URL)
    if (uri.scheme != apiUri.scheme || uri.host != apiUri.host) return null
    if (uri.pathSegments.size != 2 || uri.pathSegments[0] != "q") return null
    return uri.pathSegments[1].takeIf { it.matches(Regex("[A-Za-z0-9_-]{43}")) }
  }

  override fun onCreate(state: Bundle?) {
    super.onCreate(state)
    pendingQrToken = qrTokenFrom(intent)
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) cameraPermission.launch(Manifest.permission.CAMERA)
    PushMessagingService.ensureNotificationChannel(this)
    setContent { DemiTheme { StaffRoot(SessionStore(this), BuildConfig.API_BASE_URL, this, pendingQrToken) { pendingQrToken = null } } }
  }
  override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); pendingQrToken = qrTokenFrom(intent) }
  fun unlockWithBiometric(onSuccess: () -> Unit) {
    if (BiometricManager.from(this).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) != BiometricManager.BIOMETRIC_SUCCESS) return
    BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { onSuccess() }
    }).authenticate(BiometricPrompt.PromptInfo.Builder().setTitle("Demi Fietsen").setSubtitle("Ontgrendel de medewerkersapp").setNegativeButtonText("Gebruik pincode").build())
  }
  fun requestNotificationPermission() {
    if (android.os.Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
  }
}

private suspend fun <T> background(action: () -> T): Result<T> = withContext(Dispatchers.IO) { runCatching(action) }

private fun Modifier.pullToRefresh(isRefreshing: Boolean, onRefresh: () -> Unit): Modifier = pointerInput(isRefreshing) {
  var distance = 0f
  detectVerticalDragGestures(
    // Do not consume the gesture here: the child LazyColumn must keep its
    // normal scrolling behaviour. A long downward drag also refreshes.
    onVerticalDrag = { _, amount -> if (amount > 0) distance += amount },
    onDragEnd = { if (distance >= 96f && !isRefreshing) onRefresh(); distance = 0f },
    onDragCancel = { distance = 0f },
  )
}

@Composable private fun StaffRoot(sessions: SessionStore, baseUrl: String, activity: MainActivity, deepLinkToken: String?, consumeDeepLink: () -> Unit) {
  val api = remember { DemiApi(baseUrl, sessions) }
  val scope = rememberCoroutineScope()
  var signedIn by remember { mutableStateOf(sessions.token() != null) }
  var unlocked by remember { mutableStateOf(!sessions.hasPin()) }
  // A fresh session starts with unlocked=true because no PIN exists yet. Keep
  // a separate Compose state for the setup completion so saving the first PIN
  // always triggers a recompose into StaffApp.
  var pinSetupComplete by remember { mutableStateOf(false) }
  LaunchedEffect(signedIn) {
    if (signedIn) {
      activity.requestNotificationPermission()
      PushRegistrar.registerCurrent(activity)
    }
  }
  LifecycleEventEffect(Lifecycle.Event.ON_STOP) { if (signedIn && sessions.hasPin()) unlocked = false }
  when {
    !signedIn -> LoginScreen(api, onLoggedIn = { signedIn = true; unlocked = !sessions.hasPin() })
    !sessions.hasPin() && !pinSetupComplete -> PinScreen("Kies een app-pincode", "Deze pincode ontgrendelt de app op dit toestel.", false, null, true) { pin -> sessions.savePin(pin); pinSetupComplete = true; unlocked = true; true }
    !unlocked -> PinScreen("App vergrendeld", "Voer je persoonlijke pincode in${if (sessions.biometricEnabled()) " of gebruik je vingerafdruk" else ""}.", sessions.biometricEnabled(), { activity.unlockWithBiometric { unlocked = true } }, false) { pin -> sessions.verifyPin(pin).also { if (it) unlocked = true } }
    else -> StaffApp(api, sessions, activity, deepLinkToken, consumeDeepLink, onLogout = { val serverLogout = api.prepareLogout(); scope.launch { background { serverLogout() } }; signedIn = false; unlocked = false; pinSetupComplete = false })
  }
}

@Composable private fun PinScreen(title: String, copy: String, allowBiometric: Boolean, biometric: (() -> Unit)?, setup: Boolean, submit: (String) -> Boolean) {
  var pin by remember { mutableStateOf("") }; var error by remember { mutableStateOf<String?>(null) }
  Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
    Text(title, style = MaterialTheme.typography.headlineMedium); Text(copy, color = MaterialTheme.colorScheme.onSurfaceVariant)
    Spacer(Modifier.height(20.dp)); OutlinedTextField(pin, { pin = it.filter(Char::isDigit).take(8) }, label = { Text("Pincode (minimaal 6 cijfers)") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth(), singleLine = true)
    error?.let { Text(it, color = MaterialTheme.colorScheme.error) }; Spacer(Modifier.height(14.dp))
    Button(onClick = { if (pin.length < 6) error = "Kies minimaal 6 cijfers." else { error = if (submit(pin)) null else "Onjuiste pincode." } }, modifier = Modifier.fillMaxWidth()) { Text(if (setup) "Pincode opslaan" else "Ontgrendelen") }
    if (allowBiometric && biometric != null) TextButton(onClick = biometric, modifier = Modifier.fillMaxWidth()) { Text("Gebruik vingerafdruk") }
  }
}

@Composable private fun LoginScreen(api: DemiApi, onLoggedIn: () -> Unit) {
  var email by remember { mutableStateOf("") }; var password by remember { mutableStateOf("") }
  var busy by remember { mutableStateOf(false) }; var error by remember { mutableStateOf<String?>(null) }
  val scope = rememberCoroutineScope()
  Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.Center) {
    Text("Demi Fietsen", style = MaterialTheme.typography.headlineLarge)
    Text("Medewerkersapp", color = MaterialTheme.colorScheme.onSurfaceVariant)
    Spacer(Modifier.height(28.dp))
    OutlinedTextField(email, { email = it }, label = { Text("E-mailadres") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
    Spacer(Modifier.height(12.dp))
    OutlinedTextField(password, { password = it }, label = { Text("Wachtwoord") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth(), singleLine = true)
    error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 12.dp)) }
    Spacer(Modifier.height(18.dp))
    Button(enabled = !busy && email.isNotBlank() && password.isNotBlank(), onClick = { busy = true; error = null; scope.launch { background { api.login(email, password) }.onSuccess { onLoggedIn() }.onFailure { error = it.message ?: "Inloggen mislukt." }; busy = false } }, modifier = Modifier.fillMaxWidth().height(52.dp)) { if (busy) CircularProgressIndicator() else Text("Inloggen") }
  }
}

@Composable private fun StaffApp(api: DemiApi, sessions: SessionStore, activity: MainActivity, deepLinkToken: String?, consumeDeepLink: () -> Unit, onLogout: () -> Unit) {
  var screen by remember { mutableStateOf(if (deepLinkToken == null) "home" else "scan") }
  LaunchedEffect(deepLinkToken) { if (deepLinkToken != null) screen = "scan" }
  when (screen) {
    "inventory" -> InventoryScreen(api, { id -> screen = "bike:$id" }) { screen = "home" }
    "batteries" -> BatteryInventoryScreen(api) { screen = "home" }
    "scan" -> QrLookupScreen(api, deepLinkToken, consumeDeepLink, { id -> screen = "bike:$id" }) { screen = "home" }
    "new-bike" -> NewBikeScreen(api) { screen = "home" }
    "workshop" -> WorkshopScreen(api) { screen = "home" }
    "sales" -> SalesScreen(api) { screen = "home" }
    "reservations" -> ReservationsScreen(api) { screen = "home" }
    "ads" -> AdvertisementScreen(api) { screen = "home" }
    "settings" -> SettingsScreen(api, sessions, activity) { screen = "home" }
    else -> if (screen.startsWith("bike:")) BikeDossierScreen(api, screen.removePrefix("bike:")) { screen = "inventory" } else HomeScreen(api, sessions, open = { screen = it }, logout = { onLogout() })
  }
}

private data class HomeAction(val label: String, val route: String, val hint: String, val icon: String)

private val homeActions = listOf(
  HomeAction("QR scannen", "scan", "Open direct een fietsdossier", "⌕"),
  HomeAction("Nieuwe fiets innemen", "new-bike", "Start met de vaste checklist", "+"),
  HomeAction("Fietsvoorraad", "inventory", "Bekijk status, prijs en locatie", "▤"),
  HomeAction("Accu’s", "batteries", "Accudossiers en reparaties", "▣"),
  HomeAction("Werkplaats", "workshop", "Inspecties en ServiceTasks", "⚒"),
  HomeAction("Verkopen", "sales", "Centrale verkoopafronding", "€"),
  HomeAction("Advertenties", "ads", "Tekst uit een fietsdossier", "↗"),
  HomeAction("Reserveringen", "reservations", "Actieve holds beheren", "◷"),
  HomeAction("Instellingen", "settings", "Pincode, biometrie en meldingen", "⚙"),
)

@Composable private fun HomeScreen(api: DemiApi, sessions: SessionStore, open: (String) -> Unit, logout: () -> Unit) {
  val scope = rememberCoroutineScope()
  var notices by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
  var noticeError by remember { mutableStateOf<String?>(null) }
  var dashboard by remember { mutableStateOf<JSONObject?>(null) }
  var dashboardBusy by remember { mutableStateOf(false) }
  var menuExpanded by remember { mutableStateOf(false) }

  fun loadDashboard() {
    if (dashboardBusy) return
    dashboardBusy = true
    scope.launch {
      background { api.dashboard() }
        .onSuccess { dashboard = it.optJSONObject("dashboard") }
        .onFailure { /* Keep the last snapshot visible; the error is shown below. */ }
        .also { dashboardBusy = false }
    }
  }

  fun loadNotifications() {
    scope.launch {
      background { api.notifications() }
        .onSuccess { json ->
          val entries = json.optJSONArray("notifications")
          notices = (0 until (entries?.length() ?: 0)).mapNotNull { index ->
            entries?.optJSONObject(index)
          }.filter { sessions.notificationEnabled(it.optString("category")) }
          noticeError = null
        }
        .onFailure { noticeError = it.message ?: "Meldingen konden niet worden geladen." }
    }
  }

  LaunchedEffect(Unit) {
    loadDashboard()
    loadNotifications()
    while (true) {
      delay(60_000)
      loadDashboard()
      loadNotifications()
    }
  }

  val attention = dashboard?.let {
    it.optInt("pendingOrders") + it.optInt("expiredReservations") +
      it.optInt("incompleteWorkshop") + it.optInt("manualReviews") + it.optInt("lowAccessoryStock")
  } ?: notices.size
  val attentionRoute = dashboard?.let {
    when {
      it.optInt("expiredReservations") > 0 -> "reservations"
      it.optInt("pendingOrders") > 0 || it.optInt("manualReviews") > 0 -> "sales"
      it.optInt("incompleteWorkshop") > 0 -> "workshop"
      it.optInt("lowAccessoryStock") > 0 -> "inventory"
      else -> "inventory"
    }
  } ?: "inventory"
  val displayName = sessions.userName()?.substringBefore(" ")?.trim().takeUnless { it.isNullOrBlank() }
  val greeting = when (LocalTime.now().hour) {
    in 5..11 -> "Goedemorgen"
    in 12..17 -> "Goedemiddag"
    else -> "Goedenavond"
  }
  val date = runCatching {
    DateTimeFormatter.ofPattern("EEEE d MMMM", Locale("nl", "NL")).format(LocalDate.now())
      .replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale("nl", "NL")) else it.toString() }
  }.getOrDefault("")

  Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
    LazyColumn(
      modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp).padding(bottom = 94.dp)
        .pullToRefresh(dashboardBusy) { loadDashboard(); loadNotifications() },
      verticalArrangement = Arrangement.spacedBy(12.dp),
      contentPadding = PaddingValues(top = 14.dp, bottom = 20.dp),
    ) {
      item { HomeHeader(date, "$greeting${displayName?.let { ", $it" } ?: ""}", attention) }
      item {
        AttentionCard(
          count = attention,
          onOpen = { if (attention > 0) open(attentionRoute) else menuExpanded = true },
        )
      }
      item {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          HomePrimaryAction(homeActions[0], onClick = { open(homeActions[0].route) })
          HomePrimaryAction(homeActions[1], secondary = true, onClick = { open(homeActions[1].route) })
        }
      }
      dashboard?.let { item { DashboardSummary(it) } }
      item { HomeSectionHeading("Vandaag", "Voorraad →", onClick = { open("inventory") }) }
      items(todayItems(dashboard), key = { it.route + it.title }) { item ->
        TodayAction(item, onClick = { open(item.route) })
      }
      item { HomeSectionHeading("Open acties", "Alles →", onClick = { if (attention > 0) open(attentionRoute) else menuExpanded = true }) }
      if (notices.isEmpty()) {
        item {
          HomeInfoCard(
            title = if (noticeError == null) "Geen open acties" else "Acties konden niet worden geladen",
            body = noticeError ?: "Alles is bijgewerkt. Trek omlaag om opnieuw te laden.",
          )
        }
      } else {
        items(notices.take(5), key = { it.optString("category") + it.optString("title") }) { notice ->
          NoticeAction(notice, onClick = { open(routeForNotice(notice)) })
        }
      }
      item { SettingsCallout(onClick = { open("settings") }) }
      item { TextButton(onClick = logout, modifier = Modifier.fillMaxWidth()) { Text("Uitloggen") } }
    }
    BottomMenu(
      modifier = Modifier.align(Alignment.BottomCenter),
      expanded = menuExpanded,
      onExpandedChange = { menuExpanded = it },
      onOpen = { route -> menuExpanded = false; open(route) },
      onLogout = { menuExpanded = false; logout() },
    )
  }
}

private data class TodayItem(val time: String, val title: String, val subtitle: String, val route: String, val dot: Color)

private fun todayItems(data: JSONObject?): List<TodayItem> {
  if (data == null) return listOf(TodayItem("—", "Dashboard laden", "Even geduld…", "inventory", Color(0xFF78918A)))
  val items = mutableListOf<TodayItem>()
  if (data.optInt("incompleteWorkshop") > 0) items += TodayItem("Nu", "Werkplaats", "${data.optInt("incompleteWorkshop")} fiets(en) met open taken", "workshop", Color(0xFFD49331))
  if (data.optInt("pendingOrders") + data.optInt("manualReviews") > 0) items += TodayItem("Nu", "Betaling controleren", "Order- en betaalstatus nakijken", "sales", Color(0xFF4D7FC3))
  if (data.optInt("expiredReservations") > 0) items += TodayItem("Nu", "Reserveringen", "Verlopen holds vrijgeven of opvolgen", "reservations", Color(0xFFD49331))
  if (items.isEmpty()) items += TodayItem("✓", "Voorraad bijgewerkt", "Geen urgente acties gevonden", "inventory", Color(0xFF4AA77A))
  return items.take(3)
}

private fun routeForNotice(notice: JSONObject): String = when (notice.optString("category")) {
  "reservations" -> "reservations"
  "payments", "sales" -> "sales"
  "workshop" -> "workshop"
  "service", "appointments" -> "reservations"
  else -> "inventory"
}

@Composable private fun HomeHeader(date: String, greeting: String, attention: Int) {
  Row(Modifier.fillMaxWidth().padding(top = 2.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
    Column(Modifier.weight(1f)) {
      if (date.isNotBlank()) Text(date, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(bottom = 2.dp))
      Text(greeting, style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.onBackground)
    }
    Box(Modifier.size(44.dp).background(MaterialTheme.colorScheme.primary, CircleShape), contentAlignment = Alignment.Center) {
      Text(if (attention > 99) "99+" else attention.toString(), color = Color.White, style = MaterialTheme.typography.titleMedium)
    }
  }
}

@Composable private fun AttentionCard(count: Int, onOpen: () -> Unit) {
  Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary)) {
    Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
      Column(Modifier.weight(1f)) {
        Text("ACTIE VEREIST", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primaryContainer)
        Text(if (count == 0) "Alles bijgewerkt" else "Je hebt $count open actie${if (count == 1) "" else "s"}", style = MaterialTheme.typography.titleLarge, color = Color.White)
        Text(if (count == 0) "Er is niets dringends te doen." else "We beginnen met de belangrijkste.", style = MaterialTheme.typography.bodyMedium, color = Color.White.copy(alpha = .84f))
      }
      Button(onClick = onOpen, colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = MaterialTheme.colorScheme.onPrimary), shape = RoundedCornerShape(11.dp)) { Text(if (count == 0) "Menu" else "Open lijst") }
    }
  }
}

@Composable private fun HomePrimaryAction(action: HomeAction, secondary: Boolean = false, onClick: () -> Unit) {
  val container = if (secondary) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.primary
  val content = if (secondary) MaterialTheme.colorScheme.onPrimaryContainer else Color.White
  Card(onClick = onClick, shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = container)) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
      Box(Modifier.size(38.dp).background(if (secondary) Color.White else Color.White.copy(alpha = .18f), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) { Text(action.icon, color = if (secondary) MaterialTheme.colorScheme.onPrimaryContainer else Color.White, style = MaterialTheme.typography.titleLarge) }
      Column(Modifier.weight(1f)) { Text(action.label, style = MaterialTheme.typography.titleMedium, color = content); Text(action.hint, style = MaterialTheme.typography.bodySmall, color = content.copy(alpha = .78f)) }
      Text("›", style = MaterialTheme.typography.headlineMedium, color = content)
    }
  }
}

@Composable private fun HomeSectionHeading(title: String, action: String, onClick: () -> Unit) {
  Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
    Text(title, style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onBackground)
    TextButton(onClick = onClick) { Text(action, color = MaterialTheme.colorScheme.primary) }
  }
}

@Composable private fun TodayAction(item: TodayItem, onClick: () -> Unit) {
  Card(onClick = onClick, shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
      Text(item.time, modifier = Modifier.width(42.dp), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Box(Modifier.size(10.dp).background(item.dot, CircleShape))
      Column(Modifier.weight(1f)) { Text(item.title, style = MaterialTheme.typography.titleMedium); Text(item.subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
      Text("›", style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
  }
}

@Composable private fun NoticeAction(notice: JSONObject, onClick: () -> Unit) {
  Card(onClick = onClick, shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
    Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
      Box(Modifier.size(32.dp).background(Color(0xFFFFF0D3), RoundedCornerShape(10.dp)), contentAlignment = Alignment.Center) { Text("!", color = Color(0xFFA15C00), style = MaterialTheme.typography.titleMedium) }
      Column(Modifier.weight(1f)) { Text(notice.optString("title", "Actie"), style = MaterialTheme.typography.titleMedium); Text(notice.optString("body"), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
      Text("›", style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
  }
}

@Composable private fun HomeInfoCard(title: String, body: String) {
  Card(shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)) {
    Column(Modifier.fillMaxWidth().padding(14.dp)) { Text(title, style = MaterialTheme.typography.titleMedium); Text(body, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
  }
}

@Composable private fun SettingsCallout(onClick: () -> Unit) {
  Card(onClick = onClick, shape = RoundedCornerShape(12.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer), border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = .2f))) {
    Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("⚙", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onPrimaryContainer)
      Column(Modifier.weight(1f)) { Text("Instellingen", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onPrimaryContainer); Text("Pincode, biometrie en meldingen", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = .75f)) }
      Text("›", style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
    }
  }
}

@Composable private fun BottomMenu(modifier: Modifier = Modifier, expanded: Boolean, onExpandedChange: (Boolean) -> Unit, onOpen: (String) -> Unit, onLogout: () -> Unit) {
  // Keep the menu above Android's gesture/3-button navigation bar. The app
  // uses edge-to-edge rendering on newer Android versions, so positioning the
  // button at the raw bottom edge would otherwise hide its lower corners.
  Box(modifier.navigationBarsPadding().fillMaxWidth().background(MaterialTheme.colorScheme.background).padding(horizontal = 16.dp, vertical = 12.dp), contentAlignment = Alignment.Center) {
    Button(onClick = { onExpandedChange(!expanded) }, modifier = Modifier.fillMaxWidth().height(56.dp), shape = RoundedCornerShape(14.dp), colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)) {
      Text(if (expanded) "Menu sluiten" else "Menu", style = MaterialTheme.typography.titleMedium)
      Spacer(Modifier.width(8.dp)); Text(if (expanded) "⌃" else "⌄", style = MaterialTheme.typography.titleLarge)
    }
    DropdownMenu(expanded = expanded, onDismissRequest = { onExpandedChange(false) }, modifier = Modifier.fillMaxWidth(.92f)) {
      homeActions.forEach { action ->
        DropdownMenuItem(
          text = { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) { Text(action.icon, color = MaterialTheme.colorScheme.primary); Column { Text(action.label); Text(action.hint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } } },
          onClick = { onOpen(action.route) },
        )
      }
      HorizontalDivider()
      DropdownMenuItem(text = { Text("Uitloggen") }, onClick = onLogout)
    }
  }
}

@Composable private fun DashboardSummary(data: JSONObject) {
  Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
    Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Text("Vandaag in beeld", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
      Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { DashboardMetric("Voorraad", data.optInt("stockCount")); DashboardMetric("Beschikbaar", data.optInt("availableCount")); DashboardMetric("Verkocht", data.optInt("soldThisMonth")) }
      Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { DashboardMetric("Omzet", euro(data.optInt("revenueThisMonthCents"))); DashboardMetric("Marge", euro(data.optInt("grossMarginThisMonthCents"))); DashboardMetric("Marge-btw", euro(data.optInt("marginVatThisMonthCents"))) }
      val attention = data.optInt("pendingOrders") + data.optInt("expiredReservations") + data.optInt("incompleteWorkshop") + data.optInt("manualReviews")
      if (attention > 0) Text("$attention aandachtspunt${if (attention == 1) "" else "en"}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
    }
  }
}

@Composable private fun DashboardMetric(label: String, value: Any) { Column { Text(value.toString(), style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurface); Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } }
private fun euro(cents: Int) = "€ ${"%.2f".format(java.util.Locale.US, cents / 100.0)}"

@Composable private fun InventoryScreen(api: DemiApi, openBike: (String) -> Unit, back: () -> Unit) {
  var busy by remember { mutableStateOf(false) }; var error by remember { mutableStateOf<String?>(null) }; var rows by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
  val scope = rememberCoroutineScope()
  fun load() { busy = true; error = null; scope.launch { background { api.inventory() }.onSuccess { result -> val list = result.optJSONArray("bikes"); rows = (0 until (list?.length() ?: 0)).map { list!!.getJSONObject(it) } }.onFailure { error = it.message }; busy = false } }
  LaunchedEffect(Unit) { load() }
  Column(Modifier.fillMaxSize().padding(20.dp).pullToRefresh(busy) { load() }) {
    Row { TextButton(onClick = back) { Text("← Terug") }; Text("Voorraad", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.padding(top = 12.dp)) }
    Text("Trek omlaag om de voorraad te verversen.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    error?.let { Text(it, color = MaterialTheme.colorScheme.error) }; if (busy) CircularProgressIndicator(Modifier.padding(16.dp))
    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 12.dp)) { items(rows) { bike -> Card(onClick = { openBike(bike.optString("id")) }) { Column(Modifier.padding(14.dp)) { Text(bike.optString("title")); Text("${bike.optString("inventoryCode")} · ${bike.optString("status")}", color = MaterialTheme.colorScheme.onSurfaceVariant); Text("€ ${(bike.optInt("priceCents") / 100.0)}") } } } }
  }
}

@Composable private fun BatteryInventoryScreen(api: DemiApi, back: () -> Unit) {
  val scope = rememberCoroutineScope(); var rows by remember { mutableStateOf<List<JSONObject>>(emptyList()) }; var bikes by remember { mutableStateOf<List<JSONObject>>(emptyList()) }; var selected by remember { mutableStateOf<JSONObject?>(null) }; var manufacturer by remember { mutableStateOf("") }; var model by remember { mutableStateOf("") }; var serial by remember { mutableStateOf("") }; var voltage by remember { mutableStateOf("") }; var wh by remember { mutableStateOf("") }; var bikeId by remember { mutableStateOf("") }; var bikeMenuOpen by remember { mutableStateOf(false) }; var repair by remember { mutableStateOf("") }; var message by remember { mutableStateOf<String?>(null) }; var busy by remember { mutableStateOf(false) }
  fun load() { busy = true; scope.launch {
    background { api.batteries() }.onSuccess { json -> val list = json.optJSONArray("batteries"); rows = (0 until (list?.length() ?: 0)).map { list!!.getJSONObject(it) } }.onFailure { message = it.message }
    background { api.inventory() }.onSuccess { json -> val list = json.optJSONArray("bikes"); bikes = (0 until (list?.length() ?: 0)).map { list!!.getJSONObject(it) } }.onFailure { message = it.message }
    busy = false
  } }
  LaunchedEffect(Unit) { load() }
  LazyColumn(Modifier.fillMaxSize().padding(20.dp).pullToRefresh(busy) { load() }, verticalArrangement = Arrangement.spacedBy(10.dp)) {
    item { TextButton(onClick = back) { Text("← Terug") }; Text("Accu’s", style = MaterialTheme.typography.headlineMedium); Text("Registreer en repareer accu’s los van fietsen. Koppelen kan later. Trek omlaag om opnieuw te laden.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
    item { Text("Nieuwe accu", style = MaterialTheme.typography.titleLarge) }
    item { OutlinedTextField(manufacturer, { manufacturer = it }, label = { Text("Fabrikant") }, modifier = Modifier.fillMaxWidth()) }
    item { OutlinedTextField(model, { model = it }, label = { Text("Model") }, modifier = Modifier.fillMaxWidth()) }
    item { OutlinedTextField(serial, { serial = it }, label = { Text("Serienummer") }, modifier = Modifier.fillMaxWidth()) }
    item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { OutlinedTextField(voltage, { voltage = it.filter(Char::isDigit) }, label = { Text("V") }, modifier = Modifier.weight(1f)); OutlinedTextField(wh, { wh = it.filter(Char::isDigit) }, label = { Text("Wh") }, modifier = Modifier.weight(1f)) } }
    item { Button(enabled = !busy, onClick = { busy = true; scope.launch { background { api.createBattery(JSONObject().put("manufacturer", manufacturer).put("model", model).put("serialNumber", serial).put("voltage", voltage.toIntOrNull()).put("nominalWh", wh.toIntOrNull()).put("status", "INTAKE")) }.onSuccess { message = "Accu ${it.optString("assetCode")} geregistreerd."; manufacturer = ""; model = ""; serial = ""; voltage = ""; wh = ""; load() }.onFailure { message = it.message }; busy = false } }, modifier = Modifier.fillMaxWidth()) { Text("Accu registreren") } }
    message?.let { item { Text(it, color = if (it.startsWith("Accu")) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error) } }
    item { Text("Geregistreerde accu’s", style = MaterialTheme.typography.titleLarge) }
    items(rows) { battery -> Card(onClick = { selected = battery }) { Column(Modifier.padding(14.dp)) { Text(battery.optString("assetCode"), style = MaterialTheme.typography.titleMedium); Text(listOf(battery.optString("manufacturer"), battery.optString("model")).filter { it.isNotBlank() }.joinToString(" ").ifBlank { "Onbekend merk/model" }); Text("${battery.optString("status")} · ${battery.optInt("voltage").takeIf { it > 0 }?.let { "$it V" } ?: ""} ${battery.optInt("nominalWh").takeIf { it > 0 }?.let { "$it Wh" } ?: ""}", color = MaterialTheme.colorScheme.onSurfaceVariant); battery.optJSONObject("currentBike")?.let { Text("Gekoppeld aan ${it.optString("inventoryCode")}") } ?: Text("Los beschikbaar", color = MaterialTheme.colorScheme.onSurfaceVariant) } } }
    selected?.let { battery ->
      item { Text("Accu ${battery.optString("assetCode")} bedienen", style = MaterialTheme.typography.titleLarge) }
      item { Box {
        Button(onClick = { bikeMenuOpen = true }, enabled = bikes.isNotEmpty(), modifier = Modifier.fillMaxWidth()) { Text(bikes.firstOrNull { it.optString("id") == bikeId }?.let { "${it.optString("inventoryCode")} · ${it.optString("title")}" } ?: if (bikes.isEmpty()) "Geen fietsen beschikbaar" else "Kies een fiets") }
        DropdownMenu(expanded = bikeMenuOpen, onDismissRequest = { bikeMenuOpen = false }) { bikes.forEach { bike -> DropdownMenuItem(text = { Text("${bike.optString("inventoryCode")} · ${bike.optString("title")}") }, onClick = { bikeId = bike.optString("id"); bikeMenuOpen = false }) } }
      } }
      item { OutlinedTextField(bikeId, { bikeId = it }, label = { Text("Fiets-id (optioneel, voor handmatig zoeken)") }, modifier = Modifier.fillMaxWidth(), singleLine = true) }
      item { Button(enabled = !busy && bikeId.isNotBlank(), onClick = { busy = true; scope.launch { background { api.assignBattery(battery.getString("id"), bikeId) }.onSuccess { message = "Accu gekoppeld."; bikeId = ""; load() }.onFailure { message = it.message }; busy = false } }) { Text("Aan fiets koppelen") } }
      item { TextButton(enabled = !busy, onClick = { busy = true; scope.launch { background { api.unassignBattery(battery.getString("id")) }.onSuccess { message = "Accu losgekoppeld."; load() }.onFailure { message = it.message }; busy = false } }) { Text("Loskoppelen") } }
      item { OutlinedTextField(repair, { repair = it }, label = { Text("Korte accureparatie") }, modifier = Modifier.fillMaxWidth()) }
      item { Button(enabled = !busy && repair.isNotBlank(), onClick = { busy = true; scope.launch { background { api.addBatteryRepair(battery.getString("id"), JSONObject().put("description", repair)) }.onSuccess { message = "Reparatie toegevoegd."; repair = "" }.onFailure { message = it.message }; busy = false } }) { Text("Reparatie toevoegen") } }
    }
  }
}

@Composable private fun QrLookupScreen(api: DemiApi, initialToken: String? = null, initialTokenConsumed: () -> Unit = {}, openBike: (String) -> Unit = {}, back: () -> Unit) {
  var token by remember { mutableStateOf(initialToken.orEmpty()) }; var busy by remember { mutableStateOf(false) }; var result by remember { mutableStateOf<String?>(null) }; var error by remember { mutableStateOf<String?>(null) }; var bikeId by remember { mutableStateOf<String?>(null) }
  val scope = rememberCoroutineScope()
  LaunchedEffect(initialToken) {
    if (initialToken != null) {
      token = initialToken; busy = true; result = null; error = null; initialTokenConsumed()
      background { api.resolveQr(initialToken) }.onSuccess { json -> result = json.toString(2); bikeId = json.optJSONObject("bike")?.optString("id")?.takeIf { it.isNotBlank() } }.onFailure { error = it.message }
      busy = false
    }
  }
  Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    TextButton(onClick = back) { Text("← Terug") }; Text("QR scannen", style = MaterialTheme.typography.headlineMedium)
    Text("Scan een Demi Fietsen QR-label. De app verifieert de code altijd opnieuw bij de backend.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    QrCameraScanner(modifier = Modifier.fillMaxWidth().height(230.dp)) { scanned -> token = scanned }
    OutlinedTextField(token, { token = it.trim() }, label = { Text("QR-token") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
    Button(enabled = !busy && token.isNotBlank(), onClick = { busy = true; result = null; error = null; bikeId = null; scope.launch { background { api.resolveQr(token) }.onSuccess { json -> result = json.toString(2); bikeId = json.optJSONObject("bike")?.optString("id")?.takeIf { it.isNotBlank() } }.onFailure { error = it.message }; busy = false } }) { Text("Opzoeken") }
    error?.let { Text(it, color = MaterialTheme.colorScheme.error) }; bikeId?.let { Button(onClick = { openBike(it) }) { Text("Open fietsdossier") } }; result?.let { Text(it) }
  }
}

@Composable private fun NewBikeScreen(api: DemiApi, back: () -> Unit) {
  var brand by remember { mutableStateOf("") }; var model by remember { mutableStateOf("") }; var type by remember { mutableStateOf("E-bike") }
  var colour by remember { mutableStateOf("") }; var frame by remember { mutableStateOf("") }; var cost by remember { mutableStateOf("") }
  var busy by remember { mutableStateOf(false) }; var message by remember { mutableStateOf<String?>(null) }; val scope = rememberCoroutineScope()
  LazyColumn(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
    item { TextButton(onClick = back) { Text("← Terug") } }; item { Text("Nieuwe fiets", style = MaterialTheme.typography.headlineMedium) }
    item { Text("De server bepaalt inventarisnummer en startstatus INTAKE.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
    item { OutlinedTextField(brand, { brand = it }, label = { Text("Merk") }, modifier = Modifier.fillMaxWidth()) }; item { OutlinedTextField(model, { model = it }, label = { Text("Model") }, modifier = Modifier.fillMaxWidth()) }
    item { OutlinedTextField(type, { type = it }, label = { Text("Fietstype") }, modifier = Modifier.fillMaxWidth()) }; item { OutlinedTextField(colour, { colour = it }, label = { Text("Kleur") }, modifier = Modifier.fillMaxWidth()) }
    item { OutlinedTextField(frame, { frame = it }, label = { Text("Framenummer") }, modifier = Modifier.fillMaxWidth()) }; item { OutlinedTextField(cost, { cost = it.filter(Char::isDigit) }, label = { Text("Inkoopprijs in centen") }, modifier = Modifier.fillMaxWidth()) }
    item { Button(enabled = !busy, onClick = { val cents = cost.toIntOrNull(); if (cents == null) { message = "Vul de inkoopprijs in gehele centen in."; return@Button }; busy = true; scope.launch { background { api.createBike(JSONObject().put("brand", brand).put("model", model).put("bikeType", type).put("colour", colour).put("frameSerialRef", frame).put("acquisitionCostCents", cents).put("acquisitionDate", java.time.LocalDate.now().toString()).put("isElectric", true)) }.onSuccess { message = "Fiets aangemaakt: ${it.optString("inventoryCode")}" }.onFailure { message = it.message }; busy = false } }, modifier = Modifier.fillMaxWidth()) { Text("Intake aanmaken") } }
    item { message?.let { Text(it, color = if (it.startsWith("Fiets")) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error) } }
  }
}

@Composable private fun WorkshopScreen(api: DemiApi, back: () -> Unit) {
  var bikeId by remember { mutableStateOf("") }; var description by remember { mutableStateOf("") }; var message by remember { mutableStateOf<String?>(null) }; var busy by remember { mutableStateOf(false) }; val scope = rememberCoroutineScope()
  Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    TextButton(onClick = back) { Text("← Terug") }; Text("Werkplaats", style = MaterialTheme.typography.headlineMedium)
    OutlinedTextField(bikeId, { bikeId = it }, label = { Text("Fiets-id") }, modifier = Modifier.fillMaxWidth()); OutlinedTextField(description, { description = it }, label = { Text("Werkzaamheid") }, modifier = Modifier.fillMaxWidth())
    Button(enabled = !busy && bikeId.isNotBlank() && description.isNotBlank(), onClick = { busy = true; scope.launch { background { api.workshop(bikeId, JSONObject().put("description", description)) }.onSuccess { message = "Werkplaatsregel toegevoegd." }.onFailure { message = it.message }; busy = false } }) { Text("Werkplaatsregel toevoegen") }
    message?.let { Text(it, color = if (it.startsWith("Werk")) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error) }
  }
}

@Composable private fun SalesScreen(api: DemiApi, back: () -> Unit) {
  var bikeId by remember { mutableStateOf("") }; var name by remember { mutableStateOf("") }; var email by remember { mutableStateOf("") }; var orderId by remember { mutableStateOf<String?>(null) }; var message by remember { mutableStateOf<String?>(null) }; var busy by remember { mutableStateOf(false) }; val scope = rememberCoroutineScope()
  Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    TextButton(onClick = back) { Text("← Terug") }; Text("Verkoop", style = MaterialTheme.typography.headlineMedium)
    if (orderId == null) { OutlinedTextField(bikeId, { bikeId = it }, label = { Text("Fiets-id") }, modifier = Modifier.fillMaxWidth()); OutlinedTextField(name, { name = it }, label = { Text("Klantnaam") }, modifier = Modifier.fillMaxWidth()); OutlinedTextField(email, { email = it }, label = { Text("E-mailadres voor factuur") }, modifier = Modifier.fillMaxWidth()); Button(enabled = !busy && bikeId.isNotBlank() && name.isNotBlank() && email.isNotBlank(), onClick = { busy = true; scope.launch { background { api.startSale(JSONObject().put("bikeIds", org.json.JSONArray().put(bikeId)).put("customerName", name).put("customerEmail", email)) }.onSuccess { json -> orderId = json.getJSONObject("order").getString("id"); message = "Verkoop gestart. Bevestig contant geld pas na ontvangst." }.onFailure { message = it.message }; busy = false } }, modifier = Modifier.fillMaxWidth()) { Text("Verkoop starten") } } else { Text(message ?: ""); Button(enabled = !busy, onClick = { busy = true; scope.launch { background { api.confirmCash(orderId!!) }.onSuccess { message = "Betaling bevestigd en verkoop afgerond." }.onFailure { message = it.message }; busy = false } }, modifier = Modifier.fillMaxWidth()) { Text("CASH ontvangen bevestigen") } }
    message?.let { Text(it, color = if (it.startsWith("Verkoop") || it.startsWith("Betaling")) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error) }
  }
}

@Composable private fun BikeDossierScreen(api: DemiApi, bikeId: String, back: () -> Unit) {
  val context = LocalContext.current; val scope = rememberCoroutineScope()
  var busy by remember { mutableStateOf(false) }; var error by remember { mutableStateOf<String?>(null) }; var notice by remember { mutableStateOf<String?>(null) }
  var data by remember { mutableStateOf<JSONObject?>(null) }; var title by remember { mutableStateOf("") }; var brand by remember { mutableStateOf("") }; var model by remember { mutableStateOf("") }; var price by remember { mutableStateOf("") }; var description by remember { mutableStateOf("") }; var storage by remember { mutableStateOf("") }
  fun load() { busy = true; error = null; scope.launch { background { api.bike(bikeId) }.onSuccess { json -> val bike = json.getJSONObject("bike"); data = bike; title = bike.optString("title"); brand = bike.optString("brand"); model = bike.optString("model"); price = bike.optInt("priceCents").toString(); description = bike.optString("description"); storage = bike.optString("storageLocation") }.onFailure { error = it.message ?: "Fietsdossier kon niet worden geladen." }; busy = false } }
  LaunchedEffect(bikeId) { load() }
  fun upload(uri: android.net.Uri) { busy = true; error = null; scope.launch { background { val bytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: throw IllegalStateException("Foto kon niet worden gelezen."); api.uploadBikeImage(bikeId, "bike-${System.currentTimeMillis()}.jpg", bytes, context.contentResolver.getType(uri) ?: "image/jpeg") }.onSuccess { notice = "Foto toegevoegd. Kies hieronder eventueel omslag of interne zichtbaarheid."; load() }.onFailure { error = it.message ?: "Foto uploaden mislukt." }; busy = false } }
  var cameraUri by remember { mutableStateOf<android.net.Uri?>(null) }
  val camera = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved -> if (saved) cameraUri?.let(::upload) else error = "Foto-opname is geannuleerd." }
  val gallery = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri -> if (uri != null) upload(uri) }
  LazyColumn(Modifier.fillMaxSize().padding(20.dp).pullToRefresh(busy) { load() }, verticalArrangement = Arrangement.spacedBy(12.dp)) {
    item { TextButton(onClick = back) { Text("← Voorraad") } }; item { Text(data?.optString("inventoryCode") ?: "Fietsdossier", style = MaterialTheme.typography.headlineMedium) }
    item { Text("Volledige gegevens blijven server-gevalideerd. Bewerk hier de dagelijkse dossier- en advertentievelden; intake en werkplaats blijven als aparte veilige stappen beschikbaar.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
    if (busy) item { CircularProgressIndicator() }; error?.let { item { Text(it, color = MaterialTheme.colorScheme.error) } }; notice?.let { item { Text(it, color = MaterialTheme.colorScheme.primary) } }
    item { OutlinedTextField(title, { title = it }, label = { Text("Titel") }, modifier = Modifier.fillMaxWidth()) }; item { OutlinedTextField(brand, { brand = it }, label = { Text("Merk") }, modifier = Modifier.fillMaxWidth()) }; item { OutlinedTextField(model, { model = it }, label = { Text("Model") }, modifier = Modifier.fillMaxWidth()) }; item { OutlinedTextField(price, { price = it.filter(Char::isDigit) }, label = { Text("Vraagprijs in centen") }, modifier = Modifier.fillMaxWidth()) }; item { OutlinedTextField(storage, { storage = it }, label = { Text("Opslaglocatie") }, modifier = Modifier.fillMaxWidth()) }; item { OutlinedTextField(description, { description = it }, label = { Text("Advertentieomschrijving") }, modifier = Modifier.fillMaxWidth(), minLines = 4) }
    item { Button(enabled = !busy, onClick = { val cents = price.toIntOrNull(); if (cents == null || title.isBlank() || brand.isBlank() || model.isBlank()) { error = "Titel, merk, model en vraagprijs zijn verplicht."; return@Button }; busy = true; scope.launch { background { api.updateBike(bikeId, JSONObject().put("title", title).put("brand", brand).put("model", model).put("priceCents", cents).put("storageLocation", storage).put("description", description)) }.onSuccess { notice = "Fietsdossier opgeslagen."; load() }.onFailure { error = it.message }; busy = false } }, modifier = Modifier.fillMaxWidth()) { Text("Dossier opslaan") } }
    item { Text("Foto-assistent", style = MaterialTheme.typography.titleLarge) }; item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Button(enabled = !busy, onClick = { val file = File(context.cacheDir, "bike-${UUID.randomUUID()}.jpg"); cameraUri = FileProvider.getUriForFile(context, "${context.packageName}.files", file); camera.launch(cameraUri!!) }) { Text("Foto nemen") }; TextButton(enabled = !busy, onClick = { gallery.launch("image/*") }) { Text("Galerij") } } }
    val images = data?.optJSONArray("images"); if (images != null) items((0 until images.length()).map { images.getJSONObject(it) }) { image -> Card { Column(Modifier.padding(12.dp)) { Text(if (image.optBoolean("isCover")) "Omslagfoto" else "Foto"); Text(if (image.optBoolean("isInternal")) "Intern" else "Publiek", color = MaterialTheme.colorScheme.onSurfaceVariant); Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { if (!image.optBoolean("isInternal") && !image.optBoolean("isCover")) TextButton(onClick = { scope.launch { background { api.updateBikeImage(bikeId, image.getString("id"), "cover") }.onSuccess { load() }.onFailure { error = it.message } } }) { Text("Maak omslag") }; TextButton(onClick = { scope.launch { background { api.updateBikeImage(bikeId, image.getString("id"), "visibility", !image.optBoolean("isInternal")) }.onSuccess { load() }.onFailure { error = it.message } } }) { Text(if (image.optBoolean("isInternal")) "Maak publiek" else "Maak intern") } } } } }
  }
}

@Composable private fun ReservationsScreen(api: DemiApi, back: () -> Unit) {
  val scope = rememberCoroutineScope(); var rows by remember { mutableStateOf<List<JSONObject>>(emptyList()) }; var bikeId by remember { mutableStateOf("") }; var customer by remember { mutableStateOf("") }; var minutes by remember { mutableStateOf("10080") }; var busy by remember { mutableStateOf(false) }; var message by remember { mutableStateOf<String?>(null) }
  fun load() { busy = true; scope.launch { background { api.reservations() }.onSuccess { json -> val list = json.getJSONArray("reservations"); rows = (0 until list.length()).map { list.getJSONObject(it) } }.onFailure { message = it.message }; busy = false } }
  LaunchedEffect(Unit) { load() }
  LazyColumn(Modifier.fillMaxSize().padding(20.dp).pullToRefresh(busy) { load() }, verticalArrangement = Arrangement.spacedBy(10.dp)) { item { TextButton(onClick = back) { Text("← Terug") } }; item { Text("Reserveringen", style = MaterialTheme.typography.headlineMedium) }; item { Text("Trek omlaag om opnieuw te laden.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }; item { OutlinedTextField(bikeId, { bikeId = it }, label = { Text("Fiets-id") }, modifier = Modifier.fillMaxWidth()) }; item { OutlinedTextField(customer, { customer = it }, label = { Text("Klantnaam (optioneel)") }, modifier = Modifier.fillMaxWidth()) }; item { OutlinedTextField(minutes, { minutes = it.filter(Char::isDigit) }, label = { Text("Duur in minuten, max. 10080") }, modifier = Modifier.fillMaxWidth()) }; item { Button(enabled = !busy && bikeId.isNotBlank(), onClick = { val ttl = minutes.toIntOrNull(); if (ttl == null) { message = "Vul een geldige duur in."; return@Button }; busy = true; scope.launch { background { api.reserve(JSONObject().put("bikeId", bikeId).put("source", "MANUAL").put("customerName", customer).put("expiresInMinutes", ttl)) }.onSuccess { message = "Reservering aangemaakt."; bikeId = ""; customer = ""; load() }.onFailure { message = it.message }; busy = false } }) { Text("Reserveren") } }; message?.let { item { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) } }; items(rows) { row -> Card { Column(Modifier.padding(12.dp)) { val bike = row.getJSONObject("bike"); Text("${bike.optString("inventoryCode")} · ${bike.optString("title")}"); Text("Verloopt: ${row.optString("expiresAt")}", style = MaterialTheme.typography.bodySmall); if (!row.has("order") || row.isNull("order")) TextButton(onClick = { scope.launch { background { api.releaseReservation(row.getString("id")) }.onSuccess { load() }.onFailure { message = it.message } } }) { Text("Vrijgeven") } else Text("Checkout-reservering: via betaling verwerken", style = MaterialTheme.typography.bodySmall) } } } }
}

@Composable private fun AdvertisementScreen(api: DemiApi, back: () -> Unit) {
  val scope = rememberCoroutineScope(); var bikeId by remember { mutableStateOf("") }; var busy by remember { mutableStateOf(false) }; var listing by remember { mutableStateOf<String?>(null) }; var error by remember { mutableStateOf<String?>(null) }
  Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { TextButton(onClick = back) { Text("← Terug") }; Text("Advertentie-assistent", style = MaterialTheme.typography.headlineMedium); Text("Genereert alleen kopieerbare tekst uit het fietsdossier; de app plaatst nooit zelfstandig advertenties.", color = MaterialTheme.colorScheme.onSurfaceVariant); OutlinedTextField(bikeId, { bikeId = it }, label = { Text("Fiets-id") }, modifier = Modifier.fillMaxWidth()); Button(enabled = !busy && bikeId.isNotBlank(), onClick = { busy = true; error = null; scope.launch { background { api.advertisement(bikeId) }.onSuccess { json -> val item = json.getJSONObject("listing"); listing = item.optString("title") + "\n\n" + item.optString("description") }.onFailure { error = it.message }; busy = false } }) { Text("Advertentietekst maken") }; if (busy) CircularProgressIndicator(); error?.let { Text(it, color = MaterialTheme.colorScheme.error) }; listing?.let { OutlinedTextField(it, {}, readOnly = true, label = { Text("Kopieer naar Marktplaats") }, modifier = Modifier.fillMaxWidth().weight(1f)) } }
}

@Composable private fun SettingsScreen(api: DemiApi, sessions: SessionStore, activity: MainActivity, back: () -> Unit) {
  var current by remember { mutableStateOf("") }; var next by remember { mutableStateOf("") }; var message by remember { mutableStateOf<String?>(null) }; var biometric by remember { mutableStateOf(sessions.biometricEnabled()) }
  val scope = rememberCoroutineScope()
  val categories = listOf("sales" to "Verkopen", "inventory" to "Lage voorraad en oude voorraad", "reservations" to "Reserveringen", "payments" to "Betalingen controleren", "workshop" to "Werkplaats", "service" to "Nieuwe serviceverzoeken", "appointments" to "Nieuwe afspraken")
  val enabled = remember { mutableStateOf(categories.associate { it.first to sessions.notificationEnabled(it.first) }) }
  LazyColumn(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) { item { TextButton(onClick = back) { Text("← Terug") } }; item { Text("App-instellingen", style = MaterialTheme.typography.headlineMedium) }; item { Text("Pincode wijzigen", style = MaterialTheme.typography.titleLarge) }; item { OutlinedTextField(current, { current = it.filter(Char::isDigit).take(8) }, label = { Text("Huidige pincode") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth()) }; item { OutlinedTextField(next, { next = it.filter(Char::isDigit).take(8) }, label = { Text("Nieuwe pincode (min. 6 cijfers)") }, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth()) }; item { Button(onClick = { message = if (next.length < 6) "Nieuwe pincode moet minimaal 6 cijfers hebben." else if (sessions.changePin(current, next)) { current = ""; next = ""; "Pincode gewijzigd." } else "Huidige pincode is onjuist." }) { Text("Pincode wijzigen") } }; item { Text("Biometrie", style = MaterialTheme.typography.titleLarge) }; item { Button(onClick = { val available = BiometricManager.from(activity).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) == BiometricManager.BIOMETRIC_SUCCESS; if (!available) message = "Biometrie is niet beschikbaar op dit toestel." else { biometric = !biometric; sessions.setBiometricEnabled(biometric); message = if (biometric) "Vingerafdruk ontgrendeling ingeschakeld." else "Vingerafdruk ontgrendeling uitgeschakeld." } }) { Text(if (biometric) "Biometrie uitschakelen" else "Biometrie inschakelen") } }; item { Text("Push- en in-app-meldingen", style = MaterialTheme.typography.titleLarge) }; item { Text("Pushmeldingen worden per categorie naar dit toestel gestuurd. De wijzigingen worden direct gesynchroniseerd.", color = MaterialTheme.colorScheme.onSurfaceVariant) }; item { Button(onClick = { message = "Testmelding wordt verzonden…"; scope.launch(Dispatchers.IO) { val result = runCatching { api.testPushNotification() }; withContext(Dispatchers.Main) { message = result.fold({ if (it.optBoolean("ok")) "Testmelding verzonden." else "Geen actief push-token op dit toestel." }, { it.message ?: "Testmelding kon niet worden verzonden." }) } } }) { Text("Test pushmelding") } }; items(categories) { (key, label) -> val isOn = enabled.value[key] == true; Card(onClick = { val nextValue = !isOn; enabled.value = enabled.value + (key to nextValue); sessions.setNotificationEnabled(key, nextValue); message = "Meldingvoorkeur opgeslagen."; scope.launch(Dispatchers.IO) { runCatching { api.syncPushPreferences() } } }) { Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) { Text(label); Text(if (isOn) "Aan" else "Uit") } } }; message?.let { item { Text(it, color = MaterialTheme.colorScheme.primary) } } }
}
