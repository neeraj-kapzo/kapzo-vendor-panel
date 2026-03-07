-- ============================================================
-- Kapzo — Seed: Sample catalog items for development
-- ============================================================
-- Run this after the initial schema migration.
-- These are admin-managed medicines in the master catalogue.

insert into catalog_items (name, salt_name, mrp, created_by_admin) values
  ('Dolo 650',           'Paracetamol 650mg',             30.00,  true),
  ('Crocin Advance',     'Paracetamol 500mg',             22.00,  true),
  ('Azithral 500',       'Azithromycin 500mg',            85.50,  true),
  ('Augmentin 625',      'Amoxicillin + Clavulanate',    142.00,  true),
  ('Pan 40',             'Pantoprazole 40mg',             45.00,  true),
  ('Omez 20',            'Omeprazole 20mg',               38.00,  true),
  ('Metformin 500',      'Metformin HCl 500mg',           24.00,  true),
  ('Glucophage 1000',    'Metformin HCl 1000mg',          52.00,  true),
  ('Ecosprin 75',        'Aspirin 75mg',                  18.00,  true),
  ('Atorvastatin 10',    'Atorvastatin 10mg',             65.00,  true),
  ('Amlodipine 5',       'Amlodipine 5mg',                28.00,  true),
  ('Telmisartan 40',     'Telmisartan 40mg',              72.00,  true),
  ('Cetirizine 10',      'Cetirizine HCl 10mg',           15.00,  true),
  ('Montair LC',         'Montelukast + Levocetirizine',  95.00,  true),
  ('Sinarest',           'Paracetamol + Phenylephrine',   42.00,  true),
  ('Allegra 120',        'Fexofenadine 120mg',            88.00,  true),
  ('Ibugesic Plus',      'Ibuprofen + Paracetamol',       55.00,  true),
  ('Combiflam',          'Ibuprofen 400mg + Paracetamol', 48.00,  true),
  ('Vitamin D3 60K',     'Cholecalciferol 60000 IU',     120.00,  true),
  ('Shelcal 500',        'Calcium Carbonate + Vit D3',    95.00,  true),
  ('B-Complex Forte',    'Vitamin B Complex',             35.00,  true),
  ('Limcee 500',         'Vitamin C 500mg',               22.00,  true),
  ('Zincovit',           'Zinc + Multivitamin',           75.00,  true),
  ('ORS Electral',       'Oral Rehydration Salts',        12.00,  true),
  ('Becosules',          'Vitamin B-Complex + C',         48.00,  true);
