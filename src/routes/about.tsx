import { A } from "@solidjs/router";

export default function About() {
  return (
    <main class="mx-auto max-w-4xl text-gray-700 p-4">
      <h1 class="text-4xl text-sky-700 font-thin uppercase my-8 text-center">
        Spanish Chat Experiment
      </h1>

      <div class="space-y-6">
        <div class="bg-white p-6 rounded-lg shadow-sm border">
          <h2 class="text-2xl font-semibold mb-4">About This App</h2>
          <p class="text-gray-600 mb-4">
            This is an experimental Spanish learning chat application built with SolidJS. 
            It helps you practice Spanish conversation with AI-powered suggestions.
          </p>

          <h3 class="text-lg font-semibold mb-3">Features:</h3>
          <ul class="list-disc list-inside space-y-2 text-gray-600 mb-4">
            <li><strong>Smart Suggestions:</strong> Press Tab while typing to get Spanish suggestions for your text</li>
            <li><strong>Natural Conversation:</strong> Chat naturally in Spanish with streaming AI responses</li>
            <li><strong>Grammar Help:</strong> Press Shift+Enter to discuss grammar and language rules</li>
            <li><strong>Spain Focus:</strong> All suggestions and corrections use Spanish from Spain (Peninsular Spanish)</li>
            <li><strong>Multiple Chats:</strong> Create and manage multiple conversation threads</li>
          </ul>

          <h3 class="text-lg font-semibold mb-3">How to Use:</h3>
          <ol class="list-decimal list-inside space-y-2 text-gray-600">
            <li>Type something like "quiero algo con cool socks"</li>
            <li>Press <kbd class="px-1 py-0.5 bg-gray-100 rounded text-xs">Tab</kbd> to get a Spanish suggestion</li>
            <li>Press <kbd class="px-1 py-0.5 bg-gray-100 rounded text-xs">Tab</kbd> again to accept or <kbd class="px-1 py-0.5 bg-gray-100 rounded text-xs">Esc</kbd> to cancel</li>
            <li>Send your message and receive AI responses in Spanish</li>
            <li>Use <kbd class="px-1 py-0.5 bg-gray-100 rounded text-xs">Shift+Enter</kbd> to ask about grammar</li>
          </ol>
        </div>
      </div>

      <div class="mt-8 text-center">
        <p class="text-sm text-gray-500 mb-4">
          Built with{" "}
          <a
            href="https://solidjs.com"
            target="_blank"
            class="text-sky-600 hover:underline"
          >
            SolidJS
          </a>{" "}
          and powered by Claude AI
        </p>
        <p>
          <A href="/chat" class="text-sky-600 hover:underline">
            → Start Chatting
          </A>
        </p>
      </div>
    </main>
  );
}
