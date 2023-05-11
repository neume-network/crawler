import Knex from "knex";
import path from "path";
import fs from "fs";
import { URL } from "url";

import config from "./knexfile.js";

// We don't use knex CLI because we need access to __dirname + '/migrations'
export default async function runMigration(type) {
  const knex = Knex.default(config);
  const dir = path.dirname(config.connection.filename);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const fn = knex.migrate[type];
  await fn.call(knex.migrate, {
    directory: new URL("./migrations", import.meta.url).pathname,
  });

  await knex.destroy();
}
