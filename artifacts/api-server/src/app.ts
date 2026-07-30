import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.get("/", (_req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Replit Assistant API</title>
  <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0e0e10;color:#fff;}
  .box{text-align:center;}.dot{width:12px;height:12px;border-radius:50%;background:#22c55e;display:inline-block;margin-right:8px;}</style>
  </head><body><div class="box"><h2><span class="dot"></span>API online</h2>
  <p style="color:#888">Replit Assistant — backend running</p>
  <p style="color:#555;font-size:13px">GET /api/healthz</p></div></body></html>`);
});

app.use("/api", router);

export default app;
