"use client";

import { useState } from "react";

export function DismissibleIntro({ politicianFirstName }: { politicianFirstName: string }) {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return (
      <div className="mb-4">
        <button
          onClick={() => setVisible(true)}
          className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-serif font-bold hover:bg-blue-200 transition cursor-pointer"
          aria-label="Vis information"
        >
          i
        </button>
      </div>
    );
  }

  return (
    <div className="relative bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 pr-10">
      <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
        <li>Upvote spørgsmål du synes er vigtige at få besvaret af {politicianFirstName}</li>
        <li>Foreslå dine egne spørgsmål</li>
        <li>Alle svar er enten i video eller lyd</li>
      </ul>
      <button
        onClick={() => setVisible(false)}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 cursor-pointer"
        aria-label="Luk"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
