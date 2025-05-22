# Code Style and Conventions

## Prettier Configuration (.prettierrc):
- **Trailing Commas**: Always (`"trailingComma": "all"`)
- **Semicolons**: Always (`"semi": true`)
- **Quotes**: Single quotes (`"singleQuote": true`)
- **Arrow Function Parentheses**: Avoid when possible (`"arrowParens": "avoid"`)
- **Print Width**: 120 characters (`"printWidth": 120`)
- **Bracket Same Line**: true (`"bracketSameLine": true`)
- **HTML Whitespace Sensitivity**: strict (`"htmlWhitespaceSensitivity": "strict"`)

## ESLint Configuration:
- **Base Configs**: ESLint recommended, TypeScript recommended
- **React**: Uses React plugin with JSX runtime support
- **Accessibility**: jsx-a11y recommended rules
- **Import**: eslint-plugin-import-x for import/export linting
- **React Hooks**: react-hooks/recommended rules
- **Prettier Integration**: eslint-plugin-prettier for formatting

## TypeScript:
- **Version**: 5.8.1-rc
- **Target**: ES2020+ with latest ECMAScript features
- **Module**: ESM (ES Modules)
- **JSX**: Supported for React components
- **Strict Mode**: Enabled (standard TypeScript recommended config)

## File Organization:
- **Monorepo Structure**: Packages in `/packages/`, chrome extension in `/chrome-extension/`
- **Workspace References**: Uses `workspace:*` for internal package dependencies
- **Type Definitions**: Separate `.d.ts` files where needed
- **Configuration Files**: Centralized at root level

## Naming Conventions:
- **Files**: kebab-case for most files
- **Components**: PascalCase for React components
- **Variables/Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE for environment variables and constants
- **Types/Interfaces**: PascalCase

## Environment Variables:
- **CLI Prefix**: `CLI_CEB_*` for CLI-controlled values
- **Editable Prefix**: `CEB_*` for user-editable values
- **Boolean Validation**: Strict true/false validation for boolean env vars

## Import/Export:
- **ES Modules**: All code uses ESM syntax
- **Type Imports**: Use `import type` for type-only imports
- **Default Exports**: Preferred for React components
- **Named Exports**: Used for utilities and multiple exports