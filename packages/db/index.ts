import mongoose from "mongoose";

/**
 * Persistence layer for the orchestrator.
 *
 * One MongoDB database holds every workspace the user has registered, the
 * sessions attached to each workspace, the transcript for every session and a
 * record for each agent run that was executed against a session.
 */

const { Schema } = mongoose;

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
    workspace: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    provider: { type: String, required: true },
    title: { type: String, required: true },
  },
  { timestamps: true },
);

export const MessageSchema = new Schema(
  {
    session: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
  },
  { timestamps: true },
);

export const RunSchema = new Schema(
  {
    session: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
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
  },
  { timestamps: true },
);

/* -------------------------------------------------------------------------- */
/* Models                                                                      */
/* -------------------------------------------------------------------------- */

// Reuse already-compiled models so hot reloading the server does not throw
// `OverwriteModelError`.
const model = <T>(name: string, schema: T) =>
  (mongoose.models[name] as mongoose.Model<unknown>) ??
  mongoose.model(name, schema as unknown as mongoose.Schema);

export const WorkspaceModel = model("Workspace", WorkspaceSchema);
export const SessionModel = model("Session", SessionSchema);
export const MessageModel = model("Message", MessageSchema);
export const RunModel = model("Run", RunSchema);
