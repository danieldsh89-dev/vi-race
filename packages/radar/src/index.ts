import type {
  Candidate,
  CandidateReview,
  CandidateSignal,
} from "@vi/contracts";
/** Un mismo nombre o descripción publicado por al menos este número de cuentas. */
export const REPEAT_THRESHOLD = 3;
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
/**
 * Señales deterministas de duplicación (documento maestro: filtrado determinista).
 * Solo orientan la revisión: no rechazan, no admiten y no cambian el estado.
 */
export function duplicationSignals(candidates: Candidate[]): Candidate[] {
  const repoName = (c: Candidate) =>
    normalize(c.name.split("/")[1] ?? c.name).replace(/-\d{4}$/, "");
  const owners = (key: (c: Candidate) => string) => {
    const map = new Map<string, Set<string>>();
    for (const c of candidates) {
      const k = key(c);
      if (!k) continue;
      const owner = normalize(c.name.split("/")[0] ?? "");
      map.set(k, (map.get(k) ?? new Set()).add(owner));
    }
    return map;
  };
  const byName = owners(repoName),
    byDescription = owners((c) => normalize(c.description));
  return candidates.map((c) => {
    const signals: CandidateSignal[] = [];
    if ((byName.get(repoName(c))?.size ?? 0) >= REPEAT_THRESHOLD)
      signals.push("repeated_name");
    const d = normalize(c.description);
    if (d && (byDescription.get(d)?.size ?? 0) >= REPEAT_THRESHOLD)
      signals.push("repeated_description");
    if (/\/\.github$/i.test(c.name)) signals.push("profile_repository");
    const { signals: _old, ...rest } = c;
    return signals.length ? { ...rest, signals } : rest;
  });
}
export function mergeCandidates(
  existing: Candidate[],
  incoming: Candidate[],
): Candidate[] {
  const result = new Map(existing.map((c) => [c.provider_repo_id, c]));
  for (const c of incoming) {
    const old = result.get(c.provider_repo_id);
    result.set(
      c.provider_repo_id,
      old
        ? {
            ...old,
            canonical_url: c.canonical_url,
            name: c.name,
            description: c.description,
            last_seen_at: c.last_seen_at,
            repo: c.repo ?? old.repo,
          }
        : c,
    );
  }
  return [...result.values()].sort(
    (a, b) =>
      b.first_seen_at.localeCompare(a.first_seen_at) ||
      a.id.localeCompare(b.id),
  );
}
/** Reclamos típicos de instaladores falsos y descargas: nunca son una ruta técnica. */
const LURE =
  /\b(installer|install(ation)? (package|guide)|download|free|launcher|beta (edition|for)|leaked (gameplay )?build|fully playable|preload|no bios|dlss ?5|ps5 emulator|setup guide|crack|torrent|apk|repack|mod menu|trainer|cheats?|giveaway|exe released)\b/i;
/** Términos de trabajo técnico real sobre la versión de consola. */
const TECHNICAL =
  /\b(xbox|scarlett|series ?x|gdk|recomp\w*|compatib\w*|runtime|emulat\w*|loader|translation layer|shader|d3d12|rdna ?2|hle|port(ing)?|decomp\w*|reverse[- ]engineer\w*|disassembl\w*|xex|xvd|vulkan)\b/i;
const GTA = /\b(gta ?(vi|6)?|grand theft auto|leonida|vice city)\b/i;
/** Contenido de fans: mapas, noticias, rastreadores, fondos... no son rutas a PC. */
const FAN =
  /\b(map|mapa|news|noticias|tracker|countdown|wallpapers?|trailers?|leaks?|rumou?rs?|fan[- ]?(site|made|art|page)|wiki|clips?|screenshots?|concept|discord bot|theme|radio|soundtrack|tribute|landing page|website|portfolio|quiz|predictions?|hub|awesome[- ]list|link list)\b/i;
/** Rastreadores, archivos y guías que recopilan otros proyectos. */
const AGGREGATOR =
  /\b(tracker|port[- ]?watch|archive|handbook|does gta vi run on pc|live status|coordination hub|curated list|awesome)\b/i;
/** Temas ajenos a ejecutar la build de consola en PC. */
const OFFTOPIC =
  /\b(remote play|mouse|keyboard|controller|controle|subtit\w*|legendas?|felirat|troubleshoot\w*|performance checker|sales|hype|speedrun|any%|ps5|playstation|multiplayer|roleplay|sa:mp|fivem|wasm)\b|ซับ/i;
