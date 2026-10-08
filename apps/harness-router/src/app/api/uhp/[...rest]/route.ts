import { handle, notFound } from "@/server/uhp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Every non-2xx carries the error envelope, unknown routes included.
const missing = handle(async (req: Request) => {
  throw notFound("not_found", `Route ${new URL(req.url).pathname}`);
});
export { missing as GET, missing as POST };
