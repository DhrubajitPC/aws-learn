import { readFileSync, writeFileSync } from 'node:fs';

const p = new URL('../docs/index.html', import.meta.url);
let h = readFileSync(p, 'utf8');

const FROM = `/* Sepia: aged paper for long reading sessions. Lower contrast than the light
   theme and no blue in the ground, which is the point of a sepia mode. Ink is
   dark walnut rather than black so the contrast is soft without going muddy;
   it still clears WCAG AA on the paper ground. */
:root[data-theme="sepia"] {
  color-scheme: light;
  --paper:#EFE4CE; --surface:#F7EEDC; --surface-2:#E3D5B8;
  --ink:#332A1C; --ink-soft:#5B4A33; --ink-faint:#756345;
  --rule:#D7C7A6; --rule-soft:#E5D8BD;
  --accent:#2C4C7A; --accent-ink:#1F3757; --accent-wash:#E0DED2;
  --ochre:#7A5A12; --ochre-wash:#EDDFBB;
  --oxide:#98371F; --oxide-wash:#EFDAC9;
  --moss:#3D6340; --moss-wash:#E0E4CB;
  /* Dark walnut instead of the cool slate used by the other light theme. */
  --code-bg:#2A2117; --code-ink:#E6DBC5; --code-rule:#3E3324;
}`;

const TO = `/* Sepia: aged paper, tuned for reading at length in a dim room rather than
   for looking bright on a showroom monitor.

   The ground sits at 0.61 relative luminance against 0.85 for the light theme,
   so roughly 28% less light reaching your eye. That is the whole point of the
   mode; a sepia theme that merely tints a bright white ground still glares.
   Ink is dark walnut rather than black, which keeps the contrast high without
   the hard edge of pure black on warm paper. Every text pair clears WCAG AA
   and body copy is 9.75:1. */
:root[data-theme="sepia"] {
  color-scheme: light;
  --paper:#DACCAD; --surface:#E4D8BC; --surface-2:#C6B492;
  --ink:#2B2317; --ink-soft:#514229; --ink-faint:#61502C;
  --rule:#B7A47E; --rule-soft:#CBBA97;
  --accent:#274465; --accent-ink:#1A2E46; --accent-wash:#CDC9BA;
  --ochre:#68490B; --ochre-wash:#D6C39A;
  --oxide:#872D15; --oxide-wash:#DCC0AA;
  --moss:#325436; --moss-wash:#CBD2AD;
  /* Deep walnut, not the cool slate the light theme uses. A cool panel on a
     warm ground reads as a different design pasted in. */
  --code-bg:#241D14; --code-ink:#E0D4BC; --code-rule:#382E20;
}`;

if (!h.includes(FROM)) throw new Error('sepia block not found');
h = h.replace(FROM, TO);
writeFileSync(p, h);
console.log('sepia darkened: paper #EFE4CE -> #DACCAD (luminance 0.783 -> 0.611)');
