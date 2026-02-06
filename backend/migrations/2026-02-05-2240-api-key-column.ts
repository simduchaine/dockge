import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    return knex.schema.alterTable("user", (table) => {
        table.string("api_key", 255).nullable().unique();
    });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.alterTable("user", (table) => {
        table.dropColumn("api_key");
    });
}
