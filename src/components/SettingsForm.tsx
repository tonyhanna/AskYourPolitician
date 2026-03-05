"use client";

import { useState } from "react";
import { updateSettings } from "@/app/politiker/dashboard/actions";

type PoliticianData = {
  name: string;
  party: string | null;
  email: string;
  slug: string;
} | null;

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

  async function handleSubmit(formData: FormData) {
    setPending(true);
    try {
      await updateSettings(formData);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
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
      <button
        type="submit"
        disabled={pending}
        className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 cursor-pointer"
      >
        {pending ? "Gemmer..." : "Gem indstillinger"}
      </button>
    </form>
  );
}
