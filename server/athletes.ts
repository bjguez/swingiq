import type { Express } from "express";
import { storage } from "./storage";
import type { User } from "@shared/schema";

export function setupAthleteRoutes(app: Express) {
  // GET /api/athletes — list all athletes for the logged-in parent
  app.get("/api/athletes", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (user.accountType !== "parent") return res.status(403).json({ message: "Parent account required" });
      const athletes = await storage.getAthletesByParent(user.id);
      res.json(athletes);
    } catch (err) { next(err); }
  });

  // POST /api/athletes — create a new athlete profile
  app.post("/api/athletes", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (user.accountType !== "parent") return res.status(403).json({ message: "Parent account required" });
      const { firstName, lastName, age, bats, throws: throwsHand, skillLevel, city, state } = req.body;
      if (!firstName?.trim() || !lastName?.trim()) {
        return res.status(400).json({ message: "First and last name are required" });
      }
      const athlete = await storage.createAthlete({
        parentUserId: user.id,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        age: age ? Number(age) : null,
        bats: bats || null,
        throws: throwsHand || null,
        skillLevel: skillLevel || null,
        city: city?.trim() || null,
        state: state || null,
      });
      res.status(201).json(athlete);
    } catch (err) { next(err); }
  });

  // PUT /api/athletes/:id — update an athlete profile
  app.put("/api/athletes/:id", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      const athlete = await storage.getAthlete(req.params.id);
      if (!athlete) return res.status(404).json({ message: "Athlete not found" });
      if (athlete.parentUserId !== user.id) return res.status(403).json({ message: "Forbidden" });
      const { firstName, lastName, age, bats, throws: throwsHand, skillLevel, city, state } = req.body;
      const updated = await storage.updateAthlete(req.params.id, {
        ...(firstName !== undefined && { firstName: firstName.trim() }),
        ...(lastName !== undefined && { lastName: lastName.trim() }),
        age: age ? Number(age) : null,
        bats: bats || null,
        throws: throwsHand || null,
        skillLevel: skillLevel || null,
        city: city?.trim() || null,
        state: state || null,
      });
      res.json(updated);
    } catch (err) { next(err); }
  });

  // DELETE /api/athletes/:id
  app.delete("/api/athletes/:id", async (req, res, next) => {
    try {
      const user = req.user as User | undefined;
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      const athlete = await storage.getAthlete(req.params.id);
      if (!athlete) return res.status(404).json({ message: "Athlete not found" });
      if (athlete.parentUserId !== user.id) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteAthlete(req.params.id);
      res.json({ ok: true });
    } catch (err) { next(err); }
  });
}
