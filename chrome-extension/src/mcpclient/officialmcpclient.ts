import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport, SSEClientTransportOptions } from '@modelcontextprotocol/sdk/client/sse.js';
// import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'; // DISABLED: Using SSE only
import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js';
import { LoggingMessageNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

// Define types for primitives
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

// Define spinner type
interface Spinner {
  success: (message?: string) => void;
  error: (message: string) => void;
}

/**
 * Singleton class to manage a persistent connection to the MCP server
 */
class PersistentMcpClient {
  private static instance: PersistentMcpClient | null = null;
  private client: Client | null = null;
  private transport: Transport | null = null;
  private serverUrl: string = '';
  private isConnected: boolean = false;
  private connectionPromise: Promise<Client> | null = null;
  private lastConnectionCheck: number = 0;
  // Assuming Primitive type is available in this scope
  private primitives: Primitive[] | null = null; 
  private primitivesLastFetched: number = 0;
  private primitivesMaxAge: number = 300000; // 5 minutes
  private lastConnectionError: string | null = null;
  private consecutiveFailures: number = 0;
  private maxConsecutiveFailures: number = 3;

  private constructor() {
    console.log('[PersistentMcpClient] Initialized');
  }

  public static getInstance(): PersistentMcpClient {
    if (!PersistentMcpClient.instance) {
      PersistentMcpClient.instance = new PersistentMcpClient();
    }
    return PersistentMcpClient.instance;
  }

  public async connect(uri: string): Promise<Client> {
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      const errorMsg = `Connection permanently failed after ${this.maxConsecutiveFailures} consecutive attempts. Last error: ${this.lastConnectionError}`;
      console.error(`[PersistentMcpClient] ${errorMsg}`);
      throw new Error(errorMsg);
    }
    if (this.connectionPromise && this.serverUrl === uri && this.isConnected) {
      console.log('[PersistentMcpClient] Connection already established, returning existing client');
      return this.connectionPromise;
    }
    if (this.connectionPromise && this.serverUrl === uri) {
      console.log('[PersistentMcpClient] Connection already in progress, waiting for completion');
      try {
        return await this.connectionPromise;
      } catch (error) {
        console.warn('[PersistentMcpClient] Existing connection attempt failed, starting new one');
        this.connectionPromise = null;
      }
    }
    if ((this.serverUrl !== uri || !this.isConnected) && (this.client || this.isConnected)) {
      console.log('[PersistentMcpClient] URL changed or connection invalid, disconnecting first');
      await this.disconnect();
    }
    this.serverUrl = uri;
    console.log(`[PersistentMcpClient] Creating new connection to ${uri}`);
    this.connectionPromise = this.createConnection(uri);
    try {
      const result = await this.connectionPromise;
      return result;
    } catch (error) {
      this.connectionPromise = null;
      throw error;
    }
  }

  private async createConnection(uri: string): Promise<Client> {
    const spinner = createSpinner(`Connecting to MCP server at ${uri}...`);
    try {
      if (!uri || typeof uri !== 'string') {
        throw new Error('URI must be a non-empty string');
      }
      let baseUrl: URL;
      try {
        baseUrl = new URL(uri);
      } catch (error) {
        throw new Error(`Invalid URI: ${uri}`);
      }
      spinner.success(`URI validated: ${uri}`);
      spinner.success(`Attempting connection with SSE transport...`);
      console.log('Connecting with SSE transport...');
      const client = new Client(
        { name: 'sse-client', version: '1.0.0' },
        { capabilities: {} },
      );
      client.setNotificationHandler(LoggingMessageNotificationSchema, notification => {
        console.debug('[server log]:', notification.params.data);
      });
      const transport = new SSEClientTransport(baseUrl);
      const connectionTimeout = 10000;
      const connectionPromise = client.connect(transport);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Connection timeout after ${connectionTimeout}ms.`));
        }, connectionTimeout);
      });
      await Promise.race([connectionPromise, timeoutPromise]);
      console.log('Successfully connected using SSE transport');
      spinner.success(`Connected using SSE transport`);
      this.client = client;
      this.transport = transport;
      this.consecutiveFailures = 0;
      this.lastConnectionError = null;
      this.isConnected = true;
      this.lastConnectionCheck = Date.now();
      spinner.success(`Connected to MCP server`);
      return this.client;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.isConnected = false;
      this.client = null;
      this.transport = null;
      this.connectionPromise = null;
      let enhancedErrorMessage = errorMessage;
      if (errorMessage.includes('404') || errorMessage.includes('404 page not found')) enhancedErrorMessage = 'Server URL not found (404). Check server URL and status.';
      else if (errorMessage.includes('403')) enhancedErrorMessage = 'Access forbidden (403). Check permissions.';
      else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('Connection refused')) enhancedErrorMessage = 'Connection refused. Verify server is running.';
      else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) enhancedErrorMessage = 'Connection timeout. Check network/server status.';
      // Add other error enhancements as previously defined
      this.lastConnectionError = enhancedErrorMessage;
      this.consecutiveFailures++;
      spinner.error(enhancedErrorMessage);
      console.error(`[PersistentMcpClient] Connection attempt ${this.consecutiveFailures}/${this.maxConsecutiveFailures} failed: ${enhancedErrorMessage}`);
      const enhancedError = new Error(enhancedErrorMessage);
      enhancedError.stack = error instanceof Error ? error.stack : undefined;
      throw enhancedError;
    }
  }

  public async disconnect(): Promise<void> {
    const spinner = createSpinner(`Disconnecting from MCP server...`);
    const wasConnected = this.isConnected;
    try {
      if (this.client) {
        try {
          await this.client.close();
          spinner.success(`Disconnected from MCP server`);
        } catch (closeError) {
          console.warn('[PersistentMcpClient] Client close failed, cleaning up state:', closeError);
          spinner.success(`Cleaned up connection state (close failed)`);
        }
      }
      if (this.transport && 'close' in this.transport && typeof this.transport.close === 'function') {
        try {
          await (this.transport as any).close();
        } catch (transportError) {
          console.warn('[PersistentMcpClient] Transport close failed:', transportError);
        }
      }
      if (!this.client && !this.transport && !wasConnected) {
        spinner.success(`No active connection to disconnect`);
      }
    } catch (error) {
      console.warn('[PersistentMcpClient] Disconnect error, cleaning up state:', error);
      spinner.success(`Cleaned up connection state (disconnect error)`);
    } finally {
      this.isConnected = false;
      this.client = null;
      this.transport = null;
      this.connectionPromise = null;
      console.log('[PersistentMcpClient] Connection state fully reset');
    }
  }

  public async ensureConnection(): Promise<Client> {
    if (!this.serverUrl) {
      throw new Error('No server URL configured. Connect manually.');
    }
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      throw new Error(`Connection permanently failed after ${this.maxConsecutiveFailures} attempts. Last error: ${this.lastConnectionError}`);
    }
    if (!this.isConnected || !this.client) {
      throw new Error(`Not connected to MCP server at ${this.serverUrl}. Connect manually.`);
    }
    this.lastConnectionCheck = Date.now();
    return this.client;
  }

  public async callTool(toolName: string, args: { [key: string]: unknown }): Promise<any> {
    const spinner = createSpinner(`Calling tool ${toolName}...`);
    try {
      const client = await this.ensureConnection();
      if (!toolName || typeof toolName !== 'string') throw new Error('Tool name must be non-empty string');
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Arguments must be an object');
      const result = await client.callTool({ name: toolName, arguments: args });
      spinner.success(`Tool ${toolName} called successfully`);
      prettyPrint(result); // Assuming prettyPrint is available
      this.lastConnectionCheck = Date.now();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.error(errorMessage);
      if (this.isConnectionError(errorMessage)) {
        this.isConnected = false; this.client = null; this.transport = null; this.connectionPromise = null;
      }
      throw error;
    }
  }

  private isConnectionError(errorMessage: string): boolean {
    const patterns = [/connection refused/i, /econnrefused/i, /timeout/i, /etimedout/i, /failed to fetch/i, /sse error/i, /network error/i, /server unavailable/i, /connection failed/i, /transport error/i, /socket error/i];
    return patterns.some(pattern => pattern.test(errorMessage));
  }

  public async getPrimitives(): Promise<Primitive[]> {
    if (this.primitives && this.primitivesLastFetched && (Date.now() - this.primitivesLastFetched < this.primitivesMaxAge)) {
      console.log('[PersistentMcpClient] Returning cached primitives.');
      return this.primitives;
    }

    const spinner = createSpinner(`Retrieving primitives...`); // Moved spinner creation after cache check
    try {
      const client = await this.ensureConnection();
      console.log('[PersistentMcpClient] Fetching primitives from server...'); // Added more specific log
      const primitives = await listPrimitives(client); // Assuming listPrimitives is available
      spinner.success(`Retrieved ${primitives.length} primitives`);
      
      this.primitives = primitives;
      this.primitivesLastFetched = Date.now();
      this.lastConnectionCheck = Date.now();
      return primitives;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      spinner.error(errorMessage);
      if (this.isConnectionError(errorMessage)) {
        this.isConnected = false; this.client = null; this.transport = null; this.connectionPromise = null;
      }
      throw error;
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public async forceReconnect(uri?: string): Promise<void> {
    console.log('[PersistentMcpClient] Force reconnect initiated');
    this.consecutiveFailures = 0; 
    this.lastConnectionError = null;
    this.clearCache();
    await this.disconnect(); 
    if (uri) {
      this.serverUrl = uri;
      console.log(`[PersistentMcpClient] Updated server URL to: ${uri}`);
    }
    if (this.serverUrl) {
      console.log(`[PersistentMcpClient] Attempting reconnection to: ${this.serverUrl}`);
      await this.connect(this.serverUrl); 
    } else {
      throw new Error('No server URL for reconnection. Configure and connect manually.');
    }
  }

  private cleanupOldConnection(client: Client | null, transport: Transport | null): void {
    if (!client && !transport) return;
    const cleanup = async () => {
      try {
        if (client) await Promise.race([client.close(), new Promise((_, r) => setTimeout(() => r(new Error('Client close timeout')), 5000))]);
        if (transport && 'close' in transport && typeof transport.close === 'function') {
          await Promise.race([(transport as any).close(), new Promise((_, r) => setTimeout(() => r(new Error('Transport close timeout')), 5000))]);
        }
      } catch (e) { console.warn('[PersistentMcpClient] Old connection cleanup failed (non-blocking):', e); }
    };
    cleanup();
  }

  public clearCache(): void {
    console.log('[PersistentMcpClient] Clearing primitives cache');
    this.primitives = null;
    this.primitivesLastFetched = 0;
  }

  public getServerUrl(): string { return this.serverUrl; }
  public getClient(): Client | null { return this.client; }

  public getConnectionDebugInfo(): any { // Return type simplified for brevity
    return {
      isConnected: this.isConnected, hasClient: !!this.client, hasTransport: !!this.transport,
      hasConnectionPromise: !!this.connectionPromise, serverUrl: this.serverUrl,
      consecutiveFailures: this.consecutiveFailures, lastError: this.lastConnectionError,
      timeSinceLastCheck: Date.now() - this.lastConnectionCheck,
    };
  }

  public resetConnectionState(): void {
    console.log('[PersistentMcpClient] Resetting connection state manually');
    this.isConnected = false; this.client = null; this.transport = null; this.connectionPromise = null;
    this.lastConnectionError = null; this.lastConnectionCheck = 0;
    console.log('[PersistentMcpClient] Connection state reset complete');
  }

  public abortConnection(): void {
    console.log('[PersistentMcpClient] Aborting current connection');
    const clientToClose = this.client; const transportToClose = this.transport;
    this.isConnected = false; this.client = null; this.transport = null; this.connectionPromise = null;
    this.cleanupOldConnection(clientToClose, transportToClose);
    console.log('[PersistentMcpClient] Connection aborted');
  }
}






/**
 * Creates a simple spinner for console feedback
 * @param text The text to display with the spinner
 * @returns A spinner object with success and error methods
 */
function createSpinner(text: string): Spinner {
  console.log(`⏳ ${text}`);
  return {
    success: (message?: string) => {
      console.log(`✅ ${message || text} completed`);
    },
    error: (message: string) => {
      console.error(`❌ ${text} failed: ${message}`);
    },
  };
}

/**
 * Pretty prints an object to the console
 * @param obj The object to print
 */
function prettyPrint(obj: any): void {
  console.log(JSON.stringify(obj, null, 2));
}

/**
 * Utility function to check if an MCP server is available at the specific endpoint
 * @param url The complete MCP URL to check (including endpoint path)
 * @param requiresActiveClient Whether to require an active client connection (default: false)
 * @returns Promise that resolves to true if MCP server is available at this endpoint, false otherwise
 */
async function isServerAvailable(url: string, requiresActiveClient: boolean = false): Promise<boolean> {
  // If requiresActiveClient is true, check if we have an active client connection
  // and verify the hostname is still reachable
  if (requiresActiveClient) {
    // First check if we have an active client connection
    const hasActiveClient = persistentClient.getConnectionStatus() && !!persistentClient.getClient();
    if (!hasActiveClient) {
      return false;
    }

    // If we have an active client, verify the hostname/domain is still reachable
    // This provides a basic connectivity check without testing the specific MCP endpoint
    try {
      const parsedUrl = new URL(url);
      const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}${parsedUrl.port ? ':' + parsedUrl.port : ''}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // Shorter timeout for hostname check

      try {
        const response = await fetch(baseUrl, {
          method: 'HEAD',
          signal: controller.signal,
          mode: 'no-cors', // Use no-cors for basic connectivity check
        });

        console.log(`Hostname ${baseUrl} is reachable for active client`);
        return true;
      } catch (fetchError) {
        const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);

        // For no-cors requests, most responses will throw, so we need to be more lenient
        if (
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('ENOTFOUND') ||
          errorMessage.includes('ERR_INTERNET_DISCONNECTED')
        ) {
          console.log(`Hostname ${baseUrl} is not reachable: ${errorMessage}`);
          return false;
        } else {
          // Other errors might indicate the server is actually reachable
          console.log(`Hostname ${baseUrl} appears reachable despite error: ${errorMessage}`);
          return true;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.log(`Error checking hostname availability for active client: ${error}`);
      return false;
    }
  }

  try {
    // Parse the URL to get hostname and port
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    const port = parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80');

    // Create an abort controller with timeout to prevent long waits
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout

    try {
      // Check the exact MCP endpoint, not just the hostname
      // This is more accurate for MCP availability
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        mode: 'cors', // Use CORS since MCP requires it
      });

      // Check for successful responses or expected MCP-related status codes
      if (response.ok || response.status === 200) {
        console.log(`MCP endpoint ${url} is available (status: ${response.status})`);
        return true;
      } else if (response.status === 405) {
        // Method not allowed usually means the endpoint exists but doesn't support HEAD
        // This is common for MCP endpoints
        console.log(`MCP endpoint ${url} exists but doesn't support HEAD (405) - considering available`);
        return true;
      } else if (response.status === 404) {
        console.log(`MCP endpoint ${url} not found (404) - not available`);
        return false;
      } else if (response.status === 403) {
        console.log(`MCP endpoint ${url} forbidden (403) - considering unavailable`);
        return false;
      } else if (response.status >= 500) {
        console.log(`MCP endpoint ${url} server error (${response.status}) - considering unavailable`);
        return false;
      } else {
        // For other status codes, be conservative and consider available
        console.log(`MCP endpoint ${url} returned status ${response.status} - considering available`);
        return true;
      }
    } catch (fetchError) {
      const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);

      // Network-level errors indicate the endpoint is not available
      if (
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ENOTFOUND') ||
        errorMessage.includes('CORS error') ||
        errorMessage.includes('ERR_INTERNET_DISCONNECTED')
      ) {
        console.log(`MCP endpoint ${url} is not reachable: ${errorMessage}`);
        return false;
      } else {
        // For other errors, be conservative and consider the endpoint potentially available
        console.log(
          `MCP endpoint ${url} check failed with non-network error: ${errorMessage} - considering potentially available`,
        );
        return true;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    // This catch block handles URL parsing errors and other issues
    console.log(`Error checking MCP endpoint availability for ${url}:`, error);
    return false;
  }
}

