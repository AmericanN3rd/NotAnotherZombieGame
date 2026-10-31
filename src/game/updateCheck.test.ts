import { describe, expect, it } from 'vitest';
import { isNewer } from './updateCheck';

describe('update comparison', () => {
  it('notices a newer release and ignores the same or older one', () => {
    expect(isNewer('0.2.0', '0.1.0')).toBe(true);
    expect(isNewer('v0.1.1', '0.1.0')).toBe(true);
    expect(isNewer('0.1.0', '0.1.0')).toBe(false);
    expect(isNewer('0.0.9', '0.1.0')).toBe(false);
  });
});
