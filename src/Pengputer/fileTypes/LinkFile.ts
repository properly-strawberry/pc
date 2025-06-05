export type LinkOpenType = "run" | "open";

export class LinkFile {
  private href: string;

  constructor(href: string) {
    this.href = href;
  }

  open() {
    window.open(this.href, "_blank");
  }
}
