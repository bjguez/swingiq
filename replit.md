# SwingIQ - Baseball Swing Analysis Platform

## Overview
SwingIQ allows baseball players (ages 10+) to upload videos of their swings and compare them side-by-side with MLB players. It features real video playback, drawing/annotation tools, and data from Baseball Savant.

## Architecture
- **Frontend**: React + Vite + Tailwind v4 + shadcn/ui
- **Backend**: Express.js + PostgreSQL + Drizzle ORM
- **Routing**: wouter (frontend), Express (API)
- **State**: TanStack React Query

## Key Features
- **Analysis Tab**: Side-by-side video comparison with synced playback, drawing tools (pen, circle, rectangle, text), and per-player Savant stats
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
- `client/src/components/` - VideoComparison, VideoPlayer, DrawingCanvas, DataDashboard, VideoLibraryModal, Layout
- `server/` - Express routes, storage, database connection, seed script
- `shared/schema.ts` - Drizzle schema + Zod validation
- `uploads/` - uploaded video files