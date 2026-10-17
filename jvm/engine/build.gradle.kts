plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.sonatype.publish)
}

description = "Android Lint-based JVM lint engine for Agentic Gate"

dependencies {
    api(libs.android.lint.api)
    implementation(libs.android.lint)

    testImplementation(kotlin("test"))
    testImplementation(libs.android.lint.tests)
}

kotlin {
    jvmToolchain(17)
}
