#!/bin/bash
# Setup script for compiled languages (C, C++, Rust, Go)

set -e

echo "Setting up compiled languages environment..."

# Export environment variables
export LANGUAGE_TYPE="compiled"
export CC=${CC:-gcc}
export CXX=${CXX:-g++}
export RUSTFLAGS=${RUSTFLAGS:-"-C target-cpu=native"}
export CGO_ENABLED=${CGO_ENABLED:-1}

# Create necessary directories
mkdir -p $WORKSPACE $CACHE_DIR $RESULTS_DIR

# Setup ccache for faster C/C++ compilation
setup_ccache() {
    if command -v ccache &> /dev/null; then
        export CC="ccache $CC"
        export CXX="ccache $CXX"
        ccache --show-stats
    fi
}

# Detect and setup C/C++ project
setup_cpp_project() {
    local dir=$1
    
    if [ -f "$dir/CMakeLists.txt" ]; then
        echo "CMake project detected"
        mkdir -p "$dir/build"
        cd "$dir/build"
        cmake -DCMAKE_BUILD_TYPE=Release -DCMAKE_EXPORT_COMPILE_COMMANDS=ON ..
    elif [ -f "$dir/Makefile" ] || [ -f "$dir/makefile" ]; then
        echo "Make project detected"
        cd "$dir"
    elif [ -f "$dir/meson.build" ]; then
        echo "Meson project detected"
        cd "$dir"
        meson setup build
    elif [ -f "$dir/configure" ]; then
        echo "Autotools project detected"
        cd "$dir"
        ./configure
    fi
}

# Setup Rust project
setup_rust_project() {
    local dir=$1
    
    if [ -f "$dir/Cargo.toml" ]; then
        echo "Rust project detected"
        cd "$dir"
        # Use sccache if available
        if command -v sccache &> /dev/null; then
            export RUSTC_WRAPPER=sccache
        fi
        cargo fetch
    fi
}

# Setup Go project
setup_go_project() {
    local dir=$1
    
    if [ -f "$dir/go.mod" ]; then
        echo "Go module project detected"
        cd "$dir"
        go mod download
    elif [ -f "$dir/Gopkg.toml" ]; then
        echo "Dep project detected"
        cd "$dir"
        if command -v dep &> /dev/null; then
            dep ensure
        fi
    fi
}

# Detect project language
detect_language() {
    local dir=$1
    
    if [ -f "$dir/Cargo.toml" ]; then
        echo "rust"
    elif [ -f "$dir/go.mod" ] || [ -f "$dir/main.go" ]; then
        echo "go"
    elif [ -f "$dir/CMakeLists.txt" ] || [ -f "$dir/Makefile" ]; then
        # Check for C++ extensions
        if find "$dir" -name "*.cpp" -o -name "*.cxx" -o -name "*.cc" | head -1 | grep -q .; then
            echo "cpp"
        else
            echo "c"
        fi
    else
        echo "unknown"
    fi
}

# Setup build caching
setup_ccache

# Log environment info
echo "GCC version: $(gcc --version | head -n1)"
echo "G++ version: $(g++ --version | head -n1)"
echo "Clang version: $(clang --version | head -n1 2>/dev/null || echo 'Not installed')"
echo "Rust version: $(rustc --version 2>/dev/null || echo 'Not installed')"
echo "Go version: $(go version 2>/dev/null || echo 'Not installed')"
echo "CMake version: $(cmake --version | head -n1 2>/dev/null || echo 'Not installed')"

# Start bridge client if no other command specified
if [ $# -eq 0 ]; then
    exec node /bridge/bridge-client.js
else
    exec "$@"
fi 