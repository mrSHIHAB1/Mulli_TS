import cron from "node-cron";
import { applyDecayToAllUsers } from "../modules/Clubhouse/clubhouse.points";

let isRunning = false;

/**
 * Runs every day at 02:00 AM UTC.
 * Applies -2%/day point decay to all users who have been
 * inactive for more than 3 days in the Clubhouse.
 *
 * Guards:
 * - Timezone pinned to UTC so behaviour is consistent across deployments.
 * - Overlap guard: if a previous run is still in progress the new tick is skipped.
 */
export const startClubhouseDecayCron = (): void => {
  cron.schedule(
    "0 2 * * *",
    async () => {
      if (isRunning) {
        console.warn("[ClubhouseCron] Previous run still in progress, skipping.");
        return;
      }

      isRunning = true;
      console.log("[ClubhouseCron] Running daily point decay...");

      try {
        const affectedCount = await applyDecayToAllUsers();
        console.log(
          `[ClubhouseCron] Daily point decay completed. Users processed: ${affectedCount}`
        );
      } catch (err: any) {
        console.error("[ClubhouseCron] Decay job failed:", err.message);
      } finally {
        isRunning = false;
      }
    },
    { timezone: "UTC" }
  );

  console.log("[ClubhouseCron] Daily decay cron scheduled (02:00 UTC every day)");
};