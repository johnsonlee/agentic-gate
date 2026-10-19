plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.sonatype.publish)
}

description = "Non-negotiable JVM rules for Agentic Gate"

dependencies {
    api(project(":jvm:engine"))
    compileOnly(libs.android.lint.api)

    testImplementation(kotlin("test"))
    testImplementation(libs.android.lint.api)
    testImplementation(libs.android.lint.tests)
}

kotlin {
    jvmToolchain(17)
}
