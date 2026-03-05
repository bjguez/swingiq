import { db } from "./db";
import { mlbPlayers, videos, drills } from "@shared/schema";

async function seed() {
  console.log("Seeding database...");

  // Check if already seeded
  const existing = await db.select().from(mlbPlayers);
  if (existing.length > 0) {
    console.log("Database already seeded, skipping.");
    process.exit(0);
  }

  const [trout, ohtani, judge, bregman, betts, altuve] = await db.insert(mlbPlayers).values([
    {
      name: "Mike Trout",
      team: "LAA",
      position: "CF",
      bats: "R",
      height: "6'2\"",
      weight: 235,
      savantId: "545361",
      avgExitVelo: 91.9,
      maxExitVelo: 114.4,
      barrelPct: 15.3,
      hardHitPct: 51.0,
      avgExitVeloPercentile: 94,
      maxExitVeloPercentile: 96,
      barrelPctPercentile: 98,
      hardHitPctPercentile: 92,
      batSpeed: 76.2,
      attackAngle: 12.5,
      rotationalAccel: 22.1,
    },
    {
      name: "Shohei Ohtani",
      team: "LAD",
      position: "DH",
      bats: "L",
      height: "6'4\"",
      weight: 210,
      savantId: "660271",
      avgExitVelo: 93.3,
      maxExitVelo: 118.7,
      barrelPct: 18.1,
      hardHitPct: 54.2,
      avgExitVeloPercentile: 97,
      maxExitVeloPercentile: 99,
      barrelPctPercentile: 99,
      hardHitPctPercentile: 96,
      batSpeed: 78.5,
      attackAngle: 14.8,
      rotationalAccel: 24.3,
    },
    {
      name: "Aaron Judge",
      team: "NYY",
      position: "RF",
      bats: "R",
      height: "6'7\"",
      weight: 282,
      savantId: "592450",
      avgExitVelo: 95.9,
      maxExitVelo: 117.4,
      barrelPct: 22.5,
      hardHitPct: 58.7,
      avgExitVeloPercentile: 99,
      maxExitVeloPercentile: 99,
      barrelPctPercentile: 99,
      hardHitPctPercentile: 99,
      batSpeed: 80.1,
      attackAngle: 16.2,
      rotationalAccel: 25.8,
    },
    {
      name: "Alex Bregman",
      team: "HOU",
      position: "3B",
      bats: "R",
      height: "6'0\"",
      weight: 192,
      savantId: "608324",
      avgExitVelo: 88.1,
      maxExitVelo: 110.2,
      barrelPct: 8.5,
      hardHitPct: 38.9,
      avgExitVeloPercentile: 62,
      maxExitVeloPercentile: 75,
      barrelPctPercentile: 65,
      hardHitPctPercentile: 48,
      batSpeed: 72.8,
      attackAngle: 8.3,
      rotationalAccel: 18.4,
    },
    {
      name: "Mookie Betts",
      team: "LAD",
      position: "SS",
      bats: "R",
      height: "5'9\"",
      weight: 180,
      savantId: "605141",
      avgExitVelo: 89.5,
      maxExitVelo: 112.1,
      barrelPct: 10.2,
      hardHitPct: 42.3,
      avgExitVeloPercentile: 76,
      maxExitVeloPercentile: 85,
      barrelPctPercentile: 78,
      hardHitPctPercentile: 68,
      batSpeed: 74.5,
      attackAngle: 10.1,
      rotationalAccel: 20.2,
    },
    {
      name: "Jose Altuve",
      team: "HOU",
      position: "2B",
      bats: "R",
      height: "5'6\"",
      weight: 166,
      savantId: "514888",
      avgExitVelo: 87.2,
      maxExitVelo: 109.8,
      barrelPct: 7.9,
      hardHitPct: 36.1,
      avgExitVeloPercentile: 52,
      maxExitVeloPercentile: 68,
      barrelPctPercentile: 55,
      hardHitPctPercentile: 38,
      batSpeed: 71.2,
      attackAngle: 7.8,
      rotationalAccel: 17.5,
    },
  ]).returning();

  await db.insert(videos).values([
    { title: "Trout - Explosive Gather", category: "Gather", playerId: trout.id, playerName: "Mike Trout", source: "MLB.com", duration: "0:12", fps: 120, isProVideo: true },
    { title: "Trout - Full Swing vs RHP", category: "Full Swings", playerId: trout.id, playerName: "Mike Trout", source: "MLB.com", duration: "0:18", fps: 120, isProVideo: true },
    { title: "Bregman - Ideal Hand Path", category: "Hand Path", playerId: bregman.id, playerName: "Alex Bregman", source: "MLB.com", duration: "0:08", fps: 120, isProVideo: true },
    { title: "Bregman - Hip Hinge Gather", category: "Gather", playerId: bregman.id, playerName: "Alex Bregman", source: "YouTube", duration: "0:15", fps: 60, isProVideo: true },
    { title: "Ohtani - Perfect Touchdown", category: "Touchdown", playerId: ohtani.id, playerName: "Shohei Ohtani", source: "MLB.com", duration: "0:15", fps: 120, isProVideo: true },
    { title: "Ohtani - Full Swing 118mph HR", category: "Full Swings", playerId: ohtani.id, playerName: "Shohei Ohtani", source: "MLB.com", duration: "0:22", fps: 120, isProVideo: true },
    { title: "Judge - Powerful Thrust", category: "Thrust", playerId: judge.id, playerName: "Aaron Judge", source: "MLB.com", duration: "0:10", fps: 120, isProVideo: true },
    { title: "Judge - Head Position on Slider", category: "Head Position", playerId: judge.id, playerName: "Aaron Judge", source: "YouTube", duration: "0:12", fps: 60, isProVideo: true },
    { title: "Betts - Compact Swing Mechanics", category: "Full Swings", playerId: betts.id, playerName: "Mookie Betts", source: "MLB.com", duration: "0:22", fps: 120, isProVideo: true },
    { title: "Betts - Scissor Kick Isolation", category: "Scissor Kick", playerId: betts.id, playerName: "Mookie Betts", source: "MLB.com", duration: "0:09", fps: 120, isProVideo: true },
    { title: "Altuve - Scissor Kick Power", category: "Scissor Kick", playerId: altuve.id, playerName: "Jose Altuve", source: "MLB.com", duration: "0:14", fps: 120, isProVideo: true },
    { title: "Altuve - Gather and Load", category: "Gather", playerId: altuve.id, playerName: "Jose Altuve", source: "YouTube", duration: "0:11", fps: 60, isProVideo: true },
  ]);

  await db.insert(drills).values([
    {
      name: "Step-Back Tee Drill",
      phase: "Gather",
      reps: "15 Reps",
      description: "Teaches proper weight transfer and loading during the gather phase.",
      steps: [
        "Start with feet together, slightly wider than shoulder width.",
        "Step your back foot backward, feeling the weight load into the inside of your back thigh.",
        "Without pausing, take your normal stride forward and swing.",
      ],
    },
    {
      name: "Med Ball Rotational Throws",
      phase: "Thrust",
      reps: "3x8 Reps",
      description: "Using a 4-6lb medicine ball, mimic your load and stride, then throw the ball explosively into a wall. Focus purely on sequencing your hips before your shoulders.",
      steps: [
        "Stand sideways to a wall with a med ball at your back hip.",
        "Load into your back leg like a gather position.",
        "Rotate explosively, leading with your hips, and throw the ball into the wall.",
      ],
    },
    {
      name: "Front Foot Block Drill",
      phase: "Touchdown",
      reps: "12 Reps",
      description: "Develop a firm front side to maximize energy transfer at touchdown.",
      steps: [
        "Set up on a tee with an elevated front foot (on a small plate or plank).",
        "Take your stride and focus on bracing your front leg upon landing.",
        "Swing through, keeping your head still and centered.",
      ],
    },
    {
      name: "Top Hand Release Drill",
      phase: "Hand Path",
      reps: "10 Reps",
      description: "Improve hand path by isolating the lead arm through contact.",
      steps: [
        "Set up on a tee with your normal stance.",
        "Swing through and release your top hand at contact point.",
        "Focus on keeping the barrel in the zone as long as possible with just your bottom hand.",
      ],
    },
    {
      name: "Freeze Frame Head Drill",
      phase: "Head Position",
      reps: "10 Reps",
      description: "Lock in head position to improve pitch tracking and contact quality.",
      steps: [
        "Have a partner soft toss from the side.",
        "Focus on keeping your chin on your front shoulder throughout the swing.",
        "After contact, freeze and check — your head should still be looking at the contact point.",
      ],
    },
    {
      name: "Scissor Kick Walk-Throughs",
      phase: "Scissor Kick",
      reps: "8 Reps",
      description: "Build the feel for proper lower body mechanics through the swing.",
      steps: [
        "Take your normal stance without a bat.",
        "Perform your gather and stride in slow motion.",
        "After foot strike, let your back foot naturally scissors/rotate through.",
        "Repeat at increasing speeds, then add the bat.",
      ],
    },
  ]);

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((e) => {
  console.error("Seed error:", e);
  process.exit(1);
});