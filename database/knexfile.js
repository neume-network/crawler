import path from "path";

const config = {
  client: "better-sqlite3",
  connection: {
    // path.resolve means that a .sqlite3 will be created at the current working directory
    filename: path.resolve("./data/neume.sqlite3"),
  },
  useNullAsDefault: true,
};

export default config;
