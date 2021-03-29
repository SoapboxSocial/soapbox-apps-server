import Pusher from "pusher";

export const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID as string,
  key: process.env.PUSHER_KEY as string,
  secret: process.env.PUSHER_SECRET_KEY as string,
  cluster: "eu",
});
