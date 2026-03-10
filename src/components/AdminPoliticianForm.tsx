"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { createPolitician, updatePolitician, deletePolitician } from "@/app/admin/actions";

type PoliticianData = {
  id: string;
  name: string;
  email: string;
  partyId: string | null;
  constituency: string | null;
  profilePhotoUrl: string | null;
  bannerUrl: string | null;
  ogImageUrl: string | null;
  bannerBgColor: string | null;
  heroLine1: string | null;
  heroLine1Color: string | null;
  heroLine2: string | null;
  heroLine2Color: string | null;
  chatbaseId: string | null;
  defaultUpvoteGoal: number;
} | null;

type Party = {
  id: string;
  name: string;
  color: string | null;
  colorLight: string | null;
  colorDark: string | null;
};

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

export function AdminPoliticianForm({ politician, allParties }: { politician: PoliticianData; allParties: Party[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(politician?.profilePhotoUrl ?? "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [bannerUrl, setBannerUrl] = useState(politician?.bannerUrl ?? "");
  const [ogImageUrl, setOgImageUrl] = useState(politician?.ogImageUrl ?? "");
  const [bannerBgColor, setBannerBgColor] = useState(politician?.bannerBgColor ?? "");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingOg, setUploadingOg] = useState(false);
  const [heroLine1Color, setHeroLine1Color] = useState(politician?.heroLine1Color ?? "");
  const [heroLine2Color, setHeroLine2Color] = useState(politician?.heroLine2Color ?? "");
  const [chatbaseId, setChatbaseId] = useState(politician?.chatbaseId ?? "");

  async function handlePhotoUpload(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) { alert("Maks 10 MB"); return; }
    setUploadingPhoto(true);
    try {
      const cropped = await cropToSquare(file);
      const blob = await upload(`politicians/${cropped.name}`, cropped, { access: "public", handleUploadUrl: "/api/upload" });
      setProfilePhotoUrl(blob.url);
    } catch (e) { alert(e instanceof Error ? e.message : "Upload fejlede"); }
    finally { setUploadingPhoto(false); }
  }

  async function handleBannerUpload(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) { alert("Maks 10 MB"); return; }
    setUploadingBanner(true);
    try {
      const blob = await upload(`politicians/${file.name}`, file, { access: "public", handleUploadUrl: "/api/upload" });
      setBannerUrl(blob.url);
    } catch (e) { alert(e instanceof Error ? e.message : "Upload fejlede"); }
    finally { setUploadingBanner(false); }
  }

  async function handleOgUpload(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) { alert("Maks 10 MB"); return; }
    setUploadingOg(true);
    try {
      const blob = await upload(`politicians/${file.name}`, file, { access: "public", handleUploadUrl: "/api/upload" });
      setOgImageUrl(blob.url);
    } catch (e) { alert(e instanceof Error ? e.message : "Upload fejlede"); }
    finally { setUploadingOg(false); }
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      if (politician) {
        await updatePolitician(formData);
      } else {
        await createPolitician(formData);
      }
      router.push("/admin");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {politician && <input type="hidden" name="politicianId" value={politician.id} />}
      <input type="hidden" name="profilePhotoUrl" value={profilePhotoUrl} />
      <input type="hidden" name="bannerUrl" value={bannerUrl} />
      <input type="hidden" name="ogImageUrl" value={ogImageUrl} />
      <input type="hidden" name="bannerBgColor" value={bannerBgColor} />
      <input type="hidden" name="heroLine1Color" value={heroLine1Color} />
      <input type="hidden" name="heroLine2Color" value={heroLine2Color} />
      <input type="hidden" name="chatbaseId" value={chatbaseId} />

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Navn</label>
        <input id="name" name="name" type="text" required defaultValue={politician?.name ?? ""}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
        <input id="email" name="email" type="email" required defaultValue={politician?.email ?? ""}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      <div>
        <label htmlFor="partyId" className="block text-sm font-medium text-gray-700 mb-1">Parti</label>
        <select id="partyId" name="partyId" required defaultValue={politician?.partyId ?? ""}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
          <option value="">Vælg parti...</option>
          {allParties.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="constituency" className="block text-sm font-medium text-gray-700 mb-1">Kreds</label>
        <input id="constituency" name="constituency" type="text" defaultValue={politician?.constituency ?? ""}
          placeholder="F.eks. Københavns Storkreds"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      </div>

      {/* Profilbillede */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Profilbillede</label>
        <div className="flex items-center gap-4">
          {profilePhotoUrl ? (
            <img src={profilePhotoUrl} alt="Foto" className="w-20 h-20 rounded-lg object-cover border border-gray-200" />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs">Intet foto</div>
          )}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
              {uploadingPhoto ? "Uploader..." : "Vælg billede"}
              <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); }} />
            </label>
            {profilePhotoUrl && (
              <button type="button" onClick={() => setProfilePhotoUrl("")} className="text-xs text-red-600 hover:text-red-800 cursor-pointer text-left">Fjern</button>
            )}
          </div>
        </div>
      </div>

      {/* Hero banner */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Hero banner</label>
        {bannerUrl ? (
          <img src={bannerUrl} alt="Banner" className="w-full rounded-lg border border-gray-200 mb-2" />
        ) : (
          <div className="w-full aspect-[4/1] rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs mb-2">Intet banner</div>
        )}
        <div className="flex items-center gap-3">
          <label className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
            {uploadingBanner ? "Uploader..." : "Vælg banner"}
            <input type="file" accept="image/*" className="hidden" disabled={uploadingBanner}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBannerUpload(f); }} />
          </label>
          {bannerUrl && (
            <button type="button" onClick={() => setBannerUrl("")} className="text-xs text-red-600 hover:text-red-800 cursor-pointer">Fjern</button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">Anbefalet minimum: 1584 × 396 px. Vises øverst på borgersiden.</p>
      </div>

      {/* Hero banner baggrundsfarve */}
      {bannerUrl && (
        <div>
          <label htmlFor="adminBannerBgColor" className="block text-sm font-medium text-gray-700 mb-1">Hero banner baggrundsfarve (valgfrit)</label>
          <div className="flex items-center gap-3">
            <input
              id="adminBannerBgColor"
              type="color"
              value={bannerBgColor || "#ffffff"}
              onChange={(e) => setBannerBgColor(e.target.value)}
              className="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0.5"
            />
            <span className="text-sm text-gray-600">{bannerBgColor || "Ingen (auto-detect)"}</span>
            {bannerBgColor && (
              <button type="button" onClick={() => setBannerBgColor("")} className="text-xs text-red-600 hover:text-red-800 cursor-pointer">Nulstil til auto</button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">Farven forlænger banneret til skærmens kanter. Tom = auto-detect fra billedets hjørner.</p>
        </div>
      )}

      {/* Socialt delingsbillede (OpenGraph) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Socialt delingsbillede (OpenGraph)</label>
        {ogImageUrl ? (
          <img src={ogImageUrl} alt="OpenGraph billede" className="w-full max-w-md rounded-lg border border-gray-200 mb-2" style={{ aspectRatio: "1200/630" }} />
        ) : (
          <div className="w-full max-w-md rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs mb-2" style={{ aspectRatio: "1200/630" }}>Intet delingsbillede</div>
        )}
        <div className="flex items-center gap-3">
          <label className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
            {uploadingOg ? "Uploader..." : "Vælg billede"}
            <input type="file" accept="image/*" className="hidden" disabled={uploadingOg}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleOgUpload(f); }} />
          </label>
          {ogImageUrl && (
            <button type="button" onClick={() => setOgImageUrl("")} className="text-xs text-red-600 hover:text-red-800 cursor-pointer">Fjern</button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">Anbefalet: 1200 × 630 px. Vises når linket deles på sociale medier.</p>
      </div>

      {/* Velkomsttekst */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Velkomsttekst (valgfrit)</label>
        <p className="text-xs text-gray-500 mb-2">Vises på hero banneret. Vælg en partifarve for hver linje.</p>
        {[
          { name: "heroLine1", colorState: heroLine1Color, setColor: setHeroLine1Color, defaultValue: politician?.heroLine1 ?? "", placeholder: "Linje 1" },
          { name: "heroLine2", colorState: heroLine2Color, setColor: setHeroLine2Color, defaultValue: politician?.heroLine2 ?? "", placeholder: "Linje 2" },
        ].map((line) => {
          const selectedParty = allParties.find((p) => p.id === (politician?.partyId ?? ""));
          const partyColorOptions = selectedParty
            ? [
                { key: "primary", hex: selectedParty.color },
                { key: "light", hex: selectedParty.colorLight },
                { key: "dark", hex: selectedParty.colorDark },
              ].filter((c) => c.hex) as { key: string; hex: string }[]
            : [];
          return (
            <div key={line.name} className="flex items-center gap-2 mb-2">
              <input
                name={line.name}
                type="text"
                defaultValue={line.defaultValue}
                placeholder={line.placeholder}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="flex items-center gap-1">
                {partyColorOptions.map(({ key, hex }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => line.setColor(line.colorState === key ? "" : key)}
                    className={`w-7 h-7 rounded-full border-2 cursor-pointer transition ${
                      line.colorState === key ? "border-gray-900 scale-110" : "border-gray-300 hover:border-gray-400"
                    }`}
                    style={{ backgroundColor: hex }}
                    title={key}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Standard upvote-mål */}
      <div>
        <label htmlFor="defaultUpvoteGoal" className="block text-sm font-medium text-gray-700 mb-1">Standard upvote-mål</label>
        <input id="defaultUpvoteGoal" name="defaultUpvoteGoal" type="number" min={1} required
          defaultValue={politician?.defaultUpvoteGoal ?? 1000}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
        <p className="text-xs text-gray-500 mt-1">Standard antal upvotes der kræves for nye spørgsmål.</p>
      </div>

      {/* Chatbase */}
      <div>
        <label htmlFor="chatbaseEmbed" className="block text-sm font-medium text-gray-700 mb-1">Chatbase embed-kode</label>
        <textarea id="chatbaseEmbed" rows={3}
          defaultValue={politician?.chatbaseId ? `(konfigureret: ${politician.chatbaseId})` : ""}
          placeholder="Paste embed-kode fra Chatbase her..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          onChange={(e) => {
            const val = e.target.value;
            const match = val.match(/script\.id\s*=\s*"([^"]+)"/);
            if (match) setChatbaseId(match[1]);
            else if (!val.trim()) setChatbaseId("");
          }}
        />
        {chatbaseId && <span className="text-xs text-green-600">Chatbot-ID: {chatbaseId}</span>}
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" disabled={pending || uploadingPhoto || uploadingBanner || uploadingOg || deleting}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 cursor-pointer">
          {pending ? "Gemmer..." : politician ? "Gem ændringer" : "Opret politiker"}
        </button>
        <a href="/admin" className="text-sm text-gray-500 hover:text-gray-700">Annuller</a>
      </div>

      {politician && (
        <div className="border-t border-gray-200 pt-6 mt-6">
          <h3 className="text-sm font-medium text-red-600 mb-2">Farezone</h3>
          <p className="text-sm text-gray-500 mb-3">
            Sletning af politikeren fjerner også alle tilknyttede spørgsmål, svar, mærkesager og upvotes permanent.
          </p>
          <button
            type="button"
            disabled={deleting || pending}
            onClick={async () => {
              if (!confirm(`Er du sikker på, at du vil slette "${politician.name}"? Alle spørgsmål, mærkesager og data tilknyttet politikeren vil blive permanent slettet.`)) return;
              setDeleting(true);
              try {
                await deletePolitician(politician.id);
                router.push("/admin");
              } catch (e) {
                alert(e instanceof Error ? e.message : "Der opstod en fejl");
                setDeleting(false);
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition font-medium disabled:opacity-50 cursor-pointer"
          >
            {deleting ? "Sletter..." : "Slet politiker"}
          </button>
        </div>
      )}
    </form>
  );
}
