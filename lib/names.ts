/**
 * Mismo nombre sin distinguir mayúsculas, también con tildes («Ácido» y
 * «ácido»). SQLite solo sabe hacerlo con ASCII, así que se compara aquí.
 */
export function sameName(a: string, b: string) {
  const norm = (s: string) => s.trim().normalize("NFC").toLocaleLowerCase();
  return norm(a) === norm(b);
}
