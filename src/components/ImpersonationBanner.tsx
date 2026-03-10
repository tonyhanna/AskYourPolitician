"use client";

import { useRouter } from "next/navigation";
import { stopImpersonation } from "@/app/admin/actions";

export function ImpersonationBanner({ politicianName }: { politicianName: string }) {
  const router = useRouter();

  async function handleStop() {
    await stopImpersonation();
    router.push("/admin");
  }

  return (
    <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-3 mb-6 flex items-center justify-between">
      <span className="text-sm font-medium text-yellow-800">
        Admin: Du ser dashboardet som <strong>{politicianName}</strong>
      </span>
      <button
        onClick={handleStop}
        className="px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700 transition cursor-pointer"
      >
        Stop impersonering
      </button>
    </div>
  );
}
