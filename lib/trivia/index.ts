import delay from "../../util/delay";
import sample from "../../util/sample";
import {
  DifficultyOptions,
  getQuestions,
  getSessionToken,
  Question,
  Vote,
} from "../opentdb";
import { pusher } from "../pusher";

export class Trivia {
  private readonly channel: string;
  private sessionToken!: string;
  private category: string;
  private difficulty: DifficultyOptions;
  private active!: Question;
  private questions: Question[];
  private votes: Vote[];
  private scores: { [key: string]: number };

  constructor(roomID: string, category: string, difficulty: DifficultyOptions) {
    this.channel = `mini-trivia-${roomID}`;
    this.category = category;
    this.difficulty = difficulty;
    this.questions = [];
    this.votes = [];
    this.scores = {};
  }

  start = async () => {
    this.sessionToken = await getSessionToken();

    this.questions = await getQuestions(
      this.sessionToken,
      this.category,
      this.difficulty
    );

    this.triviaGameLoop();
  };

  update = async (category: string, difficulty: DifficultyOptions) => {
    this.category = category;
    this.difficulty = difficulty;

    this.questions = await getQuestions(
      this.sessionToken,
      this.category,
      this.difficulty
    );
  };

  vote = async (vote: Vote) => {
    this.votes = [...this.votes, vote];

    const display_name = vote.user.display_name;

    const isCorrect = vote.answer === this.active.correct_answer;

    if (Object.prototype.hasOwnProperty.call(this.scores, display_name)) {
      this.scores[display_name] = this.scores[display_name] += isCorrect
        ? 100
        : 0;
    } else {
      this.scores[display_name] = isCorrect ? 100 : 0;
    }

    await pusher.trigger(this.channel, "vote", { votes: this.votes });
  };

  stop = async () => {
    await pusher.trigger(this.channel, "question", { question: null });
  };

  private triviaGameLoop = async () => {
    if (this.questions.length > 0) {
      await pusher.trigger(this.channel, "vote", { votes: [] });

      const question = this.getNewQuestion();

      await pusher.trigger(this.channel, "question", { question });

      await delay(10 * 1000);

      await pusher.trigger(this.channel, "reveal", {});

      await delay(5 * 1000);

      this.triviaGameLoop();
    } else {
      const scores = this.getHighScores();

      await pusher.triggerBatch([
        {
          channel: this.channel,
          name: "vote",
          data: { votes: [] },
        },
        {
          channel: this.channel,
          name: "question",
          data: { question: null },
        },
        {
          channel: this.channel,
          name: "scores",
          data: { scores: scores },
        },
      ]);
    }
  };

  private getNewQuestion = () => {
    const active = sample(this.questions);

    this.active = active;

    this.questions = this.questions.filter((q) => q !== active);

    return active;
  };

  private getHighScores = () => {
    const scoresArray = Object.entries(this.scores).map(
      ([display_name, score]) => {
        return {
          display_name,
          score,
        };
      }
    );

    const scoresArrayDesc = scoresArray.sort((a, b) => b.score - a.score);

    return scoresArrayDesc;
  };
}
