import { Worker } from "../types";

const worker: Worker = {
  name: "status-check",
  interval: 300000, // 5 minut
  execute: async () => {
    try {
      console.log("🔍 Running status check...");

      // Sprawdź użycie pamięci
      const memUsage = process.memoryUsage();
      const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);

      if (memUsedMB > 500) {
        // Ostrzeżenie jeśli pamięć > 500MB
        console.warn(`⚠️ High memory usage: ${memUsedMB}MB`);
      }

      // Sprawdź uptime
      const uptime = process.uptime();
      const uptimeHours = Math.floor(uptime / 3600);

      console.log(`📊 Status: Memory: ${memUsedMB}MB, Uptime: ${uptimeHours}h`);
    } catch (error) {
      console.error("❌ Status check worker error:", error);
    }
  },
};

export default worker;
