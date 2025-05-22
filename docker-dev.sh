#!/bin/bash

# Docker Development Script for MCP SuperAssistant
# This script provides easy commands to work with the Docker environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${GREEN}[MCP SuperAssistant Docker]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
}

# Show help
show_help() {
    echo "MCP SuperAssistant Docker Development Script"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  setup           - Build Docker images and install dependencies"
    echo "  dev             - Start development environment with hot reload"
    echo "  stop            - Stop all running containers"
    echo "  build           - Build the Chrome extension for production"
    echo "  build-firefox   - Build the Firefox extension"
    echo "  package         - Create distributable package"
    echo "  lint            - Run code linting"
    echo "  type-check      - Run TypeScript type checking"
    echo "  test            - Run end-to-end tests"
    echo "  clean           - Remove all containers and images"
    echo "  logs            - Show logs from development container"
    echo "  shell           - Open shell in development container"
    echo "  help            - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 setup         # Initial setup"
    echo "  $0 dev           # Start development"
    echo "  $0 build         # Build for production"
}

# Setup function
setup() {
    print_message "Setting up Docker environment..."
    docker-compose build dev
    print_message "Setup complete! You can now run '$0 dev' to start development."
}

# Development function
dev() {
    print_message "Starting development environment..."
    print_info "The development server will be available at:"
    print_info "- Extension hot reload: http://localhost:5173"
    print_info "- Additional services: http://localhost:3000"
    print_info ""
    print_info "Press Ctrl+C to stop the development server"
    
    docker-compose up dev
}

# Stop function
stop() {
    print_message "Stopping all containers..."
    docker-compose down
}

# Build function
build() {
    print_message "Building Chrome extension for production..."
    docker-compose run --rm build
    print_message "Build complete! Check the chrome-extension/dist directory."
}

# Build Firefox function
build_firefox() {
    print_message "Building Firefox extension..."
    docker-compose run --rm build-firefox
    print_message "Firefox build complete! Check the chrome-extension/dist directory."
}

# Package function
package() {
    print_message "Creating distributable package..."
    mkdir -p dist
    docker-compose run --rm package
    print_message "Package created in dist/ directory."
}

# Lint function
lint() {
    print_message "Running code linting..."
    docker-compose run --rm lint
}

# Type check function
type_check() {
    print_message "Running TypeScript type checking..."
    docker-compose run --rm type-check
}

# Test function
test() {
    print_message "Running end-to-end tests..."
    docker-compose run --rm test
}

# Clean function
clean() {
    print_warning "This will remove all Docker containers and images for this project."
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_message "Cleaning up Docker environment..."
        docker-compose down --rmi all --volumes --remove-orphans
        print_message "Cleanup complete!"
    else
        print_info "Cleanup cancelled."
    fi
}

# Logs function
logs() {
    print_message "Showing development container logs..."
    docker-compose logs -f dev
}

# Shell function
shell() {
    print_message "Opening shell in development container..."
    docker-compose exec dev sh
}

# Main script logic
check_docker

case "${1:-help}" in
    setup)
        setup
        ;;
    dev)
        dev
        ;;
    stop)
        stop
        ;;
    build)
        build
        ;;
    build-firefox)
        build_firefox
        ;;
    package)
        package
        ;;
    lint)
        lint
        ;;
    type-check)
        type_check
        ;;
    test)
        test
        ;;
    clean)
        clean
        ;;
    logs)
        logs
        ;;
    shell)
        shell
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        echo ""
        show_help
        exit 1
        ;;
esac
