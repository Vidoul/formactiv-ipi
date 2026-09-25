-- Base dédiée aux tests d'intégration (npm run test:e2e -w apps/api).
-- Séparée de la base de développement pour que les tests puissent la vider sans risque.
CREATE DATABASE formactiv_test OWNER formactiv;
