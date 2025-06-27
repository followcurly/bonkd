// State Manager - Centralized state management for Bonkd extension
class BonkdStateManager {
  constructor() {
    this.state = {
      currentBonkLevel: 2,
      lastUsedBonkLevel: null,
      hasBonkedContent: false,
      isBonkedVersion: true,
      elementCount: 0,
      isProcessing: false,
      isCheckingState: false
    };
    
    this.listeners = new Set();
    this.messagePromises = new Map();
    this.initialized = false;
  }

  // Subscribe to state changes
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Update state and notify listeners
  setState(updates) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    
    // Notify all listeners of state change
    this.listeners.forEach(callback => {
      try {
        callback(this.state, oldState);
      } catch (error) {
        console.error('State listener error:', error);
      }
    });
    
    // Auto-save certain state to storage
    this.saveToStorage(updates);
  }

  // Get current state
  getState() {
    return { ...this.state };
  }

  // Initialize state from storage and content script
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Load from storage
      await this.loadFromStorage();
      
      // Get current tab state
      await this.syncWithContentScript();
      
      this.initialized = true;
      console.log('🎯 State Manager initialized:', this.state);
    } catch (error) {
      console.error('State initialization error:', error);
      this.initialized = true; // Don't block UI
    }
  }

  // Load persistent state from chrome storage
  async loadFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(['bonkLevel'], (result) => {
        if (result.bonkLevel) {
          this.setState({ currentBonkLevel: result.bonkLevel });
        }
        resolve();
      });
    });
  }

  // Save state to chrome storage
  saveToStorage(updates) {
    if (updates.currentBonkLevel !== undefined) {
      chrome.storage.sync.set({ bonkLevel: updates.currentBonkLevel });
    }
  }

  // Sync with content script state
  async syncWithContentScript() {
    if (this.state.isCheckingState) return;
    
    this.setState({ isCheckingState: true });
    
    try {
      const response = await this.sendMessageToTab({ action: 'queryBonkedState' });
      
      if (response && response.elementCount !== undefined) {
        this.setState({
          hasBonkedContent: response.elementCount > 0,
          elementCount: response.elementCount,
          isBonkedVersion: response.isBonkedVersion || true,
          lastUsedBonkLevel: response.currentBonkLevel || this.state.currentBonkLevel,
          isProcessing: response.isActive || false
        });
      }
    } catch (error) {
      console.log('Content script not ready or no bonked content');
    } finally {
      this.setState({ isCheckingState: false });
    }
  }

  // Send message to current tab with promise
  sendMessageToTab(message, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const messageId = Date.now() + Math.random();
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
          reject(new Error('No active tab'));
          return;
        }

        const timeoutId = setTimeout(() => {
          this.messagePromises.delete(messageId);
          reject(new Error('Message timeout'));
        }, timeout);

        this.messagePromises.set(messageId, { resolve, reject, timeoutId });

        chrome.tabs.sendMessage(tabs[0].id, { ...message, messageId }, (response) => {
          const promise = this.messagePromises.get(messageId);
          if (!promise) return;

          clearTimeout(promise.timeoutId);
          this.messagePromises.delete(messageId);

          if (chrome.runtime.lastError) {
            promise.reject(new Error(chrome.runtime.lastError.message));
          } else {
            promise.resolve(response);
          }
        });
      });
    });
  }

  // Update bonk level with validation
  async setBonkLevel(level) {
    if (level < 1 || level > 3) {
      throw new Error('Invalid bonk level');
    }

    const oldLevel = this.state.currentBonkLevel;
    this.setState({ currentBonkLevel: level });

    // If content exists and level changed, this is a potential re-bonk
    if (this.state.hasBonkedContent && this.state.lastUsedBonkLevel !== level) {
      // Don't automatically re-bonk, just update UI state
      console.log(`Bonk level changed from ${oldLevel} to ${level} - re-bonk available`);
    }
  }

  // Toggle bonked text
  async toggleText() {
    if (!this.state.hasBonkedContent) {
      throw new Error('No bonked content to toggle');
    }

    try {
      const response = await this.sendMessageToTab({ action: 'toggleText' });
      
      if (response && response.success) {
        this.setState({
          isBonkedVersion: response.isBonkedVersion,
          elementCount: response.elementCount || this.state.elementCount
        });
        return true;
      } else {
        throw new Error('Toggle failed');
      }
    } catch (error) {
      console.error('Toggle error:', error);
      throw error;
    }
  }

  // Start bonking process
  async startBonking() {
    const isReBonk = this.state.hasBonkedContent && 
                     this.state.lastUsedBonkLevel !== this.state.currentBonkLevel;

    this.setState({ isProcessing: true });

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'bonk',
          bonkLevel: this.state.currentBonkLevel,
          isReBonk: isReBonk
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });

      if (!response?.success) {
        throw new Error('Failed to start bonking');
      }

      return true;
    } catch (error) {
      this.setState({ isProcessing: false });
      throw error;
    }
  }

  // Handle bonking completion
  onBonkComplete(elementCount) {
    this.setState({
      isProcessing: false,
      hasBonkedContent: true,
      elementCount: elementCount,
      isBonkedVersion: true,
      lastUsedBonkLevel: this.state.currentBonkLevel
    });
  }

  // Handle bonking error
  onBonkError() {
    this.setState({
      isProcessing: false
    });
  }

  // Clean up
  destroy() {
    this.listeners.clear();
    this.messagePromises.forEach(({ timeoutId, reject }) => {
      clearTimeout(timeoutId);
      reject(new Error('State manager destroyed'));
    });
    this.messagePromises.clear();
  }
}

