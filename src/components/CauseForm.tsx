"use client";

import { useState } from "react";
import { createCause } from "@/app/politiker/dashboard/actions";
import { generateSlug } from "@/lib/utils";

export function CauseForm({ politicianId }: { politicianId: string }) {
  const [saving, setSaving] = useState(false);
  const [showLongDesc, setShowLongDesc] = useState(false);
  const [tagIdValue, setTagIdValue] = useState("");

  async function handleSubmit(formData: FormData) {
    setSaving(true);
    try {
      await createCause(formData);
      // Reset form
      const form = document.getElementById("cause-form") as HTMLFormElement;
      form?.reset();
      setShowLongDesc(false);
      setTagIdValue("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form id="cause-form" action={handleSubmit} className="space-y-4">
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
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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

      <div>
        <label htmlFor="cause-video" className="block text-sm font-medium text-gray-700 mb-1">
          Video-URL (valgfrit)
        </label>
        <input
          id="cause-video"
          name="videoUrl"
          type="url"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="f.eks. grøn omstilling"
        />
        <p className="text-xs text-gray-500 mt-1">
          {tagIdValue ? `URL-venlig version: ${generateSlug(tagIdValue)}` : "Bruges til at koble spørgsmål til denne mærkesag"}
        </p>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 cursor-pointer"
      >
        {saving ? "Opretter..." : "Opret mærkesag"}
      </button>
    </form>
  );
}
