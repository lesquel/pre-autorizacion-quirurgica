import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Driver, DriveStep } from 'driver.js';

import { RoleService } from './role.service';
import type { Role } from '../types/role';

/**
 * Configuración interna de cada paso del tour. Lo expandimos a `DriveStep`
 * de driver.js cuando llamamos a `start()`.
 */
interface TourStepConfig {
  /** Ruta a la que navegamos antes de mostrar el paso (si difiere de la actual). */
  readonly route?: string;
  /** Rol que tiene que estar activo (usa RoleService para sync UI + navegación). */
  readonly role?: Role;
  /** Selector CSS al que apunta el highlight. Omitir = paso modal sin elemento. */
  readonly element?: string;
  readonly title: string;
  readonly description: string;
  readonly side?: 'top' | 'bottom' | 'left' | 'right';
  readonly align?: 'start' | 'center' | 'end';
  /** ms extra de espera tras navegar (renderizado lazy + animaciones). */
  readonly settleMs?: number;
}

/**
 * Tour completo del demo — 9 pasos cubriendo los 3 roles.
 *
 * Selectors usan el tag de cada componente standalone (ej. `app-segmented`,
 * `app-scenario-picker`) para evitar acoplarse a clases de estilo. Si un
 * componente se renombra, el selector aquí es lo único a actualizar.
 */
const TOUR_STEPS: readonly TourStepConfig[] = [
  {
    title: '👋 Bienvenido',
    description:
      'Pre-Autorización Quirúrgica — agente IA que aprueba cirugías en segundos en lugar de días. Te muestro el flow end-to-end en 9 pasos. Tecla <kbd>→</kbd> avanza, <kbd>Esc</kbd> cierra.',
  },
  {
    role: 'hospital',
    route: '/hospital/submit',
    element: 'app-topbar header',
    title: 'Sesión activa',
    description:
      '3 roles: <strong>Hospital</strong> sube informes, <strong>Aseguradora</strong> ve métricas globales, <strong>Auditor</strong> revisa casos escalados. Cada rol vive en su propia cuenta — para cambiar, cerrá sesión y entrá con otra cuenta demo.',
    side: 'bottom',
    align: 'center',
    settleMs: 200,
  },
  {
    role: 'hospital',
    route: '/hospital/submit',
    element: 'app-scenario-picker',
    title: 'Escenarios demo',
    description:
      'Elegí uno para autocompletar el formulario con datos sintéticos. Hay 5 escenarios cubriendo todos los desenlaces: aprobado, docs faltantes, escalados.',
    side: 'top',
    align: 'start',
    settleMs: 200,
  },
  {
    role: 'hospital',
    route: '/hospital/submit',
    element: 'app-medical-report-form',
    title: 'Formulario del informe',
    description:
      'Paciente, póliza, hint de procedimiento (CIE-10), formato (texto o PDF) y el informe médico completo. Submitea para ver al agente correr.',
    side: 'left',
    align: 'start',
    settleMs: 200,
  },
  {
    role: 'hospital',
    route: '/hospital/live-run',
    element: 'app-agent-trace-viewer',
    title: 'Live run del agente',
    description:
      'El agente ejecuta 7 pasos: extracción → matching CIE-10 → carencia → docs → decisión final. Cada paso registra duración + modelo + tokens. <strong>Auditoría legal por diseño.</strong>',
    side: 'right',
    align: 'start',
    settleMs: 800,
  },
  {
    role: 'hospital',
    route: '/hospital/live-run',
    element: 'app-decision-panel',
    title: 'Decisión final',
    description:
      'Outcome (aprobado / docs / escalado) + <strong>rationale</strong> en lenguaje natural + <strong>evidencia citada</strong> textualmente del informe y la póliza + confidence score. El agente NUNCA auto-rechaza por diseño.',
    side: 'left',
    align: 'start',
    settleMs: 200,
  },
  {
    role: 'auditor',
    route: '/auditor/tray',
    element: 'app-case-table',
    title: 'Bandeja del auditor',
    description:
      'Casos escalados pendientes de revisión clínica humana. Filtros por motivo de escalamiento (carencia, baja confianza, falla de PDF).',
    side: 'top',
    align: 'start',
    settleMs: 300,
  },
  {
    role: 'insurer',
    route: '/insurer/dashboard',
    element: 'app-insurer-dashboard-page',
    title: 'Panel de la aseguradora',
    description:
      'Métricas globales reactivas — auto-aprobados, docs pedidos, escalados, decididos. Confidence promedio + duración promedio del agente. Distribución visual de outcomes.',
    side: 'top',
    align: 'start',
    settleMs: 400,
  },
  {
    title: '✓ Tour completado',
    description:
      'Esos son los 3 flujos del demo. <br><br>El stack: <strong>Angular 21 standalone + signals</strong> en frontend, <strong>FastAPI + LangGraph + DeepSeek</strong> en backend, persistencia en <strong>Notion</strong>. Vertical slicing + Clean Architecture en ambos lados.<br><br>Podés volver a abrir el tour cuando quieras desde el botón <kbd>?</kbd> en la barra superior.',
  },
];

