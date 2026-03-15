"use client";

import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { faEnvelopeCircleCheck } from "@fortawesome/pro-duotone-svg-icons";
import { submitUpvote } from "@/app/[partySlug]/[politicianSlug]/actions";

type UpvoteModalProps = {
  questionId: string;
  partySlug: string;
  politicianSlug: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  partyColorLight?: string | null;
  onClose: () => void;
};

type ModalPhase = "form" | "pending" | "emailSent" | "error";

export function UpvoteModal({
  questionId,
  partySlug,
  politicianSlug,
  partyColor,
  partyColorDark,
  partyColorLight,
  onClose,
}: UpvoteModalProps) {
  const dark = partyColorDark || "#1E3A5F";
  const light = partyColorLight || "#DBEAFE";
  const primary = partyColor || "#3B82F6";

  const [phase, setPhase] = useState<ModalPhase>("form");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Auto-focus first input
  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  // Escape key closes (unless pending)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && phase !== "pending") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPhase("pending");
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("questionId", questionId);
    formData.set("politicianSlug", politicianSlug);
    formData.set("partySlug", partySlug);

    try {
      const result = await submitUpvote(formData);
      if (result.error) {
        setError(result.error);
        setPhase("error");
      } else {
        setPhase("emailSent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Der opstod en fejl");
      setPhase("error");
    }
  }

  const canClose = phase !== "pending";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    backgroundColor: "#ffffff",
    border: `1.5px solid ${dark}40`,
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 16, // Must be >= 16px to prevent iOS Safari auto-zoom on focus
    color: dark,
    fontFamily: "var(--font-figtree)",
    outline: "none",
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60]"
        style={{ backgroundColor: `${dark}B3` }}
        onClick={canClose ? onClose : undefined}
      />

      {/* Centered container */}
      <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none px-4">
        {/* Modal panel */}
        <div
          className="pointer-events-auto w-full max-w-sm rounded-2xl p-6 relative"
          style={{
            backgroundColor: light,
            color: dark,
            fontFamily: "var(--font-figtree)",
          }}
          role="dialog"
          aria-modal="true"
        >
          {/* Close button */}
          {canClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 cursor-pointer hover:opacity-60 transition"
              aria-label="Luk"
              style={{ color: dark }}
            >
              <FontAwesomeIcon icon={faXmark} className="text-lg" />
            </button>
          )}

          {phase === "emailSent" ? (
            /* ── Success state ── */
            <div className="text-center space-y-4">
              <FontAwesomeIcon icon={faEnvelopeCircleCheck} className="text-4xl" style={{ color: dark }} />
              <h2
                className="text-xl"
                style={{ fontWeight: 700, color: dark }}
              >
                Tjek din email
              </h2>
              <p className="text-sm" style={{ color: dark, opacity: 0.8 }}>
                Vi har sendt dig en bekræftelses-email. Klik på linket i emailen
                for at registrere din upvote.
              </p>
            </div>
          ) : (
            /* ── Form state ── */
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
              <h2
                className="text-lg pr-6"
                style={{ fontWeight: 700, color: dark }}
              >
                Upvote spørgsmål
              </h2>

              <div>
                <label
                  htmlFor="modal-firstName"
                  className="block text-sm mb-1"
                  style={{ fontWeight: 500, color: dark }}
                >
                  Fornavn
                </label>
                <input
                  ref={firstInputRef}
                  id="modal-firstName"
                  name="firstName"
                  type="text"
                  required
                  style={inputStyle}
                  onFocus={(e) =>
                    (e.currentTarget.style.boxShadow = `0 0 0 2px ${primary}`)
                  }
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                />
              </div>

              <div>
                <label
                  htmlFor="modal-email"
                  className="block text-sm mb-1"
                  style={{ fontWeight: 500, color: dark }}
                >
                  E-mail
                </label>
                <input
                  id="modal-email"
                  name="email"
                  type="email"
                  required
                  style={inputStyle}
                  onFocus={(e) =>
                    (e.currentTarget.style.boxShadow = `0 0 0 2px ${primary}`)
                  }
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                />
              </div>

              <div>
                <label
                  htmlFor="modal-age"
                  className="block text-sm mb-1"
                  style={{ fontWeight: 500, color: dark }}
                >
                  Alder{" "}
                  <span style={{ fontWeight: 400, opacity: 0.6 }}>
                    (valgfrit)
                  </span>
                </label>
                <input
                  id="modal-age"
                  name="age"
                  type="number"
                  min={1}
                  max={150}
                  style={inputStyle}
                  onFocus={(e) =>
                    (e.currentTarget.style.boxShadow = `0 0 0 2px ${primary}`)
                  }
                  onBlur={(e) => (e.currentTarget.style.boxShadow = "none")}
                />
              </div>

              {(phase === "error" || error) && (
                <p className="text-sm" style={{ color: "#DC2626" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={phase === "pending"}
                className="w-full py-3 rounded-xl cursor-pointer hover:opacity-80 transition disabled:opacity-50"
                style={{
                  backgroundColor: dark,
                  color: "#ffffff",
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {phase === "pending" ? "Sender..." : "Upvote"}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
