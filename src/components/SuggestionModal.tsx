"use client";

import { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { faCommentPlus } from "@fortawesome/pro-solid-svg-icons";
import { faEnvelopeCircleCheck } from "@fortawesome/pro-duotone-svg-icons";
import { submitSuggestion, directSuggestion } from "@/app/[partySlug]/[politicianSlug]/actions";


type SuggestionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialText: string;
  politicianId: string;
  politicianSlug: string;
  partySlug: string;
  hasSession: boolean;
  redirectPath?: string | null;
  onSuccess: () => void;
};

export function SuggestionModal({
  isOpen,
  onClose,
  initialText,
  politicianId,
  politicianSlug,
  partySlug,
  hasSession,
  redirectPath,
  onSuccess,
}: SuggestionModalProps) {
  // Party colors from CSS variables
  const pp = "var(--party-primary, #FF0000)";
  const pd = "var(--party-dark, #FF0000)";
  const pl = "var(--party-light, #FF0000)";

  const [phase, setPhase] = useState<"form" | "emailSent">("form");
  const [text, setText] = useState(initialText);
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: boolean; email?: boolean; emailInvalid?: boolean }>({});

  const textRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when modal opens with new initialText
  useEffect(() => {
    if (isOpen) {
      setPhase("form");
      setText(initialText);
      setFirstName("");
      setEmail("");
      setError(null);
      setFieldErrors({});
      setPending(false);
      // Focus text field after render, cursor at end, auto-expand
      setTimeout(() => {
        const el = textRef.current;
        if (el) {
          el.focus();
          el.selectionStart = el.selectionEnd = el.value.length;
          el.style.height = "auto";
          el.style.height = el.scrollHeight + "px";
        }
      }, 50);
    }
  }, [isOpen, initialText]);

  // Close on Escape + lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!text.trim()) return;

    // Validate identity fields for non-logged-in users
    if (!hasSession) {
      const errors: { firstName?: boolean; email?: boolean; emailInvalid?: boolean } = {};
      if (!firstName.trim()) errors.firstName = true;
      if (!email.trim()) errors.email = true;
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.emailInvalid = true;
      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
    }

    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("text", text);
    formData.set("politicianId", politicianId);
    formData.set("politicianSlug", politicianSlug);
    formData.set("partySlug", partySlug);
    if (redirectPath) formData.set("redirectPath", redirectPath);

    try {
      if (hasSession) {
        await directSuggestion(formData);
        onSuccess();
        onClose();
      } else {
        await submitSuggestion(formData);
        setPhase("emailSent");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Der opstod en fejl");
    } finally {
      setPending(false);
    }
  }

  const inputStyle = {
    color: "var(--system-form-text0, #FF0000)",
    backgroundColor: "var(--system-form-bg, #FF0000)",
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
        style={{ backgroundColor: "var(--system-overlay, #FF0000)", opacity: 0.7 }}
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[61] flex items-start justify-center px-4 py-8 overflow-y-auto">
        <div
          className="relative w-full max-w-md p-6 space-y-3 my-auto"
          style={{ backgroundColor: "var(--system-bg2, #FF0000)", fontFamily: "var(--font-figtree)", fontWeight: 500, borderRadius: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <style>{`
            .modal-field::placeholder { color: var(--field-placeholder-color, var(--system-form-text1, #FF0000)); opacity: var(--field-placeholder-opacity, 1); }
            .modal-age::-webkit-inner-spin-button,
            .modal-age::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
            .modal-age { -moz-appearance: textfield; }
          `}</style>

          {/* Title + close button row */}
          <div className="relative" style={{ marginBottom: 25 }}>
            <p className={`text-lg flex items-center gap-2 ${phase === "emailSent" ? "justify-center" : ""}`} style={{ color: "var(--system-text0, #FF0000)", fontWeight: 600 }}>
              {phase !== "emailSent" && <FontAwesomeIcon icon={faCommentPlus} style={{ color: "var(--system-icon0, #FF0000)" }} />}
              {phase === "emailSent" ? "Tjek din e-mail" : "Foreslå et spørgsmål"}
            </p>
            <button
              type="button"
              onClick={() => { if (phase === "emailSent") onSuccess(); onClose(); }}
              className="absolute top-1/2 right-0 -translate-y-1/2 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
              style={{ width: 24, height: 24, backgroundColor: "var(--system-bg0, #FF0000)" }}
              aria-label="Luk"
            >
              <FontAwesomeIcon icon={faXmark} style={{ color: "var(--system-icon1, #FF0000)", fontSize: "13.5px" }} />
            </button>
          </div>

          {phase === "emailSent" ? (
            <div className="text-center space-y-4 py-4">
              <FontAwesomeIcon icon={faEnvelopeCircleCheck} style={{ color: "var(--system-icon0, #FF0000)", fontSize: 48 }} />
              <p className="text-base" style={{ color: "var(--system-text0, #FF0000)" }}>
                Vi har sendt dig en bekræftelses-email. Klik på linket i emailen for at bekræfte dit forslag.
              </p>
            </div>
          ) : (

          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            {/* Question text */}
            <textarea
              ref={textRef}
              name="text"
              required
              maxLength={300}
              placeholder="Dit spørgsmål"
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                // Auto-expand
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              rows={2}
              className="modal-field resize-none overflow-hidden"
              style={{
                ...inputStyle,
                borderRadius: 10,
                fontSize: "32px",
                lineHeight: 1.2,
                "--field-placeholder-color": "var(--system-form-text1, #FF0000)",
              } as React.CSSProperties}
            />

            {/* Identity fields (only for non-logged-in users) */}
            {!hasSession && (
              <>
                <p className="text-base" style={{ color: "var(--system-text2, #FF0000)" }}>
                  Alder er valgfri
                </p>

                {/* Fornavn + Alder row */}
                <div className="flex items-center gap-2">
                  <input
                    name="firstName"
                    type="text"
                    required
                    placeholder={fieldErrors.firstName ? "Fornavn skal udfyldes" : "Fornavn *"}
                    value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); setFieldErrors((prev) => ({ ...prev, firstName: undefined })); }}
                    className="modal-field min-w-0"
                    style={{
                      ...inputStyle,
                      flex: "75",
                      "--field-placeholder-color": fieldErrors.firstName ? "var(--system-error, #FF0000)" : "var(--system-form-text1, #FF0000)",
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
                    className="modal-field modal-age min-w-0"
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
                    className="modal-field"
                    style={{
                      ...inputStyle,
                      color: fieldErrors.emailInvalid ? "var(--system-error, #FF0000)" : "var(--system-form-text0, #FF0000)",
                      "--field-placeholder-color": fieldErrors.email ? "var(--system-error, #FF0000)" : "var(--system-form-text1, #FF0000)",
                      "--field-placeholder-opacity": fieldErrors.email ? "1" : "0.75",
                    } as React.CSSProperties}
                  />
                  {fieldErrors.emailInvalid && (
                    <span
                      className="absolute right-5 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                      style={{ color: "var(--system-error, #FF0000)", fontFamily: "var(--font-figtree)", fontWeight: 500 }}
                    >
                      Ukorrekt format
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Error message */}
            {error && (
              <p className="text-sm" style={{ color: "var(--system-error, #FF0000)" }}>{error}</p>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={pending || !text.trim()}
              className="group w-full text-base px-5 py-2.5 rounded-full cursor-pointer disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: "var(--system-bg0-contrast, #FF0000)", color: "var(--system-text0-contrast, #FF0000)", fontFamily: "var(--font-figtree)", fontWeight: 500 }}
            >
              <span className="group-hover:opacity-50 transition-opacity">{pending ? "Sender..." : "Send forslag"}</span>
            </button>
          </form>
          )}
        </div>
      </div>
    </>
  );
}
