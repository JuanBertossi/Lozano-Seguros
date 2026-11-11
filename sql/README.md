# Instalar el backend en Supabase

**Estado de la migración:** `002-procedimientos.sql` todavía está incompleto y no debe ejecutarse. Los cobros, las anulaciones y otros cálculos siguen en el frontend; no está comprobada la equivalencia de todos los flujos con la maqueta. Los archivos `00` y `01` solo ofrecen persistencia del estado actual, no las reglas de negocio completas.

1. Para una instalación nueva, ejecutá `00-lozano-supabase.sql` y luego `01-actualizar-roles.sql` en el SQL Editor. Si ya instalaste `00`, ejecutá solo `01`. La actualización renombra el esquema anterior `lozano` a `agencia`, conserva los datos y convierte cada perfil anterior a su rol equivalente. No ejecutes el archivo 00 nuevamente sobre una instalación existente.
2. En **Authentication → Users → Add user → Create new user**, elegí un nombre de usuario en minúsculas con letras, números, guiones o guiones bajos. Usá el alias `usuario@lozano.example.com` en el campo Email, ingresá la contraseña y marcá **Auto Confirm User**. Por ejemplo, para el usuario `emanuel`, el alias es `emanuel@lozano.example.com`. Copiá el UUID que le asigna Supabase Auth. Si ya existe una cuenta con un correo distinto, actualizá su correo al alias desde la administración de Auth para conservar el UUID y el perfil.
3. Habilitá cada cuenta con el siguiente SQL. Usá `administrador` para todas las cuentas actuales.

```sql
insert into agencia.perfiles (id, nombre, rol)
values ('UUID_DE_AUTH'::uuid, 'Nombre de la persona', 'administrador');
```

Los roles disponibles son `administrador` y `empleado`. Ambos pueden consultar y editar los registros de la agencia. La función de restauración comprueba el rol `administrador`, pero el guardado normal todavía permite reemplazar todas las colecciones, de modo que esa diferencia no es una protección efectiva frente a un cliente modificado. Hasta implementar operaciones específicas con validación en el servidor, habilitá únicamente usuarios de confianza. Para retirar acceso, cambiá `activo` a `false` en `agencia.perfiles`.

## Arrancar la aplicación

Completá `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en `.env`. Ejecutá `pnpm install` y `pnpm run dev`, o reiniciá Vite si ya estaba corriendo. Ingresá con el nombre de usuario, por ejemplo `emanuel`, y la contraseña de la cuenta habilitada. La sesión permanece en memoria hasta que cierres o recargues la página. La gestión de contraseñas de cuentas con alias se hace desde la administración de Auth.

## Contrato del frontend

Llamá a las funciones RPC con el token de acceso de la sesión de Supabase Auth.

| Función | Parámetros y resultado |
| --- | --- |
| `agencia_leer` | Devuelve `{revision, estado, perfil}`. Cada perfil incluye `rol`. El estado usa las claves de negocio del HTML. |
| `agencia_guardar` | Recibe `p_revision`, `p_operacion` (un UUID por guardado) y `p_estado` (la configuración y todas las colecciones). Devuelve la nueva revisión. |
| `agencia_restaurar` | Usa los mismos parámetros. Requiere perfil administrador y aplica el estado de un respaldo o de un reinicio. |

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

Las tablas conservan un registro por entidad y guardan sus campos en JSONB. El frontend actual todavía calcula cuotas, cobros y saldos; SQL valida la estructura de persistencia y aplica los cambios juntos. El servidor genera el historial a partir de los cambios y de la cuenta autenticada.

Para trasladar registros de la versión local, descargá un respaldo en esa versión y cargalo desde Ajustes con una cuenta administradora. La restauración copia los datos de negocio. Los perfiles y el historial del servidor se gestionan por separado.
