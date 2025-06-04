import {
  callToolWithSSE,
  getPrimitivesWithSSE,
  isMcpServerConnected,
  forceReconnectToMcpServer,
  checkMcpServerConnection,
} from './officialmcpclient';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

// Define the Primitive type locally since it's not exported from officialmcpclient
type PrimitiveType = 'resource' | 'tool' | 'prompt';
type PrimitiveValue = {
  name: string;
  description?: string;
  uri?: string;
  inputSchema?: any;
  arguments?: any[];
};
type Primitive = {
  type: PrimitiveType;
  value: PrimitiveValue;
};

/**
 * Class that manages communication between background script and content scripts
 * for MCP tool calling functionality.
 */
class McpInterface {
  private static instance: McpInterface | null = null;
  private connections: Map<string, chrome.runtime.Port> = new Map();
  private serverUrl: string = 'http://localhost:3006/sse'; // Default fallback, will be loaded from storage
  private isConnected: boolean = false;
  private connectionLastActiveTimestamps: Map<string, number> = new Map();
  private connectionActivityCheckInterval: NodeJS.Timeout | null = null;
  private connectionActivityCheckTime: number = 15000; // 15 seconds
  private connectionTimeoutThreshold: number = 30000; // 30 seconds of inactivity before considered stale
  private isInitialized: boolean = false;

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor() {
    this.setupConnectionListener();
    this.initializeServerUrl().then(() => {
      this.isConnected = false; // Assume disconnected initially
      this.broadcastConnectionStatus(); // Inform UIs about initial disconnected state
      this.startConnectionActivityCheck(); // Keep activity check for port management
      this.isInitialized = true;
      console.log('[MCP Interface] Initialized with server URL:', this.serverUrl, 'and initial status: disconnected.');
    });
  }

  /**
   * Initialize server URL from storage
   */
  private async initializeServerUrl(): Promise<void> {
    try {
      const result = await chrome.storage.local.get('mcpServerUrl');
      if (result.mcpServerUrl) {
        this.serverUrl = result.mcpServerUrl;
        console.log(`[MCP Interface] Loaded server URL from storage: ${this.serverUrl}`);
      } else {
        console.log(`[MCP Interface] No stored server URL found, using default: ${this.serverUrl}`);
      }
    } catch (error) {
      console.error('[MCP Interface] Error loading server URL from storage:', error);
      console.log(`[MCP Interface] Using default server URL: ${this.serverUrl}`);
    }
  }

  /**
   * Get the singleton instance of McpInterface
   */
  public static getInstance(): McpInterface {
    if (!McpInterface.instance) {
      McpInterface.instance = new McpInterface();
    }
    return McpInterface.instance;
  }

