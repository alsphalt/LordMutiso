import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Error thrown inside route handlers; converted to a JSON response. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg: string) => new ApiError(400, msg);
export const unauthorized = (msg = "Authentication required") => new ApiError(401, msg);
export const forbidden = (msg = "You are not allowed to do that") => new ApiError(403, msg);
export const notFound = (msg = "Not found") => new ApiError(404, msg);
export const conflict = (msg: string) => new ApiError(409, msg);
export const tooMany = (msg = "Slow down — you are sending messages too fast") => new ApiError(429, msg);

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, ...data }, init);
}

export function fail(message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** Safely parse a JSON request body. Throws ApiError(400). */
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const text = await req.text();
    if (!text) return {};
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new ApiError(400, "Invalid request body");
    }
    return parsed as Record<string, unknown>;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(400, "Invalid JSON body");
  }
}

/** First user-facing message from a ZodError. */
export function zodMessage(e: ZodError): string {
  return e.issues[0]?.message ?? "Invalid input";
}

export interface RouteCtx {
  params: Record<string, string>;
}

type Handler = (req: Request, ctx: RouteCtx) => Promise<Response>;

/**
 * Wrap a route handler with uniform error handling.
 * Never leaks raw DB errors to the client (always a generic 500 message).
 */
export function handle(handler: Handler) {
  return async (req: Request, ctx: RouteCtx = { params: {} }): Promise<Response> => {
    try {
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
      }
      if (e instanceof ZodError) {
        return NextResponse.json({ ok: false, error: zodMessage(e) }, { status: 400 });
      }
      console.error("[api]", e);
      return NextResponse.json(
        { ok: false, error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }
  };
}

/** Only allow one HTTP method per route with a shared handler map. */
export function methodNotAllowed(allowed: string[]): Response {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405, headers: { Allow: allowed.join(", ") } });
}
