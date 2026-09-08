-- Evidencia por enlace: un Attachment puede ser una URL en lugar de un archivo.
ALTER TABLE "Attachment" ADD COLUMN "url" TEXT;
