import { describe, expect, it } from 'vitest';
import { parseCustomPageSource } from '../../src/utils/custom-page-source.js';

describe('parseCustomPageSource', () => {
  it('extracts body and style from full html document', () => {
    const parsed = parseCustomPageSource(`<!DOCTYPE html><html><head><title>Demo</title><meta name="description" content="demo description"><link rel="stylesheet" href="http://cdn.example.com/demo.css"><style>body{background:#000}.box{color:#fff}</style></head><body id="app-root"><div class="box">hello</div><script src="http://cdn.example.com/jquery.js"></script><script>console.log(1)</script></body></html>`);

    expect(parsed.title).toBe('Demo');
    expect(parsed.description).toBe('demo description');
    expect(parsed.stylesheets).toEqual(['https://cdn.example.com/demo.css']);
    expect(parsed.scripts).toHaveLength(2);
    expect(parsed.scripts[0].src).toBe('https://cdn.example.com/jquery.js');
    expect(parsed.scripts[1].content).toContain('console.log(1)');
    expect(parsed.html).toContain('custom-page-body');
    expect(parsed.html).toContain('id="app-root"');
    expect(parsed.html).toContain('<div class="box">hello</div>');
    expect(parsed.html).not.toContain('<script');
    expect(parsed.css).toContain('.custom-page-body{background:#000}');
    expect(parsed.css).toContain('.box{color:#fff}');
  });

  it('keeps fragment html usable while extracting style tags', () => {
    const parsed = parseCustomPageSource('<style>.a{color:red}</style><section class="a">x</section>');

    expect(parsed.html).toContain('<section class="a">x</section>');
    expect(parsed.css).toContain('.a{color:red}');
  });
});
