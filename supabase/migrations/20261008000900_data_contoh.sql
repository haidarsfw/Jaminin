-- Data contoh: 8 tenant asli dengan menu dari foto (harga, lama menyiapkan, dan kuota adalah contoh), akun demo tiap peran.
-- Dijalankan sekali per lingkungan: select private.seed_demo('alamat+{peran}@gmail.com');

create or replace function private.seed_demo(p_email_pattern text default 'demo+{peran}@jaminin.test')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer uuid;
  v_owner uuid;
  v_staff uuid;
  v_admin uuid;
  v_teamstaf uuid;
  v_t uuid;
  t jsonb;
  d int;
  v_tenants jsonb := $json$[
    {"slug": "good-moments-coffee", "name": "Good Moments Coffee", "type": "minuman",
     "description": "Kopi, matcha, minuman lain, dan roti.",
     "categories": [
       {"name": "Kopi", "items": [
         {"name": "Kopi Susu", "price": 18000, "prep_minutes": 4, "tags": [],
          "option_groups": [
            {"name": "Suhu", "min_select": 1, "max_select": 1, "options": [{"name": "Dingin"}, {"name": "Panas"}]},
            {"name": "Gula", "min_select": 1, "max_select": 1, "options": [{"name": "Normal"}, {"name": "Kurang manis"}, {"name": "Tanpa gula"}]},
            {"name": "Tambahan", "min_select": 0, "max_select": 1, "options": [{"name": "Extra shot", "price_delta": 5000}]}
          ]},
         {"name": "Americano", "price": 15000, "prep_minutes": 3, "tags": [],
          "option_groups": [{"name": "Suhu", "min_select": 1, "max_select": 1, "options": [{"name": "Dingin"}, {"name": "Panas"}]}]}
       ]},
       {"name": "Minuman lain", "items": [
         {"name": "Matcha Latte", "price": 22000, "prep_minutes": 5, "tags": ["dingin"]}
       ]},
       {"name": "Roti", "items": [
         {"name": "Roti Mentega", "price": 12000, "prep_minutes": 2, "tags": []}
       ]}
     ]},
    {"slug": "pizzario-1-pizza", "name": "Pizzario 1$ Pizza", "type": "makanan",
     "description": "Pizza per potong.",
     "categories": [
       {"name": "Pizza per potong", "items": [
         {"name": "Truffle Mushroom", "price": 18000, "prep_minutes": 8, "tags": ["panas"],
          "option_groups": [{"name": "Tambahan", "min_select": 0, "max_select": 1, "options": [{"name": "Extra keju", "price_delta": 3000}]}]},
         {"name": "Triple Cheese", "price": 16000, "prep_minutes": 8, "tags": ["panas"]},
         {"name": "Pepperoni", "price": 17000, "prep_minutes": 8, "tags": ["panas"],
          "option_groups": [{"name": "Tambahan", "min_select": 0, "max_select": 1, "options": [{"name": "Extra keju", "price_delta": 3000}]}]}
       ]}
     ]},
    {"slug": "mamadora-sweet-savoury", "name": "Mamadora Sweet & Savoury", "type": "keduanya",
     "description": "Waffle cokelat, vanili, susu, dan lainnya, serta air mineral.",
     "categories": [
       {"name": "Waffle", "items": [
         {"name": "Waffle Choco Milky", "price": 15000, "prep_minutes": 7, "tags": []},
         {"name": "Waffle Chocolate", "price": 15000, "prep_minutes": 7, "tags": []},
         {"name": "Waffle Choco Oreo", "price": 17000, "prep_minutes": 7, "tags": []},
         {"name": "Waffle Choco Cheese", "price": 17000, "prep_minutes": 7, "tags": []},
         {"name": "Waffle Choco Banana", "price": 17000, "prep_minutes": 7, "tags": []}
       ]},
       {"name": "Minuman", "items": [
         {"name": "Air Mineral", "price": 5000, "prep_minutes": 0, "tags": ["dingin"]}
       ]}
     ]},
    {"slug": "rustic-grill-bbq", "name": "Rustic Grill BBQ", "type": "makanan",
     "description": "Nasi ayam katsu, ayam grill, kentang, burger, spaghetti.",
     "categories": [
       {"name": "Nasi", "items": [
         {"name": "Nasi Ayam Katsu", "price": 25000, "prep_minutes": 12, "tags": [],
          "option_groups": [
            {"name": "Level pedas", "min_select": 1, "max_select": 1, "options": [{"name": "Tidak pedas"}, {"name": "Level 1"}, {"name": "Level 2"}, {"name": "Level 3"}]},
            {"name": "Tambahan", "min_select": 0, "max_select": 1, "options": [{"name": "Extra keju", "price_delta": 3000}]}
          ]},
         {"name": "Nasi Ayam Grill", "price": 27000, "prep_minutes": 10, "tags": [],
          "option_groups": [{"name": "Level pedas", "min_select": 1, "max_select": 1, "options": [{"name": "Tidak pedas"}, {"name": "Level 1"}, {"name": "Level 2"}, {"name": "Level 3"}]}]}
       ]},
       {"name": "Lainnya", "items": [
         {"name": "Burger", "price": 25000, "prep_minutes": 9, "tags": []},
         {"name": "Spaghetti", "price": 23000, "prep_minutes": 10, "tags": []},
         {"name": "Kentang Goreng", "price": 12000, "prep_minutes": 6, "tags": []}
       ]}
     ]},
    {"slug": "bakso-malang-mahkota", "name": "Bakso Malang Mahkota", "type": "makanan",
     "description": "Bakso malang. Menu asli belum diketahui.",
     "categories": [
       {"name": "Bakso", "items": [
         {"name": "Bakso Malang", "price": 20000, "prep_minutes": 5, "tags": ["panas"],
          "option_groups": [{"name": "Pilihan mi", "min_select": 1, "max_select": 1, "options": [{"name": "Mi kuning"}, {"name": "Bihun"}, {"name": "Tanpa mi"}]}]}
       ]}
     ]},
    {"slug": "mama-bento", "name": "Mama Bento", "type": "makanan",
     "description": "Rice bowl, chicken katsu, teriyaki, chicken wings. Perlu dicocokkan dengan papan menu asli.",
     "categories": [
       {"name": "Bento", "items": [
         {"name": "Rice Bowl", "price": 22000, "prep_minutes": 8, "tags": []},
         {"name": "Chicken Katsu", "price": 25000, "prep_minutes": 10, "tags": []},
         {"name": "Teriyaki", "price": 25000, "prep_minutes": 10, "tags": []},
         {"name": "Chicken Wings", "price": 20000, "prep_minutes": 9, "tags": []}
       ]}
     ]},
    {"slug": "mie-ayam-bangka-asen", "name": "Mie Ayam Bangka Asen", "type": "makanan",
     "description": "Mi ayam.",
     "categories": [
       {"name": "Mi ayam", "items": [
         {"name": "Mi Ayam", "price": 18000, "prep_minutes": 6, "tags": [],
          "option_groups": [{"name": "Tambahan", "min_select": 0, "max_select": 2, "options": [{"name": "Pangsit", "price_delta": 3000}, {"name": "Bakso", "price_delta": 4000}]}]}
       ]}
     ]},
    {"slug": "warung-nusantara", "name": "Warung Nusantara", "type": "makanan",
     "description": "Nasi Goreng Tek Tek, Mie Goreng Tek Tek, kwetiau.",
     "categories": [
       {"name": "Tek tek", "items": [
         {"name": "Nasi Goreng Tek Tek", "price": 18000, "prep_minutes": 8, "tags": ["pedas"],
          "option_groups": [{"name": "Level pedas", "min_select": 1, "max_select": 1, "options": [{"name": "Tidak pedas"}, {"name": "Sedang"}, {"name": "Pedas"}]}]},
         {"name": "Mie Goreng Tek Tek", "price": 18000, "prep_minutes": 8, "tags": ["pedas"],
          "option_groups": [{"name": "Level pedas", "min_select": 1, "max_select": 1, "options": [{"name": "Tidak pedas"}, {"name": "Sedang"}, {"name": "Pedas"}]}]},
         {"name": "Kwetiau Goreng", "price": 20000, "prep_minutes": 9, "tags": []}
       ]}
     ]}
  ]$json$::jsonb;
