ALTER TABLE propositions ADD COLUMN proposition_kind TEXT NOT NULL DEFAULT 'claim'
  CHECK (proposition_kind IN ('claim', 'hypothesis'));
ALTER TABLE propositions ADD COLUMN hypothesis_group TEXT NOT NULL DEFAULT '';
ALTER TABLE propositions ADD COLUMN confidence REAL NOT NULL DEFAULT 50
  CHECK (confidence BETWEEN 0 AND 100);
ALTER TABLE propositions ADD COLUMN invalidation_condition TEXT NOT NULL DEFAULT '';
ALTER TABLE propositions ADD COLUMN validity_status TEXT NOT NULL DEFAULT 'active'
  CHECK (validity_status IN ('active', 'possibly_outdated', 'expired'));
ALTER TABLE propositions ADD COLUMN confirmed_at TEXT;
ALTER TABLE propositions ADD COLUMN valid_from TEXT;
ALTER TABLE propositions ADD COLUMN valid_until TEXT;
ALTER TABLE propositions ADD COLUMN review_at TEXT;

ALTER TABLE evidence ADD COLUMN proposition_id INTEGER REFERENCES propositions(id) ON DELETE SET NULL;
ALTER TABLE evidence ADD COLUMN confirmed_at TEXT;
ALTER TABLE evidence ADD COLUMN valid_from TEXT;
ALTER TABLE evidence ADD COLUMN valid_until TEXT;
ALTER TABLE evidence ADD COLUMN review_at TEXT;

ALTER TABLE judgment_snapshots ADD COLUMN proposition_id INTEGER REFERENCES propositions(id) ON DELETE SET NULL;

ALTER TABLE decisions ADD COLUMN proposition_id INTEGER REFERENCES propositions(id) ON DELETE SET NULL;
ALTER TABLE decisions ADD COLUMN judgment_snapshot_id INTEGER REFERENCES judgment_snapshots(id) ON DELETE SET NULL;
ALTER TABLE decisions ADD COLUMN known_risks_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE decisions ADD COLUMN expected_result TEXT NOT NULL DEFAULT '';
ALTER TABLE decisions ADD COLUMN actual_actions_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE decisions ADD COLUMN review_at TEXT;
ALTER TABLE decisions ADD COLUMN result_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (result_status IN ('pending', 'in_progress', 'succeeded', 'failed', 'mixed', 'cancelled'));
ALTER TABLE decisions ADD COLUMN final_result TEXT NOT NULL DEFAULT '';
ALTER TABLE decisions ADD COLUMN retrospective TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_propositions_topic_kind
  ON propositions(topic_id, proposition_kind, hypothesis_group, status);
CREATE INDEX IF NOT EXISTS idx_propositions_review
  ON propositions(validity_status, review_at);
CREATE INDEX IF NOT EXISTS idx_evidence_proposition
  ON evidence(proposition_id, stance, validity_status);
CREATE INDEX IF NOT EXISTS idx_decisions_topic_date
  ON decisions(topic_id, decided_at DESC);

UPDATE knowledge_schema_contract
SET version = 3
WHERE singleton = 1;
