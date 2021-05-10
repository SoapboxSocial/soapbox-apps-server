import { User } from "@soapboxsocial/minis.js";
import { Namespace } from "socket.io";
import { WerewolfEmitEvents, WerewolfListenEvents } from ".";
import delay from "../../util/delay";
import sample from "../../util/sample";
import Player, { PlayerRole, PlayerStatus } from "./player";
import shuffle from "lodash.shuffle";

const ROUND_DURATION = 60 * 3;

export enum GameAct {
  DAY = "DAY",
  DOCTOR = "DOCTOR",
  NIGHT = "NIGHT",
  NIGHT_SUMMARY = "NIGHT_SUMMARY",
  SEER = "SEER",
  START_ROUND = "START_ROUND",
  VILLAGER = "VILLAGER",
  VOTING = "VOTING",
  WEREWOLF = "WEREWOLF",
  DAY_SUMMARY = "DAY_SUMMARY",
  GAME_OVER = "GAME_OVER",
}

function mostFrequent(array: string[]) {
  return [...array]
    .sort(
      (a, b) =>
        array.filter((v) => v === a).length -
        array.filter((v) => v === b).length
    )
    .pop() as string;
}

export default class Werewolf {
  public players: Map<string, Player>;
  public act!: GameAct;
  public doctorID?: string;
  public seerID?: string;
  public werewolfIDs: string[];
  public markedIDs: string[];
  public votedIDs: string[];
  public roundNumber: number;
  public healedThisRound?: Player;
  public killedThisRound?: Player;

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
    this.votedIDs = [];
    this.roundNumber = 0;
  }

  public addPlayer = (id: string, user: User) => {
    const player = new Player(user);

    this.players.set(id, player);
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
    if (this.markedIDs.length === this.werewolfIDs.length) {
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

    this.killedThisRound = player;
  };

  public healPlayer = (id: string) => {
    const player = this.players.get(id);

    if (typeof player === "undefined") {
      return;
    }

    if (player.status === PlayerStatus.DEAD) {
      player.heal();

      this.healedThisRound = player;
    }
  };

  public scryPlayer = (id: string) => {
    const player = this.players.get(id);

    if (typeof player === "undefined") {
      return false;
    }

    return player.role === PlayerRole.WEREWOLF;
  };

  public votePlayer = async (id: string) => {
    this.votedIDs.push(id);
  };

  public startNight = async () => {
    this.roundNumber = this.roundNumber + 1;
    this.votedIDs = [];
    this.killedThisRound = undefined;
    this.healedThisRound = undefined;
    this.act = GameAct.START_ROUND;

    this.nsp.in(this.roomID).emit("VOTED_PLAYERS", []);

    if (
      Array.from(this.players.values()).filter(
        (player) => typeof player?.role === "undefined"
      ).length > 0
    ) {
      const shuffledPlayers = shuffle(Array.from(this.players));

      let maxWerewolves = 2;
      switch (true) {
        case this.players.size > 8:
          maxWerewolves = 3;
          break;
        case this.players.size > 12:
          maxWerewolves = 4;
          break;
      }

      shuffledPlayers.forEach(([playerSocketID, player]) => {
        let role: PlayerRole = PlayerRole.VILLAGER;

        switch (true) {
          case this.werewolfIDs.length < maxWerewolves:
            this.werewolfIDs.push(playerSocketID);
            role = PlayerRole.WEREWOLF;
            break;
          case typeof this.doctorID === "undefined":
            this.doctorID = playerSocketID;
            role = PlayerRole.DOCTOR;
            break;
          case typeof this.seerID === "undefined":
            this.seerID = playerSocketID;
            role = PlayerRole.SEER;
            break;
        }

        player.assignRole(role);
      });

      const players = Object.fromEntries(this.players.entries());

      this.nsp.in(this.roomID).emit("PLAYERS", players);

      this.nsp.in(this.roomID).emit("ACT", GameAct.START_ROUND);

      await delay(5 * 1000);
    }

    this.act = GameAct.NIGHT;

    this.nsp.in(this.roomID).emit("ACT", GameAct.NIGHT);

    await delay(2 * 1000);

    this.act = GameAct.WEREWOLF;

    this.nsp.in(this.roomID).emit("ACT", GameAct.WEREWOLF);
  };

  public startDay = async () => {
    this.timeRemaining = ROUND_DURATION;

    clearInterval(this.intervalId);

    this.act === GameAct.NIGHT_SUMMARY;

    this.nsp.in(this.roomID).emit("NIGHT_SUMMARY", {
      healed: this?.healedThisRound,
      killed: this?.killedThisRound,
    });

    this.nsp.in(this.roomID).emit("ACT", GameAct.NIGHT_SUMMARY);

    await delay(3 * 1000);

    this.act = GameAct.DAY;

    this.nsp.in(this.roomID).emit("ACT", GameAct.DAY);

    await delay(3 * 1000);

    const players = Object.fromEntries(this.players.entries());

    this.nsp.in(this.roomID).emit("PLAYERS", players);

    this.act = GameAct.VOTING;

    this.nsp.in(this.roomID).emit("ACT", GameAct.VOTING);

    this.intervalId = setInterval(async () => {
      this.timeRemaining = this.timeRemaining - 1;

      this.nsp.in(this.roomID).emit("TIME", this.timeRemaining);

      const alivePlayers = Array.from(this.players.values()).filter(
        (player) => player.status !== PlayerStatus.DEAD
      );

      if (this.votedIDs.length === alivePlayers.length) {
        const highestVotedID = mostFrequent(this.votedIDs);

        this.killPlayer(highestVotedID);

        clearInterval(this.intervalId);

        this.act === GameAct.DAY_SUMMARY;

        this.nsp.in(this.roomID).emit("DAY_SUMMARY", {
          killed: this.players.get(highestVotedID) as Player,
        });

        this.nsp.in(this.roomID).emit("ACT", GameAct.DAY_SUMMARY);

        const players = Object.fromEntries(this.players.entries());

        this.nsp.in(this.roomID).emit("PLAYERS", players);

        await delay(3 * 1000);

        const villagers = this.getVillagers();

        const werewolves = this.getWerewolves();

        const didVillagersWin = werewolves.length === 0;

        const didWerewolvesWin = werewolves.length - 1 === villagers.length;

        console.log({
          villagers: villagers.length,
          werewolves: werewolves.length,
          didVillagersWin,
          didWerewolvesWin,
        });

        if (didVillagersWin || didVillagersWin) {
          this.stop(didWerewolvesWin ? "WEREWOLF" : "VILLAGER");

          return;
        }

        this.startNight();
      }

      if (this.timeRemaining <= 0) {
        clearInterval(this.intervalId);

        this.startNight();
      }
    }, 1000);
  };

  public stop = (winner: "VILLAGER" | "WEREWOLF") => {
    clearInterval(this.intervalId);

    this.nsp.in(this.roomID).emit("ACT", GameAct.GAME_OVER);

    this.nsp.in(this.roomID).emit("WINNER", winner);
  };

  private getVillagers = () => {
    const villagers = Array.from(this.players.values()).filter(
      (player) =>
        player.role !== PlayerRole.WEREWOLF &&
        player.status !== PlayerStatus.DEAD
    );

    return villagers;
  };

  private getWerewolves = () => {
    const werewolves = Array.from(this.players.values()).filter(
      (player) =>
        player.role === PlayerRole.WEREWOLF &&
        player.status !== PlayerStatus.DEAD
    );

    return werewolves;
  };

  public updateAct = (act: GameAct) => {
    this.act = act;
  };
}
