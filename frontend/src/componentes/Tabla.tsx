import { useId, useState } from "react"
import { ArrowLeftRight, ArrowRight, CircleOff, Equal, PanelLeft } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { ETIQUETA_FILTRO, ayudaFila, etiquetaCategoria, opcionesDecision, pasaFiltro } from "../opciones.ts"
import type { DecisionEnviada, ErrorValidacion, Fila, Filtro, Resumen } from "../tipos.ts"

type Props = {
  filas: Fila[]
  resumen: Resumen
  erroresDecision: ErrorValidacion[]
  filtro: Filtro
  busqueda: string
  onFiltro: (filtro: Filtro) => void
  onBusqueda: (texto: string) => void
  onDecision: (decision: DecisionEnviada) => void
  guardando: boolean
}

export function TablaCuadre({
  filas,
  resumen,
  erroresDecision,
  filtro,
  busqueda,
  onFiltro,
  onBusqueda,
  onDecision,
  guardando,
}: Props) {
  const buscarId = useId()
  const visibles = filas.filter((fila) => pasaFiltro(fila, filtro, busqueda))
  return (
    <section id="cuadre" className="grid gap-4" aria-labelledby="titulo-cuadre">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="titulo-cuadre" className="titulo text-2xl">
          Diferencias
        </h2>
        <p aria-live="polite" className="text-sm">
          Pendientes: {resumen.pendientes}. Resueltos: {resumen.resueltos}. Bloqueados: {resumen.bloqueados}.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar filas">
        {ETIQUETA_FILTRO.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant="outline"
            className="filtro"
            aria-pressed={filtro === item.id}
            onClick={() => onFiltro(item.id)}
          >
            {item.etiqueta}
          </Button>
        ))}
      </div>
      <div className="grid max-w-md gap-1.5">
        <Label htmlFor={buscarId}>Buscar</Label>
        <Input
          id={buscarId}
          value={busqueda}
          onChange={(evento) => onBusqueda(evento.target.value)}
          placeholder="Identificador o descripción"
        />
      </div>
      {visibles.length === 0 ? (
        <p className="cristal-denso px-4 py-6 text-sm">
          Ninguna fila coincide con este filtro.
        </p>
      ) : (
        <div className="cristal-denso overflow-x-auto">
          <table className="tabla-cuadre">
            <caption className="sr-only">
              Valores de A frente a B, con la decisión de cada clave
            </caption>
            <thead>
              <tr>
                <th scope="col">Clave</th>
                <th scope="col">En A</th>
                <th scope="col">En B</th>
                <th scope="col">Decisión</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((fila) => (
                <FilaTabla
                  key={claveFila(fila)}
                  fila={fila}
                  errores={erroresDecision.filter((error) => error.mensaje.includes(`«${fila.identificador}»`))}
                  onDecision={onDecision}
                  guardando={guardando}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function IconoFila({ tipo }: { tipo: Fila["tipo"] }) {
  const comun = { size: 14, "aria-hidden": true as const }
  if (tipo === "iguales") return <Equal {...comun} />
  if (tipo === "modificados") return <ArrowLeftRight {...comun} />
  if (tipo === "solo_en_A") return <PanelLeft {...comun} />
  if (tipo === "solo_en_B") return <ArrowRight {...comun} />
  return <CircleOff {...comun} />
}

function claveFila(fila: Fila): string {
  if (fila.tipo === "bloqueados") return `${fila.fichero}-${fila.fila}-${fila.identificador}`
  return fila.identificador
}

function FilaTabla({
  fila,
  errores,
  onDecision,
  guardando,
}: {
  fila: Fila
  errores: ErrorValidacion[]
  onDecision: (decision: DecisionEnviada) => void
  guardando: boolean
}) {
  const identificador = fila.identificador || "(vacío)"
  return (
    <tr>
      <td data-label="Clave">
        <div className="font-medium">{identificador}</div>
        <div className="mt-1 flex flex-wrap gap-1">
          <span className={`pastilla pastilla-${fila.tipo}`}>
            <IconoFila tipo={fila.tipo} />
            {etiquetaCategoria(fila)}
          </span>
          {fila.tipo !== "bloqueados" ? (
            <Badge variant={fila.estado === "pendiente" ? "outline" : "default"}>
              {fila.estado === "pendiente" ? "Pendiente" : "Resuelta"}
            </Badge>
          ) : null}
        </div>
      </td>
      <td data-label="En A">
        <Celda lado="A" fila={fila} />
      </td>
      <td data-label="En B">
        <Celda lado="B" fila={fila} />
      </td>
      <td data-label="Decisión">
        {fila.tipo === "bloqueados" ? (
          <div className="grid gap-2 text-sm">
            <p>{ayudaFila(fila)}</p>
            <ul className="grid gap-1 text-destructive">
              {fila.errores.map((error) => (
                <li key={error.codigo + error.mensaje}>{error.mensaje}</li>
              ))}
            </ul>
          </div>
        ) : (
          <Formulario
            key={JSON.stringify(fila.decision)}
            fila={fila}
            errores={errores}
            onDecision={onDecision}
            guardando={guardando}
          />
        )}
      </td>
    </tr>
  )
}

function Celda({ lado, fila }: { lado: "A" | "B"; fila: Fila }) {
  if (fila.tipo === "bloqueados") {
    if (fila.fichero !== lado) return <p className="text-sm text-muted-foreground">No está en {lado}.</p>
    return (
      <Valores
        titulo={`${lado} · fila ${fila.fila}`}
        descripcion={fila.descripcion_cruda}
        cantidad={fila.cantidad_cruda || "(vacía)"}
        difiereDescripcion={false}
        difiereCantidad={false}
      />
    )
  }
  if (fila.tipo === "solo_en_A" && lado === "B") {
    return <p className="text-sm text-muted-foreground">No está en B.</p>
  }
  if (fila.tipo === "solo_en_B" && lado === "A") {
    return <p className="text-sm text-muted-foreground">No está en A.</p>
  }
  if (fila.tipo === "iguales" || fila.tipo === "solo_en_A" || fila.tipo === "solo_en_B") {
    const numero = fila.tipo === "solo_en_B" ? fila.fila_b : fila.tipo === "solo_en_A" ? fila.fila_a : lado === "A" ? fila.fila_a : fila.fila_b
    return (
      <Valores
        titulo={`${lado} · fila ${numero}`}
        descripcion={fila.descripcion}
        cantidad={fila.cantidad}
        difiereDescripcion={false}
        difiereCantidad={false}
      />
    )
  }
  const difiereDescripcion = fila.descripcion_difiere
  const difiereCantidad = fila.cantidad_difiere
  return (
    <Valores
      titulo={`${lado} · fila ${lado === "A" ? fila.fila_a : fila.fila_b}`}
      descripcion={lado === "A" ? fila.descripcion_a : fila.descripcion_b}
      cantidad={lado === "A" ? fila.cantidad_a : fila.cantidad_b}
      difiereDescripcion={difiereDescripcion}
      difiereCantidad={difiereCantidad}
    />
  )
}

function Valores({
  titulo,
  descripcion,
  cantidad,
  difiereDescripcion,
  difiereCantidad,
}: {
  titulo: string
  descripcion: string
  cantidad: string
  difiereDescripcion: boolean
  difiereCantidad: boolean
}) {
  return (
    <div className="text-sm">
      <p className="text-muted-foreground">{titulo}</p>
      <p>{descripcion || "(descripción vacía)"}</p>
      {difiereDescripcion ? <p className="text-xs font-medium text-[#b8612e]">La descripción difiere</p> : null}
      <p>Cantidad: {cantidad}</p>
      {difiereCantidad ? <p className="text-xs font-medium text-[#b8612e]">La cantidad difiere</p> : null}
    </div>
  )
}

function Formulario({
  fila,
  errores,
  onDecision,
  guardando,
}: {
  fila: Exclude<Fila, { tipo: "bloqueados" }>
  errores: ErrorValidacion[]
  onDecision: (decision: DecisionEnviada) => void
  guardando: boolean
}) {
  const base = useId()
  const opciones = opcionesDecision(fila)
  const [tipo, setTipo] = useState(fila.decision?.tipo ?? "")
  const [motivo, setMotivo] = useState(fila.decision?.motivo ?? "")
  const [cantidad, setCantidad] = useState(
    fila.decision?.tipo === "cantidad_manual" ? fila.decision.cantidad : "",
  )
  const [local, setLocal] = useState("")

  function guardar() {
    const motivoLimpio = motivo.trim()
    if (tipo !== "elegir_A" && tipo !== "elegir_B" && tipo !== "cantidad_manual" && tipo !== "excluir") {
      setLocal("Elige qué hacer con la fila.")
      return
    }
    if (!motivoLimpio) {
      setLocal("Escribe un motivo. No puede quedar vacío.")
      return
    }
    if (tipo === "cantidad_manual" && cantidad.trim() === "") {
      setLocal("Indica la cantidad manual.")
      return
    }
    setLocal("")
    const comun = { identificador: fila.identificador, motivo: motivoLimpio }
    if (tipo === "cantidad_manual") {
      onDecision({ ...comun, tipo, cantidad: cantidad.trim() })
      return
    }
    onDecision({ ...comun, tipo })
  }

  return (
    <form
      className="grid gap-2"
      onSubmit={(evento) => {
        evento.preventDefault()
        guardar()
      }}
    >
      <p className="text-sm text-muted-foreground">{ayudaFila(fila)}</p>
      <div className="grid gap-1.5">
        <Label htmlFor={`${base}-decision`}>Decisión</Label>
        <select
          id={`${base}-decision`}
          className="campo"
          value={tipo}
          onChange={(evento) => setTipo(evento.target.value)}
        >
          <option value="">Elige qué hacer</option>
          {opciones.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor} disabled={!opcion.activa}>
              {opcion.etiqueta}
              {opcion.activa ? "" : " (no disponible)"}
            </option>
          ))}
        </select>
      </div>
      {tipo === "cantidad_manual" ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`${base}-cantidad`}>Cantidad manual</Label>
          <Input
            id={`${base}-cantidad`}
            inputMode="decimal"
            value={cantidad}
            onChange={(evento) => setCantidad(evento.target.value)}
            placeholder="Por ejemplo 4.5"
            aria-describedby={`${base}-regla`}
          />
          <p id={`${base}-regla`} className="text-xs text-muted-foreground">
            Punto decimal, sin miles, hasta 4 decimales. El menos solo vale como signo.
          </p>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <Label htmlFor={`${base}-motivo`}>Motivo</Label>
        <Input
          id={`${base}-motivo`}
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          required
        />
      </div>
      {local ? <p className="text-sm text-destructive">{local}</p> : null}
      {errores.map((error) => (
        <p key={error.mensaje} className="text-sm text-destructive">
          {error.mensaje}
        </p>
      ))}
      <Button type="submit" size="sm" disabled={guardando}>
        Guardar decisión
      </Button>
    </form>
  )
}
