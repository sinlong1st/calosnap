import designTokens from '../../../../docs/design/tokens.json';
import { colors, fontFamily, radius, size, space, typography } from '../theme';
import appTokens from '../tokens.json';

describe('design tokens', () => {
  it('app copy of tokens.json is identical to docs/design/tokens.json', () => {
    expect(appTokens).toEqual(designTokens);
  });

  it('maps every color token', () => {
    expect(Object.keys(colors).sort()).toEqual(Object.keys(designTokens.color).sort());
  });

  it('converts type tokens to points', () => {
    expect(typography.display).toEqual({ fontSize: 44, lineHeight: 44, letterSpacing: -1.32, weight: 800 });
    expect(typography.body).toEqual({ fontSize: 15, lineHeight: 23, letterSpacing: 0, weight: 500 });
  });

  it('has a registered font family for every weight used by the type scale', () => {
    for (const t of Object.values(typography)) {
      expect(fontFamily[t.weight]).toMatch(/^PlusJakartaSans_/);
    }
  });

  it('exposes spacing, radii and sizes', () => {
    expect(space.screenX).toBe(20);
    expect(radius.cardLarge).toBe(28);
    expect(size.tabBarHeight).toBe(86);
  });
});
