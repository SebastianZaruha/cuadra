"""Textos que ve quien reconcilia. El código estable es ``codigo``; la frase es el contrato visible."""


def cantidad_invalida(raw: str) -> str:
    return (
        f"La cantidad «{raw}» no es válida. Usa un entero o decimal con punto, "
        "signo menos opcional, sin separador de miles y con hasta 4 decimales."
    )


def cantidad_vacia() -> str:
    return "La cantidad está vacía."


def formula(caracter: str) -> str:
    nombre = {
        "=": "=",
        "+": "+",
        "-": "-",
        "@": "@",
        "\t": "tabulación",
        "\r": "retorno de carro",
        "\n": "salto de línea",
    }[caracter]
    return (
        f"La celda empieza por un carácter de fórmula ({nombre}). "
        "Corrígelo en el origen; Cuadra no lo interpreta."
    )


def identificador_vacio() -> str:
    return "El identificador está vacío."


def identificador_largo() -> str:
    return "El identificador supera 200 caracteres."


def descripcion_larga() -> str:
    return "La descripción supera 500 caracteres."


def motivo_largo(identificador: str) -> str:
    return f"El motivo de «{identificador}» supera 500 caracteres."


def identificador_duplicado(identificador: str, fichero: str, filas: list[int]) -> str:
    nums = ", ".join(str(fila) for fila in filas)
    return (
        f"Identificador «{identificador}» duplicado en el fichero {fichero} "
        f"(filas {nums}). No se fusionan ni se comparan."
    )


def clave_bloqueada(fichero_otro: str, identificador: str, detalle: str) -> str:
    return (
        f"No se compara: en el fichero {fichero_otro} la clave «{identificador}» "
        f"está bloqueada ({detalle})."
    )


def detalle_duplicado(filas: list[int]) -> str:
    nums = ", ".join(str(fila) for fila in filas)
    return f"duplicado en las filas {nums}"


def detalle_errores(filas: list[int]) -> str:
    if len(filas) == 1:
        return f"errores en la fila {filas[0]}"
    nums = ", ".join(str(fila) for fila in filas)
    return f"errores en las filas {nums}"


def delimitador_ambiguo(fichero: str, presentes: set[str] | None = None) -> str:
    if not presentes or presentes == {",", ";"}:
        detalle = "coma y punto y coma"
    else:
        orden = [
            nombre
            for simbolo, nombre in ((",", "coma"), (";", "punto y coma"), ("\t", "tabulador"))
            if simbolo in presentes
        ]
        detalle = orden[0] if len(orden) == 1 else ", ".join(orden[:-1]) + " y " + orden[-1]
    return (
        f"El fichero {fichero} usa {detalle} fuera de comillas. "
        "Elige el delimitador; Cuadra no lo adivina."
    )


def delimitador_ausente(fichero: str) -> str:
    return (
        f"No se detectó coma, punto y coma ni tabulador en la cabecera del fichero {fichero}."
    )


def delimitador_no_coincide(elegido: str, fichero: str) -> str:
    visible = {",": "coma", ";": "punto y coma", "\t": "tabulador"}.get(elegido, elegido)
    return (
        f"Elegiste {visible} para el fichero {fichero}, pero la cabecera no "
        "contiene ese delimitador fuera de comillas."
    )


def fichero_vacio(fichero: str) -> str:
    return f"El fichero {fichero} está vacío."


def codificacion_invalida(fichero: str) -> str:
    return f"El fichero {fichero} no es UTF-8 válido."


def fichero_demasiado_grande(fichero: str, pesa: int, limite: int) -> str:
    return (
        f"El fichero {fichero} pesa {pesa} bytes y el límite es {limite} bytes (1 MiB)."
    )


def demasiadas_filas(fichero: str, cantidad: int, limite: int) -> str:
    return (
        f"El fichero {fichero} tiene {cantidad} filas de datos y el límite es {limite}. "
        "Cuadra no procesa un prefijo: reduce el fichero y vuelve a importar."
    )


def demasiadas_columnas(fichero: str, cantidad: int, limite: int) -> str:
    return (
        f"El fichero {fichero} tiene {cantidad} columnas y el límite es {limite}."
    )


def sin_cabecera(fichero: str) -> str:
    return f"El fichero {fichero} no tiene fila de cabecera."


def cabecera_duplicada(columna: str, fichero: str) -> str:
    return f"La columna «{columna}» está repetida en la cabecera del fichero {fichero}."


def cabecera_vacia(fichero: str) -> str:
    return f"Hay un nombre de columna vacío en la cabecera del fichero {fichero}."


