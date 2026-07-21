const { db, ensureTables, readBody, send } = require("./_db");

const emptyCounts = { like: 0, dislike: 0, fire: 0 };

module.exports = async function handler(request, response) {
  try {
    await ensureTables();
    const query = db();

    if (request.method === "GET") {
      const rows = await query`
        SELECT project_id, data
        FROM portfolio_reactions
        ORDER BY updated_at DESC
      `;
      send(response, 200, {
        reactions: Object.fromEntries(rows.map((row) => [row.project_id, { ...emptyCounts, ...row.data }]))
      });
      return;
    }

    if (request.method === "POST") {
      const body = await readBody(request);
      const projectId = body.projectId;
      const reaction = body.reaction;
      if (!projectId || !["like", "dislike", "fire"].includes(reaction)) {
        send(response, 400, { error: "Project id and valid reaction are required." });
        return;
      }
      const existingRows = await query`
        SELECT data
        FROM portfolio_reactions
        WHERE project_id = ${projectId}
      `;
      const counts = { ...emptyCounts, ...(existingRows[0]?.data || {}) };
      counts[reaction] += 1;
      await query`
        INSERT INTO portfolio_reactions (project_id, data, updated_at)
        VALUES (${projectId}, ${JSON.stringify(counts)}::jsonb, NOW())
        ON CONFLICT (project_id)
        DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `;
      send(response, 200, { ok: true, projectId, counts });
      return;
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
      const projectId = url.searchParams.get("projectId");
      if (!projectId) {
        send(response, 400, { error: "Project id is required." });
        return;
      }
      await query`DELETE FROM portfolio_reactions WHERE project_id = ${projectId}`;
      send(response, 200, { ok: true, projectId, counts: emptyCounts });
      return;
    }

    send(response, 405, { error: "Method not allowed." });
  } catch (error) {
    send(response, 500, { error: error.message || "Server error." });
  }
};
