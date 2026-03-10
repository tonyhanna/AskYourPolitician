"use client";

import { useState, useEffect, useId } from "react";
import { editCause, deleteCause, reorderCauses } from "@/app/politiker/dashboard/actions";
import { generateSlug } from "@/lib/utils";
import { PointsEditor } from "@/components/PointsEditor";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Cause = {
  id: string;
  title: string;
  shortDescription: string;
  longDescription: string | null;
  videoUrl: string | null;
  points: string[];
  tagId: string;
  sortOrder: number;
  inUse: boolean;
};

export function CauseList({ causes: initialCauses }: { causes: Cause[] }) {
  const dndId = useId();
  const [causes, setCauses] = useState(initialCauses);
  const [reordering, setReordering] = useState(false);

  // Sync state when server re-renders with new props (e.g. after editing a cause)
  useEffect(() => {
    setCauses(initialCauses);
  }, [initialCauses]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = causes.findIndex((c) => c.id === active.id);
    const newIndex = causes.findIndex((c) => c.id === over.id);
    const newOrder = arrayMove(causes, oldIndex, newIndex);
    setCauses(newOrder);

    setReordering(true);
    try {
      await reorderCauses(newOrder.map((c) => c.id));
    } catch (e) {
      setCauses(initialCauses);
      alert(e instanceof Error ? e.message : "Kunne ikke gemme rækkefølge");
    } finally {
      setReordering(false);
    }
  }

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={causes.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {reordering && (
            <p className="text-xs text-gray-500 animate-pulse">Gemmer rækkefølge...</p>
          )}
          {causes.map((cause, index) => (
            <SortableCauseItem key={cause.id} cause={cause} index={index} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableCauseItem({ cause, index }: { cause: Cause; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cause.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CauseItem cause={cause} index={index} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  );
}

function CauseItem({
  cause,
  index,
  dragAttributes,
  dragListeners,
}: {
  cause: Cause;
  index: number;
  dragAttributes: DraggableAttributes;
  dragListeners: SyntheticListenerMap | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPoints, setShowPoints] = useState(false);
  const [showLongDesc, setShowLongDesc] = useState(!!cause.longDescription);
  const [tagIdValue, setTagIdValue] = useState(cause.tagId);
  const [points, setPoints] = useState<string[]>(cause.points);

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
          <input
            type="hidden"
            name="points"
            value={points.length > 0 ? JSON.stringify(points) : ""}
          />

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
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Handlingspunkter</label>
            <PointsEditor points={cause.points} onChange={setPoints} />
          </div>
          <div>
            <label htmlFor={`video-${cause.id}`} className="block text-sm font-medium text-gray-700 mb-1">
              Video-URL (valgfrit)
            </label>
            <input
              id={`video-${cause.id}`}
              name="videoUrl"
              type="url"
              defaultValue={cause.videoUrl ?? ""}
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <button
          type="button"
          className="mt-0.5 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing touch-none"
          {...dragAttributes}
          {...dragListeners}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="5" cy="3" r="1.5" />
            <circle cx="11" cy="3" r="1.5" />
            <circle cx="5" cy="8" r="1.5" />
            <circle cx="11" cy="8" r="1.5" />
            <circle cx="5" cy="13" r="1.5" />
            <circle cx="11" cy="13" r="1.5" />
          </svg>
        </button>

        <div className="flex-1">
          <p className="text-xs font-semibold text-gray-400 mb-1">#{index + 1}</p>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="font-medium text-gray-900">{cause.title}</p>
              <p className="text-sm text-gray-600 mt-1">{cause.shortDescription}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {cause.longDescription && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">+ Lang beskrivelse</span>
                )}
                {cause.points.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPoints(!showPoints)}
                    className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full hover:text-blue-800 cursor-pointer"
                  >
                    {showPoints ? "Skjul punkter ▲" : `Hvad vi vil (${cause.points.length}) ▼`}
                  </button>
                )}
                {cause.videoUrl && (
                  <a
                    href={cause.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full hover:text-blue-800"
                  >
                    Se video
                  </a>
                )}
              </div>
              {showPoints && cause.points.length > 0 && (
                <ul className="mt-2 space-y-1 pl-4 list-disc">
                  {cause.points.map((point, i) => (
                    <li key={i} className="text-sm text-gray-700">{point}</li>
                  ))}
                </ul>
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
      </div>
    </div>
  );
}
