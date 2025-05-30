import 'webextension-polyfill';
import { exampleThemeStorage } from '@extension/storage';
import {
  runWithSSE,
  isMcpServerConnected,
  forceReconnectToMcpServer,
  checkMcpServerConnection,
} from '../mcpclient/officialmcpclient';
import { mcpInterface } from '../mcpclient/mcpinterfaceToContentScript';
import { sendAnalyticsEvent, trackError } from '../../utils/analytics';

// Default MCP server URL
const DEFAULT_MCP_SERVER_URL = 'http://localhost:3006/sse';

/**
 * Initialize the extension
 * This function is called once when the extension starts
 */
async function initializeExtension() {
  sendAnalyticsEvent('extension_loaded', {});
  console.log('Extension initializing...');
  
  // Initialize theme
  try {
    const theme = await exampleThemeStorage.get();
    console.log('Theme initialized:', theme);
  } catch (error) {
    console.warn('Error initializing theme, continuing with defaults:', error);
  }

  // Initialize the MCP interface, but don't connect yet
  const serverUrl = await initializeServerUrl();
  mcpInterface.updateServerUrl(serverUrl);
  mcpInterface.updateConnectionStatus(false);

  console.log('Extension initialized successfully');

}

// Initialize server URL from storage or use default
async function initializeServerUrl(): Promise<string> {
  try {
    const result = await chrome.storage.local.get('mcpServerUrl');
    const serverUrl = result.mcpServerUrl || DEFAULT_MCP_SERVER_URL;
    console.log(`Loaded MCP server URL from storage: ${serverUrl}`);
    return serverUrl;
  } catch (error) {
    console.error('Error loading MCP server URL from storage:', error);
    return DEFAULT_MCP_SERVER_URL;
  }
}

async function tryConnectToServer(uri: string): Promise<void> {
  try {
    await runWithSSE(uri);
    console.log('MCP client connected successfully');
    mcpInterface.updateConnectionStatus(true);
  } catch (error: any) {
    console.warn(`MCP server unavailable: ${error.message || String(error)}`);
    console.log('Extension will continue to function with limited capabilities');
    mcpInterface.updateConnectionStatus(false);
    // The persistentClient will now handle retries internally
  }
}

// Set up a periodic connection check
const PERIODIC_CHECK_INTERVAL = 60000; // 1 minute
setInterval(async () => {
  // If not connected, try to connect. The persistentClient will handle backoff and retries.
  if (!isMcpServerConnected()) {
    console.log('Periodic check: MCP server not connected, attempting to connect...');
    const serverUrl = await initializeServerUrl(); // Ensure we have the latest URL
    tryConnectToServer(serverUrl).catch(() => {}); // tryConnectToServer will now just initiate the connection
  }
}, PERIODIC_CHECK_INTERVAL);

// --- Error Handling ---
// Listen for unhandled errors in the service worker
// Note: This may not catch all async errors perfectly depending on how they propagate
self.addEventListener('unhandledrejection', event => {
  console.error('Unhandled rejection in service worker:', event.reason);
  if (event.reason instanceof Error) {
    trackError(event.reason, 'background_unhandled_rejection');
  } else {
    // Handle non-Error rejections if necessary
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

// --- Lifecycle Events ---

chrome.runtime.onInstalled.addListener(details => {
  console.log('Extension installed or updated:', details.reason);
  sendAnalyticsEvent('extension_installed', { reason: details.reason });

  // Perform initial setup on first install
  if (details.reason === 'install') {
    // You might want to set default settings here
    console.log('Performing first-time installation setup.');
    // Example: Set default server URL if not already set (although initializeServerUrl handles this)
  } else if (details.reason === 'update') {
    console.log(`Extension updated from ${details.previousVersion}`);
    // Handle updates if needed
  }

  // Re-initialize after install/update (optional, depending on setup)
  // initializeExtension().catch(err => console.error("Error re-initializing after install:", err));
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Browser startup detected.');
  sendAnalyticsEvent('browser_startup', {});
  // Re-check connection on startup
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

// --- Message Handling ---

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
      return true; // Indicates asynchronous response
    } else {
      console.warn('[Background] Invalid trackAnalyticsEvent message received:', message);
      sendResponse({ success: false, error: 'Invalid eventName or eventParams' });
    }
  }
  // Keep this return false if no other async handlers are present or if this is the only handler
  // If other handlers might respond asynchronously, you might need to return true based on conditions.
  // For this specific handler, returning true within the `if` block is correct.
  // However, if no message command matches, we should let the channel close.
  return false; // Default: No async response unless handled above
});
