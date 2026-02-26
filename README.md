# PVD Manager - Dashboard v2.0

**PVD Manager** es un sistema de monitoreo en tiempo real diseñado para gestionar y visualizar el estado de las estaciones de trabajo y las asignaciones de PVD (Pausas por Visualización de Datos) de los usuarios. Proporciona un panel de control completo para supervisores y agentes, asegurando el cumplimiento de los tiempos de descanso y optimizando la distribución de la actividad.

## Características Principales

* **Monitoreo en Tiempo Real**: Visualiza el estado de todas las estaciones de trabajo (Activo, PVD, Descanso, Formación, Gerencia, Suplencia) en vivo.
* **Gestión de PVD**: Control de tiempos con soporte para temporizadores en cuenta regresiva y alertas visuales/sonoras.
* **Alertas Sonoras y Visuales**: Notificaciones críticas automáticas cuando los tiempos de límite de descanso o actividad son alcanzados (vía audio `.mp3`).
* **Panel de Supervisor**: Herramientas exclusivas para el rol de supervisor, incluyendo:
  * Historial de Actividad (Activity Log).
  * Gestión de Usuarios.
  * Gestión de Estaciones.
  * Asignaciones de horarios de PVD.
* **Interfaz de TV (Modo Pantalla)**: Vista especial optimizada para monitores o televisores de sala sin requerimiento de login (`/tv`).
* **Soporte para Tema Oscuro**: Transición y persistencia de UI clara/oscura para mejor ergonomía visual.

## Tecnologías Utilizadas

### Frontend
* **[React 18](https://reactjs.org/)**: Librería para construir la interfaz de usuario.
* **[Vite](https://vitejs.dev/)**: Entorno de desarrollo rápido y optimizado para la web moderna.
* **[Tailwind CSS](https://tailwindcss.com/)**: Framework CSS de utilidad para diseño rápido y responsivo.
* **Axios**: Cliente HTTP para las peticiones a la API.

### Backend
* **[Node.js](https://nodejs.org/) + [Express](https://expressjs.com/)**: Servidor API RESTful rápido y minismalista.
* **[MySQL 8.0](https://www.mysql.com/)**: Base de datos relacional para guardar historial y métricas.
* **JWT (JSON Web Tokens)**: Sistema de autenticación seguro basado en tokens.
* **Bcrypt.js**: Encriptación de contraseñas de usuarios.

### Infraestructura / Despliegue
* **[Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)**: Contenerización de servicios (API, Web Frontend, Base de Datos, Nginx Proxy y Adminer).
* **Nginx**: Proxy inverso para unificar el puerto 80 hacia el Frontend y la API de manera transparente.

## Estructura del Proyecto

```
pvd/
├── frontend/       # Código fuente del cliente en React + Vite + Tailwind CSS
├── server/         # Código fuente de la API backend en Node.js + Express
├── db/             # Scripts de base de datos e inicializaciones (init.sql)
├── nginx/          # Archivos de configuración de Nginx (default.conf)
├── docker-compose.yml # Composición de servicios Docker para desarrollo/producción
└── README.md       # Este documento
```

## Instalación y Configuración (Docker)

La forma más sencilla de ejecutar esta aplicación es utilizando Docker Compose.

1. **Clonar el proyecto:**
   ```bash
   git clone <url-del-repositorio>
   cd pvd
   ```

2. **Configurar las Variables de Entorno:**
   Asegúrate de configurar o revisar el archivo `.env` en la raíz del proyecto para la configuración general y en la carpeta `./frontend` o `./server` si tuvieran variables específicas. Las principales variables que usa Docker son:
   * `DB_NAME`
   * `DB_USER`
   * `DB_PASS`
   * `DB_ROOT_PASSWORD`
   * `PORT_ADMINER`

3. **Construir y Levantar los Contenedores:**
   Ejecuta el siguiente comando para generar las imágenes locales y encender todos los contenedores en segundo plano:
   ```bash
   docker-compose up -d --build
   ```

4. **Acceso a la Aplicación:**
   * **Dashboard y Aplicación (Frontend + API router)**: [http://localhost](http://localhost)
   * **Base de datos (Adminer)**: `http://localhost:<PORT_ADMINER>`

## Desarrollo Local (Sin Docker)

Si deseas mantener en ejecución la Base de Datos en un contenedor pero levantar Frontend y Backend de manera local y aislada de Docker:

1. Levanta la Base de datos:
   ```bash
   docker-compose up -d db
   ```
2. Instala dependencias y corre el Backend:
   ```bash
   cd server
   npm install
   npm run dev
   ```
3. Instala dependencias y levanta el Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Licencia
Copyright (c) 2026 Yury Leonardo Oropeza Veracierto
Todos los derechos reservados.
La reproducción, distribución, modificación o uso de este software o cualquier parte del mismo, sin la autorización previa y por escrito del propietario de los derechos de autor, queda estrictamente prohibida.
ESTE SOFTWARE SE PROPORCIONA "TAL CUAL", SIN GARANTÍA DE NINGÚN TIPO, EXPRESA O IMPLÍCITA.
