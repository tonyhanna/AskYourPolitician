"use client";

import { useState } from "react";
import { editCause, deleteCause } from "@/app/politiker/dashboard/actions";
import { generateSlug } from "@/lib/utils";

type Cause = {
  id: string;
  title: string;
  shortDescription: string;
  longDescription: string | null;
  videoUrl: string | null;
  tagId: string;
  inUse: boolean;
};

export function CauseList({ causes }: { causes: Cause[] }) {
  return (
    <div className="space-y-4">
      {causes.map((cause) => (
        <CauseItem key={cause.id} cause={cause} />
      ))}
    </div>
  );
}

function CauseItem({ cause }: { cause: Cause }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLongDesc, setShowLongDesc] = useState(!!cause.longDescription);
  const [tagIdValue, setTagIdValue] = useState(cause.tagId);

  async function handleSave(formData: FormData) {
    setSaving(true);
    try {
      formData.set("causeId", cause.id);
      await editCause(formData);
      setEditing(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Er du sikker på at du vil slette denne mærkesag?")) return;
    setDeleting(true);
    try {
      await deleteCause(cause.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <div className="border border-blue-300 bg-blue-50 rounded-lg p-4">
        <form action={handleSave} className="space-y-3">
          <div>
            <label htmlFor={`title-${cause.id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Overskrift
            </label>
            <input
              id={`title-${cause.id}`}
              name="title"
              type="text"
              maxLength={300}
              required
              defaultValue={cause.title}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor={`short-${cause.id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Kort beskrivelse
            </label>
            <textarea
              id={`short-${cause.id}`}
              name="shortDescription"
              required
              rows={2}
              defaultValue={cause.shortDescription}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {showLongDesc ? (
            <div>
              <label htmlFor={`long-${cause.id}`} className="block text-sm font-medium text-gray-700 mb-1">
                Lang beskrivelse (valgfrit)
              </label>
              <textarea
                id={`long-${cause.id}`}
                name="longDescription"
                rows={5}
                defaultValue={cause.longDescription ?? ""}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <label htmlFor={`video-${cause.id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Video-URL (valgfrit)
            </label>
            <input
              id={`video-${cause.id}`}
              name="videoUrl"
              type="url"
              defaultValue={cause.videoUrl ?? ""}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor={`tag-${cause.id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Tag titel
            </label>
            <input
              id={`tag-${cause.id}`}
              name="tagId"
              type="text"
              maxLength={100}
              required
              value={tagIdValue}
              onChange={(e) => setTagIdValue(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL-venlig version: {generateSlug(tagIdValue)}
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5 cursor-pointer"
            >
              Annullér
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Gemmer..." : "Gem"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="font-medium text-gray-900">{cause.title}</p>
          <p className="text-sm text-gray-600 mt-1">{cause.shortDescription}</p>
          {cause.longDescription && (
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{cause.longDescription}</p>
          )}
          {cause.videoUrl && (
            <a
              href={cause.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 underline mt-1 inline-block"
            >
              Se video
            </a>
          )}
        </div>
        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full whitespace-nowrap">
          {cause.tagId}
        </span>
      </div>
      <div className="flex items-center justify-end gap-3 mt-3">
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
        >
          Redigér
        </button>
        {!cause.inUse && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 cursor-pointer"
          >
            {deleting ? "Sletter..." : "Slet"}
          </button>
        )}
      </div>
    </div>
  );
}
