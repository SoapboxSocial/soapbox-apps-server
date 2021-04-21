import express from "express";
import { Trivia } from "../games/trivia/trivia";
import { DifficultyOptions, Vote } from "../lib/opentdb";

const router = express.Router();

let games = new Map<string, Trivia>();

async function startOrUpdateGame(
  roomID: string,
  category: string,
  difficulty: DifficultyOptions
) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    const game = new Trivia(roomID, category, difficulty);

    await game.start();

    games.set(roomID, game);

    return game;
  } else {
    await instance.update(category, difficulty);

    return instance;
  }
}

async function deleteGame(roomID: string) {
  const instance = games.get(roomID);

  if (typeof instance === "undefined") {
    return;
  }

  await instance.stop();

  games.delete(roomID);
}

router.get("/:roomID/setup", async (req, res) => {
  const roomID = req.params.roomID;
  const category = req.query.category as string;
  const difficulty = req.query.difficulty as DifficultyOptions;

  try {
    await startOrUpdateGame(roomID, category, difficulty);

    res.sendStatus(200);
  } catch (error) {
    console.error(error);

    res.status(500).send(error.message);
  }
});

router.post("/:roomID/vote", async (req, res) => {
  const roomID = req.params.roomID;

  try {
    const { vote }: { vote: Vote } = req.body;

    const game = games.get(roomID);

    if (game) {
      await game.vote(vote);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error(error);

    res.status(500).send(error.message);
  }
});

router.get("/:roomID/reset", async (req, res) => {
  const roomID = req.params.roomID;

  try {
    await deleteGame(roomID);

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.message);
  }
});

export default router;
