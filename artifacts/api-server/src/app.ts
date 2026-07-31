import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import fs from "fs";
import path from "path";
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

// ── Expo landing page + static bundle serving ─────────────────────────────────
// `process.cwd()` is the workspace root when the server is started with:
//   node artifacts/api-server/dist/index.mjs
const STATIC_ROOT = path.join(process.cwd(), "artifacts/assistant/static-build");
const TEMPLATE_PATH = path.join(
  process.cwd(),
  "artifacts/assistant/server/templates/landing-page.html",
);
const APP_JSON_PATH = path.join(process.cwd(), "artifacts/assistant/app.json");

function getAppName(): string {
  try {
    const raw = fs.readFileSync(APP_JSON_PATH, "utf-8");
    return (JSON.parse(raw) as { expo?: { name?: string } }).expo?.name ?? "Assistente";
  } catch {
    return "Assistente";
  }
}

const expoBuilt = fs.existsSync(STATIC_ROOT);

if (!expoBuilt) {
  logger.warn("No Expo static build found – landing page will not be available");
}

let landingTemplate: string | null = null;
if (expoBuilt) {
  try {
    landingTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  } catch {
    logger.warn("Landing page template missing");
  }
}

const appName = getAppName();

// Expo manifest endpoint (called by Expo Go when scanning the QR code)
app.get(["/", "/manifest"], (req: Request, res: Response, next: NextFunction) => {
  const platform = req.headers["expo-platform"] as string | undefined;
  if (platform === "ios" || platform === "android") {
    const manifestPath = path.join(STATIC_ROOT, platform, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
      return;
    }
    res.setHeader("content-type", "application/json");
    res.setHeader("expo-protocol-version", "1");
    res.setHeader("expo-sfv-version", "0");
    res.sendFile(manifestPath);
    return;
  }
  next();
});

// Landing page with QR code
app.get("/", (req: Request, res: Response) => {
  if (!landingTemplate) {
    res.send(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${appName} API</title></head>` +
        `<body style="font-family:sans-serif;padding:40px;text-align:center">` +
        `<h2>✅ API online</h2><p>Expo build not found. Run the build step first.</p>` +
        `</body></html>`,
    );
    return;
  }

  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  const host =
    (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost";
  const baseUrl = `${proto}://${host}`;

  const html = landingTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, host)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.type("html").send(html);
});

// Serve Expo bundle assets (JS, fonts, images…)
if (expoBuilt) {
  app.use(
    express.static(STATIC_ROOT, {
      maxAge: "1y",
      immutable: true,
    }),
  );
}

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api", router);

export default app;
