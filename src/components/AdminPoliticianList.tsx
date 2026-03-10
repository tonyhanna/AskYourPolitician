"use client";

import { useRouter } from "next/navigation";
import { startImpersonation } from "@/app/admin/actions";
import { useState } from "react";

type Politician = {
  id: string;
  name: string;
  party: string;
  partyId: string | null;
  email: string;
  profilePhotoUrl: string | null;
};

type PartyGroup = {
  party: string;
  partyId: string | null;
  politicians: Politician[];
};

export function AdminPoliticianList({ groups }: { groups: PartyGroup[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleImpersonate(politicianId: string) {
    setLoading(politicianId);
    try {
      await startImpersonation(politicianId);
      router.push("/politiker/dashboard");
    } catch {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.party}>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            {group.partyId ? (
              <a
                href={`/admin/party/${group.partyId}`}
                className="hover:text-blue-600 transition"
              >
                {group.party} &rarr;
              </a>
            ) : (
              <span className="text-red-600">{group.party}</span>
            )}
          </h2>
          <div className="space-y-2">
            {group.politicians.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex items-center justify-between"
              >
                <a
                  href={`/admin/politician/${p.id}`}
                  className="flex items-center gap-3 hover:opacity-80 transition"
                >
                  {p.profilePhotoUrl ? (
                    <img
                      src={p.profilePhotoUrl}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-medium">
                      {p.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-gray-900 hover:text-blue-600 transition">
                      {p.name} &rarr;
                    </div>
                    <div className="text-sm text-gray-500">{p.email}</div>
                  </div>
                </a>
                <button
                  onClick={() => handleImpersonate(p.id)}
                  disabled={loading === p.id}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition cursor-pointer disabled:opacity-50"
                >
                  {loading === p.id ? "Skifter..." : "Tag rolle"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
