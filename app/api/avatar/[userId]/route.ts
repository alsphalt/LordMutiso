import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/avatar/[userId]  — public, streams the stored avatar bytes.
 * Never 404s the UI: <img onError> fallbacks already handle it, and the URL
 * carries a ?v= cache-buster so re-uploads invalidate browser caches.
 */
export async function GET(_req: Request, { params }: { params: { userId?: string } }) {
  const userId = params?.userId;
  if (!userId || userId.length < 4 || userId.length > 64) {
    return new Response(null, { status: 404 });
  }

  try {
    const avatar = await prisma.userAvatar.findUnique({ where: { userId } });
    if (!avatar || !avatar.data) return new Response(null, { status: 404 });

    return new Response(new Uint8Array(avatar.data), {
      status: 200,
      headers: {
        "Content-Type": avatar.mime || "image/webp",
        "Content-Length": String(avatar.data.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    // DB hiccup — let the client fall back to the generated avatar.
    return new Response(null, { status: 404 });
  }
}
