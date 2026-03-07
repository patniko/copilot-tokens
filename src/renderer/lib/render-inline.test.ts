import { describe, it, expect } from 'vitest';
import { renderInline } from './render-inline';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function el(node: unknown): { type: string; key: string | null; props: Record<string, any> } {
  return node as { type: string; key: string | null; props: Record<string, any> };
}

describe('renderInline', () => {
  it('returns a single string element for plain text', () => {
    const result = renderInline('hello world');
    expect(result).toEqual(['hello world']);
  });

  it('returns an empty array for empty string', () => {
    expect(renderInline('')).toEqual([]);
  });

  it('renders inline code as a <code> element', () => {
    const result = renderInline('`foo`');
    expect(result).toHaveLength(1);
    const code = el(result[0]);
    expect(code.type).toBe('code');
    expect(code.props.children).toBe('foo');
  });

  it('renders bold as a <strong> element', () => {
    const result = renderInline('**text**');
    expect(result).toHaveLength(1);
    const strong = el(result[0]);
    expect(strong.type).toBe('strong');
    expect(strong.props.children).toBe('text');
  });

  it('renders italic as an <em> element', () => {
    const result = renderInline('*text*');
    expect(result).toHaveLength(1);
    const em = el(result[0]);
    expect(em.type).toBe('em');
    expect(em.props.children).toBe('text');
  });

  it('handles mixed formatting in correct sequence', () => {
    const result = renderInline('Hello `code` and **bold** and *italic* end');
    expect(result).toHaveLength(7);
    expect(result[0]).toBe('Hello ');
    expect(el(result[1]).type).toBe('code');
    expect(el(result[1]).props.children).toBe('code');
    expect(result[2]).toBe(' and ');
    expect(el(result[3]).type).toBe('strong');
    expect(el(result[3]).props.children).toBe('bold');
    expect(result[4]).toBe(' and ');
    expect(el(result[5]).type).toBe('em');
    expect(el(result[5]).props.children).toBe('italic');
    expect(result[6]).toBe(' end');
  });

  it('code element has correct className and style props', () => {
    const result = renderInline('`x`');
    const code = el(result[0]);
    expect(code.props.className).toBe('px-1 py-0.5 rounded text-[0.85em]');
    expect(code.props.style).toEqual({
      backgroundColor: 'rgba(255,255,255,0.1)',
      fontFamily: 'monospace',
    });
  });

  it('handles adjacent formatting with no gaps', () => {
    const result = renderInline('`a`**b***c*');
    expect(result).toHaveLength(3);
    expect(el(result[0]).type).toBe('code');
    expect(el(result[0]).props.children).toBe('a');
    expect(el(result[1]).type).toBe('strong');
    expect(el(result[1]).props.children).toBe('b');
    expect(el(result[2]).type).toBe('em');
    expect(el(result[2]).props.children).toBe('c');
  });

  it('handles formatting at the start of the string', () => {
    const result = renderInline('**bold** trailing');
    expect(result).toHaveLength(2);
    expect(el(result[0]).type).toBe('strong');
    expect(el(result[0]).props.children).toBe('bold');
    expect(result[1]).toBe(' trailing');
  });

  it('handles formatting at the end of the string', () => {
    const result = renderInline('leading *italic*');
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('leading ');
    expect(el(result[1]).type).toBe('em');
    expect(el(result[1]).props.children).toBe('italic');
  });

  it('preserves plain text between formatted sections', () => {
    const result = renderInline('aaa `b` ccc **d** eee');
    expect(result).toHaveLength(5);
    expect(result[0]).toBe('aaa ');
    expect(el(result[1]).type).toBe('code');
    expect(result[2]).toBe(' ccc ');
    expect(el(result[3]).type).toBe('strong');
    expect(result[4]).toBe(' eee');
  });

  it('handles multiple code spans in one string', () => {
    const result = renderInline('`a` then `b` then `c`');
    expect(result).toHaveLength(5);
    expect(el(result[0]).type).toBe('code');
    expect(el(result[0]).props.children).toBe('a');
    expect(result[1]).toBe(' then ');
    expect(el(result[2]).type).toBe('code');
    expect(el(result[2]).props.children).toBe('b');
    expect(result[3]).toBe(' then ');
    expect(el(result[4]).type).toBe('code');
    expect(el(result[4]).props.children).toBe('c');
  });

  it('handles nested-looking bold with code inside', () => {
    // The regex is non-greedy for bold (**(.+?)**) so **bold with `code`**
    // matches bold first, consuming "bold with `code`" as the bold content.
    const result = renderInline('**bold with `code` inside**');
    // Bold's .+? will match up to the first **, so it captures "bold with `code`"
    // then " inside" remains as trailing text plus stray **
    // Actually: ** uses .+? which stops at first **:
    //   **bold with `code`** inside**  — but input is **bold with `code` inside**
    //   .+? matches "bold with " then backtick code backtick " inside" greedily?
    //   No: .+? is non-greedy, finds shortest to next **. There's no inner ** so
    //   it matches the full content "bold with `code` inside".
    expect(result).toHaveLength(1);
    const strong = el(result[0]);
    expect(strong.type).toBe('strong');
    expect(strong.props.children).toBe('bold with `code` inside');
  });

  it('assigns incrementing keys to elements', () => {
    const result = renderInline('`a` **b** *c*');
    expect(el(result[0]).key).toBe('0');
    expect(el(result[2]).key).toBe('1');
    expect(el(result[4]).key).toBe('2');
  });
});
