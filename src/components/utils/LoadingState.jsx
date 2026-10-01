import React from "react";
import { Loader2 } from "lucide-react";

// Shown instead of an empty-state message while a screen's data is still
// loading, so a first visit doesn't flash "nothing found".
export default function LoadingState({ className = "py-10" }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-stone-400 text-sm ${className}`} aria-busy="true">
      <Loader2 className="w-4 h-4 animate-spin" /> טוען…
    </div>
  );
}
