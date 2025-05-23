# Suggested Commands for Development

## Essential Development Commands:

### Setup and Installation:
```bash
# Install dependencies (uses pnpm workspace)
pnpm install

# Clean install (removes node_modules first)
pnpm clean:install
```

### Development:
```bash
# Start development server with hot reload
pnpm dev

# Start development for Firefox
pnpm dev:firefox

# Watch mode with concurrent processes
pnpm base-dev
```

### Building:
```bash
# Build for production (Chrome)
pnpm build

# Build for Firefox
pnpm build:firefox

# Create distributable zip
pnpm zip

# Create Firefox zip
pnpm zip:firefox

# Base build without environment setup
pnpm base-build
```

### Code Quality:
```bash
# Run linting with auto-fix
pnpm lint

# Fix linting issues
pnpm lint:fix

# Format code with Prettier
pnpm prettier

# Type checking
pnpm type-check

# Build ESLint configuration
pnpm build:eslint
```

### Cleaning:
```bash
# Clean all build artifacts and dependencies
pnpm clean

# Clean only build/dist folders
pnpm clean:bundle

# Clean only node_modules
pnpm clean:node_modules

# Clean turbo cache
pnpm clean:turbo
```

### Testing:
```bash
# Run end-to-end tests
pnpm e2e

# Run e2e tests for Firefox
pnpm e2e:firefox
```

### Utilities:
```bash
# Update version across packages
pnpm update-version

# Copy environment files
pnpm copy_env

# Set global environment variables
pnpm set-global-env

# Run module manager
pnpm module-manager
```

### Environment Variables:
```bash
# Set development mode
pnpm set-global-env CLI_CEB_DEV=true

# Set Firefox mode
pnpm set-global-env CLI_CEB_FIREFOX=true

# Combine multiple settings
pnpm set-global-env CLI_CEB_DEV=true CLI_CEB_FIREFOX=true
```

## Turbo Commands:
Turbo handles the monorepo build orchestration. Most commands delegate to turbo internally, but you can run turbo directly:

```bash
# Run specific task across all packages
turbo <task-name>

# Run with specific concurrency
turbo watch dev --concurrency 20

# Build all packages
turbo build

# Clean all packages
turbo clean
```

## Package Manager Notes:
- **Primary**: Always use `pnpm` (not npm or yarn)
- **Workspace**: Uses pnpm workspaces for monorepo management
- **Lock File**: Uses `pnpm-lock.yaml`
- **Node Version**: Requires Node.js 22.12.0+