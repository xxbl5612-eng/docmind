import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-image-viewer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center justify-center p-4 bg-gray-100 rounded-lg min-h-[400px]">
      <img
        *ngIf="src && !error"
        [src]="src"
        [alt]="alt"
        class="max-w-full max-h-[600px] object-contain rounded shadow-md"
        (error)="error = true"
      />
      <div *ngIf="!src" class="text-gray-400 text-center">
        <span class="material-icons text-6xl mb-2">image</span>
        <p>No image to display</p>
      </div>
      <div *ngIf="error" class="text-red-400 text-center">
        <span class="material-icons text-6xl mb-2">broken_image</span>
        <p>Failed to load image</p>
      </div>
    </div>
  `,
})
export class ImageViewerComponent {
  @Input() src: string | null = null;
  @Input() alt = 'Document image';
  error = false;
}
