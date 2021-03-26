import express from "express";
import Pusher from "pusher";
import { getQuestions, getSessionToken, Question, Vote } from "../lib/opentdb";
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

type Trivia = {
  active: Question;
  category: string;
  questions: Question[] | [];
  sessionToken: string;
  timer: number;
  votes: Vote[] | [];
};

/**
 * Trivia Mini Instances
 */
let instances = new Map<string, Trivia>();

let scores = new Map<string, { [key: string]: number }>();

let intervals = new Map<string, NodeJS.Timeout>();

function createTriviaTimer(roomID: string) {
  const channelName = `mini-trivia-${roomID}`;

  const triviaTimer = setInterval(() => {
    const mini = instances.get(roomID);

    if (mini) {
      let timer = mini.timer;
      let questions = mini.questions;
      let votes = mini.votes;
      let active = mini.active;

      if (timer === DURATION - 5) {
        pusher.trigger(channelName, "reveal", {});
      }

      if (timer >= DURATION) {
        /**
         * Reset timer
         */
        timer = 0;

        /**
         * Reset votes
         */
        votes = [];

        if (questions.length > 0) {
          /**
           * Get new question
           */
          active = questions[getRandom(questions.length)];

          /**
           * Remove new question from questions array
           */
          questions = arrayRemove(questions, active);

          /**
           * Push with empty votes & new question to client
           */
          pusher.triggerBatch([
            {
              channel: channelName,
              name: "vote",
              data: { votes: votes },
            },
            {
              channel: channelName,
              name: "question",
              data: { question: active },
            },
          ]);
        } else {
          clearInterval(triviaTimer);

          /**
           * Push with empty votes & empty question to bail out of UI
           */
          pusher.triggerBatch([
            {
              channel: channelName,
              name: "vote",
              data: { votes: votes },
            },
            {
              channel: channelName,
              name: "question",
              data: { question: null },
            },
            {
              channel: channelName,
              name: "scores",
              data: { scores: scores.get(roomID) },
            },
          ]);
        }
      } else {
        /**
         * Increment Timer
         */
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
  }, 1000);

  return triviaTimer;
}

/**
 * Endpoints
 */

router.get("/:roomID/setup", async (req, res) => {
  const roomID = req.params.roomID;

  const channelName = `mini-trivia-${roomID}`;

  const category = req.query.category;

  try {
    const mini = instances.get(roomID);

    if (mini) {
      console.log(`🙋‍♀️ [trivia]:`, `update trivia`);

      let questions = await getQuestions(mini.sessionToken, category);

      const active = questions[getRandom(questions.length)];

      questions = arrayRemove(questions, active);

      /**
       * Update Game Instance
       */
      instances = new Map(instances).set(roomID, {
        ...mini,
        active: active,
        category: category as string,
        questions: questions,
        timer: 0,
        votes: [],
      });

      intervals.set(roomID, createTriviaTimer(roomID));

      await pusher.trigger(channelName, "question", {
        question: active,
      });
    } else {
      console.log(`🙋‍♀️ [trivia]:`, `setup trivia`);

      const sessionToken = await getSessionToken();

      let questions = await getQuestions(sessionToken, category);

      const active = questions[getRandom(questions.length)];

      questions = arrayRemove(questions, active);

      instances.set(roomID, {
        active: active,
        category: category as string,
        questions: questions,
        sessionToken: sessionToken,
        timer: 0,
        votes: [],
      });

      intervals.set(roomID, createTriviaTimer(roomID));

      scores.set(roomID, {});

      await pusher.trigger(channelName, "question", {
        question: active,
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
    const { vote }: { vote: Vote } = req.body;

    const mini = instances.get(roomID);

    if (mini) {
      const votes = [...mini.votes, vote];

      const display_name = vote.user.display_name;

      const isCorrect = vote.answer === mini.active.correct_answer;

      let scoreboard = scores.get(roomID);

      if (scoreboard) {
        if (Object.getOwnPropertyDescriptor(scoreboard, display_name)) {
          scoreboard[display_name] = scoreboard[display_name] += isCorrect
            ? 100
            : 0;
        } else {
          scoreboard[display_name] = isCorrect ? 100 : 0;
        }

        scores = new Map(scores).set(roomID, scoreboard);
      }

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

    scores.delete(roomID);

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
