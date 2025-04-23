export function removeLoadingSkeleton(): void {
  document.querySelector('#loading-skeleton')?.remove();
  document.querySelectorAll('section').forEach((section: HTMLElement) => section.classList.remove('hidden'));

  document.documentElement.scrollTop = 0;
};