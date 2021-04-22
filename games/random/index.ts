import type { User } from "@soapboxsocial/minis.js";
import { Server } from "socket.io";
import sample from "../../util/sample";

interface RandomListenEvents {
  SEND_MEMBERS: (members: User[]) => void;
}

interface RandomEmitEvents {
  MEMBER: (data: User | null) => void;
}

export default function randomMember(
  io: Server<RandomListenEvents, RandomEmitEvents>
) {
  const nsp = io.of("/random");

  nsp.on("connection", (socket) => {
    const roomID = socket.handshake.query.roomID as string;

    const socketID = socket.id;

    socket.join(roomID);

    console.log(
      "[random]",
      "[connection] new socket connected with id",
      socketID
    );

    socket.on("SEND_MEMBERS", (members: User[]) => {
      console.log("[random]", "[SEND_MEMBERS]");

      nsp.to(roomID).emit("MEMBER", null);

      const member = sample(members);

      nsp.to(roomID).emit("MEMBER", member);
    });

    socket.on("disconnect", (reason) => {
      console.log(
        "[random]",
        "[disconnect] socket disconnected with reason",
        reason
      );

      socket.leave(roomID);
    });
  });
}
