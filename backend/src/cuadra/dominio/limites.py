"""Topes del corte vertical.

Están repetidos en la respuesta de ``GET /api/limites`` para que la interfaz
no duplique la cifra por su cuenta. 1 MiB por fichero deja margen bajo el
tope de 4,5 MB del cuerpo de una función en Vercel cuando viajan A, B y la sesión.
"""

SCHEMA_VERSION = 1
MAX_BYTES = 1_048_576
MAX_FILAS = 2_000
MAX_COLUMNAS = 40
MAX_IDENTIFICADOR = 200
MAX_DESCRIPCION = 500
MAX_MOTIVO = 500
MAX_MUESTRA = 3
MAX_DECIMALES = 4
MAX_DIGITOS_ENTEROS = 12
