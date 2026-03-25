"use client";

import { useState, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { faArrowUp as faArrowUpDuotone, faEnvelopeCircleCheck } from "@fortawesome/pro-duotone-svg-icons";
import { submitUpvote } from "@/app/[partySlug]/[politicianSlug]/actions";
import { useSystemColors } from "./SystemColorProvider";

type UpvoteModalProps = {
  questionId: string;
  questionText: string;
  partySlug: string;
  politicianSlug: string;
  partyColor?: string | null;
  partyColorDark?: string | null;
  partyColorLight?: string | null;
  redirectPath?: string | null;
  onClose: () => void;
};

type ModalPhase = "form" | "pending" | "emailSent" | "error";

export function UpvoteModal({
  questionId,
  questionText,
  partySlug,
  politicianSlug,
  partyColor,
  partyColorDark,
  partyColorLight,
  redirectPath,
  onClose,
}: UpvoteModalProps) {
  const systemColors = useSystemColors();
  const colorError = systemColors.error;
  const bgColor = partyColor || "#3B82F6";
  const nameColor = partyColorDark || systemColors.text0;
  const lightColor = partyColorLight || "#93C5FD";

  const [phase, setPhase] = useState<ModalPhase>("form");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: boolean; email?: boolean; emailInvalid?: boolean }>({});
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Auto-focus first input
  useEffect(() => { firstInputRef.current?.focus(); }, []);

  // Escape key closes (unless pending)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && phase !== "pending") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Validate
    const errors: { firstName?: boolean; email?: boolean; emailInvalid?: boolean } = {};
    if (!firstName.trim()) errors.firstName = true;
    if (!email.trim()) errors.email = true;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.emailInvalid = true;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setPhase("pending");
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("questionId", questionId);
    formData.set("politicianSlug", politicianSlug);
    formData.set("partySlug", partySlug);
    if (redirectPath) formData.set("redirectPath", redirectPath);

    try {
      const result = await submitUpvote(formData);
      if (result.error) {
        setError(result.error);
        setPhase("error");
      } else {
        setPhase("emailSent");
        window.dispatchEvent(new CustomEvent("upvote-submitted", { detail: { questionId } }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Der opstod en fejl");
      setPhase("error");
    }
  }

  const canClose = phase !== "pending";

  const inputStyle: React.CSSProperties = {
    color: nameColor,
    backgroundColor: "#ffffff",
    borderRadius: 9999,
    padding: "8px 20px",
    fontSize: "16px",
    outline: "none",
    width: "100%",
    fontFamily: "var(--font-figtree)",
    fontWeight: 500,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60]"
        style={{ backgroundColor: "#000000", opacity: 0.7 }}
        onClick={canClose ? onClose : undefined}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[61] flex items-start justify-center px-4 py-8 overflow-y-auto">
        <div
          className="relative w-full max-w-md p-6 space-y-3 my-auto"
          style={{ backgroundColor: bgColor, fontFamily: "var(--font-figtree)", fontWeight: 500, borderRadius: 10 }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <style>{`
            .upvote-modal-field::placeholder { color: var(--field-placeholder-color, ${nameColor}); opacity: var(--field-placeholder-opacity, 0.75); }
            .upvote-modal-age::-webkit-inner-spin-button,
            .upvote-modal-age::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
            .upvote-modal-age { -moz-appearance: textfield; }
          `}</style>

          {/* Title + close button row */}
          <div className="relative" style={{ marginBottom: 25 }}>
            <p className={`text-lg flex items-center gap-2 ${phase === "emailSent" ? "justify-center" : ""}`} style={{ color: nameColor, fontWeight: 600 }}>
              {phase !== "emailSent" && <FontAwesomeIcon icon={faArrowUpDuotone} style={{ color: nameColor }} />}
              {phase === "emailSent" ? "Tjek din e-mail" : "Upvote spørgsmål"}
            </p>
            {canClose && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-1/2 right-0 -translate-y-1/2 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                style={{ width: 24, height: 24, backgroundColor: `${nameColor}80` }}
                aria-label="Luk"
              >
                <FontAwesomeIcon icon={faXmark} style={{ color: lightColor, fontSize: "13.5px" }} />
              </button>
            )}
          </div>

          {phase === "emailSent" ? (
            <div className="text-center space-y-4 py-4">
              <FontAwesomeIcon icon={faEnvelopeCircleCheck} style={{ color: nameColor, fontSize: 48 }} />
              <p className="text-base" style={{ color: nameColor }}>
                Vi har sendt dig en bekræftelses-email. Klik på linket i emailen for at registrere din upvote.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3" noValidate>
              {/* Question text */}
              <p style={{ color: nameColor, fontSize: "32px", lineHeight: 1.2, fontWeight: 500 }}>
                {questionText}
              </p>

              <p className="text-base" style={{ color: nameColor, opacity: 0.5 }}>
                Alder er valgfri
              </p>

              {/* Fornavn + Alder row */}
              <div className="flex items-center gap-2">
                <input
                  ref={firstInputRef}
                  name="firstName"
                  type="text"
                  required
                  placeholder={fieldErrors.firstName ? "Fornavn skal udfyldes" : "Fornavn *"}
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setFieldErrors((prev) => ({ ...prev, firstName: undefined })); }}
                  className="upvote-modal-field min-w-0"
                  style={{
                    ...inputStyle,
                    flex: "75",
                    "--field-placeholder-color": fieldErrors.firstName ? colorError : nameColor,
                    "--field-placeholder-opacity": fieldErrors.firstName ? "1" : "0.75",
                  } as React.CSSProperties}
                />
                <input
                  name="age"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={3}
                  placeholder="Alder"
                  onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key)) e.preventDefault(); }}
                  onPaste={(e) => { const t = e.clipboardData.getData("text"); if (!/^\d+$/.test(t)) e.preventDefault(); }}
                  className="upvote-modal-field upvote-modal-age min-w-0"
                  style={{ ...inputStyle, flex: "25" }}
                />
              </div>

              {/* Email */}
              <div className="relative">
                <input
                  name="email"
                  type="email"
                  required
                  placeholder={fieldErrors.email ? "E-mail skal udfyldes" : "E-mail *"}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors((prev) => ({ ...prev, email: undefined, emailInvalid: undefined })); }}
                  className="upvote-modal-field"
                  style={{
                    ...inputStyle,
                    color: fieldErrors.emailInvalid ? colorError : nameColor,
                    "--field-placeholder-color": fieldErrors.email ? colorError : nameColor,
                    "--field-placeholder-opacity": fieldErrors.email ? "1" : "0.75",
                  } as React.CSSProperties}
                />
                {fieldErrors.emailInvalid && (
                  <span
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                    style={{ color: colorError, fontFamily: "var(--font-figtree)", fontWeight: 500 }}
                  >
                    Ukorrekt format
                  </span>
                )}
              </div>

              {/* Error message */}
              {(phase === "error" || error) && (
                <p className="text-sm" style={{ color: "#fee2e2" }}>{error}</p>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={phase === "pending"}
                className="w-full text-base px-5 py-2.5 rounded-full cursor-pointer disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: nameColor, color: "#ffffff", fontFamily: "var(--font-figtree)", fontWeight: 500 }}
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
