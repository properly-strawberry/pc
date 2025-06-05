export class AudioFile {
  private url: string;
  private audio: HTMLAudioElement | undefined;

  constructor(url: string) {
    this.url = url;
    this.audio = undefined;
  }

  play() {
    if (!this.audio) {
      this.audio = new Audio(this.url);
    }
    this.audio.play();
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }
}
