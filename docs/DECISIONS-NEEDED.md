# Decisions Needed From Jeremy

Items that need your input before I can proceed. Check off and delete as you make decisions.

---

### 1. Office Redesign — Art Style
The isometric office needs proper sprites. Options:
- **A) Pure CSS/SVG** — Geometric shapes, fast to build, lightweight, but less charming
- **B) Pixel art sprites** — 32x32 or 64x64 sprite sheets, classic look, need to create/source assets
- **C) Higher-res illustrated** — More detailed SVG illustrations, modern look

**My recommendation:** Option A (CSS/SVG) for furniture + keep emoji agent circles. Fastest path to a good-looking office without sourcing pixel art assets. Can upgrade to pixel art later.

### 2. Production Deployment — Approach
How should MCC run in production?
- **A) Vite dev server + Express dev** (current, uses `npm run dev`)
- **B) Build client → Express serves static** (single process, `npm run build` then Express serves dist/)
- **C) Separate launchctl plists** (like old office-frontend/backend, two services)
- **D) Docker compose** (if you want containerization)

**My recommendation:** Option B — single process. Build Vite to static, have Express serve the dist/ folder. One launchctl plist, one port. Simplest production setup.

### 3. Old Office Services — Cleanup
The old `com.openclaw.office-backend` and `com.openclaw.office-frontend` plists still exist in ~/Library/LaunchAgents/. They're stopped but taking up space. Should I:
- **A) Delete the plists entirely** (you're using the new MCC dashboard now)
- **B) Leave them** (in case you need to fall back to the old dashboard)

---

*Delete this file when all decisions are made.*
