const { db, ensureTables, readBody, send } = require("./_db");

module.exports = async function handler(request, response) {
  try {
    await ensureTables();
    const query = db();

    if (request.method === "GET") {
      const rows = await query`
        SELECT data
        FROM portfolio_reviews
        ORDER BY updated_at DESC
      `;
      send(response, 200, { reviews: rows.map((row) => row.data) });
      return;
    }

    if (request.method === "POST" || request.method === "PUT") {
      const body = await readBody(request);
      const review = body.review || body;
      if (!review || !review.id) {
        send(response, 400, { error: "Review id is required." });
        return;
      }
      await query`
        INSERT INTO portfolio_reviews (id, data, updated_at)
        VALUES (${review.id}, ${JSON.stringify(review)}::jsonb, NOW())
        ON CONFLICT (id)
        DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `;
      send(response, 200, { ok: true, review });
      return;
    }

    if (request.method === "DELETE") {
      const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
      const id = url.searchParams.get("id");
      if (!id) {
        send(response, 400, { error: "Review id is required." });
        return;
      }
      await query`DELETE FROM portfolio_reviews WHERE id = ${id}`;
      send(response, 200, { ok: true });
      return;
    }

    send(response, 405, { error: "Method not allowed." });
  } catch (error) {
    send(response, 500, { error: error.message || "Server error." });
  }
};