async function listPrimitives(client: Client): Promise<Primitive[]> {
  const capabilities = client.getServerCapabilities() as ServerCapabilities;
  const primitives: Primitive[] = [];
  const promises: Promise<void>[] = [];

  if (capabilities.resources) {
    promises.push(
      client.listResources().then(({ resources }) => {
        resources.forEach(item => primitives.push({ type: 'resource', value: item }));
      }),
    );
  }
  if (capabilities.tools) {
    promises.push(
      client.listTools().then(({ tools }) => {
        tools.forEach(item => primitives.push({ type: 'tool', value: item }));
      }),
    );
  }
  if (capabilities.prompts) {
    promises.push(
      client.listPrompts().then(({ prompts }) => {
        prompts.forEach(item => primitives.push({ type: 'prompt', value: item }));
      }),
    );
  }
  await Promise.all(promises);
  return primitives;
}

// Get the persistent client instance
export const persistentClient = PersistentMcpClient.getInstance();

/**
 * Call a tool on the MCP server using backwards compatible connection
 * @param uri The URI of the MCP server
 * @param toolName The name of the tool to call
 * @param args The arguments to pass to the tool as an object with string keys
 * @returns Promise that resolves to the result of the tool call
 */
export async function callToolWithBackwardsCompatibility(
  uri: string,
  toolName: string,
  args: { [key: string]: unknown },
): Promise<any> {
  try {
    // Connect to the server if not already connected (with SSE transport)
    await persistentClient.connect(uri);

    // Call the tool using the persistent connection
    return await persistentClient.callTool(toolName, args);
  } catch (error) {
    console.error(`Error calling tool ${toolName}:`, error);
    throw error;
  }
}

