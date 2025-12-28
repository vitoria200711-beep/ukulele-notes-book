-- Adiciona a cifra completa (texto) para sincronizar entre dispositivos (PC/celular)
ALTER TABLE public.songs
ADD COLUMN IF NOT EXISTS cifra TEXT;


