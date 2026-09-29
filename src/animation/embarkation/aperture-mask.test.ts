import { describe, expect, it } from 'vitest';
import { apertureResidualMask } from './aperture-mask';
describe('aperture residual classification', () => {
  it('classifies approved cool pixels in their explicit byte domain', () => {
    expect(apertureResidualMask(8,112,950/1536,150/1024,1)).toBe(1);
    expect(apertureResidualMask(12,98,950/1536,345/1024,1)).toBe(1);
    expect(apertureResidualMask(18,20,.26,.68,1)).toBe(0);
    expect(apertureResidualMask(77,8,.25,.08,1)).toBe(0);
  });
  it('retains the warm moon and honors architectural holdouts even for cool paint', () => {
    expect(apertureResidualMask(232,205,1167/1536,240/1024,1)).toBe(1);
    expect(apertureResidualMask(8,112,.25,.08,0)).toBe(0);
    expect(apertureResidualMask(8,112,.25,.08,.5)).toBe(.5);
  });
});
