import React from "react";
import { Link } from "react-router-dom";
import { Activity, GitCommit, Sparkles, Star, Trophy } from "lucide-react";
import type { ProgressSignalView, ProjectView, Publication } from "@vi/contracts";
import { ladder } from "@vi/progress";
import { dateTime } from "./text";

type LinkFn = (path: string) => string;
const sourceLabel: Record<ProgressSignalView["source_type"], string> = {
  readme: "README",
  release: "Versión",
  commit: "Commit",
};

/** «hace 3 h», «hace 2 d»: lectura rápida de lo fresco que es un dato. */
export function relative(value: string | null, now = Date.now()): string {
  if (!value) return "sin registro";
  const minutes = Math.max(0, Math.round((now - Date.parse(value)) / 60000));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days < 60 ? `hace ${days} d` : dateTime(value);
}

/** Quita viñetas y marcas de markdown del inicio del extracto. */
const clean = (t: string) => t.replace(/^[\s>*#|+-]+/, "").trim();
export const stepName = (level: number) =>
  level ? ladder[level - 1].name : "Sin avances anunciados";

/** Barra de 8 segmentos: cada paso detectado se rellena. */
export function LadderBar({
  project,
  compact = false,
}: {
  project: ProjectView;
  compact?: boolean;
}) {
  const reached = new Set(project.progress.steps.map((s) => s.step));
  const level = project.progress.level;
  return (
    <div
      className={`ladder-bar${compact ? " compact" : ""}`}
      role="img"
      aria-label={`Nivel ${level} de ${ladder.length}: ${stepName(level)}`}
    >
      {ladder.map((step, i) => (
        <span
          key={step.id}
          title={`${step.id} · ${step.name}${reached.has(step.id) ? " (anunciado)" : ""}`}
          className={`seg${reached.has(step.id) ? " on" : i < level ? " implied" : ""}`}
        />
      ))}
    </div>
  );
}

/** Commits por día de las dos últimas semanas. */
export function Sparkline({ data }: { data: number[] }) {
  const total = data.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...data);
  const w = 84,
    h = 26,
    bw = w / Math.max(1, data.length);
  return (
    <svg
      className="sparkline"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`${total} commits en 14 días`}
    >
      {data.map((v, i) => {
        const bh = v ? Math.max(2, Math.sqrt(v / max) * (h - 2)) : 1;
        return (
          <rect
            key={i}
            x={i * bw + 1}
            y={h - bh}
            width={Math.max(1, bw - 2)}
            height={bh}
            rx={1}
            className={v ? "bar" : "bar zero"}
          />
        );
      })}
    </svg>
  );
}

const reachedAt = (x: ProjectView) =>
  x.progress.steps.find((s) => s.step === `P${x.progress.level}`)?.detected_at ?? "9";
const byRace = (a: ProjectView, b: ProjectView) =>
  b.progress.level - a.progress.level ||
  reachedAt(a).localeCompare(reachedAt(b)) ||
  sum(b.activity_daily) - sum(a.activity_daily) ||
  (b.stats?.stars ?? 0) - (a.stats?.stars ?? 0) ||
  a.name.localeCompare(b.name);
const sum = (d: number[]) => d.reduce((a, b) => a + b, 0);

