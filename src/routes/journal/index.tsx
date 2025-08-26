import { createSignal } from "solid-js";
import { useNavigate } from "@solidjs/router";

export default function JournalIndexPage() {
  const navigate = useNavigate();

  // Create new journal entry and navigate to it
  const createNewEntry = async () => {
    const newEntryId = `journal-${Date.now()}`;
    navigate(`/journal/${newEntryId}`);
  };

  return (
    <div class="flex-1 flex items-center justify-center text-gray-500">
      <div class="text-center max-w-md">
        <h2 class="text-2xl font-semibold mb-4">
          Bienvenido a tu Diario en Español
        </h2>
        <p class="mb-6 text-gray-600">
          Selecciona una entrada existente de la barra lateral o crea una nueva para empezar a escribir.
          Usa <kbd class="px-2 py-1 bg-gray-100 rounded text-sm font-mono">Tab</kbd> para obtener correcciones
          y <kbd class="px-2 py-1 bg-gray-100 rounded text-sm font-mono">Shift+Enter</kbd> para ayuda gramatical.
        </p>
        <button
          onClick={createNewEntry}
          class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Crear Nueva Entrada
        </button>
      </div>
    </div>
  );
}