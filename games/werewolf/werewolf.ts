import { User } from "@soapboxsocial/minis.js";
import { Namespace } from "socket.io";
import { WerewolfEmitEvents, WerewolfListenEvents } from ".";
import delay from "../../util/delay";
import sample from "../../util/sample";
import Player, { PlayerRole } from "./player";

const ROUND_DURATION = 60 * 3;

export enum GameAct {
  VOTING = "VOTING",
  DAY = "DAY",
  WEREWOLF = "WEREWOLF",
  SEER = "SEER",
  DOCTOR = "DOCTOR",
  VILLAGER = "VILLAGER",
  NIGHT = "NIGHT",
}

export default class Werewolf {
  public players: Map<string, Player>;
  public act!: GameAct;
  public doctorID?: string;
  public seerID?: string;
  public werewolfIDs: string[];
  public markedIDs: string[];

  private timeRemaining: number;
  private intervalId!: NodeJS.Timeout;
  private readonly nsp: Namespace<WerewolfListenEvents, WerewolfEmitEvents>;
  private readonly roomID: string;

  constructor(
    roomID: string,
    nsp: Namespace<WerewolfListenEvents, WerewolfEmitEvents>
  ) {
    this.nsp = nsp;
    this.roomID = roomID;
    this.players = new Map();
    this.timeRemaining = ROUND_DURATION;
    this.werewolfIDs = [];
    this.markedIDs = [];
  }

  public addPlayer = (id: string, user: User) => {
    let role: PlayerRole = PlayerRole.VILLAGER;

    let maxWerewolves = 2;
    switch (true) {
      case this.players.size > 8:
        maxWerewolves = 3;
        break;
      case this.players.size > 12:
        maxWerewolves = 4;
        break;
    }

    switch (true) {
      case this.werewolfIDs.length < maxWerewolves:
        this.werewolfIDs.push(id);
        role = PlayerRole.WEREWOLF;
        break;
      case typeof this.doctorID === "undefined":
        this.doctorID = id;
        role = PlayerRole.DOCTOR;
        break;
      case typeof this.seerID === "undefined":
        this.seerID = id;
        role = PlayerRole.SEER;
        break;
    }

    const player = new Player(user, role);

    this.players.set(id, player);

    if (this.players.size < 6) {
      return;
    }

    if (typeof this.act === "undefined") {
      this.startNight();
    }
  };

  public removePlayer = (id: string) => {
    switch (true) {
      case this.werewolfIDs.includes(id):
        this.werewolfIDs = this.werewolfIDs.filter((_id) => _id !== id);
        break;
      case this.doctorID === id:
        this.doctorID = undefined;
        break;
      case this.seerID === id:
        this.seerID = undefined;
        break;
    }

    this.players.delete(id);
  };

  public markPlayer = (id: string) => {
    if (this.markedIDs.length === 2) {
      return;
    }

    this.markedIDs.push(id);
  };

  public killMarked = () => {
    const idToKill = sample(this.markedIDs);

    this.killPlayer(idToKill);

    this.markedIDs = [];
  };

  public killPlayer = (id: string) => {
    const player = this.players.get(id);

    if (typeof player === "undefined") {
      return;
    }

    player.kill();
  };

  public healPlayer = (id: string) => {
    const player = this.players.get(id);

    if (typeof player === "undefined") {
      return;
    }

    player.heal();
  };

  public scryPlayer = (id: string) => {
    const player = this.players.get(id);

    if (typeof player === "undefined") {
      return false;
    }

    return player.role === PlayerRole.WEREWOLF;
  };

  public startNight = async () => {
    this.act = GameAct.NIGHT;

    this.nsp.in(this.roomID).emit("ACT", GameAct.NIGHT);

    await delay(5 * 1000);

    this.act = GameAct.WEREWOLF;

    this.nsp.in(this.roomID).emit("ACT", GameAct.WEREWOLF);
  };

  public startDay = async () => {
    clearInterval(this.intervalId);

    this.act = GameAct.DAY;

    this.nsp.in(this.roomID).emit("ACT", GameAct.DAY);

    await delay(5 * 1000);

    const players = Object.fromEntries(this.players.entries());

    this.nsp.in(this.roomID).emit("PLAYERS", players);

    this.act = GameAct.VOTING;

    this.nsp.in(this.roomID).emit("ACT", GameAct.VOTING);

    // 5a. Handle What Happened In The Night (Who Was Killed, Who Was Protected)

    // 5b. Start Day Cycle
    this.intervalId = setInterval(() => {
      this.timeRemaining = this.timeRemaining - 1;

      this.nsp.in(this.roomID).emit("TIME", this.timeRemaining);

      const villagers = this.getVillagers();

      const werewolves = this.getWerewolves();

      const didVillagersWin = werewolves.length === 0;

      const didWerewolvesWin = werewolves.length === villagers.length;

      if (this.timeRemaining <= 0 && !didVillagersWin && !didWerewolvesWin) {
        clearInterval(this.intervalId);

        this.startNight();
      } else {
        this.stop(didWerewolvesWin ? "WEREWOLF" : "VILLAGER");
      }
    });
  };

  public stop = (winner: "VILLAGER" | "WEREWOLF") => {
    clearInterval(this.intervalId);

    this.nsp.in(this.roomID).emit("WINNER", winner);
  };

  private getVillagers = () => {
    const villagers = Array.from(this.players.values()).filter(
      (player) => player.role !== PlayerRole.WEREWOLF
    );

    return villagers;
  };

  private getWerewolves = () => {
    const werewolves = Array.from(this.players.values()).filter(
      (player) => player.role === PlayerRole.WEREWOLF
    );

    return werewolves;
  };

  public updateAct = (act: GameAct) => {
    this.act = act;
  };
}
