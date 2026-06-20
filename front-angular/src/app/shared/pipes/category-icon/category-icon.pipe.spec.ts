import { CategoryIconPipe } from './category-icon.pipe';

describe('CategoryIconPipe', () => {
  let pipe: CategoryIconPipe;

  beforeEach(() => {
    pipe = new CategoryIconPipe();
  });

  describe('Tapas / Spanish Restaurant', () => {
    it('returns tapas icon for Tapas category', () => {
      expect(pipe.transform(['Tapas'])).toBe('/svg/tapas.svg');
    });

    it('returns tapas icon for Spanish Restaurant', () => {
      expect(pipe.transform(['Spanish Restaurant'])).toBe('/svg/tapas.svg');
    });

    it('tapas rule takes priority over others', () => {
      expect(pipe.transform(['Tapas', 'Bar'])).toBe('/svg/tapas.svg');
    });
  });

  describe('Bar', () => {
    it('returns bar icon for Bar category (exact word)', () => {
      expect(pipe.transform(['Bar'])).toBe('/svg/bar.svg');
    });

    it('returns bar icon for Pub', () => {
      expect(pipe.transform(['Pub'])).toBe('/svg/bar.svg');
    });

    it('returns bar icon for Nightclub', () => {
      expect(pipe.transform(['Nightclub'])).toBe('/svg/bar.svg');
    });

    it('does not match Bar as a substring of another word', () => {
      // 'Barbecue' contains Bar but not as a whole word
      expect(pipe.transform(['Barbecue Restaurant'])).toBe('/svg/restaurante.svg');
    });
  });

  describe('Cafetería', () => {
    it('returns cafeteria icon for Coffee category', () => {
      expect(pipe.transform(['Coffee Shop'])).toBe('/svg/cafeteria.svg');
    });

    it('returns cafeteria icon for Tea Room', () => {
      expect(pipe.transform(['Tea Room'])).toBe('/svg/cafeteria.svg');
    });

    it('returns cafeteria icon when category contains Caf prefix', () => {
      expect(pipe.transform(['Cafetería'])).toBe('/svg/cafeteria.svg');
    });
  });

  describe('default', () => {
    it('returns restaurante icon for an unrecognized category', () => {
      expect(pipe.transform(['Italian Restaurant'])).toBe('/svg/restaurante.svg');
    });

    it('returns restaurante icon for empty categories', () => {
      expect(pipe.transform([])).toBe('/svg/restaurante.svg');
    });
  });
});
