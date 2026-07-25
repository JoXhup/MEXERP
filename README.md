# MEXERP Discord Bot

Sistema profesional de tickets para Discord construido con **TypeScript + Bun + Discord.js v14 + MongoDB**.

---

## Requisitos

- [Bun](https://bun.sh) >= 1.0
- Node.js >= 18 (para compatibilidad con algunas librerias)
- MongoDB Atlas o instancia local
- Bot de Discord con intents: `GUILDS`, `GUILD_MESSAGES`, `GUILD_MEMBERS`, `MESSAGE_CONTENT`

---

## Instalacion

```bash
# 1. Clonar / descomprimir el proyecto
cd MEXERP

# 2. Instalar dependencias
bun install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 4. Registrar slash commands
bun run deploy

# 5. Iniciar el bot
bun run start

# Modo desarrollo (auto-restart)
bun run dev
```

---

## Configuracion (.env)

| Variable | Descripcion |
|---|---|
| `TOKEN` | Token del bot de Discord |
| `CLIENT_ID` | ID de la aplicacion del bot |
| `GUILD_ID` | ID del servidor de Discord |
| `MONGO_URI` | URI de conexion a MongoDB |
| `CATEGORY_ID` | ID de la categoria donde se crean los tickets |
| `ADMIN_ROLE_ID` | ID del rol de administrador/staff |
| `PANEL_CHANNEL_ID` | ID del canal donde se envia el panel |
| `LOG_CHANNEL_ID` | (Opcional) ID del canal de logs |
| `TRANSCRIPT_CHANNEL_ID` | (Opcional) ID del canal de transcripciones |

---

## Categorias de tickets

| Categoria | Descripcion | Campos del modal |
|---|---|---|
| Reportar | Reportar a un usuario | Usuario, motivo, pruebas |
| Reportar a staff | Reportar moderacion | Staff, incidente, fecha, pruebas |
| Peticion de rol | Solicitar un rol | Rol, motivo, pruebas |
| Reporte invisible | Reporte confidencial | Situacion, involucrados, urgencia |
| Remover rol | Retirar un rol | Rol, razon |
| Compras reales | Gestionar compras | Tipo, monto, comprobante, expectativa |
| Reclamar sorteos | Reclamar premio | Sorteo, premio, prueba |
| Empresas/faccion | Crear organizacion | Nombre, tipo, descripcion, miembros |
| Otro | Consultas generales | Asunto, descripcion |
| Dudas en general | Preguntas sin respuesta | Pregunta, contexto |

---

## Comandos

| Comando | Descripcion | Permiso |
|---|---|---|
| `/panel` | Envia/actualiza el panel de tickets | Admin |
| `/stats` | Muestra estadisticas del staff | Admin |

---

## Estructura del proyecto

```
MEXERP/
├── src/
│   ├── index.ts              # Entrada principal
│   ├── deploy.ts             # Registro de slash commands
│   ├── config.ts             # Configuracion central
│   ├── types/
│   │   └── index.ts          # Tipos TypeScript
│   ├── constants/
│   │   └── categories.ts     # Definicion de todas las categorias
│   ├── models/
│   │   ├── Ticket.ts         # Modelo MongoDB de ticket
│   │   ├── StaffStats.ts     # Estadisticas del staff
│   │   └── PanelMessage.ts   # Panel persistente
│   ├── commands/
│   │   ├── panel.ts          # /panel
│   │   └── stats.ts          # /stats
│   ├── events/
│   │   ├── ready.ts          # Bot listo
│   │   └── interactionCreate.ts # Router de interacciones
│   ├── handlers/
│   │   ├── buttonHandler.ts       # Claim, Close, Transcript, etc.
│   │   ├── modalHandler.ts        # Creacion de tickets
│   │   ├── secondaryModalHandler.ts # Rename modal
│   │   └── selectMenuHandler.ts   # Seleccion de categoria
│   └── utils/
│       ├── components.ts     # Constructores de Containers v2
│       ├── modals.ts         # Constructores de modales
│       ├── transcript.ts     # Generador HTML de transcripciones
│       ├── ticketHelper.ts   # Creacion de canales
│       ├── cooldown.ts       # Sistema anti-spam
│       └── logger.ts         # Logs al canal
├── transcripts/
│   └── generated/            # Transcripciones HTML generadas
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## Caracteristicas

- **Components v2** — Containers con Thumbnail del bot, TextDisplay y Separators
- **Modales por categoria** — Cada tipo de ticket tiene campos especificos
- **Numeracion automatica** — ticket-0001, ticket-0002, ...
- **Sistema de cooldowns** — Anti-spam en creacion de tickets
- **Transcripciones HTML** — Diseño futurista negro/morado
- **Logs** — Cada accion se registra en el canal de logs
- **Estadisticas del staff** — Ranking por tickets gestionados
- **Prioridades** — Baja / Media / Alta / Critica
- **Permisos granulares** — Solo el propietario y el staff pueden ver sus tickets
- **Panel persistente** — El bot recuerda el mensaje del panel para actualizarlo

---

## Intents requeridos del portal de Discord

En [Discord Developer Portal](https://discord.com/developers/applications):
- `PRESENCE INTENT` — No necesario
- `SERVER MEMBERS INTENT` — **Requerido**
- `MESSAGE CONTENT INTENT` — **Requerido**