export function RaceDashboard({ p, link }: { p: Publication; link: LinkFn }) {
  const routes = p.data.projects
    .filter((x) => x.project_type === "full_route")
    .sort(byRace);
  const components = p.data.projects
    .filter((x) => x.project_type === "component")
    .sort(byRace);
  const now = Date.parse(p.generated_at) || Date.now();
  const week = now - 7 * 86400000;
  // Novedades: pasos detectados después de la primera lectura de cada ruta.
  const news = routes
    .flatMap((project) =>
      project.progress.steps
        .filter((s) => !s.baseline)
        .map((s) => ({ project, s })),
    )
    .sort((a, b) => b.s.detected_at.localeCompare(a.s.detected_at));
  // Punto de partida: el paso más alto que ya anunciaba cada ruta al empezar.
  const start = routes
    .map((project) => ({
      project,
      s: project.progress.steps
        .filter((s) => s.baseline)
        .sort((a, b) => b.step.localeCompare(a.step))[0],
    }))
    .filter((x): x is { project: ProjectView; s: ProgressSignalView } => !!x.s);
  const signals = [...news, ...start];
  const recent = news.filter((x) => Date.parse(x.s.detected_at) >= week);
  const leader = routes[0];
  const commits14 = p.data.projects.reduce((t, x) => t + sum(x.activity_daily), 0);
  const active7 = p.data.projects.filter(
    (x) => sum(x.activity_daily.slice(-7)) > 0,
  ).length;
  const funnel = ladder.map((step, i) => ({
    step,
    count: routes.filter((x) => x.progress.level > i).length,
  }));
  return (
    <>
      <section className="race-hero">
        <div>
          <p className="eyebrow">
            <span className="eyebrow-line" /> GTA VI EN PC · SEGUIMIENTO EN
            DIRECTO
          </p>
          <h1>
            La carrera por llevar <em>GTA VI</em> a PC
          </h1>
          <p>
            Todos los proyectos comunitarios que intentan ejecutar la build de
            Xbox Series en PC, en un solo sitio. Cada avance se detecta solo en
            sus README, versiones y commits, y se actualiza cada 10 minutos.
          </p>
        </div>
        <div className="race-kpis" aria-label="Resumen">
          <Kpi
            icon={<Trophy size={18} />}
            label="Más lejos llega"
            value={leader ? `P${leader.progress.level}` : "—"}
            caption={
              leader
                ? `${leader.name} · ${stepName(leader.progress.level)}`
                : "Sin proyectos"
            }
          />
          <Kpi
            icon={<Activity size={18} />}
            label="Proyectos seguidos"
            value={String(p.data.projects.length)}
            caption={`${active7} con commits esta semana`}
          />
          <Kpi
            icon={<Sparkles size={18} />}
            label="Avances nuevos en 7 días"
            value={String(recent.length)}
            caption={news.length ? "Pasos anunciados desde el inicio" : "Midiendo desde el punto de partida"}
          />
          <Kpi
            icon={<GitCommit size={18} />}
            label="Commits en 14 días"
            value={commits14.toLocaleString("es")}
            caption={`Actualizado ${relative(p.last_collection_success_at, now)}`}
          />
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">LA CARRERA</p>
            <h2>¿Hasta dónde llega cada proyecto?</h2>
          </div>
          <LadderLegend />
        </div>
        <p className="section-description">
          Escalera vi-avance-v1: el paso más alto que cada proyecto anuncia
          haber alcanzado. Es lo que dicen sus autores, detectado
          automáticamente; no una verificación independiente.
        </p>
        {routes.length ? (
          <ol className="race-board">
            {routes.map((x, i) => (
              <RaceRow key={x.id} project={x} position={i + 1} link={link} now={now} />
            ))}
          </ol>
        ) : (
          <p className="muted">Todavía no hay proyectos en seguimiento.</p>
        )}
      </section>

      <div className="two-column race-split">
        <section className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">ÚLTIMOS AVANCES</p>
              <h2>Qué se ha conseguido</h2>
            </div>
            <Sparkles size={22} />
          </div>
          {signals.length ? (
            <ol className="timeline">
              {signals.slice(0, 12).map(({ project, s }) => (
                <li key={`${project.id}-${s.step}`}>
                  <span className={`step-chip s${s.step.slice(1)}`}>{s.step}</span>
                  <div>
                    <p>
                      <Link to={link(`/projects/${project.slug}`)}>
                        <strong>{project.name}</strong>
                      </Link>{" "}
                      · {ladder.find((l) => l.id === s.step)?.name}
                    </p>
                    <blockquote>{clean(s.excerpt)}</blockquote>
                    <small>
                      {sourceLabel[s.source_type]} ·{" "}
                      {s.baseline
                        ? "ya anunciado al empezar el seguimiento"
                        : `detectado ${relative(s.detected_at, now)}`}
                    </small>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Aún no se ha detectado ningún avance.</p>
          )}
        </section>
        <section className="panel">
          <div className="section-head">
            <div>
              <p className="eyebrow">EMBUDO</p>
              <h2>Proyectos por paso</h2>
            </div>
          </div>
          <div className="funnel" role="list">
            {funnel.map(({ step, count }) => (
              <div className="funnel-row" role="listitem" key={step.id}>
                <span className="funnel-label">
                  <b>{step.id}</b> {step.name}
                </span>
                <span className="funnel-track">
                  <span
                    className="funnel-fill"
                    style={{
                      width: `${routes.length ? (count / routes.length) * 100 : 0}%`,
                    }}
                  />
                </span>
                <span className="funnel-count">{count}</span>
              </div>
            ))}
          </div>
          <p className="muted small">
            Rutas completas que han anunciado al menos ese paso.
          </p>
          {components.length > 0 && (
            <>
              <h3 className="sub-head">Componentes</h3>
              <ul className="component-list">
                {components.map((x) => (
                  <li key={x.id}>
                    <Link to={link(`/projects/${x.slug}`)}>{x.name}</Link>
                    <span className="muted">{x.category}</span>
                    <Sparkline data={x.activity_daily} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function Kpi({
  icon,
  label,
  value,
  caption,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="kpi">
      <span className="kpi-label">
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </div>
  );
}

function LadderLegend() {
  return (
    <details className="ladder-legend">
      <summary>Los 8 pasos</summary>
      <ol>
        {ladder.map((s) => (
          <li key={s.id}>
            <b>{s.id}</b> {s.name}
          </li>
        ))}
      </ol>
    </details>
  );
}

function RaceRow({
  project,
  position,
  link,
  now,
}: {
  project: ProjectView;
  position: number;
  link: LinkFn;
  now: number;
}) {
  const level = project.progress.level;
  return (
    <li className="race-row">
      <span className="race-pos">{String(position).padStart(2, "0")}</span>
      <div className="race-name">
        <Link to={link(`/projects/${project.slug}`)}>{project.name}</Link>
        <small>{project.category}</small>
      </div>
      <div className="race-progress">
        <LadderBar project={project} />
        <span className="race-step">
          {level ? (
            <>
              <b>P{level}</b> {stepName(level)}
            </>
          ) : project.title_scope === "multi_title" ? (
            "Emulador general: aún sin avances con GTA VI"
          ) : (
            "Aún no anuncia que arranque el juego"
          )}
        </span>
      </div>
      <div className="race-activity">
        <Sparkline data={project.activity_daily} />
        <small>
          {project.stats?.last_commit_at
            ? `commit ${relative(project.stats.last_commit_at, now)}`
            : "sin commits"}
        </small>
      </div>
      <span className="race-stars" title="Estrellas en GitHub">
        <Star size={14} />
        {project.stats ? project.stats.stars.toLocaleString("es") : "—"}
      </span>
    </li>
  );
}

/** Ficha de proyecto: escalera completa con el extracto que respalda cada paso. */
export function ProgressPanel({ project }: { project: ProjectView }) {
  const bySteps = new Map(project.progress.steps.map((s) => [s.step, s]));
  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <p className="eyebrow">AVANCES ANUNCIADOS</p>
          <h2>
            {project.progress.level
              ? `P${project.progress.level} · ${stepName(project.progress.level)}`
              : "Sin avances anunciados todavía"}
          </h2>
        </div>
        <span className="tag">vi-avance-v1</span>
      </div>
      <LadderBar project={project} />
      <ol className="ladder-detail">
        {ladder.map((step) => {
          const s = bySteps.get(step.id);
          return (
            <li key={step.id} className={s ? "on" : ""}>
              <span className={`step-chip${s ? ` s${step.id.slice(1)}` : " off"}`}>
                {step.id}
              </span>
              <div>
                <strong>{step.name}</strong>
                <p className="muted">{step.description}</p>
                {s && (
                  <>
                    <blockquote>{clean(s.excerpt)}</blockquote>
                    <small>
                      {sourceLabel[s.source_type]} ·{" "}
                      {s.baseline ? "punto de partida · " : ""}detectado {dateTime(s.detected_at)}
                    </small>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="activity-strip">
        <Sparkline data={project.activity_daily} />
        <span>
          {sum(project.activity_daily)} commits en 14 días
          {project.stats &&
            ` · ${project.stats.stars.toLocaleString("es")} estrellas · ${project.stats.forks.toLocaleString("es")} forks`}
          {project.stats?.language ? ` · ${project.stats.language}` : ""}
        </span>
      </div>
      {project.stats?.last_commit_message && (
        <p className="muted small">
          Último commit ({relative(project.stats.last_commit_at)}):{" "}
          <span className="hash">{project.stats.last_commit_message}</span>
        </p>
      )}
    </section>
  );
}
