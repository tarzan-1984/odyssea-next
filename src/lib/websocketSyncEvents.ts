/** Dispatched from WebSocketContext when socket reconnects after a prior connection (catch-up sync). */
export const ODYSSEA_WS_RECONNECTED_EVENT = "odyssea-ws-reconnected";

/** Dispatched when the browser access token was refreshed (WebSocket must reconnect with the new JWT). */
export const ODYSSEA_ACCESS_TOKEN_REFRESHED_EVENT = "odyssea-access-token-refreshed";
