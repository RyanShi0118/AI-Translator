import { describe, expect, it } from 'vitest';
import { parseModelList } from '../src/background/llm';

describe('parseModelList', () => {
  it('reads the OpenAI { data: [{ id }] } shape, sorted and de-duplicated', () => {
    expect(parseModelList({ object: 'list', data: [{ id: 'gpt-4o' }, { id: 'deepseek-chat' }, { id: 'gpt-4o' }] })).toEqual([
      'deepseek-chat',
      'gpt-4o',
    ]);
  });
  it('accepts { models: [...] } and bare arrays of strings or { name }', () => {
    expect(parseModelList({ models: [{ name: 'llama3' }, 'qwen2'] })).toEqual(['llama3', 'qwen2']);
    expect(parseModelList(['b', 'a'])).toEqual(['a', 'b']);
  });
  it('returns [] for unexpected payloads', () => {
    expect(parseModelList(null)).toEqual([]);
    expect(parseModelList({ error: 'nope' })).toEqual([]);
  });
});
