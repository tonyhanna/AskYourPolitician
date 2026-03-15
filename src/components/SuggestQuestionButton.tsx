"use client";

import { useState, useRef, useEffect } from "react";
import { submitSuggestion, directSuggestion } from "@/app/[partySlug]/[politicianSlug]/actions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark, faCircleInfo } from "@fortawesome/pro-duotone-svg-icons";

export function SuggestQuestionButton({
  politicianName,
  politicianFirstName,
  politicianId,
  partySlug,
  politicianSlug,
  hasSession,
}: {
  politicianName: string;
  politicianFirstName: string;
  politicianId: string;
  partySlug: string;
  politicianSlug: string;
  hasSession: boolean;
}) {
  const [active, setActive] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoDismissed, setInfoDismissed] = useState(false);

  const introStorageKey = `intro-dismissed:${politicianSlug}`;
  useEffect(() => {
    if (localStorage.getItem(introStorageKey) === "1") {
      setInfoDismissed(true);
    }
  }, [introStorageKey]);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      setText("");
      setActive(false);
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
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="text-green-700 hover:text-green-900 underline cursor-pointer"
          >
            Foreslå endnu et spørgsmål
          </button>
        </p>
      </div>
    );
  }

  const showExpanded = active && text.trim().length > 0;

  return (
    <div className="mb-6">
      {!infoDismissed && (
        <div className="relative bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 pr-10">
          <p className="text-base font-semibold text-gray-800 mb-1">Første gang du er her?</p>
          <ol className="text-sm text-gray-600 list-decimal pl-5 space-y-1">
            <li><strong>Upvote spørgsmål</strong> du synes er vigtige at få besvaret af {politicianFirstName}<br />eller <strong>foreslå dine egne spørgsmål</strong></li>
            <li>Når et spørgsmål når sit upvote mål vil {politicianFirstName} besvare det</li>
            <li>Alle svar er enten i video eller lyd</li>
            <li>Hvis du har upvoted spørgsmål, får du en e-mail</li>
          </ol>
          <button
            onClick={() => { setInfoDismissed(true); localStorage.setItem(introStorageKey, "1"); }}
            className="mt-3 bg-blue-600 text-white text-sm font-medium px-4 py-1.5 rounded-full hover:bg-blue-700 transition cursor-pointer"
          >
            Jeg forstår
          </button>
          <button
            onClick={() => { setInfoDismissed(true); localStorage.setItem(introStorageKey, "1"); }}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 cursor-pointer"
            aria-label="Luk"
          >
            <FontAwesomeIcon icon={faXmark} className="text-sm" />
          </button>
        </div>
      )}
      <form ref={formRef} action={handleSubmit} className="space-y-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            name="text"
            type="text"
            required
            maxLength={300}
            placeholder="Foreslå et spørgsmål..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setActive(true)}
            className={`bg-white border border-gray-300 rounded-full px-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${showExpanded ? "flex-1" : ""}`}
          />
          {showExpanded && (
            <button
              type="submit"
              disabled={pending}
              className="bg-blue-600 text-white py-2 px-4 rounded-full hover:bg-blue-700 transition font-medium text-sm disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
            >
              {pending ? "Sender..." : "Send forslag"}
            </button>
          )}
          {infoDismissed && !showExpanded && (
            <button
              type="button"
              onClick={() => { setInfoDismissed(false); localStorage.removeItem(introStorageKey); }}
              className="ml-auto text-blue-500 hover:text-blue-700 transition cursor-pointer shrink-0"
              aria-label="Vis information"
            >
              <FontAwesomeIcon icon={faCircleInfo} className="text-lg" />
            </button>
          )}
        </div>

        {showExpanded && !hasSession && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="suggestFirstName" className="block text-sm font-medium text-gray-700 mb-1">
                Fornavn
              </label>
              <input
                id="suggestFirstName"
                name="firstName"
                type="text"
                required
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="suggestEmail" className="block text-sm font-medium text-gray-700 mb-1">
                E-mail
              </label>
              <input
                id="suggestEmail"
                name="email"
                type="email"
                required
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="w-20">
              <label htmlFor="suggestAge" className="block text-sm font-medium text-gray-700 mb-1">
                Alder
              </label>
              <input
                id="suggestAge"
                name="age"
                type="number"
                min={1}
                max={150}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
