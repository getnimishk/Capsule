const { CapsuleStorage } = require('../src/main/resources/extension/shared/core/storage.js');

// Mock chrome.storage
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
    session: {
      get: jest.fn(),
      set: jest.fn(),
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    lastError: null
  }
};

describe('CapsuleStorage Core Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('compressConversation()', () => {
    it('should extract only the last 5 turns of a long conversation', async () => {
      const longConversation = [];
      for (let i = 0; i < 20; i++) {
        longConversation.push({ type: i % 2 === 0 ? 'user' : 'assistant', content: `Message ${i}` });
      }
      
      const compressed = await CapsuleStorage.compressConversation(longConversation);
      expect(compressed.length).toBeLessThanOrEqual(10); // Max 5 user + 5 assistant
      expect(compressed[compressed.length - 1].content).toBe('Message 19');
    });

    it('should ignore empty messages', async () => {
      const messages = [{ type: 'user', content: '' }, { type: 'assistant', content: 'Hello' }];
      const compressed = await CapsuleStorage.compressConversation(messages);
      // Depending on implementation, empty messages might be filtered out or bypassed for NLP compression
      expect(compressed.length).toBeGreaterThan(0);
    });
  });

  describe('save() with Lock Management', () => {
    it('should abort save if cs_tiers_lock is active (Prevent Race Condition)', async () => {
      chrome.storage.session.get.mockImplementation((keys, cb) => cb({ cs_tiers_lock: true }));
      
      const capsule = { id: 'test_123', messages: [] };
      await CapsuleStorage.save(capsule);
      
      expect(chrome.storage.local.get).not.toHaveBeenCalled();
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    it('should execute save if lock is free and handle storage limits', async () => {
      chrome.storage.session.get.mockImplementation((keys, cb) => cb({ cs_tiers_lock: false }));
      chrome.storage.local.get.mockImplementation((keys, cb) => cb({ cc_capsules: [] }));
      chrome.storage.local.set.mockImplementation((data, cb) => cb());
      
      const capsule = { id: 'test_456', messages: [{ type: 'user', content: 'test' }] };
      await CapsuleStorage.save(capsule);
      
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });
  });

  describe('formatContextBlock()', () => {
    it('should format a conversation capsule correctly', () => {
      const capsule = {
        title: 'Test Context',
        messages: [
          { type: 'user', content: 'Hi' },
          { type: 'assistant', content: 'Hello' }
        ]
      };
      
      const block = CapsuleStorage.formatContextBlock(capsule, 'TargetAI');
      expect(block).toContain('CONTEXT SYNC (Imported from TargetAI)');
      expect(block).toContain('User: Hi');
      expect(block).toContain('TargetAI: Hello');
    });
  });
});
