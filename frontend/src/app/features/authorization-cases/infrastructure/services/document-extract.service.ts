import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL } from '../../../../shared/api/api-base-url.token';

/** Respuesta `POST /api/v1/extract/medical-report-pdf` */
export interface MedicalPdfExtractDto {
  readonly patient_id: string | null;
  readonly policy_number: string | null;
  readonly attending_doctor: string | null;
  readonly diagnosis: string | null;
  readonly diagnosis_code: string | null;
  readonly procedure_code: string | null;
  readonly procedure_name: string | null;
  readonly report_text_summary: string | null;
  readonly confidence: number;
}

/** Respuesta `POST /api/v1/extract/policy-pdf` */
export interface PolicyPdfExtractDto {
  readonly policy_number: string | null;
  readonly patient_id: string | null;
  readonly insurer_name: string | null;
  readonly plan_name: string | null;
  readonly confidence: number;
}

/**
 * Llama a los endpoints de extracción por visión (Gemini) para autocompletar
 * el formulario de submit antes de crear el caso en Notion/API.
 */
@Injectable({ providedIn: 'root' })
export class DocumentExtractService {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  extractMedicalPdf(file: File): Observable<MedicalPdfExtractDto> {
    const fd = new FormData();
    fd.set('file', file, file.name);
    return this.http.post<MedicalPdfExtractDto>(
      `${this.base}/api/v1/extract/medical-report-pdf`,
      fd,
    );
  }

  extractPolicyPdf(file: File): Observable<PolicyPdfExtractDto> {
    const fd = new FormData();
    fd.set('file', file, file.name);
    return this.http.post<PolicyPdfExtractDto>(`${this.base}/api/v1/extract/policy-pdf`, fd);
  }
}
