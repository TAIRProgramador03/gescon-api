# Sistema Gestor de Contratos | Backend

API REST para la gestión de flota vehicular y contratos empresariales. Provee endpoints para administrar clientes, contratos, vehículos, operaciones de leasing, documentos y reportes. Incluye autenticación JWT, almacenamiento en AWS S3 y comunicación en tiempo real via WebSockets.

---

## Tabla de Contenidos

- [Requisitos](#requisitos)
- [Stack Tecnológico](#stack-tecnológico)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Variables de Entorno](#variables-de-entorno)
- [Instalación y Ejecución](#instalación-y-ejecución)
- [Endpoints](#endpoints-principales)

---

## Requisitos Previos

- **Node.js** v18 o superior
- **npm** v9 o superior
- **Driver ODBC IBM i (AS/400)** instalado en el sistema
- Acceso a servidor **IBM i** con credenciales ODBC
- Cuenta **AWS S3** con bucket configurado
- *(Opcional)* **nodemon** para desarrollo con hot reload
- *(Opcional)* **Docker** para ejecución en contenedor

---

## Stack Tecnológico

| Categoría | Tecnología |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Base de datos | IBM i (AS/400) via ODBC con connection pooling |
| Autenticación | JWT (`jsonwebtoken`, `bcryptjs`) |
| Comunicación en tiempo real | WebSockets (`ws`) |
| Almacenamiento de archivos | AWS S3 (`@aws-sdk/client-s3`) |
| Reportes | ExcelJS |
| Upload de archivos | Multer |

---

## Estructura del Proyecto

```
gescon-api/
├── server.js                   # Entry point — Express + WebSocket
├── package.json
├── .env                        # Variables de entorno (no versionar)
├── .env.example                # Plantilla de variables de entorno
├── docker/
│   └── ibm-iaccess.deb         # Driver ODBC IBM i para Docker
├── public/
│   └── pdf/                    # Almacenamiento local de PDFs
└── src/
    ├── shared/
    │   ├── conf.js             # Configuración global (DB, pool)
    │   ├── connect.js          # Pool de conexiones ODBC
    │   ├── utils.js            # Utilidades compartidas
    │   ├── middleware/
    │   │   ├── jwt-valid.js    # Validación de tokens JWT
    │   │   └── user-valid.js   # Validación de usuario
    │   ├── service/
    │   │   └── aws-s3.js       # Operaciones con AWS S3
    │   └── seed/
    │       └── migrateS3.js    # Script de migración a S3
    └── app/
        ├── auth/               # Login y autenticación
        ├── client/             # Gestión de clientes
        ├── contract/           # Administración de contratos
        ├── document/           # Gestión de documentos
        ├── file/               # Upload/download S3
        ├── leasing/            # Operaciones de leasing
        ├── model/              # Modelos de vehículos
        ├── operation/          # Seguimiento de operaciones
        ├── report/             # Generación de reportes Excel
        ├── user/               # Usuarios y permisos
        └── vehicle/            # Gestión de flota vehicular
```

Cada módulo en `src/app/` contiene:
- `<modulo>.controller.js` — lógica de negocio y queries
- `<modulo>.routes.js` — definición de rutas Express

---

## Variables de Entorno

Copiar `.env.example` a `.env` y completar los valores:

```env
# Base de datos IBM i
IP_ODBC_BD=       # IP del servidor IBM i
IP_ODBC=          # IP conexión ODBC
DB_USER=          # Usuario de base de datos
DB_PASSWORD=      # Contraseña de base de datos
SCHEMA_BD=        # Esquema (biblioteca) de base de datos

# Aplicación
PORT=             # Puerto del servidor (default: 3000)
SECRET_KEY=       # Clave secreta para firmar JWT
IP_LOCAL=         # IP local permitida en CORS

# AWS S3
AWS_BUCKET_NAME=  # Nombre del bucket
AWS_ACCESS_KEY=   # Access key ID
AWS_SECRET_KEY=   # Secret access key
```

---

## Ejecución

### Modo Desarrollo

Requiere `nodemon` (incluido en devDependencies). Reinicia el servidor automáticamente ante cambios.

```bash
npm install
npm run dev
```

Servidor disponible en `http://localhost:3000`

### Modo Producción

```bash
npm install --omit=dev
npm start
```

Servidor disponible en `http://localhost:<PORT>`

### Con Docker

**Desarrollo:**
```bash
docker build -f Dockerfile.dev -t gescon-api-dev .
docker run -p 3000:3000 gescon-api-dev
```

**Producción:**
```bash
docker build -f Dockerfile -t gescon-api .
docker run -p 3005:3005 gescon-api
```

O desde la raíz del proyecto completo:
```bash
# Desarrollo
docker-compose -f docker-compose.dev.yml up

# Producción
docker-compose up
```

---

## Endpoints Principales

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Health check del servidor |
| `WS` | `/ws/heartbeat` | Conexión WebSocket |
| `POST` | `/api/auth/login` | Autenticación de usuario |

---

## Scripts Disponibles

```bash
npm run dev           # Desarrollo con hot reload (nodemon)
npm start             # Producción
```
