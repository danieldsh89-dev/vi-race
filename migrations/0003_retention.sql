CREATE INDEX idx_events_observed ON events(observed_at);
CREATE TABLE event_daily (source_id TEXT NOT NULL REFERENCES sources(id), day_utc TEXT NOT NULL, event_type TEXT NOT NULL, project_id TEXT REFERENCES projects(id), event_count INTEGER NOT NULL, compacted_at TEXT NOT NULL, PRIMARY KEY(source_id,day_utc,event_type));
