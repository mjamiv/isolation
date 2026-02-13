/**
 * WebSocket client for real-time analysis streaming in IsoVis.
 *
 * Connects to the FastAPI WebSocket endpoint and provides typed
 * callbacks for each server event. Includes automatic reconnection
 * with exponential back-off.
 *
 * Usage:
 *   const ws = new AnalysisWebSocket(analysisId);
 *   ws.onProgress = (step, time, converged) => { ... };
 *   ws.onStepResult = (step, data) => { ... };
 *   ws.onComplete = (analysisId, wallTime) => { ... };
 *   ws.onError = (step, message) => { ... };
 *   ws.connect();
 */

import type { ClientMessage, ServerMessage } from '../types/protocol.ts';
import type { TimeStep } from '../types/analysis.ts';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const WS_BASE: string =
  import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000/ws';

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Connection State
// ---------------------------------------------------------------------------

export type ConnectionState = 'connecting' | 'open' | 'closing' | 'closed';

// ---------------------------------------------------------------------------
// WebSocket Client
// ---------------------------------------------------------------------------

export class AnalysisWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  /** Current connection state. */
  public state: ConnectionState = 'closed';

  // -- Callbacks (assign these before calling connect) ----------------------

  /** Fired when analysis has been acknowledged and is running. */
  public onStarted: ((analysisId: string, totalSteps: number) => void) | null =
    null;

  /** Fired on each analysis step progress update. */
  public onProgress:
    | ((step: number, time: number, convergence: boolean) => void)
    | null = null;

  /** Fired when a full step result is streamed from the server. */
  public onStepResult: ((step: number, data: TimeStep) => void) | null = null;

  /** Fired when the analysis finishes successfully. */
  public onComplete: ((analysisId: string, wallTime: number) => void) | null =
    null;

  /** Fired when an analysis error occurs. */
  public onError: ((step: number, message: string) => void) | null = null;

  /** Fired on non-fatal warnings from the solver. */
  public onWarning: ((message: string) => void) | null = null;

  /** Fired when the underlying connection state changes. */
  public onStateChange: ((state: ConnectionState) => void) | null = null;

  constructor(private readonly analysisId: string) {}

  // -- Public API -----------------------------------------------------------

  /** Open the WebSocket connection. */
  connect(): void {
    if (this.ws && (this.state === 'open' || this.state === 'connecting')) {
      return; // already connected or connecting
    }

    this.intentionallyClosed = false;
    this.setState('connecting');

    const url = `${WS_BASE}/analysis/${this.analysisId}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = this.handleOpen;
    this.ws.onmessage = this.handleMessage;
    this.ws.onerror = this.handleError;
    this.ws.onclose = this.handleClose;
  }

  /** Send a typed client message to the server. */
  send(message: ClientMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[AnalysisWebSocket] Cannot send: socket is not open');
      return;
    }
    this.ws.send(JSON.stringify(message));
  }

  /** Gracefully close the connection (no auto-reconnect). */
  close(): void {
    this.intentionallyClosed = true;
    this.clearReconnectTimer();

    if (this.ws) {
      this.setState('closing');
      this.ws.close(1000, 'Client closing connection');
    }
  }

  // -- Internal Handlers ----------------------------------------------------

  private readonly handleOpen = (): void => {
    this.reconnectAttempts = 0;
    this.setState('open');
  };

  private readonly handleMessage = (event: MessageEvent): void => {
    let msg: ServerMessage;
    try {
      msg = JSON.parse(event.data as string) as ServerMessage;
    } catch {
      console.error('[AnalysisWebSocket] Failed to parse message:', event.data);
      return;
    }

    switch (msg.event) {
      case 'analysis_started':
        this.onStarted?.(msg.analysisId, msg.totalSteps);
        break;
      case 'analysis_progress':
        this.onProgress?.(msg.step, msg.time, msg.convergence);
        break;
      case 'step_results':
        this.onStepResult?.(msg.step, msg.data);
        break;
      case 'analysis_complete':
        this.onComplete?.(msg.analysisId, msg.wallTime);
        break;
      case 'analysis_error':
        this.onError?.(msg.step, msg.message);
        break;
      case 'analysis_warning':
        this.onWarning?.(msg.message);
        break;
      default:
        console.warn('[AnalysisWebSocket] Unknown event:', msg);
    }
  };

  private readonly handleError = (_event: Event): void => {
    console.error('[AnalysisWebSocket] Connection error');
    // The close event will fire after this, which triggers reconnection.
  };

  private readonly handleClose = (_event: CloseEvent): void => {
    this.ws = null;
    this.setState('closed');

    if (!this.intentionallyClosed) {
      this.scheduleReconnect();
    }
  };

  // -- Reconnection Logic ---------------------------------------------------

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `[AnalysisWebSocket] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) exceeded`,
      );
      this.onError?.(
        -1,
        `Lost connection to analysis server after ${MAX_RECONNECT_ATTEMPTS} attempts`,
      );
      return;
    }

    const delay =
      BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts += 1;

    console.info(
      `[AnalysisWebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(newState: ConnectionState): void {
    this.state = newState;
    this.onStateChange?.(newState);
  }
}
