-- Seed sample (demo) data for one user. Same rows as "Try with sample data" (src/lib/demo.ts).
-- Usage: replace :uid with the user's id. The user must have accepted consent first.
-- Remove with: DELETE FROM public.emergency_contacts WHERE user_id = ':uid' AND is_demo = true;
INSERT INTO public.emergency_contacts (user_id, name, phone, relationship, is_demo) VALUES
  (':uid', 'Asha Sharma (sample)', '+91 90000 00001', 'Daughter', true),
  (':uid', 'Ravi Kumar (sample)', '+91 90000 00002', 'Neighbour', true);
