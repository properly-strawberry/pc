/**
 * Author: worstprgr@github / strace@tsoding-discord / movrdxrax@discord
 * Description: Implementing the 8Ball functionality from MrBotka/Hypernerd
 */
import { Executable } from "./FileSystem";
import { PC } from "./PC";

export class EightBall implements Executable {
  private pc: PC;
  private eightBallGlyph: string;
  private rareResponsePercent: number;
  constructor(pc: PC) {
    this.pc = pc;
    this.eightBallGlyph = "(8)";
    this.rareResponsePercent = 0.1;
  }

  async run(args: string[]) {
    if (args.length <= 1) {
      this.help(args);
      return;
    }
    if (args[1] === "-h") {
      this.help(args);
      return;
    }

    let userQuery = ['"', args.slice(1).join(" "), '"'];
    const response = this.randomResponse();

    this.pc.screen.printString(userQuery.join(""));
    this.pc.screen.printString("\n");
    this.pc.screen.printString(response);
  }

  help(args: string[]) {
    const helpText = [
      "Welcome to (8) Your personal oracle!\n",
      `Usage: ${args[0]} [-h] [question]\n`,
      "\n",
      `Example: ${args[0]} Will B replace C?\n`,
    ];
    for (const line of helpText) {
      this.pc.screen.printString(line);
    }
  }

  randomResponse() {
    const output: string[] = [this.eightBallGlyph];

    // Added it for shits and giggles
    if (Math.random() < this.rareResponsePercent) {
      output.push("Maybe ...?");
    } else {
      output.push(Math.random() < 0.5 ? "Yes" : "No");
    }

    return output.join(": ");
  }
}
