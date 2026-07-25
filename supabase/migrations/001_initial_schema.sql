-- ============================================================================
-- Smart Menu — Gerador de Cardápios para Casas de Repouso
-- Migration: 001_initial_schema.sql
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. TABELAS
-- ============================================================================

-- Tenants (Casas de Repouso)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#059669',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dishes (Pratos por tenant ou globais)
CREATE TABLE IF NOT EXISTS dishes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = Aplicável a todas as casas
  category TEXT NOT NULL CHECK (category IN (
    'cafe', 'prato_principal', 'salada', 'acompanhamento',
    'lanche', 'jantar', 'ceia', 'sobremesa', 'suco'
  )),
  name TEXT NOT NULL,
  ingredients TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Menu Rules (Regras clínicas/cardápio por tenant ou globais)
CREATE TABLE IF NOT EXISTS menu_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = Aplicável a todas as casas
  category TEXT NOT NULL CHECK (category IN (
    'cafe', 'lanche', 'jantar', 'ceia', 'sobremesa', 'diabeticos', 'pastosos', 'geral'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Monthly Menus (Cardápio diário por tenant)
CREATE TABLE IF NOT EXISTS monthly_menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  lunch_dish_id UUID REFERENCES dishes(id) ON DELETE SET NULL,
  lunch_salad TEXT,
  juice TEXT,
  dessert_override TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, date)
);

-- Indexes
CREATE INDEX idx_dishes_tenant ON dishes(tenant_id);
CREATE INDEX idx_dishes_category ON dishes(category);
CREATE INDEX idx_menu_rules_tenant ON menu_rules(tenant_id);
CREATE INDEX idx_monthly_menus_tenant_date ON monthly_menus(tenant_id, date);

-- ============================================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_menus ENABLE ROW LEVEL SECURITY;

-- Política: Todos podem ler/inserir/atualizar/deletar tenants
CREATE POLICY "tenants_all" ON tenants FOR ALL USING (true) WITH CHECK (true);

-- Política: Todos podem ler/inserir/atualizar/deletar pratos
CREATE POLICY "dishes_all" ON dishes FOR ALL USING (true) WITH CHECK (true);

-- Política: Todos podem ler/inserir/atualizar/deletar regras
CREATE POLICY "menu_rules_all" ON menu_rules FOR ALL USING (true) WITH CHECK (true);

-- Política: Todos podem ler/inserir/atualizar/deletar menus
CREATE POLICY "menus_all" ON monthly_menus FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- 3. SEED DATA — TENANTS
-- ============================================================================

INSERT INTO tenants (name, slug, primary_color, logo_url) VALUES
  ('Lares Casa de Repouso', 'lares', '#059669', '/logos/lares.jpg'),
  ('Casa de Repouso Vida Plena', 'vida-plena', '#0891B2', '/logos/vida-plena.png');

-- ============================================================================
-- 4. SEED DATA — PRATOS: LARES CASA DE REPOUSO
-- ============================================================================

INSERT INTO dishes (tenant_id, category, name, ingredients)
SELECT t.id, 'prato_principal', d.name, d.ingredients
FROM tenants t
CROSS JOIN (VALUES
  ('Escondidinho de Carne Seca', 'Carne seca desfiada, purê de mandioca, queijo gratinado'),
  ('Strogonoff de Frango', 'Frango em cubos, creme de leite, molho de tomate, champignon'),
  ('Omelete com Legumes', 'Ovos, cebola, tomate, pimentão, ervilha'),
  ('Frango Assado', 'Coxa e sobrecoxa, alho, limão, ervas finas'),
  ('Carne de Panela', 'Carne bovina (acém), cenoura, batata, cebola'),
  ('Feijoada Light', 'Feijão preto, carne seca, linguiça calabresa, lombo'),
  ('Peixe Grelhado', 'Filé de tilápia, limão, azeite, ervas'),
  ('Carne Moída com Purê', 'Carne moída, molho de tomate, batata, leite, manteiga'),
  ('Macarrão à Bolonhesa', 'Macarrão parafuso, carne moída, molho de tomate, cebola'),
  ('Frango ao Molho', 'Peito de frango, creme de leite, milho, ervilha'),
  ('Bife Acebolado', 'Bife bovino, cebola em rodelas, alho, azeite'),
  ('Lombo Assado', 'Lombo suíno, alho, mostarda, ervas')
) AS d(name, ingredients)
WHERE t.slug = 'lares';

