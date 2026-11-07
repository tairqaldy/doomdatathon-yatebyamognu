# Visual references

Saved at the user's request for future consideration. These are references only; no landing page or integration is requested.

| Component | User's link | Pinned upstream source (TypeScript + CSS) |
|---|---|---|
| Gooey Nav | https://reactbits.dev/components/gooey-nav | [Component](https://github.com/DavidHDev/react-bits/blob/4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4/src/ts-default/Components/GooeyNav/GooeyNav.tsx) · [CSS](https://github.com/DavidHDev/react-bits/blob/4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4/src/ts-default/Components/GooeyNav/GooeyNav.css) |
| Card Nav | https://reactbits.dev/c/components/card-nav | [Component](https://github.com/DavidHDev/react-bits/blob/4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4/src/ts-default/Components/CardNav/CardNav.tsx) · [CSS](https://github.com/DavidHDev/react-bits/blob/4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4/src/ts-default/Components/CardNav/CardNav.css) |

Source revision: `4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4`. Card Nav's user-provided page could not be opened by our browser tool; its source was retrieved from the upstream repository.

These are React components. Card Nav imports Hugeicons packages. The current project rules favor a light static frontend and require a decision before adding a heavy framework. No dependencies were installed.

The [upstream license](https://github.com/DavidHDev/react-bits/blob/4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4/LICENSE.md) permits use as part of an application subject to its conditions, but restricts redistribution of the components themselves. Keep the license with any permitted copies. References are linked here; standalone source copies are not published in this repository.

## Gradient ASCII background: Freedom green direction

- Reference: https://reactbits.dev/backgrounds/gradient-ascii
- Pinned upstream: [TypeScript component](https://github.com/DavidHDev/react-bits/blob/4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4/src/ts-default/Backgrounds/GradientASCII/GradientASCII.tsx) · [CSS](https://github.com/DavidHDev/react-bits/blob/4dc7b5b7772e1217c8fb8d2a7aa074302180e5b4/src/ts-default/Backgrounds/GradientASCII/GradientASCII.css).
- Design direction: a green-black `dark-primary #0C1411` field with a luminous, flowing ASCII texture. Use existing Freedom tokens: `brand-primary #00B323` as the main green, `brand-secondary #13AD64` for depth, and `brand-additional #00E183` as the bright neon accent. Keep any text on a separate, solid high-contrast surface.
- Treat the effect as decorative, with restrained motion and a static fallback for reduced-motion and unsupported WebGL. Avoid placing it behind dense scores, transcripts or evidence.
- The upstream component exposes a `colors` prop and uses WebGL. No colors were applied, component integrated, or landing page built; this is a proposed visual direction only. Follow the [Freedom design system](design-system.md) and verify readability and performance if the effect is used later.
