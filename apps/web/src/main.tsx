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
              ["/", "Resumen"],
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
              element={<Dashboard p={publication} link={link} />}
            />
            <Route
              path="/projects"
              element={<Catalog p={publication} link={link} />}
            />
            <Route
              path="/projects/:slug"
              element={<ProjectDetail p={publication} link={link} />}
            />
            <Route
              path="/compare"
              element={<Compare p={publication} link={link} />}
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
function Tag({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
function ScoreNumber({ project }: { project: ProjectView }) {
  return (
    <div className="score-number">
      <strong>{project.score.score}</strong>
      <span>/ 100 puntos</span>
    </div>
  );
}
function ProjectTable({
  projects,
  link,
}: {
  projects: ProjectView[];
  link: Props["link"];
}) {
  return (
    <div
      className="table-wrap"
      tabIndex={0}
      role="region"
      aria-label="Clasificación de proyectos"
    >
      <table>
        <thead>
          <tr>
            <th scope="col">Posición / Proyecto</th>
            <th scope="col">Capacidad confirmada</th>
            <th scope="col">Hitos</th>
            <th scope="col">Evidencias</th>
            <th scope="col">Último avance</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id}>
              <th scope="row">
                <Link to={link(`/projects/${p.slug}`)} className="project-name">
                  <span className="rank">
                    {p.rank === null ? "—" : String(p.rank).padStart(2, "0")}
                  </span>
                  <span className="project-avatar">{p.name.slice(0, 1)}</span>
                  <span>
                    {p.name}
                    <small>{labels.types[p.project_type]}</small>
                  </span>
                </Link>
              </th>
              <td>
                {p.rank === null ? (
                  <span className="muted">Fuera de clasificación</span>
                ) : (
                  <ScoreNumber project={p} />
                )}
              </td>
              <td>{p.score.confirmed_count} de 20</td>
              <td>
                <span className="icon-text">
                  <FileCheck2 size={16} />
                  {p.evidence.length} consultables
                </span>
              </td>
              <td className="muted">{dateTime(p.last_confirmed_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function Dashboard({ p, link }: Props) {
  const eligible = p.data.projects.filter((p) => p.rank !== null),
    confirmed = p.data.projects.reduce(
      (s, p) => s + p.score.confirmed_count,
      0,
    ),
    pending = p.data.candidates.filter(
      (c) => c.status === "pending_review" && !c.signals?.length,
    ).length;
  return (
    <>
      <section className="hero">
        <div>
          <Eyebrow>
            <span className="eyebrow-line" /> GTA VI EN PC · OBSERVATORIO
            COMUNITARIO
          </Eyebrow>
          <h1>
            El avance
            <br />
            se <em>demuestra.</em>
          </h1>
          <p>
            Qué proyectos existen, qué han conseguido y qué pruebas lo
            respaldan. Una carrera de evidencias, con todo a la vista.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to={link("/projects")}>
              Explorar proyectos
            </Link>
            <Link className="button secondary" to={link("/methodology")}>
              <ShieldCheck size={17} />
              Cómo evaluamos
            </Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="orbit orbit-three" />
          <div className="visual-grid" />
          <span className="visual-label top">EVIDENCIA VERIFICABLE</span>
          <div className="visual-monogram">
            VI<span>RACE</span>
          </div>
          <div className="visual-label bottom">
            <span className="small-square" /> OBSERVAR · CONTRASTAR · EXPLICAR
          </div>
        </div>
      </section>
      <section className="stats" aria-label="Resumen de seguimiento">
        {[
          [
            Layers3,
            "Proyectos admitidos",
            p.data.projects.length,
            "Identidad y alcance revisados",
          ],
          [
            CheckCircle2,
            "Hitos confirmados",
            confirmed,
            "Respaldados por revisión humana",
          ],
          [Radar, "Candidatos en Radar", pending, "Pendientes de comprobar"],
        ].map(([Icon, title, value, caption]) => {
          const Symbol = Icon as typeof Layers3;
          return (
            <div className="stat" key={String(title)}>
              <div className="stat-top">
                <span>{String(title)}</span>
                <Symbol size={20} />
              </div>
              <strong>{String(value).padStart(2, "0")}</strong>
              <small>{String(caption)}</small>
            </div>
          );
        })}
      </section>
      <section className="panel">
        <div className="section-head">
          <div>
            <Eyebrow>LA CARRERA</Eyebrow>
            <h2>Capacidad técnica confirmada</h2>
          </div>
          <Link to={link("/compare")} className="text-button">
            Comparar proyectos
          </Link>
        </div>
        <p className="section-description">
          Puntos sobre 100 según la rúbrica vi-pc-v1. No indican cuánto falta
          para jugar ni una fecha de lanzamiento.
        </p>
        {eligible.length ? (
          <ProjectTable projects={eligible} link={link} />
        ) : (
          <Empty
            title="La carrera empieza con pruebas"
            detail="Todavía no hay rutas completas admitidas. Publicaremos proyectos cuando su identidad y alcance estén revisados; los puntos llegarán con evidencias."
            action={
              <Link className="button secondary" to="/?demo=1">
                <Eye size={17} />
                Explorar una demostración ficticia
              </Link>
            }
          />
        )}
        <div className="panel-foot">
          <ShieldCheck size={16} />
          Las estrellas y los commits no suman puntos. Cada confirmación
          necesita pruebas y una revisión registrada.
        </div>
      </section>
      <div className="two-column">
        <section className="panel">
          <div className="section-head">
            <div>
              <Eyebrow>SEÑALES RECIENTES</Eyebrow>
              <h2>Qué ha cambiado</h2>
            </div>
            <Activity size={22} />
          </div>
          {p.data.events.length ? (
            p.data.events.slice(0, 5).map((e) => (
              <article className="event" key={e.id}>
                <Tag>{e.event_type}</Tag>
                <p>
                  {String(
                    e.payload.message ??
                      e.payload.name ??
                      "Actividad observada",
                  )}
                </p>
                <small>
                  Detectado: {dateTime(e.observed_at)} · Publicado:{" "}
                  {dateTime(e.source_published_at)}
                </small>
                <p className="muted">
                  Actividad observada. No demuestra por sí sola una capacidad.
                </p>
                <External
                  url={typeof e.payload.url === "string" ? e.payload.url : null}
                >
                  Ver fuente
                </External>
              </article>
            ))
          ) : (
            <div className="quiet-empty">
              <Clock3 size={26} />
              <h3>Sin novedades registradas</h3>
              <p>Los cambios aparecerán aquí con su fuente, fecha y alcance.</p>
            </div>
          )}
        </section>
        <section className="panel principles">
          <Eyebrow>NUESTRO CRITERIO</Eyebrow>
          <h2>
            Menos ruido.
            <br />
            Más contexto.
          </h2>
          {[
            [
              Search,
              "Descubrir",
              "Localizamos candidatos sin dar por válidas sus afirmaciones.",
            ],
            [
              FileCheck2,
              "Contrastar",
              "Separamos una declaración de una prueba reproducible.",
            ],
            [
              ShieldCheck,
              "Explicar",
              "Cada punto tiene un motivo, una versión y una fuente.",
            ],
          ].map(([Icon, title, body]) => {
            const Symbol = Icon as typeof Search;
            return (
              <div className="principle" key={String(title)}>
                <Symbol size={20} />
                <div>
                  <h3>{String(title)}</h3>
                  <p>{String(body)}</p>
                </div>
              </div>
            );
          })}
          <Link to={link("/methodology")} className="external">
            Leer la metodología
            <ChevronRight size={16} />
          </Link>
        </section>
      </div>
    </>
  );
}
function Catalog({ p, link }: Props) {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "",
    type = params.get("type") ?? "",
    maint = params.get("maintenance") ?? "",
    ev = params.get("evidence") ?? "";
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
      (!ev || p.evidence.length > 0),
  );
  return (
    <>
      <PageTitle
        label="CATÁLOGO"
        title="Cada proyecto, en contexto."
        description="Explora iniciativas admitidas. Su actividad, su alcance y su capacidad se muestran por separado."
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
            checked={!!ev}
            onChange={(e) => set("evidence", e.target.checked ? "1" : "")}
          />
          Con evidencias
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
              <div className="card-bottom">
                {project.rank === null ? (
                  <span>Fuera de clasificación</span>
                ) : (
                  <ScoreNumber project={project} />
                )}
                <span>{project.score.confirmed_count} hitos confirmados</span>
              </div>
              <span className="card-link">
                Consultar pruebas
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
          <External url={project.official_url}>
            Fuente oficial del proyecto
          </External>
        </div>
        <div className="detail-score">
          {project.rank === null ? (
            <>
              <Tag>Componente: fuera de la carrera</Tag>
              <p>No se normaliza a 100.</p>
            </>
          ) : (
            <>
              <ScoreNumber project={project} />
              <small>
                {project.score.confirmed_count} de 20 hitos confirmados
              </small>
            </>
          )}
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
      <div className="two-column">
        <section className="panel">
          <Eyebrow>CAPACIDAD DEMOSTRADA</Eyebrow>
          <h2>{project.score.confirmed_count} hitos con puntos vigentes</h2>
          <p>
            {project.score.contributions
              .filter((c) => c.points > 0)
              .map(
                (c) =>
                  p.data.rubric.milestones.find((m) => m.id === c.id)?.name,
              )
              .join(" · ") ||
              "Sin confirmación suficiente. Esto no demuestra que la capacidad no exista."}
          </p>
        </section>
        <section className="panel">
          <Eyebrow>PENDIENTE DE VERIFICAR</Eyebrow>
          <h2>{20 - project.score.confirmed_count} hitos sin contribución</h2>
          <p>
            Declaraciones, revisiones y dependencias suspendidas se explican en
            la tabla. La confianza no multiplica los puntos.
          </p>
        </section>
      </div>
      <section className="panel">
        <div className="section-head">
          <h2>Los 20 hitos</h2>
          <Tag>vi-pc-v1</Tag>
        </div>
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Hitos del proyecto"
        >
          <table className="milestones">
            <thead>
              <tr>
                <th scope="col">Hito y criterio</th>
                <th scope="col">Peso</th>
                <th scope="col">Estado / contribución</th>
                <th scope="col">Decisión y pruebas</th>
              </tr>
            </thead>
            <tbody>
              {p.data.rubric.milestones.map((m) => {
                const contribution = project.score.contributions.find(
                    (c) => c.id === m.id,
                  )!,
                  assessment = project.assessments.find(
                    (a) => a.id === contribution.assessment_id,
                  );
                return (
                  <tr key={m.id}>
                    <th scope="row">
                      <span className="mono">{m.id}</span> {m.name}
                      <details>
                        <summary>Criterio y dependencias</summary>
                        <p>{m.criteria}</p>
                        <small>
                          Requiere: {m.dependencies.join(", ") || "Ninguno"}
                        </small>
                      </details>
                    </th>
                    <td>{m.weight}</td>
                    <td>
                      <Tag
                        tone={
                          contribution.points
                            ? "green"
                            : contribution.state === "disputed"
                              ? "amber"
                              : "muted"
                        }
                      >
                        {labels.states[contribution.state]}
                      </Tag>
                      <small>{contribution.points} puntos vigentes</small>
                    </td>
                    <td>
                      <p>{contribution.reason}</p>
                      {assessment && (
                        <>
                          <small>
                            {assessment.reviewer} · Confianza{" "}
                            {assessment.confidence} ·{" "}
                            {dateTime(assessment.recorded_at)}
                          </small>
                          {assessment.evidence_ids.map((id) => (
                            <a
                              className="evidence-link"
                              key={id}
                              href={`#${id}`}
                            >
                              Consultar evidencia{" "}
                              {project.evidence.find((e) => e.id === id)?.level}
                            </a>
                          ))}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Evidencias y procedencia</h2>
        {project.evidence.length ? (
          project.evidence.map((e) => (
            <article className="evidence" id={e.id} key={e.id}>
              <div>
                <Tag tone={e.level === "E3" ? "green" : "violet"}>
                  {e.level}
                </Tag>
                <Tag>
                  {e.availability === "withdrawn"
                    ? "Evidencia retirada"
                    : e.availability === "unavailable"
                      ? "Fuente no disponible"
                      : "Disponible"}
                </Tag>
                <Tag>{e.target_version}</Tag>
              </div>
              <h3>{e.summary}</h3>
              <p>Alcance: {e.scope}</p>
              <p>
                Limitaciones: {e.limitations.join(" · ") || "No registradas"}
              </p>
              <small>
                Publicado: {dateTime(e.source_published_at)} · Observado:{" "}
                {dateTime(e.observed_at)} · {e.author}
              </small>
              <small>
                Cadena: {e.provenance_chain} · SHA-256:{" "}
                <span className="hash">{e.content_hash}</span>
              </small>
              <External url={e.permalink ?? e.url}>
                Abrir material original
              </External>
            </article>
          ))
        ) : (
          <p className="muted">No hay evidencias registradas.</p>
        )}
      </section>
      <div className="two-column">
        <section className="panel">
          <h2>Histórico de puntuación</h2>
          <p>
            Mejor valor histórico:{" "}
            {Math.max(0, ...project.history.map((h) => h.score))}/100. Capacidad
            actual: {project.score.score}/100.
          </p>
          {project.history.length ? (
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Histórico de puntuación"
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Fecha efectiva</th>
                    <th scope="col">Puntos</th>
                    <th scope="col">Rúbrica</th>
                  </tr>
                </thead>
                <tbody>
                  {project.history.map((h) => (
                    <tr key={h.input_hash}>
                      <td>{dateTime(h.effective_at)}</td>
                      <td>{h.score}/100</td>
                      <td>{h.rubric_id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>Sin cambios registrados.</p>
          )}
        </section>
        <section className="panel">
          <h2>
            <GitFork size={20} /> Project DNA
          </h2>
          {project.relations.length ? (
            project.relations.map((r) => (
              <article key={r.id}>
                <Tag>{r.state === "reviewed" ? "Revisada" : "Propuesta"}</Tag>
                <p>
                  {r.relation_type}:{" "}
                  {
                    p.data.projects.find(
                      (p) =>
                        p.id ===
                        (r.from_project_id === project.id
                          ? r.to_project_id
                          : r.from_project_id),
                    )?.name
                  }
                </p>
                <p>{r.rationale}</p>
                <small>Confianza {r.confidence}. No hereda puntos.</small>
              </article>
            ))
          ) : (
            <p>
              No hay relaciones comprobadas. La similitud del nombre no
              demuestra parentesco ni independencia.
            </p>
          )}
        </section>
      </div>
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
function CandidateCard({ c, linked }: { c: Candidate; linked: boolean }) {
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
      {linked ? (
        <External url={c.canonical_url}>Consultar candidato</External>
      ) : (
        <small className="hash">{c.canonical_url}</small>
      )}
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
        no se presupone exhaustividad. Ningún candidato está verificado: no
        descargues ni ejecutes nada de estos repositorios.
      </div>
      {p.data.candidates.length ? (
        <>
          {clean.length ? (
            <div className="project-cards">
              {clean.map((c) => (
                <CandidateCard c={c} linked key={c.id} />
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
              <summary>
                Posibles copias o reclamos ({flagged.length}). Se muestran sin
                enlace hasta su revisión.
              </summary>
              <div className="project-cards">
                {flagged.map((c) => (
                  <CandidateCard c={c} linked={false} key={c.id} />
                ))}
              </div>
            </details>
          ) : null}
          {reviewed.length ? (
            <details className="radar-group">
              <summary>Decisiones registradas ({reviewed.length})</summary>
              <div className="project-cards">
                {reviewed.map((c) => (
                  <CandidateCard
                    c={c}
                    linked={c.status === "accepted"}
                    key={c.id}
                  />
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
  return (
    <>
      <PageTitle
        label="METODOLOGÍA · VI-PC-V1"
        title="Cada punto tiene que explicarse."
        description="Medimos capacidad técnica demostrada en una ruta completa de ejecución en PC. Los 100 puntos no son una predicción de éxito ni una fecha de disponibilidad."
      />
      <div className="two-column">
        <section className="panel">
          <ShieldCheck className="accent" />
          <h2>La confirmación es humana</h2>
          <p>
            Un hito suma cuando satisface sus criterios, tiene una demostración
            E2 y corroboración E3 o una comprobación técnica independiente
            documentada, y un mantenedor autorizado registra su aprobación.
          </p>
          <p>
            Si una dependencia pierde confirmación, los hitos que dependen de
            ella dejan de contribuir. El historial se conserva.
          </p>
        </section>
        <section className="panel">
          <h2>Cuatro niveles de evidencia</h2>
          {[
            [
              "E0",
              "Declaración",
              "Una afirmación identificada; no añade puntos.",
            ],
            [
              "E1",
              "Indicio técnico",
              "Material parcial para iniciar una revisión.",
            ],
            [
              "E2",
              "Demostración documentada",
              "Pruebas específicas sobre una versión y un entorno.",
            ],
            [
              "E3",
              "Corroboración independiente",
              "Un tercero documenta una comprobación reproducible.",
            ],
          ].map(([id, title, desc]) => (
            <p key={id}>
              <Tag tone="violet">{id}</Tag> <strong>{title}</strong>
              <br />
              <span className="muted">{desc}</span>
            </p>
          ))}
        </section>
      </div>
      <section className="panel">
        <h2>20 hitos · 100 puntos</h2>
        <p>
          Sin puntos parciales. M01 + M02 + M03 = 11 puntos. Los empates
          comparten posición y los componentes se muestran fuera de la
          clasificación común.
        </p>
        <div
          className="table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Rúbrica de evaluación"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">ID</th>
                <th scope="col">Hito / criterio mínimo</th>
                <th scope="col">Peso</th>
                <th scope="col">Dependencias</th>
              </tr>
            </thead>
            <tbody>
              {p.data.rubric.milestones.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{m.id}</td>
                  <th scope="row">
                    {m.name}
                    <details>
                      <summary>Ver criterio</summary>
                      <p>{m.criteria}</p>
                    </details>
                  </th>
                  <td>{m.weight}</td>
                  <td>{m.dependencies.join(", ") || "Ninguna"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Estados, incertidumbre y rectificaciones</h2>
        <div className="tag-list">
          {Object.entries(labels.states).map(([k, v]) => (
            <Tag key={k}>{v}</Tag>
          ))}
        </div>
        <p>
          «Sin evaluar» indica falta de confirmación suficiente. Una
          contradicción material suspende puntos y abre revisión. Las decisiones
          nuevas se añaden al historial; no se borra la corrección anterior.
        </p>
        <p>
          La confianza baja, media o alta describe la calidad de procedencia y
          corroboración. No es una probabilidad ni un multiplicador. Varios
          artículos derivados del mismo anuncio comparten una sola cadena de
          procedencia.
        </p>
        <p>
          La IA está desactivada. El servicio funciona con reglas y decisiones
          registradas. Nunca ejecuta software de los proyectos que observa.
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
              <External url={s.canonical_url}>Ver fuente</External>
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
function Compare({ p, link }: Props) {
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState(() =>
    (params.get("ids") ?? "").split(",").filter(Boolean).slice(0, 3),
  );
  useEffect(() => {
    const sync = () =>
      setSelected(
        (new URLSearchParams(window.location.search).get("ids") ?? "")
          .split(",")
          .filter(Boolean)
          .slice(0, 3),
      );
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const projects = p.data.projects.filter(
    (p) => selected.includes(p.id) && p.rank !== null,
  );
  const toggle = (id: string) => {
    const next = new URLSearchParams(params),
      ids = selected.includes(id)
        ? selected.filter((i) => i !== id)
        : [...selected, id].slice(0, 3);
    next.set("ids", ids.join(","));
    setSelected(ids);
    setParams(next);
  };
  return (
    <>
      <PageTitle
        label="COMPARADOR"
        title="El mismo criterio. Hasta tres rutas."
        description="Solo se comparan proyectos admitidos con alcance de ejecución completo. La puntuación no estima cuánto falta para una entrega."
      />
      <div className="filters">
        {p.data.projects
          .filter((p) => p.rank !== null)
          .map((p) => (
            <label className="checkbox" key={p.id}>
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                disabled={!selected.includes(p.id) && selected.length >= 3}
                onChange={() => toggle(p.id)}
              />
              {p.name}
            </label>
          ))}
      </div>
      {projects.length ? (
        <>
          <ProjectTable projects={projects} link={link} />
          <section className="panel">
            <div
              className="table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Comparación de hitos"
            >
              <table>
                <thead>
                  <tr>
                    <th scope="col">Hito</th>
                    {projects.map((p) => (
                      <th scope="col" key={p.id}>
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {p.data.rubric.milestones.map((m) => (
                    <tr key={m.id}>
                      <th scope="row">
                        {m.id} · {m.name}
                      </th>
                      {projects.map((p) => (
                        <td key={p.id}>
                          {
                            labels.states[
                              p.score.contributions.find((c) => c.id === m.id)!
                                .state
                            ]
                          }{" "}
                          ·{" "}
                          {
                            p.score.contributions.find((c) => c.id === m.id)!
                              .points
                          }{" "}
                          pts.
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <Empty
          title="Selecciona rutas para compararlas"
          detail={
            p.data.projects.length
              ? "Marca hasta tres proyectos en la lista superior."
              : "Aún no hay rutas completas admitidas en esta publicación."
          }
        />
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
