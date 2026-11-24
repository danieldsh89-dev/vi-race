CREATE TABLE write_guards (id TEXT PRIMARY KEY, ok INTEGER NOT NULL CHECK(ok=1));
CREATE TRIGGER immutable_published_blob_update BEFORE UPDATE ON publication_blobs WHEN (SELECT status FROM publications WHERE id=OLD.publication_id)='complete' BEGIN SELECT RAISE(ABORT,'immutable publication'); END;
CREATE TRIGGER immutable_published_blob_insert BEFORE INSERT ON publication_blobs WHEN (SELECT status FROM publications WHERE id=NEW.publication_id)='complete' BEGIN SELECT RAISE(ABORT,'immutable publication'); END;
