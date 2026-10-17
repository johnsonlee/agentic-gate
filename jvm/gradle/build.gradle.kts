import groovy.util.Node
import org.gradle.api.publish.maven.MavenPublication

plugins {
    `java-gradle-plugin`
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.sonatype.publish)
}

description = "Gradle runner for Agentic Gate"

dependencies {
    implementation(project(":jvm:engine"))
    implementation(project(":jvm:rules"))
    testImplementation(gradleTestKit())
    testImplementation(kotlin("test"))
}

gradlePlugin {
    plugins {
        create("agenticGate") {
            id = "io.johnsonlee.agentic.gate"
            implementationClass = "io.johnsonlee.agentic.gate.AgenticGatePlugin"
            displayName = "Agentic Gate"
            description = project.description
        }
    }
}

afterEvaluate {
    publishing.publications.withType<MavenPublication>().configureEach {
        if (!name.endsWith("PluginMarkerMaven")) return@configureEach
        pom.withXml {
            val root = asNode()
            val elements = root.children().filterIsInstance<Node>()
            setOf("name", "description").forEach { elementName ->
                elements
                    .filter { element -> element.name().toString().substringAfterLast('}') == elementName }
                    .drop(1)
                    .forEach(root::remove)
            }
        }
    }
}

kotlin {
    jvmToolchain(17)
}

val functionalTestSourceSet = sourceSets.create("functionalTest")
gradlePlugin.testSourceSets(functionalTestSourceSet)
configurations[functionalTestSourceSet.implementationConfigurationName]
    .extendsFrom(configurations.testImplementation.get())
configurations[functionalTestSourceSet.runtimeOnlyConfigurationName]
    .extendsFrom(configurations.testRuntimeOnly.get())

val functionalTest by tasks.registering(Test::class) {
    testClassesDirs = functionalTestSourceSet.output.classesDirs
    classpath = functionalTestSourceSet.runtimeClasspath
    shouldRunAfter(tasks.test)
}

tasks.check {
    dependsOn(functionalTest)
}
