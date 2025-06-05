export class TextFile {
  private data: string;

  constructor() {
    this.data = "";
  }

  getText() {
    return this.data;
  }

  append(text: string) {
    this.data = `${this.data}${text}`;
  }

  replace(text: string) {
    this.data = text;
  }
}
