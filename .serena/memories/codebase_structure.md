# Codebase Structure

## Root Level:
- **chrome-extension/**: Main Chrome extension application
- **packages/**: Shared utilities and configurations
- **pages/**: Additional web components/pages
- **bash-scripts/**: Shell scripts for automation
- **tests/**: Test files (referenced in workspace but minimal testing setup)

## Configuration Files:
- **package.json**: Root package configuration with scripts
- **turbo.json**: Turbo monorepo build configuration
- **pnpm-workspace.yaml**: pnpm workspace definition
- **tsconfig.json**: Root TypeScript configuration
- **eslint.config.ts**: ESLint configuration
- **.prettierrc**: Prettier formatting rules
- **.env**: Environment variables (managed by bash scripts)

## Chrome Extension Structure:
- **chrome-extension/src/**: Source code for extension
- **chrome-extension/public/**: Static assets and icons
- **chrome-extension/utils/**: Extension-specific utilities
- **chrome-extension/manifest.ts**: Extension manifest configuration
- **chrome-extension/vite.config.mts**: Vite build configuration

## Packages (Shared Libraries):
- **@extension/dev-utils**: Development utilities
- **@extension/env**: Environment variable management
- **@extension/hmr**: Hot module replacement utilities
- **@extension/i18n**: Internationalization support
- **@extension/module-manager**: Module management tools
- **@extension/shared**: Shared utilities and constants
- **@extension/storage**: Extension storage management
- **@extension/tailwind-config**: Tailwind CSS configuration
- **@extension/tsconfig**: TypeScript configuration presets
- **@extension/ui**: Shared UI components
- **@extension/vite-config**: Vite configuration utilities
- **@extension/zipper**: Build packaging utilities

## Key Dependencies:
- **React 19.1.0**: UI framework
- **@modelcontextprotocol/sdk**: MCP integration
- **webextension-polyfill**: Cross-browser compatibility
- **vite-plugin-node-polyfills**: Node.js polyfills for browser

## Build System:
- **Turbo**: Orchestrates builds across packages
- **Vite**: Main bundler for development and production
- **TypeScript**: Compilation and type checking
- **pnpm**: Package management with workspaces

## Asset Management:
- **Public assets**: Located in chrome-extension/public/
- **Icons**: Extension icons and branding assets
- **Manifest**: Dynamic manifest generation via TypeScript

## Development Workflow:
1. **Ready**: Prepare packages (compile TypeScript configs)
2. **Dev**: Watch mode with hot reload
3. **Build**: Production build with optimization
4. **Package**: Create distributable zip files

## Environment Management:
- **CLI_CEB_***: CLI-controlled environment variables
- **CEB_***: User-editable environment variables
- **Global environment**: Managed via bash scripts