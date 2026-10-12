import mongoose, { type Model, type Schema as MongooseSchema } from "mongoose";

/**
 * Persistence layer for the orchestrator.
 *
 * One MongoDB database holds every workspace the user has registered, the
 * sessions attached to each workspace, the transcript for every session and a
 * record for each agent run that was executed against a session.
 */

const { Schema } = mongoose;

/* -------------------------------------------------------------------------- */
/* Document types                                                              */
/* -------------------------------------------------------------------------- */

export interface WorkspaceDoc {
  name: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionDoc {
  workspace: mongoose.Types.ObjectId;
  provider: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageDoc {
  session: mongoose.Types.ObjectId;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RunDoc {
  session: mongoose.Types.ObjectId;
  provider: string;
  prompt: string;
  status: "running" | "completed" | "failed" | "cancelled";
  exitCode: number | null;
  endedAt: Date | null;
  output: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * An API key for a coding-agent provider, entered on the setup page.
 *
 * Stored verbatim in the local database so it can be injected into the agent
 * process environment at spawn time. This is a single-machine dev tool with no
 * auth in front of the API, so treat the database as the same trust boundary as
 * the user's shell environment.
 */
export interface ProviderCredentialDoc {
  provider: string;
  apiKey: string;
  createdAt: Date;
  updatedAt: Date;
}

/* -------------------------------------------------------------------------- */
/* Schemas                                                                     */
/* -------------------------------------------------------------------------- */

export const WorkspaceSchema = new Schema(
  {
    name: { type: String, required: true },
    path: { type: String, required: true },
  },
  { timestamps: true },
);

export const SessionSchema = new Schema(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    provider: { type: String, required: true },
    title: { type: String, required: true },
  },
  { timestamps: true },
);

export const MessageSchema = new Schema(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["user", "assistant", "system"],
      required: true,
    },
    content: { type: String, required: true },
  },
  { timestamps: true },
);

export const RunSchema = new Schema(
  {
    session: {
      type: Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },
    provider: { type: String, required: true },
    prompt: { type: String, required: true },
    status: {
      type: String,
      enum: ["running", "completed", "failed", "cancelled"],
      default: "running",
      required: true,
    },
    exitCode: { type: Number, default: null },
    endedAt: { type: Date, default: null },
    output: { type: String, default: "" },
  },
  { timestamps: true },
);

// One credential per provider; saving again replaces the existing key.
export const ProviderCredentialSchema = new Schema(
  {
    provider: { type: String, required: true, unique: true, index: true },
    apiKey: { type: String, required: true },
  },
  { timestamps: true },
);

/* -------------------------------------------------------------------------- */
/* Models                                                                      */
/* -------------------------------------------------------------------------- */

// Reuse already-compiled models so hot reloading the server does not throw
// `OverwriteModelError`.
function getModel<T>(name: string, schema: MongooseSchema<T>): Model<T> {
  const existing = mongoose.models[name] as Model<T> | undefined;
  return existing ?? mongoose.model<T>(name, schema);
}

export const WorkspaceModel = getModel<WorkspaceDoc>(
  "Workspace",
  WorkspaceSchema,
);
export const SessionModel = getModel<SessionDoc>("Session", SessionSchema);
export const MessageModel = getModel<MessageDoc>("Message", MessageSchema);
export const RunModel = getModel<RunDoc>("Run", RunSchema);
export const ProviderCredentialModel = getModel<ProviderCredentialDoc>(
  "ProviderCredential",
  ProviderCredentialSchema,
);
