#!/bin/sh
# Downloads the official Gradle 8.10.2 wrapper (jar + script) into android/.
# Needed once, because a binary .jar can't be shipped inside the zip.
set -e
cd "$(dirname "$0")/../android"
BASE=https://raw.githubusercontent.com/gradle/gradle/v8.10.2
curl -fsSL -o gradle/wrapper/gradle-wrapper.jar "$BASE/gradle/wrapper/gradle-wrapper.jar"
curl -fsSL -o gradlew "$BASE/gradlew"
chmod +x gradlew
echo "Gradle wrapper ready."
