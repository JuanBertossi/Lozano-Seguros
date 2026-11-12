# Instalar el backend en Supabase

**Estado de la migración:** el panel ya no usa el estado completo en memoria ni `dashboard-runtime.js`. Todas las pantallas leen y escriben con los procedimientos `public.agencia_*`; la revisión vigente se obtiene con `agencia_sesion`. Los scripts no se probaron contra una base real: ejecutalos primero en un proyecto de prueba.

1. Ejecutá los scripts en el SQL Editor, en este orden:
   1. `00-lozano-supabase.sql` (solo en una instalación nueva; no lo ejecutes de nuevo sobre una existente).
   2. `01-actualizar-roles.sql`. Renombra el esquema anterior `lozano` a `agencia`, conserva los datos y convierte cada perfil anterior a su rol equivalente.
   3. `002-procedimientos.sql`.
   4. `03-panel.sql`. Las lecturas y operaciones de cada pantalla; también retira las funciones heredadas que el panel ya no usa.
   5. `04-permisos.sql`. Único lugar donde se dan permisos de ejecución (solo `authenticated`, y solo sobre las funciones públicas `agencia_*`). Sin este script la API responde `42501`. Volvé a ejecutarlo cada vez que agregues una función.
   6. `05-usuarios.sql`. Crea las cuentas `emanuel` y `valeria` (contraseña `123`, rol administrador) en Authentication y en `agencia.perfiles`. Es solo para probar: cambiá las contraseñas desde Authentication → Users antes de usar datos reales. Si ya creaste cuentas a mano (pasos 2 y 3 de abajo), podés omitirlo.

2. En **Authentication → Users → Add user → Create new user**, elegí un nombre de usuario en minúsculas con letras, números, guiones o guiones bajos. Usá el alias `usuario@lozano.example.com` en el campo Email, ingresá la contraseña y marcá **Auto Confirm User**. Por ejemplo, para el usuario `emanuel`, el alias es `emanuel@lozano.example.com`. Copiá el UUID que le asigna Supabase Auth. Si ya existe una cuenta con un correo distinto, actualizá su correo al alias desde la administración de Auth para conservar el UUID y el perfil.
3. Habilitá cada cuenta con el siguiente SQL. Usá `administrador` para todas las cuentas actuales.

```sql
insert into agencia.perfiles (id, nombre, rol)
values ('UUID_DE_AUTH'::uuid, 'Nombre de la persona', 'administrador');
```

Los roles disponibles son `administrador` y `empleado`. La restauración de respaldos y el reinicio requieren `administrador`. Creá las cuentas actuales como administradores. Para retirar acceso, cambiá `activo` a `false` en `agencia.perfiles`.

## Arrancar la aplicación

Completá `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en `.env`. Ejecutá `pnpm install` y `pnpm run dev`, o reiniciá Vite si ya estaba corriendo. Ingresá con el nombre de usuario, por ejemplo `emanuel`, y la contraseña de la cuenta habilitada. La sesión permanece en memoria hasta que cierres o recargues la página. La gestión de contraseñas de cuentas con alias se hace desde la administración de Auth.

## Contrato del frontend

Llamá a las funciones RPC con el token de acceso de la sesión de Supabase Auth.

| Función | Parámetros y resultado |
| --- | --- |
| `agencia_sesion` | Devuelve `{revision, perfil}`. Es lo primero que lee el panel; cada pantalla incluye la revisión en su consulta y se vuelve a pedir sola cuando cambia. |
| `agencia_*_listar`, `*_formulario`, `*_obtener`, `agencia_inicio`, `agencia_ajustes`… | Lecturas por pantalla. Reciben `p_revision` y devuelven solo lo que esa pantalla muestra. |
| `agencia_*_operar`, `*_guardar`, `agencia_registrar_cobro`… | Operaciones. Reciben `p_revision` y `p_operacion` (un UUID por operación) y devuelven la nueva revisión. |
| `agencia_respaldo`, `agencia_restaurar_verificado`, `agencia_reiniciar` | Respaldo, restauración validada (administrador) y reinicio. |

Volvé a leer el estado si el servidor devuelve `40001`. Al reintentar una solicitud cuyo resultado se desconoce, reenviá el mismo UUID, la revisión original y el mismo contenido. El servidor devuelve la revisión de la operación original si ya la había registrado.

| Flujo del HTML | Datos persistidos |
| --- | --- |
| Socios, números fijos y planes de Quini | `socios` |
| Seguros y cuotas | `seguros` |
| Quini manual y automático, sorteos especiales y exclusiones | `q6`, `q6esp`, `q6skip` |
| Lotería, fracciones y ofertas | `sorteos`, `lot`, `ofertas` |
| Quiniela y Rifa Devoto | `quiniela`, `rifas` |
| Cobros, anulaciones, abonos, cheques y saldo a favor | `cobros` y los registros afectados, en el mismo guardado |
| Planilla, concursos y pagos de Toto Ortega | `toto` |
| Precios, calendarios y preferencias de WhatsApp | `conf` |
| Perfiles y actividad | `usuarios`, `usuariosBaja` y `log`, generados por el servidor |

Las tablas conservan un registro por entidad y guardan sus campos en JSONB. Las cuotas, los cobros, los saldos y los totales se calculan en SQL y el servidor genera el historial a partir de los cambios y de la cuenta autenticada.

Para trasladar registros de la versión local, descargá un respaldo en esa versión y cargalo desde Ajustes con una cuenta administradora. La restauración copia los datos de negocio. Los perfiles y el historial del servidor se gestionan por separado.
