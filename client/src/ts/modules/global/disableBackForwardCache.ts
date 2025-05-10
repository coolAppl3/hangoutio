export function disableBackForwardCache(): void {
  window.addEventListener('pageshow', (e: PageTransitionEvent) => {
    if (e.persisted) {
      window.location.reload();
    };
  });
};
