import express from "express";
import Pusher from "pusher";
import { getQuestions, getSessionToken, Question } from "../lib/opentdb";
import arrayRemove from "../util/arrayRemove";
import getRandom from "../util/getRandom";

const DURATION = 15;

const router = express.Router();

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID as string,
  key: process.env.PUSHER_KEY as string,
  secret: process.env.PUSHER_SECRET_KEY as string,
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

function createTriviaTimer(roomID: string) {
  const channelName = `mini-trivia-${roomID}`;

  return setInterval(() => {
    console.time("setIntervalFunction");

    const mini = instances.get(roomID);

    if (mini) {
      let timer = mini.timer;
      let questions = mini.questions;
      let votes = mini.votes;
      let active = mini.active;

      if (timer >= DURATION) {
        /**
         * Reset timer & votes
         */
        timer = 0;
        votes = [];

        /**
         * Get new question
         */
        active = questions[getRandom(questions.length)];

        /**
         * Remove new question from questions array
         */
        questions = arrayRemove(questions, active);

        /**
         * Push with empty votes
         */
        pusher.trigger(channelName, "vote", {
          votes: [],
        });

        /**
         * Push new question to clients
         */
        pusher.trigger(channelName, "question", {
          question: active,
        });
      } else {
        timer += 1;
      }

      /**
       * Update Instance
       */
      instances = new Map(instances).set(roomID, {
        ...mini,
        active: active,
        questions: questions,
        timer: timer,
        votes: votes,
      });

      /**
       * Push Timer
       */
      pusher.trigger(channelName, "timer", {
        timer: timer,
      });
    }

    console.timeEnd("setIntervalFunction");
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

  try {
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
    }

    res.sendStatus(200);
  } catch (error) {
    console.error(error);

    res.status(500).send(error.message);
  }
});

/**
 * Handle voting for the current Mini
 */
router.post("/:roomID/vote", async (req, res) => {
  console.log(`🙋‍♀️ [trivia]:`, `handle vote`);

  const roomID = req.params.roomID;

  const channelName = `mini-trivia-${roomID}`;

  try {
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
  } catch (error) {
    console.error(error);

    res.status(500).send(error.message);
  }
});

/**
 * Reset the current Mini by deleting the instance in the instances Map
 */
router.get("/:roomID/reset", async (req, res) => {
  console.log(`🙋‍♀️ [trivia]:`, `reset state`);

  const roomID = req.params.roomID;

  const channelName = `mini-trivia-${roomID}`;

  try {
    const interval = intervals.get(roomID);

    if (interval) {
      clearInterval(interval);
    }

    await pusher.trigger(channelName, "question", {
      question: null,
    });

    instances.delete(roomID);

    intervals.delete(roomID);

    res.sendStatus(200);
  } catch (error) {
    console.error(error);

    res.status(500).send(error.message);
  }
});

/**
 * Metadata endpoint for active Minis
 */
router.get("/metadata", async (_, res) => {
  res.status(200).json({
    active_instances: instances.size,
    active_intervals: intervals.size,
    instances: Array.from(instances, ([roomID, mini]) => ({
      roomID,
      ...mini,
    })),
  });
});

export default router;
