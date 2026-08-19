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
  meal_data JSONB,
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
  ('Casa de Repouso Vida Plena', 'vida-plena', '#0891B2', '/logos/vida-plena.png'),
  ('Casa de Repouso Vovó Alda', 'vovo-alda', '#0284c7', '/logos/vovo-alda.png');

-- ============================================================================
-- 4. SEED DATA — PRATOS: PRATOS REAIS DAS CASAS DE REPOUSO
-- ============================================================================

INSERT INTO dishes (tenant_id, category, name, ingredients)
SELECT t.id, 'prato_principal', d.name, d.ingredients
FROM tenants t
CROSS JOIN (VALUES
  ('Escondidinho de Frango', 'Frango desfiado, purê de mandioca/batata, queijo gratinado'),
  ('Coxa e Sobrecoxa Assada', 'Coxa e sobrecoxa de frango assada com legumes'),
  ('Músculo Ensopado com Chuchu e Cenoura', 'Músculo bovino cozido com chuchu e cenoura'),
  ('Peixe Empanado (Cação)', 'Filé de cação empanado e frito'),
  ('Dobradinha com Feijão Branco', 'Dobradinha cozida com feijão branco e temperos verdes'),
  ('Acém em Cubos com Batata', 'Acém bovino em cubos ensopado com batatas'),
  ('Carne de Porco Picadinha', 'Carne suína picadinha com temperos da casa'),
  ('Escondidinho de Carne Seca', 'Carne seca desfiada com purê de mandioca'),
  ('Fricassé de Frango', 'Frango desfiado com creme de milho e vagem refogada'),
  ('Almôndegas ao Molho', 'Almôndegas bovinas ao molho de tomate fresco'),
  ('Linguiça de Churrasco', 'Linguiça assada acompanhada de purê de batata'),
  ('Lasanha de Frango com Mussarela', 'Lasanha com recheio de frango e cobertura de mussarela'),
  ('Sobrecoxa Assada com Feijão Tropeiro', 'Sobrecoxa assada temperada com ervas'),
  ('Carne de Porco em Cubos Ensopada', 'Carne suína ensopada com tomate e pimentão colorido'),
  ('Frango com Quiabo e Polenta', 'Frango ensopado com quiabo refogado e polenta'),
  ('Bife à Pizzaiolo', 'Bife bovino coberto com molho de tomate e queijo com creme de milho'),
  ('Moqueca de Peixe', 'Peixe cozido no leite de coco com pimentões e vinagrete de lentilha'),
  ('Strogonoff de Frango', 'Frango em cubos com creme de leite e cogumelos'),
  ('Paleta em Tiras Pequenas na Pressão', 'Paleta bovina cozida na pressão com suflê de chuchu'),
  ('Frango Xadrez', 'Peito de frango com pimentão amarelo, cenoura e brócolis'),
  ('Cassoulet', 'Carne suína e feijão com banana da terra frita'),
  ('Panqueca de Carne Moída', 'Panqueca recheada com carne moída e molho'),
  ('Carne Seca com Abóbora', 'Carne seca desfiada refogada com abóbora'),
  ('Macarronada à Bolonhesa', 'Massa com molho à bolonhesa, azeitona, milho e manjericão'),
  ('Bobó de Camarão', 'Bobó leve de camarão com abobrinha cozida'),
  ('Carne Moída com Legumes', 'Carne moída refogada com chuchu e cenoura'),
  ('Bife Bovino de Panela Acebolado', 'Bife de panela macio com cebola e beringela empanada'),
  ('Carne Ensopada com Legumes', 'Carne bovina macia ensopada com legumes variados'),
  ('Omelete de Queijo', 'Omelete de forno com queijo gratinado e maionese')
) AS d(name, ingredients)
WHERE t.slug IN ('lares', 'vida-plena', 'vovo-alda');

INSERT INTO dishes (tenant_id, category, name, ingredients)
SELECT t.id, 'salada', d.name, d.ingredients
FROM tenants t
CROSS JOIN (VALUES
  ('Salada de Alface e Tomate', 'Alface crespa, tomate fresco, azeite e sal'),
  ('Salada de Repolho Roxo e Tomate', 'Repolho roxo, tomate e azeite'),
  ('Alface e Pepino', 'Alface e pepino fatiado'),
  ('Salada de Agrião e Pepino', 'Agrião fresco com pepino'),
  ('Salada de Agrião e Couve', 'Agrião e couve com lâminas de melão'),
  ('Salada de Folhas', 'Mix de folhas verdes da estação'),
  ('Salada de Pepino e Rúcula', 'Pepino com rúcula e azeite'),
  ('Tabule', 'Trigo para quibe, tomate, pepino, hortelã e limão')
) AS d(name, ingredients)
WHERE t.slug IN ('lares', 'vida-plena', 'vovo-alda');

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
