// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

// Suppress ResizeObserver loop errors - these are harmless browser safety notifications
// that commonly occur with UI libraries like dockview that use ResizeObserver internally.
// See: https://github.com/WICG/resize-observer/issues/38
const resizeObserverErr = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
    if (typeof message === 'string' && message.includes('ResizeObserver loop')) {
        return true; // Suppress the error
    }
    return resizeObserverErr ? resizeObserverErr(message, source!, lineno!, colno!, error!) : false;
};

// Also handle unhandledrejection for ResizeObserver errors that may come as promises
window.addEventListener('error', (e) => {
    if (e.message?.includes('ResizeObserver loop')) {
        e.stopImmediatePropagation();
    }
});

mount(() => <StartClient />, document.getElementById("app")!);
