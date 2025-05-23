# Task Completion Workflow

## When a task is completed, run these commands in order:

### 1. Code Quality Checks:
```bash
# Format code with Prettier
pnpm prettier

# Fix linting issues
pnpm lint:fix

# Run type checking
pnpm type-check
```

### 2. Build Verification:
```bash
# Build the project to ensure no build errors
pnpm build

# For Firefox compatibility (if needed)
pnpm build:firefox
```

### 3. Testing (if applicable):
```bash
# Run end-to-end tests if modified core functionality
pnpm e2e
```

### 4. Package Creation (for releases):
```bash
# Create distributable zip for Chrome Web Store
pnpm zip

# Create Firefox version if needed
pnpm zip:firefox
```

## Pre-commit Hooks:
The project uses Husky and lint-staged, so commits will automatically:
- Run Prettier on staged files
- Format *.{js,jsx,ts,tsx,json} files

## Environment Variables:
After changes to environment configuration:
```bash
# Copy environment files
pnpm copy_env

# Set global environment if needed
pnpm set-global-env
```

## Version Updates:
For version changes:
```bash
# Update version across all packages
pnpm update-version
```

## Cleaning (if build issues):
```bash
# Clean and reinstall if package issues
pnpm clean:install

# Or clean specific parts
pnpm clean:bundle    # Clean build artifacts
pnpm clean:turbo     # Clean turbo cache
```

## Quality Gates:
- **Prettier**: Code must be formatted
- **ESLint**: No linting errors
- **TypeScript**: No type errors
- **Build**: Must build successfully
- **Tests**: E2E tests must pass (when applicable)

## Notes:
- Always run `pnpm prettier` and `pnpm lint:fix` before committing
- The build process validates the entire codebase
- Use `pnpm dev` for development with hot reload
- Create zip packages only for distribution/testing
- Environment variables are managed through bash scripts, not manually