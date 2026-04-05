/**
 * Title-case a customer name for storage and display (each word; hyphenated parts per segment).
 */
export function toProperCustomerName(name: string): string {
  if (!name || typeof name !== 'string') return '';

  const capitalizeSegment = (segment: string) => {
    if (!segment) return segment;
    return (
      segment.charAt(0).toLocaleUpperCase('en-KE') + segment.slice(1).toLocaleLowerCase('en-KE')
    );
  };

  const capitalizeWord = (word: string) => {
    if (!word) return word;
    return word.split('-').map(capitalizeSegment).join('-');
  };

  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(capitalizeWord)
    .join(' ');
}
