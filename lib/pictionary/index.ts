import { User } from "@soapboxsocial/minis.js";
import sample from "../../util/sample";
import wordList from "../../data/word-list";

export class Pictionary {
  private readonly roomID: string;
  private players: Map<string, User>;
  private word!: string;

  constructor(roomID: string) {
    this.roomID = roomID;
    this.players = new Map();
  }

  start = async () => {
    this.word = sample(wordList);
  };

  stop = async () => {};

  addPlayer = (socketID: string, user: User) => {
    console.log("[addPlayer]", socketID, user);

    this.players.set(socketID, user);
  };

  removePlayer = (socketID: string) => {
    console.log("[removePlayer]", socketID);

    this.players.delete(socketID);
  };
}
