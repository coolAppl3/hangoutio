export default class SliderInput {
  private readonly inputID: string;
  private readonly keyword: string;
  private readonly sliderMinValue: number;
  private readonly sliderMaxValue: number;

  private actualInput: HTMLInputElement | null;
  private slider: HTMLDivElement | null;
  private sliderThumb: Element | null | undefined;
  private sliderTextSpan: Element | null | undefined;

  private sliderDomRect: DOMRect | undefined;

  private isDragging: boolean;
  private isTouchDevice: boolean;

  private sliderValue: number;

  private boundDragSlider: (e: MouseEvent | TouchEvent) => void;
  private boundStopDrag: () => void;

  public constructor(inputID: string, keyword: string, sliderMinValue: number, sliderMaxValue: number, startingValue: number = sliderMinValue) {
    this.inputID = inputID;
    this.keyword = keyword;

    if (sliderMinValue >= 0 && sliderMaxValue > sliderMinValue) {
      this.sliderMinValue = sliderMinValue;
      this.sliderMaxValue = sliderMaxValue;
    } else {
      this.sliderMinValue = 0;
      this.sliderMaxValue = 1;
    };

    this.actualInput = document.querySelector(`#${inputID}`);
    this.slider = document.querySelector(`[data-slider-target="${inputID}"]`);
    this.sliderThumb = this.slider?.firstElementChild?.firstElementChild;
    this.sliderTextSpan = document.querySelector(`[data-slider-text="${inputID}"]`);

    this.sliderDomRect = this.slider?.getBoundingClientRect();

    this.isDragging = false;
    this.isTouchDevice = false;

    this.sliderValue = startingValue;

    this.boundDragSlider = this.dragSlider.bind(this);
    this.boundStopDrag = this.stopDrag.bind(this);

    this.adjustSliderWidth();
    this.loadEventListeners();
  };


  public get value(): number {
    return this.sliderValue;
  }

  private loadEventListeners(): void {
    window.addEventListener('updateDOMRect', () => { setTimeout(() => this.updateSliderDomRect(), 200) });
    window.addEventListener('resize', this.updateSliderDomRect.bind(this));

    if ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0) {
      this.isTouchDevice = true;
    };

    if (this.isTouchDevice) {
      this.slider?.addEventListener('touchstart', this.startDrag.bind(this), { passive: true });
      return;
    };

    this.slider?.addEventListener('mousedown', this.startDrag.bind(this));
    this.slider?.addEventListener('keyup', this.handleSliderKeyEvents.bind(this));
  };

  private startDrag(): void {
    this.isDragging = true;
    document.body.style.userSelect = 'none';

    if (this.isTouchDevice) {
      document.body.addEventListener('touchmove', this.boundDragSlider, { passive: true });
      document.body.addEventListener('touchend', this.boundStopDrag, { passive: true });
      return;
    };

    document.body.addEventListener('mousemove', this.boundDragSlider);
    document.body.addEventListener('mouseup', this.boundStopDrag);
  };

  private dragSlider(e: MouseEvent | TouchEvent): void {
    if (!this.isDragging) {
      return;
    };

    if (!this.sliderDomRect) {
      return;
    };

    let xCoordinates: number;
    if (e instanceof MouseEvent) {
      xCoordinates = e.clientX;
    } else {
      const touch = e.touches[0];
      xCoordinates = touch.clientX;
    };

    const difference: number = (xCoordinates - this.sliderDomRect.left);
    const slidePercentage: number = ((Math.min(difference, this.sliderDomRect.width) / this.sliderDomRect.width) * 100 + 4) | 0;

    this.updateSliderValues(slidePercentage);
  };

  private stopDrag(): void {
    this.isDragging = false;
    document.body.style.userSelect = 'auto';

    if (this.isTouchDevice) {
      document.body.removeEventListener('touchmove', this.dragSlider);
      document.body.removeEventListener('touchend', this.stopDrag);
      return;
    };

    document.body.removeEventListener('mousemove', this.dragSlider);
    document.body.removeEventListener('mouseup', this.stopDrag);

    window.dispatchEvent(new CustomEvent(`${this.inputID}-value-change`));
  };

  public updateSliderDomRect(): void {
    this.sliderDomRect = this.slider?.getBoundingClientRect();
  };

  private updateSliderValues(slidePercentage: number): void {
    if (!(this.sliderThumb instanceof HTMLDivElement)) {
      return;
    };

    this.sliderThumb.style.width = `${slidePercentage}%`;

    const stepNumber: number = (slidePercentage / (100 / this.sliderMaxValue)) | 0;
    this.sliderValue = Math.max(this.sliderMinValue, stepNumber);

    this.updateSliderTextValue();
    this.actualInput?.setAttribute('value', `${this.sliderValue}`);
  };

  private updateSliderTextValue(): void {
    if (!this.sliderTextSpan) {
      return;
    };

    if (this.sliderValue === 1) {
      this.sliderTextSpan.textContent = `${this.sliderValue} ${this.keyword}`;
      return;
    };

    this.sliderTextSpan.textContent = `${this.sliderValue} ${this.keyword}s`;
  };

  // keyboard navigation
  private handleSliderKeyEvents(e: KeyboardEvent): void {
    if (e.key === 'ArrowLeft') {
      this.stepBack();
    };

    if (e.key === 'ArrowRight') {
      this.stepForward();
    };
  };

  private stepBack(): void {
    if (this.sliderValue <= this.sliderMinValue) {
      return;
    };

    this.sliderValue--;
    this.adjustSliderWidth();
  };

  private stepForward(): void {
    if (this.sliderValue >= this.sliderMaxValue) {
      return;
    };

    this.sliderValue++;
    this.adjustSliderWidth();
  };

  private adjustSliderWidth(): void {
    const newWidth: number = this.sliderValue * (100 / this.sliderMaxValue);
    this.sliderThumb instanceof HTMLDivElement ? this.sliderThumb.style.width = `${newWidth}%` : undefined;
    this.actualInput?.setAttribute('value', `${this.sliderValue}`);
    this.updateSliderTextValue();
  };
};