import express from "express";

const app = express();

const PORT = 8080;

app.get("/", async (_, res) => res.send("🧼 Soapbox Minis Server"));

app.get("/trivia/:roomId", async (req, res) => {
  try {
    const roomId = req.params.roomId;

    res.send(roomId);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`⚡️ [server]: running at https://localhost:${PORT}`);
});
