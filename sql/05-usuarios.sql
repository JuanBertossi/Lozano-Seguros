-- Cuentas de acceso: Emanuel y Valeria, ambas con contraseña 123 y rol administrador.
-- Ingresan con el nombre de usuario (emanuel / valeria); el panel arma el correo usuario@lozano.example.com.
-- Ejecutar al final, después de 00, 01, 002, 03 y 04. Se puede repetir: si la cuenta ya existe NO se
-- toca su contraseña (solo se vuelve a asegurar el perfil activo y administrador).
-- ADVERTENCIA: 123 es una contraseña de prueba y estas cuentas son administradoras. Cambiala desde
-- Authentication → Users antes de cargar datos reales o exponer el proyecto.
begin;

do $$
declare
  cuenta record;
  correo text;
  id_cuenta uuid;
begin
  for cuenta in
    select * from (values ('emanuel', 'Emanuel Lozano'), ('valeria', 'Valeria')) as c(usuario, nombre)
  loop
    correo := cuenta.usuario || '@lozano.example.com';
    select id into id_cuenta from auth.users where email = correo;

    if id_cuenta is null then
      id_cuenta := gen_random_uuid();
      -- Los campos *_token van vacíos (no nulos): Supabase Auth falla al iniciar sesión si son nulos.
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000', id_cuenta, 'authenticated', 'authenticated', correo,
        extensions.crypt('123', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(),
        '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      values (
        gen_random_uuid(), id_cuenta, id_cuenta::text,
        jsonb_build_object('sub', id_cuenta::text, 'email', correo, 'email_verified', true),
        'email', now(), now(), now()
      );
    end if;

    insert into agencia.perfiles (id, nombre, rol, activo)
    values (id_cuenta, cuenta.nombre, 'administrador', true)
    on conflict (id) do update set nombre = excluded.nombre, rol = excluded.rol, activo = true;
  end loop;
end $$;

commit;
