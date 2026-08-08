function toCodePointUnits(str: string, chars: string) {
  return {
    charSet: new Set(Array.from(chars)),
    units: Array.from(str),
  };
}

export function ltrim(str: string, chars: string): string {
  if (!chars || str.length === 0) {
    return str;
  }

  const { charSet, units } = toCodePointUnits(str, chars);
  let start = 0;

  while (start < units.length && charSet.has(units[start])) {
    start++;
  }

  return start === 0 ? str : units.slice(start).join('');
}

export function rtrim(str: string, chars: string): string {
  if (!chars || str.length === 0) {
    return str;
  }

  const { charSet, units } = toCodePointUnits(str, chars);
  let end = units.length - 1;

  while (end >= 0 && charSet.has(units[end])) {
    end--;
  }

  return end === units.length - 1 ? str : units.slice(0, end + 1).join('');
}

export function trim(str: string, chars: string): string {
  if (!chars || str.length === 0) {
    return str;
  }

  const { charSet, units } = toCodePointUnits(str, chars);
  let start = 0;
  let end = units.length - 1;

  while (start <= end && charSet.has(units[start])) {
    start++;
  }

  while (end >= start && charSet.has(units[end])) {
    end--;
  }

  return start === 0 && end === units.length - 1
    ? str
    : units.slice(start, end + 1).join('');
}