/**
 * Legacy alias for backwards compatibility
 * @deprecated Use callToolWithBackwardsCompatibility instead
 */
export async function callToolWithSSE(uri: string, toolName: string, args: { [key: string]: unknown }): Promise<any> {
  return callToolWithBackwardsCompatibility(uri, toolName, args);
}

/**
 * Get all primitives from the MCP server using backwards compatible connection
 * @param uri The URI of the MCP server
 * @param forceRefresh Whether to force a refresh and ignore the cache
 * @returns Promise that resolves to an array of primitives (resources, tools, and prompts)
 */
export async function getPrimitivesWithBackwardsCompatibility(
  uri: string,
  forceRefresh: boolean = false,
): Promise<Primitive[]> {
  try {
    // Connect to the server if not already connected (with SSE transport)
    await persistentClient.connect(uri);

    // Clear cache if force refresh is requested
    if (forceRefresh) {
      console.log('[getPrimitivesWithBackwardsCompatibility] Force refresh requested, clearing cache');
      persistentClient.clearCache();
    }

    // Get primitives using the persistent connection
    return await persistentClient.getPrimitives();
  } catch (error) {
    console.error('Error getting primitives:', error);
    throw error;
  }
}

/**
 * Legacy alias for backwards compatibility
 * @deprecated Use getPrimitivesWithBackwardsCompatibility instead
 */
