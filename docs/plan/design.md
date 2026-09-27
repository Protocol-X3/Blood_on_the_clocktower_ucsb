# Visual design

**The frontend must be beautiful, not just functional.** Claude owns the art direction. It's a first-class requirement, so never ship default-looking shadcn/Tailwind screens.

Direction (**approved 2026-09-25** from the mockup): **"Candlelit grimoire" (烛光魔典)**

Reference mockup: https://claude.ai/artifact/D6thsxbB5z6XKrSyZRr6Em. It shows the player day vote, the player night role card, the card draw and the DM grimoire.

## Device targets

- **Player screens are mobile-first.** Players mostly use phones, so design for about 360–430px wide, touch targets of 44px or more, and one-handed use. Everything important must fit without horizontal scrolling. Laptop use only needs to work acceptably.
- **DM screens are designed for laptop and iPad** (about 1024px and up, landscape and portrait iPad). They can use dense multi-panel layouts, like the circle grimoire plus a side panel. On a phone, the DM view only needs a usable fallback.

## Themes

- **The DM grimoire always stays dark** (candlelit).
- **Player screens follow the phase:** parchment by day, midnight by night.

## Mood

- Dark ink/midnight backgrounds, parchment-textured cards, antique gold accents, blood crimson for evil and death.
- **Day and night change the ambient theme.** Night is deep blue with faint stars. Day is warm dusk and parchment tones.

## Team colors

These follow BotC convention, blue for good and red for evil.
- Townsfolk: blue
- Outsider: teal
- Minion: orange-red
- Demon: crimson

## Typography

Noto Serif SC (思源宋体) for headings and role names, and Noto Sans SC for body text.

## Signature motion moments

- the card-draw flip;
- the vote clock hand sweeping around the seat circle as votes lock;
- a death transition (portrait fades to grey, and a shroud marker appears).

## Grimoire layout

A circle of seats on laptop and iPad. On phones, it falls back to a compact list or grid.

## Role art

Don't bundle official role icons, which are the publisher's copyright. Use per-role image URLs when a script provides them, and otherwise a styled token showing one character of the role name (e.g. 占 for 占卜师).
