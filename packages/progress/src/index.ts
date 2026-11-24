/**
 * Escalera de avances vi-avance-v1: detección automática y determinista de lo
 * que cada proyecto anuncia públicamente (README, versiones y commits).
 * Es "avance anunciado", no verificación: el texto de terceros es dato no
 * fiable, nunca instrucción, y solo se compara con patrones fijos.
 */
export const LADDER_ID = "vi-avance-v1";
/**
 * Versión de las reglas de detección. Al subirla, cada README se vuelve a leer
 * una vez (sin ETag) y lo que se detecte entra como punto de partida.
 */
export const RULES_VERSION = 2;
export type StepId = "P1" | "P2" | "P3" | "P4" | "P5" | "P6" | "P7" | "P8";
export interface LadderStep {
  id: StepId;
  name: string;
  short: string;
  description: string;
}
export const ladder: LadderStep[] = [
  {
    id: "P1",
    name: "Carga el ejecutable",
    short: "Carga",
    description:
      "El proyecto abre y mapea el ejecutable de la versión de consola, resuelve importaciones o llega al punto de entrada.",
  },
  {
    id: "P2",
    name: "Ejecuta código del juego",
    short: "Arranque",
    description:
      "El código del juego empieza a ejecutarse: arranque, inicialización o hilos propios funcionando.",
  },
  {
    id: "P3",
    name: "Primeros gráficos",
    short: "Gráficos",
    description:
      "Aparece en pantalla algo dibujado por el propio juego: primer fotograma, superficies o shaders traducidos en uso.",
  },
  {
    id: "P4",
    name: "Logos e intro",
    short: "Intro",
    description:
      "Se muestran los logos iniciales, las pantallas legales o el vídeo de introducción.",
  },
  {
    id: "P5",
    name: "Pantalla de título o menú",
    short: "Menú",
    description: "Se alcanza la pantalla de título o el menú principal.",
  },
  {
    id: "P6",
    name: "Carga el mundo",
    short: "Mundo",
    description:
      "Se carga una partida, el mapa o una escena jugable: el juego pasa del menú al mundo.",
  },
  {
    id: "P7",
    name: "Control del personaje",
    short: "Control",
    description:
      "El jugador puede moverse, conducir o interactuar con teclado, ratón o mando.",
  },
  {
    id: "P8",
    name: "Jugable",
    short: "Jugable",
    description:
      "Se puede jugar de forma continuada: misiones, sesiones estables o rendimiento utilizable.",
  },
];
const patterns: Record<StepId, RegExp[]> = {
  P1: [
    /\b(pe|pe32\+?|xex|exe|executable|title executable|pe image|game binary)\b.{0,40}\b(load(s|ed|ing)?|mapp?(s|ed|ing)?|parse[sd]?|relocat\w*)\b/i,
    /\bimports?\b.{0,20}\b(resolved?|resolving|patched|bound)\b/i,
    /\b(reach(es|ed)?|hits?|calls?)\b.{0,20}\bentry ?point\b/i,
    /\bcarga (el )?ejecutable\b/i,
  ],
  P2: [
    /\b(boots(?!')|booted|booting (into|to|up|past|through))\b/i,
    /\b(game|guest|title) code\b.{0,20}\b(runs?|running|executes?|executing)\b/i,
    /\b(reach(es|ed)?|gets? (past|to)|got (past|to))\b.{0,30}\b(main|winmain|gamemain|game loop|main loop)\b/i,
    /\b(main|game) loop\b.{0,20}\b(runs?|running|reached|starts?)\b/i,
    /\barranca\b|\binicia el juego\b|\binicializa\w*\b/i,
  ],
  P3: [
    /\bfirst (frame|frames|pixels?|draw|draws|image|picture)\b/i,
    /\b(renders?|rendering|rendered|draws?|drawing|presents?|presenting)\b.{0,30}\b(frames?|screens?|swap ?chain|backbuffer)\b/i,
    /\bswap ?chain\b.{0,20}\b(works?|working|presents?|created)\b/i,
    /\bprimer (fotograma|frame)\b|\bprimeira imagem\b/i,
    /\b(shows?|showing|displays?|displaying|reach(es|ed)?|gets? to)\b.{0,25}\b(player|user|profile|account) (selection|select|picker|sign[- ]in) (prompt|screen|dialog)\b/i,
  ],
  P4: [
    /\b(shows?|showing|displays|displayed|plays?|played|playing|renders?|reach(es|ed)?|boots? (to|into)|gets? to|got to)\b.{0,50}\b(logos?|splash|intro|bink|legal screens?|disclaimer)\b/i,
    /\b(logos?|splash screens?|intro( video| movie| cinematic)?|bink videos?|legal screens?)\b.{0,30}\b(shows?|shown|displays|displayed|plays?|played|playing|renders?|rendered|appears?|visible|works?)\b/i,
    /\b(muestra|reproduce|llega a)\b.{0,40}\b(logos?|intro|introducci[oó]n)\b/i,
  ],
  P5: [
    /\b(title screen|main menu|start screen|front ?end menu|pause menu|press (start|any key|enter))\b/i,
    /\bmenus?\b.{0,20}\b(renders?|shows?|appears?|loads?|works?|runs?|running|visible|navigable)\b/i,
    /\b(runs?|shows?|reach(es|ed)?|renders?|navigates?)\b.{0,15}\b(its |the )?menus?\b/i,
    /\b(pantalla de t[ií]tulo|men[uú] principal|tela de t[ií]tulo|menu inicial)\b/i,
  ],
  P6: [
    /\b(load(s|ed|ing)? (the |a )?(world|map|savegame|save game|save|level)|in[- ]game\b(?![\/.]|\s+path)|story mode starts|new game starts|spawns? (the )?player|world (loads|streams|is visible))\b/i,
    /\b(carga (el )?mundo|carga la partida|dentro del juego|en el juego)\b/i,
  ],
  P7: [
    /\b(player|character|protagonist)\b.{0,30}\b(moves?|walks?|runs?|controllable|control(s|led)?)\b/i,
    /\b(walk(s|ing)? around|driv(e|es|ing) (a |the )?(car|vehicle)|controller input works|keyboard (and|&) mouse (input )?(works?|working))\b/i,
    /\b(controlar al personaje|el personaje se mueve|conducir)\b/i,
  ],
  P8: [
    /\b(fully playable|is playable|now playable|playable from start|beat(s|en)? the first mission|complete[sd]? (a |the first )?missions?|stable (fps|frame ?rate)|\d{2,3} ?fps (in[- ]game|during gameplay|gameplay))\b/i,
    /\b(jugable|jog[aá]vel)\b/i,
  ],
};
/** Frases que niegan, aplazan o condicionan: no cuentan como avance. */
const negation =
  /\b(not|no|never|doesn'?t|does not|didn'?t|isn'?t|aren'?t|can'?t|cannot|won'?t|unable|yet to|until|todo|to-?do|planned|plan|plans|goal|goals|roadmap|aim|aims|target|targets|will|would|should|could|might|hope|hoping|eventually|future|next step|blocked|blocker|fails?|failed|failing|stuck|competitor\w*|other (public )?(attempts?|projects?)|upstream|wiki|on the way to|towards?|stopped|needs?|requires?|stops|wip|attempt(ing)? to|trying to|tries to|yet|nothing|none|unsupported|without(?! (a |any )?(crash|crashes|crashing|errors?|issues?|problems?|stutterw*))|if|once|when|as soon as|can start|can begin|ready for|needed|wanted|help|contribut\w*|valuable|black (frame|screen)|todav[ií]a no|a[uú]n no|sin |pendiente|objetivo|planeado|n[aã]o|ainda)\b|\[ \]|☐|❌|⬜|→|->/i;
/** Frases sobre otros juegos o pruebas sintéticas: no son avances de GTA VI. */
const otherTitle =
  /\b(minecraft|terraria|fortnite|gears( of war)?|halo|forza|starfield|matrix awakens|unreal engine|call of duty|hello world|sample app|test app|synthetic|homebrew|titles|triangle|png|svg|jpe?g|icon|banner|badge|favicon|dpi)\b/i;
/** Mención explícita de GTA VI, para proyectos que prueban varios juegos. */
const gtaContext =
  /\b(gta ?(vi|6)|grand theft auto|gta|leonida|vice city|game_scarlett_master)\b/i;
/** Encabezados cuyo contenido describe planes, no estado actual. */
const planHeading =
  /\b(roadmap|goals?|todo|to-?do|planned|plans?|future|next steps?|wishlist|objetivos|pendiente|hoja de ruta|planes|limitations?|known issues|blockers?)\b/i;
/** En mensajes de commit exigimos un verbo de logro, no solo una mención. */
const reachVerb =
  /\b(reach(es|ed)?|now|boots? (to|into|past|up)|gets? (to|past)|got (to|past)|shows?|showing|displays?|renders?|rendering|works?|working|achieved|first|visible|plays?|playing|loads?|loaded|arranca|llega|muestra|funciona)\b/i;
export type ProgressSourceType = "readme" | "release" | "commit";
export interface ProgressSignal {
  step: StepId;
  source_type: ProgressSourceType;
  excerpt: string;
  ref: string | null;
  detected_at: string;
  /** Ya figuraba en la primera lectura del proyecto: punto de partida, no novedad. */
  baseline?: boolean;
}
export interface ProgressText {
  source_type: ProgressSourceType;
  text: string;
  ref: string | null;
  at: string;
}
const clean = (line: string) =>
  line
    .replace(/<[^>]{0,200}>/g, " ")
    .replace(/!\[[^\]]{0,200}\]\([^)]{0,500}\)/g, " ")
    .replace(/\[([^\]]{0,200})\]\([^)]{0,500}\)/g, "$1")
    .replace(/[*`#>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
/**
 * Devuelve las líneas relevantes de un texto largo (README) descartando
 * secciones de planes. Se usa también para no almacenar el README entero.
 */
export function relevantLines(
  markdown: string,
  max = 40,
  requireGta = false,
  aliases: RegExp | null = null,
): string[] {
  const inContext = (t: string) =>
    gtaContext.test(t) || (aliases !== null && aliases.test(t));
  const out: string[] = [];
  let skip = false;
  let gtaHeading = false;
  let inCode = false;
  let lastLine = "";
  for (const raw of markdown.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(raw)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const heading = raw.match(/^\s{0,3}#{1,6}\s+(.*)$/);
    if (/^\s*\|?\s*:?-{3,}/.test(raw)) {
      if (out.length && out.at(-1) === lastLine) out.pop();
      continue;
    }
    if (heading) {
      skip = planHeading.test(heading[1]);
      gtaHeading = inContext(heading[1]);
      continue;
    }
    if (skip) continue;
    const line = clean(raw);
    lastLine = line.slice(0, 300);
    if (line.length < 6 || line.length > 600) continue;
    if (requireGta && !gtaHeading && !inContext(line)) continue;
    if (Object.values(patterns).some((ps) => ps.some((p) => p.test(line))))
      out.push(line.slice(0, 300));
    if (out.length >= max) break;
  }
  return out;
}
/** Divide en frases para que una negación no anule otra frase de la misma línea. */
const clauses = (line: string) =>
  line.split(/(?<=[.!?;)])\s+|\s+[–—-]\s+|,\s+(?:but|pero|mas)\s+/i);
/**
 * multiTitle: el proyecto prueba varios juegos (capa de compatibilidad general);
 * entonces solo cuentan frases que mencionan GTA VI o están bajo su sección.
 */
export interface DetectOptions {
  /** El proyecto prueba varios juegos: exigir contexto de GTA VI. */
  multiTitle?: boolean;
  /** Formas en que el proyecto nombra GTA VI sin decirlo (p. ej. "a newer retail game"). */
  aliases?: string[];
}
const aliasPattern = (aliases: string[] | undefined) =>
  aliases?.length
    ? new RegExp(
        aliases.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
        "i",
      )
    : null;
export function detect(
  input: ProgressText,
  options: DetectOptions = {},
): ProgressSignal[] {
  const multiTitle = options.multiTitle ?? false,
    aliases = aliasPattern(options.aliases);
  const lines =
    input.source_type === "readme"
      ? relevantLines(input.text, 40, multiTitle, aliases)
      : input.text
          .split(/\r?\n/)
          .map(clean)
          .filter((l) => l.length >= 6)
          .filter(
            (l) =>
              !multiTitle ||
              gtaContext.test(l) ||
              (aliases !== null && aliases.test(l)),
          )
          .slice(0, 60);
  const found = new Map<StepId, ProgressSignal>();
  for (const line of lines)
    for (const clause of clauses(line)) {
      const checked = /\[x\]|✅|✔|☑/i.test(clause);
      if (!checked && negation.test(clause)) continue;
      if (otherTitle.test(clause)) continue;
      if (input.source_type === "commit" && !reachVerb.test(clause)) continue;
      for (const step of ladder)
        if (
          !found.has(step.id) &&
          patterns[step.id].some((p) => p.test(clause))
        )
          found.set(step.id, {
            step: step.id,
            source_type: input.source_type,
            excerpt: clause.slice(0, 240),
            ref: input.ref,
            detected_at: input.at,
          });
    }
  return [...found.values()];
}
export interface ProgressState {
  ladder: typeof LADDER_ID;
  steps: Partial<Record<StepId, ProgressSignal>>;
  updated_at: string | null;
  /** Primera vez que se leyó el proyecto: separa punto de partida de novedades. */
  first_read_at?: string | null;
  /** Versión de reglas con la que se leyó el README por última vez. */
  rules?: number;
}
export const emptyProgress = (): ProgressState => ({
  ladder: LADDER_ID,
  steps: {},
  updated_at: null,
});
/** Conserva la detección más antigua de cada paso: el estado es acumulativo. */
export function mergeProgress(
  state: ProgressState,
  signals: ProgressSignal[],
  now: string,
): { state: ProgressState; changed: boolean } {
  const steps = { ...state.steps };
  let changed = false;
  for (const s of signals) {
    const old = steps[s.step];
    if (!old || s.detected_at < old.detected_at) {
      steps[s.step] = s;
      changed = true;
    }
  }
  return {
    state: {
      ladder: LADDER_ID,
      steps,
      updated_at: changed ? now : state.updated_at,
    },
    changed,
  };
}
/** Nivel = paso más alto anunciado (0 si ninguno). */
export function level(state: ProgressState): number {
  let max = 0;
  for (const [i, step] of ladder.entries())
    if (state.steps[step.id]) max = i + 1;
  return max;
}
/**
 * Vuelve a comprobar cada paso guardado con las reglas vigentes. Si una regla
 * se corrige, los falsos positivos ya almacenados desaparecen solos.
 * El contexto de GTA VI ya se exigió al detectar, así que aquí no se repite.
 */
export function revalidate(state: ProgressState): ProgressState {
  const steps: ProgressState["steps"] = {};
  for (const [id, signal] of Object.entries(state.steps) as [
    StepId,
    ProgressSignal,
  ][]) {
    const again = detect({
      source_type:
        signal.source_type === "readme" ? "release" : signal.source_type,
      text: signal.excerpt,
      ref: signal.ref,
      at: signal.detected_at,
    });
    if (again.some((s) => s.step === id)) steps[id] = signal;
  }
  return { ...state, steps };
}
