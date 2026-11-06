import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const attempts = sqliteTable("attempts", {
 id:text("id").primaryKey(), player:text("player").notNull(), started:integer("started").notNull(),
 finished:integer("finished"), nickname:text("nickname"), reaction:integer("reaction"), day:text("day")
}, t=>[index("attempts_player").on(t.player,t.started),index("attempts_day").on(t.day,t.reaction)]);
