package nl.demifietsen.staff

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DemiColors = lightColorScheme(
  // The approved app concept uses the same green/white identity as the site.
  // Keeping the palette here also prevents Material's purple defaults from
  // leaking into screens that do not provide their own colors.
  primary = Color(0xFF12624F), onPrimary = Color.White,
  primaryContainer = Color(0xFFDFF2EA), onPrimaryContainer = Color(0xFF0B4437),
  secondary = Color(0xFFA15C00), onSecondary = Color.White,
  background = Color(0xFFF5F8F6), onBackground = Color(0xFF19302B),
  surface = Color.White, onSurface = Color(0xFF19302B),
  surfaceVariant = Color(0xFFEEF4F0), onSurfaceVariant = Color(0xFF63746F),
  outline = Color(0xFFDBE5E0), error = Color(0xFFA1352C),
)

@Composable fun DemiTheme(content: @Composable () -> Unit) = MaterialTheme(colorScheme = DemiColors, content = content)