// Initialize state manager
const stateManager = new BonkdStateManager();

document.addEventListener('DOMContentLoaded', function() {
  const bonkButton = document.getElementById('bonk-button');
  const buttonText = bonkButton.querySelector('.button-text');
  const buttonLoader = bonkButton.querySelector('.button-loader');
  const statusMessage = document.getElementById('status-message');
  const toggleSection = document.getElementById('toggle-section');
  const textToggle = document.getElementById('text-toggle');
  const elementCount = document.getElementById('element-count');

  // Bonk level elements
  const bonkLabels = document.querySelectorAll('.bonk-label');
  const sliderThumb = document.querySelector('.slider-thumb');
  const bonkDescriptions = document.querySelectorAll('.bonk-description');
  const sliderTrack = document.querySelector('.slider-track');

  // Add smooth entrance animation
  document.querySelector('.container').style.opacity = '0';
  document.querySelector('.container').style.transform = 'translateY(10px)';
  
  setTimeout(() => {
    document.querySelector('.container').style.transition = 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    document.querySelector('.container').style.opacity = '1';
    document.querySelector('.container').style.transform = 'translateY(0)';
  }, 50);

  // Subscribe to state changes
  const unsubscribe = stateManager.subscribe((newState, oldState) => {
    updateUI(newState, oldState);
  });

  // Initialize everything
  initializeApp();

  async function initializeApp() {
    try {
      await stateManager.initialize();
      initializeBonkLevelSelector();
      initializeToggle();
      initializeButton();
      initializeMessageListener();
    } catch (error) {
      console.error('App initialization error:', error);
    }
  }

  // Update UI based on state changes
  function updateUI(newState, oldState) {
    // Update bonk level selector
    if (newState.currentBonkLevel !== oldState.currentBonkLevel) {
      updateBonkLevelUI(newState.currentBonkLevel);
    }

    // Update toggle section
    if (newState.hasBonkedContent !== oldState.hasBonkedContent ||
        newState.elementCount !== oldState.elementCount ||
        newState.isBonkedVersion !== oldState.isBonkedVersion) {
      updateToggleSection(newState);
    }

    // Update button state
    if (newState.currentBonkLevel !== oldState.currentBonkLevel ||
        newState.lastUsedBonkLevel !== oldState.lastUsedBonkLevel ||
        newState.hasBonkedContent !== oldState.hasBonkedContent ||
        newState.isProcessing !== oldState.isProcessing) {
      updateButtonState(newState);
    }

    // Update loading state
    if (newState.isProcessing !== oldState.isProcessing) {
      if (newState.isProcessing) {
        setUiLoading('Starting...');
        toggleSection.style.display = 'none';
      }
    }
  }

  function updateBonkLevelUI(level) {
    // Update labels
    bonkLabels.forEach(label => {
      label.classList.toggle('active', parseInt(label.dataset.level) === level);
    });
    
    // Update slider thumb position
    sliderThumb.dataset.position = level;
    
    // Update descriptions
    bonkDescriptions.forEach(desc => {
      desc.classList.toggle('active', parseInt(desc.dataset.level) === level);
    });
    
    // Add pulse animation
    sliderThumb.style.transform = 'translateY(-50%) scale(1.2)';
    setTimeout(() => {
      sliderThumb.style.transform = 'translateY(-50%)';
    }, 200);
  }

  function updateToggleSection(state) {
    if (state.hasBonkedContent && state.elementCount > 0) {
      elementCount.textContent = state.elementCount;
      textToggle.checked = state.isBonkedVersion;
      toggleSection.style.display = 'block';
    } else {
      toggleSection.style.display = 'none';
    }
  }

  function updateButtonState(state) {
    if (state.isProcessing) {
      return; // Keep loading state
    }

    if (state.hasBonkedContent && state.lastUsedBonkLevel !== state.currentBonkLevel) {
      buttonText.textContent = `Re-bonk with ${getBonkLevelName(state.currentBonkLevel)}`;
      bonkButton.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';
    } else if (state.hasBonkedContent && state.lastUsedBonkLevel === state.currentBonkLevel) {
      buttonText.textContent = `✓ Bonked with ${getBonkLevelName(state.currentBonkLevel)}`;
      bonkButton.style.background = 'linear-gradient(135deg, #27ae60, #2ecc71)';
    } else {
      buttonText.textContent = 'Simplify Page';
      bonkButton.style.background = 'linear-gradient(135deg, var(--primary-color), #ff8a80)';
    }
  }

  function initializeBonkLevelSelector() {
    // Add click handlers to labels
    bonkLabels.forEach(label => {
      label.addEventListener('click', function() {
        const level = parseInt(this.dataset.level);
        stateManager.setBonkLevel(level);
      });
    });

    // Add click handler to slider track
    sliderTrack.addEventListener('click', function(e) {
      const rect = this.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const trackWidth = rect.width;
      const percentage = clickX / trackWidth;
      
      let level;
      if (percentage < 0.33) {
        level = 1;
      } else if (percentage < 0.67) {
        level = 2;
      } else {
        level = 3;
      }
      
      stateManager.setBonkLevel(level);
    });

    // Add drag functionality to slider thumb
    let isDragging = false;
    
    sliderThumb.addEventListener('mousedown', function(e) {
      isDragging = true;
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', function(e) {
      if (!isDragging) return;
      
      const rect = sliderTrack.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const trackWidth = rect.width;
      const percentage = Math.max(0, Math.min(1, clickX / trackWidth));
      
      let level;
      if (percentage < 0.33) {
        level = 1;
      } else if (percentage < 0.67) {
        level = 2;
      } else {
        level = 3;
      }
      
      stateManager.setBonkLevel(level);
    });
    
    document.addEventListener('mouseup', function() {
      isDragging = false;
    });
  }

  function initializeToggle() {
    textToggle.addEventListener('change', async function() {
      // Add smooth transition feedback
      const container = textToggle.closest('.toggle-switch-container');
      container.style.transform = 'scale(0.98)';
      setTimeout(() => {
        container.style.transform = 'scale(1)';
      }, 100);

      try {
        await stateManager.toggleText();
        addSuccessPulse();
      } catch (error) {
        // Restore original state on error
        textToggle.checked = !textToggle.checked;
        setUiError('Toggle failed. Content may not be available.');
      }
    });
  }

  function initializeButton() {
    bonkButton.addEventListener('click', async function() {
      // Add click animation
      bonkButton.style.transform = 'scale(0.95)';
      setTimeout(() => {
        bonkButton.style.transform = '';
      }, 150);

      try {
        await stateManager.startBonking();
      } catch (error) {
        setUiError('Failed to start. Try reloading the page.');
      }
    });
  }

  function initializeMessageListener() {
    // Listen for status updates from other scripts
    const messageListener = (request, sender, sendResponse) => {
      switch (request.action) {
        case 'updateStatus':
          setUiStatus(request.message);
          break;
        case 'bonkComplete':
          setUiSuccess(request.message);
          // Parse element count from message
          const match = request.message.match(/(\d+)\s+elements/);
          const elementCount = match ? parseInt(match[1]) : 0;
          stateManager.onBonkComplete(elementCount);
          break;
        case 'bonkError':
          setUiError(request.message);
          stateManager.onBonkError();
          break;
      }
      sendResponse({ received: true });
    };
    
    chrome.runtime.onMessage.addListener(messageListener);
    
    // Cleanup when popup closes
    window.addEventListener('beforeunload', () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      unsubscribe();
      stateManager.destroy();
    });
  }

  // Helper functions
  function getBonkLevelName(level) {
    const names = { 1: 'Little Bonk', 2: 'Bonk', 3: 'Big Bonk' };
    return names[level] || 'Bonk';
  }

  function addSuccessPulse() {
    if (toggleSection.style.display !== 'none') {
      toggleSection.style.transform = 'scale(1.02)';
      setTimeout(() => {
        toggleSection.style.transform = 'scale(1)';
      }, 200);
    }
  }

  function setUiLoading(message) {
    bonkButton.disabled = true;
    buttonText.style.display = 'none';
    buttonLoader.style.display = 'block';
    statusMessage.textContent = message;
    statusMessage.className = 'status loading';
    statusMessage.style.color = '#7f8c8d';
  }

  function setUiStatus(message) {
    statusMessage.textContent = message;
    statusMessage.className = 'status';
    statusMessage.style.color = '#7f8c8d';
  }

  function setUiSuccess(message) {
    bonkButton.disabled = false;
    buttonText.style.display = 'block';
    buttonLoader.style.display = 'none';
    statusMessage.textContent = message;
    statusMessage.className = 'status success';
    statusMessage.style.color = '#27ae60';
    
    // Add success animation to button
    bonkButton.style.transform = 'scale(1.05)';
    setTimeout(() => {
      bonkButton.style.transform = 'scale(1)';
    }, 300);
  }

  function setUiError(message) {
    bonkButton.disabled = false;
    buttonText.textContent = 'Try Again';
    buttonText.style.display = 'block';
    buttonLoader.style.display = 'none';
    statusMessage.textContent = message;
    statusMessage.className = 'status error';
    statusMessage.style.color = '#e74c3c';
    
    // Add error shake animation
    bonkButton.style.animation = 'shake 0.5s';
    setTimeout(() => {
      bonkButton.style.animation = '';
    }, 500);
  }
});

// Add shake animation for errors
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%, 20%, 40%, 60%, 80% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  }
`;
document.head.appendChild(style); 