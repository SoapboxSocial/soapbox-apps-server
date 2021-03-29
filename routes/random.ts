import type { User } from "@soapboxsocial/minis.js";
import express from "express";
import { pusher } from "../lib/pusher";
import getRandom from "../util/getRandom";

const router = express.Router();

router.post("/:roomID/choose-member", async (req, res) => {
  console.log(`🎲 [random]:`, `handle choose member`);

  const roomID = req.params.roomID;

  const channelName = `mini-random-${roomID}`;

  try {
    await pusher.trigger(channelName, "member", {
      member: null,
    });

    const { members }: { members: User[] } = req.body;

    const member = members[getRandom(members.length)];

    await pusher.trigger(channelName, "member", {
      member: member,
    });

    res.sendStatus(200);
  } catch (error) {
    console.error(error);

    res.status(500).send(error.message);
  }
});

export default router;
