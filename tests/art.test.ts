import { describe, expect, it } from 'vitest';
import { CAT_POSES, catSvg } from '../src/art/cats';
import * as Props from '../src/art/props';
import { TOOL_ART } from '../src/art/toolIcons';
import { LEVELS } from '../src/levels';

/** Minimal XML well-formedness check: balanced tags, no duplicate attributes. */
function xmlProblems(svg: string): string[] {
  const problems: string[] = [];
  const stack: string[] = [];
  const tagRe = /<(\/?)([a-zA-Z][\w:-]*)([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(svg))) {
    const [, closing, name, attrs, selfClose] = m;
    if (closing) {
      if (stack.pop() !== name) problems.push(`unbalanced </${name}>`);
      continue;
    }
    const seen = new Set<string>();
    for (const a of attrs.matchAll(/([\w:-]+)="[^"]*"/g)) {
      if (seen.has(a[1])) problems.push(`duplicate attribute ${a[1]} on <${name}>`);
      seen.add(a[1]);
    }
    if (/NaN|undefined/.test(attrs)) problems.push(`bad value in <${name}${attrs}>`);
    if (!selfClose) stack.push(name);
  }
  if (stack.length) problems.push(`unclosed ${stack.join(',')}`);
  return problems;
}

describe('procedural art', () => {
  it('every cat in every pose is well-formed SVG', () => {
    for (const lvl of LEVELS)
      for (const c of lvl.cats)
        for (const pose of CAT_POSES) {
          expect(xmlProblems(catSvg(c.look, pose, { uid: 'x', hooks: true })), `${c.id}:${pose}`).toEqual([]);
        }
  });

  it('props, emotes and tool icons are well-formed SVG', () => {
    const list: [string, string][] = [
      ['bush', Props.bushSvg()],
      ['bushFront', Props.bushFrontSvg()],
      ['tree', Props.treeSvg(1)],
      ['rock', Props.rockSvg()],
      ['kibble', Props.kibbleSvg()],
      ['tuna', Props.tunaSvg()],
      ['toy', Props.toySvg()],
      ['mower', Props.mowerSvg()],
      ['radio', Props.radioSvg()],
      ['chimes', Props.chimesSvg()],
      ['shade', Props.shadeSvg()],
      ['flower', Props.flowerSvg(2)],
      ...(['food', 'question', 'alert', 'heart', 'toy', 'sleep'] as const).map((k) => [`emote:${k}`, Props.emoteSvg(k)] as [string, string]),
      ...Object.entries(TOOL_ART),
    ];
    for (const [name, svg] of list) expect(xmlProblems(svg), name).toEqual([]);
  });

  it('each cat has a unique look', () => {
    const looks = LEVELS.flatMap((l) => l.cats.map((c) => JSON.stringify(c.look)));
    expect(new Set(looks).size).toBe(looks.length);
  });
});
