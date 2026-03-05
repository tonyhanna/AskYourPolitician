"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export function SuccessBanner() {
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(false);

  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setMessage("Din upvote er registreret!");
      setVisible(true);
    } else if (searchParams.get("suggestion_verified") === "true") {
      setMessage("Dit forslag er bekræftet og sendt til politikeren!");
      setVisible(true);
    }
    if (visible) {
      const timer = setTimeout(() => setVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  if (!visible || !message) return null;

  return (
    <div className="bg-green-100 border border-green-300 text-green-800 px-4 py-3 rounded-lg mb-6 text-sm font-medium">
      {message}
    </div>
  );
}
