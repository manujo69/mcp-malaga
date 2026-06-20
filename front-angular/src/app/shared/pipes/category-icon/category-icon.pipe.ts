import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'categoryIcon',
  standalone: true,
  pure: true,
})
export class CategoryIconPipe implements PipeTransform {
  transform(categories: string[]): string {
    const cats = categories.join('\t');
    if (cats.includes('Tapas') || cats.includes('Spanish Restaurant')) return '/svg/tapas.svg';
    if (/\bBar\b/.test(cats) || cats.includes('Pub') || cats.includes('Nightclub')) return '/svg/bar.svg';
    if (cats.includes('Caf') || cats.includes('Coffee') || cats.includes('Tea Room')) return '/svg/cafeteria.svg';
    return '/svg/restaurante.svg';
  }
}
