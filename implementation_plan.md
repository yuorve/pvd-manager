# User Management Feature Implementation Plan

## Goal Description
The user wants an option to create new users. This feature should be restricted to users with the `SUPERVISOR` role (e.g., admin).
We will implement:
1.  **Backend**: A new API endpoint `POST /api/users` to create users with password hashing.
2.  **Frontend**: A new view `UserManagement.jsx` accessible from the Supervisor dashboard to list existing users and a form to add new ones.

## Proposed Changes

### Backend (`server/index.js`)
-   Add `POST /api/users` endpoint.
    -   Middleware: `authenticateToken` + Role Check (`SUPERVISOR`).
    -   Body: `username`, `password`, `role`.
    -   Logic: Hash password with bcrypt, insert into `users` table.
-   Add `GET /api/users` endpoint.
    -   Middleware: `authenticateToken` + Role Check.
    -   Logic: Return list of users.
-   Add `DELETE /api/users/:id` endpoint.
    -   Middleware: `authenticateToken` + Role Check (`SUPERVISOR`).
    -   Logic: Check if user is 'admin', if so return 403. Else delete from `users`.
-   **[NEW]** Add `POST /api/stations` endpoint.
    -   Middleware: `authenticateToken` + Role Check (`SUPERVISOR`).
    -   Body: `ip` (Address IP).
    -   Logic: Insert into `stations` table (stateID=0 by default).
    -   Validation: Check regex for IP format? Or just unique constraint.
-   **[NEW]** Add `DELETE /api/stations/:id` endpoint.
    -   Middleware: `authenticateToken` + Role Check (`SUPERVISOR`).
    -   Logic: Delete from `stations`.
-   **[NEW]** Add `GET /api/assignments` endpoint.
    -   Middleware: `authenticateToken` + Role Check (`SUPERVISOR`).
    -   Query Params: `date` (optional, default today).
    -   Logic: Select from `pvd_assignments` order by date, window_hour, start_minute.
-   **[NEW]** Add `POST /api/change-password` endpoint.
    -   Middleware: `authenticateToken`.
    -   Input: `currentPassword`, `newPassword`.
    -   Logic: Verify old pass, hash new pass, update DB.

#### [MODIFY] [server/index.js](file:///wsl.localhost/Debian/home/yuorve/projects/pvd/server/index.js)

### Frontend (`frontend/src`)
-   Create `UserManagement.jsx`.
    -   Fetch and display list of users.
    -   Form to create a new user (Username, Password, Role).
    -   Delete button for each user (except admin).
-   **[NEW]** Create `StationManagement.jsx`.
    -   Fetch and display list of stations (`GET /api/stations`).
    -   Form to add new station (IP Address).
        -   Helper to auto-suggest next IP? Or just manual input.
    -   Delete button for each station.
-   **[NEW]** Create `PVDAssignments.jsx`.
    -   Fetch and display list of assignments.
    -   Filter by date?
    -   Table view: Operator, Date, Hour, Minute.
-   **[NEW]** Create `ChangePassword.jsx`.
    -   Modal form: Current Password, New Password, Confirm New Password.
-   Modify `App.jsx`.
    -   Add "Gestionar Estaciones" button in Supervisor menu.
    -   Add "Ver Asignaciones" button in Supervisor menu.
    -   Add `viewMode === 'stations'` and `viewMode === 'assignments'` support.
    -   **[NEW]** Add interaction to User Header (click to open Change Password modal).

#### [NEW] [frontend/src/StationManagement.jsx](file:///wsl.localhost/Debian/home/yuorve/projects/pvd/frontend/src/StationManagement.jsx)
#### [NEW] [frontend/src/PVDAssignments.jsx](file:///wsl.localhost/Debian/home/yuorve/projects/pvd/frontend/src/PVDAssignments.jsx)
#### [NEW] [frontend/src/ChangePassword.jsx](file:///wsl.localhost/Debian/home/yuorve/projects/pvd/frontend/src/ChangePassword.jsx)
#### [MODIFY] [frontend/src/App.jsx](file:///wsl.localhost/Debian/home/yuorve/projects/pvd/frontend/src/App.jsx)
-   Modify `App.jsx`.
    -   Add a new button in the header/menu for "Gestionar Usuarios" (only for Supervisors).
    -   Add state `viewMode` option for `'users'`.
    -   Render `UserManagement` component when `viewMode === 'users'`.

#### [NEW] [frontend/src/UserManagement.jsx](file:///wsl.localhost/Debian/home/yuorve/projects/pvd/frontend/src/UserManagement.jsx)
#### [MODIFY] [frontend/src/App.jsx](file:///wsl.localhost/Debian/home/yuorve/projects/pvd/frontend/src/App.jsx)

## Verification Plan

### Manual Verification
1.  **Rebuild Backend**: `docker-compose up -d --build api`.
2.  **Login as Admin**: Use `admin`/`admin123`.
3.  **Navigate**: Click the new "Usuarios" button in the header.
4.  **Create User**:
    -   Enter username "testuser", password "1234", role "OPERATOR".
    -   Click Create.
    -   Verify user appears in the list.
5.  **Login as New User**:
    -   Logout.
    -   Login with "testuser"/"1234".
    -   Verify successful login.
