// shared/core/observer.js
// Throttled DOM MutationObserver

window.CapsuleObserver = (function() {
  let _observer = null;
  
  function start(callback, options = { childList: true, subtree: true, characterData: true }) {
    if (_observer) return;
    
    // Default debounce: 300ms
    let _timeout = null;
    
    _observer = new MutationObserver((mutations) => {
      // Only fire if meaningful nodes added or text changed
      if (mutations.some((m) => m.addedNodes.length > 0 || m.type === "characterData")) {
        clearTimeout(_timeout);
        _timeout = setTimeout(() => {
          callback(mutations);
        }, 300);
      }
    });
    
    _observer.observe(document.body, options);
  }

  function stop() {
    if (_observer) {
      _observer.disconnect();
      _observer = null;
    }
  }

  return { start, stop };
})();
