import { CategoryIconPipe } from './category-icon.pipe';

describe('CategoryIconPipe', () => {
  let pipe: CategoryIconPipe;

  beforeEach(() => {
    pipe = new CategoryIconPipe();
  });

  it('should return tapas icon for Tapas category', () => {
    expect(pipe.transform(['Tapas'])).toBe('/svg/tapas.svg');
  });

  it('should return bar icon for Bar category', () => {
    expect(pipe.transform(['Bar'])).toBe('/svg/bar.svg');
  });

  it('should return cafeteria icon for Coffee category', () => {
    expect(pipe.transform(['Coffee Shop'])).toBe('/svg/cafeteria.svg');
  });

  it('should return restaurante icon as default', () => {
    expect(pipe.transform(['Italian Restaurant'])).toBe('/svg/restaurante.svg');
  });
});
