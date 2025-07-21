import { For, onMount } from 'solid-js';
import { logger, LOG_CATEGORIES } from '~/utils/logger';
import { createLocalStorageAtom } from '~/utils/signal';

export default function DebugPanel() {
  const isMinimized = createLocalStorageAtom('debug-panel-minimized', false);

  // Sync with localStorage after mount to avoid SSR hydration issues
  onMount(() => {
    isMinimized.sync();
  });

  const toggleCategory = (category: string) => {
    const current = Array.from(logger.categories());
    if (current.includes(category)) {
      logger.disable(category);
    } else {
      logger.enable(category);
    }
  };

  const enableAll = () => {
    logger.enableAll();
  };

  const disableAll = () => {
    logger.disableAll();
  };

  const clearLogs = () => {
    logger.clearLogs();
  };

  const categories = Object.values(LOG_CATEGORIES);

  return (
    <div class="fixed bottom-0 left-0 right-0 z-50 bg-gray-50 border-t border-gray-300 shadow-lg">
      {/* Header bar - always visible */}
      <div class="flex items-center justify-between p-2 bg-gray-100">
        <h3 class="text-sm font-semibold">Debug Logger</h3>
        <button
          onClick={() => isMinimized.set(!isMinimized())}
          class="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-xs border"
        >
          {isMinimized() ? '▲' : '▼'}
        </button>
      </div>

      {/* Expandable content */}
      {!isMinimized() && (
        <div class="p-3 space-y-3">
          {/* Control buttons */}
          <div class="flex gap-2">
            <button
              onClick={enableAll}
              class="px-3 py-1 bg-green-200 hover:bg-green-300 rounded text-sm border"
            >
              Enable All
            </button>
            <button
              onClick={disableAll}
              class="px-3 py-1 bg-red-200 hover:bg-red-300 rounded text-sm border"
            >
              Disable All
            </button>
            <button
              onClick={clearLogs}
              class="px-3 py-1 bg-blue-200 hover:bg-blue-300 rounded text-sm border"
            >
              Clear Logs
            </button>
          </div>

          {/* Categories */}
          <div>
            <h4 class="font-medium mb-2 text-sm">Log Categories:</h4>
            <div class="grid grid-cols-3 gap-2">
              <For each={categories}>
                {(category) => {
                  const isEnabled = () => logger.isEnabled(category);

                  return (
                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isEnabled()}
                        onChange={() => toggleCategory(category)}
                        class="rounded"
                      />
                      <span>
                        {category}
                      </span>
                    </label>
                  );
                }}
              </For>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
