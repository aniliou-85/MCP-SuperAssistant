#!/bin/bash

# Docker Environment Validation Script
# Tests that the Docker setup works correctly

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

echo "=================================="
echo "Docker Environment Validation"
echo "=================================="

# Test 1: Check Docker installation
print_test "Checking Docker installation..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_pass "Docker is installed: $DOCKER_VERSION"
else
    print_fail "Docker is not installed"
    exit 1
fi

# Test 2: Check Docker Compose installation
print_test "Checking Docker Compose installation..."
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    print_pass "Docker Compose is installed: $COMPOSE_VERSION"
else
    print_fail "Docker Compose is not installed"
    exit 1
fi

# Test 3: Check Docker daemon
print_test "Checking Docker daemon..."
if docker info &> /dev/null; then
    print_pass "Docker daemon is running"
else
    print_fail "Docker daemon is not running"
    exit 1
fi

# Test 4: Validate Dockerfile syntax
print_test "Validating Dockerfile syntax..."
if docker build --dry-run . &> /dev/null; then
    print_pass "Dockerfile syntax is valid"
else
    print_fail "Dockerfile has syntax errors"
    exit 1
fi

# Test 5: Validate docker-compose.yml syntax
print_test "Validating docker-compose.yml syntax..."
if docker-compose config &> /dev/null; then
    print_pass "docker-compose.yml syntax is valid"
else
    print_fail "docker-compose.yml has syntax errors"
    exit 1
fi

# Test 6: Check required files
print_test "Checking required Docker files..."
REQUIRED_FILES=("Dockerfile" "docker-compose.yml" ".dockerignore" "docker-dev.sh")
for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_pass "Found $file"
    else
        print_fail "Missing $file"
        exit 1
    fi
done

# Test 7: Check project structure
print_test "Checking project structure..."
REQUIRED_DIRS=("chrome-extension" "packages" "pages")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        print_pass "Found directory $dir"
    else
        print_fail "Missing directory $dir"
        exit 1
    fi
done

# Test 8: Check package.json
print_test "Checking package.json..."
if [ -f "package.json" ] && grep -q "pnpm" package.json; then
    print_pass "package.json found with pnpm configuration"
else
    print_fail "package.json missing or incorrect"
    exit 1
fi

# Test 9: Build Docker image (dry run)
print_test "Testing Docker image build (base stage only)..."
if docker build --target base --tag mcp-superassistant:test . &> /dev/null; then
    print_pass "Base Docker image builds successfully"
    # Clean up test image
    docker rmi mcp-superassistant:test &> /dev/null || true
else
    print_fail "Docker image build failed"
    exit 1
fi

# Test 10: Check docker-dev.sh permissions
print_test "Checking docker-dev.sh permissions..."
if [ -x "docker-dev.sh" ]; then
    print_pass "docker-dev.sh is executable"
else
    print_fail "docker-dev.sh is not executable"
    print_info "Run: chmod +x docker-dev.sh"
    exit 1
fi

echo ""
echo "=================================="
print_pass "All validation tests passed!"
echo "=================================="
echo ""
print_info "Your Docker environment is ready!"
print_info "Next steps:"
echo "  1. Run './docker-dev.sh setup' to build the development environment"
echo "  2. Run './docker-dev.sh dev' to start development"
echo "  3. See DOCKER.md for detailed usage instructions"
echo ""
