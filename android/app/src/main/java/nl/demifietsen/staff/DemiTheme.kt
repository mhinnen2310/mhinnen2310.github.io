package nl.demifietsen.staff

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DemiColors = lightColorScheme(
  primary = Color(0xFF2A533D), onPrimary = Color.White,
  primaryContainer = Color(0xFFDfece2), onPrimaryContainer = Color(0xFF1D372A),
  secondary = Color(0xFFA35A15), onSecondary = Color.White,
  background = Color(0xFFF7F6F3), onBackground = Color(0xFF1F2421),
  surface = Color.White, onSurface = Color(0xFF1F2421),
  surfaceVariant = Color(0xFFF1F6F2), onSurfaceVariant = Color(0xFF55605A),
  outline = Color(0xFFE4E2DB), error = Color(0xFFA1352C),
)

@Composable fun DemiTheme(content: @Composable () -> Unit) = MaterialTheme(colorScheme = DemiColors, content = content)