/** Promesas de jugar en PC sin código detrás. */
const PROMISE = /\b(pc|emulator|play|windows|android|mobile|ios)\b/i;
const CODE_LANGUAGES = new Set([
  "Rust",
  "C++",
  "C",
  "C#",
  "Python",
  "Go",
  "Zig",
  "Assembly",
  "HLSL",
  "Kotlin",
  "Swift",
  "Java",
  "TypeScript",
]);
/** Umbrales del seguimiento automático: orientativos, públicos y deterministas. */
export const AUTO_TRACK = { min_stars: 25, min_size_kb: 300 } as const;
export type CandidateDecision = "reject" | "track" | "pending";
export interface Classification {
  decision: CandidateDecision;
  reason: string;
}
/**
 * Clasificación automática de candidatos pendientes. Rechaza copias, reclamos,
 * repositorios vacíos y contenido de fans; admite al seguimiento proyectos
 * técnicos con señales mínimas de comunidad y deja el resto pendiente con un
 * motivo legible. Las decisiones previas no se tocan.
 */
export function classify(c: Candidate): Classification {
  const text = `${c.name} ${c.description}`;
  const technical = TECHNICAL.test(c.description) || /recomp|decomp|runtime/i.test(c.name);
  if (c.signals?.length)
    return {
      decision: "reject",
      reason:
        "Rechazo automático: copia repetida en varias cuentas o perfil sin código propio.",
    };
  if (LURE.test(text))
    return {
      decision: "reject",
      reason:
        "Rechazo automático: anuncia descargas, instaladores o trucos; patrón típico de malware.",
    };
  const r = c.repo;
  if (!r)
    return {
      decision: "pending",
      reason: "En observación: faltan datos del repositorio.",
    };
  if (r.size_kb < 5 || (!r.language && r.size_kb < 20))
    return {
      decision: "reject",
      reason: "Rechazo automático: repositorio prácticamente vacío.",
    };
  if (AGGREGATOR.test(text))
    return {
      decision: "reject",
      reason:
        "Fuera de alcance: rastreador, archivo o lista que recopila otros proyectos; VI Race sigue las fuentes originales.",
    };
  if (OFFTOPIC.test(text))
    return {
      decision: "reject",
      reason:
        "Fuera de alcance: no intenta ejecutar la build de consola en PC (otra plataforma, mando, subtítulos, multijugador...).",
    };
  if (FAN.test(text) && !technical)
    return {
      decision: "reject",
      reason:
        "Fuera de alcance: contenido de fans (mapas, noticias, rastreadores), no una ruta a PC.",
    };
  const noCode = !r.language || r.language === "HTML" || r.language === "CSS";
  if (noCode && PROMISE.test(c.name) && !technical)
    return {
      decision: "reject",
      reason:
        "Rechazo automático: promete el juego en PC sin código ni trabajo técnico visible.",
    };
  if (noCode)
    return {
      decision: "pending",
      reason:
        "En observación: documentación o investigación sin código; se sigue si publica código.",
    };
  if (
    !r.fork &&
    CODE_LANGUAGES.has(r.language!) &&
    r.stars >= AUTO_TRACK.min_stars &&
    r.size_kb >= AUTO_TRACK.min_size_kb &&
    technical &&
    (GTA.test(text) || /\bxbox series|scarlett\b/i.test(text))
  )
    return {
      decision: "track",
      reason:
        "Seguimiento automático: proyecto técnico con código y comunidad mínima. Sus avances se detectan como el resto.",
    };
  return {
    decision: "pending",
    reason: r.fork
      ? "En observación: bifurcación de otro proyecto."
      : r.stars < AUTO_TRACK.min_stars
        ? `En observación: menos de ${AUTO_TRACK.min_stars} estrellas.`
        : "En observación: sin señales técnicas claras sobre la versión de consola.",
  };
}
export const classifyCandidate = (c: Candidate): CandidateDecision =>
  classify(c).decision;
export const autoProjectId = (c: Candidate) =>
  `project_auto_${c.provider_repo_id}`;
export function applyClassification(
  candidates: Candidate[],
  tracked: Map<string, string>,
): Candidate[] {
  return duplicationSignals(candidates).map((c) => {
    const linked = tracked.get(c.provider_repo_id);
    if (c.status !== "pending_review" && !(linked && c.status !== "accepted"))
      return c;
    if (linked)
      return {
        ...c,
        status: "accepted",
        reason: "Ya incluido en el seguimiento de VI Race.",
        linked_project_id: linked,
      };
    const { decision, reason } = classify(c);
    if (decision === "reject") return { ...c, status: "rejected", reason };
    if (decision === "track")
      return {
        ...c,
        status: "accepted",
        reason,
        linked_project_id: autoProjectId(c),
      };
    return { ...c, reason };
  });
}
export function applyCandidateReview(
  candidate: Candidate,
  review: CandidateReview,
  authorized: string[],
): Candidate {
  if (
    review.candidate_id !== candidate.id ||
    !authorized.includes(review.reviewer)
  )
    throw new Error("Revisión de candidato no autorizada");
  if (
    ["accepted", "duplicate"].includes(review.status) &&
    !review.linked_project_id
  )
    throw new Error("Falta identidad de destino");
  return {
    ...candidate,
    status: review.status,
    reason: review.reason,
    linked_project_id: review.linked_project_id,
    review_commit: review.review_commit,
  };
}
