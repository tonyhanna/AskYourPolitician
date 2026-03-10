"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { BannerHero } from "./BannerHero";

export function IntroSection({
  politicianFirstName,
  bannerUrl,
  bannerBgColor,
  heroLine1,
  heroLine1Color,
  heroLine2,
  heroLine2Color,
}: {
  politicianFirstName: string;
  bannerUrl?: string | null;
  bannerBgColor?: string | null;
  heroLine1?: string | null;
  heroLine1Color?: string | null;
  heroLine2?: string | null;
  heroLine2Color?: string | null;
}) {
  const [dismissed, setDismissed] = useState(true); // default true to avoid flash
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const d = localStorage.getItem("intro-dismissed") === "1";
    setDismissed(d);
    setLoaded(true);
  }, []);

  // Listen for "show-intro" event from info button in QuestionFeedFilter
  useEffect(() => {
    const handler = () => {
      setDismissed(false);
      localStorage.removeItem("intro-dismissed");
    };
    window.addEventListener("show-intro", handler);
    return () => window.removeEventListener("show-intro", handler);
  }, []);

  function dismiss() {
    setDismissed(true);
    localStorage.setItem("intro-dismissed", "1");
    window.dispatchEvent(new Event("intro-dismissed"));
  }

  return (
    <>
      {/* Banner */}
      {bannerUrl && (
        <BannerHero
          bannerUrl={bannerUrl}
          bannerBgColor={bannerBgColor}
          heroLine1={heroLine1}
          heroLine1Color={heroLine1Color}
          heroLine2={heroLine2}
          heroLine2Color={heroLine2Color}
        />
      )}

      {/* Intro box */}
      {loaded && !dismissed && (
        <div className="max-w-2xl mx-auto px-[15px] mt-4">
          <div
            className="relative p-6 pr-14"
            style={{
              backgroundColor: "#F6F6F5",
              borderRadius: "20px",
              fontFamily: "var(--font-dm-sans)",
              fontWeight: 500,
            }}
          >
            {/* Close button */}
            <button
              onClick={dismiss}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundColor: "#E8E7E5" }}
              aria-label="Luk"
            >
              <FontAwesomeIcon
                icon={faXmark}
                className="text-sm"
                style={{ color: "#7E7D7A" }}
              />
            </button>

            {/* Title */}
            <h3
              className="mb-3"
              style={{ color: "#7E7D7A", fontSize: "25px" }}
            >
              Første gang du er her?
            </h3>

            {/* Numbered list */}
            <ol
              className="list-decimal pl-6 space-y-1.5 text-base"
              style={{ color: "#2E2E2E" }}
            >
              <li>
                <strong>Upvote spørgsmål</strong> du synes er vigtige at få
                besvaret af {politicianFirstName} — eller{" "}
                <strong>foreslå dine egne spørgsmål</strong>
              </li>
              <li>
                Når et spørgsmål når sit upvote-mål, vil {politicianFirstName}{" "}
                besvare det
              </li>
              <li>Alle svar er enten i video eller lyd</li>
              <li>
                Hvis du upvoter et spørgsmål, får du en e-mail når det bliver
                besvaret
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
}
