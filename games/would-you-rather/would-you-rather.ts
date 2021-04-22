import prompts from "../../data/would-you-rather";
import sample from "../../util/sample";

export type WYROption = {
  text: string;
};

export type WYRPair = {
  a: WYROption;
  b: WYROption;
};

export default class WouldYouRather {
  active?: WYRPair;
  votes: WYROption[];
  prompts: WYRPair[];

  constructor() {
    this.votes = [];
    this.prompts = prompts;
  }

  public getNewPrompt = () => {
    const prompt = sample<WYRPair>(this.prompts);

    this.active = prompt;

    this.prompts = this.prompts.filter((q) => q !== prompt);

    return prompt;
  };

  public getPrompt = () => {
    return this.active;
  };

  public vote = (vote: WYROption) => {
    this.votes.push(vote);
  };

  public getVotes = () => {
    return this.votes;
  };

  public clearVotes = () => {
    this.votes = [];
  };
}
