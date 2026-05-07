import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

export interface SegmentedOption {
  value: string;
  label: string;
}

/**
 * Segmented — grupo de botones tipo segmented control.
 *
 * Replica `.seg` del prototipo: borde único, padding 2px, sin gap,
 * tipografía mono uppercase. El activo invierte (bg-ink/text-bg).
 */
@Component({
  selector: 'app-segmented',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="tablist"
      class="inline-flex border border-line bg-bg-2 p-0.5"
    >
      @for (opt of options(); track opt.value) {
        <button
          type="button"
          role="tab"
          [attr.aria-selected]="opt.value === value()"
          [class]="
            opt.value === value()
              ? 'bg-ink text-bg px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors'
              : 'bg-bg-2 text-ink-3 hover:bg-bg-3 px-3 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors'
          "
          (click)="select(opt.value)"
        >
          {{ opt.label }}
        </button>
      }
    </div>
  `,
})
export class Segmented {
  readonly options = input.required<SegmentedOption[]>();
  readonly value = input.required<string>();
  readonly valueChange = output<string>();

  protected select(next: string): void {
    if (next !== this.value()) {
      this.valueChange.emit(next);
    }
  }
}
