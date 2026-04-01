"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { updateSettings } from "@/app/politiker/dashboard/actions";

type PoliticianData = {
  name: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  partyId: string | null;
  email: string;
  slug: string;
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

type PartyOption = {
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

export function SettingsForm({
  politician,
  allParties,
  googleEmail,
  googleName,
}: {
  politician: PoliticianData;
  allParties: PartyOption[];
  googleEmail: string;
  googleName: string;
}) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(politician?.profilePhotoUrl ?? "");
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [bannerUrl, setBannerUrl] = useState(politician?.bannerUrl ?? "");
  const [ogImageUrl, setOgImageUrl] = useState(politician?.ogImageUrl ?? "");
  const [bannerBgColor, setBannerBgColor] = useState(politician?.bannerBgColor ?? "");
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingOg, setUploadingOg] = useState(false);
  const [heroLine1Color, setHeroLine1Color] = useState(politician?.heroLine1Color ?? "");
  const [heroLine2Color, setHeroLine2Color] = useState(politician?.heroLine2Color ?? "");
  const [chatbaseId, setChatbaseId] = useState(politician?.chatbaseId ?? "");

  async function handleImageUpload(
    file: File,
    setUrl: (url: string) => void,
    setUploading: (v: boolean) => void,
    crop = true,
    folder = "politicians",
  ) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Billedet er for stort (maks 10 MB)");
      return;
    }
    setUploading(true);
    try {
      const toUpload = crop ? await cropToSquare(file) : file;
      const blob = await upload(`${folder}/${toUpload.name}`, toUpload, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      setUrl(blob.url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Upload fejlede");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await updateSettings(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <input type="hidden" name="profilePhotoUrl" value={profilePhotoUrl} />
      <input type="hidden" name="bannerUrl" value={bannerUrl} />
      <input type="hidden" name="ogImageUrl" value={ogImageUrl} />
      <input type="hidden" name="bannerBgColor" value={bannerBgColor} />
      <input type="hidden" name="heroLine1Color" value={heroLine1Color} />
      <input type="hidden" name="heroLine2Color" value={heroLine2Color} />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Navn</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <input
              name="firstName"
              type="text"
              required
              placeholder="Fornavn(e)"
              defaultValue={politician?.firstName ?? googleName.split(" ")[0] ?? ""}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <input
              name="middleName"
              type="text"
              placeholder="Mellemnavn(e)"
              defaultValue={politician?.middleName ?? ""}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <input
              name="lastName"
              type="text"
              required
              placeholder="Efternavn(e)"
              defaultValue={politician?.lastName ?? (googleName.split(" ").length > 1 ? googleName.split(" ").slice(-1)[0] : "") ?? ""}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>
      {/* Party is managed by admin only — pass as hidden field */}
      <input type="hidden" name="partyId" value={politician?.partyId ?? ""} />
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          defaultValue={politician?.email ?? googleEmail}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label htmlFor="constituency" className="block text-sm font-medium text-gray-700 mb-1">
          Kreds
        </label>
        <input
          id="constituency"
          name="constituency"
          type="text"
          defaultValue={politician?.constituency ?? ""}
          placeholder="F.eks. Københavns Storkreds"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <hr className="border-gray-200" />

      {/* Profilbillede */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Profilbillede
        </label>
        <div className="flex items-center gap-4">
          {profilePhotoUrl ? (
            <img
              src={profilePhotoUrl}
              alt="Profilbillede"
              className="w-20 h-20 rounded-lg object-cover border border-gray-200"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs">
              Intet foto
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
              {uploadingProfile ? "Uploader..." : "Vælg billede"}
              <input
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                disabled={uploadingProfile}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, setProfilePhotoUrl, setUploadingProfile);
                }}
              />
            </label>
            {profilePhotoUrl && (
              <button
                type="button"
                onClick={() => setProfilePhotoUrl("")}
                className="text-xs text-red-600 hover:text-red-800 cursor-pointer text-left"
              >
                Fjern
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">Anbefalet: mindst 512 x 512 px. Auto-croppes til firkantet.</p>
      </div>

      {/* Hero banner */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Hero banner
        </label>
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt="Hero banner"
            className="w-full rounded-lg border border-gray-200 mb-2"
          />
        ) : (
          <div className="w-full aspect-[4/1] rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs mb-2">
            Intet banner
          </div>
        )}
        <div className="flex items-center gap-3">
          <label className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
            {uploadingBanner ? "Uploader..." : "Vælg banner"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingBanner}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file, setBannerUrl, setUploadingBanner, false);
              }}
            />
          </label>
          {bannerUrl && (
            <button
              type="button"
              onClick={() => setBannerUrl("")}
              className="text-xs text-red-600 hover:text-red-800 cursor-pointer"
            >
              Fjern
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">Anbefalet minimum: 1584 × 396 px. Vises øverst på borgersiden.</p>
      </div>

      {/* Hero banner baggrundsfarve */}
      {bannerUrl && (
        <div>
          <label htmlFor="bannerBgColor" className="block text-sm font-medium text-gray-700 mb-1">
            Hero banner baggrundsfarve (valgfrit)
          </label>
          <div className="flex items-center gap-3">
            <input
              id="bannerBgColor"
              type="color"
              value={bannerBgColor || "#ffffff"}
              onChange={(e) => setBannerBgColor(e.target.value)}
              className="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0.5"
            />
            <span className="text-sm text-gray-600">{bannerBgColor || "Ingen (auto-detect)"}</span>
            {bannerBgColor && (
              <button
                type="button"
                onClick={() => setBannerBgColor("")}
                className="text-xs text-red-600 hover:text-red-800 cursor-pointer"
              >
                Nulstil til auto
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Farven forlænger banneret til skærmens kanter. Lad stå tom for automatisk at matche billedets hjørnefarve.
          </p>
        </div>
      )}

      {/* Socialt delingsbillede (OpenGraph) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Socialt delingsbillede (OpenGraph)
        </label>
        {ogImageUrl ? (
          <img
            src={ogImageUrl}
            alt="OpenGraph billede"
            className="max-w-md rounded-lg border border-gray-200 mb-2"
          />
        ) : (
          <div className="w-full max-w-md rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs mb-2" style={{ aspectRatio: "1200/630" }}>
            Intet delingsbillede
          </div>
        )}
        <div className="flex items-center gap-3">
          <label className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
            {uploadingOg ? "Uploader..." : "Vælg billede"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploadingOg}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file, setOgImageUrl, setUploadingOg, false);
              }}
            />
          </label>
          {ogImageUrl && (
            <button
              type="button"
              onClick={() => setOgImageUrl("")}
              className="text-xs text-red-600 hover:text-red-800 cursor-pointer"
            >
              Fjern
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">Anbefalet: 1200 × 630 px. Vises når dit link deles på sociale medier.</p>
      </div>

      {/* Velkomsttekst */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Velkomsttekst (valgfrit)
        </label>
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

      <hr className="border-gray-200" />

      {/* Standard upvote-mål */}
      <div>
        <label htmlFor="defaultUpvoteGoal" className="block text-sm font-medium text-gray-700 mb-1">
          Standard upvote-mål
        </label>
        <input
          id="defaultUpvoteGoal"
          name="defaultUpvoteGoal"
          type="number"
          min={1}
          required
          defaultValue={politician?.defaultUpvoteGoal ?? 1000}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-1">Standard antal upvotes der kræves, når du opretter nye spørgsmål.</p>
      </div>

      <hr className="border-gray-200" />

      {/* Chatbase */}
      <div>
        <label htmlFor="chatbaseEmbed" className="block text-sm font-medium text-gray-700 mb-1">
          Chatbase embed-kode
        </label>
        <input type="hidden" name="chatbaseId" value={chatbaseId} />
        <textarea
          id="chatbaseEmbed"
          rows={4}
          defaultValue={politician?.chatbaseId ? `(allerede konfigureret: ${politician.chatbaseId})` : ""}
          placeholder='Paste hele embed-koden fra Chatbase her...'
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          onChange={(e) => {
            const val = e.target.value;
            const match = val.match(/script\.id\s*=\s*"([^"]+)"/);
            if (match) {
              setChatbaseId(match[1]);
            } else if (!val.trim()) {
              setChatbaseId("");
            }
          }}
        />
        {chatbaseId ? (
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-green-600">Chatbot-ID fundet: {chatbaseId}</span>
            <button
              type="button"
              onClick={() => setChatbaseId("")}
              className="text-xs text-red-600 hover:text-red-800 cursor-pointer"
            >
              Fjern
            </button>
          </div>
        ) : (
          <p className="text-xs text-gray-500 mt-1">Gå til Chatbase &rarr; Deploy &rarr; Embed, og paste hele script-koden her. Lad feltet stå tomt for at deaktivere.</p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending || uploadingProfile || uploadingBanner || uploadingOg}
        className={`px-6 py-2 rounded-lg transition font-medium disabled:opacity-50 cursor-pointer ${
          saved
            ? "bg-green-600 text-white"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {pending ? "Gemmer..." : saved ? "Gemt" : "Gem indstillinger"}
      </button>
    </form>
  );
}
