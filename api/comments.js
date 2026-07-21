const { db, ensureTables, readBody, send } = require("./_db");

module.exports = async function handler(request, response) {
  try {
    await ensureTables();
    const query = db();

    if (request.method === "GET") {
      const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
      const projectId = url.searchParams.get("projectId");
      const rows = projectId
        ? await query`
            SELECT data
            FROM portfolio_comments
            WHERE project_id = ${projectId}
            ORDER BY created_at DESC
          `
        : await query`
            SELECT data
            FROM portfolio_comments
            ORDER BY created_at DESC
          `;
      send(response, 200, { comments: rows.map((row) => row.data) });
      return;
    }

    if (request.method === "POST") {
      const body = await readBody(request);
      const comment = body.comment || body;
      if (!comment || !comment.id || !comment.projectId) {
        send(response, 400, { error: "Comment id and project id are required." });
        return;
      }
      await query`
        INSERT INTO portfolio_comments (id, project_id, data, updated_at)
        VALUES (${comment.id}, ${comment.projectId}, ${JSON.stringify(comment)}::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET project_id = EXCLUDED.project_id, data = EXCLUDED.data, updated_at = NOW()
      `;
      send(response, 200, { ok: true, comment });
      return;
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
      const id = url.searchParams.get("id");
      if (!id) {
        send(response, 400, { error: "Comment id is required." });
        return;
      }
      await query`DELETE FROM portfolio_comments WHERE id = ${id}`;
      send(response, 200, { ok: true });
      return;
    }

    send(response, 405, { error: "Method not allowed." });
  } catch (error) {
    send(response, 500, { error: error.message || "Server error." });
  }
};
