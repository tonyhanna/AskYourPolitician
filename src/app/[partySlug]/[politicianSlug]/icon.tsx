import { ImageResponse } from "next/og";
import { db } from "@/db";
import { politicians, parties } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon({
  params,
}: {
  params: Promise<{ partySlug: string; politicianSlug: string }>;
}) {
  const { partySlug, politicianSlug } = await params;

  const [politician] = await db
    .select({ partyId: politicians.partyId })
    .from(politicians)
    .where(
      and(
        eq(politicians.partySlug, partySlug),
        eq(politicians.slug, politicianSlug)
      )
    )
    .limit(1);

  let logoUrl: string | null = null;
  if (politician?.partyId) {
    const [party] = await db
      .select({ logoUrl: parties.logoUrl })
      .from(parties)
      .where(eq(parties.id, politician.partyId))
      .limit(1);
    logoUrl = party?.logoUrl ?? null;
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            width={64}
            height={64}
            style={{ borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              backgroundColor: "#3B82F6",
            }}
          />
        )}
      </div>
    ),
    { ...size }
  );
}
