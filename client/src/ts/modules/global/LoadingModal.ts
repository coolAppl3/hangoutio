export default class LoadingModal {
  public static display(): void {
    const modal: HTMLDivElement | null = document.querySelector('#loading-modal');
    modal?.classList.add('displayed');
  };

  public static hide(): void {
    const modal: HTMLDivElement | null = document.querySelector('#loading-modal');
    modal?.classList.remove('displayed');
  };
};