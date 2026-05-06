# Campos Recomendados en Notion

Para el hackathon te conviene separar la informacion en 2 bases de datos o 2 tipos de registro dentro de una sola base:

1. `Informes Medicos`
2. `Polizas`

La IA funciona mejor si los campos son estructurados y no solo texto libre.

## Base de datos: Informes Medicos

Campos sugeridos:

- `Paciente` (title)
- `ID Paciente` (text)
- `Numero Poliza` (text)
- `Aseguradora` (select)
- `Diagnostico Principal` (text)
- `Codigo CIE10` (text)
- `Procedimiento Solicitado` (text)
- `Codigo Procedimiento` (text)
- `Justificacion Medica` (rich text)
- `Urgencia` (select: Electiva, Prioritaria, Urgente)
- `Preexistencia` (select: Si, No, Pendiente)
- `Accidente` (select: Si, No)
- `Fecha Evaluacion` (date)
- `Hospital` (text)
- `Medico Tratante` (text)
- `Adjuntos Completos` (checkbox)
- `Documentos Faltantes` (rich text)

## Base de datos: Polizas

Campos sugeridos:

- `Numero Poliza` (title)
- `Paciente` (text)
- `Aseguradora` (select)
- `Plan` (text)
- `Estado Poliza` (select: Activa, Suspendida, Cancelada)
- `Inicio Vigencia` (date)
- `Fin Vigencia` (date)
- `Procedimientos Cubiertos` (rich text)
- `Procedimientos Excluidos` (rich text)
- `Carencia Cirugias Programadas Dias` (number)
- `Carencia Preexistencias Dias` (number)
- `Excepcion Urgencia Vital` (checkbox)
- `Documentos Requeridos` (rich text)
- `Copago` (number)
- `Deducible` (number)
- `Red Hospitalaria` (rich text)

## Regla minima para el agente

El agente puede tomar una decision simple usando estas validaciones:

1. La poliza esta activa y vigente.
2. El procedimiento aparece como cubierto o no aparece como excluido.
3. La carencia ya se cumplio o existe una excepcion por urgencia/accidente.
4. Los documentos obligatorios fueron adjuntados.

## Salidas recomendadas del agente

- `Preaprobado`
- `Pendiente por documentos`
- `Rechazado por exclusion`
- `Rechazado por carencia`
- `Escalar a revision humana`

## Consejo practico

Si quieres que el agente sea consistente, guarda tambien una version estructurada en JSON con los mismos campos del formulario. Para demo de hackathon, puedes capturar el documento en Markdown y luego pasarlo a JSON antes de evaluarlo.
