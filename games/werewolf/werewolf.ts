import { User } from "@soapboxsocial/minis.js";
import { Namespace } from "socket.io";
import { WerewolfEmitEvents, WerewolfListenEvents } from ".";
import delay from "../../util/delay";
import Player, { PlayerRole } from "./player";

const ROUND_DURATION = 60 * 3;

export default class Werewolf {
  public players: Map<string, Player>;
  private timeRemaining: number;
  private intervalId!: NodeJS.Timeout;
  private readonly nsp: Namespace<WerewolfListenEvents, WerewolfEmitEvents>;
  private readonly roomID: string;

  private doctorID!: string;
  private seerID!: string;
  private werewolfIDs!: string[];

  constructor(
    roomID: string,
    nsp: Namespace<WerewolfListenEvents, WerewolfEmitEvents>
  ) {
    this.nsp = nsp;
    this.roomID = roomID;
    this.players = new Map();
    this.timeRemaining = ROUND_DURATION;
    this.werewolfIDs = [];
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
      case typeof this.doctorID === "undefined":
        this.doctorID = id;
        role = PlayerRole.DOCTOR;
        break;
      case typeof this.seerID === "undefined":
        this.seerID = id;
        role = PlayerRole.SEER;
        break;
      case this.werewolfIDs.length < maxWerewolves:
        this.werewolfIDs.push(id);
        role = PlayerRole.WEREWOLF;
        break;
    }

    const player = new Player(user, role);

    this.players.set(id, player);

    if (this.players.size < 6) {
      return;
    }

    this.startNight();
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
      return;
    }

    return player.role === PlayerRole.WEREWOLF;
  };

  public startNight = async () => {
    this.nsp.in(this.roomID).emit("ACT", "NIGHT");

    await delay(5 * 1000);

    this.nsp.in(this.roomID).emit("WAKE", "WEREWOLF");
  };

  public startDay = () => {
    clearInterval(this.intervalId);

    this.nsp.in(this.roomID).emit("ACT", "DAY");

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
      (player) => player.role === PlayerRole.VILLAGER
    );

    return villagers;
  };

  private getWerewolves = () => {
    const werewolves = Array.from(this.players.values()).filter(
      (player) => player.role === PlayerRole.WEREWOLF
    );

    return werewolves;
  };
}
