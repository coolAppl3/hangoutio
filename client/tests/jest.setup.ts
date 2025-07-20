Object.defineProperty(window, 'location', {
  writable: true,
  value: { href: '' },
});

Object.defineProperty(document, 'cookie', {
  writable: true,
  value: '',
});