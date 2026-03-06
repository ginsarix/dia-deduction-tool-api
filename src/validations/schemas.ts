import { createSelectSchema, createInsertSchema, createUpdateSchema } from "drizzle-zod";
import { projectTable } from "../db/schemas/project.js";
import { workerTable } from "../db/schemas/worker.js";
import { connectionTable } from "../db/schemas/connection.js";
import { hourDefinitionTable } from "../db/schemas/hour-definition.js";

export const projectSelectSchema = createSelectSchema(projectTable);
export const projectInsertSchema = createInsertSchema(projectTable);
export const projectUpdateSchema = createUpdateSchema(projectTable);

export const workerSelectSchema = createSelectSchema(workerTable);
export const workerInsertSchema = createInsertSchema(workerTable);
export const workerUpdateSchema = createUpdateSchema(workerTable);


export const connectionSelectSchema = createSelectSchema(connectionTable);
export const connectionInsertSchema = createInsertSchema(connectionTable);
export const connectionUpdateSchema = createUpdateSchema(connectionTable);

export const hourDefinitionSelectSchema =
  createSelectSchema(hourDefinitionTable);
export const hourDefinitionInsertSchema =
  createInsertSchema(hourDefinitionTable);
export const hourDefinitionUpdateSchema =
  createUpdateSchema(hourDefinitionTable);
