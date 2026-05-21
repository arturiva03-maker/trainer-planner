-- ============================================
-- Pool-Feature: Wiederkehrende Gruppentrainings
-- mit Pauschalpreis pro Spieler pro Woche
-- ============================================

-- 1. Tabelle: pools (Pool-Definitionen)
CREATE TABLE IF NOT EXISTS pools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  wochentag INT NOT NULL CHECK (wochentag >= 0 AND wochentag <= 6),
  uhrzeit_von TEXT NOT NULL,
  uhrzeit_bis TEXT NOT NULL,
  pauschalpreis_pro_woche NUMERIC(10,2) NOT NULL DEFAULT 0,
  start_datum DATE,
  end_datum DATE,
  notiz TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabelle: pool_spieler (Spieler-Zuordnung mit optionalem Preis-Override)
CREATE TABLE IF NOT EXISTS pool_spieler (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_id UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  spieler_id UUID NOT NULL REFERENCES spieler(id) ON DELETE CASCADE,
  pauschalpreis_override NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pool_id, spieler_id)
);

-- 3. Indizes
CREATE INDEX IF NOT EXISTS idx_pools_user_id ON pools(user_id);
CREATE INDEX IF NOT EXISTS idx_pool_spieler_pool_id ON pool_spieler(pool_id);
CREATE INDEX IF NOT EXISTS idx_pool_spieler_spieler_id ON pool_spieler(spieler_id);

-- 4. RLS aktivieren
ALTER TABLE pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_spieler ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: pools
CREATE POLICY "Owner kann eigene Pools lesen" ON pools
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Owner kann Pools erstellen" ON pools
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner kann Pools aktualisieren" ON pools
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Owner kann Pools löschen" ON pools
  FOR DELETE USING (auth.uid() = user_id);

-- 6. RLS Policies: pool_spieler (über Pool-Owner)
CREATE POLICY "Owner kann Pool-Spieler lesen" ON pool_spieler
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM pools WHERE pools.id = pool_id AND pools.user_id = auth.uid())
  );
CREATE POLICY "Owner kann Pool-Spieler erstellen" ON pool_spieler
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM pools WHERE pools.id = pool_id AND pools.user_id = auth.uid())
  );
CREATE POLICY "Owner kann Pool-Spieler aktualisieren" ON pool_spieler
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM pools WHERE pools.id = pool_id AND pools.user_id = auth.uid())
  );
CREATE POLICY "Owner kann Pool-Spieler löschen" ON pool_spieler
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM pools WHERE pools.id = pool_id AND pools.user_id = auth.uid())
  );

-- 7. Updated_at Trigger
CREATE OR REPLACE FUNCTION update_pools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pools_updated_at ON pools;
CREATE TRIGGER pools_updated_at
  BEFORE UPDATE ON pools
  FOR EACH ROW
  EXECUTE FUNCTION update_pools_updated_at();
