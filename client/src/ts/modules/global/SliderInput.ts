export default class SliderInput {
  private readonly inputId: string;
  private readonly keyword: string;
  private readonly sliderMinValue: number;
  private readonly sliderMaxValue: number;
  private readonly disabled: boolean;

  private actualInput: HTMLInputElement | null;
  private slider: HTMLDivElement | null;
  private sliderThumb: Element | null | undefined;
  private sliderTextSpan: Element | null | undefined;

  private sliderDomRect: DOMRect | undefined;

  private isDragging: boolean;
  private isTouchDevice: boolean;

  private sliderInitialValue: number;
  private sliderValue: number;

  private boundDragSlider: (e: MouseEvent | TouchEvent) => void;
  private boundStopDrag: () => void;

  public constructor(inputId: string, keyword: string, sliderMinValue: number, sliderMaxValue: number, initialValue: number = sliderMinValue, disabled: boolean = false) {
    this.inputId = inputId;
    this.keyword = keyword;
    this.disabled = disabled;

    if (sliderMinValue >= 0 && sliderMaxValue > sliderMinValue) {
      this.sliderMinValue = sliderMinValue;
      this.sliderMaxValue = sliderMaxValue;
    } else {
      this.sliderMinValue = 0;
      this.sliderMaxValue = 1;
    };

    this.actualInput = document.querySelector(`#${inputId}`);
    this.slider = document.querySelector(`[data-slider-target="${inputId}"]`);
    this.sliderThumb = this.slider?.firstElementChild?.firstElementChild;
    this.sliderTextSpan = document.querySelector(`[data-slider-text="${inputId}"]`);

    this.sliderDomRect = this.slider?.getBoundingClientRect();

    this.isDragging = false;
    this.isTouchDevice = false;

    this.sliderInitialValue = initialValue;
    this.sliderValue = initialValue;

    this.boundDragSlider = this.dragSlider.bind(this);
    this.boundStopDrag = this.stopDrag.bind(this);

    this.updateSliderWidth();

    if (this.disabled) {
      this.actualInput?.parentElement?.classList.add('disabled');
      return;
    };

    this.loadEventListeners();
  };

  public get value(): number {
    return this.sliderValue;
  }

  public get initialValue(): number {
    return this.sliderInitialValue;
  };

  public updateValue(newValue: number): void {
    this.sliderValue = newValue;
    this.sliderInitialValue = newValue;

    this.updateSliderWidth();
    this.updateSliderTextValue();

    document.dispatchEvent(new CustomEvent(`${this.inputId}_valueChange`));
  };

  public resetValues(): void {
    this.sliderValue = this.sliderInitialValue;

    this.updateSliderWidth();
    this.updateSliderTextValue();

    document.dispatchEvent(new CustomEvent(`${this.inputId}_valueChange`));
  };

  private loadEventListeners(): void {
    document.addEventListener('updateDOMRect', () => setTimeout(() => this.updateSliderDomRect(), 200));
    window.addEventListener('resize', this.updateSliderDomRect.bind(this));

    if ('maxTouchPoints' in navigator && navigator.maxTouchPoints > 0) {
      this.isTouchDevice = true;
    };

    if (this.isTouchDevice) {
      this.slider?.addEventListener('touchstart', this.startDrag.bind(this), { passive: false });
    };

    this.slider?.addEventListener('mousedown', this.startDrag.bind(this));
    this.slider?.addEventListener('keyup', this.handleSliderKeyEvents.bind(this));
  };

  private startDrag(): void {
    this.isDragging = true;
    document.body.style.userSelect = 'none';

    this.sliderThumb?.classList.add('active');

    if (this.isTouchDevice) {
      document.body.addEventListener('touchmove', this.boundDragSlider, { passive: false });
      document.body.addEventListener('touchend', this.boundStopDrag, { passive: false });
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
      e instanceof TouchEvent && e.preventDefault();
      const touch: Touch | undefined = e.touches[0];

      if (!touch) {
        return;
      };

      xCoordinates = touch.clientX;
    };

    const desktopOffset: number = this.isTouchDevice ? 0 : 4;

    const difference: number = (xCoordinates - this.sliderDomRect.left);
    const slidePercentage: number = ((Math.min(difference, this.sliderDomRect.width) / this.sliderDomRect.width) * 100 + desktopOffset) | 0;

    this.updateSliderValues(slidePercentage);
  };

  private stopDrag(): void {
    this.isDragging = false;
    document.body.style.userSelect = 'auto';

    this.sliderThumb?.classList.remove('active');

    if (this.isTouchDevice) {
      document.body.removeEventListener('touchmove', this.boundDragSlider);
      document.body.removeEventListener('touchend', this.boundStopDrag);
    };

    document.body.removeEventListener('mousemove', this.boundDragSlider);
    document.body.removeEventListener('mouseup', this.boundStopDrag);

    document.dispatchEvent(new CustomEvent(`${this.inputId}_valueChange`));
  };

  private updateSliderDomRect(): void {
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
    this.updateSliderWidth();
  };

  private stepForward(): void {
    if (this.sliderValue >= this.sliderMaxValue) {
      return;
    };

    this.sliderValue++;
    this.updateSliderWidth();
  };

  private updateSliderWidth(): void {
    const newWidth: number = this.sliderValue * (100 / this.sliderMaxValue);
    if (this.sliderThumb instanceof HTMLDivElement) {
      this.sliderThumb.style.width = `${newWidth}%`;
    };

    this.actualInput?.setAttribute('value', `${this.sliderValue}`);
    this.updateSliderTextValue();
  };
};