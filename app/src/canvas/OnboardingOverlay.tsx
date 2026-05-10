import { useEffect, useState } from "react";

const STORAGE_KEY = "canvas:onboarding-dismissed-v1";

export function OnboardingOverlay() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY) === "1";
    setDismissed(seen);
  }, []);

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-end justify-center pb-8">
      <div className="pointer-events-auto max-w-md rounded-lg border border-neutral-700 bg-neutral-900/95 p-4 text-sm text-neutral-200 shadow-2xl backdrop-blur">
        <div className="mb-2 flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-neutral-100">
            How to read this graph
          </h3>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss onboarding"
            className="rounded p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
          >
            ✕
          </button>
        </div>
        <ul className="space-y-1.5 text-xs leading-relaxed">
          <li>
            <span className="inline-block size-2.5 rounded-full bg-pink-500 align-middle" />{" "}
            <span className="font-medium text-pink-300">Pink hubs</span> are
            research concepts curated from every partner profile.
          </li>
          <li>
            <span className="inline-block size-2 rounded-full bg-cyan-400 align-middle" />{" "}
            <span className="font-medium text-cyan-300">Cyan dots</span> are
            partners — they orbit the concepts they offer or seek.
          </li>
          <li>
            <span className="font-medium text-neutral-100">Click any node</span>{" "}
            to open its profile in the right pane. Drag to pan, scroll to zoom.
          </li>
          <li>
            Toggle{" "}
            <span className="font-medium text-neutral-100">
              Show offer→seek matches
            </span>{" "}
            in the left rail to overlay LLM-scored partner pairings.
          </li>
        </ul>
        <button
          type="button"
          onClick={dismiss}
          className="mt-3 w-full rounded bg-pink-500/20 py-1.5 text-xs font-medium text-pink-200 hover:bg-pink-500/30"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
