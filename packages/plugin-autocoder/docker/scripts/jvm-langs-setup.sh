#!/bin/bash
# Setup script for JVM languages (Java)

set -e

echo "Setting up JVM languages environment..."

# Export environment variables
export LANGUAGE_TYPE="jvm"
export JAVA_HOME=${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}
export PATH=$JAVA_HOME/bin:$PATH
export MAVEN_OPTS=${MAVEN_OPTS:-"-Xmx2048m -XX:+UseG1GC"}
export GRADLE_OPTS=${GRADLE_OPTS:-"-Xmx2048m -XX:+UseG1GC"}

# Create necessary directories
mkdir -p $WORKSPACE $CACHE_DIR $RESULTS_DIR

# Function to switch Java version
switch_java_version() {
    local version=$1
    
    case $version in
        8|1.8)
            export JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64
            ;;
        11)
            export JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
            ;;
        17)
            export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
            ;;
        21)
            export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
            ;;
        *)
            echo "Unknown Java version: $version"
            return 1
            ;;
    esac
    
    export PATH=$JAVA_HOME/bin:$PATH
    echo "Switched to Java $(java -version 2>&1 | head -n1)"
}

# Detect and setup Java project
setup_java_project() {
    local dir=$1
    
    if [ -f "$dir/pom.xml" ]; then
        echo "Maven project detected"
        cd "$dir"
        # Download dependencies
        mvn dependency:go-offline -B || true
        
        # Detect Java version from pom.xml
        if grep -q "<maven.compiler.source>" pom.xml; then
            local java_version=$(grep -oP '(?<=<maven.compiler.source>)[^<]+' pom.xml | head -1)
            switch_java_version "$java_version"
        fi
        
    elif [ -f "$dir/build.gradle" ] || [ -f "$dir/build.gradle.kts" ]; then
        echo "Gradle project detected"
        cd "$dir"
        
        # Use gradle wrapper if available
        if [ -f "./gradlew" ]; then
            chmod +x ./gradlew
            ./gradlew dependencies --no-daemon || true
        else
            gradle dependencies --no-daemon || true
        fi
        
    elif [ -f "$dir/build.xml" ]; then
        echo "Ant project detected"
        cd "$dir"
        
    elif [ -f "$dir/.classpath" ] && [ -f "$dir/.project" ]; then
        echo "Eclipse project detected"
        cd "$dir"
    fi
}

# Function to detect test framework
detect_test_framework() {
    local dir=$1
    
    if [ -f "$dir/pom.xml" ]; then
        if grep -q "junit-jupiter" "$dir/pom.xml"; then
            echo "junit5"
        elif grep -q "junit" "$dir/pom.xml"; then
            echo "junit4"
        elif grep -q "testng" "$dir/pom.xml"; then
            echo "testng"
        else
            echo "maven test"
        fi
    elif [ -f "$dir/build.gradle" ] || [ -f "$dir/build.gradle.kts" ]; then
        echo "gradle test"
    else
        echo "java"
    fi
}

# Setup Maven repository mirror if needed
setup_maven_mirror() {
    if [ ! -z "$MAVEN_MIRROR_URL" ]; then
        mkdir -p ~/.m2
        cat > ~/.m2/settings.xml <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0
                              http://maven.apache.org/xsd/settings-1.0.0.xsd">
  <mirrors>
    <mirror>
      <id>custom-mirror</id>
      <name>Custom Repository Mirror</name>
      <url>${MAVEN_MIRROR_URL}</url>
      <mirrorOf>*</mirrorOf>
    </mirror>
  </mirrors>
</settings>
EOF
    fi
}

# Setup repository mirrors
setup_maven_mirror

# Log environment info
echo "Java version: $(java -version 2>&1 | head -n1)"
echo "Maven version: $(mvn --version | head -n1 2>/dev/null || echo 'Not installed')"
echo "Gradle version: $(gradle --version | grep Gradle 2>/dev/null || echo 'Not installed')"
echo "Ant version: $(ant -version 2>/dev/null || echo 'Not installed')"

# Start bridge client if no other command specified
if [ $# -eq 0 ]; then
    exec node /bridge/bridge-client.js
else
    exec "$@"
fi 