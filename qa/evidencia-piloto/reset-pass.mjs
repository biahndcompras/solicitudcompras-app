import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

const email = process.argv[2];
const pass = process.argv[3];
const { data, error } = await admin.auth.admin.listUsers();
if (error) { console.error('listUsers:', error.message); process.exit(1); }
const u = data.users.find((x) => x.email === email);
if (!u) { console.error('no existe:', email); process.exit(1); }
const r = await admin.auth.admin.updateUserById(u.id, { password: pass });
if (r.error) { console.error('update:', r.error.message); process.exit(1); }
console.log(`OK password actualizado para ${email}`);
