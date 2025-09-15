# Guía de creación y configuración del Bot de Rescate Velasatar

## 1. Crear la aplicación y el bot en Discord

1. Ve al [Discord Developer Portal](https://discord.com/developers/applications).
2. Haz clic en **New Application**, ponle un nombre (ej. `Velasatar Rescue Bot`).
3. En el menú lateral entra en **Bot** → **Add Bot**.
4. Copia el **TOKEN** (lo usarás en `.env` como `DISCORD_TOKEN`).

⚠️ El token es secreto, trátalo como una contraseña.

---

## 2. Configurar intents y permisos

En **Bot → Privileged Gateway Intents**, marca:
- ✅ **SERVER MEMBERS INTENT** solo si necesitas info detallada de miembros (no es necesario en este bot).
- ❌ **MESSAGE CONTENT INTENT** no se usa (lo eliminamos del código).

En **OAuth2 → URL Generator** selecciona:
- Scopes: `bot`, `applications.commands`
- Bot Permissions (mínimos):
  - Send Messages
  - Create Public Threads
  - Send Messages in Threads
  - Use Slash Commands
  - (Opcional) Manage Messages (para que moderadores cierren casos).

Copia la URL generada, pégala en tu navegador e invita al bot a tu servidor.

---

## 3. Variables de entorno

Crea un fichero `.env` en la raíz del proyecto con:

```env
DISCORD_TOKEN=tu_token_de_bot
RESCUE_CHANNEL_ID=123456789012345678
MEDIC_ROLE_ID=987654321098765432
```

- `DISCORD_TOKEN`: el token copiado del portal de desarrolladores.
- `RESCUE_CHANNEL_ID`: clic derecho en el canal de rescate → **Copiar ID** (activa modo desarrollador en Discord si no lo ves).
- `MEDIC_ROLE_ID`: clic derecho en el rol @medico → **Copiar ID**.

---

## 4. Instalar dependencias

En tu proyecto Node.js LTS (22+):

```bash
npm init -y
npm install discord.js dotenv
```

---

## 5. Ejecutar el bot

```bash
npm run start
```

Si todo está bien, en la consola verás:

```
Bot conectado como Velasatar Rescue Bot#1234
Comandos registrados.
```

---

## 6. Uso en Discord

- En el servidor, escribe `/rescate solicitar`.
- Se abrirá el **formulario** (modal) con los campos: Causa, Ubicación, Tiempo, Peligros.
- El bot publicará un **embed** en el canal de rescate, mencionará a @medico, creará un **hilo** y añadirá:
  - Botones: **Tomar caso**, **Exitoso**, **Fallido**
  - Selector de sistema estelar de **Star Citizen**
- Cuando un rescatista pulse **Tomar caso**, el embed cambiará a “🚑 Rescatista en camino”.
- Al concluir, marcarán **Exitoso** o **Fallido**. El bot actualizará el embed y archivará el hilo.

---

## 7. Notas adicionales

- El estado de casos está en memoria. Si se reinicia el bot, se pierden. Tendriamos que usar una base de datos (SQLite, Postgres, etc.).