/**
 * Prefijo común del flag "ya vi el tour". Se concatena con el `userId` para
 * que cada usuario tenga su propio flag (issue M3 del adversarial review:
 * shared workstation no debe heredar el flag del usuario anterior).
 */
const TOUR_SEEN_KEY_PREFIX = 'preauth.tour.seen';
const TOUR_SEEN_ANON_SUFFIX = 'anon';

function tourSeenKey(userId: string | null | undefined): string {
  const suffix = userId && userId.length > 0 ? userId : TOUR_SEEN_ANON_SUFFIX;
  return `${TOUR_SEEN_KEY_PREFIX}.${suffix}`;
}

@Injectable({ providedIn: 'root' })
export class TourService {
  private readonly router = inject(Router);
  private readonly roleService = inject(RoleService);
  private instance: Driver | null = null;

  /**
   * Flag de aborto: cuando el usuario cierra el tour mid-flight, las
   * navegaciones / role switches encoladas en `alignToStep` deben cortarse
   * para no cambiar el rol o la ruta DESPUÉS de cerrar el tour.
   */
  private aborted = false;

  /** UserId activo durante la corrida del tour — usado para scope de markSeen(). */
  private currentUserId: string | null = null;

  /**
   * Cache del módulo driver.js. Se carga lazy la primera vez que se llama
   * a `start()` para que el bundle inicial no incluya driver.js (~20 KB
   * gzipped) — la mayoría de los usuarios no abre el tour.
   */
  private driverModule: typeof import('driver.js') | null = null;

  /** Signal pública para que la UI pueda reaccionar (por ejemplo, deshabilitar botones). */
  readonly active = signal(false);

