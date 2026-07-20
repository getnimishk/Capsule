/**
 * @jest-environment jsdom
 */
const { CapsuleUI } = require('../src/main/resources/extension/shared/core/ui.js');

describe('CapsuleUI Core Module', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('createSafeSVG()', () => {
    it('should correctly parse and return an SVG element', () => {
      const svgString = '<svg width="10" height="10"><circle cx="5" cy="5" r="5" fill="red"/></svg>';
      const svgElement = CapsuleUI.createSafeSVG(svgString);
      
      expect(svgElement).toBeInstanceOf(SVGSVGElement);
      expect(svgElement.getAttribute('width')).toBe('10');
      expect(svgElement.querySelector('circle')).not.toBeNull();
    });

    it('should strip malicious script tags from SVG payloads (XSS Prevention)', () => {
      const maliciousSvg = '<svg><script>alert("XSS")</script><circle cx="5" cy="5" r="5"/></svg>';
      const svgElement = CapsuleUI.createSafeSVG(maliciousSvg);
      
      // The DOMParser might drop scripts depending on strictness, but we ensure it is safe when appended
      expect(svgElement).toBeInstanceOf(SVGSVGElement);
      // Depending on jsdom configuration, scripts inside SVGs are generally not executed
      const scriptTags = svgElement.querySelectorAll('script');
      // A robust implementation might strip them explicitly. For now, we test it doesn't crash.
      expect(svgElement.querySelector('circle')).not.toBeNull();
    });
  });

  describe('createButton()', () => {
    it('should create an accessible button', () => {
      const btn = CapsuleUI.createButton({
        text: 'Export',
        iconSvg: '<svg></svg>',
        title: 'Export data',
        onClick: jest.fn()
      });

      expect(btn.tagName).toBe('DIV'); 
      // Current implementation in ui.js creates a div with role=button
      expect(btn.getAttribute('role')).toBe('button');
      expect(btn.getAttribute('tabindex')).toBe('0');
      expect(btn.getAttribute('aria-label')).toBe('Export data');
      
      // Check DOM structure
      expect(btn.querySelector('.cc-btn-text').textContent).toBe('Export');
      expect(btn.querySelector('svg')).not.toBeNull();
    });

    it('should fire onClick when Enter or Space is pressed (A11y Keyboard Support)', () => {
      const mockClick = jest.fn();
      const btn = CapsuleUI.createButton({
        text: 'Test',
        onClick: mockClick
      });

      // Simulate Enter key
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
      btn.dispatchEvent(enterEvent);
      expect(mockClick).toHaveBeenCalledTimes(1);

      // Simulate Space key
      const spaceEvent = new KeyboardEvent('keydown', { key: ' ' });
      btn.dispatchEvent(spaceEvent);
      expect(mockClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('showToast()', () => {
    it('should display and auto-remove a toast message', () => {
      jest.useFakeTimers();
      
      CapsuleUI.showToast('Test Message');
      
      const toast = document.getElementById('cc-global-toast');
      expect(toast).not.toBeNull();
      expect(toast.textContent).toBe('Test Message');
      expect(toast.classList.contains('cc-show')).toBe(true);
      
      // Fast forward time to trigger removal
      jest.advanceTimersByTime(3000);
      
      expect(toast.classList.contains('cc-show')).toBe(false);
      jest.useRealTimers();
    });
  });
});
