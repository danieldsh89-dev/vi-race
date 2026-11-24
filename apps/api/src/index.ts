export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url),
      origin = request.headers.get("Origin");
    const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      Vary: "Origin",
      "Cache-Control": "no-store",
    });
    if (origin && allowed.includes(origin))
      headers.set("Access-Control-Allow-Origin", origin);
    const error = (status: number, code: string, message: string) =>
      new Response(JSON.stringify({ error: { code, message } }), {
        status,
        headers,
      });
    if (origin && !allowed.includes(origin))
      return error(403, "origin_not_allowed", "Origen no permitido");
    if (request.method === "OPTIONS") {
      headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "If-None-Match");
      headers.set("Access-Control-Max-Age", "600");
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "GET") {
      headers.set("Allow", "GET, OPTIONS");
      return error(405, "method_not_allowed", "Método no admitido");
    }
    if (url.search)
      return error(400, "invalid_parameters", "Esta ruta no admite parámetros");
    let publicationId: string | null = null,
      key: string,
      immutable = false;
    if (url.pathname === "/api/v1/latest") key = "latest";
    else if (url.pathname === "/api/v1/status") key = "status";
    else {
      const match = url.pathname.match(
        /^\/api\/v1\/publications\/(pub_[a-zA-Z0-9_-]{1,100})\/(projects(?:\/[a-zA-Z0-9_-]{1,100}(?:\/history\/(?:0|[1-9][0-9]{0,3}))?)?|radar|methodology)$/,
      );
      if (!match)
        return error(
          url.pathname.includes("..") || url.pathname.length > 300 ? 400 : 404,
          "resource_not_found",
          "Recurso no disponible",
        );
      publicationId = match[1];
      key = match[2];
      immutable = true;
    }
    try {
      let row: { body_json: string; body_hash: string } | null;
      if (publicationId) {
        row = await env.DB.prepare(
          "SELECT b.body_json,b.body_hash FROM publication_blobs b JOIN publications p ON p.id=b.publication_id WHERE b.publication_id=? AND b.resource_key=? AND p.status='complete'",
        )
          .bind(publicationId, key)
          .first();
      } else {
        row = await env.DB.prepare(
          "SELECT b.body_json,b.body_hash FROM publication_pointer ptr JOIN publications p ON p.id=ptr.publication_id JOIN publication_blobs b ON b.publication_id=p.id WHERE ptr.name='current' AND b.resource_key=? AND p.status='complete'",
        )
          .bind(key)
          .first();
      }
      if (!row)
        return error(
          publicationId ? 404 : 503,
          publicationId ? "publication_not_found" : "not_initialized",
          publicationId
            ? "Publicación no disponible"
            : "Todavía no hay publicación válida",
        );
      if (new TextEncoder().encode(row.body_json).length > 256000)
        return error(503, "invalid_publication", "Publicación no disponible");
      const etag = `"${row.body_hash}"`;
      headers.set("ETag", etag);
      headers.set("Access-Control-Expose-Headers", "ETag");
      headers.set(
        "Cache-Control",
        immutable
          ? "public, max-age=86400, immutable"
          : "public, max-age=120, stale-if-error=86400",
      );
      if (
        request.headers
          .get("If-None-Match")
          ?.split(",")
          .some(
            (value) =>
              value.trim() === "*" || value.trim().replace(/^W\//, "") === etag,
          )
      )
        return new Response(null, { status: 304, headers });
      return new Response(row.body_json, { headers });
    } catch {
      return error(
        503,
        "storage_unavailable",
        "Almacenamiento no disponible; consulta el respaldo estático",
      );
    }
  },
} satisfies ExportedHandler<Env>;
