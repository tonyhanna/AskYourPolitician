"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function SuccessBanner() {
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [isError, setIsError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setMessage("Din upvote er registreret!");
      setIsError(false);
      setVisible(true);
    } else if (searchParams.get("suggestion_verified") === "true") {
      setMessage("Dit forslag er bekræftet og sendt til politikeren!");
      setIsError(false);
      setVisible(true);
    } else if (searchParams.get("already_upvoted") === "true") {
      setMessage("Du har allerede upvotet dette spørgsmål");
      setIsError(true);
      setVisible(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible || !message) return null;

  return (
    <div
      className="w-full py-3 text-center text-sm transition-opacity duration-300 sticky top-0"
      style={{
        fontFamily: "var(--font-funnel-sans)",
        fontWeight: 500,
        backgroundColor: isError ? "#FEE2E2" : "#ffffff",
        color: isError ? "#991B1B" : "#2E2E2E",
        borderBottom: isError ? "2px solid #F87171" : "none",
        zIndex: 60,
      }}
    >
      {message}
    </div>
  );
}