INSERT INTO dishes (tenant_id, category, name, ingredients)
SELECT t.id, 'salada', d.name, d.ingredients
FROM tenants t
CROSS JOIN (VALUES
  ('Alface e Tomate', 'Alface americana, tomate, azeite, sal'),
  ('Salada de Repolho Roxo', 'Repolho roxo, tomate, azeite'),
  ('Salada de Alface', 'Alface crespa, azeite, sal')
) AS d(name, ingredients)
WHERE t.slug = 'lares';

-- ============================================================================
-- 5. SEED DATA — PRATOS: CASA DE REPOUSO VIDA PLENA
-- ============================================================================

INSERT INTO dishes (tenant_id, category, name, ingredients)
SELECT t.id, 'prato_principal', d.name, d.ingredients
FROM tenants t
CROSS JOIN (VALUES
  ('Bobó de Camarão', 'Camarão, mandioca, leite de coco, azeite de dendê, coentro'),
  ('Dobradinha', 'Bucho bovino, feijão branco, cenoura, batata, temperos'),
  ('Cassoulet', 'Linguiça, carne suína, feijão branco, cenoura, ervas'),
  ('Fricassé de Frango', 'Frango desfiado, creme de leite, milho, azeitona, batata palha'),
  ('Peixe Empanado', 'Filé de merluza, farinha de rosca, ovo, limão'),
  ('Filé ao Molho Madeira', 'Filé mignon, molho madeira, champignon, arroz'),
  ('Bacalhoada', 'Bacalhau, batata, cebola, ovos, azeitonas, azeite'),
  ('Risoto de Funghi', 'Arroz arbóreo, funghi seco, parmesão, manteiga, vinho branco'),
  ('Moqueca de Peixe', 'Peixe, leite de coco, pimentão, tomate, azeite de dendê, coentro'),
  ('Frango à Parmegiana', 'Peito de frango empanado, molho de tomate, queijo, presunto'),
  ('Carne de Sol', 'Carne de sol desfiada, manteiga de garrafa, cebola, macaxeira'),
  ('Lagarto Recheado', 'Lagarto bovino, cenoura, ovos, presunto, queijo')
) AS d(name, ingredients)
WHERE t.slug = 'vida-plena';

INSERT INTO dishes (tenant_id, category, name, ingredients)
SELECT t.id, 'salada', d.name, d.ingredients
FROM tenants t
CROSS JOIN (VALUES
  ('Agrião com Melão', 'Agrião, melão em cubos, azeite, limão'),
  ('Tabule', 'Trigo para quibe, tomate, pepino, hortelã, limão, azeite'),
  ('Pepino com Rúcula', 'Pepino fatiado, rúcula, azeite, limão, gergelim'),
  ('Salada Caesar', 'Alface romana, croutons, parmesão, molho caesar'),
  ('Salada Tropical', 'Mix de folhas, manga, abacaxi, nozes, molho de iogurte')
) AS d(name, ingredients)
WHERE t.slug = 'vida-plena';

-- ============================================================================
-- 6. SEED DATA — REGRAS GLOBAIS
-- ============================================================================

INSERT INTO menu_rules (tenant_id, category, title, description) VALUES
  (NULL, 'temperos', 'Orientações de Temperos', 'Usar moderadamente sal, alho, cebola, ervas finas. Evitar excesso de pimenta e condimentos industrializados.'),
  (NULL, 'diabeticos', 'Orientações para Diabéticos', 'Usar adoçante, sempre ter folhas cruas no prato. Adoçante diet culinário para bolos. Mingau de aveia sem açúcar, com canela.'),
  (NULL, 'pastosos', 'Orientações para Dietas Pastosas', 'Bater no liquidificador, frutas raspadas ou amassadas. Usar módulo de fibra junto com as principais refeições.');

-- ============================================================================
-- 7. TRIGGER: updated_at automático
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON monthly_menus
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
