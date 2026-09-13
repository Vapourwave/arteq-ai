import type { Express } from "express";
import { getHospitalMemory, setHospitalMemory, getWelcomeGreeting, setWelcomeGreeting } from "../services/hospital/hospitalService.js";

/**
  * Admin routes for hospital management and custom memory.
  */
export function attachAdminRoutes(app: Express) {
  app.get("/api/admin/memory", (_req, res) => {
    try {
      const memory = getHospitalMemory();
      res.json({ memory });
    } catch (err) {
      console.error("[admin] Failed to get hospital memory:", err);
      res.status(500).json({ error: "Failed to get hospital memory" });
    }
  });

  app.post("/api/admin/memory", (req, res) => {
    try {
      const memory = typeof req.body?.memory === "string" ? req.body.memory : "";
      const saved = setHospitalMemory(memory);
      console.log(`[admin] Saved hospital memory (${saved.length} chars)`);
      res.json({ success: true, memory: saved });
    } catch (err) {
      console.error("[admin] Failed to save hospital memory:", err);
      res.status(500).json({ error: "Failed to save hospital memory" });
    }
  });

  app.get("/api/admin/greeting", (_req, res) => {
    try {
      const greeting = getWelcomeGreeting();
      res.json({ greeting });
    } catch (err) {
      console.error("[admin] Failed to get welcome greeting:", err);
      res.status(500).json({ error: "Failed to get welcome greeting" });
    }
  });

  app.post("/api/admin/greeting", (req, res) => {
    try {
      const greeting = typeof req.body?.greeting === "string" ? req.body.greeting : "";
      const saved = setWelcomeGreeting(greeting);
      console.log(`[admin] Saved welcome greeting: "${saved}"`);
      res.json({ success: true, greeting: saved });
    } catch (err) {
      console.error("[admin] Failed to save welcome greeting:", err);
      res.status(500).json({ error: "Failed to save welcome greeting" });
    }
  });
}
