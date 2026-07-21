const { db, ensureTables, readBody, send } = require("./_db");

module.exports = async function handler(request, response) {
  try {
    await ensureTables();
    const query = db();

    if (request.method === "GET") {
      const rows = await query`
        SELECT data
        FROM portfolio_projects
        ORDER BY COALESCE((data->>'order')::int, 9999), updated_at DESC
      `;
      send(response, 200, { projects: rows.map((row) => row.data) });
      return;
    }

    if (request.method === "POST" || request.method === "PUT") {
      const body = await readBody(request);
      const project = body.project || body;
      if (!project || !project.id) {
        send(response, 400, { error: "Project id is required." });
        return;
      }
      await query`
        INSERT INTO portfolio_projects (id, data, updated_at)
        VALUES (${project.id}, ${JSON.stringify(project)}::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `;
      send(response, 200, { ok: true, project });
      return;
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
      const id = url.searchParams.get("id");
      if (!id) {
        send(response, 400, { error: "Project id is required." });
        return;
      }
      await query`DELETE FROM portfolio_projects WHERE id = ${id}`;
      send(response, 200, { ok: true });
      return;
    }

    send(response, 405, { error: "Method not allowed." });
  } catch (error) {
    send(response, 500, { error: error.message || "Server error." });
  }
};
