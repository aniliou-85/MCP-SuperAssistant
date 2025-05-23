# Design Patterns and Guidelines

## Architecture Patterns:

### Monorepo Organization:
- **Shared Libraries**: Common functionality extracted to `@extension/*` packages
- **Workspace Dependencies**: Internal packages use `workspace:*` references
- **Build Orchestration**: Turbo manages dependencies and build order
- **Configuration Sharing**: Centralized configs (ESLint, Prettier, TypeScript) with package-specific overrides

### Chrome Extension Architecture:
- **Manifest v3**: Modern Chrome extension format
- **Content Scripts**: Inject into AI platform pages
- **Background Scripts**: Handle extension lifecycle
- **Popup/Options**: Extension UI components
- **Storage**: Persistent settings and preferences

### React Patterns:
- **Functional Components**: All components use hooks (React 19)
- **JSX Runtime**: Automatic JSX transform (no React imports needed)
- **Component Composition**: Reusable UI components in `@extension/ui`
- **State Management**: Local state with hooks, storage for persistence

## Development Guidelines:

### Environment Management:
- **Strict Validation**: Boolean environment variables must be exactly "true" or "false"
- **Prefixed Variables**: CLI variables start with `CLI_CEB_`, editable with `CEB_`
- **Automated Management**: Use bash scripts, not manual .env editing

### Code Organization:
- **Feature-based**: Group related functionality together
- **Package Boundaries**: Clear separation of concerns across packages
- **Type Safety**: Comprehensive TypeScript usage
- **Import Organization**: Type imports separate from value imports

### Build Strategy:
- **Multi-target**: Support both Chrome and Firefox
- **Development Mode**: Hot reload with Vite
- **Production Optimization**: Minified, tree-shaken builds
- **Asset Management**: Public assets handled by Vite plugins

## Chrome Extension Specific:

### MCP Integration:
- **Protocol Handling**: Uses @modelcontextprotocol/sdk for communication
- **Proxy Server**: Local server for MCP tool execution
- **SSE Communication**: Server-sent events for real-time updates
- **Cross-origin**: Proper CORS handling for AI platforms

### Platform Integration:
- **Content Script Injection**: Detect and integrate with AI chat interfaces
- **DOM Manipulation**: Sidebar injection without breaking platform UI
- **Event Handling**: Monitor for tool calls in AI responses
- **Theme Adaptation**: Support for light/dark modes

### User Experience:
- **Non-intrusive**: Sidebar design that doesn't interfere with platforms
- **Persistent Settings**: Remember user preferences across sessions
- **Auto-execution**: Optional automatic tool execution
- **Result Integration**: Seamless insertion of tool results

## Quality Standards:

### Code Quality:
- **Zero ESLint Errors**: Must pass all linting rules
- **Type Safety**: No TypeScript errors
- **Formatting**: Consistent Prettier formatting
- **Import Order**: Organized imports with proper grouping

### Performance:
- **Bundle Size**: Minimize extension size for faster loading
- **Memory Usage**: Efficient DOM manipulation and event handling
- **Hot Reload**: Fast development iteration
- **Build Speed**: Optimized with Turbo and Vite

### Browser Compatibility:
- **WebExtension Polyfill**: Cross-browser compatibility layer
- **Modern APIs**: Use latest Chrome extension APIs with fallbacks
- **Platform Testing**: Test across supported AI platforms

## Security Considerations:
- **Content Security Policy**: Proper CSP for extension security
- **Origin Validation**: Verify requests from legitimate AI platforms
- **Data Handling**: Secure storage and transmission of user data
- **Permission Management**: Minimal required permissions