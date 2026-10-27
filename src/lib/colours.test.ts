import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { AIR, LEVEL_COLOR, LEVEL_TEXT_LIGHT, PM25_COLORS, TONE_COLOR, TONE_MARK, airMark, textOn } from "@/lib/bands";
import { FIRE_COLOR } from "@/lib/replay";

/** WCAG contrast of two `#rrggbb` colours. */
function luminance(hex: string) {
  const lin = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
}
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** `fg` at `alpha` over `bg`. */
function over(fg: string, bg: string, alpha: number) {
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  return "#" + [1, 3, 5].map((i) => Math.round(ch(fg, i) * alpha + ch(bg, i) * (1 - alpha)).toString(16).padStart(2, "0")).join("");
}

/** The site's colour tokens in globals.css, light and dark. */
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const block = (selector: string) => css.slice(css.indexOf(selector)).match(/\{([^}]*)\}/)![1];
const tokens = (body: string) => Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6}|transparent)/gi)].map((m) => [m[1], m[2]]));
const light = tokens(block(":root {"));
const dark = { ...light, ...tokens(block(':root[data-theme="dark"]')) };
const themes = { light, dark } as const;

const TEXT = 4.5;
const MARK = 3;

test("the dark tokens are the same as the dark media query's", () => {
  const media = tokens(block(':root:not([data-theme="light"])'));
  for (const [k, v] of Object.entries(media)) assert.equal(v, dark[k], k);
});

test("body text, muted text and the level text colours are 4.5:1 on the page and on a card, in both themes", () => {
  for (const [name, t] of Object.entries(themes))
    for (const ink of ["fg", "soft", "muted", "lv0", "lv2", "lv3", "lv4", "rain", "uv"])
      for (const ground of ["bg", "surface"]) assert.ok(contrast(t[ink], t[ground]) >= TEXT, `${name}: ${ink} on ${ground} ${contrast(t[ink], t[ground]).toFixed(2)}`);
});

test("muted text is also 4.5:1 on a line-coloured chip, and the Singapore outline's label on it", () => {
  for (const [name, t] of Object.entries(themes)) {
    assert.ok(contrast(t.muted, t.line) >= TEXT, `${name}: muted on line ${contrast(t.muted, t.line).toFixed(2)}`);
    assert.ok(contrast(t["on-sg-border"], t["sg-border"]) >= TEXT, `${name}: on-sg-border`);
  }
});

test("a primary button (page colour on ink) and the focus ring (ink) have the contrast they need", () => {
  for (const [name, t] of Object.entries(themes)) {
    assert.ok(contrast(t.bg, t.fg) >= TEXT, `${name}: button text`);
    for (const ground of ["bg", "surface", "line"]) assert.ok(contrast(t.fg, t[ground]) >= MARK, `${name}: focus ring on ${ground}`);
  }
});

test("the air-level marks are one colour with the hero's fills, 3:1 on the page and on a card in both themes (the edge carries it for amber on light and red on dark), and their text is 4.5:1", () => {
  assert.deepEqual(TONE_MARK, { go: TONE_COLOR.go.bg, easy: TONE_COLOR.easy.bg, limit: TONE_COLOR.limit.bg, stay: TONE_COLOR.stay.bg });
  for (const [name, t] of Object.entries(themes))
    for (const [level, c] of Object.entries(AIR))
      for (const ground of ["bg", "surface"]) {
        const edge = /var\((--edge-[a-z]+)\)/.exec(airMark(c).boxShadow ?? "")?.[1].slice(2);
        const edgeless = contrast(c, t[ground]) >= MARK;
        // Where the fill is under 3:1 the mark has an edge colour that is, and where it is not the edge stays clear.
        if (edgeless) assert.ok(!edge || t[edge] === "transparent", `${name}: ${level} on ${ground} needs no edge`);
        else assert.ok(edge && t[edge] !== "transparent" && contrast(t[edge], t[ground]) >= MARK, `${name}: ${level} on ${ground} ${contrast(c, t[ground]).toFixed(2)} needs an edge of 3:1`);
      }
  for (const c of Object.values(AIR)) assert.ok(contrast(c, textOn(c)) >= TEXT, `text on ${c} ${contrast(c, textOn(c)).toFixed(2)}`);
});

test("the server images' level text colours are the light --lv tokens, 4.5:1 on the page", () => {
  assert.deepEqual(LEVEL_TEXT_LIGHT, [light.lv0, light.lv0, light.lv2, light.lv3, light.lv4]);
  for (const c of LEVEL_TEXT_LIGHT) assert.ok(contrast(c, light.bg) >= TEXT, c);
});

test("blue is rain's and violet UV's: the air levels use neither, and Good and Moderate share one green", () => {
  assert.deepEqual(LEVEL_COLOR, [AIR.green, AIR.green, AIR.amber, AIR.orange, AIR.red]);
  assert.deepEqual(PM25_COLORS, [AIR.green, AIR.amber, AIR.orange, AIR.red]);
  for (const c of [...LEVEL_COLOR, FIRE_COLOR]) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    assert.ok(b < Math.max(r, g) + 1, `${c} is not blue`);
  }
});

test("the rain and UV marks are 3:1 on a card in both themes, drawn the way each mark is", () => {
  for (const [name, t] of Object.entries(themes)) {
    for (const mark of ["rain", "uv"]) assert.ok(contrast(t[mark], t.surface) >= MARK, `${name}: ${mark}`);
    assert.ok(contrast(over(t.rain, t.surface, 0.85), t.surface) >= MARK, `${name}: the forecast's rain bars`);
  }
});

test("the forecast accuracy bars (ink, softer ink, grey) are 3:1 on a card", () => {
  for (const [name, t] of Object.entries(themes))
    for (const [ink, alpha] of [["fg", 1], ["fg", 0.65], ["muted", 0.8]] as const) assert.ok(contrast(over(t[ink], t.surface, alpha), t.surface) >= MARK, `${name}: ${ink} at ${alpha}`);
});

test("the hero's verdict colours carry their ink, and the softer 90% ink the labels use, at 4.5:1", () => {
  for (const [tone, { bg, fg }] of Object.entries(TONE_COLOR)) {
    assert.ok(contrast(bg, fg) >= TEXT, `${tone}: ink`);
    assert.ok(contrast(over(fg, bg, 0.9), bg) >= TEXT, `${tone}: softer ink ${contrast(over(fg, bg, 0.9), bg).toFixed(2)}`);
    // The unselected group buttons: softer ink on the tray, which is 16% black (white ink) or white (dark ink) over the colour.
    const tray = over(fg === "#ffffff" ? "#000000" : "#ffffff", bg, 0.16);
    assert.ok(contrast(over(fg, tray, 0.9), tray) >= TEXT, `${tone}: group buttons ${contrast(over(fg, tray, 0.9), tray).toFixed(2)}`);
  }
});

test("a fire (ember black in a white ring) shows on a light card and on a dark one", () => {
  for (const [name, t] of Object.entries(themes)) assert.ok(contrast("#ffffff", FIRE_COLOR) >= MARK && contrast(t.surface, FIRE_COLOR) >= 1, name);
  assert.ok(contrast("#ffffff", FIRE_COLOR) >= 12);
});
