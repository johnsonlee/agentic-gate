pluginManagement {
    repositories {
        gradlePluginPortal()
        google()
        mavenCentral()
    }
}

rootProject.name = "agentic-gate"

include(":jvm:engine")
include(":jvm:rules")
include(":jvm:gradle")
