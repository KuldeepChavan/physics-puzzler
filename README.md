# PRISMFALL — Neon Physics Arcade

A polished, juicy physics-puzzler ball dropper for the browser. Drop the orb, ride the
bounces, chain pegs into a **x5 combo**, hunt the **golden drone**, and sink it in the
hot slot. Built with React, TypeScript, Canvas 2D, and Tailwind CSS — custom 120Hz
fixed-timestep physics, synthesized WebAudio SFX (no audio assets), and pre-baked glow
sprites for a locked 60fps on desktop and mobile.

## Play

- **Mouse / touch** — drag to aim, release to drop
- **Keyboard** — `A`/`D` or arrows to move, `Space` to drop, `P` pause, `R` restart, `M` mute

Combo pegs raise each ball's multiplier, pink bumpers kick hard, gold diamonds double it,
the golden drone awards +500x and a bonus ball, and every 7,500 points earns an extra ball.
High scores persist locally.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/ (single self-contained index.html)
```

## Deploy

The build is GitHub Pages–ready. A workflow in `.github/workflows/deploy.yml` builds and
publishes on every push to `main` — just set the repo's Pages source to **GitHub Actions**
under Settings → Pages.
