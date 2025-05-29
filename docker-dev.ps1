#!/usr/bin/env powershell

# Docker Development Script for MCP SuperAssistant
# This script provides easy commands to work with the Docker environment
# PowerShell version of docker-dev.sh

param(
    [Parameter(Position=0)]
    [string]$Command = "help"
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output (using Write-Host with -ForegroundColor)
function Write-Message {
    param([string]$Message)
    Write-Host "[MCP SuperAssistant Docker] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

# Check if Docker is installed
function Test-Docker {
    try {
        $null = Get-Command docker -ErrorAction Stop
    }
    catch {
        Write-Error "Docker is not installed. Please install Docker first."
        exit 1
    }
    
    try {
        $null = Get-Command docker-compose -ErrorAction Stop
    }
    catch {
        Write-Error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    }
}

# Show help
function Show-Help {
    Write-Host "MCP SuperAssistant Docker Development Script" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\docker-dev.ps1 [COMMAND]" -ForegroundColor White
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor White
    Write-Host "  setup           - Build Docker images and install dependencies" -ForegroundColor Gray
    Write-Host "  dev             - Start development environment with hot reload" -ForegroundColor Gray
    Write-Host "  stop            - Stop all running containers" -ForegroundColor Gray
    Write-Host "  build           - Build the Chrome extension for production" -ForegroundColor Gray
    Write-Host "  build-firefox   - Build the Firefox extension" -ForegroundColor Gray
    Write-Host "  package         - Create distributable package" -ForegroundColor Gray
    Write-Host "  lint            - Run code linting" -ForegroundColor Gray
    Write-Host "  type-check      - Run TypeScript type checking" -ForegroundColor Gray
    Write-Host "  test            - Run end-to-end tests" -ForegroundColor Gray
    Write-Host "  clean           - Remove all containers and images" -ForegroundColor Gray
    Write-Host "  logs            - Show logs from development container" -ForegroundColor Gray
    Write-Host "  shell           - Open shell in development container" -ForegroundColor Gray
    Write-Host "  help            - Show this help message" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor White
    Write-Host "  .\docker-dev.ps1 setup         # Initial setup" -ForegroundColor Gray
    Write-Host "  .\docker-dev.ps1 dev           # Start development" -ForegroundColor Gray
    Write-Host "  .\docker-dev.ps1 build         # Build for production" -ForegroundColor Gray
}

# Setup function
function Invoke-Setup {
    Write-Message "Setting up Docker environment..."
    & docker-compose build dev
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to build Docker environment"
        exit $LASTEXITCODE
    }
    Write-Message "Setup complete! You can now run '.\docker-dev.ps1 dev' to start development."
}

# Development function
function Invoke-Dev {
    Write-Message "Starting development environment..."
    Write-Info "The development server will be available at:"
    Write-Info "- Extension hot reload: http://localhost:5173"
    Write-Info "- Additional services: http://localhost:3000"
    Write-Info ""
    Write-Info "Press Ctrl+C to stop the development server"
    
    & docker-compose up dev
}

# Stop function
function Invoke-Stop {
    Write-Message "Stopping all containers..."
    & docker-compose down
}

# Build function
function Invoke-Build {
    Write-Message "Building Chrome extension for production..."
    & docker-compose run --rm build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build failed"
        exit $LASTEXITCODE
    }
    Write-Message "Build complete! Check the chrome-extension/dist directory."
}

# Build Firefox function
function Invoke-BuildFirefox {
    Write-Message "Building Firefox extension..."
    & docker-compose run --rm build-firefox
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Firefox build failed"
        exit $LASTEXITCODE
    }
    Write-Message "Firefox build complete! Check the dist directory."
}

# Package function
function Invoke-Package {
    Write-Message "Creating distributable package..."
    if (-not (Test-Path "dist")) {
        New-Item -ItemType Directory -Path "dist" -Force | Out-Null
    }
    & docker-compose run --rm package
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Package creation failed"
        exit $LASTEXITCODE
    }
    Write-Message "Package created in dist/ directory."
}

# Lint function
function Invoke-Lint {
    Write-Message "Running code linting..."
    & docker-compose run --rm lint
}

# Type check function
function Invoke-TypeCheck {
    Write-Message "Running TypeScript type checking..."
    & docker-compose run --rm type-check
}

# Test function
function Invoke-Test {
    Write-Message "Running end-to-end tests..."
    & docker-compose run --rm test
}

# Clean function
function Invoke-Clean {
    Write-Warning "This will remove all Docker containers and images for this project."
    $response = Read-Host "Are you sure? (y/N)"
    
    if ($response -match "^[Yy]$") {
        Write-Message "Cleaning up Docker environment..."
        & docker-compose down --rmi all --volumes --remove-orphans
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Cleanup failed"
            exit $LASTEXITCODE
        }
        Write-Message "Cleanup complete!"
    }
    else {
        Write-Info "Cleanup cancelled."
    }
}

# Logs function
function Invoke-Logs {
    Write-Message "Showing development container logs..."
    & docker-compose logs -f dev
}

# Shell function
function Invoke-Shell {
    Write-Message "Opening shell in development container..."
    & docker-compose exec dev sh
}

# Main script logic
Test-Docker

switch ($Command.ToLower()) {
    "setup" {
        Invoke-Setup
    }
    "dev" {
        Invoke-Dev
    }
    "stop" {
        Invoke-Stop
    }
    "build" {
        Invoke-Build
    }
    "build-firefox" {
        Invoke-BuildFirefox
    }
    "package" {
        Invoke-Package
    }
    "lint" {
        Invoke-Lint
    }
    "type-check" {
        Invoke-TypeCheck
    }
    "test" {
        Invoke-Test
    }
    "clean" {
        Invoke-Clean
    }
    "logs" {
        Invoke-Logs
    }
    "shell" {
        Invoke-Shell
    }
    "help" {
        Show-Help
    }
    "--help" {
        Show-Help
    }
    "-h" {
        Show-Help
    }
    default {
        Write-Error "Unknown command: $Command"
        Write-Host ""
        Show-Help
        exit 1
    }
}
