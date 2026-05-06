# Pre-Autorización Quirúrgica

Sistema de pre-autorización quirúrgica.

## Estado

En desarrollo inicial.

## Documentos base

Se agregaron plantillas para arrancar la captura de informacion del reto:

- `docs/informe-medico-template.md`
- `docs/poliza-paciente-template.md`
- `docs/notion-campos-recomendados.md`
- `docs/casos-prueba/README.md`

## Objetivo de estas plantillas

Estandarizar la informacion del hospital y de la aseguradora para que un agente pueda evaluar:

- si el procedimiento esta cubierto,
- si cumple carencia,
- si faltan documentos,
- y si corresponde preaprobacion o revision manual.

## Casos para demo

Se agregaron 5 casos de prueba completos con:

- informe medico,
- poliza del paciente,
- y resultado esperado.

Tambien se generaron PDFs por caso en `docs/casos-prueba-pdf/`.
