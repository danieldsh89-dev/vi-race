import type { SqlStore } from "@vi/storage";
export async function applyRetention(store: SqlStore, now: string) {
  const cutoff = (days: number) =>
    new Date(Date.parse(now) - days * 86400000).toISOString();
  await store.batch([
    {
      sql: "UPDATE events SET payload_json=json_set(payload_json,'$.payload',json_object('compacted',json('true'),'summary','Detalle retirado por retención; referencia, fechas y hash originales conservados')) WHERE observed_at<? AND NOT EXISTS(SELECT 1 FROM claims WHERE claims.event_id=events.id)",
      params: [cutoff(30)],
    },
    {
      sql: "INSERT INTO event_daily(source_id,day_utc,event_type,project_id,event_count,compacted_at) SELECT e.source_id,substr(e.observed_at,1,10),e.event_type,e.project_id,count(*),? FROM events e WHERE observed_at<? AND NOT EXISTS(SELECT 1 FROM claims WHERE claims.event_id=e.id) GROUP BY e.source_id,substr(e.observed_at,1,10),e.event_type,e.project_id ON CONFLICT(source_id,day_utc,event_type) DO NOTHING",
      params: [now, cutoff(90)],
    },
    {
      sql: "DELETE FROM events WHERE observed_at<? AND NOT EXISTS(SELECT 1 FROM claims WHERE claims.event_id=events.id)",
      params: [cutoff(90)],
    },
    {
      sql: "DELETE FROM pipeline_runs WHERE started_at<? AND NOT EXISTS(SELECT 1 FROM publications WHERE publications.source_run_id=pipeline_runs.id)",
      params: [cutoff(30)],
    },
    {
      sql: "DELETE FROM usage_daily WHERE date_utc<?",
      params: [cutoff(365).slice(0, 10)],
    },
  ]);
}
