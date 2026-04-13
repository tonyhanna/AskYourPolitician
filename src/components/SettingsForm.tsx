"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUpload, faCheck } from "@fortawesome/free-solid-svg-icons";
import { upload } from "@vercel/blob/client";
import { updateSettings } from "@/app/politiker/dashboard/actions";
import { generateSlug } from "@/lib/utils";

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
  appUrl,
  partySlug,
}: {
  politician: PoliticianData;
  allParties: PartyOption[];
  googleEmail: string;
  googleName: string;
  appUrl?: string | null;
  partySlug?: string | null;
}) {
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  // Committed URLs (already uploaded / from DB)
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(politician?.profilePhotoUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState(politician?.bannerUrl ?? "");
  const [ogImageUrl, setOgImageUrl] = useState(politician?.ogImageUrl ?? "");
  const [bannerBgColor, setBannerBgColor] = useState(politician?.bannerBgColor ?? "");
  // Pending files (not yet uploaded — deferred to submit)
  const [pendingProfileFile, setPendingProfileFile] = useState<File | null>(null);
  const [pendingBannerFile, setPendingBannerFile] = useState<File | null>(null);
  const [pendingOgFile, setPendingOgFile] = useState<File | null>(null);
  // Local preview URLs
  const [profilePreview, setProfilePreview] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");
  const [ogPreview, setOgPreview] = useState("");
  const [heroLine1Color, setHeroLine1Color] = useState(politician?.heroLine1Color ?? "");
  const [heroLine2Color, setHeroLine2Color] = useState(politician?.heroLine2Color ?? "");
  const [chatbaseId, setChatbaseId] = useState(politician?.chatbaseId ?? "");
  const [chatbaseRemoved, setChatbaseRemoved] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [bannerError, setBannerError] = useState("");
  const [ogError, setOgError] = useState("");
  const [profileRemoved, setProfileRemoved] = useState(false);
  const [bannerBgColorPrev, setBannerBgColorPrev] = useState("");
  const [bannerRemoved, setBannerRemoved] = useState(false);
  const [ogRemoved, setOgRemoved] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [profileSelectHover, setProfileSelectHover] = useState(false);
  const [bannerSelectHover, setBannerSelectHover] = useState(false);
  const [ogSelectHover, setOgSelectHover] = useState(false);
  const [firstName, setFirstName] = useState(politician?.firstName ?? googleName.split(" ")[0] ?? "");
  const [middleName, setMiddleName] = useState(politician?.middleName ?? "");
  const [lastName, setLastName] = useState(politician?.lastName ?? (googleName.split(" ").length > 1 ? googleName.split(" ").slice(-1)[0] : "") ?? "");
  const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const computedSlug = generateSlug(fullName);
  const uniqueUrl = appUrl && partySlug && computedSlug ? `${appUrl}/${partySlug}/${computedSlug}` : null;
  const [heroLine1Text, setHeroLine1Text] = useState(politician?.heroLine1 ?? "");
  const [heroLine2Text, setHeroLine2Text] = useState(politician?.heroLine2 ?? "");

  // Hero text preview auto-scale (mirrors BannerHero logic)
  const heroTextRef = useRef<HTMLDivElement>(null);
  const heroContainerRef = useRef<HTMLDivElement>(null);
  const [heroScale, setHeroScale] = useState(1);

  const computeHeroScale = useCallback(() => {
    const text = heroTextRef.current;
    const container = heroContainerRef.current;
    if (!text || !container) return;
    text.style.transform = "scale(1)";
    const naturalWidth = text.scrollWidth;
    const cs = getComputedStyle(container);
    const availableWidth = container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const newScale = naturalWidth > availableWidth ? availableWidth / naturalWidth : 1;
    text.style.transform = `scale(${newScale})`;
    setHeroScale(newScale);
  }, []);

  useEffect(() => {
    if (!bannerUrl || (!heroLine1Text && !heroLine2Text)) return;
    computeHeroScale();
    window.addEventListener("resize", computeHeroScale);
    return () => window.removeEventListener("resize", computeHeroScale);
  }, [bannerUrl, heroLine1Text, heroLine2Text, heroLine1Color, heroLine2Color, computeHeroScale]);

  // Resolve color key ("accent"/"light"/"dark") to hex
  const selectedParty = allParties.find((p) => p.id === (politician?.partyId ?? ""));
  function resolveHeroColor(colorKey: string): string {
    if (!colorKey || !selectedParty) return "#FF0000";
    if (colorKey === "accent") return selectedParty.color || "#FF0000";
    if (colorKey === "light") return selectedParty.colorLight || "#FF0000";
    if (colorKey === "dark") return selectedParty.colorDark || "#FF0000";
    return "#FF0000";
  }

  function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.src = URL.createObjectURL(file);
    });
  }

  async function handleImageSelect(
    file: File,
    setPendingFile: (f: File | null) => void,
    setPreview: (url: string) => void,
    opts?: { minWidth?: number; minHeight?: number; exactRatio?: [number, number]; setError?: (msg: string) => void; errorMessage?: string },
  ) {
    const { minWidth, minHeight, exactRatio, setError, errorMessage } = opts ?? {};
    const showError = (msg: string) => setError ? setError(msg) : undefined;
    const clearError = () => setError ? setError("") : undefined;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 10 * 1024 * 1024) {
      showError("Billedet er for stort (maks 10 MB)");
      return;
    }
    // Validate dimensions + ratio
    if (minWidth || minHeight || exactRatio) {
      const dims = await getImageDimensions(file);
      let invalid = false;
      if (minWidth && dims.width < minWidth) invalid = true;
      if (minHeight && dims.height < minHeight) invalid = true;
      if (exactRatio) {
        const expectedRatio = exactRatio[0] / exactRatio[1];
        const actualRatio = dims.width / dims.height;
        if (Math.abs(actualRatio - expectedRatio) > 0.02) invalid = true;
      }
      if (invalid) {
        showError(errorMessage || `Billedet skal minimum være ${minWidth} x ${minHeight}px.`);
        return;
      }
    }
    clearError();
    setPendingFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function uploadFile(file: File, crop: boolean, folder: string): Promise<string> {
    const toUpload = crop ? await cropToSquare(file) : file;
    const blob = await upload(`${folder}/${toUpload.name}`, toUpload, {
      access: "public",
      handleUploadUrl: "/api/upload",
    });
    return blob.url;
  }

  async function handleSubmit(formData: FormData) {
    // Client-side validation
    const missingFirst = !firstName.trim();
    const missingLast = !lastName.trim();
    const missingEmail = !(formData.get("email") as string)?.trim();
    if (missingFirst || missingLast || missingEmail) {
      const namePart = missingFirst && missingLast ? "Navn" : missingFirst ? "Fornavn" : missingLast ? "Efternavn" : "";
      const emailPart = missingEmail ? (namePart ? "e-mail" : "E-mail") : "";
      const parts = [namePart, emailPart].filter(Boolean);
      setSubmitError(parts.join(" og ") + " er påkrævet");
      return;
    }
    setPending(true);
    try {
      // Upload pending files now
      let finalProfileUrl = profilePhotoUrl;
      let finalBannerUrl = bannerUrl;
      let finalOgUrl = ogImageUrl;
      if (pendingProfileFile) {
        finalProfileUrl = await uploadFile(pendingProfileFile, true, "politicians");
        setProfilePhotoUrl(finalProfileUrl);
        setPendingProfileFile(null);
        setProfilePreview("");
      }
      if (pendingBannerFile) {
        finalBannerUrl = await uploadFile(pendingBannerFile, false, "politicians");
        setBannerUrl(finalBannerUrl);
        setPendingBannerFile(null);
        setBannerPreview("");
      }
      if (pendingOgFile) {
        finalOgUrl = await uploadFile(pendingOgFile, false, "politicians");
        setOgImageUrl(finalOgUrl);
        setPendingOgFile(null);
        setOgPreview("");
      }
      // Override hidden field values with final URLs
      formData.set("profilePhotoUrl", finalProfileUrl);
      formData.set("bannerUrl", finalBannerUrl);
      formData.set("ogImageUrl", finalOgUrl);
      setSubmitError("");
      await updateSettings(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Der opstod en fejl");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit}>
      <input type="hidden" name="profilePhotoUrl" value={profileRemoved ? "" : profilePhotoUrl} />
      <input type="hidden" name="bannerUrl" value={bannerRemoved ? "" : bannerUrl} />
      <input type="hidden" name="ogImageUrl" value={ogRemoved ? "" : ogImageUrl} />
      <input type="hidden" name="bannerBgColor" value={bannerBgColor} />
      <input type="hidden" name="heroLine1Color" value={heroLine1Color} />
      <input type="hidden" name="heroLine2Color" value={heroLine2Color} />
      {/* Party is managed by admin only — pass as hidden field */}
      <input type="hidden" name="partyId" value={politician?.partyId ?? ""} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* ── Column 1: Profile, Name, Email, Constituency, Upvote Goal, Chatbase ── */}
        <div className="space-y-6">
          {/* Profilbillede */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
              Profilbillede
            </label>
            <div className="flex items-center gap-4">
              {(profilePreview || (profilePhotoUrl && !profileRemoved)) ? (
                <img
                  src={profilePreview || profilePhotoUrl}
                  alt="Profilbillede"
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-center text-xs" style={{ backgroundColor: "var(--system-bg1, #FF0000)", color: "var(--system-text2, #FF0000)", fontFamily: "var(--font-figtree)" }}>
                  Intet<br />billede
                </div>
              )}
              <div>
                {pendingProfileFile ? (
                  <div className="flex items-center gap-3">
                    <label
                      className="text-sm cursor-pointer"
                      style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}
                      onMouseEnter={() => setProfileSelectHover(true)}
                      onMouseLeave={() => setProfileSelectHover(false)}
                    >
                      <FontAwesomeIcon icon={profileSelectHover ? faUpload : faCheck} style={{ fontSize: profileSelectHover ? 15 : 14, marginRight: 4, ...(profileSelectHover ? { position: "relative" as const, top: 1 } : {}) }} />{profileSelectHover ? "Vælg nyt billede" : "Nyt billede valgt"}
                      <input
                        type="file"
                        accept="image/*"
    
                        className="hidden"
                        disabled={pending}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageSelect(file, setPendingProfileFile, setProfilePreview, { minWidth: 512, minHeight: 512, setError: setProfileError });
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => { setPendingProfileFile(null); setProfilePreview(""); setProfileError(""); }}
                      className="text-sm cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                    >
                      Fortryd
                    </button>
                  </div>
                ) : profileRemoved ? (
                  <div className="flex items-center gap-3">
                    <span className="text-sm" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Profilbillede fjernet</span>
                    <button
                      type="button"
                      onClick={() => setProfileRemoved(false)}
                      className="text-sm cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                    >
                      Fortryd
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <label className="text-sm cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}>
                      <FontAwesomeIcon icon={faUpload} style={{ fontSize: 15, marginRight: 4, position: "relative" as const, top: 1 }} />Vælg billede
                      <input
                        type="file"
                        accept="image/*"
    
                        className="hidden"
                        disabled={pending}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageSelect(file, setPendingProfileFile, setProfilePreview, { minWidth: 512, minHeight: 512, setError: setProfileError });
                        }}
                      />
                    </label>
                    {profilePhotoUrl && (
                      <button
                        type="button"
                        onClick={() => { setProfileRemoved(true); setProfileError(""); }}
                        className="text-sm cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                      >
                        Fjern
                      </button>
                    )}
                  </div>
                )}
                <p className="text-xs mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Mindst 512 x 512 px. Auto-croppes til firkantet.</p>
                {profileError && profileError.split("\n").map((line, i) => <p key={i} className="text-xs mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-error, #FF0000)" }}>{line}</p>)}
              </div>
            </div>
          </div>

          {/* Navn */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Navn</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <input
                  name="firstName"
                  type="text"
                  placeholder="Fornavn(e)"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm placeholder:opacity-100"
                  style={{ backgroundColor: "var(--system-form-bg1, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none", fontFamily: "var(--font-figtree)" }}
                />
              </div>
              <div>
                <input
                  name="middleName"
                  type="text"
                  placeholder="Mellemnavn(e)"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm placeholder:opacity-100"
                  style={{ backgroundColor: "var(--system-form-bg1, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none", fontFamily: "var(--font-figtree)" }}
                />
              </div>
              <div>
                <input
                  name="lastName"
                  type="text"
                  placeholder="Efternavn(e)"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm placeholder:opacity-100"
                  style={{ backgroundColor: "var(--system-form-bg1, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none", fontFamily: "var(--font-figtree)" }}
                />
              </div>
            </div>
            {/* Din unikke adresse */}
            {uniqueUrl && (
              <p className="text-xs mt-2" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
                Din unikke adresse:{" "}
                <a
                  href={uniqueUrl}
                  className="underline"
                  style={{ color: "var(--system-success, #FF0000)" }}
                  target="_blank"
                >
                  {uniqueUrl}
                </a>
              </p>
            )}
          </div>

          {/* E-mail */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              defaultValue={politician?.email ?? googleEmail}
              className="w-full rounded-lg px-3 py-2 text-sm placeholder:opacity-100"
                  style={{ backgroundColor: "var(--system-form-bg1, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none", fontFamily: "var(--font-figtree)" }}
            />
          </div>

          {/* Kreds */}
          <div>
            <label htmlFor="constituency" className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
              Kreds
            </label>
            <input
              id="constituency"
              name="constituency"
              type="text"
              defaultValue={politician?.constituency ?? ""}
              placeholder="F.eks. Københavns Storkreds"
              className="w-full rounded-lg px-3 py-2 text-sm placeholder:opacity-100"
                  style={{ backgroundColor: "var(--system-form-bg1, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none", fontFamily: "var(--font-figtree)" }}
            />
          </div>

          {/* Standard upvote-mål */}
          <div>
            <label htmlFor="defaultUpvoteGoal" className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
              Standard upvote-mål
            </label>
            <input
              id="defaultUpvoteGoal"
              name="defaultUpvoteGoal"
              type="number"
              min={1}
              defaultValue={politician?.defaultUpvoteGoal ?? 1000}
              className="w-full rounded-lg px-3 py-2 text-sm placeholder:opacity-100"
                  style={{ backgroundColor: "var(--system-form-bg1, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none", fontFamily: "var(--font-figtree)" }}
            />
            <p className="text-xs mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Standard antal upvotes der kræves, når du opretter nye spørgsmål.</p>
          </div>

          {/* Chatbase */}
          <div>
            <label htmlFor="chatbaseEmbed" className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
              Chatbase bot embed-kode
            </label>
            <input type="hidden" name="chatbaseId" value={chatbaseRemoved ? "" : chatbaseId} />
            <textarea
              id="chatbaseEmbed"
              rows={4}
              defaultValue=""
              placeholder={chatbaseId && !chatbaseRemoved ? "Allerede konfigureret. Paste ny embed-kode her for at opdatere." : "Gå til Chatbase › Deploy › Embed, og paste hele script-koden her."}
              className="w-full rounded-lg px-3 py-2 text-sm font-mono placeholder:opacity-100"
              style={{ backgroundColor: "var(--system-form-bg1, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
              onChange={(e) => {
                const val = e.target.value;
                const match = val.match(/script\.id\s*=\s*"([^"]+)"/);
                if (match) {
                  setChatbaseId(match[1]);
                  setChatbaseRemoved(false);
                }
              }}
            />
            {chatbaseId && !chatbaseRemoved ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Chatbot-ID fundet: <span style={{ color: "var(--system-success, #FF0000)" }}>{chatbaseId}</span></span>
                <button
                  type="button"
                  onClick={() => setChatbaseRemoved(true)}
                  className="text-xs cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                >
                  Fjern
                </button>
              </div>
            ) : chatbaseRemoved ? (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Chatbot fjernet</span>
                <button
                  type="button"
                  onClick={() => setChatbaseRemoved(false)}
                  className="text-xs cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                >
                  Fortryd
                </button>
              </div>
            ) : (
              <p className="text-xs mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Vi udtrækker selv dit Chatbot-ID fra koden</p>
            )}
          </div>
        </div>

        {/* ── Column 2: Welcome text, Hero banner, Banner bg color, OG image ── */}
        <div className="space-y-6">
          {/* Velkomsttekst */}
          <div>
            <label className="block font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", fontSize: 18, color: "var(--system-text2, #FF0000)" }}>
              Velkomstbanner (valgfrit)
            </label>
            <p className="text-xs mb-2" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Disse tekster vises ovenpå et banner øverst på borgersiden. Vælg en partifarve for hver linje.</p>
            {[
              { name: "heroLine1", colorState: heroLine1Color, setColor: setHeroLine1Color, value: heroLine1Text, setValue: setHeroLine1Text, placeholder: "Linje 1" },
              { name: "heroLine2", colorState: heroLine2Color, setColor: setHeroLine2Color, value: heroLine2Text, setValue: setHeroLine2Text, placeholder: "Linje 2" },
            ].map((line) => {
              const partyColorOptions = selectedParty
                ? [
                    { key: "accent", hex: selectedParty.color },
                    { key: "light", hex: selectedParty.colorLight },
                    { key: "dark", hex: selectedParty.colorDark },
                  ].filter((c) => c.hex) as { key: string; hex: string }[]
                : [];
              return (
                <div key={line.name} className="flex items-center gap-2 mb-2">
                  <input
                    name={line.name}
                    type="text"
                    value={line.value}
                    onChange={(e) => line.setValue(e.target.value)}
                    placeholder={line.placeholder}
                    className="flex-1 rounded-lg px-3 py-2 text-sm placeholder:opacity-100"
                    style={{ backgroundColor: "var(--system-form-bg1, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none", fontFamily: "var(--font-figtree)" }}
                  />
                  <div className="flex items-center gap-1">
                    {partyColorOptions.map(({ key, hex }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => line.setColor(key)}
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

          {/* Hero banner */}
          <div>
            {(bannerPreview || (bannerUrl && !bannerRemoved)) ? (
              <div className="relative rounded-lg overflow-hidden mb-2">
                <img
                  src={bannerPreview || bannerUrl}
                  alt="Hero banner"
                  className="w-full block"
                />
                {/* Live hero text preview — mirrors BannerHero layout */}
                {(heroLine1Text || heroLine2Text) && (
                  <div
                    ref={heroContainerRef}
                    className="absolute top-0 bottom-0 right-0 w-[60%] flex items-center justify-end pr-[48px] sm:pr-6 pointer-events-none"
                  >
                    <div
                      ref={heroTextRef}
                      className="flex flex-col items-end whitespace-nowrap"
                      style={{ transform: `scale(${heroScale})`, transformOrigin: "right center" }}
                    >
                      {heroLine1Text && (
                        <span
                          className="leading-tight text-[18px] sm:text-[30px]"
                          style={{
                            fontFamily: "var(--font-figtree)",
                            fontWeight: 500,
                            color: resolveHeroColor(heroLine1Color),
                          }}
                        >
                          {heroLine1Text}
                        </span>
                      )}
                      {heroLine2Text && (
                        <span
                          className="leading-tight text-[18px] sm:text-[30px]"
                          style={{
                            fontFamily: "var(--font-figtree)",
                            fontWeight: 500,
                            color: resolveHeroColor(heroLine2Color),
                          }}
                        >
                          {heroLine2Text}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full aspect-[4/1] rounded-lg flex items-center justify-center text-xs mb-2" style={{ backgroundColor: "var(--system-bg1, #FF0000)", color: "var(--system-text2, #FF0000)", fontFamily: "var(--font-figtree)" }}>
                Intet velkomstbanner baggrundsbillede
              </div>
            )}
            <div className="flex items-center gap-3">
              {pendingBannerFile ? (
                <>
                  <label
                    className="text-sm cursor-pointer"
                    style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}
                    onMouseEnter={() => setBannerSelectHover(true)}
                    onMouseLeave={() => setBannerSelectHover(false)}
                  >
                    <FontAwesomeIcon icon={bannerSelectHover ? faUpload : faCheck} style={{ fontSize: bannerSelectHover ? 15 : 14, marginRight: 4, ...(bannerSelectHover ? { position: "relative" as const, top: 1 } : {}) }} />{bannerSelectHover ? "Vælg nyt banner" : "Nyt banner valgt"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={pending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageSelect(file, setPendingBannerFile, setBannerPreview, { minWidth: 1584, minHeight: 396, exactRatio: [4, 1], setError: setBannerError, errorMessage: "Billedet er ikke stort nok eller har forkerte proportioner\n— skal minimum være 1584 x 396 px, eller det dobbelte, tredobbelte eller mere." });
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => { setPendingBannerFile(null); setBannerPreview(""); setBannerError(""); }}
                    className="text-sm cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                  >
                    Fortryd
                  </button>
                </>
              ) : bannerRemoved ? (
                <>
                  <span className="text-sm" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Baggrundsbillede fjernet</span>
                  <button
                    type="button"
                    onClick={() => setBannerRemoved(false)}
                    className="text-sm cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                  >
                    Fortryd
                  </button>
                </>
              ) : (
                <>
                  <label className="text-sm cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}>
                    <FontAwesomeIcon icon={faUpload} style={{ fontSize: 15, marginRight: 4, position: "relative" as const, top: 1 }} />Vælg banner baggrundsbillede
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={pending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageSelect(file, setPendingBannerFile, setBannerPreview, { minWidth: 1584, minHeight: 396, exactRatio: [4, 1], setError: setBannerError, errorMessage: "Billedet er ikke stort nok eller har forkerte proportioner\n— skal minimum være 1584 x 396 px, eller det dobbelte, tredobbelte eller mere." });
                      }}
                    />
                  </label>
                  {bannerUrl && (
                    <button
                      type="button"
                      onClick={() => { setBannerRemoved(true); setBannerError(""); }}
                      className="text-sm cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                    >
                      Fjern
                    </button>
                  )}
                </>
              )}
            </div>
            <p className="text-xs mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Minimum: 1584 × 396 px.</p>
            {bannerError && bannerError.split("\n").map((line, i) => <p key={i} className="text-xs mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-error, #FF0000)" }}>{line}</p>)}
          </div>

          {/* Hero banner baggrundsfarve */}
          {((bannerUrl && !bannerRemoved) || bannerPreview) && (
            <div>
              <label htmlFor="bannerBgColor" className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
                Banner baggrundsfarve (valgfrit)
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="bannerBgColor"
                  type="color"
                  value={bannerBgColor || "#ffffff"}
                  onChange={(e) => setBannerBgColor(e.target.value)}
                  className="w-10 h-10 rounded border border-gray-300 cursor-pointer p-0.5"
                />
                <span className="text-sm" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>{bannerBgColor || "Ingen (auto-detect)"}</span>
                {bannerBgColor ? (
                  <button
                    type="button"
                    onClick={() => { setBannerBgColorPrev(bannerBgColor); setBannerBgColor(""); }}
                    className="text-sm cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                  >
                    Nulstil til auto
                  </button>
                ) : bannerBgColorPrev ? (
                  <button
                    type="button"
                    onClick={() => { setBannerBgColor(bannerBgColorPrev); setBannerBgColorPrev(""); }}
                    className="text-sm cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                  >
                    Fortryd
                  </button>
                ) : null}
              </div>
              <p className="text-xs mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
                Farven forlænger banneret til skærmens kanter. Lad stå tom for automatisk at matche billedets hjørnefarve.
              </p>
            </div>
          )}

          {/* Socialt delingsbillede (OpenGraph) */}
          <div>
            <label className="block font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", fontSize: 18, color: "var(--system-text2, #FF0000)" }}>
              Socialt delingsbillede (OpenGraph)
            </label>
            <p className="text-xs mb-2" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Vises når dit link deles på sociale medier.</p>
            {(ogPreview || (ogImageUrl && !ogRemoved)) ? (
              <img
                src={ogPreview || ogImageUrl}
                alt="OpenGraph billede"
                className="w-full rounded-lg mb-2"
              />
            ) : (
              <div className="w-full rounded-lg flex items-center justify-center text-xs mb-2" style={{ aspectRatio: "1200/630", backgroundColor: "var(--system-bg1, #FF0000)", color: "var(--system-text2, #FF0000)", fontFamily: "var(--font-figtree)" }}>
                Intet delingsbillede
              </div>
            )}
            <div className="flex items-center gap-3">
              {pendingOgFile ? (
                <>
                  <label
                    className="text-sm cursor-pointer"
                    style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}
                    onMouseEnter={() => setOgSelectHover(true)}
                    onMouseLeave={() => setOgSelectHover(false)}
                  >
                    <FontAwesomeIcon icon={ogSelectHover ? faUpload : faCheck} style={{ fontSize: ogSelectHover ? 15 : 14, marginRight: 4, ...(ogSelectHover ? { position: "relative" as const, top: 1 } : {}) }} />{ogSelectHover ? "Vælg nyt billede" : "Nyt billede valgt"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={pending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageSelect(file, setPendingOgFile, setOgPreview, { minWidth: 1200, minHeight: 630, exactRatio: [1200, 630], setError: setOgError, errorMessage: "Billedet er ikke stort nok eller har forkerte proportioner\n— skal minimum være 1200 x 630 px, eller det dobbelte, tredobbelte eller mere." });
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => { setPendingOgFile(null); setOgPreview(""); setOgError(""); }}
                    className="text-sm cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                  >
                    Fortryd
                  </button>
                </>
              ) : ogRemoved ? (
                <>
                  <span className="text-sm" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Delingsbillede fjernet</span>
                  <button
                    type="button"
                    onClick={() => setOgRemoved(false)}
                    className="text-sm cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                  >
                    Fortryd
                  </button>
                </>
              ) : (
                <>
                  <label className="text-sm cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}>
                    <FontAwesomeIcon icon={faUpload} style={{ fontSize: 15, marginRight: 4, position: "relative" as const, top: 1 }} />Vælg billede
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={pending}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageSelect(file, setPendingOgFile, setOgPreview, { minWidth: 1200, minHeight: 630, exactRatio: [1200, 630], setError: setOgError, errorMessage: "Billedet er ikke stort nok eller har forkerte proportioner\n— skal minimum være 1200 x 630 px, eller det dobbelte, tredobbelte eller mere." });
                      }}
                    />
                  </label>
                  {ogImageUrl && (
                    <button
                      type="button"
                      onClick={() => { setOgRemoved(true); setOgError(""); }}
                      className="text-sm cursor-pointer hover:opacity-50 transition-opacity" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
                    >
                      Fjern
                    </button>
                  )}
                </>
              )}
            </div>
            <p className="text-xs mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Minimum: 1200 × 630 px.</p>
            {ogError && ogError.split("\n").map((line, i) => <p key={i} className="text-xs mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-error, #FF0000)" }}>{line}</p>)}
          </div>
        </div>
      </div>

      {/* Sticky FAB save button + error banner */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">
        {submitError && (
          <div
            className="rounded-full px-5 flex items-center"
            style={{
              height: 56,
              backgroundColor: "color-mix(in srgb, var(--system-bg0, #FF0000) 85%, transparent)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <p className="text-sm" style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)", whiteSpace: "nowrap" }}>{submitError}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={pending}
          className="group rounded-full px-6 disabled:opacity-50 disabled:pointer-events-none cursor-pointer flex items-center gap-2"
          style={{ height: 56, fontFamily: "var(--font-figtree)", fontWeight: 500, fontSize: 14, backgroundColor: "var(--fab-btn-bg, #FF0000)", color: "var(--fab-btn-icon, #FF0000)", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)" }}
        >
          <span className="group-hover:opacity-50 transition-opacity flex items-center gap-2">
            {pending ? "Gemmer..." : saved ? <><FontAwesomeIcon icon={faCheck} />Gemt</> : <><FontAwesomeIcon icon={faCheck} />Gem</>}
          </span>
        </button>
      </div>
    </form>
  );
}
