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

## Android

Two ways to get it on a phone:

1. **Install as an app (PWA)** — open the Pages URL in Chrome on Android → menu →
   **Install app**. Fullscreen, offline-capable, home-screen icon.
2. **Downloadable APK** — `.github/workflows/android-apk.yml` wraps the game with
   Capacitor and builds `prismfall.apk` in the cloud on every push to `main`.
   Grab it from the **Actions** run artifacts, or push a tag (`git tag v1.0 && git push --tags`)
   to attach it to a GitHub Release. The APK is debug-signed: enable
   "install unknown apps" on the device to sideload it.

To build locally instead: `npm run build && npx cap add android && npx cap sync`,
then open the `android/` folder in Android Studio and Build → Build APK.
