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
  topbarLeft1Color: string | null;
  topbarLeft1Opacity: number | null;
  topbarLeft2Color: string | null;
  topbarLeft2Opacity: number | null;
  topbarRightColor: string | null;
  topbarRightOpacity: number | null;
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
  const [color, setColor] = useState(party?.color ?? "#FF0000");
  const [colorLight, setColorLight] = useState(party?.colorLight ?? "#FFFFFF");
  const [colorDark, setColorDark] = useState(party?.colorDark ?? "#000000");
  const [topbarLeft1Color, setTopbarLeft1Color] = useState(party?.topbarLeft1Color ?? "");
  const [topbarLeft1Opacity, setTopbarLeft1Opacity] = useState(party?.topbarLeft1Opacity ?? 100);
  const [topbarLeft2Color, setTopbarLeft2Color] = useState(party?.topbarLeft2Color ?? "");
  const [topbarLeft2Opacity, setTopbarLeft2Opacity] = useState(party?.topbarLeft2Opacity ?? 100);
  const [topbarRightColor, setTopbarRightColor] = useState(party?.topbarRightColor ?? "");
  const [topbarRightOpacity, setTopbarRightOpacity] = useState(party?.topbarRightOpacity ?? 100);

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
      <input type="hidden" name="topbarLeft1Color" value={topbarLeft1Color} />
      <input type="hidden" name="topbarLeft1Opacity" value={topbarLeft1Opacity} />
      <input type="hidden" name="topbarLeft2Color" value={topbarLeft2Color} />
      <input type="hidden" name="topbarLeft2Opacity" value={topbarLeft2Opacity} />
      <input type="hidden" name="topbarRightColor" value={topbarRightColor} />
      <input type="hidden" name="topbarRightOpacity" value={topbarRightOpacity} />

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

      {/* Topbar farver */}
      <div className="space-y-4">
        <label className="block text-sm font-medium text-gray-700">Topbar tekstfarver</label>
        <p className="text-xs text-gray-500 -mt-2">Vælg farver for tekstelementer i politikerens topbar. Vælg en af partiets farver eller en custom farve.</p>
        {([
          { label: "Venstre tekst: Linie 1", colorState: topbarLeft1Color, setColor: setTopbarLeft1Color, opacityState: topbarLeft1Opacity, setOpacity: setTopbarLeft1Opacity, defaultKey: "dark" },
          { label: "Venstre tekst: Linie 2", colorState: topbarLeft2Color, setColor: setTopbarLeft2Color, opacityState: topbarLeft2Opacity, setOpacity: setTopbarLeft2Opacity, defaultKey: "light" },
          { label: "Højre tekst", colorState: topbarRightColor, setColor: setTopbarRightColor, opacityState: topbarRightOpacity, setOpacity: setTopbarRightOpacity, defaultKey: "dark" },
        ] as const).map((item) => {
          const partyColorOptions = [
            { key: "primary", hex: color },
            { key: "light", hex: colorLight },
            { key: "dark", hex: colorDark },
          ];
          const isCustom = item.colorState && !["primary", "light", "dark", ""].includes(item.colorState);
          return (
            <div key={item.label}>
              <label className="block text-xs text-gray-500 mb-1">{item.label} <span className="text-gray-400">(default: {item.defaultKey})</span></label>
              <div className="flex items-center gap-2">
                {partyColorOptions.map(({ key, hex }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => item.setColor(item.colorState === key ? "" : key)}
                    className={`w-7 h-7 rounded-full border-2 cursor-pointer transition ${
                      item.colorState === key ? "border-gray-900 scale-110" : "border-gray-300 hover:border-gray-400"
                    }`}
                    style={{ backgroundColor: hex }}
                    title={key}
                  />
                ))}
                <input
                  type="color"
                  value={isCustom ? item.colorState : "#000000"}
                  onChange={(e) => item.setColor(e.target.value)}
                  className={`w-7 h-7 rounded-full border-2 cursor-pointer p-0 ${
                    isCustom ? "border-gray-900 scale-110" : "border-gray-300 hover:border-gray-400"
                  }`}
                  title="Custom farve"
                />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={item.opacityState}
                  onChange={(e) => item.setOpacity(parseInt(e.target.value))}
                  className="w-20 h-1 cursor-pointer"
                />
                <span className="text-xs text-gray-400 w-8">{item.opacityState}%</span>
                {item.colorState && (
                  <button type="button" onClick={() => { item.setColor(""); item.setOpacity(100); }} className="text-xs text-red-600 hover:text-red-800 cursor-pointer">Nulstil</button>
                )}
              </div>
            </div>
          );
        })}
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
