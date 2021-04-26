import { User } from "@soapboxsocial/minis.js";
import { Namespace, Server } from "socket.io";
import Werewolf from "./werewolf";
import Player from "./player";
import delay from "../../util/delay";

export interface WerewolfListenEvents {
  JOIN_GAME: (user: User) => void;
  CLOSE_GAME: () => void;
  KILL: (id: string) => void;
  HEAL: (id: string) => void;
  SCRY: (id: string) => void;
}

export interface WerewolfEmitEvents {
  TIME: (timeLeft: number) => void;
  WINNER: (winner: "VILLAGER" | "WEREWOLF") => void;
  PLAYERS: (players: Map<string, Player>) => void;
  ACT: (act: "NIGHT" | "WEREWOLF" | "DOCTOR" | "SEER" | "DAY") => void;
  WAKE: (role: "WEREWOLF" | "DOCTOR" | "SEER") => void;
  SLEEP: (role: "WEREWOLF" | "DOCTOR" | "SEER") => void;
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
    const roomID = socket.handshake.query.roomID as string;

    const socketID = socket.id;

    socket.on("JOIN_GAME", async (user) => {
      console.log("[werewolf]", "[JOIN_GAME]");

      try {
        socket.join(roomID);

        const game = getOrStartGame(roomID, nsp);

        game.addPlayer(socketID, user);

        socket.emit("PLAYERS", game.players);
      } catch (error) {
        console.error(error);
      }
    });

    socket.on("CLOSE_GAME", () => {
      console.log("[draw]", "[CLOSE_GAME]");

      nsp.in(roomID).disconnectSockets(true);

      deleteGame(roomID);
    });

    socket.on("KILL", async (id) => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.killPlayer(id);

      nsp.in(roomID).emit("SLEEP", "WEREWOLF");

      await delay(5 * 1000);

      nsp.in(roomID).emit("WAKE", "DOCTOR");
    });

    socket.on("HEAL", async (id) => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.healPlayer(id);

      nsp.in(roomID).emit("SLEEP", "DOCTOR");

      await delay(5 * 1000);

      nsp.in(roomID).emit("WAKE", "SEER");
    });

    socket.on("SCRY", async (id) => {
      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.scryPlayer(id);

      nsp.in(roomID).emit("SLEEP", "SEER");

      await delay(5 * 1000);

      game.startDay();
    });

    socket.on("disconnect", (reason) => {
      console.log(
        "[werewolf]",
        "[disconnect] socket disconnected with reason",
        reason
      );

      socket.leave(roomID);
    });
  });
}
