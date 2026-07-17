declare module "page-flip" {
  export type FlipCorner = "top" | "bottom";
  export type Orientation = "portrait" | "landscape";
  export type FlipState = "user_fold" | "fold_corner" | "flipping" | "read";

  export type FlipSetting = {
    width: number;
    height: number;
    size?: "fixed" | "stretch";
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    startPage?: number;
    drawShadow?: boolean;
    flippingTime?: number;
    usePortrait?: boolean;
    startZIndex?: number;
    autoSize?: boolean;
    maxShadowOpacity?: number;
    showCover?: boolean;
    mobileScrollSupport?: boolean;
    clickEventForward?: boolean;
    useMouseEvents?: boolean;
    swipeDistance?: number;
    showPageCorners?: boolean;
    disableFlipByClick?: boolean;
  };

  export type WidgetEvent<T> = {
    data: T;
    object: PageFlip;
  };

  export class PageFlip {
    constructor(block: HTMLElement, settings: FlipSetting);
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    updateFromHtml(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    destroy(): void;
    turnToPage(page: number): void;
    flipNext(corner?: FlipCorner): void;
    flipPrev(corner?: FlipCorner): void;
    flip(page: number, corner?: FlipCorner): void;
    getPageCount(): number;
    getCurrentPageIndex(): number;
    getOrientation(): Orientation;
    on(event: "flip", callback: (event: WidgetEvent<number>) => void): PageFlip;
    on(event: "changeOrientation", callback: (event: WidgetEvent<Orientation>) => void): PageFlip;
    on(event: "changeState", callback: (event: WidgetEvent<FlipState>) => void): PageFlip;
  }
}
