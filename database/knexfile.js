import Knex from "knex";
import path from "path";

/**
 * @type {Knex.Knex.Config}
 */
const config = {
  client: "better-sqlite3",
  connection: {
    // path.resolve means that a .sqlite3 will be created at the current working directory
    filename: path.resolve("./data/neume.sqlite3"),
  },
  // Under heavy load acquiring connection may require more time
  acquireConnectionTimeout: 120_000,
  useNullAsDefault: true,
  pool: {
    afterCreate: function (conn, done) {
      conn.pragma("journal_mode = WAL");
      done();
    },
  },
};

export default config;
