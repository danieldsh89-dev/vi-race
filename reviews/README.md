# Revisiones humanas

Los JSON de esta carpeta se revisan por cambios en GitHub, con protección de rama y CODEOWNERS configurados por el propietario. Los mantenedores se registran en `config/reviewers.json`; una lista vacía bloquea todas las confirmaciones. El mantenedor actual corresponde a la cuenta que el propietario autorizó para este proyecto.

Cada archivo contiene `schema_version: "1"`, arrays `evidence`, `assessments`, `candidate_reviews`. Los contratos exactos y campos obligatorios están en `packages/contracts/src/index.ts`. La evidencia usa un ID nuevo para un material nuevo; las evaluaciones son append-only y las correcciones indican `supersedes_id`. No editar la evaluación anterior.

`review_commit` debe ser un SHA completo de la revisión aprobada. Para evitar un SHA que se refiera a sí mismo, referencia un commit previo con el material aprobado y añade el registro en el commit siguiente. Mantén el enlace de aprobación y la justificación revisables. El pipeline comprueba forma, mantenedor y referencias; la protección de GitHub y el propietario acreditan que la revisión fue efectivamente humana, no la presencia de 40 caracteres.

La aceptación de un candidato exige `linked_project_id`, proyecto admitido en `config/projects.json` y versión en `target_versions`. Para duplicados indica el proyecto de destino. Rechazos y aplazamientos conservan responsable, motivo y fecha. Una fuente admitida requiere `provider_repo_id` estable verificado. Los resultados de Radar nunca entran solos al catálogo.

Antes de enviar: `npm run validate` y `npm run check`. No hay un endpoint público para aprobar decisiones.
