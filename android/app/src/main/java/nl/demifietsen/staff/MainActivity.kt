package nl.demifietsen.staff

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class MainActivity : FragmentActivity() {
  private val cameraPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
  override fun onCreate(state: Bundle?) {
    super.onCreate(state)
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) cameraPermission.launch(Manifest.permission.CAMERA)
    setContent { DemiTheme { StaffRoot(SessionStore(this), BuildConfig.API_BASE_URL, this) } }
  }
  fun unlockWithBiometric(onSuccess: () -> Unit) {
    if (BiometricManager.from(this).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) != BiometricManager.BIOMETRIC_SUCCESS) return
    BiometricPrompt(this, ContextCompat.getMainExecutor(this), object : BiometricPrompt.AuthenticationCallback() {
      override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) { onSuccess() }
    }).authenticate(BiometricPrompt.PromptInfo.Builder().setTitle("Demi Fietsen").setSubtitle("Ontgrendel de medewerkersapp").setNegativeButtonText("Gebruik pincode").build())
  }
}

private suspend fun <T> background(action: () -> T): Result<T> = withContext(Dispatchers.IO) { runCatching(action) }

@Composable private fun StaffRoot(sessions: SessionStore, baseUrl: String, activity: MainActivity) {
  val api = remember { DemiApi(baseUrl, sessions) }
  val scope = rememberCoroutineScope()
  var signedIn by remember { mutableStateOf(sessions.token() != null) }
  var unlocked by remember { mutableStateOf(!sessions.hasPin()) }
  LifecycleEventEffect(Lifecycle.Event.ON_STOP) { if (signedIn && sessions.hasPin()) unlocked = false }
  when {
    !signedIn -> LoginScreen(api, onLoggedIn = { signedIn = true; unlocked = !sessions.hasPin() })
    !sessions.hasPin() -> PinScreen("Kies een app-pincode", "Deze pincode ontgrendelt de app op dit toestel.", false, null, true) { pin -> sessions.savePin(pin); unlocked = true; true }
    !unlocked -> PinScreen("App vergrendeld", "Voer je persoonlijke pincode in of gebruik je vingerafdruk.", true, { activity.unlockWithBiometric { unlocked = true } }, false) { pin -> sessions.verifyPin(pin).also { if (it) unlocked = true } }
    else -> StaffApp(api, onLogout = { scope.launch { background { api.logout() } }; signedIn = false; unlocked = false })
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

@Composable private fun StaffApp(api: DemiApi, onLogout: () -> Unit) {
  var screen by remember { mutableStateOf("home") }
  when (screen) {
    "inventory" -> InventoryScreen(api) { screen = "home" }
    "scan" -> QrLookupScreen(api) { screen = "home" }
    "new-bike" -> NewBikeScreen(api) { screen = "home" }
    "workshop" -> WorkshopScreen(api) { screen = "home" }
    "sales" -> SalesScreen(api) { screen = "home" }
    else -> HomeScreen(open = { screen = it }, logout = { onLogout() })
  }
}

@Composable private fun HomeScreen(open: (String) -> Unit, logout: () -> Unit) {
  val actions = listOf("QR scannen" to "scan", "Nieuwe fiets" to "new-bike", "Voorraad" to "inventory", "Werkplaats" to "workshop", "Verkopen" to "sales", "Advertenties" to "ads", "Reserveringen" to "reservations")
  LazyColumn(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    item { Text("Demi Fietsen", style = MaterialTheme.typography.headlineLarge) }
    item { Text("Medewerkers", color = MaterialTheme.colorScheme.onSurfaceVariant) }
    items(actions) { (label, route) -> Card(onClick = { open(route) }, colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) { Text(label, style = MaterialTheme.typography.titleMedium, modifier = Modifier.fillMaxWidth().padding(20.dp)) } }
    item { TextButton(onClick = logout) { Text("Uitloggen") } }
  }
}

@Composable private fun InventoryScreen(api: DemiApi, back: () -> Unit) {
  var busy by remember { mutableStateOf(false) }; var error by remember { mutableStateOf<String?>(null) }; var rows by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
  val scope = rememberCoroutineScope()
  Column(Modifier.fillMaxSize().padding(20.dp)) {
    Row { TextButton(onClick = back) { Text("← Terug") }; Text("Voorraad", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.padding(top = 12.dp)) }
    Button(enabled = !busy, onClick = { busy = true; error = null; scope.launch { background { api.inventory() }.onSuccess { result -> rows = (0 until result.getJSONArray("bikes").length()).map { result.getJSONArray("bikes").getJSONObject(it) } }.onFailure { error = it.message }; busy = false } }) { Text("Voorraad verversen") }
    error?.let { Text(it, color = MaterialTheme.colorScheme.error) }; if (busy) CircularProgressIndicator(Modifier.padding(16.dp))
    LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 12.dp)) { items(rows) { bike -> Card { Column(Modifier.padding(14.dp)) { Text(bike.optString("title")); Text("${bike.optString("inventoryCode")} · ${bike.optString("status")}", color = MaterialTheme.colorScheme.onSurfaceVariant); Text("€ ${(bike.optInt("priceCents") / 100.0)}") } } } }
  }
}

@Composable private fun QrLookupScreen(api: DemiApi, back: () -> Unit) {
  var token by remember { mutableStateOf("") }; var busy by remember { mutableStateOf(false) }; var result by remember { mutableStateOf<String?>(null) }; var error by remember { mutableStateOf<String?>(null) }
  val scope = rememberCoroutineScope()
  Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
    TextButton(onClick = back) { Text("← Terug") }; Text("QR scannen", style = MaterialTheme.typography.headlineMedium)
    Text("Scan een Demi Fietsen QR-label. De app verifieert de code altijd opnieuw bij de backend.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    QrCameraScanner(modifier = Modifier.fillMaxWidth().height(230.dp)) { scanned -> token = scanned }
    OutlinedTextField(token, { token = it.trim() }, label = { Text("QR-token") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
    Button(enabled = !busy && token.isNotBlank(), onClick = { busy = true; result = null; error = null; scope.launch { background { api.resolveQr(token) }.onSuccess { json -> result = json.toString(2) }.onFailure { error = it.message }; busy = false } }) { Text("Opzoeken") }
    error?.let { Text(it, color = MaterialTheme.colorScheme.error) }; result?.let { Text(it) }
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
