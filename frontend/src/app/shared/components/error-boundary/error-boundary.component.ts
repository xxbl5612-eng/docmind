import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'app-error-boundary',
  standalone: true,
  imports: [NgIf],
  template: `
    <div
      *ngIf="error"
      class="bg-red-50 border border-red-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      role="alert"
    >
      <div class="flex items-start gap-3">
        <span class="text-red-500 text-xl leading-none mt-0.5 shrink-0">!</span>
        <div>
          <p class="text-sm font-medium text-red-800">Something went wrong</p>
          <p class="text-sm text-red-600 mt-1">{{ error }}</p>
        </div>
      </div>
      <button
        (click)="retry.emit()"
        class="shrink-0 px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors self-end sm:self-center"
      >
        Retry
      </button>
    </div>
  `,
  styles: [``],
})
export class ErrorBoundaryComponent {
  @Input() error: string | null = null;
  @Output() retry = new EventEmitter<void>();
}
