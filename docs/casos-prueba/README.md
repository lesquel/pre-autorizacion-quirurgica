# Casos de Prueba

Estos 5 casos sirven para probar el agente de punta a punta.

Cada archivo incluye:

- `Informe medico`
- `Poliza del paciente`
- `Decision esperada`
- `Motivo de la decision`

## Casos incluidos

1. `caso-01-preaprobado.md`: cobertura valida, carencia cumplida, documentos completos.
2. `caso-02-documentos-faltantes.md`: cobertura valida, pero faltan soportes.
3. `caso-03-exclusion-explicita.md`: procedimiento excluido por la poliza.
4. `caso-04-carencia-no-cumplida.md`: procedimiento cubierto, pero no cumple carencia.
5. `caso-05-revision-manual.md`: caso gris que debe escalarse.

## Como usarlos

Puedes cargar cada caso como:

1. Una pagina en Notion con secciones separadas.
2. Dos registros relacionados: uno para `Informe Medico` y otro para `Poliza`.
3. Un JSON por caso si despues quieren automatizar ingestion.

## Salidas que deberia producir el agente

- `Preaprobado`
- `Pendiente por documentos`
- `Rechazado por exclusion`
- `Rechazado por carencia`
- `Escalar a revision humana`
