import "reflect-metadata";
import { DataSource } from "typeorm";
import { createDataSourceOptions } from "../config/database";

export const AppDataSource = new DataSource(createDataSourceOptions());

export async function initializeDataSource(): Promise<DataSource> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  return AppDataSource;
}
