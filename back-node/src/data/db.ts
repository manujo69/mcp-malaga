import { DuckDBInstance } from '@duckdb/node-api';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PARQUET_PATH =
  process.env.DATA_PATH ??
  path.resolve(__dirname, './malaga_places.parquet');

let _instance: DuckDBInstance | null = null;

export async function getDb(): Promise<DuckDBInstance> {
  if (!_instance) {
    _instance = await DuckDBInstance.create(':memory:');
  }
  return _instance;
}
