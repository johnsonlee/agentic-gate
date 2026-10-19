plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.sonatype.publish)
}

description = "JVM code quality engine for Agentic Gate"

dependencies {
    implementation(libs.android.lint.api)
    implementation(libs.android.lint)

    testImplementation(kotlin("test"))
    testImplementation(libs.android.lint.tests)
}

kotlin {
    jvmToolchain(17)
}
