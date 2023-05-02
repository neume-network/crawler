/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async function (knex) {
  await knex.schema.createTable("tracks", (table) => {
    table.string("version").notNullable();
    table.string("title").notNullable();
    table.string("duration");

    table.string("artist_version").notNullable();
    table.string("artist_name").notNullable();
    table.string("artist_address").nullable();

    table.string("platform_name").index().notNullable();
    table.string("platform_version").notNullable();
    table.string("platform_uri").notNullable();

    table.string("erc721_version").notNullable();
    table.string("erc721_address").notNullable();
    table.string("erc721_uri");
    table.json("erc721_metadata");

    table.integer("lastUpdatedAt").index().notNullable();
    table.string("uid");
    table.primary("uid");
  });

  await knex.schema.createTable("manifestations", (table) => {
    table.string("version").notNullable();
    table.string("uri").notNullable();
    table.string("mimetype").notNullable();

    table.string("uid");
    table.foreign(["uid"]).references(["uid"]).on("tracks");
    table.primary(["uid", "uri"]);
  });

  await knex.schema.createTable("tokens", (table) => {
    table.string("id").notNullable();
    table.string("uri");
    table.json("metadata");

    table.string("uid");
    table.foreign(["uid"]).references(["uid"]).on("tracks");
    table.primary(["uid", "id"]);
  });

  await knex.schema.createTable("owners", (table) => {
    table.integer("blockNumber").notNullable();
    table.string("from").notNullable();
    table.string("to").notNullable();
    table.string("transactionHash").notNullable();
    table.string("alias");

    table.string("uid");
    table.string("id");

    table.foreign(["uid", "id"]).references(["uid", "id"]).on("tokens");
    table.primary(["uid", "id", "transactionHash", "to"]);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async function (knex) {
  await knex.schema.dropTable("owners");
  await knex.schema.dropTable("tokens");
  await knex.schema.dropTable("manifestations");
  await knex.schema.dropTable("tracks");
};
