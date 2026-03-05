"use client";

import { useState } from "react";
import { submitSuggestion, directSuggestion } from "@/app/[partySlug]/[politicianSlug]/actions";

export function SuggestQuestionButton({
  politicianName,
  politicianId,
  partySlug,
  politicianSlug,
  hasSession,
}: {
  politicianName: string;
  politicianId: string;
  partySlug: string;
  politicianSlug: string;
  hasSession: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);

    formData.set("politicianId", politicianId);
    formData.set("politicianSlug", politicianSlug);
    formData.set("partySlug", partySlug);

    try {
      if (hasSession) {
        await directSuggestion(formData);
      } else {
        await submitSuggestion(formData);
      }
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Der opstod en fejl");
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <p className="text-green-800 font-medium">
          {hasSession
            ? "Tak! Dit forslag er sendt til " + politicianName + ". "
            : "Tjek din email for at bekræfte dit forslag. "}
          <button
            onClick={() => {
              setSuccess(false);
              setIsOpen(true);
            }}
            className="text-green-700 hover:text-green-900 underline cursor-pointer"
          >
            Foreslå endnu et spørgsmål
          </button>
        </p>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer transition mb-6 block"
      >
        Foreslå et spørgsmål
      </button>
    );
  }

  return (
    <div className="border border-blue-200 rounded-lg p-4 mb-6 bg-blue-50">
      <h3 className="font-medium text-gray-900 mb-3">
        Foreslå et spørgsmål
      </h3>
      <form action={handleSubmit} className="space-y-3">
        <div>
          <textarea
            name="text"
            required
            maxLength={300}
            rows={3}
            placeholder="Skriv dit spørgsmål her..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        {!hasSession && (
          <>
            <div>
              <label htmlFor="suggestFirstName" className="block text-sm font-medium text-gray-700 mb-1">
                Fornavn
              </label>
              <input
                id="suggestFirstName"
                name="firstName"
                type="text"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="suggestEmail" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                id="suggestEmail"
                name="email"
                type="email"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition font-medium text-sm disabled:opacity-50 cursor-pointer"
          >
            {pending ? "Sender..." : "Send forslag"}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
          >
            Annuller
          </button>
        </div>
      </form>
    </div>
  );
}
