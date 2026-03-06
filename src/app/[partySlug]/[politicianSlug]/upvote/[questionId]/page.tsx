"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { submitUpvote } from "@/app/[partySlug]/[politicianSlug]/actions";

export default function UpvotePage() {
  const params = useParams<{
    partySlug: string;
    politicianSlug: string;
    questionId: string;
  }>();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [questionText, setQuestionText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const basePath = `/${params.partySlug}/${params.politicianSlug}`;

  useEffect(() => {
    fetch(`/api/questions/${params.questionId}`)
      .then((res) => res.json())
      .then((data) => setQuestionText(data.text))
      .catch(() => setError("Spørgsmål ikke fundet"));
  }, [params.questionId]);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    formData.set("questionId", params.questionId);
    formData.set("politicianSlug", params.politicianSlug);
    formData.set("partySlug", params.partySlug);

    try {
      const result = await submitUpvote(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setEmailSent(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Der opstod en fejl");
    } finally {
      setPending(false);
    }
  }

  if (error && !questionText) {
    return (
      <main className="max-w-md mx-auto p-6 mt-12">
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  if (emailSent) {
    return (
      <main className="max-w-md mx-auto p-6 mt-12 text-center space-y-4">
        <div className="text-4xl">📧</div>
        <h1 className="text-2xl font-bold">Tjek din email</h1>
        <p className="text-gray-600">
          Vi har sendt dig en bekræftelses-email. Klik på linket i emailen for
          at registrere din upvote.
        </p>
        <button
          onClick={() => router.push(basePath)}
          className="text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
        >
          Tilbage til spørgsmål
        </button>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto p-6 mt-12">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        {questionText ? (
          <h1 className="text-xl font-bold text-gray-900">{questionText}</h1>
        ) : (
          <div className="h-7 bg-gray-200 rounded animate-pulse" />
        )}

        <form action={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="firstName"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Fornavn
            </label>
            <input
              id="firstName"
              name="firstName"
              type="text"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50 cursor-pointer"
          >
            {pending ? "Sender..." : "Upvote"}
          </button>
        </form>

        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-700 cursor-pointer"
        >
          Tilbage
        </button>
      </div>
    </main>
  );
}
