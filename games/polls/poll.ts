export type PollOption = {
  label: string;
  value: string;
};

export default class Poll {
  private options?: PollOption[];
  private votes: PollOption[];

  constructor() {
    this.votes = [];
  }

  public setOptions = (options?: PollOption[]) => {
    if (typeof options === "undefined") {
      this.options = undefined;

      return;
    }

    this.options = options;
  };

  public getOptions = () => {
    return this.options;
  };

  public vote = (vote: PollOption) => {
    this.votes.push(vote);
  };

  public getVotes = () => {
    return this.votes;
  };

  public clearVotes = () => {
    this.votes = [];
  };
}
