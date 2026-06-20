export function translateHours(hours: string): string {
  return hours
    .replace(/\bMo\b/g, 'Lu')
    .replace(/\bTu\b/g, 'Ma')
    .replace(/\bWe\b/g, 'Mi')
    .replace(/\bTh\b/g, 'Ju')
    .replace(/\bFr\b/g, 'Vi')
    .replace(/\bSa\b/g, 'Sá')
    .replace(/\bSu\b/g, 'Do');
}
