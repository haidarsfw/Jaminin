-- Data awal untuk database lokal (supabase db reset). Proyek online diisi dengan perintah yang sama lewat konektor.
insert into private.config (key, value) values ('functions_url', 'http://kong:8000/functions/v1')
on conflict (key) do update set value = excluded.value;

select private.seed_demo('demo+{peran}@jaminin.test');
