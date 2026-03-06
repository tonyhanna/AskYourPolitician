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
    if (visible) {
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  if (!visible || !message) return null;

  return (
    <div
      className={`px-4 py-3 rounded-lg mb-6 text-sm font-medium border ${
        isError
          ? "bg-red-100 border-red-300 text-red-800"
          : "bg-green-100 border-green-300 text-green-800"
      }`}
    >
      {message}
    </div>
  );
}
