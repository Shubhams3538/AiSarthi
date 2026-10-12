# db

Mongoose schemas and models for aiSarthi workspaces, sessions, messages, runs, and
provider credentials. Import from `db/client`. The backend owns the connection;
this package defines persistence without starting a server.

Run output is retained on completion. Credentials stay in the local MongoDB and
are deliberately omitted from wire DTOs. See the root README for the local trust
boundary and setup commands.
