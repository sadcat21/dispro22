-- Delete old worker with username admin@lazerfood.com (it was created with wrong role 'worker')
DELETE FROM public.user_roles WHERE worker_id = '220f872e-79fd-487f-8a13-1839ec5f1217';
DELETE FROM public.workers WHERE id = '220f872e-79fd-487f-8a13-1839ec5f1217';

-- Now update the correct admin worker username
UPDATE public.workers SET username = 'admin@lazerfood.com' WHERE id = '2114623b-bc88-402d-b24e-be90389d122f';

-- Clean up duplicate user_roles
DELETE FROM public.user_roles WHERE worker_id = '2114623b-bc88-402d-b24e-be90389d122f' AND user_id != '0fdd639e-6bbc-4861-8c6d-5208aaa24b25';

-- Update auth user email
UPDATE auth.users SET email = 'admin@lazerfood.com', raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{email}', '"admin@lazerfood.com"') WHERE id = '0fdd639e-6bbc-4861-8c6d-5208aaa24b25';