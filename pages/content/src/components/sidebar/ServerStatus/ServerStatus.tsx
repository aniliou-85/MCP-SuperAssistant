import type React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useBackgroundCommunication } from '../hooks/backgroundCommunication';
import { logMessage } from '@src/utils/helpers';
import { Typography, Icon, Button } from '../ui';
import { cn } from '@src/lib/utils';
import { Card, CardContent } from '@src/components/ui/card';

interface ServerStatusProps {
  status: string;
}

const ServerStatus: React.FC<ServerStatusProps> = ({ status: initialStatus }) => {
  // Use local status state to ensure UI stability even with external status issues
  const [status, setStatus] = useState<string>(initialStatus || 'unknown');
  const [showDetails, setShowDetails] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastReconnectTime, setLastReconnectTime] = useState<string>('');
  const [serverUri, setServerUri] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [hasBackgroundError, setHasBackgroundError] = useState<boolean>(false);
  const [isEditingUri, setIsEditingUri] = useState<boolean>(false); // Track if user is actively editing the URI
  const [lastErrorMessage, setLastErrorMessage] = useState<string>(''); // Store the last detailed error message

  // Animation states
  const [isStatusChanging, setIsStatusChanging] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [settingsAnimating, setSettingsAnimating] = useState(false);
  const [detailsAnimating, setDetailsAnimating] = useState(false);

  // Get communication methods with error handling
  const communicationMethods = useBackgroundCommunication();

  // Destructure with fallbacks in case useBackgroundCommunication fails
  const forceReconnect = useCallback(async () => {
    try {
      if (!communicationMethods.forceReconnect) {
        throw new Error('Communication method unavailable');
      }
      return await communicationMethods.forceReconnect();
    } catch (error) {
      logMessage(`[ServerStatus] Force reconnect error: ${error instanceof Error ? error.message : String(error)}`);
      setHasBackgroundError(true);
      return false;
    }
  }, [communicationMethods]);

  // Get the last connection error from the background communication hook
  const backgroundConnectionError = communicationMethods.lastConnectionError || '';

  const refreshTools = useCallback(
    async (forceRefresh = false) => {
      try {
        if (!communicationMethods.refreshTools) {
          throw new Error('Communication method unavailable');
        }
        return await communicationMethods.refreshTools(forceRefresh);
      } catch (error) {
        logMessage(`[ServerStatus] Refresh tools error: ${error instanceof Error ? error.message : String(error)}`);
        setHasBackgroundError(true);
        return [];
      }
    },
    [communicationMethods],
  );

  const getServerConfig = useCallback(
    async (forceRefresh: boolean = false) => {
      try {
        if (!communicationMethods.getServerConfig) {
          throw new Error('Communication method unavailable');
        }
        return await communicationMethods.getServerConfig(forceRefresh);
      } catch (error) {
        logMessage(`[ServerStatus] Get server config error: ${error instanceof Error ? error.message : String(error)}`);
        setHasBackgroundError(true);
        throw error; // Don't fallback to default, let caller handle the error
      }
    },
    [communicationMethods],
  );

  const updateServerConfig = useCallback(
    async (config: { uri: string }) => {
      try {
        if (!communicationMethods.updateServerConfig) {
          throw new Error('Communication method unavailable');
        }
        return await communicationMethods.updateServerConfig(config);
      } catch (error) {
        logMessage(
          `[ServerStatus] Update server config error: ${error instanceof Error ? error.message : String(error)}`,
        );
        setHasBackgroundError(true);
        return false;
      }
    },
    [communicationMethods],
  );

  // CRITICAL FIX: Force the component to ALWAYS use the initialStatus prop directly
  // This ensures the UI always reflects the actual server status without any conditions
  useEffect(() => {
    // Always log the status for debugging
    logMessage(
      `[ServerStatus] Props received initialStatus: "${initialStatus}", current UI status: "${status}", isReconnecting: ${isReconnecting}`,
    );

    // Don't update status if we're in the middle of saving configuration to prevent flickers
    if (isReconnecting) {
      logMessage(`[ServerStatus] Skipping status update during reconnection process`);
      return;
    }

    // ALWAYS update the status from props, but only when not reconnecting
    if (initialStatus && initialStatus !== status) {
      logMessage(`[ServerStatus] FORCE UPDATING status from "${status}" to "${initialStatus}"`);

      // Simple status update without excessive animation
      setStatus(initialStatus);

      // Update status message based on the new status only if not reconnecting
      if (initialStatus === 'disconnected') {
        setStatusMessage('Server disconnected. Click the refresh button to reconnect.');
      } else if (initialStatus === 'connected') {
        setStatusMessage('Connected to MCP server');
        // Brief success indication only for connection
        if (status !== 'connected') {
          setShowSuccessAnimation(true);
          setTimeout(() => setShowSuccessAnimation(false), 1000);
        }
      } else if (initialStatus === 'error') {
        setStatusMessage('Server connection error. Please check your configuration.');
      }
    }
  }, [initialStatus, status, isReconnecting]); // Include isReconnecting to prevent updates during save

  // Check for background communication issues
  useEffect(() => {
    const checkBackgroundAvailability = () => {
      const methodsAvailable = !!(
        typeof communicationMethods.forceReconnect === 'function' &&
        typeof communicationMethods.refreshTools === 'function' &&
        typeof communicationMethods.getServerConfig === 'function' &&
        typeof communicationMethods.updateServerConfig === 'function'
      );

      if (!methodsAvailable && !hasBackgroundError) {
        setHasBackgroundError(true);
        setStatus('error');
        setStatusMessage('Extension background services unavailable. Try reloading the page.');
      } else if (methodsAvailable && hasBackgroundError) {
        // Background methods have become available again
        setHasBackgroundError(false);
      }
    };

    checkBackgroundAvailability();

    // Check less frequently to reduce excessive calls - reduced from 10s to 30s
    const intervalId = setInterval(checkBackgroundAvailability, 30000);
    return () => clearInterval(intervalId);
  }, [communicationMethods, hasBackgroundError]);

  useEffect(() => {
    // Only fetch server configuration on initial mount - don't refetch while user is editing
    const fetchInitialServerConfig = async () => {
      try {
        logMessage('[ServerStatus] Fetching initial server configuration from background storage');
        const config = await getServerConfig();
        if (config && config.uri) {
          setServerUri(config.uri);
          logMessage(`[ServerStatus] Initial server configuration loaded: ${config.uri}`);
        } else {
          logMessage('[ServerStatus] No valid server configuration received from background storage');
          setServerUri(''); // Set empty string to indicate no config loaded
        }
      } catch (error) {
        logMessage(
          `[ServerStatus] Error fetching server config: ${error instanceof Error ? error.message : String(error)}`,
        );
        setServerUri(''); // Set empty string to indicate fetch failed
      }
    };

    // Only fetch if we have communication methods, no server URI is set yet, and user is not editing
    // This prevents refetching while the user is actively editing the URI
    if (
      communicationMethods &&
      typeof communicationMethods.getServerConfig === 'function' &&
      !serverUri &&
      !isEditingUri
    ) {
      fetchInitialServerConfig().catch(() => {
        logMessage('[ServerStatus] Failed to fetch server configuration');
        setServerUri(''); // Set empty string as last resort
      });
    }
  }, [communicationMethods, isEditingUri, getServerConfig]); // Add getServerConfig dependency

  // Set status message based on connection state
  useEffect(() => {
    // During reconnection, don't override the status message set by handleSaveServerConfig
    if (isReconnecting) {
      return;
    }

    if (hasBackgroundError) {
      setStatusMessage('Extension background services unavailable. Try reloading the page.');
    } else {
      switch (status) {
        case 'connected':
          setStatusMessage('MCP Server is connected and ready');
          break;
        case 'disconnected':
          setStatusMessage('MCP Server is unavailable. Some features will be limited.');
          break;
        case 'error':
          setStatusMessage('Error connecting to extension services. Try reloading the page.');
          break;
        default:
          setStatusMessage('Checking MCP Server status...');
      }
    }
  }, [status, hasBackgroundError, isReconnecting]);

  const handleReconnect = async () => {
    const startTime = Date.now();
    const minDisplayDuration = 1200; // Minimum display time for smooth UX

    try {
      logMessage('[ServerStatus] Reconnect button clicked');
      setIsReconnecting(true);
      setStatusMessage('Attempting to reconnect to MCP server...');

      // Check if we can connect to the background script first
      if (hasBackgroundError) {
        logMessage('[ServerStatus] Attempting to recover background connection');
        // Wait a bit to see if background services become available
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check again if background services are available
        if (!communicationMethods.forceReconnect) {
          throw new Error('Background services still unavailable');
        }

        // If we got here, background services have been restored
        setHasBackgroundError(false);
      }

      logMessage('[ServerStatus] Calling forceReconnect method');
      const success = await forceReconnect();
      logMessage(`[ServerStatus] Reconnection ${success ? 'succeeded' : 'failed'}`);

      // Update last reconnect time
      const now = new Date();
      setLastReconnectTime(now.toLocaleTimeString());

      // Ensure minimum display duration before updating final state
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayDuration - elapsed);

      if (remainingTime > 0) {
        logMessage(`[ServerStatus] Waiting ${remainingTime}ms for smooth transition`);
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      // Update local status based on reconnection result
      setStatus(success ? 'connected' : 'disconnected');

      // Set appropriate status message
      if (success) {
        setStatusMessage('Successfully reconnected to MCP server');
        logMessage('[ServerStatus] Reconnection successful, fetching fresh tool list');
        try {
          const tools = await refreshTools(false);
          logMessage(`[ServerStatus] Successfully fetched ${tools.length} tools after reconnection`);
        } catch (refreshError) {
          logMessage(
            `[ServerStatus] Error fetching tools after reconnection: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`,
          );
        }
      } else {
        setStatusMessage('Failed to reconnect to MCP server. Some features will be limited.');
      }
    } catch (error) {
      // Ensure minimum display time even for errors
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayDuration - elapsed);

      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      logMessage(`[ServerStatus] Reconnection error: ${error instanceof Error ? error.message : String(error)}`);

      // Use the enhanced error message from the error object and store it
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLastErrorMessage(errorMessage); // Store the detailed error message

      // Display the enhanced error message in the status
      if (errorMessage.includes('404') || errorMessage.includes('not found')) {
        setStatusMessage(
          'Server URL not found (404). Please verify your MCP server URL and ensure the server is running.',
        );
      } else if (errorMessage.includes('403')) {
        setStatusMessage('Access forbidden (403). Please check server permissions and authentication settings.');
      } else if (errorMessage.includes('500') || errorMessage.includes('502') || errorMessage.includes('503')) {
        setStatusMessage('Server error detected. The MCP server may be experiencing issues.');
      } else if (errorMessage.includes('Connection refused') || errorMessage.includes('ECONNREFUSED')) {
        setStatusMessage('Connection refused. Please verify the MCP server is running at the configured URL.');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        setStatusMessage('Connection timeout. The server may be slow to respond or unreachable.');
      } else if (errorMessage.includes('ENOTFOUND')) {
        setStatusMessage('Server not found. Please check the server URL and your network connection.');
      } else {
        setStatusMessage(`Connection failed: ${errorMessage}`);
      }

      setStatus('error');
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleDetails = () => {
    setDetailsAnimating(true);
    setTimeout(() => {
      setShowDetails(!showDetails);
      setDetailsAnimating(false);
    }, 150);
    logMessage(`[ServerStatus] Details ${showDetails ? 'hidden' : 'shown'}, status: ${status}`);
  };

  const handleSettings = () => {
    setSettingsAnimating(true);
    setTimeout(() => {
      setShowSettings(!showSettings);
      setSettingsAnimating(false);
    }, 150);
    logMessage(`[ServerStatus] Settings ${showSettings ? 'hidden' : 'shown'}`);
  };

  const handleServerUriChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setServerUri(e.target.value);
    setIsEditingUri(true); // Mark as editing when user types
  };

  const handleServerUriFocus = () => {
    setIsEditingUri(true); // Mark as editing when user focuses the input
  };

  const handleServerUriBlur = () => {
    // Don't immediately clear editing flag - wait for save or cancel
  };

  const handleSaveServerConfig = async () => {
    if (!communicationMethods.updateServerConfig || hasBackgroundError) {
      logMessage('[ServerStatus] Background communication not available');
      return;
    }

    // Set stable loading state and prevent rapid UI changes
    setIsReconnecting(true);
    setLastReconnectTime(new Date().toLocaleTimeString());

    // Use a single stable message throughout the process to prevent flickers
    const stableMessage = 'Saving configuration and connecting...';
    setStatusMessage(stableMessage);

    // Clear any existing error
    setLastErrorMessage('');

    // Track the start time to ensure minimum display duration
    const startTime = Date.now();
    const minDisplayDuration = 1500; // Minimum 1.5 seconds to prevent jitter

    try {
      logMessage(`[ServerStatus] Saving server URI: ${serverUri}`);

      await updateServerConfig({ uri: serverUri });
      logMessage('[ServerStatus] Server config updated successfully');

      // Clear the editing flag since we successfully saved
      setIsEditingUri(false);

      // Get fresh config to ensure consistency (but don't update UI immediately)
      try {
        const freshConfig = await getServerConfig(true);
        if (freshConfig && freshConfig.uri) {
          setServerUri(freshConfig.uri);
          logMessage(`[ServerStatus] Updated serverUri to stored value: ${freshConfig.uri}`);
        }
      } catch (fetchError) {
        logMessage(
          `[ServerStatus] Error fetching fresh config after save: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        );
      }

      // Trigger reconnect
      const success = await forceReconnect();
      logMessage(`[ServerStatus] Reconnection ${success ? 'succeeded' : 'failed'}`);

      // Calculate remaining time to ensure minimum display duration
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayDuration - elapsed);

      if (remainingTime > 0) {
        logMessage(`[ServerStatus] Waiting ${remainingTime}ms to prevent visual jitter`);
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      // Single final UI update to prevent flickers
      if (success) {
        setStatusMessage('Successfully connected to MCP server');
        setStatus('connected');

        // Refresh tools silently without UI updates
        try {
          const tools = await refreshTools(false);
          logMessage(`[ServerStatus] Successfully refreshed ${tools.length} tools after server change`);
        } catch (refreshError) {
          logMessage(
            `[ServerStatus] Error refreshing tools: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`,
          );
        }
      } else {
        setStatusMessage('Failed to connect to new MCP server');
        setStatus('disconnected');
      }

      // Close settings on success
      setShowSettings(false);
    } catch (error) {
      // Still ensure minimum display time even for errors
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minDisplayDuration - elapsed);

      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      setLastErrorMessage(errorMessage);
      setStatusMessage(`Configuration failed: ${errorMessage}`);
      setStatus('error');
      logMessage(`[ServerStatus] Save config error: ${errorMessage}`);
      // Keep settings open on error
    } finally {
      // Always reset reconnecting state
      setIsReconnecting(false);
    }
  };

  // Determine status color and icon
  const getStatusInfo = () => {
    // Define base colors, assuming dark mode variants are handled by Tailwind prefixes
    const baseColors = {
      emerald: { text: 'text-emerald-500', bg: 'bg-emerald-100', darkBg: 'dark:bg-emerald-900/20' },
      amber: { text: 'text-amber-500', bg: 'bg-amber-100', darkBg: 'dark:bg-amber-900/20' },
      rose: { text: 'text-rose-500', bg: 'bg-rose-100', darkBg: 'dark:bg-rose-900/20' },
      slate: { text: 'text-slate-500', bg: 'bg-slate-100', darkBg: 'dark:bg-slate-900/20' },
    };

    // Determine status display
    const displayStatus = isReconnecting ? 'reconnecting' : status;

    switch (displayStatus) {
      case 'connected':
        return {
          color: baseColors.emerald.text,
          bgColor: cn(baseColors.emerald.bg, baseColors.emerald.darkBg),
          icon: <Icon name="check" className={baseColors.emerald.text} />,
          label: 'Connected',
        };
      case 'reconnecting':
        return {
          color: baseColors.amber.text,
          bgColor: cn(baseColors.amber.bg, baseColors.amber.darkBg),
          icon: <Icon name="refresh" className={cn(baseColors.amber.text, 'animate-spin')} />,
          label: 'Reconnecting',
        };
      case 'disconnected':
        return {
          color: baseColors.rose.text,
          bgColor: cn(baseColors.rose.bg, baseColors.rose.darkBg),
          icon: <Icon name="x" className={baseColors.rose.text} />,
          label: 'Disconnected',
        };
      case 'error':
        return {
          color: baseColors.rose.text,
          bgColor: cn(baseColors.rose.bg, baseColors.rose.darkBg),
          icon: <Icon name="info" className={baseColors.rose.text} />,
          label: 'Error',
        };
      default: // Unknown status
        return {
          color: baseColors.slate.text,
          bgColor: cn(baseColors.slate.bg, baseColors.slate.darkBg),
          icon: <Icon name="info" className={baseColors.slate.text} />,
          label: 'Unknown',
        };
    }
  };

  // Get status info based on current state
  const statusInfo = getStatusInfo();

  // Determine if we should show enhanced visual cues for disconnected/error states
  const isDisconnectedOrError = status === 'disconnected' || status === 'error';

  return (
    <div
      className={cn(
        'relative px-4 py-3 border-b border-slate-200 dark:border-slate-800 transition-all duration-300 ease-out server-status-stable',
        // Add conditional styling for disconnected/error states with smooth transitions
        isDisconnectedOrError &&
          'bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/10 dark:to-red-900/10 border border-rose-200 dark:border-rose-800/50 rounded-sm shadow-sm',
      )}>
      {/* Success animation overlay - subtle */}
      {showSuccessAnimation && (
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-100 to-green-100 dark:from-emerald-900/20 dark:to-green-900/20 opacity-30 animate-pulse rounded-sm" />
      )}

      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 ease-out server-status-icon',
              statusInfo.bgColor,
              // Simplified animations to prevent flickers
              isReconnecting ? 'animate-spin' : isDisconnectedOrError && 'animate-pulse',
            )}>
            <div className="transition-transform duration-200">{statusInfo.icon}</div>
          </div>

          <div className="flex flex-col">
            <Typography
              variant="body"
              className={cn(
                'font-semibold transition-colors duration-200 leading-tight',
                // Enhanced text styling with smooth color transitions
                isDisconnectedOrError
                  ? 'text-rose-700 dark:text-rose-400'
                  : status === 'connected'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-700 dark:text-slate-200',
              )}>
              Server {statusInfo.label}
            </Typography>

            {/* Status message with stable height to prevent layout shifts */}
            <div
              className={cn(
                'text-xs mt-0.5 transition-all duration-200 ease-out max-h-20 overflow-hidden status-message-stable',
                isDisconnectedOrError
                  ? 'text-rose-600 dark:text-rose-400 font-medium'
                  : 'text-slate-500 dark:text-slate-400',
              )}>
              {statusMessage}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Simplified reconnect button */}
          <button
            onClick={handleReconnect}
            disabled={isReconnecting}
            className={cn(
              'group relative p-2 rounded-lg transition-all duration-200 ease-out hover:scale-105 active:scale-95',
              isReconnecting ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-md',
              // Dynamic button styling based on state
              isDisconnectedOrError
                ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-100 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-900/30'
                : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/30',
            )}
            aria-label="Reconnect to server"
            title="Reconnect to server">
            <Icon
              name="refresh"
              size="sm"
              className={cn(
                'transition-transform duration-300',
                isReconnecting ? 'animate-spin' : 'group-hover:rotate-180',
              )}
            />
          </button>

          {/* Simplified settings button */}
          <button
            onClick={handleSettings}
            disabled={settingsAnimating}
            className={cn(
              'group relative p-2 rounded-lg transition-all duration-200 ease-out hover:scale-105 active:scale-95',
              'text-slate-500 hover:text-slate-700 hover:bg-slate-100 hover:shadow-md dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-800',
            )}
            aria-label="Server settings"
            title="Server settings">
            <Icon
              name="settings"
              size="sm"
              className={cn('transition-transform duration-200', showSettings ? 'rotate-90' : 'group-hover:rotate-45')}
            />
          </button>

          {/* Simplified details button */}
          <button
            onClick={handleDetails}
            disabled={detailsAnimating}
            className={cn(
              'group relative p-2 rounded-lg transition-all duration-200 ease-out hover:scale-105 active:scale-95',
              'text-slate-500 hover:text-slate-700 hover:bg-slate-100 hover:shadow-md dark:text-slate-400 dark:hover:text-slate-300 dark:hover:bg-slate-800',
            )}
            aria-label="Show details"
            title="Show details">
            <Icon name="info" size="sm" className="transition-transform duration-200 group-hover:scale-110" />
          </button>
        </div>
      </div>

      {/* Add prominent alert for disconnected/error states with detailed error message */}
      {isDisconnectedOrError && (
        <div className="mt-2 p-2 bg-rose-100 dark:bg-rose-900/20 rounded-md border border-rose-200 dark:border-rose-800/50">
          <div className="flex items-center gap-2">
            <Icon name="alert-triangle" size="sm" className="text-rose-600 dark:text-rose-400" />
            <div className="flex-1">
              <Typography variant="small" className="text-rose-600 dark:text-rose-400 font-medium">
                {status === 'disconnected'
                  ? 'Server connection lost. Click the refresh button to reconnect.'
                  : 'Server connection error. Check your configuration and try again.'}
              </Typography>
              {/* Show detailed error message if available - prefer background error over local error */}
              {(backgroundConnectionError || lastErrorMessage) && (
                <Typography variant="small" className="text-rose-500 dark:text-rose-300 mt-1 text-xs">
                  Details: {backgroundConnectionError || lastErrorMessage}
                </Typography>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Add connecting status indicator for background communication issues */}
      {(hasBackgroundError || !communicationMethods.sendMessage) && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200/50 dark:border-amber-800/30 p-2 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <div className="animate-spin w-3 h-3 border border-amber-500 border-t-transparent rounded-full"></div>
            <Typography variant="caption" className="text-amber-700 dark:text-amber-300 text-xs">
              Connecting to extension services...
            </Typography>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
          <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
            <CardContent className="p-4 text-xs text-slate-700 dark:text-slate-300">
              <Typography variant="h4" className="mb-3 text-slate-800 dark:text-slate-100 font-semibold">
                Server Configuration
              </Typography>
              <div className="mb-4">
                <label htmlFor="server-uri" className="block mb-2 text-slate-600 dark:text-slate-400 font-medium">
                  Server URI
                </label>
                <input
                  id="server-uri"
                  type="text"
                  value={serverUri}
                  onChange={handleServerUriChange}
                  onFocus={handleServerUriFocus}
                  onBlur={handleServerUriBlur}
                  placeholder="Enter server URI (e.g., http://localhost:3000)"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent outline-none transition-all duration-200 hover:border-slate-400 dark:hover:border-slate-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  onClick={() => {
                    setShowSettings(false);
                    setIsEditingUri(false);
                  }}
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95">
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveServerConfig}
                  variant="default"
                  size="sm"
                  className="h-8 px-3 text-xs font-medium transition-all duration-200 hover:scale-105 active:scale-95 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white dark:text-white save-button-stable"
                  disabled={hasBackgroundError || isReconnecting}>
                  {isReconnecting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Connecting...
                    </div>
                  ) : (
                    'Save & Reconnect'
                  )}
                </Button>
              </div>

              {hasBackgroundError && (
                <div className="mt-3 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200">
                  <div className="flex items-center gap-2">
                    <Icon name="alert-triangle" size="sm" className="text-rose-600 dark:text-rose-400" />
                    <p className="font-medium">Extension background services unavailable. Try reloading the page.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Details panel */}
      {showDetails && (
        <div className="mt-3 animate-in slide-in-from-top-2 duration-200">
          <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
            <CardContent className="p-4 text-xs text-slate-700 dark:text-slate-300">
              <Typography variant="h4" className="mb-3 text-slate-800 dark:text-slate-100 font-semibold">
                Connection Details
              </Typography>

              <div className="space-y-2">
                <div className="flex justify-between items-center py-1">
                  <span className="font-medium text-slate-700 dark:text-slate-200">Status:</span>
                  <span
                    className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      status === 'connected'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                        : status === 'disconnected'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400'
                          : 'bg-slate-100 text-slate-700 dark:bg-slate-900/20 dark:text-slate-400',
                    )}>
                    {statusInfo.label}
                  </span>
                </div>

                <div className="flex justify-between items-start py-1">
                  <span className="font-medium text-slate-700 dark:text-slate-200">Server URI:</span>
                  <span className="text-right text-slate-600 dark:text-slate-300 max-w-[200px] break-all">
                    {serverUri || 'Not configured'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1">
                  <span className="font-medium text-slate-700 dark:text-slate-200">Last updated:</span>
                  <span className="text-slate-600 dark:text-slate-300">{new Date().toLocaleTimeString()}</span>
                </div>

                {lastReconnectTime && (
                  <div className="flex justify-between items-center py-1">
                    <span className="font-medium text-slate-700 dark:text-slate-200">Last reconnect:</span>
                    <span className="text-slate-600 dark:text-slate-300">{lastReconnectTime}</span>
                  </div>
                )}
              </div>

              {status === 'disconnected' && (
                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                  <div className="flex items-start gap-2">
                    <Icon name="info" size="sm" className="text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-medium mb-2">Troubleshooting tips:</p>
                      <ul className="list-disc ml-4 space-y-1 text-xs">
                        <li>Check if the MCP server is running at the configured URI</li>
                        <li>Verify network connectivity to the server</li>
                        <li>Restart the MCP server if needed</li>
                        <li>Use the Reconnect button to try again</li>
                      </ul>
                      {/* Show detailed error in troubleshooting section - prefer background error */}
                      {(backgroundConnectionError || lastErrorMessage) && (
                        <div className="mt-3 p-2 bg-amber-100 dark:bg-amber-800/50 rounded border border-amber-200 dark:border-amber-700">
                          <p className="font-medium text-xs mb-1">Last Error:</p>
                          <p className="text-xs break-words">{backgroundConnectionError || lastErrorMessage}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {hasBackgroundError && (
                <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/20 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200">
                  <div className="flex items-start gap-2">
                    <Icon name="alert-triangle" size="sm" className="text-rose-600 dark:text-rose-400 mt-0.5" />
                    <div>
                      <p className="font-medium mb-2">Extension Communication Issue:</p>
                      <ul className="list-disc ml-4 space-y-1 text-xs">
                        <li>Try reloading the current page</li>
                        <li>If the issue persists, restart your browser</li>
                        <li>You may need to reinstall the extension if problems continue</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ServerStatus;
