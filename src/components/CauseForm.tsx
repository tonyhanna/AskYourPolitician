"use client";

import { useState, useEffect, useRef } from "react";
import { createCause } from "@/app/politiker/dashboard/actions";
import { generateSlug } from "@/lib/utils";
import { PointsEditor } from "@/components/PointsEditor";

export function CauseForm({ politicianId, partyColor, partyColorDark, partyColorLight }: { politicianId: string; partyColor?: string | null; partyColorDark?: string | null; partyColorLight?: string | null }) {
  const canHover = useRef(false);
  useEffect(() => { canHover.current = window.matchMedia("(hover: hover)").matches; }, []);
  const [open, setOpen] = useState(false);

  // Listen for docked nav button click
  useEffect(() => {
    const openHandler = (e: Event) => {
      if ((e as CustomEvent).detail?.tab === "causes") setOpen(true);
    };
    const closeHandler = () => setOpen(false);
    window.addEventListener("dashboard-create-open", openHandler);
    window.addEventListener("dashboard-create-close", closeHandler);
    return () => {
      window.removeEventListener("dashboard-create-open", openHandler);
      window.removeEventListener("dashboard-create-close", closeHandler);
    };
  }, []);

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
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <form id="cause-form" action={handleSubmit} className="space-y-4">
      <input
        type="hidden"
        name="points"
        value={points.length > 0 ? JSON.stringify(points) : ""}
      />

      <div>
        <label htmlFor="cause-title" className="block text-sm font-medium text-gray-700 mb-1">
          Overskrift
        </label>
        <input
          id="cause-title"
          name="title"
          type="text"
          maxLength={300}
          required
          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="f.eks. Grøn omstilling"
        />
      </div>

      <div>
        <label htmlFor="cause-short" className="block text-sm font-medium text-gray-700 mb-1">
          Kort beskrivelse
        </label>
        <textarea
          id="cause-short"
          name="shortDescription"
          required
          rows={2}
          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="En kort beskrivelse af mærkesagen"
        />
      </div>

      {showLongDesc ? (
        <div>
          <label htmlFor="cause-long" className="block text-sm font-medium text-gray-700 mb-1">
            Lang beskrivelse (valgfrit)
          </label>
          <textarea
            id="cause-long"
            name="longDescription"
            rows={5}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="En detaljeret beskrivelse af din holdning til denne mærkesag"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowLongDesc(true)}
          className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
        >
          + Tilføj lang beskrivelse
        </button>
      )}

      {/* Handlingspunkter */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Handlingspunkter
        </label>
        <PointsEditor key={resetKey} points={[]} onChange={setPoints} />
      </div>

      <div>
        <label htmlFor="cause-video" className="block text-sm font-medium text-gray-700 mb-1">
          Video-URL (valgfrit)
        </label>
        <input
          id="cause-video"
          name="videoUrl"
          type="url"
          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="https://youtube.com/watch?v=..."
        />
      </div>

      <div>
        <label htmlFor="cause-tag" className="block text-sm font-medium text-gray-700 mb-1">
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
          className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="f.eks. grøn omstilling"
        />
        <p className="text-xs text-gray-500 mt-1">
          {tagIdValue ? `URL-venlig version: ${generateSlug(tagIdValue)}` : "Bruges til at koble spørgsmål til denne mærkesag"}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50 cursor-pointer"
        >
          {saving ? "Opretter..." : "Opret mærkesag"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2 cursor-pointer"
        >
          Annullér
        </button>
      </div>
    </form>
  );
}