begin
  v_buyer := private.create_demo_user(replace(p_email_pattern, '{peran}', 'pembeli'), 'Pembeli Demo', 'pembeli', 1, '+620000000001', 'mahasiswa');
  v_owner := private.create_demo_user(replace(p_email_pattern, '{peran}', 'pemilik'), 'Pemilik Demo', 'pemilik', 2, '+620000000002', 'pekerja_kantin');
  v_staff := private.create_demo_user(replace(p_email_pattern, '{peran}', 'karyawan'), 'Karyawan Demo', 'karyawan', 3, '+620000000003', 'pekerja_kantin');
  v_admin := private.create_demo_user(replace(p_email_pattern, '{peran}', 'admin'), 'Admin Demo', 'admin', 4, '+620000000004', 'mahasiswa');
  v_teamstaf := private.create_demo_user(replace(p_email_pattern, '{peran}', 'staf'), 'Staf Demo', 'staf', 5, '+620000000005', 'mahasiswa');

  insert into public.team_members (user_id, role) values (v_admin, 'admin'), (v_teamstaf, 'staf')
  on conflict (user_id) do nothing;

  for t in select * from jsonb_array_elements(v_tenants) loop
    continue when exists (select 1 from public.tenants where slug = t ->> 'slug');
    insert into public.tenants (
      slug, name, description, kiosk_location, whatsapp, contact_person, type, managed_by, base_quota,
      order_cutoff_minutes, status, terms_accepted_at, is_sample, created_by, submitted_at, reviewed_at
    ) values (
      t ->> 'slug', t ->> 'name', t ->> 'description', 'Kantin BINUS @Bekasi (lokasi kios belum diisi)',
      '+620000000000', 'Penanggung jawab contoh', (t ->> 'type')::public.jenis_tenant, 'mandiri', 3,
      5, 'disetujui', now(), true, v_owner, now(), now()
    ) returning id into v_t;
    insert into public.tenant_members (tenant_id, user_id, role) values (v_t, v_owner, 'pemilik');
    if t ->> 'slug' = 'rustic-grill-bbq' then
      insert into public.tenant_members (tenant_id, user_id, role) values (v_t, v_staff, 'karyawan');
    end if;
    insert into public.tenant_bank (tenant_id, bank_name, account_number, account_holder)
      values (v_t, 'Bank contoh', '0000000000', 'Rekening contoh');
    for d in 1 .. 5 loop
      insert into public.tenant_hours (tenant_id, weekday, open_time, close_time) values (v_t, d, '07:00', '17:00');
    end loop;
    perform private.insert_menu(v_t, t -> 'categories');
  end loop;

  update public.app_settings set demo_mode = true where id = 1;
  perform private.seed_sample_orders();
end;
$$;

-- Mengganti alamat email akun demo setelah alamat Gmail khusus Jaminin diketahui (usulan U3).
create or replace function private.set_demo_emails(p_email_pattern text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  u record;
  v_email text;
begin
  for u in select au.id, au.raw_app_meta_data ->> 'demo_role' as demo_role from auth.users au
    join public.profiles p on p.id = au.id where p.is_demo
  loop
    v_email := lower(replace(p_email_pattern, '{peran}', u.demo_role));
    update auth.users set email = v_email where id = u.id;
    update auth.identities set identity_data = identity_data || jsonb_build_object('email', v_email)
      where user_id = u.id and provider = 'email';
  end loop;
end;
$$;
