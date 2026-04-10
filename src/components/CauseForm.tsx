"use client";

import { useState, useEffect, useRef } from "react";
import { createCause } from "@/app/politiker/dashboard/actions";
import { generateSlug } from "@/lib/utils";
import { PointsEditor } from "@/components/PointsEditor";

export function CauseForm({ politicianId }: { politicianId: string }) {
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);
  const [open, setOpen] = useState(false);
  const textareaRef = useRef<HTMLInputElement>(null);

  // Listen for nav button open/close
  useEffect(() => {
    const openHandler = (e: Event) => {
      if ((e as CustomEvent).detail?.tab === "causes") setOpen(true);
    };
    const closeHandler = () => {
      setOpen(false);
      setShowLongDesc(false);
      setTagIdValue("");
      setPoints([]);
      setResetKey((k) => k + 1);
      const form = document.getElementById("cause-form") as HTMLFormElement;
      form?.reset();
    };
    window.addEventListener("dashboard-create-open", openHandler);
    window.addEventListener("dashboard-create-close", closeHandler);
    return () => {
      window.removeEventListener("dashboard-create-open", openHandler);
      window.removeEventListener("dashboard-create-close", closeHandler);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [open]);

  const [saving, setSaving] = useState(false);
  const [showLongDesc, setShowLongDesc] = useState(false);
  const [tagIdValue, setTagIdValue] = useState("");
  const [points, setPoints] = useState<string[]>([]);
  const [resetKey, setResetKey] = useState(0);

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    try {
      await createCause(formData);
      // Reset form
      const form = document.getElementById("cause-form") as HTMLFormElement;
      form?.reset();
      setShowLongDesc(false);
      setTagIdValue("");
      setPoints([]);
      setResetKey((k) => k + 1);
      setOpen(false);
      window.dispatchEvent(new CustomEvent("dashboard-create-close"));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="rounded-lg" style={{ backgroundColor: "var(--system-bg2, #FF0000)" }}>
      <form id="cause-form" action={handleSubmit}>
        <input
          type="hidden"
          name="points"
          value={points.length > 0 ? JSON.stringify(points) : ""}
        />

        <div style={{ padding: "20px 20px 0" }}>
          <label htmlFor="cause-title" className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
            Overskrift
          </label>
          <input
            ref={textareaRef}
            id="cause-title"
            name="title"
            type="text"
            maxLength={300}
            required
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg0, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
            placeholder="fx Grøn omstilling"
          />
        </div>

        <div style={{ padding: "12px 20px 0" }}>
          <label htmlFor="cause-short" className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
            Kort beskrivelse
          </label>
          <textarea
            id="cause-short"
            name="shortDescription"
            required
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm resize-none"
            style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg0, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
            placeholder="En kort beskrivelse af mærkesagen"
          />
        </div>

        {showLongDesc ? (
          <div style={{ padding: "12px 20px 0" }}>
            <label htmlFor="cause-long" className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
              Lang beskrivelse (valgfrit)
            </label>
            <textarea
              id="cause-long"
              name="longDescription"
              rows={5}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none"
              style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg0, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
              placeholder="En detaljeret beskrivelse af din holdning til denne mærkesag"
            />
          </div>
        ) : (
          <div style={{ padding: "12px 20px 0" }}>
            <button
              type="button"
              onClick={() => setShowLongDesc(true)}
              className="text-sm cursor-pointer hover:opacity-50 transition-opacity"
              style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}
            >
              + Tilføj lang beskrivelse
            </button>
          </div>
        )}

        {/* Handlingspunkter */}
        <div style={{ padding: "12px 20px 0" }}>
          <label className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
            Handlingspunkter
          </label>
          <PointsEditor key={resetKey} points={[]} onChange={setPoints} />
        </div>

        <div style={{ padding: "12px 20px 0" }}>
          <label htmlFor="cause-video" className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
            Video-URL (valgfrit)
          </label>
          <input
            id="cause-video"
            name="videoUrl"
            type="url"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg0, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
            placeholder="https://youtube.com/watch?v=..."
          />
        </div>

        <div style={{ padding: "12px 20px 0" }}>
          <label htmlFor="cause-tag" className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
            Tag titel
          </label>
          <input
            id="cause-tag"
            name="tagId"
            type="text"
            maxLength={100}
            required
            value={tagIdValue}
            onChange={(e) => setTagIdValue(e.target.value)}
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg0, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
            placeholder="fx grøn omstilling"
          />
          <p className="text-xs mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
            {tagIdValue ? `URL-venlig version: ${generateSlug(tagIdValue)}` : "Bruges til at koble spørgsmål til denne mærkesag"}
          </p>
        </div>

        <div className="flex gap-2 justify-end" style={{ padding: "12px 20px 16px" }}>
          <button
            type="button"
            onClick={() => { setOpen(false); setShowLongDesc(false); setTagIdValue(""); setPoints([]); setResetKey((k) => k + 1); window.dispatchEvent(new CustomEvent("dashboard-create-close")); }}
            className="text-sm cursor-pointer px-3 py-1.5 hover:opacity-50 transition-opacity"
            style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
          >
            Annullér
          </button>
          <button
            type="submit"
            disabled={saving}
            className="group text-sm px-4 py-1.5 rounded-full disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, backgroundColor: "var(--system-success, #FF0000)", color: "var(--system-success-contrast, #FF0000)" }}
          >
            <span className="group-hover:opacity-50 transition-opacity">{saving ? "Opretter..." : "Opret mærkesag"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
