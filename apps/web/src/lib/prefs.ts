// Display preferences that live in localStorage and must be on <html> before
// first paint (a light flash on a dark-theme reload, text reflowing after
// hydration). Layout.astro inlines `bootScript()` in <head>; page scripts use
// readPref / writePref, which keep the <html> attribute in sync.
//
// `auto` theme and unset values leave the attribute off: CSS falls back to
// prefers-color-scheme and the default reader size.

export const THEMES = ['auto', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

export const READER_MODES = ['pos', 'tense', 'analyze'] as const;
export type ReaderMode = (typeof READER_MODES)[number];

export const READER_SIZE_STEPS = 6;
export const DEFAULT_READER_SIZE = 2;

interface PrefTypes {
  theme: Theme;
  readerModes: ReaderMode[];
  readerSize: number;
}
export type PrefName = keyof PrefTypes;

// `key` is the localStorage key, `attr` the <html> data attribute (dataset
// name). Values are validated on read, so a stale or hand-edited entry falls
// back to the default instead of reaching the DOM.
const SPEC = {
  theme: { key: 'theme', attr: 'theme' },
  readerModes: { key: 'reader-modes', attr: 'readerModes' },
  readerSize: { key: 'reader-size', attr: 'readerSize' },
} as const satisfies Record<PrefName, { key: string; attr: string }>;

function parse<N extends PrefName>(
  name: N,
  raw: string | null,
): PrefTypes[N] | null;
function parse(name: PrefName, raw: string | null): PrefTypes[PrefName] | null {
  if (raw === null) {
    return null;
  }
  switch (name) {
    case 'theme':
      return (THEMES as readonly string[]).includes(raw)
        ? (raw as Theme)
        : null;
    case 'readerModes': {
      const modes = raw.split(' ').filter(Boolean);
      return modes.every((m) => (READER_MODES as readonly string[]).includes(m))
        ? (modes as ReaderMode[])
        : null;
    }
    case 'readerSize': {
      const size = Number(raw);
      return Number.isInteger(size) && size >= 0 && size < READER_SIZE_STEPS
        ? size
        : null;
    }
  }
}

function serialize(name: PrefName, value: PrefTypes[PrefName]): string {
  switch (name) {
    case 'readerModes':
      return (value as ReaderMode[]).join(' ');
    default:
      return String(value);
  }
}

const DEFAULTS: PrefTypes = {
  theme: 'auto',
  readerModes: [],
  readerSize: DEFAULT_READER_SIZE,
};

function stored(name: PrefName): string | null {
  try {
    return localStorage.getItem(SPEC[name].key);
  } catch {
    return null;
  }
}

export function readPref<N extends PrefName>(name: N): PrefTypes[N] {
  return parse(name, stored(name)) ?? (DEFAULTS[name] as PrefTypes[N]);
}

// Attribute mirrors the stored value; a default-equivalent value removes it.
function reflect(name: PrefName, value: PrefTypes[PrefName]): void {
  const attr = SPEC[name].attr;
  const off =
    value === DEFAULTS[name] || (Array.isArray(value) && value.length === 0);
  if (off) {
    delete document.documentElement.dataset[attr];
  } else {
    document.documentElement.dataset[attr] = serialize(name, value);
  }
}

export function writePref<N extends PrefName>(
  name: N,
  value: PrefTypes[N],
): void {
  reflect(name, value);
  try {
    localStorage.setItem(SPEC[name].key, serialize(name, value));
  } catch {
    // Private mode / blocked storage — the choice holds for this page only.
  }
}

// Self-contained JS for the inline <head> script: applies every stored
// preference to <html> synchronously. It must not depend on module code, so it
// is emitted from the same SPEC and allowed values, not imported.
export function bootScript(): string {
  const spec = {
    theme: { ...SPEC.theme, values: THEMES, off: DEFAULTS.theme },
    readerModes: { ...SPEC.readerModes, values: READER_MODES },
    readerSize: {
      ...SPEC.readerSize,
      steps: READER_SIZE_STEPS,
      off: String(DEFAULT_READER_SIZE),
    },
  };
  return `try{var d=document.documentElement.dataset,s=${JSON.stringify(spec)},g=function(k){return localStorage.getItem(k)};
var t=g(s.theme.key);if(t&&t!==s.theme.off&&s.theme.values.indexOf(t)>-1)d[s.theme.attr]=t;
var m=g(s.readerModes.key);if(m){var l=m.split(" ").filter(Boolean);if(l.length&&l.every(function(x){return s.readerModes.values.indexOf(x)>-1}))d[s.readerModes.attr]=l.join(" ")}
var z=g(s.readerSize.key);if(z&&z!==s.readerSize.off&&/^[0-9]+$/.test(z)&&+z<s.readerSize.steps)d[s.readerSize.attr]=z}catch(e){}`;
}
