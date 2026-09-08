import { AiUsageService } from './ai-usage.service';

/**
 * AI xarajat hisobi (computeCostUsd) — sof funksiya, DB kerak emas.
 * Narx jadvali: opus 5/25, sonnet 3/15, haiku 1/5 (USD / 1M token).
 * cache write = in*1.25, cache read = in*0.1.
 */
describe('AiUsageService.computeCostUsd', () => {
  const base = {
    feature: 'x',
    inputTokens: 0,
    outputTokens: 0,
  };

  it('opus: 1M in + 1M out = $5 + $25 = $30', () => {
    const usd = AiUsageService.computeCostUsd({
      ...base,
      model: 'claude-opus-4-8',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(usd).toBeCloseTo(30, 6);
  });

  it('haiku: 200k in + 50k out = $0.2 + $0.25 = $0.45', () => {
    const usd = AiUsageService.computeCostUsd({
      ...base,
      model: 'claude-haiku-4-5',
      inputTokens: 200_000,
      outputTokens: 50_000,
    });
    expect(usd).toBeCloseTo(0.45, 6);
  });

  it('sonnet: 1M in + 1M out = $3 + $15 = $18', () => {
    const usd = AiUsageService.computeCostUsd({
      ...base,
      model: 'claude-sonnet-4-6',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(usd).toBeCloseTo(18, 6);
  });

  it("sana/versiya suffiksiga bardosh — model nomi ichidagi kalit so'z", () => {
    const usd = AiUsageService.computeCostUsd({
      ...base,
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(usd).toBeCloseTo(1, 6); // haiku input narxi
  });

  it("noma'lum model -> opus narxi (ehtiyotkor, past baholanmaydi)", () => {
    const usd = AiUsageService.computeCostUsd({
      ...base,
      model: 'some-future-model',
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(usd).toBeCloseTo(5, 6); // opus input narxi
  });

  it('cache write 1.25x, cache read 0.1x (opus)', () => {
    const usd = AiUsageService.computeCostUsd({
      ...base,
      model: 'claude-opus-4-8',
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 1_000_000, // 5 * 1.25 = 6.25
      cacheReadTokens: 1_000_000, // 5 * 0.1 = 0.5
    });
    expect(usd).toBeCloseTo(6.75, 6);
  });

  it("token yo'q -> 0", () => {
    const usd = AiUsageService.computeCostUsd({
      ...base,
      model: 'claude-opus-4-8',
    });
    expect(usd).toBe(0);
  });
});
