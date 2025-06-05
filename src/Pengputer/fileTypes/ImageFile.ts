import { loadImageBitmapFromUrl } from "../../Functions";

export class ImageFile {
  private src: string;
  private bitmap: ImageBitmap | undefined;

  constructor(src: string) {
    this.src = src;
    this.bitmap = undefined;
  }

  async load() {
    if (this.bitmap) {
      return this.bitmap;
    }

    this.bitmap = await loadImageBitmapFromUrl(this.src);
    return this.bitmap;
  }
}
