import { createSignal, type Accessor } from 'solid-js';

/**
 * An enhanced accessor that also has set and update methods
 */
export interface EnhancedAccessor<T> extends Accessor<T> {
  /** Set a new value */
  set(value: T | ((prev: T) => T)): void;
  /** Update the value using a function */
  update(fn: (current: T) => T): void;
}

/**
 * An enhanced accessor with localStorage sync capability
 */
export interface LocalStorageAccessor<T> extends EnhancedAccessor<T> {
  /** Sync with localStorage (call this in onMount) */
  sync(): void;
}

/**
 * Creates a signal that returns an accessor with set/update methods attached.
 * Usage:
 *   const atom = createAtom(0);
 *   const value = atom();        // get current value
 *   atom.set(5);                 // set new value
 *   atom.update(x => x + 1);     // update with function
 */
export function createAtom<T>(initialValue: T): EnhancedAccessor<T> {
  const [getter, setter] = createSignal<T>(initialValue);

  // Augment the getter with set and update methods
  const enhancedGetter = getter as EnhancedAccessor<T>;
  enhancedGetter.set = setter;
  enhancedGetter.update = (fn: (current: T) => T) => {
    setter(() => fn(getter()));
  };

  return enhancedGetter;
}

/**
 * Creates a signal with custom equality function
 */
export function createAtomWithEquals<T>(
  initialValue: T,
  equals?: (prev: T, next: T) => boolean
): EnhancedAccessor<T> {
  const [getter, setter] = createSignal<T>(initialValue, { equals });

  const enhancedGetter = getter as EnhancedAccessor<T>;
  enhancedGetter.set = setter;
  enhancedGetter.update = (fn: (current: T) => T) => {
    setter(() => fn(getter()));
  };

  return enhancedGetter;
}

/**
 * Creates an atom that automatically persists to localStorage.
 * Always starts with initialValue to avoid SSR hydration issues.
 * Call .sync() in onMount to load the localStorage value.
 *
 * Usage:
 *   const isMinimized = createLocalStorageAtom('debug-panel-minimized', false);
 *   onMount(() => isMinimized.sync()); // Load from localStorage after mount
 *   const value = isMinimized();       // get current value
 *   isMinimized.set(true);             // set new value and persist to localStorage
 */
export function createLocalStorageAtom<T>(
  key: string,
  initialValue: T
): LocalStorageAccessor<T> {
  // Always start with initial value for SSR compatibility
  const [getter, setter] = createSignal<T>(initialValue);

  // Custom setter that also persists to localStorage
  const persistentSetter = (value: T | ((prev: T) => T)) => {
    setter(prev => {
      const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;

      // Persist to localStorage
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(key, JSON.stringify(newValue));
        } catch (error) {
          console.warn(`Failed to persist ${key} to localStorage:`, error);
        }
      }

      return newValue;
    });
  };

  // Sync function to load from localStorage
  const sync = () => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        const parsedValue = JSON.parse(stored);
        setter(parsedValue);
      }
    } catch (error) {
      console.warn(`Failed to sync ${key} from localStorage:`, error);
    }
  };

  // Augment the getter with set, update, and sync methods
  const enhancedGetter = getter as LocalStorageAccessor<T>;
  enhancedGetter.set = persistentSetter;
  enhancedGetter.update = (fn: (current: T) => T) => {
    persistentSetter(fn(getter()));
  };
  enhancedGetter.sync = sync;

  return enhancedGetter;
}

/**
 * Event listener type
 */
export type EventListener<T> = (event: T) => void;

/**
 * Event emitter interface
 */
export interface EventEmitter<T> {
  /** Add an event listener */
  on(listener: EventListener<T>): () => void;
  /** Remove an event listener */
  off(listener: EventListener<T>): void;
  /** Dispatch an event to all listeners */
  emit(event: T): void;
  /** Remove all listeners */
  clear(): void;
}

/**
 * Creates an event emitter that allows adding listeners and dispatching events.
 * Usage:
 *   const textEditEvent = createEvent<TextEditEvent>();
 *   const unsubscribe = textEditEvent.on(event => console.log(event));
 *   textEditEvent.emit({ type: 'insert', ... });
 *   unsubscribe(); // Remove listener
 */
export function createEvent<T>(): EventEmitter<T> {
  const listeners = new Set<EventListener<T>>();

  return {
    on(listener: EventListener<T>): () => void {
      listeners.add(listener);
      // Return unsubscribe function
      return () => {
        listeners.delete(listener);
      };
    },

    off(listener: EventListener<T>): void {
      listeners.delete(listener);
    },

    emit(event: T): void {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    },

    clear(): void {
      listeners.clear();
    }
  };
}
