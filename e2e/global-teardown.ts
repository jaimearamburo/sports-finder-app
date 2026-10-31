import { removeTestData } from "./fixtures";
import { closeDb } from "./db";

// Runs once after all tests: removes every test record.
export default async function globalTeardown() {
  await removeTestData();
  await closeDb();
}
