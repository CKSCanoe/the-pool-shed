import http from "node:http";
import worker from "../worker/index.js";

const port = Number(process.env.PORT || 4173);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  const request = new Request(url, { method: req.method || "GET" });
  const response = await worker.fetch(request, {}, {});
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(port, () => {
  console.log(`Pool Bros Stock Hub running at http://localhost:${port}`);
});