def columna_inexistente(columna: str, campo: str, fichero: str, encontradas: list[str]) -> str:
    lista = ", ".join(sorted(encontradas))
    return (
        f"La columna «{columna}» mapeada como {campo} no existe en el fichero {fichero}. "
        f"Columnas encontradas: {lista}."
    )


def mapeo_repetido(fichero: str) -> str:
    return (
        "Las columnas de identificador, descripción y cantidad deben ser distintas "
        f"en el fichero {fichero}."
    )


def fila_incompleta(fila: int, fichero: str, tiene: int, espera: int) -> str:
    return (
        f"La fila {fila} del fichero {fichero} tiene {tiene} columnas y la cabecera tiene {espera}."
    )


def exportacion_bloqueada(pendientes: int, bloqueados: int) -> str:
    return (
        "La exportación completa está bloqueada: "
        f"{pendientes} pendientes y {bloqueados} bloqueados."
    )


def decision_ilegal(tipo: str, categoria: str, identificador: str) -> str:
    return (
        f"La decisión «{tipo}» no está permitida en una fila {categoria} («{identificador}»)."
    )


def decision_manual_descripcion(identificador: str) -> str:
    return (
        f"No puedes fijar solo la cantidad en «{identificador}» porque las descripciones "
        "difieren. Elige A, elige B o excluye la fila."
    )


def decision_desconocida(identificador: str) -> str:
    return f"La decisión sobre «{identificador}» no corresponde a ninguna fila comparable."


def decision_duplicada(identificador: str) -> str:
    return f"Hay más de una decisión para «{identificador}»."


def decision_tipo_desconocido(identificador: str) -> str:
    return f"La decisión sobre «{identificador}» tiene un tipo desconocido."


def decision_motivo_vacio(identificador: str) -> str:
    return f"La decisión sobre «{identificador}» necesita un motivo."


def decision_cantidad_invalida(identificador: str) -> str:
    return f"La cantidad manual de «{identificador}» no es válida."


def decision_en_bloqueada(identificador: str) -> str:
    return (
        f"La clave «{identificador}» está bloqueada. No se decide: corrige el origen y reimporta."
    )


def sesion_version(version: object) -> str:
    return f"La sesión usa schema_version {version} y Cuadra abre las versiones 1 y 2."


def formato_no_soportado(fichero: str, detalle: str) -> str:
    return f"El fichero {fichero} no se puede leer: {detalle}"


def formato_distinto(fichero: str, elegido: str, encontrado: str) -> str:
    return (
        f"Indicaste {elegido} para el fichero {fichero}, pero el contenido es {encontrado}."
    )


def archivo_danado(fichero: str, formato: str) -> str:
    return f"El fichero {fichero} está dañado o no es un {formato} válido."


def hoja_requerida(fichero: str, hojas: list[str]) -> str:
    lista = ", ".join(hojas)
    return (
        f"El fichero {fichero} tiene varias hojas ({lista}). Elige una. Cuadra no elige en silencio."
    )


def hoja_inexistente(fichero: str, hoja: str, hojas: list[str]) -> str:
    lista = ", ".join(hojas)
    return f"La hoja «{hoja}» no está en el fichero {fichero}. Hojas: {lista}."


def sin_hojas(fichero: str) -> str:
    return f"El fichero {fichero} no tiene hojas."


def json_invalido(fichero: str) -> str:
    return f"El fichero {fichero} no es JSON válido."


def json_no_es_lista(fichero: str) -> str:
    return f"El JSON del fichero {fichero} tiene que ser un array de objetos."


def json_vacio(fichero: str) -> str:
    return f"El JSON del fichero {fichero} es un array vacío."


def json_fila(fichero: str, fila: int) -> str:
    return f"El elemento de la fila {fila} del fichero {fichero} no es un objeto."


def json_clave(fichero: str, fila: int) -> str:
    return f"En el fichero {fichero}, fila {fila}, hay una clave que no es texto."


def json_valor(fichero: str, fila: int, clave: str) -> str:
    return (
        f"En el fichero {fichero}, fila {fila}, la clave «{clave}» no es texto, número ni nulo."
    )


def base64_invalido(fichero: str) -> str:
    return f"El contenido del fichero {fichero} no viene en base64 válido."


def sesion_hash(fichero: str) -> str:
    return f"El fichero {fichero} no coincide con la sesión (el contenido cambió)."


def sesion_campo(campo: str) -> str:
    return f"A la sesión le falta el campo «{campo}»."


def sesion_campo_desconocido(campo: str) -> str:
    return f"La sesión trae un campo que Cuadra no reconoce: «{campo}»."


def sesion_json() -> str:
    return "La sesión no es JSON válido."


def sesion_decisiones_tipo() -> str:
    return "El campo «decisiones» de la sesión tiene que ser una lista."
