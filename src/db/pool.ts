import { Pool } from "pg";
import { createPoolConfig } from "../config/database";

export const pool = new Pool(createPoolConfig());
