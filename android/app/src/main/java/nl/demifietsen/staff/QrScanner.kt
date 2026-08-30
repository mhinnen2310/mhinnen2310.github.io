package nl.demifietsen.staff

import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage

/** Camera transport only: a resolved QR value is still checked by the backend. */
@Composable fun QrCameraScanner(modifier: Modifier = Modifier, onToken: (String) -> Unit) {
  val lifecycleOwner = LocalLifecycleOwner.current
  val context = androidx.compose.ui.platform.LocalContext.current
  val previewView = remember { PreviewView(context) }
  DisposableEffect(lifecycleOwner) {
    val providerFuture = ProcessCameraProvider.getInstance(context)
    val executor = ContextCompat.getMainExecutor(context)
    providerFuture.addListener({
      val provider = providerFuture.get()
      val preview = Preview.Builder().build().also { it.surfaceProvider = previewView.surfaceProvider }
      val analysis = ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
      val scanner = BarcodeScanning.getClient()
      analysis.setAnalyzer(executor) { proxy ->
        val mediaImage = proxy.image
        if (mediaImage == null) { proxy.close(); return@setAnalyzer }
        scanner.process(InputImage.fromMediaImage(mediaImage, proxy.imageInfo.rotationDegrees))
          .addOnSuccessListener { codes ->
            val value = codes.firstNotNullOfOrNull { it.rawValue } ?: return@addOnSuccessListener
            val token = runCatching { android.net.Uri.parse(value).lastPathSegment }.getOrNull() ?: value
            if (token.matches(Regex("[A-Za-z0-9_-]{43}"))) onToken(token)
          }.addOnCompleteListener { proxy.close() }
      }
      provider.unbindAll()
      provider.bindToLifecycle(lifecycleOwner, androidx.camera.core.CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
    }, executor)
    onDispose { providerFuture.get().unbindAll() }
  }
  AndroidView(factory = { previewView }, modifier = modifier)
}
