export default class LoadingModal {
  public static display(): void {
    console.log('displayed')
    const modal: HTMLDivElement | null = document.querySelector('#loading-modal');
    modal?.classList.add('displayed');
  };

  public static hide(): void {
    console.log('hidden')
    const modal: HTMLDivElement | null = document.querySelector('#loading-modal');
    modal?.classList.remove('displayed');
  };
};