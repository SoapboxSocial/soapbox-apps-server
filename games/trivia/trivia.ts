import { User } from "@soapboxsocial/minis.js";
import { Namespace, Socket } from "socket.io";
import { TriviaEmitEvents, TriviaListenEvents } from ".";
import {
  DifficultyOptions,
  getQuestions,
  getSessionToken,
  Question,
  Vote,
} from "../../lib/opentdb";
import { GameTokens, postScores } from "../../lib/scores";
import delay from "../../util/delay";
import sample from "../../util/sample";

export default class Trivia {
  private readonly roomID: string;
  private nsp: Namespace<TriviaListenEvents, TriviaEmitEvents>;
  public sessionToken?: string;
  private category?: string;
  private difficulty?: DifficultyOptions;
  private active!: Question;
  private questions: Question[];
  private votes: Vote[];
  private scores: Record<string, number>;
  private isGameLoopRunning: boolean;
  private players: Map<string, User>;

  constructor(
    roomID: string,
    nsp: Namespace<TriviaListenEvents, TriviaEmitEvents>
  ) {
    this.roomID = roomID;
    this.nsp = nsp;
    this.questions = [];
    this.votes = [];
    this.players = new Map();
    this.scores = {};
    this.isGameLoopRunning = false;
  }

  public start = async (category: string, difficulty: DifficultyOptions) => {
    this.category = category;
    this.difficulty = difficulty;

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
      this.sessionToken as string,
      this.category,
      this.difficulty
    );

    if (!this.isGameLoopRunning) {
      this.triviaGameLoop();
    }
  };

  public stop = async () => {
    const scoresArray = this.getHighScores();

    await postScores(
      Object.fromEntries(scoresArray.map((el) => [el.id, el.score])),
      GameTokens.TRIVIA,
      this.roomID
    );
  };

  public vote = (socketID: string, vote: Vote) => {
    const user = this.players.get(socketID);

    if (typeof user === "undefined") {
      return;
    }

    this.votes.push(vote);

    const isCorrect = vote.answer === this.active.correct_answer;

    const points = isCorrect ? 100 : 0;

    if (Object.prototype.hasOwnProperty.call(this.scores, user.username)) {
      this.scores[user.username] = this.scores[user.username] += points;
    } else {
      this.scores[user.username] = points;
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
    const userArray = Array.from(this.players.values());

    const scoresArray = Object.entries(this.scores).map(([username, score]) => {
      const user = userArray.find((el) => el.username === username) as User;

      return {
        id: user.id,
        display_name: user?.display_name ?? user.username,
        score,
      };
    });

    const scoresArrayDesc = scoresArray.sort((a, b) => b.score - a.score);

    return scoresArrayDesc;
  };

  public addPlayer = (
    socket: Socket<TriviaListenEvents, TriviaEmitEvents>,
    user: User
  ) => {
    const socketID = socket.id;

    this.players.set(socketID, user);
  };

  public removePlayer = (socketID: string) => {
    this.players.delete(socketID);
  };
}
