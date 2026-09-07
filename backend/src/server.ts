import "./lib/env.js";
import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 8081);
const host = process.env.HOST ?? "localhost";

const app = buildApp();

app.listen(port, host, () => {
  console.log(`Puro API listening on http://${host}:${port}/api/health`);
});
