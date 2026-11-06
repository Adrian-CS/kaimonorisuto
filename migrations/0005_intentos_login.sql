-- Intentos fallidos de entrar (o de unirse con un código de invitación), para
-- frenar a quien pruebe contraseñas o códigos a lo bruto. Solo se guardan los
-- de la última hora: se borran solos al consultar.
CREATE TABLE auth_failures (
  key TEXT    NOT NULL,  -- "email:<email>", "ip:<ip>" o "code:<ip>"
  at  INTEGER NOT NULL
);
CREATE INDEX idx_auth_failures ON auth_failures(key, at);
