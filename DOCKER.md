# Docker Development Environment for MCP SuperAssistant

This Docker setup provides a complete development environment for the MCP SuperAssistant Chrome extension project, including all necessary dependencies and build tools.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (version 20.10+)
- [Docker Compose](https://docs.docker.com/compose/install/) (version 2.0+)

## Quick Start

### Linux/macOS (Bash)
1. **Initial Setup**
   ```bash
   ./docker-dev.sh setup
   ```

2. **Start Development**
   ```bash
   ./docker-dev.sh dev
   ```

3. **Build for Production**
   ```bash
   ./docker-dev.sh build
   ```

### Windows (PowerShell)
1. **Initial Setup**
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser  # One-time setup
   .\docker-dev.ps1 setup
   ```

2. **Start Development**
   ```powershell
   .\docker-dev.ps1 dev
   ```

3. **Build for Production**
   ```powershell
   .\docker-dev.ps1 build
   ```

## Available Commands

Both `docker-dev.sh` (Bash) and `docker-dev.ps1` (PowerShell) scripts provide the same commands:

### Development Commands
- `./docker-dev.sh setup` / `.\docker-dev.ps1 setup` - Build Docker images and install dependencies
- `./docker-dev.sh dev` / `.\docker-dev.ps1 dev` - Start development environment with hot reload
- `./docker-dev.sh stop` / `.\docker-dev.ps1 stop` - Stop all running containers
- `./docker-dev.sh logs` / `.\docker-dev.ps1 logs` - Show logs from development container
- `./docker-dev.sh shell` / `.\docker-dev.ps1 shell` - Open shell in development container

### Build Commands
- `./docker-dev.sh build` / `.\docker-dev.ps1 build` - Build the Chrome extension for production
- `./docker-dev.sh build-firefox` / `.\docker-dev.ps1 build-firefox` - Build the Firefox extension
- `./docker-dev.sh package` / `.\docker-dev.ps1 package` - Create distributable package (tar.gz)

### Quality Assurance Commands
- `./docker-dev.sh lint` / `.\docker-dev.ps1 lint` - Run ESLint code linting
- `./docker-dev.sh type-check` / `.\docker-dev.ps1 type-check` - Run TypeScript type checking
- `./docker-dev.sh test` / `.\docker-dev.ps1 test` - Run end-to-end tests

### Maintenance Commands
- `./docker-dev.sh clean` / `.\docker-dev.ps1 clean` - Remove all containers and images
- `./docker-dev.sh help` / `.\docker-dev.ps1 help` - Show help message

## Docker Services

The `docker-compose.yml` defines several services:

### `dev`
Development environment with:
- Hot reload capability
- Source code mounted as volumes
- Ports 3000 and 5173 exposed
- Development environment variables set

### `build`
Production build environment for Chrome extension

### `build-firefox`
Production build environment for Firefox extension

### `lint`, `type-check`, `test`
Quality assurance services for code validation

### `package`
Service to create distributable packages

## Development Workflow

### 1. Initial Setup
```bash
# Clone the repository
git clone <repository-url>
cd mcp-superassistant

# Set up Docker environment
./docker-dev.sh setup
```

### 2. Development
```bash
# Start development with hot reload
./docker-dev.sh dev

# In another terminal, you can run:
./docker-dev.sh logs    # View logs
./docker-dev.sh shell   # Access container shell
```

The development server will be available at:
- Extension hot reload: `http://localhost:5173`
- Additional services: `http://localhost:3000`

### 3. Code Quality Checks
```bash
# Run linting
./docker-dev.sh lint

# Check TypeScript types
./docker-dev.sh type-check

# Run tests
./docker-dev.sh test
```

### 4. Building for Production
```bash
# Build Chrome extension
./docker-dev.sh build

# Build Firefox extension
./docker-dev.sh build-firefox

# Create distributable package
./docker-dev.sh package
```

Built files will be available in:
- `chrome-extension/dist/` - Extension files
- `dist/` - Packaged distributions

## Docker Architecture

### Multi-Stage Build
The Dockerfile uses a multi-stage build approach:

1. **Base Stage**: Sets up Node.js 22.12.0 and pnpm 9.15.1
2. **Dependencies Stage**: Installs all npm dependencies
3. **Development Stage**: Complete development environment
4. **Builder Stage**: Production build environment
5. **Production Stage**: Minimal runtime with built artifacts

### Volume Mounts
In development mode:
- Source code is mounted for hot reload
- `node_modules` are preserved in named volumes for performance
- Build outputs are mounted to host for easy access

## Environment Variables

The Docker setup supports the following environment variables:

- `NODE_ENV`: Set to `development` or `production`
- `CLI_CEB_DEV`: Enable development mode
- `CLI_CEB_FIREFOX`: Enable Firefox build mode

## Troubleshooting

### Permission Issues
If you encounter permission issues with file mounting:
```bash
# On Linux/macOS, ensure proper ownership
sudo chown -R $USER:$USER .
```

### Port Conflicts
If ports 3000 or 5173 are already in use:
1. Stop the conflicting services
2. Or modify the ports in `docker-compose.yml`

### Container Issues
```bash
# Stop and remove all containers
./docker-dev.sh stop

# Clean up everything and start fresh
./docker-dev.sh clean
./docker-dev.sh setup
```

### Build Issues
```bash
# Access container shell to debug
./docker-dev.sh shell

# Inside container, you can run:
pnpm install
pnpm build
pnpm type-check
```

## Performance Tips

1. **Use `.dockerignore`**: The included `.dockerignore` file optimizes build performance
2. **Layer Caching**: Dependencies are installed in a separate layer for better caching
3. **Volume Mounts**: Development uses volume mounts to avoid copying files repeatedly

## Security Considerations

- The Docker setup runs as the default user (not root when possible)
- Only necessary ports are exposed
- Build artifacts are created in isolated containers
- No sensitive data is baked into images

## Comparison with Native Development

| Aspect | Docker | Native |
|--------|--------|--------|
| Setup Time | Longer initial setup | Faster initial setup |
| Consistency | Same across all environments | May vary by system |
| Dependencies | Isolated in container | Installed globally |
| Performance | Slight overhead | Native performance |
| Cleanup | Easy with `docker-dev.sh clean` | Manual cleanup needed |

Choose Docker when you want:
- Consistent development environment across team members
- Easy setup and teardown
- Isolation from your host system
- Production-like build environment

Choose native development when you want:
- Maximum performance
- Faster iteration cycles
- Direct access to system tools
- Simpler debugging workflow
