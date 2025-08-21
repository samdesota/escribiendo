import { useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";

export default function Home() {
  const navigate = useNavigate();

  onMount(() => {
    // Redirect to chat immediately
    navigate("/chat", { replace: true });
  });

  return (
    <div class="h-screen flex items-center justify-center bg-gray-50">
      <div class="text-center">
        <div class="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p class="text-gray-600">Redirecting to Chat...</p>
      </div>
    </div>
  );
}
