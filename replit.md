# SwingIQ - Baseball Swing Analysis Platform

## Overview
SwingIQ allows baseball players (ages 10+) to upload videos of their swings and compare them side-by-side with MLB players. It features real video playback, drawing/annotation tools, data from Baseball Savant, and AI-powered pose estimation.

## Architecture
- **Frontend**: React + Vite + Tailwind v4 + shadcn/ui
- **Backend**: Express.js + PostgreSQL + Drizzle ORM
- **Routing**: wouter (frontend), Express (API)
- **State**: TanStack React Query
- **Computer Vision**: MediaPipe PoseLandmarker (browser-side, WebAssembly)

## Key Features
- **Analysis Tab**: Side-by-side video comparison with synced playback, drawing tools (pen, line, circle, rectangle, angle measure, text, frame timer), per-player Savant stats, and "My Uploaded Swings" gallery below Pro Profile
- **Pose Detection**: MediaPipe-powered skeleton overlay on left video with 33-point body tracking, joint angle measurements (elbow, hip, knee, trunk, shoulder rotation), and auto swing phase classification
- **Development Tab**: Swing phase breakdown (Gather/Touchdown/Thrust/Contact/Post-Contact + Hand Path/Head Position/Scissor Kick) with pro model clips and drills from DB
- **Library Tab**: Filterable/searchable video database of pro swing clips by category
- **Video Upload**: Real file upload via multer → `/uploads/` directory, stored in `videos` table
- **Drawing Canvas**: HTML5 Canvas overlay on each video panel for annotations
- **Admin Portal**: Video management — upload files, set metadata (title, player, category/phase tag, source, FPS, duration, pro/amateur), inline edit, delete

## Database Schema (PostgreSQL)
- `users` - user accounts
- `mlb_players` - MLB player profiles with Savant stats (exit velo, barrel %, bat speed, attack angle, etc.)
- `videos` - both uploaded amateur and pro videos with category tagging
- `drills` - training drills organized by swing phase
- `sessions` - saved analysis sessions with annotations (JSON)

## API Routes
- `POST /api/upload` - video file upload (multer)
- `GET/POST /api/players` - MLB player CRUD
- `GET/POST /api/videos` - video CRUD with category/player filtering
- `GET/POST /api/drills` - drill CRUD with phase filtering
- `GET/POST/PATCH /api/sessions` - analysis session persistence

## File Structure
- `client/src/pages/` - Home (Analysis), Development, Library, Admin
- `client/src/components/` - VideoComparison, VideoPlayer, DrawingCanvas, PoseOverlay, DataDashboard, VideoLibraryModal, Layout
- `client/src/lib/poseDetector.ts` - MediaPipe pose detection, joint angle computation, swing phase classification
- `server/` - Express routes, storage, database connection, seed script
- `shared/schema.ts` - Drizzle schema + Zod validation
- `uploads/` - uploaded video files

## Pose Detection Details
- Uses `@mediapipe/tasks-vision` PoseLandmarker with "lite" model from CDN
- Runs in VIDEO mode via requestAnimationFrame loop when enabled
- 33 body landmarks tracked, skeleton rendered with upper body (green) / lower body (blue) color coding
- Joint angles computed: left/right elbow, shoulder, hip, knee, trunk angle, shoulder rotation
- Auto phase detection uses heuristic rules on hand position, hip angles, and knee bend
- Phase classifications: Gather, Touchdown, Thrust, Contact, Post-Contact
