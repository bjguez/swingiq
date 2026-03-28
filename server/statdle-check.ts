import { db } from "./db";
import { statlePlayers } from "../shared/schema";

const rows = await db.select().from(statlePlayers);
console.log("Players in DB:", rows.length);
process.exit(0);
