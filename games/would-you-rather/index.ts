import { User } from "@soapboxsocial/minis.js";
import { Server } from "socket.io";
import WouldYouRather, { WYROption, WYRPair } from "./would-you-rather";

interface WYRListenEvents {
  JOIN_GAME: (user: User) => void;
  VOTE: (vote: WYROption) => void;
  NEW_PROMPT: () => void;
  CLOSE_GAME: () => void;
}

interface WYREmitEvents {
  VOTES: (votes: WYROption[]) => void;
  PROMPT: (prompt: WYRPair | null) => void;
}

const games = new Map<string, WouldYouRather>();

function getOrStartGame(roomID: string) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    const game = new WouldYouRather();

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

export default function wouldYouRather(
  io: Server<WYRListenEvents, WYREmitEvents>
) {
  const nsp = io.of("/wyr");

  nsp.on("connection", (socket) => {
    const roomID = socket.handshake.query.roomID as string;

    const socketID = socket.id;

    console.log(
      "[would-you-rather]",
      "[connection] new socket connected with id",
      socketID
    );

    socket.on("JOIN_GAME", async (user) => {
      console.log("[would-you-rather]", "[JOIN_GAME]");

      try {
        socket.join(roomID);

        const game = getOrStartGame(roomID);

        let prompt = game.getPrompt();
        const votes = game.getVotes();

        if (typeof prompt === "undefined") {
          prompt = game.getNewPrompt();
        }

        socket.emit("PROMPT", prompt);

        socket.emit("VOTES", votes);
      } catch (error) {}
    });

    socket.on("NEW_PROMPT", () => {
      console.log("[would-you-rather]", "[NEW_PROMPT]");

      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      const prompt = game.getNewPrompt();

      game.clearVotes();

      nsp.in(roomID).emit("PROMPT", prompt);

      nsp.in(roomID).emit("VOTES", []);
    });

    socket.on("VOTE", (vote) => {
      console.log("[would-you-rather]", "[VOTE]");

      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.vote(vote);

      const votes = game.getVotes();

      nsp.in(roomID).emit("VOTES", votes);
    });

    socket.on("CLOSE_GAME", () => {
      console.log("[would-you-rather]", "[CLOSE_GAME]");

      nsp.in(roomID).disconnectSockets(true);

      deleteGame(roomID);
    });

    socket.on("disconnect", (reason) => {
      console.log(
        "[would-you-rather]",
        "[disconnect] socket disconnected with reason",
        reason
      );

      socket.leave(roomID);
    });
  });
}
