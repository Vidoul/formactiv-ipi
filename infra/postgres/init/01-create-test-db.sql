-- Bases dédiées aux tests, séparées de la base de développement pour pouvoir être vidées sans
-- risque :
--   formactiv_test : tests d'intégration de l'API (npm run test:e2e:api) ;
--   formactiv_e2e  : tests de bout en bout Playwright (npm run test:e2e), recréée à chaque lancement.
CREATE DATABASE formactiv_test OWNER formactiv;
CREATE DATABASE formactiv_e2e OWNER formactiv;