  /**
   * ¿El usuario `userId` ya vio el tour en este browser?
   * Si `userId` es null/undefined cae a un scope anónimo — sigue siendo
   * mejor que el flag global porque queda separado de cualquier user id.
   */
  hasBeenSeen(userId: string | null | undefined = null): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(tourSeenKey(userId)) === '1';
    } catch {
      return false;
    }
  }

  /**
   * Lanza el tour completo. Idempotente: si ya está activo, no hace nada.
   * `opts.userId` se usa para scope del flag "tour seen" (evita que un
   * usuario en una shared workstation herede el flag de otro).
   */
  async start(opts?: { userId?: string | null }): Promise<void> {
    if (this.instance !== null) return;
    this.aborted = false;
    this.currentUserId = opts?.userId ?? null;
    this.active.set(true);

    // Lazy load: driver.js solo se descarga cuando el usuario abre el tour
    // por primera vez (issue H2 del adversarial review).
    const { driver } = await this.loadDriver();
    if (this.aborted) {
      // El usuario cerró antes de que terminara la descarga — desistimos.
      this.active.set(false);
      return;
    }

    // Pre-alineación del primer step: sin esto, el primer popover puede
    // renderizarse antes de que el rol/ruta inicial estén sincronizados.
    await this.alignToStep(TOUR_STEPS[0]);
    if (this.aborted) {
      this.active.set(false);
      return;
    }

    const steps = this.buildDriveSteps();

    this.instance = driver({
      animate: true,
      smoothScroll: true,
      showProgress: true,
      progressText: 'Paso {{current}} de {{total}}',
      nextBtnText: 'Siguiente →',
      prevBtnText: '← Anterior',
      doneBtnText: '✓ Listo',
      overlayColor: 'rgba(20, 19, 15, 0.55)',
      // Tomamos control manual de la transición entre steps. Sin esto,
      // driver.js avanza el step ANTES de que terminemos de navegar a la
      // ruta destino — el popover renderiza buscando un selector en una
      // ruta que todavía no se montó (issue M1 del adversarial review).
      onNextClick: () => {
        void this.handleNavigationClick('next');
      },
      onPrevClick: () => {
        void this.handleNavigationClick('prev');
      },
      onDestroyed: () => {
        this.instance = null;
        this.currentUserId = null;
        this.active.set(false);
        this.markSeen();
      },
      steps,
    });

    this.instance.drive();
  }

  /** Cierra el tour si está activo. */
  end(): void {
    // Marcamos abort ANTES de destroy para que cualquier alignToStep
    // mid-flight chequee la bandera y no siga navegando.
    this.aborted = true;
    this.instance?.destroy();
  }

  /** Resetea el flag "tour seen" — útil para devs que quieran ver el tour de nuevo. */
  resetSeenFlag(userId?: string | null): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(tourSeenKey(userId ?? null));
    } catch {
      // No-op: storage deshabilitado.
    }
  }

  // ─── Internals ───────────────────────────────────────────────────────

  private async loadDriver(): Promise<typeof import('driver.js')> {
    if (this.driverModule === null) {
      this.driverModule = await import('driver.js');
    }
    return this.driverModule;
  }

  private buildDriveSteps(): DriveStep[] {
    // No usamos `onHighlightStarted` por step: la sincronización de rol/
    // ruta corre en `onNextClick`/`onPrevClick` global, ANTES de pedirle a
    // driver.js que avance. El popover entonces apunta a un elemento que
    // ya existe en el DOM.
    return TOUR_STEPS.map((cfg) => ({
      element: cfg.element,
      popover: {
        title: cfg.title,
        description: cfg.description,
        side: cfg.side,
        align: cfg.align,
        // driver.js permite HTML en description; usamos para <strong>/<kbd>.
        // El sanitization lo cubre el navegador (no inyectamos input del user).
      },
    }));
  }

  /**
   * Lógica común de los hooks `onNextClick` / `onPrevClick`: navega al
   * step destino, espera a que el elemento esté en el DOM, y recién ahí
   * le dice a driver.js que avance / retroceda.
   */
  private async handleNavigationClick(direction: 'next' | 'prev'): Promise<void> {
    if (this.aborted || this.instance === null) return;

    const currentIdx = this.instance.getActiveIndex() ?? 0;
    const targetIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;

    if (targetIdx >= TOUR_STEPS.length) {
      // Más allá del último step → cerrar (driver.js no llama a onDestroy
      // automáticamente cuando interceptamos onNextClick en el último).
      this.instance.destroy();
      return;
    }
    if (targetIdx < 0) return;

    await this.alignToStep(TOUR_STEPS[targetIdx]);
    if (this.aborted || this.instance === null) return;

    if (direction === 'next') {
      this.instance.moveNext();
    } else {
      this.instance.movePrevious();
    }
  }

  /**
   * Asegura que el rol y la ruta correspondan al step antes del highlight.
   * Chequea `aborted` en cada hop para cortar si el usuario cerró el tour
   * mientras esto seguía corriendo (issue H_C4).
   */
  private async alignToStep(cfg: TourStepConfig): Promise<void> {
    if (this.aborted) return;
    if (cfg.role !== undefined && this.roleService.role() !== cfg.role) {
      this.roleService.set(cfg.role);
    }
    if (this.aborted) return;
    if (cfg.route !== undefined && !this.router.url.startsWith(cfg.route)) {
      try {
        await this.router.navigate([cfg.route]);
      } catch {
        // Auth guard nos puede tirar a /login: el tour seguirá apuntando al
        // selector destino — si no está, driver.js lo skipea silenciosamente.
      }
    }
    if (this.aborted) return;
    if (cfg.element !== undefined) {
      await this.waitForElement(cfg.element, cfg.settleMs ?? 0);
    } else if (cfg.settleMs !== undefined) {
      await this.delay(cfg.settleMs);
    }
  }

  /**
   * Polling corto buscando un elemento por selector. Útil tras router.navigate
   * con lazy load: el componente todavía no existe en el DOM cuando el
   * Promise de navigate resuelve.
   *
   * Sale temprano si `aborted` es true (issue H_C4).
   */
  private async waitForElement(
    selector: string,
    extraSettleMs: number,
    timeoutMs = 4000,
  ): Promise<void> {
    if (typeof document === 'undefined') return;
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.aborted) return;
      if (document.querySelector(selector) !== null) {
        if (extraSettleMs > 0) await this.delay(extraSettleMs);
        return;
      }
      await this.delay(80);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private markSeen(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(tourSeenKey(this.currentUserId), '1');
    } catch {
      // No-op.
    }
  }
}
