import express from "express";
import Pusher from "pusher";
import { getQuestions, getSessionToken, Question } from "../lib/opentdb";
import arrayRemove from "../util/arrayRemove";
import getRandom from "../util/getRandom";

const DURATION = 15;

const router = express.Router();

const pusher = new Pusher({
  appId: "1174088",
  key: "5d3a6dfd9bbec762d06a",
  secret: "9bda653d64053e1b38c6",
  cluster: "eu",
});

/**
 * Server State
 */

let sessionToken: string;

type Trivia = {
  active: Question;
  category: string;
  questions: Question[] | [];
  timer: number;
  votes: string[] | [];
};

/**
 * Trivia Mini Instances
 */
let instances = new Map<string, Trivia>();

let intervals = new Map<string, NodeJS.Timeout>();

/**
 * Middleware
 */
router.use(async (req, res, next) => {
  if (!sessionToken) {
    console.log("🙋‍♀️ [trivia]: get new sessionToken");

    sessionToken = await getSessionToken();
  }

  next();
});

async function newQuestion(roomID: string) {
  const channelName = `mini-trivia-${roomID}`;

  const mini = instances.get(roomID);

  if (mini) {
    await pusher.trigger(channelName, "vote", {
      votes: [],
    });

    let _questions = mini.questions;

    if (_questions.length === 0) {
      console.log("🙋‍♀️ [trivia]: get new questions");

      _questions = await getQuestions(sessionToken, mini.category);
    }

    const _active = _questions[getRandom(_questions.length)];

    _questions = arrayRemove(_questions, _active);

    instances = new Map(instances).set(roomID, {
      ...mini,
      active: _active,
      questions: _questions,
      votes: [],
    });

    await pusher.trigger(channelName, "question", {
      question: _active,
    });
  }
}

function createTriviaTimer(roomID: string) {
  const channelName = `mini-trivia-${roomID}`;

  return setInterval(async () => {
    const mini = instances.get(roomID);

    if (mini) {
      let timer = mini.timer;

      if (timer >= DURATION) {
        await newQuestion(roomID);

        timer = 0;
      } else {
        timer += 1;
      }

      instances = new Map(instances).set(roomID, {
        ...mini,
        timer: timer,
      });

      await pusher.trigger(channelName, "timer", {
        timer: timer,
      });
    }
  }, 1000);
}

/**
 * Endpoints
 */

router.get("/:roomID/setup", async (req, res) => {
  console.log(`🙋‍♀️ [trivia]:`, `setup trivia`);

  const roomID = req.params.roomID;

  const channelName = `mini-trivia-${roomID}`;

  const category = req.query.category;

  const mini = instances.get(roomID);

  if (!mini) {
    let _questions = await getQuestions(sessionToken, category);

    const _active = _questions[getRandom(_questions.length)];

    _questions = arrayRemove(_questions, _active);

    instances.set(roomID, {
      active: _active,
      // @ts-ignore
      category: category,
      questions: _questions,
      timer: 0,
      votes: [],
    });

    intervals.set(roomID, createTriviaTimer(roomID));

    await pusher.trigger(channelName, "question", {
      question: _active,
    });
  } else {
    await pusher.trigger(channelName, "question", {
      question: mini.active,
    });
  }

  res.sendStatus(200);
});

/**
 * Handle voting for the current Mini
 */
router.post("/:roomID/vote", async (req, res) => {
  console.log(`🙋‍♀️ [trivia]:`, `handle vote`);

  const roomID = req.params.roomID;

  const channelName = `mini-trivia-${roomID}`;

  const { vote } = req.body;

  const mini = instances.get(roomID);

  if (mini) {
    const votes = [...mini.votes, vote];

    instances = new Map(instances).set(roomID, {
      ...mini,
      votes: votes,
    });

    await pusher.trigger(channelName, "vote", {
      votes,
    });
  }

  res.sendStatus(200);
});

/**
 * Reset the current Mini by deleting the instance in the instances Map
 */
router.get("/:roomID/reset", async (req, res) => {
  console.log(`🙋‍♀️ [trivia]:`, `reset state`);

  const roomID = req.params.roomID;

  const channelName = `mini-trivia-${roomID}`;

  await pusher.trigger(channelName, "question", {
    question: null,
  });

  instances.delete(roomID);

  intervals.delete(roomID);

  res.sendStatus(200);
});

/**
 * Metadata endpoint for active Minis
 */
router.get("/metadata", async (req, res) => {
  res.status(200).json({
    active_instances: instances.size,
    instances: Array.from(instances, ([roomID, mini]) => ({ roomID, ...mini })),
    active_intervals: intervals.size,
  });
});

export default router;
