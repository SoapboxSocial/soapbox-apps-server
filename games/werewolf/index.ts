import { User } from "@soapboxsocial/minis.js";
import { Namespace, Server } from "socket.io";
import Werewolf, { GameAct } from "./werewolf";
import Player, { PlayerRole, PlayerStatus } from "./player";
import delay from "../../util/delay";

type ScryResult = {
  id: string;
  isWerewolf: boolean;
};

export interface WerewolfListenEvents {
  CLOSE_GAME: () => void;
  JOIN_GAME: (user: User) => void;
  MARK: (id: string) => void;
  HEAL: (id: string) => void;
  SCRY: (id: string) => void;
  START_GAME: () => void;
  VOTE: (id: string) => void;
  END_TURN: (role: GameAct) => void;
}

export interface WerewolfEmitEvents {
  TIME: (timeLeft: number) => void;
  WINNER: (winner: "VILLAGER" | "WEREWOLF") => void;
  PLAYERS: (players: { [id: string]: Player }) => void;
  ACT: (act: GameAct) => void;
  MARKED_KILLS: (marked: string[]) => void;
  SCRYED_PLAYER: (scryed: ScryResult) => void;
  VOTED_PLAYERS: (voted: string[]) => void;
  NIGHT_SUMMARY: (summary: { healed?: Player; killed?: Player }) => void;
  DAY_SUMMARY: (summary: { killed: Player }) => void;
}

const games = new Map<string, Werewolf>();

function getOrStartGame(
  roomID: string,
  nsp: Namespace<WerewolfListenEvents, WerewolfEmitEvents>
) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    const game = new Werewolf(roomID, nsp);

    games.set(roomID, game);

    return game;
  } else {
    return instance;
  }
}

function deleteGame(roomID: string) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    return;
  }

  games.delete(roomID);
}

export default function werewolf(
  io: Server<WerewolfListenEvents, WerewolfEmitEvents>
) {
  const nsp = io.of("/werewolf");

  nsp.on("connection", (socket) => {
    console.log(
      "[werewolf]",
      "[connection] socket connected with id",
      socket.id
    );

    const roomID = socket.handshake.query.roomID as string;

    const socketID = socket.id;

    socket.on("JOIN_GAME", async (user) => {
      console.log("[werewolf]", "[JOIN_GAME]");

      try {
        socket.join(roomID);

        const game = getOrStartGame(roomID, nsp);

        if (typeof game.act !== "undefined") {
          return;
        }

        game.addPlayer(socketID, user);

        const players = Object.fromEntries(game.players.entries());

        nsp.in(roomID).emit("PLAYERS", players);
      } catch (error) {
        console.error(error);
      }
    });

    socket.on("START_GAME", () => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      if (game.players.size < 6) {
        return;
      }

      if (typeof game.act === "undefined") {
        game.startNight();
      }
    });

    socket.on("CLOSE_GAME", () => {
      console.log("[draw]", "[CLOSE_GAME]");

      nsp.in(roomID).disconnectSockets(true);

      deleteGame(roomID);
    });

    socket.on("END_TURN", async (role) => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      if (role === GameAct.DOCTOR) {
        game.updateAct(GameAct.SEER);

        nsp.in(roomID).emit("ACT", GameAct.SEER);
      }

      if (role === GameAct.SEER) {
        game.startDay();
      }
    });

    socket.on("MARK", async (id) => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.markPlayer(id);

      const werewolfIDs = game.werewolfIDs;

      const markedIDs = game.markedIDs;

      nsp.to(werewolfIDs).emit("MARKED_KILLS", markedIDs);

      const aliveWerewolves = Array.from(game.players.values()).filter(
        (player) =>
          player.role === PlayerRole.WEREWOLF &&
          player.status === PlayerStatus.ALIVE
      );

      if (game.markedIDs.length === aliveWerewolves.length) {
        game.killMarked();

        nsp.to(werewolfIDs).emit("MARKED_KILLS", []);

        game.updateAct(GameAct.DOCTOR);

        nsp.in(roomID).emit("ACT", GameAct.DOCTOR);
      }
    });

    socket.on("VOTE", async (id) => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.votePlayer(id);

      const votedPlayers = game.votedIDs;

      nsp.in(roomID).emit("VOTED_PLAYERS", votedPlayers);
    });

    socket.on("HEAL", async (id) => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.healPlayer(id);

      game.updateAct(GameAct.SEER);

      nsp.in(roomID).emit("ACT", GameAct.SEER);
    });

    socket.on("SCRY", async (id) => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      const isWerewolf = game.scryPlayer(id);

      if (isWerewolf) {
        socket.emit("SCRYED_PLAYER", { id, isWerewolf });

        await delay(3 * 1000);
      }

      game.startDay();
    });

    socket.on("disconnect", (reason) => {
      console.log(
        "[werewolf]",
        "[disconnect] socket disconnected with reason",
        reason
      );

      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.removePlayer(socketID);

      const players = Object.fromEntries(game.players.entries());

      nsp.in(roomID).emit("PLAYERS", players);

      if (game.players.size === 0) {
        deleteGame(roomID);
      }

      socket.leave(roomID);
    });
  });
}
