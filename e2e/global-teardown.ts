import { removeTestData } from "./fixtures";
import { closeDb } from "./db";

// Runs once after all tests: removes every test account and record, so a
// run leaves the database as it found it.
export default async function globalTeardown() {
  await removeTestData();
  await closeDb();
}
