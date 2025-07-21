// Debug Logger Utility
import { type Accessor } from 'solid-js';
import { createAtom, type EnhancedAccessor } from './signal';

interface LogEntry {
  timestamp: number;
  category: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: any;
}

class DebugLogger {
  private enabledCategories = createAtom(new Set<string>());
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private readonly STORAGE_KEY = 'debug-logger-categories';

  constructor() {
    this.loadFromStorage();
  }

  // Public getter for enabled categories
  get categories(): Accessor<Set<string>> {
    return this.enabledCategories;
  }

  // Save enabled categories to localStorage
  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const categories = Array.from(this.enabledCategories());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(categories));
    } catch (error) {
      console.warn('Failed to save debug logger configuration to localStorage:', error);
    }
  }

  // Load enabled categories from localStorage
  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const categories: string[] = JSON.parse(stored);
        const newSet = new Set<string>();
        categories.forEach(cat => newSet.add(cat));
        this.enabledCategories.set(newSet);
        if (categories.length > 0) {
          console.log(`🔧 Debug logging restored for: ${categories.join(', ')}`);
        }
      }
    } catch (error) {
      console.warn('Failed to load debug logger configuration from localStorage:', error);
    }
  }

  // Enable logging for specific categories
  enable(...categories: string[]): void {
    this.enabledCategories.update(current => {
      const updated = new Set(current);
      categories.forEach(cat => updated.add(cat));
      return updated;
    });
    this.saveToStorage();
    console.log(`🔧 Debug logging enabled for: ${categories.join(', ')}`);
  }

  // Disable logging for specific categories
  disable(...categories: string[]): void {
    this.enabledCategories.update(current => {
      const updated = new Set(current);
      categories.forEach(cat => updated.delete(cat));
      return updated;
    });
    this.saveToStorage();
    console.log(`🔧 Debug logging disabled for: ${categories.join(', ')}`);
  }

  // Enable all logging
  enableAll(): void {
    this.enabledCategories.set(new Set<string>(Object.values(LOG_CATEGORIES)));
    this.saveToStorage();
    console.log('🔧 Debug logging enabled for ALL categories');
  }

  // Disable all logging
  disableAll(): void {
    this.enabledCategories.set(new Set<string>());
    this.saveToStorage();
    console.log('🔧 Debug logging disabled for ALL categories');
  }

  // Check if a category is enabled
  isEnabled(category: string): boolean {
    const categories = this.enabledCategories();
    return categories.has(category);
  }

  // Log a message
  private log(level: 'debug' | 'info' | 'warn' | 'error', category: string, message: string, data?: any): void {
    if (!this.isEnabled(category)) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      category,
      level,
      message,
      data
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const emoji = {
      debug: '🐛',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    }[level];

    const prefix = `${emoji} [${timestamp}] [${category}]`;

    if (data !== undefined) {
      console[level === 'debug' ? 'log' : level](`${prefix} ${message}`, data);
    } else {
      console[level === 'debug' ? 'log' : level](`${prefix} ${message}`);
    }
  }

  // Logging methods
  debug(category: string, message: string, data?: any): void {
    this.log('debug', category, message, data);
  }

  info(category: string, message: string, data?: any): void {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: any): void {
    this.log('error', category, message, data);
  }

  // Get recent logs
  getRecentLogs(count = 50): LogEntry[] {
    return this.logs.slice(-count);
  }

  // Clear logs
  clearLogs(): void {
    this.logs = [];
    console.log('🔧 Debug logs cleared');
  }

  // Show current configuration
  showConfig(): void {
    console.log('🔧 Debug Logger Configuration:');
    console.log('  Enabled categories:', Array.from(this.enabledCategories()));
    console.log('  Total logs stored:', this.logs.length);
  }
}

// Create singleton instance
export const logger = new DebugLogger();

// Predefined categories for the text editor
export const LOG_CATEGORIES = {
  EDITOR_STATE: 'editor-state',
  EDITOR_COMPONENT: 'editor-component',
  EDITOR_EVENTS: 'editor-events',
  EDITOR_SIGNALS: 'editor-signals',
  EDITOR_DOM: 'editor-dom',
  EDITOR_SYNC: 'editor-sync',
  EDITOR_HISTORY: 'editor-history',
  GENERAL: 'general'
} as const;

// Helper functions for common logging patterns
export const logSignalChange = (category: string, signalName: string, oldValue: any, newValue: any) => {
  logger.debug(category, `Signal ${signalName} changed`, {
    from: oldValue,
    to: newValue,
    type: 'signal-change'
  });
};

export const logEffect = (category: string, effectName: string, dependencies?: any) => {
  logger.debug(category, `Effect ${effectName} triggered`, {
    dependencies,
    type: 'effect-trigger'
  });
};

export const logMethodCall = (category: string, methodName: string, args?: any[], result?: any) => {
  logger.debug(category, `Method ${methodName} called`, {
    args,
    result,
    type: 'method-call'
  });
};

// Global debug helpers (available in console)
declare global {
  interface Window {
    debugLogger: {
      enable: (...categories: string[]) => void;
      disable: (...categories: string[]) => void;
      enableAll: () => void;
      disableAll: () => void;
      showConfig: () => void;
      clearLogs: () => void;
      categories: typeof LOG_CATEGORIES;
    };
  }
}

// Expose to window for console debugging
if (typeof window !== 'undefined') {
  window.debugLogger = {
    enable: (...categories: string[]) => logger.enable(...categories),
    disable: (...categories: string[]) => logger.disable(...categories),
    enableAll: () => logger.enableAll(),
    disableAll: () => logger.disableAll(),
    showConfig: () => logger.showConfig(),
    clearLogs: () => logger.clearLogs(),
    categories: LOG_CATEGORIES
  };
}
