// shared/api_hook.js
// Injected into the page context (MAIN world) to intercept raw API responses
// for lossless conversation capturing across all supported AI platforms.
//
// IMPORTANT: This hook runs in MAIN world alongside the page's own JavaScript.
// It MUST pass through all non-AI fetch calls completely untouched and silently.
// Any interception of third-party URLs (ads, analytics, etc.) will violate the
// page's Content Security Policy and flood the console with errors.

(function() {
  if (window.__Capsule_hooked__) return;
  window.__Capsule_hooked__ = true;

  // ── Trusted AI API URL patterns ──────────────────────────────────────────────
  // Only intercept requests to these specific paths on known AI domains.
  // Patterns are matched BEFORE the request executes — all other URLs are
  // passed through immediately with zero interception or logging.
  const AI_URL_PATTERNS = [
    /claude\.ai\/api\/organizations\//,
    /chatgpt\.com\/backend-api\/conversation\//,
    /chat\.deepseek\.com\/api\/v\d+\/chat\//,
    /perplexity\.ai\/api\/thread\//,
    /chat\.mistral\.ai\/chat\/conversations\//,
    /kimi\.ai\/api\/chat\//,
    /x\.com\/i\/api\/graphql\//,
    /api\.x\.com\/graphql\//,
  ];

  function isAIUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try { return AI_URL_PATTERNS.some(p => p.test(url)); }
    catch { return false; }
  }

  function dispatchCapture(url, json) {
    window.postMessage({ type: 'Capsule_API_CAPTURE', url, data: json }, '*');
  }

  // ── Hook Fetch (via Proxy) ────────────────────────────────────────────────────
  // Using a Proxy instead of direct assignment keeps the original function's
  // identity intact. This makes non-AI fetch calls truly transparent in
  // Chrome DevTools — Gemini's own ad/analytics CSP errors no longer show
  // api_hook.js in the stack trace for unrelated third-party requests.
  const _originalFetch = window.fetch;
  window.fetch = new Proxy(_originalFetch, {
    apply(target, thisArg, args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url ?? '');

      // Non-AI URL: delegate entirely to the original fetch — zero interception.
      if (!isAIUrl(url)) {
        return Reflect.apply(target, thisArg, args);
      }

      // AI URL: intercept, capture JSON payload, then return the real response.
      return Reflect.apply(target, thisArg, args).then(response => {
        try {
          response.clone().json().then(json => dispatchCapture(url, json)).catch(() => {});
        } catch { /* streaming / non-JSON — ignore */ }
        return response;
      });
    }
  });

  // ── Hook XMLHttpRequest ───────────────────────────────────────────────────────
  // Only attach a load listener for requests that target a known AI endpoint.
  // The isAIUrl() check happens in open() so send() adds zero overhead for
  // unrelated XHR calls (analytics, ads, Gemini UI framework calls, etc.).
  const _originalOpen = XMLHttpRequest.prototype.open;
  const _originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    // Store the resolved URL only if it's an AI endpoint; null otherwise.
    this.__capsuleUrl = isAIUrl(typeof url === 'string' ? url : '') ? url : null;
    return _originalOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    if (this.__capsuleUrl) {
      const captureUrl = this.__capsuleUrl;
      this.addEventListener('load', function() {
        try {
          const json = JSON.parse(this.responseText);
          dispatchCapture(captureUrl, json);
        } catch { /* non-JSON response — ignore */ }
      });
    }
    return _originalSend.apply(this, args);
  };
})();
