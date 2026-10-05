import { createMaintenanceHandlers } from "@/server/maintenance-handlers";
import { createFileRoute } from "@tanstack/react-router";
import { runListingSync } from "@/server/listing-sync.server";

export const Route = createFileRoute("/api/public/hooks/sync-listings")({
  server: {
    handlers: createMaintenanceHandlers(async () => Response.json(await runListingSync())),
  },
});
