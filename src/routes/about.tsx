import { A } from "@solidjs/router";
import { createSignal } from "solid-js";
import Counter from "~/components/Counter";
import SimpleTextEditor from "~/modules/text-editor/SimpleTextEditor";
import DebugPanel from "~/components/DebugPanel";

export default function About() {
  const [content, setContent] = createSignal("");

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  return (
    <main class="mx-auto max-w-4xl text-gray-700 p-4">
      <h1 class="text-4xl text-sky-700 font-thin uppercase my-8 text-center">
        Text Editor Demo
      </h1>

      <div class="mb-8">
        <Counter />
      </div>

      <div class="space-y-6">
        <DebugPanel />

        <div>
          <h2 class="text-2xl font-semibold mb-4">Rich Text Editor</h2>
          <p class="text-gray-600 mb-4">
            This is a custom text editor built with SolidJS. It features:
            manual event handling, data model separation, undo/redo functionality,
            and is designed to support future features like annotations and inline widgets.
          </p>

          <SimpleTextEditor
            initialContent="Welcome to the text editor! Try typing, using Ctrl+Z to undo, and Ctrl+Y to redo. The editor maintains a complete data model of your content."
            placeholder="Start typing..."
            onContentChange={handleContentChange}
            class="mb-4"
          />
        </div>

        <div>
          <h3 class="text-lg font-semibold mb-2">Content Preview</h3>
          <div class="bg-gray-100 p-4 rounded border">
            <pre class="whitespace-pre-wrap text-sm">{content()}</pre>
          </div>
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
          and styled with UnoCSS
        </p>
        <p>
          <A href="/" class="text-sky-600 hover:underline">
            ← Back to Home
          </A>
        </p>
      </div>
    </main>
  );
}
