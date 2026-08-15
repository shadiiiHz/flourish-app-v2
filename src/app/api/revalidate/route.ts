import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

/**
 * Lets the admin panel purge the public catalog cache immediately after a
 * mutation, instead of customers waiting out the 60s ISR window in
 * src/lib/api.ts. The secret is intentionally client-exposed (NEXT_PUBLIC_*)
 * — worst case it lets someone force extra revalidations, not read or
 * change data — which is an acceptable tradeoff for this endpoint.
 */
export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  const expected = process.env.REVALIDATE_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }

  revalidateTag("catalog");
  return NextResponse.json({ revalidated: true });
}
