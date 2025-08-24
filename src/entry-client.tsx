// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

// Prevent backspace from navigating backwards when not in an input field
document.addEventListener("keydown", (event) => {
  if (event.key === "Backspace") {
    const target = event.target as HTMLElement;
    const isEditable = 
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.contentEditable === "true" ||
      target.isContentEditable;
    
    if (!isEditable) {
      event.preventDefault();
    }
  }
});

mount(() => <StartClient />, document.getElementById("app")!);
