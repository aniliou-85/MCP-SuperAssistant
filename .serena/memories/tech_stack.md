# Tech Stack

## Core Technologies:
- **Node.js**: v22.12.0+ (specified in package.json engines)
- **TypeScript**: 5.8.1-rc - Main programming language
- **React**: 19.1.0 - UI framework
- **React DOM**: 19.0.0 - DOM renderer
- **Vite**: 6.1.0 - Build tool and dev server

## Package Management:
- **pnpm**: 9.15.1 - Package manager (specified in packageManager field)
- **Turbo**: 2.4.2 - Monorepo build system

## Browser Extension:
- **Chrome Extension APIs**: @types/chrome 0.0.304
- **WebExtension Polyfill**: 0.12.0 - Cross-browser compatibility
- **MCP SDK**: @modelcontextprotocol/sdk ^1.11.2 - Model Context Protocol integration

## Styling:
- **Tailwind CSS**: 3.4.17 - Utility-first CSS framework
- **PostCSS**: 8.5.2 - CSS processing
- **Autoprefixer**: 10.4.20 - CSS vendor prefixing

## Development Tools:
- **ESLint**: 9.20.1 - Linting with TypeScript support
- **Prettier**: 3.3.3 - Code formatting
- **Husky**: 9.1.4 - Git hooks
- **lint-staged**: 15.2.7 - Pre-commit linting

## Build & Development:
- **esbuild**: 0.25.0 - Fast bundler
- **Rimraf**: 6.0.1 - Cross-platform rm -rf
- **cross-env**: 7.0.3 - Cross-platform environment variables
- **fast-glob**: 3.3.3 - Fast file globbing

## Monorepo Structure:
- Organized with packages for shared utilities (dev-utils, env, hmr, i18n, storage, etc.)
- Chrome extension as main application
- Pages for additional web components
- Bash scripts for automation