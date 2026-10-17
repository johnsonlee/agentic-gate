plugins {
    base
    alias(libs.plugins.kotlin.jvm) apply false
    alias(libs.plugins.sonatype.publish)
}

allprojects {
    group = "io.johnsonlee.agentic.gate"
    version = rootProject.version

    repositories {
        google()
        mavenCentral()
    }
}

tasks.named("check") {
    dependsOn(
        subprojects
            .filter { project -> project.childProjects.isEmpty() }
            .map { project -> "${project.path}:check" },
    )
}
