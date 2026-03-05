"use client";

import { useState } from "react";

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function CopyLinkButton({ url, title, compact = false }: { url: string; title?: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    if (isMobile() && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleClick}
      className={compact
        ? "text-sm text-gray-400 hover:text-gray-600 cursor-pointer transition"
        : "bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer"
      }
    >
      {copied ? (compact ? "Link kopieret!" : "Kopieret!") : (compact ? "Del" : "Kopier link")}
    </button>
  );
}
