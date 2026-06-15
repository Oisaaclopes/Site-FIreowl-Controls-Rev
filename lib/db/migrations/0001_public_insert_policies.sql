ALTER TABLE "contact_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "simulator_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sdai_diagnostics" ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON "contact_submissions" TO anon, authenticated;
GRANT INSERT ON "simulator_submissions" TO anon, authenticated;
GRANT INSERT ON "sdai_diagnostics" TO anon, authenticated;

GRANT USAGE, SELECT ON SEQUENCE "contact_submissions_id_seq" TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE "simulator_submissions_id_seq" TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE "sdai_diagnostics_id_seq" TO anon, authenticated;

CREATE POLICY "Allow public contact form inserts"
ON "contact_submissions"
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow public simulator form inserts"
ON "simulator_submissions"
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow public diagnostic form inserts"
ON "sdai_diagnostics"
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
