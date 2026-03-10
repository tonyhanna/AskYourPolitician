"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { createParty, updateParty, deleteParty } from "@/app/admin/actions";

type PartyData = {
  id: string;
  name: string;
  logoUrl: string | null;
  color: string | null;
  colorLight: string | null;
  colorDark: string | null;
} | null;

async function cropToSquare(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const x = (img.width - size) / 2;
      const y = (img.height - size) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, x, y, size, size, 0, 0, size, size);
      canvas.toBlob((blob) => {
        resolve(new File([blob!], file.name, { type: "image/jpeg" }));
      }, "image/jpeg", 0.9);
    };
    img.src = URL.createObjectURL(file);
  });
}

export function AdminPartyForm({ party }: { party: PartyData }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [logoUrl, setLogoUrl] = useState(party?.logoUrl ?? "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [color, setColor] = useState(party?.color ?? "#000000");
  const [colorLight, setColorLight] = useState(party?.colorLight ?? "#E5E7EB");
  const [colorDark, setColorDark] = useState(party?.colorDark ?? "#1F2937");

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) { alert("Maks 10 MB"); return; }
    setUploadingLogo(true);
    try {
      const cropped = await cropToSquare(file);
      const blob = await upload(`parties/${cropped.name}`, cropped, { access: "public", handleUploadUrl: "/api/upload" });
      setLogoUrl(blob.url);
    } catch (e) { alert(e instanceof Error ? e.message : "Upload fejlede"); }
    finally { setUploadingLogo(false); }
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      if (party) {
        await updateParty(formData);
      } else {
        await createParty(formData);
      }
      router.push("/admin");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {party && <input type="hidden" name="partyId" value={party.id} />}
      <input type="hidden" name="logoUrl" value={logoUrl} />
      <input type="hidden" name="color" value={color} />
      <input type="hidden" name="colorLight" value={colorLight} />
      <input type="hidden" name="colorDark" value={colorDark} />

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Partinavn</label>
        <input id="name" name="name" type="text" required defaultValue={party?.name ?? ""}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      {/* Logo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Partilogo</label>
        <div className="flex items-center gap-4">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs">Intet logo</div>
          )}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
              {uploadingLogo ? "Uploader..." : "Vælg logo"}
              <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
            </label>
            {logoUrl && (
              <button type="button" onClick={() => setLogoUrl("")} className="text-xs text-red-600 hover:text-red-800 cursor-pointer text-left">Fjern</button>
            )}
          </div>
        </div>
      </div>

      {/* Farver */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Partifarver</label>
        {([
          ["Primær", color, setColor],
          ["Lys", colorLight, setColorLight],
          ["Mørk", colorDark, setColorDark],
        ] as [string, string, (v: string) => void][]).map(([label, value, setter]) => (
          <div key={label} className="flex items-center gap-3">
            <input type="color" value={value} onChange={(e) => setter(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer border border-gray-300" />
            <div className="flex-1">
              <label className="text-xs text-gray-500">{label}</label>
              <input type="text" value={value} onChange={(e) => setter(e.target.value)} maxLength={7}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 font-mono" />
            </div>
          </div>
        ))}
        <div className="flex gap-2 mt-2">
          <div className="w-8 h-8 rounded-full border border-gray-200" style={{ backgroundColor: colorLight }} title="Lys" />
          <div className="w-8 h-8 rounded-full border border-gray-200" style={{ backgroundColor: color }} title="Primær" />
          <div className="w-8 h-8 rounded-full border border-gray-200" style={{ backgroundColor: colorDark }} title="Mørk" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending || uploadingLogo || deleting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 cursor-pointer">
          {pending ? "Gemmer..." : party ? "Gem ændringer" : "Opret parti"}
        </button>
        <a href="/admin" className="text-sm text-gray-500 hover:text-gray-700">Annuller</a>
      </div>

      {party && (
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-sm font-medium text-red-600 mb-2">Farezone</h3>
          <p className="text-sm text-gray-500 mb-3">
            Sletning af partiet fjerner det fra alle tilknyttede politikere. De skal derefter tildeles et nyt parti.
          </p>
          <button
            type="button"
            disabled={deleting || pending}
            onClick={async () => {
              if (!confirm(`Er du sikker på, at du vil slette "${party.name}"? Alle tilknyttede politikere vil miste deres parti-tilknytning.`)) return;
              setDeleting(true);
              try {
                await deleteParty(party.id);
                router.push("/admin");
              } catch (e) {
                alert(e instanceof Error ? e.message : "Der opstod en fejl");
                setDeleting(false);
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition font-medium disabled:opacity-50 cursor-pointer"
          >
            {deleting ? "Sletter..." : "Slet parti"}
          </button>
        </div>
      )}
    </form>
  );
}
