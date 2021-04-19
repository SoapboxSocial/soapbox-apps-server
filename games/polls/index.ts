import { User } from "@soapboxsocial/minis.js";
import { Server } from "socket.io";
import Poll, { PollOption } from "./poll";

interface PollsListenEvents {
  CLOSE_GAME: () => void;
  JOIN_GAME: (user: User) => void;
  VOTE: (vote: PollOption) => void;
  SET_OPTIONS: (options: PollOption[]) => void;
  NEW_POLL: () => void;
}

interface PollsEmitEvents {
  VOTES: (votes: PollOption[]) => void;
  OPTIONS: (options: PollOption[] | null) => void;
}

const games = new Map<string, Poll>();

function getOrStartGame(roomID: string) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    const game = new Poll();

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

export default function polls(io: Server<PollsListenEvents, PollsEmitEvents>) {
  const nsp = io.of("/polls");

  nsp.on("connection", (socket) => {
    const roomID = socket.handshake.query.roomID as string;

    const socketID = socket.id;

    console.log(
      "[polls]",
      "[connection] new socket connected with id",
      socketID
    );

    socket.on("JOIN_GAME", async (user) => {
      console.log("[polls]", "[JOIN_GAME]");

      try {
        socket.join(roomID);

        const game = getOrStartGame(roomID);

        const options = game.getOptions();
        const votes = game.getVotes();

        if (typeof options === "undefined") {
          return;
        }

        socket.emit("OPTIONS", options);

        socket.emit("VOTES", votes);
      } catch (error) {}
    });

    socket.on("SET_OPTIONS", (options) => {
      console.log("[polls]", "[SET_OPTIONS]");

      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.setOptions(options);

      nsp.in(roomID).emit("OPTIONS", options);
    });

    socket.on("NEW_POLL", () => {
      console.log("[polls]", "[NEW_POLL]");

      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.setOptions();

      game.clearVotes();

      nsp.in(roomID).emit("OPTIONS", null);

      nsp.in(roomID).emit("VOTES", []);
    });

    socket.on("VOTE", (vote) => {
      console.log("[polls]", "[VOTE]");

      const game = games.get(roomID);

      if (typeof game === "undefined") {
        return;
      }

      game.vote(vote);

      const votes = game.getVotes();

      nsp.in(roomID).emit("VOTES", votes);
    });

    socket.on("CLOSE_GAME", () => {
      console.log("[polls]", "[CLOSE_GAME]");

      nsp.in(roomID).disconnectSockets(true);

      deleteGame(roomID);
    });

    socket.on("disconnect", (reason) => {
      console.log(
        "[polls]",
        "[disconnect] socket disconnected with reason",
        reason
      );

      socket.leave(roomID);
    });
  });
}
