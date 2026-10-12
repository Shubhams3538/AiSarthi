import { startServer } from "./src/server";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be between 1 and 65535");

startServer({
  dbUrl: process.env.DB_URL || "mongodb://127.0.0.1:27017/aisarthi",
  port,
  origins: process.env.ALLOWED_ORIGINS?.split(",")
    .map((value) => value.trim())
    .filter(Boolean),
})
  .then((server) => {
    console.log(`aiSarthi listening at ws://127.0.0.1:${server.port}`);
    let closing = false;
    const shutdown = async () => {
      if (closing) return;
      closing = true;
      await server.close();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  })
  .catch((error) => {
    console.error(
      "Could not start aiSarthi. Check MongoDB and PORT.",
      error.message,
    );
    process.exit(1);
  });
