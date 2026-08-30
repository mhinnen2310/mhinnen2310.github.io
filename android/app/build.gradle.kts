plugins { id("com.android.application"); id("org.jetbrains.kotlin.android"); id("org.jetbrains.kotlin.plugin.compose") }

android { namespace = "nl.demifietsen.staff"; compileSdk = 35
  defaultConfig { applicationId = "nl.demifietsen.staff"; minSdk = 26; targetSdk = 35; versionCode = 1; versionName = "0.1.0" }
  buildFeatures { compose = true; buildConfig = true }
  buildTypes {
    debug {
      buildConfigField("String", "API_BASE_URL", "\"https://demifietsen-preview.onrender.com\"")
      manifestPlaceholders["usesCleartextTraffic"] = "false"
    }
    release {
      buildConfigField("String", "API_BASE_URL", "\"https://demifietsen.nl\"")
      manifestPlaceholders["usesCleartextTraffic"] = "false"
    }
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
}

kotlin { compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) } }
dependencies {
  implementation(platform("androidx.compose:compose-bom:2024.12.01"))
  implementation("androidx.activity:activity-compose:1.10.0")
  implementation("androidx.compose.material3:material3")
  implementation("androidx.navigation:navigation-compose:2.8.5")
  implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
  implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
  implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
  implementation("androidx.biometric:biometric:1.1.0")
  implementation("androidx.datastore:datastore-preferences:1.1.2")
  implementation("com.squareup.okhttp3:okhttp:4.12.0")
  implementation("com.google.mlkit:barcode-scanning:17.3.0")
  implementation("androidx.camera:camera-camera2:1.4.1")
  implementation("androidx.camera:camera-lifecycle:1.4.1")
  implementation("androidx.camera:camera-view:1.4.1")
  implementation("androidx.core:core-ktx:1.15.0")
  implementation("androidx.security:security-crypto:1.1.0-alpha06")
  testImplementation("junit:junit:4.13.2")
}
