import cors from "cors";
import express from "express";
import trivia from "./routes/trivia";

const app = express();

/**
 * App Middleware
 */
app.use(cors());

/**
 * App Routes
 */
app.use("/trivia", trivia);

/**
 * App Startup
 */

app.set("PORT", process.env.PORT || 8080);

app.listen(app.get("PORT"), () => {
  console.log(`🧼 [server]: listening at ${app.get("PORT")}`);
});
