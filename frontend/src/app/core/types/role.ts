/**
 * Roles de usuario del sistema.
 * - hospital: usuario clínico que envía solicitudes de pre-autorización.
 * - insurer: aseguradora que opera y configura pólizas/coberturas.
 * - auditor: revisor manual de casos escalados.
 */
export type Role = 'hospital' | 'insurer' | 'auditor';
