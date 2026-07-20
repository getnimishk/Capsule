// shared/core/ui.js
// Safe DOM helpers and UI utilities to avoid innerHTML

window.CapsuleUI = (function() {
  function createSafeSVG(svgString, extraClasses = "") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString.trim(), 'image/svg+xml');
    const svgEl = doc.documentElement;
    if (svgEl.tagName.toLowerCase() !== 'svg') {
      return document.createTextNode(''); // Fallback if parsing fails
    }
    if (extraClasses) {
      svgEl.setAttribute('class', (svgEl.getAttribute('class') || '') + ' ' + extraClasses);
    }
    return svgEl;
  }

  function createButton({ text, iconSvg, title, onClick, className = "cc-action-btn" }) {
    const btn = document.createElement("button");
    btn.className = className;
    btn.type = "button";
    if (title) btn.title = title;
    
    // Accessibility
    btn.setAttribute("role", "button");
    btn.setAttribute("tabindex", "0");
    if (title) btn.setAttribute("aria-label", title);

    if (iconSvg) {
      btn.appendChild(createSafeSVG(iconSvg));
    }
    
    if (text) {
      const txtNode = document.createTextNode(text);
      btn.appendChild(txtNode);
    }

    if (onClick) {
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault(); // prevent input blur
        onClick(e);
      });
      // Keyboard support
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(e);
        }
      });
    }

    return btn;
  }

  function buildAIOption(ai, onSelect) {
    const opt = document.createElement("button");
    opt.className = "cc-ai-opt";
    opt.type = "button";
    
    // Accessibility
    opt.setAttribute("role", "button");
    opt.setAttribute("tabindex", "0");
    opt.setAttribute("aria-label", `Send context to ${ai.label}`);

    const icoSpan = document.createElement("span");
    icoSpan.className = "cc-ai-ico";
    icoSpan.style.background = ai.bg;
    icoSpan.appendChild(createSafeSVG(ai.svg));

    const textSpan = document.createElement("span");
    const lblSpan = document.createElement("span");
    lblSpan.className = "cc-ai-lbl";
    lblSpan.textContent = ai.label;
    
    const subSpan = document.createElement("span");
    subSpan.className = "cc-ai-sub";
    subSpan.textContent = "Open & inject context";

    textSpan.appendChild(lblSpan);
    textSpan.appendChild(subSpan);

    const arrowSvg = createSafeSVG(
      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
      </svg>`,
      "cc-arr"
    );
    arrowSvg.setAttribute("width", "11");
    arrowSvg.setAttribute("height", "11");

    opt.appendChild(icoSpan);
    opt.appendChild(textSpan);
    opt.appendChild(arrowSvg);

    opt.addEventListener("mousedown", (e) => {
      e.preventDefault();
      onSelect(ai);
    });
    opt.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(ai);
      }
    });

    return opt;
  }

  function injectCSS(cssText) {
    const s = document.createElement("style");
    s.textContent = cssText; // Safe: textContent for style tag is safe
    document.head.appendChild(s);
  }

  function showToast(msg) {
    let t = document.getElementById("cc-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "cc-toast";
      const s = document.createElement("style");
      s.textContent = \`
        #cc-toast {
          position: fixed; top: 16px; left: 50%; transform: translateX(-50%) translateY(-100%);
          background: hsl(var(--bg-100, 220 10% 15%)); color: hsl(var(--text-100, 0 0% 100%));
          padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 500;
          z-index: 2147483647; opacity: 0; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid hsl(var(--border-300, 220 10% 30%) / 0.5);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          pointer-events: none;
        }
        #cc-toast.cc-show {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
      \`;
      document.head.appendChild(s);
      document.body.appendChild(t);
    }
    // Safe assignment using textContent instead of innerHTML
    t.textContent = msg;
    t.classList.add("cc-show");
    setTimeout(() => { t.classList.remove("cc-show"); }, 3000);
  }

  return {
    createSafeSVG,
    createButton,
    buildAIOption,
    injectCSS,
    showToast
  };
})();
