import { Namespace } from "socket.io";
import { TriviaEmitEvents, TriviaListenEvents } from ".";
import {
  DifficultyOptions,
  getQuestions,
  getSessionToken,
  Question,
  Vote,
} from "../../lib/opentdb";
import delay from "../../util/delay";
import sample from "../../util/sample";

export default class Trivia {
  private readonly roomID: string;
  private nsp: Namespace<TriviaListenEvents, TriviaEmitEvents>;
  private sessionToken!: string;
  private category: string;
  private difficulty: DifficultyOptions;
  private active!: Question;
  private questions: Question[];
  private votes: Vote[];
  private scores: { [key: string]: number };
  private isGameLoopRunning: boolean;

  constructor(
    roomID: string,
    category: string,
    difficulty: DifficultyOptions,
    nsp: Namespace<TriviaListenEvents, TriviaEmitEvents>
  ) {
    this.roomID = roomID;
    this.nsp = nsp;
    this.category = category;
    this.difficulty = difficulty;
    this.questions = [];
    this.votes = [];
    this.scores = {};
    this.isGameLoopRunning = false;
  }

  public start = async () => {
    this.sessionToken = await getSessionToken();

    this.questions = await getQuestions(
      this.sessionToken,
      this.category,
      this.difficulty
    );

    this.triviaGameLoop();
  };

  public update = async (category: string, difficulty: DifficultyOptions) => {
    this.category = category;
    this.difficulty = difficulty;

    this.questions = await getQuestions(
      this.sessionToken,
      this.category,
      this.difficulty
    );

    if (!this.isGameLoopRunning) {
      this.triviaGameLoop();
    }
  };

  public vote = (vote: Vote) => {
    this.votes.push(vote);

    const display_name = vote.user.display_name;

    const isCorrect = vote.answer === this.active.correct_answer;

    if (Object.prototype.hasOwnProperty.call(this.scores, display_name)) {
      this.scores[display_name] = this.scores[display_name] += isCorrect
        ? 100
        : 0;
    } else {
      this.scores[display_name] = isCorrect ? 100 : 0;
    }

    this.nsp.in(this.roomID).emit("VOTES", this.votes);
  };

  private triviaGameLoop = async () => {
    if (this.questions.length > 0) {
      this.isGameLoopRunning = true;

      this.nsp.in(this.roomID).emit("VOTES", []);

      const question = this.getNewQuestion();

      this.nsp.in(this.roomID).emit("QUESTION", question);

      await delay(10 * 1000);

      this.nsp.in(this.roomID).emit("REVEAL");

      await delay(5 * 1000);

      this.triviaGameLoop();
    } else {
      this.isGameLoopRunning = false;

      const scores = this.getHighScores();

      this.nsp.in(this.roomID).emit("VOTES", []);

      this.nsp.in(this.roomID).emit("QUESTION", null);

      this.nsp.in(this.roomID).emit("SCORES", scores);
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
