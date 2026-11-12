import java.util.Base64

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "br.com.loteriasupersena.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.com.loteriasupersena.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 5
        versionName = "1.4.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}


val generatedBrandRes = layout.buildDirectory.dir("generated/brand-res")

android.sourceSets.getByName("main").res.srcDir(generatedBrandRes)

val generateBrandLauncherIcon by tasks.registering {
    val sourceSvg = file("../../public/images/brand/super-sena-icon.svg")
    val outputPng = generatedBrandRes.map { it.file("drawable-nodpi/cambista_super_sena_icon.png") }
    inputs.file(sourceSvg)
    outputs.file(outputPng)
    doLast {
        val svgText = sourceSvg.readText()
        val encodedPng = Regex("data:image/png;base64,([A-Za-z0-9+/=]+)")
            .find(svgText)?.groupValues?.get(1)
            ?: error("Não foi possível localizar a imagem PNG da marca Super Sena.")
        val target = outputPng.get().asFile
        target.parentFile.mkdirs()
        target.writeBytes(Base64.getDecoder().decode(encodedPng))
    }
}

tasks.named("preBuild").configure {
    dependsOn(generateBrandLauncherIcon)
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.10.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("com.google.android.material:material:1.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("com.google.zxing:core:3.5.3")
}