export async function getPrimitivesWithSSE(uri: string, forceRefresh: boolean = false): Promise<Primitive[]> {
  return getPrimitivesWithBackwardsCompatibility(uri, forceRefresh);
}

/**
 * Check if the MCP server is connected
 * @returns True if connected, false otherwise
 */
export function isMcpServerConnected(): boolean {
  return persistentClient.getConnectionStatus();
}

/**
 * Actively check the MCP server connection status
 * This performs a real-time check of the server availability
 * @returns Promise that resolves to true if connected, false otherwise
 */
export async function checkMcpServerConnection(): Promise<boolean> {
  try {
    // First check if we have a client and it's marked as connected
    const hasClient = !!persistentClient.getClient();
    const isMarkedConnected = persistentClient.getConnectionStatus();

    console.log(`[checkMcpServerConnection] hasClient: ${hasClient}, isMarkedConnected: ${isMarkedConnected}`);

    if (!hasClient || !isMarkedConnected) {
      console.log(`[checkMcpServerConnection] No client or not marked connected, returning false`);
      return false;
    }

    // Get the server URL
    const serverUrl = persistentClient.getServerUrl();
    if (!serverUrl) {
      console.log(`[checkMcpServerConnection] No server URL, returning false`);
      return false;
    }

    // For a quick connection check, we trust the internal state
    // The client connection state is more reliable than external HTTP checks
    // because the MCP connection is persistent and the client tracks its own state
    const connectionStatus = persistentClient.getConnectionStatus();
    console.log(`[checkMcpServerConnection] Final connection status: ${connectionStatus}`);

    return connectionStatus;
  } catch (error) {
    console.error('Error checking MCP server connection:', error);
    return false;
  }
}

