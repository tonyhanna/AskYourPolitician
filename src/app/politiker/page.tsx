import { auth, signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function PolitikerLogin() {
  const session = await auth();
  if (session) redirect("/politiker/dashboard");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-xl shadow-sm">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Politiker Login</h1>
          <p className="text-gray-600 text-sm">
            Log ind for at administrere dine spørgsmål
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/politiker/dashboard" });
          }}
        >
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-medium cursor-pointer"
          >
            Log ind med Google
          </button>
        </form>
      </div>
    </main>
  );
}
