import { LocalStore } from "@vi/storage";
const db = new LocalStore(".local/vi-race.sqlite");
try {
  db.migrate();
  console.log("Migraciones locales aplicadas; sin acceso remoto.");
} finally {
  db.close();
}