/**
 * Force a reconnection to the MCP server
 * @param uri The URI of the MCP server
 * @returns Promise that resolves when reconnection is complete
 */
export async function forceReconnectToMcpServer(uri: string): Promise<void> {
  // Reset all client state for the new URL
  await persistentClient.forceReconnect(uri);
}

/**
 * Reset the connection state completely
 * This is useful when the connection is in an inconsistent state
 */
export function resetMcpConnectionState(): void {
  persistentClient.resetConnectionState();
}

/**
 * Abort any hanging connection and reset state
 * This is useful when a connection is stuck
 */
export function abortMcpConnection(): void {
  persistentClient.abortConnection();
}

/**
 * Call a tool with the given name and arguments
 * @param client The MCP client instance
 * @param toolName The name of the tool to call
 * @param args The arguments to pass to the tool as an object with string keys
 * @returns Promise that resolves to the result of the tool call
 */
async function callTool(client: Client, toolName: string, args: { [key: string]: unknown }): Promise<any> {
  const spinner = createSpinner(`Calling tool ${toolName}...`);
  try {
    if (!client) {
      throw new Error('Client is not initialized');
    }

    if (!toolName || typeof toolName !== 'string') {
      throw new Error('Tool name must be a non-empty string');
    }

    // Validate arguments
    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      throw new Error('Arguments must be an object with string keys');
    }

    const result = await client.callTool({ name: toolName, arguments: args });
    spinner.success(`Tool ${toolName} called successfully`);
    prettyPrint(result);
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    spinner.error(errorMessage);
    throw error;
  }
}

