const path = require("path");
const express = require("express");
const cors = require("cors");
const { db, ensureTables } = require("./api/_db");

const app = express();
const port = process.env.PORT || 10000;
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(express.json({ limit: "1mb" }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin is not allowed by CORS."));
  }
}));

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

app.get("/health", asyncRoute(async (_request, response) => {
  await ensureTables();
  response.json({ ok: true });
}));

app.get("/api/projects", asyncRoute(async (_request, response) => {
  await ensureTables();
  const rows = await db()`
    SELECT data
    FROM portfolio_projects
    ORDER BY COALESCE((data->>'order')::int, 9999), updated_at DESC
  `;
  response.json({ projects: rows.map((row) => row.data) });
}));

app.post("/api/projects", asyncRoute(async (request, response) => {
  await ensureTables();
  const project = request.body.project || request.body;
  if (!project || !project.id) {
    response.status(400).json({ error: "Project id is required." });
    return;
  }
  await db()`
    INSERT INTO portfolio_projects (id, data, updated_at)
    VALUES (${project.id}, ${JSON.stringify(project)}::jsonb, NOW())
    ON CONFLICT (id)
    DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
  response.json({ ok: true, project });
}));

app.delete("/api/projects", asyncRoute(async (request, response) => {
  await ensureTables();
  const id = request.query.id;
  if (!id) {
    response.status(400).json({ error: "Project id is required." });
    return;
  }
  await db()`DELETE FROM portfolio_projects WHERE id = ${id}`;
  response.json({ ok: true });
}));

app.get("/api/reviews", asyncRoute(async (_request, response) => {
  await ensureTables();
  const rows = await db()`
    SELECT data
    FROM portfolio_reviews
    ORDER BY updated_at DESC
  `;
  response.json({ reviews: rows.map((row) => row.data) });
}));

app.post("/api/reviews", asyncRoute(async (request, response) => {
  await ensureTables();
  const review = request.body.review || request.body;
  if (!review || !review.id) {
    response.status(400).json({ error: "Review id is required." });
    return;
  }
  await db()`
    INSERT INTO portfolio_reviews (id, data, updated_at)
    VALUES (${review.id}, ${JSON.stringify(review)}::jsonb, NOW())
    ON CONFLICT (id)
    DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
  response.json({ ok: true, review });
}));

app.delete("/api/reviews", asyncRoute(async (request, response) => {
  await ensureTables();
  const id = request.query.id;
  if (!id) {
    response.status(400).json({ error: "Review id is required." });
    return;
  }
  await db()`DELETE FROM portfolio_reviews WHERE id = ${id}`;
  response.json({ ok: true });
}));

app.use(express.static(__dirname));
app.use((_request, response) => {
  response.sendFile(path.join(__dirname, "index.html"));
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: error.message || "Server error." });
});

app.listen(port, () => {
  console.log(`JOSHGRAPHIX backend listening on ${port}`);
});
