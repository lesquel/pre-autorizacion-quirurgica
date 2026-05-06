# PDFs de Casos de Prueba

Aqui estan los PDFs listos para demo.

Cada carpeta contiene:

- `informe-medico.pdf`
- `poliza-paciente.pdf`

## Estructura

- `caso-01-preaprobado/`
- `caso-02-documentos-faltantes/`
- `caso-03-exclusion-explicita/`
- `caso-04-carencia-no-cumplida/`
- `caso-05-revision-manual/`

## Regenerar

Si editas los archivos fuente en `docs/casos-prueba`, vuelve a correr:

```bash
python scripts/generate_case_pdfs.py
```
