-- ============================================================================
-- Smart Menu — Gerador de Cardápios para Casas de Repouso
-- Migration: 002_add_meal_data_column.sql
--
-- A coluna `meal_data` já constava em 001_initial_schema.sql, mas como aquele
-- script usa CREATE TABLE IF NOT EXISTS, ele nunca chegou a rodar de fato
-- contra o banco de produção depois que a tabela `monthly_menus` já existia
-- sem essa coluna. Resultado: todo INSERT em monthly_menus era rejeitado
-- pelo PostgREST (erro PGRST204 "Could not find the 'meal_data' column"),
-- e o botão "Salvar" apagava os dados antigos (DELETE) sem conseguir gravar
-- os novos (INSERT falhava por completo).
--
-- Esta migration é idempotente e segura de rodar mesmo se a coluna já
-- existir em algum ambiente.
-- ============================================================================

ALTER TABLE monthly_menus
  ADD COLUMN IF NOT EXISTS meal_data JSONB;
