-- Limpieza: filas de RefreshToken que quedaron con el placeholder "pending"
-- (bug de emisión en dos pasos). Una sola fila así bloqueaba todos los logins
-- con "Unique constraint failed on tokenHash". Idempotente.
DELETE FROM "RefreshToken" WHERE "tokenHash" = 'pending';
