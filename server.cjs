const path = require("path");
const express = require("express");
const cors = require("cors");
const { db, ensureTables } = require("./api/_db");

const app = express();
const port = process.env.PORT || 10000;
const emptyReactionCounts = { like: 0, dislike: 0, fire: 0 };
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(express.json({ limit: "2mb" }));
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

app.get("/api/comments", asyncRoute(async (request, response) => {
  await ensureTables();
  const projectId = request.query.projectId;
  const rows = projectId
    ? await db()`
        SELECT data
        FROM portfolio_comments
        WHERE project_id = ${projectId}
        ORDER BY created_at DESC
      `
    : await db()`
        SELECT data
        FROM portfolio_comments
        ORDER BY created_at DESC
      `;
  response.json({ comments: rows.map((row) => row.data) });
}));

app.post("/api/comments", asyncRoute(async (request, response) => {
  await ensureTables();
  const comment = request.body.comment || request.body;
  if (!comment || !comment.id || !comment.projectId) {
    response.status(400).json({ error: "Comment id and project id are required." });
    return;
  }
  await db()`
    INSERT INTO portfolio_comments (id, project_id, data, updated_at)
    VALUES (${comment.id}, ${comment.projectId}, ${JSON.stringify(comment)}::jsonb, NOW())
    ON CONFLICT (id)
    DO UPDATE SET project_id = EXCLUDED.project_id, data = EXCLUDED.data, updated_at = NOW()
  `;
  response.json({ ok: true, comment });
}));

app.delete("/api/comments", asyncRoute(async (request, response) => {
  await ensureTables();
  const id = request.query.id;
  if (!id) {
    response.status(400).json({ error: "Comment id is required." });
    return;
  }
  await db()`DELETE FROM portfolio_comments WHERE id = ${id}`;
  response.json({ ok: true });
}));

app.get("/api/reactions", asyncRoute(async (_request, response) => {
  await ensureTables();
  const rows = await db()`
    SELECT project_id, data
    FROM portfolio_reactions
    ORDER BY updated_at DESC
  `;
  response.json({
    reactions: Object.fromEntries(rows.map((row) => [row.project_id, { ...emptyReactionCounts, ...row.data }]))
  });
}));

app.post("/api/reactions", asyncRoute(async (request, response) => {
  await ensureTables();
  const projectId = request.body.projectId;
  const reaction = request.body.reaction;
  if (!projectId || !["like", "dislike", "fire"].includes(reaction)) {
    response.status(400).json({ error: "Project id and valid reaction are required." });
    return;
  }
  const rows = await db()`
    SELECT data
    FROM portfolio_reactions
    WHERE project_id = ${projectId}
  `;
  const counts = { ...emptyReactionCounts, ...(rows[0]?.data || {}) };
  counts[reaction] += 1;
  await db()`
    INSERT INTO portfolio_reactions (project_id, data, updated_at)
    VALUES (${projectId}, ${JSON.stringify(counts)}::jsonb, NOW())
    ON CONFLICT (project_id)
    DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
  response.json({ ok: true, projectId, counts });
}));

app.delete("/api/reactions", asyncRoute(async (request, response) => {
  await ensureTables();
  const projectId = request.query.projectId;
  if (!projectId) {
    response.status(400).json({ error: "Project id is required." });
    return;
  }
  await db()`DELETE FROM portfolio_reactions WHERE project_id = ${projectId}`;
  response.json({ ok: true, projectId, counts: emptyReactionCounts });
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
