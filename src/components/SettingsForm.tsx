"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";
import { updateSettings } from "@/app/politiker/dashboard/actions";

type PoliticianData = {
  name: string;
  party: string | null;
  email: string;
  slug: string;
  profilePhotoUrl: string | null;
  partyLogoUrl: string | null;
  partyColor: string | null;
  partyColorLight: string | null;
  partyColorDark: string | null;
  chatbaseId: string | null;
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

export function SettingsForm({
  politician,
  googleEmail,
  googleName,
}: {
  politician: PoliticianData;
  googleEmail: string;
  googleName: string;
}) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(politician?.profilePhotoUrl ?? "");
  const [partyLogoUrl, setPartyLogoUrl] = useState(politician?.partyLogoUrl ?? "");
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [partyColor, setPartyColor] = useState(politician?.partyColor ?? "#000000");
  const [partyColorLight, setPartyColorLight] = useState(politician?.partyColorLight ?? "#E5E7EB");
  const [partyColorDark, setPartyColorDark] = useState(politician?.partyColorDark ?? "#1F2937");
  const [chatbaseId, setChatbaseId] = useState(politician?.chatbaseId ?? "");

  async function handleImageUpload(
    file: File,
    setUrl: (url: string) => void,
    setUploading: (v: boolean) => void,
  ) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Billedet er for stort (maks 10 MB)");
      return;
    }
    setUploading(true);
    try {
      const cropped = await cropToSquare(file);
      const blob = await upload(cropped.name, cropped, {
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
      <input type="hidden" name="partyLogoUrl" value={partyLogoUrl} />
      <input type="hidden" name="partyColor" value={partyColor} />
      <input type="hidden" name="partyColorLight" value={partyColorLight} />
      <input type="hidden" name="partyColorDark" value={partyColorDark} />

      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
          Dit navn
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          defaultValue={politician?.name ?? googleName}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
      <div>
        <label htmlFor="party" className="block text-sm font-medium text-gray-700 mb-1">
          Parti
        </label>
        <input
          id="party"
          name="party"
          type="text"
          defaultValue={politician?.party ?? ""}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>
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

      {/* Partilogo */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Partilogo
        </label>
        <div className="flex items-center gap-4">
          {partyLogoUrl ? (
            <img
              src={partyLogoUrl}
              alt="Partilogo"
              className="w-20 h-20 rounded-lg object-cover border border-gray-200"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs">
              Intet logo
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer">
              {uploadingLogo ? "Uploader..." : "Vælg logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingLogo}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file, setPartyLogoUrl, setUploadingLogo);
                }}
              />
            </label>
            {partyLogoUrl && (
              <button
                type="button"
                onClick={() => setPartyLogoUrl("")}
                className="text-xs text-red-600 hover:text-red-800 cursor-pointer text-left"
              >
                Fjern
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-1">Anbefalet: mindst 512 x 512 px. Auto-croppes til firkantet.</p>
      </div>

      <hr className="border-gray-200" />

      {/* Partifarver */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">Partifarver</label>

        <div className="flex items-center gap-3">
          <input
            type="color"
            value={partyColor}
            onChange={(e) => setPartyColor(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border border-gray-300"
          />
          <div className="flex-1">
            <label className="text-xs text-gray-500">Normal</label>
            <input
              type="text"
              value={partyColor}
              onChange={(e) => setPartyColor(e.target.value)}
              maxLength={7}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="color"
            value={partyColorLight}
            onChange={(e) => setPartyColorLight(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border border-gray-300"
          />
          <div className="flex-1">
            <label className="text-xs text-gray-500">Lys</label>
            <input
              type="text"
              value={partyColorLight}
              onChange={(e) => setPartyColorLight(e.target.value)}
              maxLength={7}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 font-mono"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="color"
            value={partyColorDark}
            onChange={(e) => setPartyColorDark(e.target.value)}
            className="w-10 h-10 rounded cursor-pointer border border-gray-300"
          />
          <div className="flex-1">
            <label className="text-xs text-gray-500">Mørk</label>
            <input
              type="text"
              value={partyColorDark}
              onChange={(e) => setPartyColorDark(e.target.value)}
              maxLength={7}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900 font-mono"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <div className="w-8 h-8 rounded-full border border-gray-200" style={{ backgroundColor: partyColorLight }} title="Lys" />
          <div className="w-8 h-8 rounded-full border border-gray-200" style={{ backgroundColor: partyColor }} title="Normal" />
          <div className="w-8 h-8 rounded-full border border-gray-200" style={{ backgroundColor: partyColorDark }} title="Mørk" />
        </div>
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
        disabled={pending || uploadingProfile || uploadingLogo}
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