/**
 * Run the MCP client with SSE transport
 * This function is used by the background script to initialize the connection
 * It uses SSE transport only (StreamableHTTP disabled)
 * @param uri The URI of the MCP server
 * @returns Promise that resolves when the connection is established
 */
export async function runWithBackwardsCompatibility(uri: string): Promise<void> {
  try {
    console.log(`Attempting to connect to MCP server with SSE transport: ${uri}`);

    // Connect to the server using the persistent client (with SSE transport)
    await persistentClient.connect(uri);

    // Get primitives to verify the connection works
    const primitives = await persistentClient.getPrimitives();
    console.log(`Connected, found ${primitives.length} primitives`);

    // Log the primitives for debugging
    primitives.forEach(p => {
      console.log(`${p.type}: ${p.value.name} - ${p.value.description || 'No description'}`);
    });

    // Don't disconnect - keep the connection open
    return;
  } catch (error) {
    console.error('Error in MCP connection setup:', error);
    throw error;
  }
}

/**
 * Legacy alias for backwards compatibility
 * @deprecated Use runWithBackwardsCompatibility instead
 */
export async function runWithSSE(uri: string): Promise<void> {
  return runWithBackwardsCompatibility(uri);
}

// Export the callTool function for direct use
export { callTool, prettyPrint, createSpinner, listPrimitives };
