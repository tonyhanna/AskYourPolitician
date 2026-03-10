"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy } from "@fortawesome/pro-duotone-svg-icons";

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function CopyLinkButton({ url, title, compact = false, partyColor }: { url: string; title?: string; compact?: boolean; partyColor?: string | null }) {
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

  if (compact) {
    return (
      <button
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 text-xs py-1.5 pr-3 cursor-pointer transition hover:opacity-70"
        style={{ color: partyColor || "#3B82F6" }}
      >
        <FontAwesomeIcon icon={faCopy} className="text-xs" />
        {copied ? "Kopieret!" : "Del"}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full cursor-pointer transition hover:opacity-70"
      style={{ backgroundColor: "#E8E7E5", color: partyColor || "#3B82F6" }}
    >
      <FontAwesomeIcon icon={faCopy} className="text-xs" />
      {copied ? "Kopieret!" : "Kopier link"}
    </button>
  );
}
