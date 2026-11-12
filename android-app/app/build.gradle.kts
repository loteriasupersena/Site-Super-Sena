import javax.imageio.ImageIO
import java.awt.RenderingHints
import java.awt.image.BufferedImage

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
        versionCode = 8
        versionName = "1.7.0"
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
    val sourcePng = file("src/main/brand/super-sena-icon.png")
    val outputPng = generatedBrandRes.map { it.file("drawable-nodpi/cambista_super_sena_icon.png") }
    inputs.file(sourcePng)
    outputs.file(outputPng)
    doLast {
        // Usa diretamente a arte oficial preparada para o launcher do Android.
        val original = ImageIO.read(sourcePng)
            ?: error("Não foi possível decodificar o ícone Super Sena.")
        val canvasSize = 512
        val scale = 0.76
        val iconSize = (canvasSize * scale).toInt()
        val x = (canvasSize - iconSize) / 2
        val y = (canvasSize - iconSize) / 2
        val padded = BufferedImage(canvasSize, canvasSize, BufferedImage.TYPE_INT_ARGB)
        val graphics = padded.createGraphics()
        graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC)
        graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
        graphics.drawImage(original, x, y, iconSize, iconSize, null)
        graphics.dispose()

        val target = outputPng.get().asFile
        target.parentFile.mkdirs()
        ImageIO.write(padded, "png", target)
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
    implementation("com.google.zxing:core:3.5.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
