import React, { useEffect, useState, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  Activity,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Eye,
  FileCheck2,
  Filter,
  FlaskConical,
  GitFork,
  Layers3,
  Menu,
  Moon,
  Radar,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  WifiOff,
  X,
} from "lucide-react";
import type {
  Candidate,
  CandidateSignal,
  ProjectView,
  Publication,
} from "@vi/contracts";
import { freshness, globalHealth } from "@vi/domain";
import { getPublication } from "./services";
import { dateTime, labels } from "./text";
import deploymentAudit from "../../../config/deployment.json";
import {
  byRace,
  LadderBar,
  ProgressPanel,
  RaceDashboard,
  stepName,
  sum,
} from "./race";
import { ladder } from "@vi/progress";
import "./styles.css";
const api = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
function App() {
  const location = useLocation(),
    demo = new URLSearchParams(location.search).get("demo") === "1";
  const [publication, setPublication] = useState<Publication | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [mode, setMode] = useState("static"),
    [now, setNow] = useState(Date.now()),
    [refreshing, setRefreshing] = useState(false),
    [cooldown, setCooldown] = useState(0),
    [menu, setMenu] = useState(false),
    [offline, setOffline] = useState(!navigator.onLine),
    [theme, setTheme] = useState(
      () => localStorage.getItem("vi-theme") ?? "dark",
    );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("vi-theme", theme);
  }, [theme]);
  const refresh = useCallback(async () => {
    if (demo || !api) return;
    setRefreshing(true);
    try {
      const p = await getPublication(`${api}/api/v1/latest`);
      setPublication(p);
      setMode("normal");
      setError("");
    } catch {
      setMode("static");
      setError(
        "La API no está disponible. Conservamos la última publicación cargada con su fecha original.",
      );
    } finally {
      setRefreshing(false);
    }
  }, [demo]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setPublication(null);
    getPublication(
      demo ? "/demo/publication.json" : "/fallback/latest.json",
      demo,
    )
      .then((p) => {
        if (active) {
          setPublication(p);
          setMode(demo ? "demo" : "static");
        }
      })
      .catch(() => {
        if (active)
          setError(
            "No se ha podido cargar la copia local. Comprueba la conexión y vuelve a intentarlo.",
          );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
          if (!demo && api) void refresh();
        }
      });
    return () => {
      active = false;
    };
  }, [demo, refresh]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let delay = 120000;
    const poll = async () => {
      if (!document.hidden && navigator.onLine) {
        try {
          if (api && !demo) {
            const p = await getPublication(`${api}/api/v1/latest`);
            setPublication(p);
            setMode("normal");
            setError("");
            delay = 120000;
          }
        } catch {
          setMode("static");
          setError("API no disponible; se conserva la publicación anterior.");
          delay = Math.min(delay * 2, 960000);
        }
      }
      timer = setTimeout(() => void poll(), delay);
    };
    timer = setTimeout(() => void poll(), delay);
    return () => clearTimeout(timer);
  }, [demo]);
  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 15000),
      on = () => setOffline(false),
      off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      clearInterval(clock);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  useEffect(() => {
    setMenu(false);
    document.querySelector("main")?.focus();
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const suffix = demo ? "?demo=1" : "";
  const link = (path: string) => path + suffix;
  const health = publication
    ? globalHealth(publication.data.sources, now)
    : "unknown";
  return (
    <>
      <a href="#main" className="skip">
        Saltar al contenido
      </a>
      <header className="header">
        <div className="header-inner">
          <Link to={link("/")} aria-label="VI Race, inicio" className="brand">
            <span className="brand-mark">
              VI<span>R</span>
            </span>
            <span>
              VI RACE<small>COMMUNITY INTELLIGENCE</small>
            </span>
          </Link>
          <nav aria-label="Principal" className={menu ? "nav open" : "nav"}>
            {[
              ["/", "Carrera"],
              ["/projects", "Proyectos"],
              ["/radar", "Radar"],
              ["/methodology", "Método"],
              ["/sources", "Fuentes"],
              ["/status", "Estado"],
            ].map(([url, text]) => (
              <NavLink key={url} to={link(url)} end={url === "/"}>
                {text}
              </NavLink>
            ))}
          </nav>
          <div className="header-tools">
            <button
              className="icon-button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={
                theme === "dark" ? "Activar tema claro" : "Activar tema oscuro"
              }
            >
              {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="icon-button menu-button"
              onClick={() => setMenu(!menu)}
              aria-expanded={menu}
              aria-label="Abrir menú"
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      {demo && (
        <div className="demo-banner">
          <FlaskConical size={18} />
          <strong>Demostración con datos ficticios.</strong>
          <span>No representa proyectos ni avances reales.</span>
          <Link to={location.pathname}>Salir de la demo</Link>
        </div>
      )}
      <main id="main" tabIndex={-1} className="shell">
        <div className="utility">
          <span className={`health ${health}`}>
            <span className="status-dot" />
            {labels.health[health]}
            {mode === "static" ? " · Copia estática" : ""}
          </span>
          <span className="utility-date">
            Última comprobación:{" "}
            {dateTime(publication?.last_collection_success_at ?? null)}
          </span>
          <button
            className="text-button refresh"
            disabled={refreshing || now < cooldown || demo || !api}
            onClick={() => {
              setCooldown(Date.now() + 15000);
              void refresh();
            }}
            title={
              !api
                ? "API aún no configurada; estás consultando la copia estática"
                : "Solo consulta datos ya publicados"
            }
          >
            <RefreshCw size={15} className={refreshing ? "spin" : ""} />
            {refreshing ? "Comprobando…" : "Comprobar datos publicados"}
          </button>
        </div>
        {offline && (
          <div className="notice" role="status">
            <WifiOff size={18} />
            Sin conexión. Se conserva la información disponible y su fecha.
          </div>
        )}
        {error && (
          <div className="notice" role="status">
            {error}
            <button
              className="text-button"
              onClick={() => window.location.reload()}
            >
              Reintentar
            </button>
          </div>
        )}
        {publication?.warnings.map((w) => (
          <div key={w} className="notice subtle">
            {w}
          </div>
        ))}
        {loading ? (
          <div className="loading" role="status">
            <RefreshCw className="spin" />
            Cargando publicación…
          </div>
        ) : publication ? (
          <Routes>
            <Route
              path="/"
              element={<RaceDashboard p={publication} link={link} />}
            />
            <Route
              path="/projects"
              element={<Catalog p={publication} link={link} />}
            />
            <Route
              path="/projects/:slug"
              element={<ProjectDetail p={publication} link={link} />}
            />
            <Route path="/radar" element={<RadarPage p={publication} />} />
            <Route
              path="/methodology"
              element={<Methodology p={publication} />}
            />
            <Route
              path="/sources"
              element={<Sources p={publication} now={now} />}
            />
            <Route
              path="/status"
              element={<Status p={publication} now={now} mode={mode} />}
            />
            <Route
              path="*"
              element={
                <Empty
                  title="Esta página no existe"
                  detail="Vuelve al resumen para seguir explorando."
                  action={
                    <Link className="button" to={link("/")}>
                      Ir al resumen
                    </Link>
                  }
                />
              }
            />
          </Routes>
        ) : (
          <Empty
            title="No hay publicación disponible"
            detail="La copia estática no se ha podido cargar. El servicio no puede mostrar datos sin una publicación válida."
          />
        )}
        <footer>
          <div>
            <Link to={link("/")} className="footer-brand">
              VI RACE
            </Link>
            <p>
              Seguimiento comunitario independiente. Sin afiliación con Rockstar
              Games o Take-Two Interactive.
            </p>
          </div>
          <div>
            <Link to={link("/methodology")}>Transparencia y método</Link>
            <span>
              {publication?.publication_id ?? "Sin publicación"} · IA
              desactivada
            </span>
          </div>
        </footer>
      </main>
    </>
  );
}
type Props = { p: Publication; link: (path: string) => string };
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow">{children}</div>;
}
function PageTitle({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-title">
      <Eyebrow>{label}</Eyebrow>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Radar size={30} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function External({
  url,
  children,
}: {
  url: string | null;
  children: React.ReactNode;
}) {
  if (!url) return null;
  try {
    if (new URL(url).protocol !== "https:") return null;
  } catch {
    return null;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="external"
    >
      {children}
      <ExternalLink size={14} />
    </a>
  );
}
/** URL pública mostrada como texto, sin hipervínculo (política de enlaces). */
function Reference({ url, label }: { url: string | null; label: string }) {
  if (!url) return null;
  return (
    <small className="reference">
      {label}: <span className="hash">{url}</span>
    </small>
  );
}
/** Enlaza solo si el proyecto tiene autorización expresa; si no, texto. */
function ProjectLink({
  url,
  allowed,
  children,
}: {
  url: string | null;
  allowed: boolean;
  children: string;
}) {
  return allowed ? (
    <External url={url}>{children}</External>
  ) : (
    <Reference url={url} label={children} />
  );
}
const linkable = (p: Publication, projectId: string | null) =>
  !!projectId &&
  p.data.projects.some((x) => x.id === projectId && x.link_policy === "link");
function Tag({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
function Catalog({ p, link }: Props) {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "",
    type = params.get("type") ?? "",
    maint = params.get("maintenance") ?? "",
    adv = params.get("advanced") ?? "";
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  };
  const projects = p.data.projects.filter(
    (p) =>
      (!q ||
        `${p.name} ${p.description}`.toLowerCase().includes(q.toLowerCase())) &&
      (!type || p.project_type === type) &&
      (!maint || p.maintenance_status === maint) &&
      (!adv || p.progress.level > 0),
  )
  // Rutas completas primero; los componentes van detrás.
  .sort(
    (a, b) =>
      Number(a.project_type === "component") -
        Number(b.project_type === "component") || byRace(a, b),
  );
  return (
    <>
      <PageTitle
        label="CATÁLOGO"
        title="Cada proyecto, en contexto."
        description="Todos los proyectos seguidos, ordenados por el paso más alto que anuncian. Se actualiza solo cada 10 minutos."
      />
      <div className="filters">
        <label className="search-label">
          <Search size={18} />
          <span className="sr-only">Buscar proyectos</span>
          <input
            value={q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Buscar nombre o descripción…"
          />
        </label>
        <label>
          <span className="sr-only">Tipo de proyecto</span>
          <select value={type} onChange={(e) => set("type", e.target.value)}>
            <option value="">Todos los tipos</option>
            {Object.entries(labels.types)
              .filter(([k]) => k !== "candidate")
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Mantenimiento</span>
          <select
            value={maint}
            onChange={(e) => set("maintenance", e.target.value)}
          >
            <option value="">Todo el mantenimiento</option>
            {Object.entries(labels.maintenance).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={!!adv}
            onChange={(e) => set("advanced", e.target.checked ? "1" : "")}
          />
          Con avances
        </label>
      </div>
      <div className="result-count">
        <Filter size={15} />
        {projects.length} proyectos encontrados
      </div>
      {projects.length ? (
        <div className="project-cards">
          {projects.map((project) => (
            <Link
              className="project-card"
              to={{
                pathname: `/projects/${project.slug}`,
                search: params.toString(),
              }}
              key={project.id}
            >
              <div className="card-top">
                <span className="project-avatar">{project.name[0]}</span>
                <Tag>{labels.types[project.project_type]}</Tag>
              </div>
              <h2>{project.name}</h2>
              <p>{project.description}</p>
              <div className="card-progress">
                <div className="score-number">
                  <strong>P{project.progress.level}</strong>
                  <span>/ 8 · {stepName(project.progress.level)}</span>
                </div>
                <LadderBar project={project} compact />
              </div>
              <div className="card-bottom">
                <span>
                  ★{" "}
                  {project.stats
                    ? project.stats.stars.toLocaleString("es")
                    : "—"}
                </span>
                <span>{sum(project.activity_daily)} commits en 14 días</span>
              </div>
              <span className="card-link">
                Ver avances
                <ChevronRight size={16} />
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title={
            p.data.projects.length
              ? "No hay coincidencias"
              : "Aún no hay proyectos admitidos"
          }
          detail={
            p.data.projects.length
              ? "Prueba otros filtros o modifica tu búsqueda."
              : "Los candidatos se revisan antes de entrar al catálogo."
          }
          action={
            <Link className="button secondary" to={link("/radar")}>
              Consultar Radar
            </Link>
          }
        />
      )}
    </>
  );
}
function ProjectDetail({ p, link }: Props) {
  const { slug } = useParams(),
    [params] = useSearchParams(),
    project = p.data.projects.find((p) => p.slug === slug);
  if (!project)
    return (
      <Empty
        title="Proyecto no disponible"
        detail="Este proyecto no forma parte de la publicación actual."
        action={<Link to={link("/projects")}>Volver al catálogo</Link>}
      />
    );
  return (
    <>
      <Link
        className="breadcrumb"
        to={{ pathname: "/projects", search: params.toString() }}
      >
        Proyectos / {project.name}
      </Link>
      <div className="detail-heading">
        <div>
          <Eyebrow>{labels.types[project.project_type]}</Eyebrow>
          <h1>{project.name}</h1>
          <p>{project.description}</p>
          <ProjectLink
            url={project.official_url}
            allowed={project.link_policy === "link"}
          >
            Fuente oficial del proyecto
          </ProjectLink>
        </div>
        <div className="detail-score">
          <div className="score-number">
            <strong>P{project.progress.level}</strong>
            <span>/ 8 pasos</span>
          </div>
          <small>
            {project.rank === null
              ? "Componente: fuera de la carrera"
              : stepName(project.progress.level)}
          </small>
        </div>
      </div>
      <div className="detail-facts">
        <Tag>{labels.maintenance[project.maintenance_status]}</Tag>
        <span>
          {project.activity_7d} eventos en 7 días · {project.activity_30d} en 30
          días
        </span>
        <span>Comprobado: {dateTime(project.last_checked_at)}</span>
      </div>
      <ProgressPanel project={project} />
    </>
  );
}
const signalLabels: Record<CandidateSignal, string> = {
  repeated_name: "Mismo nombre de repositorio en varias cuentas",
  repeated_description: "Descripción idéntica en varias cuentas",
  profile_repository: "Repositorio de perfil de organización, sin código",
};
const statusLabels: Record<Candidate["status"], string> = {
  pending_review: "Pendiente de revisión",
  accepted: "Aceptado",
  rejected: "Rechazado",
  duplicate: "Duplicado",
  deferred: "Aplazado",
};
function CandidateCard({ c }: { c: Candidate }) {
  return (
    <article className="project-card">
      <Tag tone={c.signals?.length ? "muted" : "amber"}>
        {statusLabels[c.status]}
      </Tag>
      <h2>{c.name}</h2>
      <p>{c.description || "Sin descripción pública."}</p>
      {c.signals?.length ? (
        <ul className="signals">
          {c.signals.map((s) => (
            <li key={s}>{signalLabels[s]}</li>
          ))}
        </ul>
      ) : null}
      <p>{c.reason}</p>
      <small>
        Detectado: {dateTime(c.first_seen_at)} · Visto:{" "}
        {dateTime(c.last_seen_at)}
      </small>
      <Reference url={c.canonical_url} label="Repositorio" />
    </article>
  );
}
function RadarPage({ p }: { p: Publication }) {
  const pending = p.data.candidates.filter(
      (c) => c.status === "pending_review",
    ),
    clean = pending.filter((c) => !c.signals?.length),
    flagged = pending.filter((c) => c.signals?.length),
    reviewed = p.data.candidates.filter((c) => c.status !== "pending_review");
  return (
    <>
      <PageTitle
        label="PROJECT RADAR"
        title="Descubrir es solo el principio."
        description="Candidatos localizados en fuentes públicas. Permanecen fuera de la clasificación hasta que una persona revise su identidad y su alcance."
      />
      <div className="notice subtle">
        Última búsqueda satisfactoria:{" "}
        {dateTime(p.data.discovery_last_success_at)}. La cobertura es limitada;
        no se presupone exhaustividad. VI Race rastrea estos repositorios sin
        enlazarlos: muchos dependen de material filtrado o son reclamos. No
        descargues ni ejecutes nada de ellos.
      </div>
      {p.data.candidates.length ? (
        <>
          {clean.length ? (
            <div className="project-cards">
              {clean.map((c) => (
                <CandidateCard c={c} key={c.id} />
              ))}
            </div>
          ) : (
            <Empty
              title="Sin candidatos pendientes sin señales"
              detail="Los resultados nuevos aparecerán aquí tras la próxima búsqueda programada."
            />
          )}
          {flagged.length ? (
            <details className="radar-group">
              <summary>Posibles copias o reclamos ({flagged.length})</summary>
              <div className="project-cards">
                {flagged.map((c) => (
                  <CandidateCard c={c} key={c.id} />
                ))}
              </div>
            </details>
          ) : null}
          {reviewed.length ? (
            <details className="radar-group">
              <summary>Decisiones registradas ({reviewed.length})</summary>
              <div className="project-cards">
                {reviewed.map((c) => (
                  <CandidateCard c={c} key={c.id} />
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <Empty
          title="Radar todavía sin candidatos"
          detail="Las búsquedas programadas incorporarán resultados a esta bandeja. Un fallo de búsqueda conservará los candidatos anteriores."
        />
      )}
    </>
  );
}
function Methodology({ p }: { p: Publication }) {
  void p;
  return (
    <>
      <PageTitle
        label="MÉTODO · VI-AVANCE-V1"
        title="Todo automático, todo a la vista."
        description="Cómo sabe VI Race hasta dónde llega cada proyecto, sin revisiones manuales."
      />
      <div className="two-column">
        <section className="panel">
          <ShieldCheck className="accent" />
          <h2>Qué se lee</h2>
          <p>
            Cada 10 minutos se consulta la API pública de GitHub de cada
            proyecto: su README, sus versiones publicadas y sus commits en la
            rama principal. Cada proyecto se vuelve a leer cada 30 minutos.
          </p>
          <p>
            No se ejecuta nada de los proyectos, no se descarga el juego y no se
            enlaza a ningún material filtrado.
          </p>
        </section>
        <section className="panel">
          <h2>Cómo se detecta un avance</h2>
          <p>
            Reglas fijas buscan frases en las que el proyecto anuncia haber
            alcanzado un paso, como «boots to the title screen» o «first frame».
            Se descartan los planes, las hojas de ruta, las negaciones («not
            yet») y las menciones de otros juegos.
          </p>
          <p>
            En los emuladores generales solo cuenta lo que dicen sobre GTA VI.
            Sin IA y sin intervención humana.
          </p>
        </section>
      </div>
      <section className="panel">
        <h2>Los 8 pasos</h2>
        <p>
          El nivel de un proyecto es el paso más alto que anuncia. Lo que ya
          anunciaba al empezar el seguimiento es su punto de partida; lo que
          consigue después aparece como novedad.
        </p>
        <ol className="ladder-detail">
          {ladder.map((s) => (
            <li key={s.id}>
              <span className={`step-chip s${s.id.slice(1)}`}>{s.id}</span>
              <div>
                <strong>{s.name}</strong>
                <p className="muted">{s.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="panel">
        <h2>Límites</h2>
        <p>
          Un paso es lo que <strong>anuncian sus autores</strong>; nadie lo
          verifica de forma independiente. Lo que solo aparece en ramas o
          pull requests sin integrar no cuenta hasta que llega a la rama
          principal.
        </p>
        <p>
          No existe ninguna versión jugable para descargar. Cualquier descarga
          que diga ser GTA VI para PC es falsa y puede contener malware.
        </p>
      </section>
    </>
  );
}
function Sources({ p, now }: { p: Publication; now: number }) {
  return (
    <>
      <PageTitle
        label="PROCEDENCIA"
        title="Las fuentes, a la vista."
        description="Información pública obtenida con APIs autorizadas, consultas acotadas y fechas de comprobación explícitas."
      />
      {p.data.sources.length ? (
        <div className="project-cards">
          {p.data.sources.map((s) => (
            <article className="project-card" key={s.id}>
              <Tag>
                {
                  labels.freshness[
                    freshness(s.last_success_at, s.interval_minutes, now)
                  ]
                }
              </Tag>
              <h2>{s.repository}</h2>
              <p>{s.access_notes}</p>
              <small>
                Frecuencia prevista: {s.interval_minutes} minutos ·{" "}
                {s.priority === "primary" ? "Prioritaria" : "Secundaria"}
              </small>
              <p>
                Último intento: {dateTime(s.last_checked_at)}
                <br />
                Última comprobación válida: {dateTime(s.last_success_at)}
              </p>
              {s.last_error_code && (
                <p className="notice">
                  Incidencia: {s.last_error_code} · {s.failure_count} intentos
                  fallidos
                </p>
              )}
              <ProjectLink
                url={s.canonical_url}
                allowed={linkable(p, s.project_id)}
              >
                Fuente
              </ProjectLink>
              <External url={s.terms_url}>Condiciones de acceso</External>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="No hay fuentes de proyectos admitidas"
          detail="Las fuentes se registran junto con su permiso de uso, frecuencia y alcance. Las búsquedas de descubrimiento se muestran por separado en Radar."
        />
      )}
    </>
  );
}
function Status({
  p,
  now,
  mode,
}: {
  p: Publication;
  now: number;
  mode: string;
}) {
  const health = globalHealth(p.data.sources, now);
  return (
    <>
      <PageTitle
        label="ESTADO DEL SISTEMA"
        title="La frescura también se comprueba."
        description="Las fechas se recalculan en tu navegador. Una ejecución antigua no se presenta como seguimiento activo."
      />
      <div className="stats">
        <div className="stat">
          <span>Fuentes prioritarias</span>
          <strong className="status-value">{labels.health[health]}</strong>
          <small>Según su última comprobación válida</small>
        </div>
        <div className="stat">
          <span>Modo de lectura</span>
          <strong className="status-value">
            {mode === "demo"
              ? "Demostración"
              : mode === "static"
                ? "Respaldo estático"
                : "API pública"}
          </strong>
          <small>Sin consultas externas desde el visitante</small>
        </div>
        <div className="stat">
          <span>Analista automático</span>
          <strong className="status-value">Desactivado</strong>
          <small>Las reglas siguen operativas</small>
        </div>
      </div>
      <section className="panel">
        <h2>Publicación disponible</h2>
        <dl>
          <dt>Identificador</dt>
          <dd className="hash">{p.publication_id}</dd>
          <dt>Exportación generada</dt>
          <dd>{dateTime(p.generated_at)}</dd>
          <dt>Última recopilación válida</dt>
          <dd>{dateTime(p.last_collection_success_at)}</dd>
          <dt>Coste de la cuenta</dt>
          <dd>
            {deploymentAudit.account_free_verified &&
            deploymentAudit.no_overage_verified &&
            deploymentAudit.verified_at
              ? `Plan gratuito comprobado: ${dateTime(deploymentAudit.verified_at)}`
              : "Pendiente de verificación en infraestructura real"}
          </dd>
        </dl>
        <p>
          Fuentes actualizadas: menos de tres intervalos sin comprobar.
          Retrasadas: entre tres y seis. Sin actualizar: seis o más. Actions
          puede retrasar o desactivar ejecuciones; no hay garantía de tiempo
          real.
        </p>
      </section>
      <section className="panel">
        <h2>Últimas ejecuciones</h2>
        {p.data.runs.length ? (
          <div
            className="table-wrap"
            tabIndex={0}
            role="region"
            aria-label="Ejecuciones de seguimiento"
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Inicio</th>
                  <th scope="col">Resultado</th>
                  <th scope="col">Peticiones GitHub</th>
                  <th scope="col">Incidencia</th>
                </tr>
              </thead>
              <tbody>
                {p.data.runs.map((r) => (
                  <tr key={r.id}>
                    <td>{dateTime(r.started_at)}</td>
                    <td>{r.status}</td>
                    <td>{r.metrics.github_requests ?? "—"}</td>
                    <td>{r.error_summary ?? "Sin incidencias registradas"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            No hay ejecuciones reales registradas. Preparar los workflows no
            acredita monitorización en producción.
          </p>
        )}
      </section>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