  /**
   * Wait for the interface to be fully initialized (server URL loaded from storage)
   */
  public async waitForInitialization(): Promise<void> {
    if (this.isInitialized) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (this.isInitialized) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Get the current server URL
   */
  public getServerUrl(): string {
    return this.serverUrl;
  }

  /**
   * Start periodic connection activity check to detect and clean up stale connections
   */
  private startConnectionActivityCheck(): void {
    if (this.connectionActivityCheckInterval !== null) {
      clearInterval(this.connectionActivityCheckInterval);
    }
    this.connectionActivityCheckInterval = setInterval(() => {
      const now = Date.now();
      let staleConnections = 0;
      this.connections.forEach((port, connectionId) => {
        const lastActivity = this.connectionLastActiveTimestamps.get(connectionId) || 0;
        const inactiveTime = now - lastActivity;
        if (inactiveTime > this.connectionTimeoutThreshold) {
          console.log(
            `[MCP Interface] Connection ${connectionId} is stale (inactive for ${inactiveTime}ms), cleaning up`,
          );
          try {
            port.postMessage({ type: 'CONNECTION_STATUS', isConnected: false, reason: 'TIMEOUT' });
            port.disconnect();
          } catch (error) { /* Ignore */ }
          this.connections.delete(connectionId);
          this.connectionLastActiveTimestamps.delete(connectionId);
          staleConnections++;
        }
      });
      if (staleConnections > 0) {
        console.log(`[MCP Interface] Cleaned up ${staleConnections} stale connections`);
      }
    }, this.connectionActivityCheckTime);
  }

  /**
   * Check if the server is connected. This is a utility for internal use if a direct check is needed.
   * It's not part of the primary automatic connection status management anymore.
   * @returns Promise that resolves to true if connected, false otherwise
   */
  private async checkServerConnection(): Promise<boolean> {
    try {
      // This function (checkMcpServerConnection) is assumed to be a lightweight check,
      // possibly a HEAD request or using PersistentMcpClient's status if available.
      return await checkMcpServerConnection();
    } catch (error) {
      console.error('[MCP Interface] Error checking server connection:', error);
      return false;
    }
  }

  /**
   * Enhanced tool verification that checks if a tool exists without causing disconnection
   */
  private async enhancedToolVerification(
    toolName: string,
  ): Promise<{ exists: boolean; reason?: string; cached: boolean }> {
    try {
      const now = Date.now();
      const VERIFICATION_CACHE_TTL = 60000;
      const hasFreshCache =
        this.toolDetailsCache.primitives.length > 0 && now - this.toolDetailsCache.lastFetch < VERIFICATION_CACHE_TTL;
      if (hasFreshCache) {
        const toolExists = this.toolDetailsCache.primitives.some(
          primitive => primitive.type === 'tool' && primitive.value.name === toolName,
        );
        return {
          exists: toolExists,
          reason: toolExists ? 'Found in cache' : `Tool '${toolName}' not found in cached primitives`,
          cached: true,
        };
      }
      console.log(`[MCP Interface] Performing lightweight verification for tool '${toolName}'`);
      const primitives = await getPrimitivesWithSSE(this.serverUrl, false); // Assumes getPrimitivesWithSSE can be called even if primary connection is 'logically' down for UI
      const toolExists = primitives.some(primitive => primitive.type === 'tool' && primitive.value.name === toolName);
      if (toolExists) {
        return { exists: true, reason: 'Verified with server', cached: false };
      } else {
        const availableTools = primitives.filter(p => p.type === 'tool').map(p => p.value.name).slice(0, 5);
        const toolList = availableTools.length > 0
            ? ` Available tools include: ${availableTools.join(', ')}${primitives.filter(p => p.type === 'tool').length > 5 ? '...' : ''}`
            : ' No tools are currently available from the server.';
        return { exists: false, reason: `Tool '${toolName}' not found on server.${toolList}`, cached: false };
      }
    } catch (error) {
      console.warn(`[MCP Interface] Enhanced verification failed for '${toolName}':`, error);
      return { exists: true, reason: 'Verification failed, proceeding optimistically', cached: false };
    }
  }

  /**
   * Handle messages from content scripts
   */
  private handleMessage(connectionId: string, message: any): void {
    console.log(`[MCP Interface] Received message from ${connectionId}:`, message.type);
    this.connectionLastActiveTimestamps.set(connectionId, Date.now());
    switch (message.type) {
      case 'HEARTBEAT':
        this.sendHeartbeatResponse(connectionId, message.timestamp);
        break;
      case 'CALL_TOOL':
        this.handleToolCall(connectionId, message);
        break;
      case 'CHECK_CONNECTION': // This message type allows content script to explicitly request a status update
        this.sendConnectionStatus(connectionId, message.forceCheck === true);
        break;
      case 'GET_TOOL_DETAILS':
        this.handleGetToolDetails(connectionId, message);
        break;
      case 'FORCE_RECONNECT':
        this.handleForceReconnect(connectionId, message);
        break;
      case 'GET_SERVER_CONFIG':
        this.handleGetServerConfig(connectionId, message);
        break;
      case 'UPDATE_SERVER_CONFIG':
        this.handleUpdateServerConfig(connectionId, message);
        break;
      default:
        console.warn(`[MCP Interface] Unknown message type: ${message.type}`);
        this.sendError(connectionId, 'UNKNOWN_MESSAGE', `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Send heartbeat response back to the content script
   */
  private sendHeartbeatResponse(connectionId: string, timestamp: number): void {
    const port = this.connections.get(connectionId);
    if (port) {
      try {
        port.postMessage({ type: 'HEARTBEAT_RESPONSE', timestamp, serverTimestamp: Date.now() });
      } catch (error) {
        console.error(`[MCP Interface] Error sending heartbeat response to ${connectionId}:`, error);
        this.connections.delete(connectionId);
        this.connectionLastActiveTimestamps.delete(connectionId);
      }
    }
  }

  /**
   * Handle tool call requests from content scripts with enhanced verification
   */
  private async handleToolCall(connectionId: string, message: any): Promise<void> {
    const { requestId, toolName, args } = message;
    const port = this.connections.get(connectionId);
    if (!port) return;
    if (!requestId || !toolName) {
      this.sendError(connectionId, 'INVALID_REQUEST', 'Invalid tool call request');
      return;
    }
    try {
      // Ensure MCPInterface believes we are connected (or can connect) before trying tool specific verification
      if (!this.isConnected && !(await this.checkServerConnection())) { // Quick check if not connected
          this.sendError(connectionId, 'SERVER_UNAVAILABLE', 'MCP server is not connected. Please connect first.', requestId);
          return;
      }
      const verification = await this.enhancedToolVerification(toolName);
      if (!verification.exists) {
        this.sendError(connectionId, 'TOOL_NOT_FOUND', verification.reason || `Tool '${toolName}' is not available on the MCP server`, requestId);
        return;
      }
      let sanitizedArgs: { [key: string]: unknown } = {};
      if (args && typeof args === 'object' && !Array.isArray(args)) {
        try {
          sanitizedArgs = JSON.parse(JSON.stringify(args));
        } catch (sanitizeError) {
          this.sendError(connectionId, 'INVALID_ARGS', `Invalid arguments: ${sanitizeError instanceof Error ? sanitizeError.message : String(sanitizeError)}`, requestId);
          return;
        }
      } else if (args !== null && args !== undefined) {
        this.sendError(connectionId, 'INVALID_ARGS', `Invalid arguments type: expected object, got ${typeof args}`, requestId);
        return;
      }
      const result = await callToolWithSSE(this.serverUrl, toolName, sanitizedArgs);
      port.postMessage({ type: 'TOOL_CALL_RESULT', requestId, result });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCategory = this.categorizeError(error as Error);
      if (errorCategory.isConnectionError && !errorCategory.isToolError) {
        this.isConnected = false; // Update main connection status on actual connection errors
        this.broadcastConnectionStatus();
      }
      const errorType = errorCategory.isToolError ? 'TOOL_CALL_ERROR' : errorCategory.isConnectionError ? 'CONNECTION_ERROR' : 'UNKNOWN_ERROR';
      this.sendError(connectionId, errorType, errorMessage, requestId);
    }
  }

  /**
   * Verify if a tool exists before calling it with enhanced caching
   */
  private async verifyToolExists(toolName: string): Promise<{ exists: boolean; reason?: string }> {
    try {
      // This relies on getAvailableToolsFromServer which itself uses getPrimitivesWithSSE
      // This path should be used carefully if the primary connection is meant to be "off"
      if (!this.isConnected && !(await this.checkServerConnection())) {
          return { exists: false, reason: "Cannot verify tool, server disconnected." };
      }
      const primitives = await this.getAvailableToolsFromServer(false);
      const toolExists = primitives.some(primitive => primitive.type === 'tool' && primitive.value.name === toolName);
      if (toolExists) {
        return { exists: true };
      } else {
        const availableTools = primitives.filter(p => p.type === 'tool').map(p => p.value.name).slice(0, 10);
        return {
          exists: false,
          reason: `Tool '${toolName}' is not available. ${availableTools.length > 0 ? `Available tools include: ${availableTools.join(', ')}${primitives.filter(p => p.type === 'tool').length > 10 ? '...' : ''}` : 'No tools are currently available.'}`,
        };
      }
    } catch (error) {
      return { exists: true, reason: 'Verification failed, proceeding optimistically' };
    }
  }

  /**
   * Enhanced error categorization to prevent unnecessary disconnections
   */
  private categorizeError(error: Error): { isConnectionError: boolean; isToolError: boolean; category: string } {
    const errorMessage = error.message.toLowerCase();
    const toolErrorPatterns = [ /tool .* not found/i, /tool not found/i, /method not found/i, /invalid arguments/i, /invalid parameters/i, /mcp error -32602/i, /mcp error -32601/i, /mcp error -32600/i, /filesystem\\\\.read_file not found/i, /tool '[^']+' is not available/i, /mcp error.*tool.*not found/i ];
    const connectionErrorPatterns = [ /connection refused/i, /econnrefused/i, /timeout/i, /etimedout/i, /enotfound/i, /network error/i, /server unavailable/i, /server not available/i, /could not connect/i, /connection failed/i, /transport error/i, /socket error/i, /fetch failed/i, /cors error/i, /http 500/i, /http 502/i, /http 503/i ];
    const serverAvailabilityErrorPatterns = [ /http 404.*considering available/i, /http 403.*considering available/i, /method not allowed.*considering available/i ];
    if (toolErrorPatterns.some(pattern => pattern.test(errorMessage))) return { isConnectionError: false, isToolError: true, category: 'tool_error' };
    if (serverAvailabilityErrorPatterns.some(pattern => pattern.test(errorMessage))) return { isConnectionError: true, isToolError: false, category: 'server_availability_error' };
    if (connectionErrorPatterns.some(pattern => pattern.test(errorMessage))) return { isConnectionError: true, isToolError: false, category: 'connection_error' };
    return { isConnectionError: false, isToolError: false, category: 'unknown_error' };
  }

  private toolDetailsCache: {
    primitives: Primitive[];
    lastFetch: number;
    fetchPromise: Promise<Primitive[]> | null;
    inProgress: boolean;
  } = { primitives: [], lastFetch: 0, fetchPromise: null, inProgress: false };

  /**
   * Handle get tool details requests from content scripts with caching
   */
  private async handleGetToolDetails(connectionId: string, message: any): Promise<void> {
    const { requestId, forceRefresh } = message;
    const port = this.connections.get(connectionId);
    if (!port) return;
    if (!requestId) {
      this.sendError(connectionId, 'INVALID_REQUEST', 'Invalid tool details request');
      return;
    }
    try {
      // Before fetching tools, ensure the server is considered connectable by McpInterface
      // This uses checkServerConnection which might do a live check if McpInterface thinks it's disconnected.
      if (!this.isConnected && !(await this.checkServerConnection())) {
        this.sendError(connectionId, 'SERVER_UNAVAILABLE', 'MCP server is not available. Please check your connection settings.', requestId);
        return;
      }
      const now = Date.now();
      const CACHE_TTL = 20000;
      if (!forceRefresh && this.toolDetailsCache.primitives.length > 0 && now - this.toolDetailsCache.lastFetch < CACHE_TTL) {
        const tools = this.toolDetailsCache.primitives.filter(p => p.type === 'tool');
        port.postMessage({ type: 'TOOL_DETAILS_RESULT', result: tools, requestId });
        return;
      }
      if (this.toolDetailsCache.inProgress && this.toolDetailsCache.fetchPromise) {
        try {
          const primitives = await this.toolDetailsCache.fetchPromise;
          const tools = primitives.filter(p => p.type === 'tool');
          port.postMessage({ type: 'TOOL_DETAILS_RESULT', result: tools, requestId });
          return;
        } catch (error) { /* Continue to new request */ }
      }
      this.toolDetailsCache.inProgress = true;
      this.toolDetailsCache.fetchPromise = this.getAvailableToolsFromServer(!!forceRefresh);
      const primitives = await this.toolDetailsCache.fetchPromise;
      this.toolDetailsCache.primitives = primitives;
      this.toolDetailsCache.lastFetch = Date.now();
      const tools = primitives.filter(p => p.type === 'tool');
      port.postMessage({ type: 'TOOL_DETAILS_RESULT', result: tools, requestId });
      // If fetching tools succeeded, we can assume the connection is working.
      if (!this.isConnected) {
          this.isConnected = true;
          this.broadcastConnectionStatus();
      }
    } catch (error) {
      // If getAvailableToolsFromServer itself throws a connection error, it might have already set isConnected to false.
      // We ensure the status is consistent.
      const currentActualStatus = await this.checkServerConnection();
      if (this.isConnected !== currentActualStatus) {
        this.isConnected = currentActualStatus;
        this.broadcastConnectionStatus();
      }
      this.sendError(connectionId, 'TOOL_DETAILS_ERROR', error instanceof Error ? error.message : String(error), requestId);
    } finally {
      this.toolDetailsCache.inProgress = false;
      this.toolDetailsCache.fetchPromise = null;
    }
  }

  /**
   * Handle force reconnect requests from content scripts
   */
  private async handleForceReconnect(connectionId: string, message: any): Promise<void> {
    const { requestId } = message;
    const port = this.connections.get(connectionId);
    if (!port) return;
    port.postMessage({ type: 'RECONNECT_STATUS', status: 'PROCESSING', requestId });
    try {
      // forceReconnectToMcpServer handles PersistentMcpClient's connect logic
      await forceReconnectToMcpServer(this.serverUrl); 
      // After attempting, update McpInterface's state based on PersistentMcpClient
      this.isConnected = PersistentMcpClient.getInstance().getConnectionStatus(); 

      if (this.isConnected) {
        try {
          const freshTools = await this.getAvailableToolsFromServer(true); // Force refresh tools on new connection
          this.broadcastToolsUpdate(freshTools);
        } catch (toolsError) { 
            console.error("[MCP Interface] Error fetching tools after reconnection:", toolsError);
            // Proceed even if tool fetching fails, connection itself might be okay
        }
      }
      port.postMessage({ type: 'RECONNECT_RESULT', success: true, isConnected: this.isConnected, requestId });
      this.broadcastConnectionStatus(); // Broadcast the definitive new status
    } catch (reconnectError) {
      // Reconnect failed, ensure our state reflects this
      this.isConnected = false; 
      this.broadcastConnectionStatus();

      if (reconnectError instanceof Error && reconnectError.message.includes('Connection permanently failed')) {
        this.sendError(connectionId, 'PERMANENT_CONNECTION_FAILURE', `Connection failed permanently. ${reconnectError.message}`, requestId);
        return;
      }
      let userFriendlyMessage = reconnectError instanceof Error ? reconnectError.message : String(reconnectError);
      // (User friendly message mapping remains the same)
      if (reconnectError instanceof Error) {
        if (reconnectError.message.includes('404') || reconnectError.message.includes('not found')) userFriendlyMessage = 'Server URL not found (404).';
        else if (reconnectError.message.includes('403')) userFriendlyMessage = 'Access forbidden (403).';
        else if (reconnectError.message.includes('500') || reconnectError.message.includes('502') || reconnectError.message.includes('503')) userFriendlyMessage = 'Server error detected.';
        else if (reconnectError.message.includes('Connection refused') || reconnectError.message.includes('ECONNREFUSED')) userFriendlyMessage = 'Connection refused.';
        else if (reconnectError.message.includes('timeout')) userFriendlyMessage = 'Connection timeout.';
        else if (reconnectError.message.includes('ENOTFOUND')) userFriendlyMessage = 'Server not found.';
        else if (reconnectError.message.includes('Could not connect to server')) userFriendlyMessage = 'Unable to connect to the MCP server.';
      }
      this.sendError(connectionId, 'SERVER_CONNECTION_ERROR', userFriendlyMessage, requestId);
    }
  }

  /**
   * Get available tools from the MCP server
   */
  private async getAvailableToolsFromServer(forceRefresh: boolean = false): Promise<Primitive[]> {
    try {
      // This uses PersistentMcpClient.getPrimitives() which has its own ensureConnection logic
      const primitives = await PersistentMcpClient.getInstance().getPrimitives(); // Simplified to use the main client's method
      return primitives;
    } catch (error) {
      console.error('[MCP Interface] Failed to get available primitives:', error);
      // If PersistentMcpClient.getPrimitives() fails due to connection, it will throw.
      // We update our status based on that client's status.
      this.isConnected = PersistentMcpClient.getInstance().getConnectionStatus();
      this.broadcastConnectionStatus();
      // Re-throw the original error to be handled by the caller (e.g., handleGetToolDetails)
      throw error;
    }
  }

  /**
   * Send connection status to a specific content script
   * @param connectionId The ID of the connection to send the status to
   * @param forceCheck Whether to force a thorough check of the connection.
   *                   If true, it uses checkServerConnection. If false, uses cached McpInterface.isConnected.
   */
  private async sendConnectionStatus(connectionId: string, forceCheck: boolean = false): Promise<void> {
    const port = this.connections.get(connectionId);
    if (port) {
      let statusToSend = this.isConnected;
      if (forceCheck) {
        // If a force check is requested, we perform it and update our state.
        const liveStatus = await this.checkServerConnection();
        if (this.isConnected !== liveStatus) {
          this.isConnected = liveStatus;
          this.broadcastConnectionStatus(); // Broadcast if state changed due to forced check
          return; // broadcast will send to all, including this one.
        }
        statusToSend = liveStatus; // Use the freshly checked status
      }
      // If no forceCheck, or if forceCheck didn't change status, send current statusToSend
      try {
        port.postMessage({ type: 'CONNECTION_STATUS', isConnected: statusToSend, message: statusToSend ? 'Connected to MCP server' : 'MCP server unavailable - extension running with limited capabilities' });
      } catch (error) {
        console.error(`[MCP Interface] Error sending connection status to ${connectionId}:`, error);
        this.connections.delete(connectionId);
        this.connectionLastActiveTimestamps.delete(connectionId);
      }
    }
  }

  /**
   * Send error message to a specific content script
   */
  private sendError(connectionId: string, errorType: string, errorMessage: string, requestId?: string): void {
    const port = this.connections.get(connectionId);
    if (port) {
      port.postMessage({ type: 'ERROR', errorType, errorMessage, requestId });
    }
  }

  /**
   * Update the MCP server connection status. Called by PersistentMcpClient events or direct actions.
   */
  public updateConnectionStatus(isConnected: boolean): void {
    if (this.isConnected !== isConnected) {
      this.isConnected = isConnected;
      this.broadcastConnectionStatus();
    }
  }

  /**
   * Update the MCP server URL
   */
  public updateServerUrl(url: string): void {
    this.serverUrl = url;
    // Note: Changing URL doesn't automatically reconnect. A subsequent forceReconnect is needed.
  }

  /**
   * Get the number of active connections
   */
  public getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.connectionActivityCheckInterval !== null) {
      clearInterval(this.connectionActivityCheckInterval);
      this.connectionActivityCheckInterval = null;
    }
    this.connections.forEach((port) => {
      try { port.disconnect(); } catch (error) { /* Ignore */ }
    });
    this.connections.clear();
    this.connectionLastActiveTimestamps.clear();
  }

  /**
   * Handle get server config requests from content scripts
   */
  private async handleGetServerConfig(connectionId: string, message: any): Promise<void> {
    const { requestId } = message;
    const port = this.connections.get(connectionId);
    if (!port) return;
    try {
      let currentServerUrl = this.serverUrl; // Start with in-memory
      try { // Attempt to get latest from storage
        const result = await chrome.storage.local.get('mcpServerUrl');
        if (result.mcpServerUrl) {
          currentServerUrl = result.mcpServerUrl;
          if (this.serverUrl !== currentServerUrl) { // Keep in-memory updated if changed
             this.serverUrl = currentServerUrl;
          }
        }
      } catch (storageError) { console.error(`[MCP Interface] Error reading server URL from storage:`, storageError); }
      port.postMessage({ type: 'SERVER_CONFIG_RESULT', config: { uri: currentServerUrl }, requestId });
    } catch (error) {
      this.sendError(connectionId, 'SERVER_CONFIG_ERROR', `Failed to get server config: ${error instanceof Error ? error.message : String(error)}`, requestId);
    }
  }

  /**
   * Handle update server config requests from content scripts
   */
  private async handleUpdateServerConfig(connectionId: string, message: any): Promise<void> {
    const { requestId, config } = message;
    const port = this.connections.get(connectionId);
    if (!port) return;
    if (!config || !config.uri) {
      this.sendError(connectionId, 'INVALID_REQUEST', 'Invalid server config update request', requestId);
      return;
    }
    try {
      new URL(config.uri); // Validate URI
      this.updateServerUrl(config.uri); // Update in-memory URL
      try {
        await chrome.storage.local.set({ mcpServerUrl: config.uri }); // Save to storage
      } catch (storageError) { console.error(`[MCP Interface] Error saving server URL to storage:`, storageError); }
      
      // After updating URL, a reconnect is implied/expected to use the new URL.
      // We will trigger it here.
      console.log(`[MCP Interface] Server URL updated to ${config.uri}. Initiating reconnect.`);
      // We call handleForceReconnect directly to reuse its logic, passing a dummy requestId for its internal use if needed.
      // The original requestId from the content script is for the UPDATE_SERVER_CONFIG_RESULT.
      await this.handleForceReconnect(connectionId, { requestId: `reconnect-after-update-${requestId}` });
      
      // The RECONNECT_RESULT and updated CONNECTION_STATUS will be sent by handleForceReconnect.
      // We still send a success for the config update itself.
      port.postMessage({ type: 'UPDATE_SERVER_CONFIG_RESULT', success: true, requestId });

    } catch (error) { // Catches errors from URI validation or if handleForceReconnect itself throws before sending its own error
      this.isConnected = false; // Ensure disconnected state on error
      this.broadcastConnectionStatus();
      this.sendError(connectionId, 'SERVER_CONFIG_UPDATE_ERROR', `Failed to update server config: ${error instanceof Error ? error.message : String(error)}`, requestId);
    }
  }

  /**
   * Broadcast tools update to all connected content scripts
   */
  private broadcastToolsUpdate(tools: Primitive[]): void {
    const toolPrimitives = tools.filter(p => p.type === 'tool');
    this.connections.forEach((port, connectionId) => {
      try {
        port.postMessage({ type: 'TOOL_DETAILS_RESULT', result: toolPrimitives, requestId: 'broadcast-tools-update' });
      } catch (error) { /* Ignore */ }
    });
  }

  /**
   * Set up listener for connections from content scripts
   */
  private setupConnectionListener(): void {
    chrome.runtime.onConnect.addListener(port => {
      if (port.name.startsWith('mcp-connection-')) {
        const connectionId = port.name;
        console.log(`[MCP Interface] New connection established: ${connectionId}`);
        this.connections.set(connectionId, port);
        this.connectionLastActiveTimestamps.set(connectionId, Date.now());
        port.onMessage.addListener(message => this.handleMessage(connectionId, message));
        port.onDisconnect.addListener(() => {
          console.log(`[MCP Interface] Connection disconnected: ${connectionId}`);
          this.connections.delete(connectionId);
          this.connectionLastActiveTimestamps.delete(connectionId);
        });
        // Send the current known connection status to the new port
        // without triggering a new network check.
        this.sendConnectionStatus(connectionId, false); // false for forceCheck
      }
    });
  }

  /**
   * Broadcast connection status to all connected content scripts
   */
  private broadcastConnectionStatus(): void {
    console.log(`[MCP Interface] Broadcasting connection status: ${this.isConnected} to ${this.connections.size} connections`);
    this.connections.forEach((port, connectionId) => {
      try {
        port.postMessage({ type: 'CONNECTION_STATUS', isConnected: this.isConnected, message: this.isConnected ? 'Connected to MCP server' : 'MCP server unavailable - extension running with limited capabilities' });
      } catch (error) { // Port might be dead if content script was unloaded
        console.warn(`[MCP Interface] Error sending connection status to ${connectionId}, removing port:`, error);
        this.connections.delete(connectionId);
        this.connectionLastActiveTimestamps.delete(connectionId);
      }
    });
  }
}




// Export the singleton instance
export const mcpInterface = McpInterface.getInstance();
