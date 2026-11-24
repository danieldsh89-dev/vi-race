CREATE TABLE score_history_v2 (id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id), rubric_id TEXT REFERENCES rubrics(id), score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100), confirmed_count INTEGER NOT NULL CHECK(confirmed_count BETWEEN 0 AND 20), effective_at TEXT NOT NULL, recorded_at TEXT NOT NULL, cause_assessment_id TEXT REFERENCES assessments(id), input_hash TEXT NOT NULL, rules_commit TEXT NOT NULL, payload_json TEXT NOT NULL CHECK(json_valid(payload_json)));
INSERT INTO score_history_v2 SELECT * FROM score_history;
DROP TABLE score_history;
ALTER TABLE score_history_v2 RENAME TO score_history;
CREATE INDEX idx_score_project_date ON score_history(project_id,rubric_id,effective_at);
CREATE TRIGGER immutable_assessments_delete BEFORE DELETE ON assessments BEGIN SELECT RAISE(ABORT,'append-only assessment'); END;
CREATE TRIGGER immutable_audit_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT,'append-only audit'); END;
CREATE TRIGGER immutable_scores_update BEFORE UPDATE ON score_history BEGIN SELECT RAISE(ABORT,'append-only score'); END;
CREATE TRIGGER immutable_scores_delete BEFORE DELETE ON score_history BEGIN SELECT RAISE(ABORT,'append-only score'); END;
