import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';
import {
  runWithSSE, // This might become unused after removing tryConnectToServer
  isMcpServerConnected, // This might become unused
  forceReconnectToMcpServer,
  checkMcpServerConnection,
} from '../mcpclient/officialmcpclient';
import { mcpInterface } from '../mcpclient/mcpinterfaceToContentScript';
import { sendAnalyticsEvent, trackError } from '../../utils/analytics';

// Default MCP server URL - Kept for reference or if manual connection UI needs a default
const DEFAULT_MCP_SERVER_URL = 'http://localhost:3006/sse';

/**
 * Enhanced error categorization for better tool vs connection error distinction
 * This function might still be useful if errors are handled elsewhere.
 */
function categorizeToolError(error: Error): { isConnectionError: boolean; isToolError: boolean; category: string } {
  const errorMessage = error.message.toLowerCase();

  const toolErrorPatterns = [
    /tool .* not found/i, /tool not found/i, /method not found/i, /invalid arguments/i,
    /invalid parameters/i, /mcp error -32602/i, /mcp error -32601/i, /mcp error -32600/i,
    /tool '[^']+' is not available/i, /tool '[^']+' not found on server/i,
  ];
  const connectionErrorPatterns = [
    /connection refused/i, /econnrefused/i, /timeout/i, /etimedout/i, /enotfound/i,
    /network error/i, /server unavailable/i, /could not connect/i, /connection failed/i,
    /transport error/i, /fetch failed/i,
  ];

  if (toolErrorPatterns.some(pattern => pattern.test(errorMessage))) {
    return { isConnectionError: false, isToolError: true, category: 'tool_error' };
  }
  if (connectionErrorPatterns.some(pattern => pattern.test(errorMessage))) {
    return { isConnectionError: true, isToolError: false, category: 'connection_error' };
  }
  return { isConnectionError: false, isToolError: true, category: 'unknown_tool_error' };
}

/**
 * Initialize the extension
 * This function is called once when the extension starts
 */
async function initializeExtension() {
  sendAnalyticsEvent('extension_loaded', {});
  console.log('Extension initializing...');

  try {
    const theme = await exampleThemeStorage.get();
    console.log('Theme initialized:', theme);
  } catch (error) {
    console.warn('Error initializing theme, continuing with defaults:', error);
  }

  // Wait for the MCP interface to load its server URL from storage
  // McpInterface constructor already handles this and sets initial disconnected state.
  await mcpInterface.waitForInitialization(); 

  const serverUrl = mcpInterface.getServerUrl();
  console.log('MCP Interface initialized with server URL:', serverUrl);
  
  // McpInterface constructor now sets initial status to false and broadcasts.
  // Explicitly calling updateConnectionStatus(false) here is redundant but harmless.
  // It ensures the state is explicitly set after waitForInitialization if there was any doubt.
  mcpInterface.updateConnectionStatus(false);

  console.log('Extension initialized successfully, MCP connection is manual.');
}

// --- Automatic connection logic REMOVED ---
// const MAX_CONNECTION_ATTEMPTS = 5; // REMOVED
// let connectionAttemptCount = 0; // REMOVED
// let isConnecting = false; // REMOVED - this was the source of the ReferenceError

/*
// Function tryConnectToServer REMOVED as it implements automatic connection attempts.
async function tryConnectToServer(uri: string): Promise<void> {
  // ... content of tryConnectToServer removed ...
}
*/

/*
// setInterval for periodic connection check REMOVED as it implements automatic connection attempts.
const PERIODIC_CHECK_INTERVAL = 60000; // 1 minute
setInterval(async () => {
  // ... content of setInterval removed ...
}, PERIODIC_CHECK_INTERVAL);
*/
// --- End of REMOVED automatic connection logic ---


// --- Error Handling ---\n
self.addEventListener('unhandledrejection', event => {
  console.error('Unhandled rejection in service worker:', event.reason);
  if (event.reason instanceof Error) {
    trackError(event.reason, 'background_unhandled_rejection');
  } else {
    sendAnalyticsEvent('extension_error', {
      error_message: `Unhandled rejection: ${JSON.stringify(event.reason)}`,
      error_context: 'background_unhandled_rejection_non_error',
    });
  }
});

self.addEventListener('error', event => {
  console.error('Uncaught error in service worker:', event.error);
  if (event.error instanceof Error) {
    trackError(event.error, 'background_uncaught_error');
  } else {
    sendAnalyticsEvent('extension_error', {
      error_message: `Uncaught error: ${event.message}`,
      error_context: 'background_uncaught_error_non_error',
    });
  }
});

// --- Lifecycle Events ---\n
chrome.runtime.onInstalled.addListener(details => {
  console.log('Extension installed or updated:', details.reason);
  sendAnalyticsEvent('extension_installed', { reason: details.reason });

  if (details.reason === 'install') {
    console.log('Performing first-time installation setup.');
  } else if (details.reason === 'update') {
    console.log(`Extension updated from ${details.previousVersion}`);
  }
  // No automatic initialization or connection attempt here.
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Browser startup detected.');
  sendAnalyticsEvent('browser_startup', {});
  // Initialize extension state, but do not attempt to connect automatically.
  initializeExtension().catch(err => console.error('Error initializing on startup:', err));
});

// Start extension initialization
initializeExtension()
  .then(() => {
    console.log('Extension startup complete');
  })
  .catch(error => {
    console.error('Error during extension initialization:', error);
    console.log('Extension will continue running with limited functionality');
  });

console.log('Background script loaded');
console.log("Edit 'chrome-extension/src/background/index.ts' and save to reload.");

// --- Message Handling ---\n
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.debug('[Background] Received message:', message);
  if (message.command === 'trackAnalyticsEvent') {
    if (message.eventName && message.eventParams) {
      sendAnalyticsEvent(message.eventName, message.eventParams)
        .then(() => {
          sendResponse({ success: true });
        })
        .catch(error => {
          console.error('[Background] Error tracking analytics event from message:', error);
          sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) });
        });
      return true; 
    } else {
      console.warn('[Background] Invalid trackAnalyticsEvent message received:', message);
      sendResponse({ success: false, error: 'Invalid eventName or eventParams' });
    }
  }
  return false; 
});