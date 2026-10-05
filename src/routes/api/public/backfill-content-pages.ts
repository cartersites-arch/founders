import { createFileRoute } from "@tanstack/react-router";
import { createMaintenanceHandlers } from "@/server/maintenance-handlers";
import { readLimitedJson } from "@/lib/limited-json";
import { runBackfillContentPages } from "@/server/backfill-content-pages.server";

// Authenticated POST only. Never accept database service-role credentials.
export const Route = createFileRoute("/api/public/backfill-content-pages")({
  server: {
    handlers: createMaintenanceHandlers(
      async (request) => {
        const body = await readLimitedJson(request);
        if (!body || typeof body !== "object" || Array.isArray(body)) {
          return new Response("Invalid JSON object", { status: 400 });
        }
        const adminToken = request.headers.get("authorization")!.slice(7);
        return Response.json(await runBackfillContentPages({ ...body, adminToken }));
      },
      { secret: () => process.env.BACKFILL_ADMIN_TOKEN },
    ),
  },
});
