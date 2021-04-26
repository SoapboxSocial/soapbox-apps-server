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

  constructor(
    roomID: string,
    nsp: Namespace<WerewolfListenEvents, WerewolfEmitEvents>
  ) {
    this.nsp = nsp;
    this.roomID = roomID;
    this.players = new Map();
    this.timeRemaining = ROUND_DURATION;
  }

  public addPlayer = (id: string, user: User) => {
    // Assign Roles Based On Player Count

    const player = new Player(user, PlayerRole.VILLAGER);

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

    this.nsp.in(this.roomID).emit("ACT", "WEREWOLF");
  };

  public startDay = () => {
    clearInterval(this.intervalId);

    this.nsp.in(this.roomID).emit("ACT", "DAY");

    // 5a. Handle What Happened In The Night (Who Was Killed, Who Was Saved)

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
